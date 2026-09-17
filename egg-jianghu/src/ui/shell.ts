import { escapeHtml } from './html'
import { VOUCHER_BATCH_MS, VOUCHER_DAILY_LIMIT, VOUCHER_DAILY_MS, type IdleVouchers } from '../domain/idle-vouchers'

export type TabId = 'idle' | 'heroes' | 'formation' | 'inventory' | 'shop' | 'progression' | 'settings'
// 秘境与神界暂未接入真实挑战流程，入口和动作同时关闭。
export const isTabAvailable = (tab: TabId): boolean => tab !== 'progression'
export type JianghuSection = 'stages' | 'factions' | 'towns' | 'city'
export const isJianghuSectionAvailable = (section: JianghuSection): boolean =>
  section === 'stages' || section === 'factions' || section === 'city'

export interface ShellViewModel {
  panelOpen?: boolean
  panelDocked?: boolean
  panelTitle?: string
  factionPanel?: string
  battlefield?: string
  currencyName?: string
  currency?: number
  reputation?: { value: number; levelName: string }
  premiumPanel?: string
  idleVouchers?: IdleVouchers
  voucherDetailsOpen?: boolean
  offlineVoucherReward?: number
  activeTab: TabId
  worldContext: { worldName: string; activeSection: JianghuSection } | null
  hasCombatReturn: boolean
  showResetConfirmation: boolean
  jianghuChrome?: boolean
  content: string
}

const renderVoucherWallet = (view: ShellViewModel): string => {
  const ledger = view.idleVouchers
  if (!ledger) return ''
  const capped = ledger.creditedToday >= VOUCHER_DAILY_LIMIT
  const status = capped ? '今日已满' : ledger.activeMode ? '挂机积累中' : '未在挂机'
  const minutesLeft = Math.ceil((VOUCHER_DAILY_MS - ledger.elapsedMs) / 60_000)
  const nextSeconds = Math.ceil((VOUCHER_BATCH_MS - ledger.elapsedMs % VOUCHER_BATCH_MS) / 1000)
  return `<section class="voucher-wallet" data-testid="voucher-wallet">
    <div class="voucher-wallet-summary">
      <span class="voucher-wallet-label">蛋蛋<button type="button" class="voucher-help" data-action="toggle-voucher-details" aria-label="查看蛋蛋说明" aria-expanded="${view.voucherDetailsOpen === true}" aria-controls="voucher-details">?</button></span><strong data-testid="voucher-balance">${ledger.balance.toLocaleString('zh-CN')}</strong>
      <small>今日 ${ledger.creditedToday} / ${VOUCHER_DAILY_LIMIT}</small>
    </div>
    ${view.voucherDetailsOpen ? `<div class="voucher-details" id="voucher-details" role="region" aria-label="蛋蛋说明">
      <strong>${status}</strong>
      <p>今日挂机：${ledger.creditedToday} / ${VOUCHER_DAILY_LIMIT} 蛋蛋</p>
      <progress value="${ledger.elapsedMs}" max="${VOUCHER_DAILY_MS}" aria-label="今日挂机进度"></progress>
      ${capped ? '<p>蛋蛋已满，其他战斗收益继续。</p>' : `<p>下次 +10：还需 ${Math.floor(nextSeconds / 60)} 分 ${nextSeconds % 60} 秒有效挂机</p><p>今日领满还需 ${Math.floor(minutesLeft / 60)} 小时 ${minutesLeft % 60} 分钟</p>`}
      <p>驻守或闯荡每 6 分钟获得 10 蛋蛋，每日最多 700，北京时间 00:00 刷新。</p>
      <p>挂机中退出，下次继续游戏补结算蛋蛋；主动停止后不再积累。</p>
      ${view.offlineVoucherReward ? `<p data-testid="offline-voucher-reward">本次离线结算：+${view.offlineVoucherReward.toLocaleString('zh-CN')} 蛋蛋</p>` : ''}
    </div>` : ''}
  </section>`
}

const icons: Record<string, string> = {
  idle: '<path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2zm0 0v14m6-12v14"/>',
  inventory: '<path d="M5 8h14l-1.5 12h-11L5 8zm4 0a3 3 0 0 1 6 0"/>',
  heroes: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
  formation: '<path d="M5 5h2m4 0h2m4 0h2M5 12h2m4 0h2m4 0h2M4 20h16"/>',
  quests: '<path d="M7 3h10v18l-5-3-5 3V3zM9.5 8h5M9.5 12h5"/>',
  exchange: '<path d="M7 8h11m0 0-3-3m3 3-3 3M17 16H6m0 0 3-3m-3 3 3 3"/>',
  recruit: '<circle cx="10" cy="8" r="3.5"/><path d="M4 20c0-3.5 2.7-6 6-6s6 2.5 6 6M18 8v6M15 11h6"/>',
  shop: '<path d="M4 9 6 4h12l2 5M4 9h16M4 9v11h16V9m-10 0v11m4-11v11"/>',
  city: '<path d="M3 21h18M5 21V9h6v12M14 21V5h5v16M8 12h.01M8 16h.01M16.5 9h.01M16.5 13h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'idle', label: '关卡' }, { id: 'inventory', label: '行囊' },
  { id: 'heroes', label: '侠客' }, { id: 'formation', label: '阵容' },
  { id: 'shop', label: '商城' }, { id: 'settings', label: '设置' },
]

const jianghuSections: ReadonlyArray<{ id: JianghuSection; label: string; mark: string }> = [
  { id: 'stages', label: '关卡', mark: '关' },
  { id: 'factions', label: '势力', mark: '势' },
  { id: 'city', label: '城市', mark: '城' },
]

