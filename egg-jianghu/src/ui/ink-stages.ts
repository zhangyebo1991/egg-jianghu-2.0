import type { PlaneSelectViewModel, StageListViewModel } from './jianghu-page'
import { escapeHtml } from './html'

/** 册页只负责选关；驻守、闯荡均交给现有战斗入口校验并启动。 */
export const renderInkStages = (planes: PlaneSelectViewModel, stages: StageListViewModel, selectedStage: number, overview: boolean): string => {
  const world = planes.selected
  const selected = stages.stages.find(stage => stage.stage === selectedStage)
  const canStart = world.canTravel && selected?.unlocked
  return `<section class="ink-stages" data-testid="jianghu-page" data-view="${overview ? 'worlds' : 'world'}">
    <section data-testid="world-overview" aria-label="位面选择">
      <header class="ink-section-title"><h2>位面</h2><span>已开 ${planes.planes.filter(plane => plane.unlocked).length} / ${planes.planes.length}</span></header>
      <nav class="ink-worlds" aria-label="位面列表">${planes.planes.map(plane => `<button type="button" class="ink-world${plane.selected ? ' active' : ''}${plane.unlocked ? '' : ' locked'}" data-action="select-plane" data-world-id="${plane.id}" data-testid="world-${plane.id}" aria-pressed="${plane.selected}"><small>No.${String(plane.index).padStart(3, '0')}</small><strong>${escapeHtml(plane.name)}</strong><span>${plane.unlocked ? '已开启' : '未解锁'}</span></button>`).join('')}</nav>
      <p class="ink-world-note">${escapeHtml(world.latinName)} · ${escapeHtml(stages.currencyName ?? '本卷通宝')}<br>${escapeHtml(world.flavor)}</p>
      <header class="ink-section-title"><h2>难度</h2><span>${escapeHtml(world.name)}</span></header>
      <div class="ink-difficulties" role="group" aria-label="难度">${world.difficulties.map(difficulty => `<button type="button" class="${difficulty.selected ? 'active' : ''}" data-action="select-difficulty" data-difficulty="${difficulty.difficulty}" data-testid="difficulty-${difficulty.difficulty}" aria-pressed="${difficulty.selected}" ${difficulty.unlocked ? '' : 'disabled'} title="${escapeHtml(difficulty.label)}">${difficulty.difficulty}</button>`).join('')}</div>
    </section>
    <section data-testid="stage-overview" data-world-id="${world.id}">
      <header class="ink-section-title"><h2>闯关路径</h2><span>已历 ${stages.clearedStages ?? 0} / 10</span></header>
      <div class="ink-stagepath">${stages.stages.map(stage => `<button type="button" class="ink-stage${stage.stage === selectedStage ? ' active' : ''}${stage.cleared ? ' done' : ''}" data-action="select-ink-stage" data-stage="${stage.stage}" data-testid="stage-${stage.stage}" aria-pressed="${stage.stage === selectedStage}" ${world.canTravel && stage.unlocked ? '' : 'disabled'}><b>${['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'][stage.stage - 1]}</b><span>${escapeHtml(stage.name ?? stage.stage.toString())}</span><small>${!world.canTravel ? '未解锁' : stage.cleared ? '已通关' : stage.unlocked ? '可挑战' : '未解锁'}</small></button>`).join('')}</div>
      <div class="ink-stage-actions"><button type="button" class="ink-solid" data-action="begin-ink-stage" data-mode="guard" data-testid="start-guard" ${canStart ? '' : 'disabled'}>驻守此关 · 原地挂机</button><button type="button" class="ink-crimson" data-action="begin-ink-stage" data-mode="roam" data-testid="start-roam" ${canStart ? '' : 'disabled'}>闯荡此关 · 破阵深入</button></div>
      ${!world.unlocked ? `<p class="ink-world-note" role="status">${escapeHtml(world.lockText)}</p>` : ''}
    </section>
  </section>`
}
