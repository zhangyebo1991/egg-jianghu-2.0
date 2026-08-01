import { escapeHtml, formatNumber } from './html'

export type TabId = 'idle' | 'heroes' | 'factions' | 'city' | 'inventory'

export interface ShellViewModel {
  activeTab: TabId
  worldName: string
  worldCurrency: number
  contribution: number
  inventoryCount: number
  inventoryCapacity: number
  content: string
}

const tabs: Array<{ id: TabId; label: string; mark: string }> = [
  { id: 'idle', label: '江湖', mark: '卷' },
  { id: 'heroes', label: '侠客', mark: '侠' },
  { id: 'factions', label: '势力', mark: '令' },
  { id: 'city', label: '城市', mark: '城' },
  { id: 'inventory', label: '背包', mark: '匣' },
]

export const renderShell = (view: ShellViewModel): string => `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand-block">
        <span class="brand-seal" aria-hidden="true">蛋</span>
        <span><strong>蛋蛋江湖 2.0</strong><small>十卷风云 · 六侠同行</small></span>
      </div>
      <div class="resource-strip" aria-label="长期资源">
        <span><small>${escapeHtml(view.worldName)}货币</small><strong>${formatNumber(view.worldCurrency)}</strong></span>
        <span><small>势力贡献</small><strong>${formatNumber(view.contribution)}</strong></span>
        <span><small>装备背包</small><strong>${view.inventoryCount} / ${view.inventoryCapacity}</strong></span>
      </div>
      <span class="save-state"><i></i> 自动存档</span>
    </header>
    <nav class="game-nav" aria-label="游戏区域">
      ${tabs.map((tab) => `
        <button type="button" class="nav-item${view.activeTab === tab.id ? ' active' : ''}" data-tab="${tab.id}" data-testid="tab-${tab.id}" aria-current="${view.activeTab === tab.id ? 'page' : 'false'}">
          <span aria-hidden="true">${tab.mark}</span><strong>${tab.label}</strong>
        </button>`).join('')}
    </nav>
    <main class="game-main" data-page="${view.activeTab}">${view.content}</main>
  </div>`
