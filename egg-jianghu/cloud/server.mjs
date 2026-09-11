import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import { validateSave } from './validator.mjs'

const scrypt = promisify(scryptCallback)
const digest = value => createHash('sha256').update(value).digest('hex')
const fail = (status, message) => { throw Object.assign(new Error(message), { status }) }
let activeHashes = 0
const passwordHash = async (password, salt) => {
  if (activeHashes >= 4) fail(503, '账号服务繁忙，请稍后重试')
  activeHashes++
  try { return (await scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 })).toString('hex') }
  finally { activeHashes-- }
}
const emailOf = value => {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail(400, '请输入有效邮箱')
  return value.trim().toLowerCase()
}
const checkPassword = value => {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) fail(400, '密码需要 10～128 个字符')
}

export function createCloudServer({ dbPath = ':memory:', sendCode, origins = [], now = Date.now } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(dbPath)
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS codes(email TEXT NOT NULL, purpose TEXT NOT NULL, hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, ready INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(email,purpose));
    CREATE TABLE IF NOT EXISTS saves(user_id INTEGER PRIMARY KEY REFERENCES users(id), revision INTEGER NOT NULL, updated INTEGER NOT NULL, json TEXT NOT NULL, summary TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`)
  const tx = fn => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result } catch (error) { db.exec('ROLLBACK'); throw error } }
  function limit(key, max, windowMs) {
    const row = db.prepare('SELECT * FROM limits WHERE key=?').get(key)
    if (row && row.expires > now() && row.count >= max) fail(429, '操作过于频繁，请稍后重试')
    db.prepare('INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=?, expires=?').run(key, now() + windowMs, row?.expires > now() ? row.count + 1 : 1, row?.expires > now() ? row.expires : now() + windowMs)
  }
  function consumeCode(email, purpose, code) {
    const row = db.prepare('SELECT * FROM codes WHERE email=? AND purpose=?').get(email, purpose)
    if (!row || !row.ready || row.expires <= now() || row.attempts >= 5 || typeof code !== 'string') fail(400, '验证码错误或已过期，请重新获取')
    if (!timingSafeEqual(Buffer.from(row.hash, 'hex'), Buffer.from(digest(`${email}:${purpose}:${code}`), 'hex'))) {
      db.prepare('UPDATE codes SET attempts=attempts+1 WHERE email=? AND purpose=?').run(email, purpose)
      fail(400, '验证码错误或已过期，请重新获取')
    }
    return row.hash
  }
  const consumeChecked = (email, purpose, hash) => {
    const result = db.prepare('DELETE FROM codes WHERE email=? AND purpose=? AND hash=? AND expires>? AND attempts<5 AND ready=1').run(email, purpose, hash, now())
    if (result.changes !== 1) fail(400, '验证码已失效，请重新获取')
  }
  const authenticate = req => {
    const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1]
    const user = token && db.prepare('SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?').get(digest(token), now())
    if (!user) fail(401, '登录已失效，请重新登录')
    return user
  }
  const meta = row => row ? { revision: row.revision, updatedAt: row.updated, summary: JSON.parse(row.summary) } : null
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const origin = req.headers.origin
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)) }
    try {
      if (origin && !origins.includes(origin)) fail(403, '此客户端来源未被允许')
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin') }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        res.writeHead(204); res.end(); return
      }
      const path = new URL(req.url, 'http://localhost').pathname
      if (path === '/api/health' && req.method === 'GET') { send(200, { ok: true }); return }
      const ip = req.headers['x-real-ip'] ?? req.socket.remoteAddress
      limit(`all:${ip}`, 180, 60_000)
      let body = {}
      if (['POST','PUT'].includes(req.method)) {
        if (!req.headers['content-type']?.startsWith('application/json')) fail(415, '需要 JSON 请求')
        let size = 0; const chunks = []
        for await (const chunk of req) { size += chunk.length; if (size > 5 * 1024 * 1024) fail(413, '存档过大'); chunks.push(chunk) }
        try { body = JSON.parse(Buffer.concat(chunks).toString()) } catch { fail(400, '请求格式无效') }
        if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, '请求格式无效')
      }
      if (path === '/api/auth/code' && req.method === 'POST') {
        const email = emailOf(body.email), purpose = body.purpose
        if (!['register','reset'].includes(purpose)) fail(400, '验证码用途无效')
        limit(`mail-ip:${ip}`, 20, 3600_000); limit(`mail-hour:${email}`, 5, 3600_000); limit(`mail-minute:${email}`, 1, 60_000)
        const user = db.prepare('SELECT id FROM users WHERE email=?').get(email)
        if ((purpose === 'register' && user) || (purpose === 'reset' && !user)) { send(200, { message: '如邮箱符合条件，验证码已发送，请检查收件箱或垃圾邮件' }); return }
        const code = String(randomInt(100000, 1000000)), hash = digest(`${email}:${purpose}:${code}`)
        db.prepare('INSERT INTO codes VALUES(?,?,?,?,0,0) ON CONFLICT(email,purpose) DO UPDATE SET hash=excluded.hash, expires=excluded.expires, attempts=0, ready=0').run(email, purpose, hash, now() + 600_000)
        try { await sendCode(email, purpose, code) } catch {
          db.prepare('DELETE FROM codes WHERE email=? AND purpose=? AND hash=?').run(email, purpose, hash)
          fail(503, '邮件发送失败，请稍后重试')
        }
        db.prepare('UPDATE codes SET ready=1 WHERE email=? AND purpose=? AND hash=?').run(email, purpose, hash)
        send(200, { message: '如邮箱符合条件，验证码已发送，请检查收件箱或垃圾邮件' }); return
      }
      if (['/api/auth/register','/api/auth/reset'].includes(path) && req.method === 'POST') {
        limit(`verify:${ip}`, 20, 60_000)
        const email = emailOf(body.email); checkPassword(body.password)
        const purpose = path.endsWith('register') ? 'register' : 'reset'
        const codeHash = consumeCode(email, purpose, body.code)
        const salt = randomBytes(16).toString('hex'), hash = await passwordHash(body.password, salt)
        tx(() => {
          consumeChecked(email, purpose, codeHash)
          if (purpose === 'register') {
            if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) fail(400, '无法注册，请尝试登录或找回密码')
            db.prepare('INSERT INTO users(email,salt,password) VALUES(?,?,?)').run(email, salt, hash)
          } else {
            const user = db.prepare('SELECT id FROM users WHERE email=?').get(email)
            if (!user) fail(400, '无法重置密码')
            db.prepare('UPDATE users SET salt=?,password=? WHERE id=?').run(salt, hash, user.id)
            db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id)
          }
        })
        send(200, { message: purpose === 'register' ? '注册成功，请登录' : '密码已重置，请重新登录' }); return
      }
      if (path === '/api/auth/login' && req.method === 'POST') {
        const email = emailOf(body.email); checkPassword(body.password)
        limit(`login-ip:${ip}`, 20, 900_000); limit(`login-email:${email}`, 10, 900_000)
        const user = db.prepare('SELECT * FROM users WHERE email=?').get(email)
        const hash = await passwordHash(body.password, user?.salt ?? 'invalid-user-salt')
        if (!user || !timingSafeEqual(Buffer.from(hash,'hex'), Buffer.from(user.password,'hex'))) fail(401, '邮箱或密码不正确')
        // 哈希计算期间若密码被重置，本次旧密码登录不得产生新会话。
        if (db.prepare('SELECT password FROM users WHERE id=?').get(user.id).password !== user.password) fail(401, '密码已更新，请重新登录')
        const token = randomBytes(32).toString('hex')
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), user.id, now() + 86400_000)
        send(200, { token, email: user.email }); return
      }
      const user = authenticate(req)
      if (path === '/api/auth/logout' && req.method === 'POST') {
        db.prepare('DELETE FROM sessions WHERE token=?').run(digest(req.headers.authorization.slice(7)))
        send(200, { ok: true }); return
      }
      if (path === '/api/save/meta' && req.method === 'GET') { send(200, { save: meta(db.prepare('SELECT revision,updated,summary FROM saves WHERE user_id=?').get(user.id)) }); return }
      if (path === '/api/save' && req.method === 'GET') {
        const row = db.prepare('SELECT * FROM saves WHERE user_id=?').get(user.id)
        if (!row) fail(404, '云端还没有存档')
        send(200, { ...meta(row), data: JSON.parse(row.json) }); return
      }
      if (path === '/api/save' && req.method === 'PUT') {
        if (!Number.isSafeInteger(body.revision) || body.revision < 0) fail(400, '存档修订号无效')
        let validated
        try { validated = validateSave(body.data) } catch { fail(400, '存档版本不受支持或数据无效') }
        const updated = now()
        const revision = tx(() => {
          const row = db.prepare('SELECT revision FROM saves WHERE user_id=?').get(user.id)
          if ((row?.revision ?? 0) !== body.revision) fail(409, '云存档已被其他设备更新，请刷新后重新确认')
          const next = body.revision + 1
          db.prepare('INSERT INTO saves VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision, updated=excluded.updated,json=excluded.json,summary=excluded.summary').run(user.id, next, updated, validated.json, JSON.stringify(validated.summary))
          return next
        })
        send(200, { save: { revision, updatedAt: updated, summary: validated.summary } }); return
      }
      fail(404, '接口不存在')
    } catch (error) { if (!res.headersSent) send(error.status ?? 500, { message: error.status ? error.message : '服务暂时不可用，请稍后重试' }); else res.end() }
  })
  server.requestTimeout = 30_000; server.headersTimeout = 15_000
  const clean = setInterval(() => {
    db.prepare('DELETE FROM sessions WHERE expires<?').run(now())
    db.prepare('DELETE FROM codes WHERE expires<?').run(now())
    db.prepare('DELETE FROM limits WHERE expires<?').run(now())
  }, 60_000); clean.unref()
  server.on('close', () => { clearInterval(clean); db.close() })
  return server
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const transport = nodemailer.createTransport({ host: 'smtp.qq.com', port: 465, secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 10_000, socketTimeout: 15_000 })
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('缺少邮件服务配置')
  const server = createCloudServer({ dbPath: process.env.DB_PATH ?? './data/cloud.sqlite',
    origins: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
    sendCode: (email, purpose, code) => transport.sendMail({
      from: { name: '蛋蛋江湖', address: process.env.SMTP_USER }, to: email,
      subject: `蛋蛋江湖 · ${purpose === 'register' ? '注册验证' : '重置密码'}`,
      text: `你的${purpose === 'register' ? '注册' : '密码重置'}验证码是：${code}\n10 分钟内有效，仅可使用一次。请在游戏内输入。若非本人操作，请忽略。`,
    }),
  })
  server.listen(Number(process.env.PORT ?? 8787), '127.0.0.1', () => console.log('云存档服务已启动'))
  process.on('SIGTERM', () => server.close(() => process.exit(0)))
}