export const renderShell = (view: ShellViewModel): string => {
  const worldContext = view.worldContext
  const open = view.panelOpen !== false
  const title = view.panelTitle ?? tabs.find(tab => tab.id === view.activeTab)?.label ?? '江湖'
  const iconButton = (id: string, label: string, attrs: string, active = false): string =>
    `<button type="button" class="ink-icon${open && active ? ' active' : ''}" ${attrs} aria-label="${label}" aria-pressed="${open && active}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]}</svg><span>${label}</span></button>`
  const tabButton = (tab: typeof tabs[number]): string => iconButton(tab.id, tab.label,
    `data-tab="${tab.id}" data-testid="tab-${tab.id}"`, view.activeTab === tab.id && (tab.id !== 'idle' || !worldContext || worldContext.activeSection === 'stages'))
  return `
    <div class="app-shell ink-shell" data-active-tab="${view.activeTab}" data-panel-open="${open}">
      <div class="ink-scene" aria-hidden="true"><div class="ink-mist"></div></div>
      <div class="ink-battle-layer" ${open ? 'inert' : ''}>${view.battlefield ?? `<section class="ink-camp"><span>江湖未远</span><p>择一处山水，启一段旅程</p><button type="button" data-tab="idle">选择关卡</button></section>`}</div>
      <header class="ink-hud" aria-label="江湖资源">
        ${renderVoucherWallet(view)}
        <div class="ink-purse"><span class="ink-glyph">${escapeHtml((view.currencyName ?? '通宝').slice(0, 1))}</span><div><b data-testid="hud-currency">${(view.currency ?? 0).toLocaleString('zh-CN')}</b><small>${escapeHtml(view.currencyName ?? '通宝')} · 本卷</small></div></div>
        <div class="ink-purse ink-reputation" data-testid="hud-reputation"><span class="ink-glyph">声</span><div><b>${(view.reputation?.value ?? 0).toLocaleString('zh-CN')}</b><small>${escapeHtml(view.reputation?.levelName ?? '冷淡')} · 位面声望</small></div></div>
      </header>
      <nav class="ink-iconbar" aria-label="游戏区域">
        ${tabs.slice(0, 4).map(tabButton).join('')}
        ${(['quests', 'exchange', 'recruit'] as const).map((id, i) => iconButton(id, ['悬榜', '兑换', '招募'][i], `data-action="open-faction-panel" data-faction-panel="${id}"`, worldContext?.activeSection === 'factions' && view.factionPanel === id)).join('')}
        ${tabButton(tabs[4])}
        ${iconButton('city', '城市', 'data-jianghu-section="city" data-testid="tab-city"', worldContext?.activeSection === 'city')}
        ${tabButton(tabs[5])}
      </nav>
      ${open ? `<button type="button" class="ink-scrim" data-action="close-ink-panel" aria-label="收起册页"></button>
      <section class="ink-leaf${view.panelDocked ? ' docked' : ''}" role="dialog" aria-modal="true" aria-labelledby="ink-leaf-title" data-testid="ink-panel" data-key="ink-panel">
        <header class="ink-leaf-head"><h1 id="ink-leaf-title">${escapeHtml(title)}</h1><button type="button" class="ink-dock" data-action="dock-ink-panel" aria-label="切换面板位置" title="居中册页 / 右侧停靠" aria-pressed="${view.panelDocked === true}">⇄</button>${view.hasCombatReturn ? '<button type="button" class="idle-combat-return" data-action="resume-combat" data-testid="idle-combat-return">返回战场</button>' : ''}<button type="button" class="ink-close" data-action="close-ink-panel" aria-label="关闭册页">×</button></header>
        ${worldContext ? `
          <nav class="world-subnav" aria-label="${escapeHtml(worldContext.worldName)}">
            <button type="button" class="world-back" data-action="return-worlds">切换位面</button>
            <span class="world-subnav-title">${escapeHtml(worldContext.worldName)}</span>
            <div class="world-subnav-sections">
              ${jianghuSections.map((section) => `
                <button type="button" class="world-section${worldContext.activeSection === section.id ? ' active' : ''}"
                  data-jianghu-section="${section.id}" data-testid="world-section-${section.id}"
                  aria-current="${worldContext.activeSection === section.id ? 'page' : 'false'}">
                  <span aria-hidden="true">${section.mark}</span><strong>${section.label}</strong>
                </button>`).join('')}
            </div>
          </nav>` : ''}
        <main class="game-main" data-page="${view.activeTab}" tabindex="-1">${view.content}
        ${view.activeTab === 'settings' ? `<section class="ink-danger-zone"><h2>危险区</h2>
          ${view.showResetConfirmation
            ? `<section class="danger-confirm compact sidebar-danger-confirm" data-testid="reset-save-confirmation"
                role="dialog" aria-modal="true" aria-labelledby="reset-save-title">
                <strong id="reset-save-title">确认删档？</strong>
                <p>当前进度将被永久删除，且无法恢复。</p>
                <div>
                  <button type="button" data-action="cancel-reset-save" autofocus>取消</button>
                  <button type="button" class="danger" data-action="confirm-reset-save">确认删档</button>
                </div>
              </section>`
            : '<p>删除本机存档并重新开始，此操作无法恢复。</p><button type="button" class="danger" data-action="request-reset-save">删档重开</button>'}
        </section>` : ''}</main>
      </section>` : ''}
      ${view.premiumPanel ?? ''}
    </div>`
}
