import { escapeHtml } from './html'

export type TabId = 'idle' | 'heroes' | 'formation' | 'inventory'
export type JianghuSection = 'stages' | 'factions' | 'city'

export interface ShellViewModel {
  activeTab: TabId
  worldContext: { worldName: string; activeSection: JianghuSection } | null
  hasCombatReturn: boolean
  showResetConfirmation: boolean
  content: string
}

const tabs: Array<{ id: TabId; label: string; mark: string }> = [
  { id: 'idle', label: '江湖', mark: '卷' },
  { id: 'heroes', label: '侠客', mark: '侠' },
  { id: 'formation', label: '阵容', mark: '阵' },
  { id: 'inventory', label: '背包', mark: '匣' },
]

const worldSections: Array<{ id: JianghuSection; label: string }> = [
  { id: 'stages', label: '关卡' },
  { id: 'factions', label: '势力' },
  { id: 'city', label: '城市' },
]

export const renderShell = (view: ShellViewModel): string => {
  const worldContext = view.activeTab === 'idle' ? view.worldContext : null
  return `
    <div class="app-shell">
      <aside class="game-sidebar">
        <div class="brand-block">
          <span class="brand-seal" aria-hidden="true">蛋</span>
          <span><strong>蛋蛋江湖 2.0</strong><small>十卷风云 · 六侠同行</small></span>
        </div>
        <nav class="game-nav" aria-label="游戏区域">
          ${tabs.map((tab) => `
            <button type="button" class="nav-item${view.activeTab === tab.id ? ' active' : ''}"
              data-tab="${tab.id}" data-testid="tab-${tab.id}"
              aria-current="${view.activeTab === tab.id ? 'page' : 'false'}">
              <span aria-hidden="true">${tab.mark}</span><strong>${tab.label}</strong>
            </button>`).join('')}
        </nav>
        ${worldContext ? `
          <nav class="world-subnav" aria-label="${escapeHtml(worldContext.worldName)}">
            <button type="button" class="world-back" data-action="return-worlds">返回江湖</button>
            ${worldSections.map((section) => `
              <button type="button" class="${worldContext.activeSection === section.id ? 'active' : ''}"
                data-jianghu-section="${section.id}" data-testid="world-section-${section.id}"
                aria-current="${worldContext.activeSection === section.id ? 'page' : 'false'}">${section.label}</button>`).join('')}
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
      </aside>
      <main class="game-main" data-page="${view.activeTab}">${view.content}</main>
      ${view.hasCombatReturn
        ? '<button type="button" class="idle-combat-return" data-action="resume-combat" data-testid="idle-combat-return">返回进行中战斗</button>'
        : ''}
    </div>`
}
