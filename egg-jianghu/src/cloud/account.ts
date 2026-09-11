import { escapeHtml as h } from '../ui/html'
import { validateSave } from './validator'

const API = import.meta.env.VITE_CLOUD_API_URL || 'https://223.6.255.187'
export interface CloudSummary { name: string; level: number; version: number; savedAt: number; progress: number }
interface CloudMeta { revision: number; updatedAt: number; summary: CloudSummary }
export interface Hooks { localSave: () => unknown | null; install: (json: string) => void | Promise<void>; restore: () => void | Promise<void>; hasBackup: () => boolean; refreshLocal?: () => Promise<void>; returnToGame?: () => void }
export function createCloudAccount(hooks: Hooks) {
  const dialog = document.createElement('dialog')
  dialog.className = 'cloud-dialog'
  dialog.setAttribute('aria-label', '账号与云存档')
  document.body.append(dialog)
  let token: string | null = null, email = '', mode: 'login' | 'register' | 'reset' = 'login'
  let message = '', busy = false, metadata: CloudMeta | null = null, loaded = false
  let pending: { kind: 'upload' | 'download' | 'restore'; data?: unknown; revision?: number; summary?: CloudSummary } | null = null
  let draftEmail = '', draftPassword = '', draftCode = '', focusBefore: HTMLElement | null = null
  let codeUntil = 0
  const button = (action: string, label: string, disabled = false) => `<button type="button" data-cloud="${action}" ${disabled || busy ? 'disabled' : ''}>${label}</button>`
  const summary = (s: CloudSummary | undefined) => s ? `<strong>${h(s.name)} · Lv.${s.level}</strong><p>累计通关 ${s.progress} 小关 · 存档 v${s.version}</p><p>${h(new Date(s.savedAt).toLocaleString('zh-CN'))}</p>` : '<p>暂无存档</p>'
  function local() { const raw = hooks.localSave(); return raw ? { data: raw, ...validateSave(raw) } : null }
  async function api(path: string, method = 'GET', data?: unknown) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25_000)
    try {
      const response = await fetch(`${API}/api/${path}`, { method, signal: controller.signal,
        headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: data === undefined ? undefined : JSON.stringify(data), credentials: 'omit',
      })
      const result = await response.json()
      if (!response.ok) {
        if (response.status === 401 && token) { token = null; metadata = null; loaded = false; pending = null }
        throw Object.assign(new Error(result.message || '请求失败'), { status: response.status })
      }
      return result
    } catch (error) {
      if (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError')) throw new Error('无法连接云服务或请求超时。本地进度不受影响；上传结果可通过刷新云档确认。')
      throw error
    } finally { clearTimeout(timer) }
  }
  function capture() {
    draftEmail = dialog.querySelector<HTMLInputElement>('[name="email"]')?.value ?? draftEmail
    draftPassword = dialog.querySelector<HTMLInputElement>('[name="password"]')?.value ?? draftPassword
    draftCode = dialog.querySelector<HTMLInputElement>('[name="code"]')?.value ?? draftCode
  }
  function render() {
    let localSummary: CloudSummary | undefined
    try { localSummary = local()?.summary } catch { /* 损坏本地档不阻止登录下载 */ }
    dialog.innerHTML = `<header class="cloud-head"><div><h2>账号与云存档</h2><p>一个账号，一份云存档。上传下载由你决定。</p></div>${button('close', '关闭')}</header>
      ${message ? `<p class="cloud-message" role="status">${h(message)}</p>` : ''}
      ${token ? `<div class="cloud-user"><span>${h(email)}</span>${button('logout', '退出登录')}</div>
        <div class="cloud-saves"><section><h3>本地存档</h3>${summary(localSummary)}</section><section><h3>云端存档</h3>${loaded ? summary(metadata?.summary) : '<p>尚未获取</p>'}${metadata ? `<p>上传于 ${h(new Date(metadata.updatedAt).toLocaleString('zh-CN'))}</p>` : ''}</section></div>
        <div class="cloud-actions">${button('refresh', '刷新云存档')}${button('upload', '上传到云端', !loaded || !localSummary)}${button('download', '下载到本地', !loaded || !metadata)}</div>
        <p class="cloud-note">退出账号不会删除本地存档。下载成功后返回开始界面，不恢复正在进行的战斗。</p>` : `
        <nav class="cloud-tabs" aria-label="账号操作">${button('mode-login', '登录')}${button('mode-register', '注册')}${button('mode-reset', '找回密码')}</nav>
        <form data-cloud-form>
          <label>邮箱<input name="email" type="email" autocomplete="username" maxlength="254" required value="${h(draftEmail)}" ${busy ? 'disabled' : ''}></label>
          <label>${mode === 'reset' ? '新密码' : '密码'}<input name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" minlength="10" maxlength="128" required ${busy ? 'disabled' : ''}></label>
          <small>密码长度 10～128 个字符。</small>
          ${mode !== 'login' ? `<label>邮箱验证码<div class="cloud-code"><input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required value="${h(draftCode)}" ${busy ? 'disabled' : ''}>${button('send-code', Date.now() < codeUntil ? '稍后重发' : '发送验证码', Date.now() < codeUntil)}</div></label>` : ''}
          <button type="submit" ${busy ? 'disabled' : ''}>${busy ? '处理中…' : mode === 'login' ? '登录账号' : mode === 'register' ? '验证并注册' : '重置密码'}</button>
        </form><p class="cloud-note">登录仅在本次页面会话有效，关闭或刷新后需要重新登录。</p>`}
      ${hooks.hasBackup() ? `<div class="cloud-backup">${button('restore', '恢复下载前的本地进度')}</div>` : ''}
      ${pending ? `<section class="cloud-confirm" aria-label="确认覆盖"><h3>${pending.kind === 'upload' ? '用本地进度覆盖云端？' : pending.kind === 'download' ? '用云端进度覆盖本地？' : '恢复下载前的本地进度？'}</h3>${pending.summary ? summary(pending.summary) : ''}<p>${pending.kind === 'upload' ? '将替换账号唯一的云存档。' : '当前战斗将结束。替换前会保留一份本机恢复备份。'}</p>${button('confirm', '确认覆盖')}${button('cancel', '取消')}</section>` : ''}`
    const password = dialog.querySelector<HTMLInputElement>('[name="password"]')
    if (password) password.value = draftPassword
  }
  async function run(job: () => Promise<void>) {
    if (busy) return
    capture(); busy = true; message = ''; render()
    try { await job() } catch (error) {
      message = error instanceof Error ? error.message : '操作失败'
      if ((error as { status?: number }).status === 409) {
        pending = null; loaded = false
        try { metadata = (await api('save/meta')).save; loaded = true } catch { /* 保留明确冲突提示 */ }
      }
    } finally { busy = false; render() }
  }
  async function refresh() { await hooks.refreshLocal?.(); metadata = (await api('save/meta')).save; loaded = true }
  dialog.addEventListener('submit', event => {
    event.preventDefault()
    void run(async () => {
      const result = await api(`auth/${mode}`, 'POST', { email: draftEmail, password: draftPassword, code: draftCode })
      draftPassword = ''; draftCode = ''
      if (mode === 'login') { token = result.token; email = result.email; await refresh(); message = '登录成功，本地存档保持不变' }
      else { mode = 'login'; message = result.message }
    })
  })
  dialog.addEventListener('click', event => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-cloud]')?.dataset.cloud
    if (!action || busy) return
    capture()
    if (action === 'close') { close(); return }
    if (action.startsWith('mode-')) { mode = action.slice(5) as typeof mode; message = ''; draftCode = ''; pending = null; render(); return }
    if (action === 'cancel') { pending = null; render(); return }
    void run(async () => {
      if (action === 'send-code') {
        await api('auth/code', 'POST', { email: draftEmail, purpose: mode })
        codeUntil = Date.now() + 60_000
        setTimeout(() => { if (dialog.open && !busy) { capture(); render() } }, 60_100)
        message = '如邮箱符合条件，验证码已发送，10 分钟内有效。请检查收件箱或垃圾邮件。'
      } else if (action === 'refresh') { await refresh(); pending = null; message = '云存档信息已刷新' }
      else if (action === 'logout') { await api('auth/logout', 'POST', {}); token = null; metadata = null; loaded = false; pending = null; message = '已退出，本地存档保留' }
      else if (action === 'upload') {
        await hooks.refreshLocal?.()
        const snapshot = local(); if (!snapshot) throw new Error('没有可以上传的本地存档')
        pending = { kind: 'upload', data: JSON.parse(snapshot.json), revision: metadata?.revision ?? 0, summary: snapshot.summary }
        if (!metadata) { metadata = (await api('save', 'PUT', { data: pending.data, revision: 0 })).save; pending = null; message = '上传成功' }
      } else if (action === 'download') {
        await hooks.refreshLocal?.()
        const save = await api('save')
        const validated = validateSave(save.data)
        metadata = { revision: save.revision, updatedAt: save.updatedAt, summary: save.summary }
        pending = { kind: 'download', data: JSON.parse(validated.json), revision: save.revision, summary: validated.summary }
      } else if (action === 'restore') pending = { kind: 'restore' }
      else if (action === 'confirm' && pending) {
        if (pending.kind === 'upload') { metadata = (await api('save', 'PUT', { data: pending.data, revision: pending.revision })).save; message = '上传成功' }
        else if (pending.kind === 'download') {
          const latest = (await api('save/meta')).save
          if (latest?.revision !== pending.revision) { pending = null; metadata = latest; throw new Error('云档已更新，请重新下载并确认') }
          await hooks.install(validateSave(pending.data).json); message = hooks.returnToGame ? '云存档已下载并写回原游戏窗口，关闭此窗口后继续游戏' : '云存档已下载到本地，关闭此窗口后点继续游戏'
        } else { await hooks.restore(); message = '已恢复本地进度，关闭此窗口后点继续游戏' }
        pending = null
      }
    })
  })
  function close() { if (busy) return; dialog.close(); draftPassword = ''; draftCode = ''; pending = null; focusBefore?.focus(); hooks.returnToGame?.() }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  return { open: () => { focusBefore = document.activeElement as HTMLElement; pending = null; render(); dialog.showModal(); if (token) void run(refresh) } }
}
