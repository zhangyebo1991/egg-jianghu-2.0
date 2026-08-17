import { escapeHtml } from './html'

export interface FactionAgentHeroView {
  id: string
  name: string
  grade: string
  category: string
  level: number
  fighting: boolean
  selected: boolean
}

export interface FactionAgentQualityFilterView {
  quality: number
  column: number
  allowed: boolean
}

export interface FactionAgentTaskFilterView {
  taskId: number
  name: string
  column: number
  /** 该任务类型是否参与自动接受（未被矩阵排除）。 */
  allowed: boolean
  qualities: readonly FactionAgentQualityFilterView[]
}

export interface FactionAgentViewModel {
  worldId: string
  worldName: string
  enabled: boolean
  currentAgent: FactionAgentHeroView | null
  candidates: readonly FactionAgentHeroView[]
  abilityLevel: number
  contributionBonusPercent: number
  reputationBonusPercent: number
  taskAutomationAvailable: boolean
  taskFilters: readonly FactionAgentTaskFilterView[]
  acceptedTaskCount: number
  concurrentTaskLimit: number
}

const filterButton = (
  view: FactionAgentViewModel,
  taskId: number,
  column: number,
  label: string,
  allowed: boolean,
  extraClass: string,
): string => `<button type="button" class="${extraClass}${allowed ? '' : ' excluded'}"
  data-action="toggle-agent-task-filter"
  data-world-id="${escapeHtml(view.worldId)}"
  data-task-id="${taskId}"
  data-column="${column}"
  aria-pressed="${allowed}"
  ${view.taskAutomationAvailable ? '' : 'disabled'}>${escapeHtml(label)}</button>`

const renderTaskFilter = (view: FactionAgentViewModel, filter: FactionAgentTaskFilterView): string =>
  `<article class="faction-agent-task-filter${filter.allowed ? '' : ' excluded'}" data-testid="agent-task-filter-${filter.taskId}">
    ${filterButton(view, filter.taskId, filter.column, filter.name, filter.allowed, 'faction-agent-task-toggle')}
    <span>${filter.allowed ? '已启用' : '已排除'}</span>
    <div class="faction-agent-quality-filters">
      ${filter.qualities
        .map((quality) => filterButton(
          view,
          filter.taskId,
          quality.column,
          String(quality.quality),
          quality.allowed,
          'faction-agent-quality-toggle',
        ))
        .join('')}
    </div>
  </article>`

const renderCurrentAgent = (view: FactionAgentViewModel): string => view.currentAgent
  ? `<div class="faction-agent-current-card">
      <span class="faction-agent-seal" data-grade="${escapeHtml(view.currentAgent.grade)}">${escapeHtml(view.currentAgent.grade)}</span>
      <div><span>当前代理人</span><strong>${escapeHtml(view.currentAgent.name)}</strong><small>${escapeHtml(view.currentAgent.category)}脉 · Lv.${view.currentAgent.level}</small></div>
      <button type="button" data-action="dismiss-faction-agent" data-world-id="${escapeHtml(view.worldId)}">卸任</button>
    </div>`
  : `<div class="faction-agent-current-card empty">
      <span class="faction-agent-seal">空</span>
      <div><span>当前代理人</span><strong>无代理人</strong><small>从已招募侠客中任命，主角不进入候选</small></div>
    </div>`

const renderCandidate = (view: FactionAgentViewModel, hero: FactionAgentHeroView): string => {
  const disabled = hero.selected || hero.fighting
  const actionLabel = hero.selected ? '已任命' : hero.fighting ? '战斗中' : view.currentAgent ? '替换' : '任命'
  return `<article class="faction-agent-candidate${hero.selected ? ' selected' : ''}${hero.fighting ? ' fighting' : ''}" data-testid="faction-agent-candidate-${escapeHtml(hero.id)}">
    <span class="faction-agent-candidate-grade" data-grade="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span>
    <div><strong>${escapeHtml(hero.name)}</strong><span>${escapeHtml(hero.category)}脉 · Lv.${hero.level}</span></div>
    <button type="button" data-action="appoint-faction-agent" data-world-id="${escapeHtml(view.worldId)}" data-hero-id="${escapeHtml(hero.id)}" ${disabled ? 'disabled' : ''}>${actionLabel}</button>
  </article>`
}

export const renderFactionAgent = (view: FactionAgentViewModel): string => `<section class="faction-agent" data-testid="faction-agent" data-world-id="${escapeHtml(view.worldId)}">
  <header class="faction-agent-head">
    <div><span>PLANE AGENT</span><h2>位面代理人</h2><p>${escapeHtml(view.worldName)} · 官府委任</p></div>
    <button type="button" class="faction-agent-toggle${view.enabled ? ' active' : ''}" data-action="toggle-faction-agent" data-world-id="${escapeHtml(view.worldId)}" aria-pressed="${view.enabled}"><i></i><span>${view.enabled ? '开启中' : '关闭中'}</span></button>
  </header>
  <div class="faction-agent-overview">
    ${renderCurrentAgent(view)}
    <div class="faction-agent-bonus" data-testid="faction-agent-bonus">
      <span>奖励加成</span>
      <strong>${view.abilityLevel > 0 ? '已生效' : '计略 Lv.0'}</strong>
      <small>计略 Lv.${view.abilityLevel} · 贡献 +${view.contributionBonusPercent}% · 声望 +${view.reputationBonusPercent}%。等级 = 原版角色白板 + 培养 + 至宝加成，上限 5；本作自创侠客原版无对应角色，白板为 0。</small>
    </div>
  </div>
  <div class="faction-agent-automation">
    <header>
      <div><span>任务类型设置</span><strong>自动接受 / 完成</strong></div>
      <small>${view.taskAutomationAvailable
        ? `已开放 · 已接 ${view.acceptedTaskCount}/${view.concurrentTaskLimit} · 每秒结算一轮，先交付再接受`
        : '需先任命代理人'}</small>
    </header>
    <p class="faction-agent-automation-hint">点击类型或品质即可排除；缺省为全部放行。势力与子类筛选已按原版接入结算，暂未提供界面。</p>
    <div class="faction-agent-task-filters">
      ${view.taskFilters.map((filter) => renderTaskFilter(view, filter)).join('')}
    </div>
  </div>
  <div class="faction-agent-candidates">
    <header><h3>任命人选</h3><span>已招募 · 非主角 · 战斗中不可任命</span></header>
    <div class="faction-agent-candidate-grid">
      ${view.candidates.length > 0
        ? view.candidates.map((hero) => renderCandidate(view, hero)).join('')
        : '<p class="faction-agent-empty">除主角外暂无已招募侠客</p>'}
    </div>
  </div>
</section>`
