import { escapeHtml, formatNumber } from './html'

export interface JianghuWorldCardView {
  id: string
  name: string
  index: number
  unlocked: boolean
  difficulty: number
  recommendedPower: number
  clearedStages: number
  factionNames: string[]
}

export interface WorldOverviewViewModel {
  worlds: JianghuWorldCardView[]
}

export interface StageListViewModel {
  worldId: string
  worldName: string
  worldCurrency: number
  stages: Array<{ stage: number; unlocked: boolean; cleared: boolean }>
}

const stars = (difficulty: number): string => '★'.repeat(Math.max(1, Math.min(5, difficulty)))

export const renderWorldOverview = (view: WorldOverviewViewModel): string => `
  <section class="world-overview" data-testid="world-overview">
    <header class="page-heading">
      <small>十卷风云</small>
      <h1>江湖</h1>
      <p>择一方江湖，访城问派，逐关而行。</p>
    </header>
    <div class="world-card-grid">
      ${view.worlds.map((world) => `
        <button type="button" class="world-card${world.unlocked ? '' : ' locked'}"
          data-action="enter-world" data-world-id="${escapeHtml(world.id)}"
          data-testid="world-${escapeHtml(world.id)}" ${world.unlocked ? '' : 'disabled'}>
          <span class="world-index">${String(world.index).padStart(2, '0')}</span>
          <strong>${escapeHtml(world.name)}</strong>
          <small>难度 ${stars(world.difficulty)} · 推荐战力 ${formatNumber(world.recommendedPower)}</small>
          <i class="world-progress" aria-label="已通过 ${world.clearedStages} / 10 关"><b style="width:${world.clearedStages * 10}%"></b></i>
          <em>本地势力：${world.factionNames.map((name) => escapeHtml(name)).join(' · ')}</em>
        </button>`).join('')}
    </div>
  </section>`

export const renderStageList = (view: StageListViewModel): string => `
  <section class="stage-overview" data-testid="stage-overview" data-world-id="${escapeHtml(view.worldId)}">
    <header class="page-heading world-heading">
      <div><small>江湖卷</small><h1>${escapeHtml(view.worldName)}</h1></div>
      <span>本卷货币 <strong>${formatNumber(view.worldCurrency)}</strong></span>
    </header>
    <div class="stage-card-grid">
      ${view.stages.map((stage) => `
        <button type="button" class="stage-card${stage.cleared ? ' cleared' : ''}"
          data-action="start-stage" data-stage="${stage.stage}"
          data-testid="stage-${stage.stage}" ${stage.unlocked ? '' : 'disabled'}>
          <span>${String(stage.stage).padStart(2, '0')}</span>
          <strong>第 ${stage.stage} 关</strong>
          <small>${stage.cleared ? '已通关 · 点击驻守' : stage.unlocked ? '点击进入驻守' : '尚未解锁'}</small>
        </button>`).join('')}
    </div>
  </section>`
