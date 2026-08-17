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
}

const taskNames = ['消灭', '筹措', '收集', '挑战', '寻宝'] as const

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
      <small>计略 Lv.${view.abilityLevel} · 贡献 +${view.contributionBonusPercent}% · 声望 +${view.reputationBonusPercent}%。只受原版能力 9，白板未接入时基础为 0，不使用等级或资质代替。</small>
    </div>
  </div>
  <div class="faction-agent-automation">
    <header><div><span>任务类型设置</span><strong>自动接受 / 完成</strong></div><small>${view.taskAutomationAvailable ? '已开放' : '条件矩阵尚未接入，保持关闭'}</small></header>
    <div>${taskNames.map((name) => `<span>${name}<i>未启用</i></span>`).join('')}</div>
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
