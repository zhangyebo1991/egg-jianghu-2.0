import { escapeHtml } from './html'
import { VOUCHER_BATCH_MS, VOUCHER_DAILY_LIMIT, VOUCHER_DAILY_MS, type IdleVouchers } from '../domain/idle-vouchers'

export type TabId = 'idle' | 'heroes' | 'formation' | 'inventory' | 'shop' | 'progression' | 'settings'
// 秘境与神界暂未接入真实挑战流程，入口和动作同时关闭。
export const isTabAvailable = (tab: TabId): boolean => tab !== 'progression'
export type JianghuSection = 'stages' | 'factions' | 'towns' | 'city'
export const isJianghuSectionAvailable = (section: JianghuSection): boolean =>
  section === 'stages' || section === 'factions' || section === 'city'

export interface ShellViewModel {
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

const tabs: Array<{ id: TabId; label: string; mark: string }> = [
  { id: 'idle', label: '江湖', mark: '邑' },
  { id: 'heroes', label: '侠客', mark: '侠' },
  { id: 'formation', label: '阵容', mark: '阵' },
  { id: 'inventory', label: '背包', mark: '匣' },
  { id: 'shop', label: '商城', mark: '商' },
  { id: 'settings', label: '设置', mark: '设' },
]

const jianghuSections: ReadonlyArray<{ id: JianghuSection; label: string; mark: string }> = [
  { id: 'stages', label: '关卡', mark: '关' },
  { id: 'factions', label: '势力', mark: '势' },
  { id: 'city', label: '城市', mark: '城' },
]

export const renderShell = (view: ShellViewModel): string => {
  const worldContext = view.worldContext
  const jianghuChrome = view.jianghuChrome === true
  return `
    <div class="app-shell${jianghuChrome ? ' jianghu-shell' : ''}" data-active-tab="${view.activeTab}">
      <aside class="game-sidebar">
        <div class="brand-block">
          <span class="brand-seal" aria-hidden="true">蛋</span>
          <span><strong>蛋蛋江湖 2.0</strong><small>十万里一剑 · 不负侠者行</small></span>
        </div>
        ${renderVoucherWallet(view)}
        <nav class="game-nav" aria-label="游戏区域">
          ${tabs.map((tab) => `
            <button type="button" class="nav-item${view.activeTab === tab.id ? ' active' : ''}"
              data-tab="${tab.id}" data-testid="tab-${tab.id}"
              aria-current="${view.activeTab === tab.id ? 'page' : 'false'}">
              <span class="nav-mark" aria-hidden="true">${tab.mark}</span><strong>${tab.label}</strong>
            </button>`).join('')}
        </nav>
        ${worldContext ? `
          <nav class="world-subnav" aria-label="${escapeHtml(worldContext.worldName)}">
            <button type="button" class="world-back" data-action="return-worlds">世界总览</button>
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
        <div class="sidebar-danger-zone">
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
            : '<button type="button" class="sidebar-danger-link" data-action="request-reset-save">删档重开</button>'}
        </div>
        <div class="sidebar-landscape" aria-hidden="true"></div>
        <span class="sidebar-motto" aria-hidden="true">朝悟道 · 暮练剑</span>
      </aside>
      <main class="game-main" data-page="${view.activeTab}">${view.content}</main>
      ${view.premiumPanel ?? ''}
      ${view.hasCombatReturn
        ? '<button type="button" class="idle-combat-return" data-action="resume-combat" data-testid="idle-combat-return">返回进行中战斗</button>'
        : ''}
    </div>`
}
