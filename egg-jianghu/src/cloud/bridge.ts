import { createCloudAccount, type Hooks } from './account'

const SECURE_ORIGIN = 'https://223.6.255.187'
const LEGACY_ORIGIN = 'http://223.6.255.187:5174'
// 旧 HTTP 站点的账号密码只在 HTTPS 窗口输入；桥接只传存档，不传登录凭据。
export function createCloudAccess(hooks: Hooks) {
  const nonce = new URLSearchParams(location.search).get('cloud-bridge')
  if (location.origin === SECURE_ORIGIN && window.opener && nonce) {
    let snapshot: unknown | null = null, backup = false
    let controller: ReturnType<typeof createCloudAccount> | null = null
    let resolveTransfer: (() => void) | null = null, rejectTransfer: ((reason: Error) => void) | null = null
    const opener = window.opener as Window
    const transfer = (action: 'install' | 'restore' | 'snapshot', json?: string): Promise<void> => new Promise((resolve, reject) => {
      const timer = setTimeout(() => { resolveTransfer = null; rejectTransfer = null; reject(new Error('原游戏窗口未响应，请回原窗口确认本地存档')) }, 10_000)
      resolveTransfer = () => { clearTimeout(timer); resolve() }
      rejectTransfer = error => { clearTimeout(timer); reject(error) }
      opener.postMessage({ type: 'egg-cloud-transfer', nonce, action, json }, LEGACY_ORIGIN)
    })
    window.addEventListener('message', event => {
      if (event.origin !== LEGACY_ORIGIN || event.source !== opener || event.data?.nonce !== nonce) return
      if (event.data.type === 'egg-cloud-initial' && !controller) {
        snapshot = event.data.snapshot; backup = event.data.backup
        controller = createCloudAccount({ localSave: () => snapshot, hasBackup: () => backup,
          install: json => transfer('install', json), restore: () => transfer('restore'),
          refreshLocal: () => transfer('snapshot'), returnToGame: () => { opener.focus(); window.close() } })
        controller.open()
      } else if (event.data.type === 'egg-cloud-result' && resolveTransfer) {
        if (event.data.error) rejectTransfer?.(new Error(event.data.error))
        else { snapshot = event.data.snapshot; backup = event.data.backup; resolveTransfer() }
        resolveTransfer = null; rejectTransfer = null
      }
    })
    opener.postMessage({ type: 'egg-cloud-ready', nonce }, LEGACY_ORIGIN)
    return { open: () => controller?.open() }
  }
  if (location.origin === LEGACY_ORIGIN) {
    let popup: Window | null = null, challenge = '', snapshot: unknown | null = null
    const safeLocal = () => { try { return hooks.localSave() } catch { return null } }
    window.addEventListener('message', async event => {
      if (event.origin !== SECURE_ORIGIN || event.source !== popup || event.data?.nonce !== challenge) return
      if (event.data.type === 'egg-cloud-ready') popup?.postMessage({ type: 'egg-cloud-initial', nonce: challenge, snapshot, backup: hooks.hasBackup() }, SECURE_ORIGIN)
      if (event.data.type === 'egg-cloud-transfer') {
        try {
          if (event.data.action === 'install' && typeof event.data.json === 'string') await hooks.install(event.data.json)
          else if (event.data.action === 'restore') await hooks.restore()
          else if (event.data.action !== 'snapshot') throw new Error('无效的存档操作')
          popup?.postMessage({ type: 'egg-cloud-result', nonce: challenge, snapshot: safeLocal(), backup: hooks.hasBackup() }, SECURE_ORIGIN)
        } catch (error) { popup?.postMessage({ type: 'egg-cloud-result', nonce: challenge, error: error instanceof Error ? error.message : '替换本地存档失败' }, SECURE_ORIGIN) }
      }
    })
    return { open: () => {
      if (popup && !popup.closed) { popup.focus(); return }
      try { snapshot = hooks.localSave() } catch { snapshot = null }
      challenge = Array.from(crypto.getRandomValues(new Uint8Array(24)), n => n.toString(16).padStart(2,'0')).join('')
      popup = window.open(`${SECURE_ORIGIN}/?cloud-bridge=${challenge}`, 'egg-cloud-secure', 'width=820,height=850')
      if (!popup) window.alert('请允许弹出安全账号窗口，再点击账号与云存档。')
    } }
  }
  return createCloudAccount(hooks)
}
