import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCloudServer } from './server.mjs'
import { createNewGameStateV10 } from './fixtures.mjs'

async function fixture(t, options = {}) {
  let clock = Date.now()
  const codes = new Map(), dir = mkdtempSync(join(tmpdir(), 'egg-cloud-test-'))
  const server = createCloudServer({ dbPath: join(dir, 'cloud.sqlite'), now: () => clock, origins: ['http://localhost'], sendCode: async (email, purpose, code) => codes.set(`${email}:${purpose}`, code), ...options })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true, force: true }) })
  const call = async (path, method = 'GET', body, token, headers = {}) => {
    const response = await fetch(`${url}/api/${path}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, body: await response.json() }
  }
  const password = 'test-password-123'
  const register = async email => {
    assert.equal((await call('auth/code','POST',{ email, purpose: 'register' })).status, 200)
    const code = codes.get(`${email}:register`)
    assert.equal((await call('auth/register','POST',{ email,password,code })).status, 200)
    const login = await call('auth/login','POST',{email,password})
    assert.equal(login.status,200)
    return login.body.token
  }
  return { call, codes, register, password, advance: ms => { clock += ms } }
}

test('邮箱验证注册、登录、账号隔离、覆盖修订号及密码找回完整链路', async t => {
  const f = await fixture(t)
  const a = await f.register('a@example.com'), b = await f.register('b@example.com')
  assert.equal((await f.call('save/meta')).status,401)
  assert.equal((await f.call('save/meta','GET',undefined,a)).body.save,null)
  const data = createNewGameStateV10('云中少侠', Date.now())
  data.idleVouchers.balance = 123
  data.idleVouchers.activeMode = 'guard'
  data.premiumCards.expiresAt.monthly = Date.now() + 30 * 86_400_000
  data.premiumCards.remainders.hero_player = { experience: 80, skillPoints: 10 }
  const upload = await f.call('save','PUT',{data,revision:0},a)
  assert.equal(upload.status,200); assert.equal(upload.body.save.revision,1)
  assert.equal((await f.call('save/meta','GET',undefined,b)).body.save,null)
  assert.equal((await f.call('save','GET',undefined,b)).status,404)
  assert.equal((await f.call('save','PUT',{data,revision:0},a)).status,409)
  assert.equal((await f.call('save','GET',undefined,a)).body.data.heroes.hero_player.customName,'云中少侠')
  assert.deepEqual((await f.call('save','GET',undefined,a)).body.data.idleVouchers, data.idleVouchers)
  assert.deepEqual((await f.call('save','GET',undefined,a)).body.data.premiumCards, data.premiumCards)
  const race = await Promise.all([f.call('save','PUT',{data,revision:1},a),f.call('save','PUT',{data,revision:1},a)])
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409])
  assert.equal((await f.call('save','PUT',{data:{...data,version:18},revision:2},a)).status,400)
  f.advance(61_000)
  assert.equal((await f.call('auth/code','POST',{email:'a@example.com',purpose:'reset'})).status,200)
  const reset = { email:'a@example.com',password:'updated-password-123',code:f.codes.get('a@example.com:reset') }
  assert.equal((await f.call('auth/reset','POST',reset)).status,200)
  assert.equal((await f.call('auth/reset','POST',reset)).status,400)
  assert.equal((await f.call('save/meta','GET',undefined,a)).status,401)
  assert.equal((await f.call('auth/login','POST',{email:reset.email,password:f.password})).status,401)
  const login = await f.call('auth/login','POST',reset)
  assert.equal(login.status,200)
  assert.equal((await f.call('save/meta','GET',undefined,login.body.token)).body.save.revision,2)
  assert.equal((await f.call('auth/logout','POST',{},login.body.token)).status,200)
  assert.equal((await f.call('save/meta','GET',undefined,login.body.token)).status,401)
})

test('验证码过期、错误次数限制、单次使用、发送频率和非法来源', async t => {
  const f = await fixture(t), email = 'code@example.com'
  assert.equal((await f.call('auth/code','POST',{email,purpose:'register'},undefined,{Origin:'https://evil.example'})).status,403)
  assert.equal((await f.call('auth/code','POST',{email,purpose:'register'})).status,200)
  const code = f.codes.get(`${email}:register`)
  assert.equal((await f.call('auth/code','POST',{email,purpose:'register'})).status,429)
  for(let i=0;i<5;i++) assert.equal((await f.call('auth/register','POST',{email,password:f.password,code:'000000'})).status,400)
  assert.equal((await f.call('auth/register','POST',{email,password:f.password,code})).status,400)
  f.advance(61_000)
  await f.call('auth/code','POST',{email,purpose:'register'})
  f.advance(601_000)
  assert.equal((await f.call('auth/register','POST',{email,password:f.password,code:f.codes.get(`${email}:register`)})).status,400)
  const token = await f.register('ok@example.com')
  assert.equal((await f.call('auth/register','POST',{email:'ok@example.com',password:f.password,code:f.codes.get('ok@example.com:register')})).status,400)
  f.advance(86400_001)
  assert.equal((await f.call('save/meta','GET',undefined,token)).status,401)
})

test('邮件发送失败不会留下可用验证码', async t => {
  let code
  const f = await fixture(t,{ sendCode: async (_email,_purpose,value) => { code=value; throw new Error('SMTP failed') } })
  assert.equal((await f.call('auth/code','POST',{email:'fail@example.com',purpose:'register'})).status,503)
  assert.equal((await f.call('auth/register','POST',{email:'fail@example.com',password:f.password,code})).status,400)
})
