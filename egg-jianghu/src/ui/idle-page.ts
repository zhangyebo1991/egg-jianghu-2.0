import { heroByIdV10, heroMeridianCategory } from '../content/heroes'
import { escapeHtml, percent } from './html'
import { enemyPortraitAsset, heroPortraitAsset } from './portrait-assets'
import { worldSceneAsset } from './world-scene-assets'

export interface IdleCombatUnitView {
  id: string
  name: string
  rank: 'normal' | 'elite' | 'boss'
  careerId?: string
  /** 路：0 上、1 中、2 下 */
  row: 0 | 1 | 2
  /** 列：0 最前（贴中线），4 最后 */
  col: 0 | 1 | 2 | 3 | 4
  hp: number
  maxHp: number
  energy: number
  maxEnergy: number
  gauge: number
  cooldownMs: number
  alive: boolean
  skillName: string
}

export interface IdleCombatView {
  mode: 'guard' | 'roam'
  wave: number
  party: IdleCombatUnitView[]
  enemies: IdleCombatUnitView[]
}

export type IdleCombatLogKind = 'wave' | 'skill' | 'heal' | 'kill' | 'loot' | 'defeat' | 'system'

export interface IdleCombatLogView {
  id: number
  kind: IdleCombatLogKind
  mark: string
  text: string
}

export type IdleCombatEffectKind =
  | 'lunge-party'
  | 'lunge-enemy'
  | 'hit-shake'
  | 'skill-aura'
  | 'heal-aura'
  | 'damage'
  | 'critical'
  | 'healing'
  | 'skill-name'
  | 'slash'
  | 'wave-banner'

export interface IdleCombatEffectView {
  id: number
  kind: IdleCombatEffectKind
  unitId?: string
  text?: string
}

export interface IdleCombatStatsView {
  copper: number
  equipment: number
  kills: number
  elapsedMs: number
}

export interface IdlePageViewModel {
  worldId: string
  worldName: string
  selectedStage: number
  inventoryCount: number
  inventoryCapacity: number
  combatSpeed: 1 | 2 | 4
  combat: IdleCombatView
  stats: IdleCombatStatsView
  logs: IdleCombatLogView[]
  effects: IdleCombatEffectView[]
}

const rankLabel = { normal: '', elite: '精英', boss: 'BOSS' } as const
const laneNames = ['上路', '中路', '下路'] as const
const LANE_ROWS = [0, 1, 2] as const
const LANE_COLS = [0, 1, 2, 3, 4] as const
const motionKinds = new Set<IdleCombatEffectKind>(['lunge-party', 'lunge-enemy', 'hit-shake'])

const formatDuration = (elapsedMs: number): string => {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

const renderGauge = (
  label: string,
  value: number,
  maximum: number,
  className: string,
  stateClass = '',
): string => `
  <div class="meter ${className}${stateClass ? ` ${stateClass}` : ''}">
    <span class="meter-label">${label}</span>
    <span class="meter-track"><span class="meter-fill" style="width:${percent(value, maximum)}%"></span></span>
    <span class="meter-num">${Math.floor(value)} / ${Math.floor(maximum)}</span>
  </div>`

const renderUnitPortrait = (unit: IdleCombatUnitView, side: 'party' | 'enemy'): string => {
  const definition = heroByIdV10(unit.id)
  const category = definition ? heroMeridianCategory(definition) : '剑'
  const portrait = side === 'party'
    ? heroPortraitAsset(unit.id, category)
    : enemyPortraitAsset(unit.rank, unit.id)
  const fallback = side === 'party' ? category.slice(0, 1) : unit.name.slice(0, 1)
  return `<span class="unit-portrait">
    <span class="portrait-char" aria-hidden="true">${escapeHtml(fallback)}</span>
    <img src="${escapeHtml(portrait.url)}" data-portrait-source="${portrait.source}" alt="" aria-hidden="true" draggable="false">
    <span class="portrait-ring" aria-hidden="true"></span>
  </span>`
}

const renderEffect = (effect: IdleCombatEffectView): string => {
  const testId = `combat-effect-${effect.id}`
  if (effect.kind === 'slash') return `<span class="slash-arc" data-testid="${testId}" aria-hidden="true"></span>`
  if (effect.kind === 'skill-aura' || effect.kind === 'heal-aura') {
    return `<span class="unit-aura ${effect.kind}" data-testid="${testId}" aria-hidden="true"></span>`
  }
  const className = effect.kind === 'critical'
    ? 'dmg-float crit'
    : effect.kind === 'healing'
      ? 'dmg-float heal'
      : effect.kind === 'skill-name'
        ? 'dmg-float skill-name-float'
        : 'dmg-float'
  return `<span class="${className}" data-testid="${testId}" aria-hidden="true">${escapeHtml(effect.text ?? '')}</span>`
}

const renderUnit = (
  unit: IdleCombatUnitView,
  side: 'party' | 'enemy',
  effects: IdleCombatEffectView[],
): string => {
  const unitEffects = effects.filter((effect) => effect.unitId === unit.id)
  const motionClasses = unitEffects
    .filter((effect) => motionKinds.has(effect.kind))
    .map((effect) => effect.kind)
    .join(' ')
  const hpPercent = unit.maxHp > 0 ? unit.hp / unit.maxHp * 100 : 0
  const rank = rankLabel[unit.rank]
  return `<article class="combat-unit ${side}${unit.alive ? '' : ' fallen'}${motionClasses ? ` ${motionClasses}` : ''}"
      data-unit-id="${escapeHtml(unit.id)}" data-rank="${unit.rank}" data-testid="combat-unit-${escapeHtml(unit.id)}">
    ${renderUnitPortrait(unit, side)}
    <span class="unit-body">
      <span class="unit-head">
        <strong class="unit-name">${escapeHtml(unit.name)}</strong>
        ${rank ? `<span class="unit-tag rank-${unit.rank}">${rank}</span>` : ''}
        <span class="unit-tag row-tag">${laneNames[unit.row]}</span>
      </span>
      ${renderGauge('气血', unit.hp, unit.maxHp, 'hp-meter', unit.alive && hpPercent <= 30 ? 'low' : '')}
      ${renderGauge('气机', unit.gauge, 1000, 'gauge-meter', unit.gauge >= 1000 ? 'full' : '')}
      ${side === 'party' ? renderGauge('真气', unit.energy, unit.maxEnergy, 'energy-meter', unit.energy >= unit.maxEnergy ? 'full' : '') : ''}
      <span class="unit-foot"><span class="foot-label">回气</span><span class="cool-num">${(unit.cooldownMs / 1000).toFixed(1)}s</span><span class="skill-name">${escapeHtml(unit.skillName)}</span></span>
    </span>
    ${unitEffects.filter((effect) => !motionKinds.has(effect.kind)).map(renderEffect).join('')}
  </article>`
}

// 左右对峙：双方 col 0 都贴中线，我方格子自左向右为 col 4→0，敌方镜像
const renderLane = (
  units: IdleCombatUnitView[],
  side: 'party' | 'enemy',
  row: 0 | 1 | 2,
  effects: IdleCombatEffectView[],
): string => {
  const cols = side === 'party' ? [...LANE_COLS].reverse() : [...LANE_COLS]
  return `<div class="unit-lane ${side}" data-combat-lane="${side}-${row}" style="--lane:${row}">
  ${cols.map((col) => {
    const unit = units.find((candidate) => candidate.row === row && candidate.col === col)
    const slotAttribute = side === 'enemy' ? 'data-enemy-slot' : 'data-formation-slot'
    return `<div class="unit-cell ${unit ? 'filled' : 'unit-cell-empty'}" ${slotAttribute}="${row}-${col}" data-row="${row}" data-col="${col}">
      <span class="cell-tile" aria-hidden="true"></span>
      ${unit ? renderUnit(unit, side, effects) : ''}
    </div>`
  }).join('')}
</div>`
}

const renderLanes = (
  units: IdleCombatUnitView[],
  side: 'party' | 'enemy',
  effects: IdleCombatEffectView[],
): string => LANE_ROWS.map((row) => renderLane(units, side, row, effects)).join('')

const renderWaveTrack = (wave: number): string => Array.from({ length: 10 }, (_, index) => {
  const number = index + 1
  const classes = [
    'wave-bead',
    number < wave ? 'cleared' : '',
    number === wave ? 'current' : '',
    number === 10 ? 'boss-bead' : '',
  ].filter(Boolean).join(' ')
  return `<span class="${classes}" aria-label="第 ${number} 波"></span>`
}).join('')

const renderCombatLog = (logs: IdleCombatLogView[]): string => {
  if (!logs.length) return '<li class="log-loot"><span class="log-mark">获</span><span>敌人死亡时，本卷货币立即入账。</span></li>'
  return logs.slice(-60).reverse().map((entry) => `<li class="log-${entry.kind}" data-testid="combat-log-${entry.id}">
    <span class="log-mark">${escapeHtml(entry.mark)}</span><span>${escapeHtml(entry.text)}</span>
  </li>`).join('')
}

export const renderIdlePage = (view: IdlePageViewModel): string => {
  const inventoryFull = view.inventoryCount >= view.inventoryCapacity
  const scene = worldSceneAsset(view.worldId)
  const enemyCount = view.combat.enemies.filter((enemy) => enemy.alive).length
  const modeLabel = view.combat.mode === 'guard' ? '驻守中' : '闯荡中'
  const waveHint = view.combat.wave === 10 ? '帅旗压阵' : view.combat.wave >= 7 ? '精英现身' : '敌势未尽'
  const packPercent = percent(view.inventoryCount, view.inventoryCapacity)
  const waveEffects = view.effects.filter((effect) => effect.kind === 'wave-banner')
  return `
    <section class="idle-layout idle-page" data-testid="idle-page">
      <div class="idle-ghost-char" aria-hidden="true">战</div>
      <header class="battle-topbar">
        <div class="stage-id">
          <span class="stage-seal" aria-hidden="true">关</span>
          <span class="stage-text"><small>${escapeHtml(view.worldName)} · 第 ${view.selectedStage} 关 · ${modeLabel}</small><h1>第 <em>${view.combat.wave}</em> / 10 波</h1></span>
        </div>
        <div class="wave-track" aria-label="十波进度">
          <span class="wave-label">波次</span><span class="wave-beads">${renderWaveTrack(view.combat.wave)}</span><span class="wave-label"><strong>${waveHint}</strong></span>
        </div>
        <div class="topbar-stats">
          <div class="stat-chip${inventoryFull ? ' warn' : ''}" title="背包容量" ${inventoryFull ? 'role="status"' : ''}>
            <span class="chip-mark" aria-hidden="true">囊</span><span class="chip-num">背包 <em>${view.inventoryCount}</em> / ${view.inventoryCapacity}</span>
          </div>
        </div>
        <div class="battle-controls">
          <button type="button" class="ctl-btn${view.combat.mode === 'guard' ? ' active' : ''}" data-action="set-mode-guard" data-testid="mode-guard" title="驻守：原地迎敌，败退自动重整">驻守</button>
          <button type="button" class="ctl-btn${view.combat.mode === 'roam' ? ' active' : ''}" data-action="set-mode-roam" data-testid="mode-roam" title="闯荡：破阵后自动深入下一关">闯荡</button>
          <button type="button" class="ctl-btn gold" data-action="stop-combat" data-testid="stop-combat" title="停止战斗并返回关卡列表">停止</button>
          <span class="ctl-sep" aria-hidden="true"></span>
          <span class="speed-controls speed-group" aria-label="战斗速度">
            ${([1, 2, 4] as const).map((speed) => `<button type="button" data-action="speed-${speed}" class="ctl-btn${view.combatSpeed === speed ? ' active' : ''}" aria-pressed="${view.combatSpeed === speed}">${speed}×</button>`).join('')}
          </span>
        </div>
      </header>

      <div class="battle-stage">
        <section class="battlefield${scene ? ' has-scene' : ''}" data-testid="battlefield" aria-label="挂机战场"${scene ? ` style="--battle-scene:url('${escapeHtml(scene)}')"` : ''}>
          <section class="battle-half party" aria-label="我方阵容">
            <header class="half-heading party"><strong>我方</strong><span>三路五列 · 前列临阵</span><span class="half-hint">六侠成阵</span></header>
            <div class="battle-grid party">${renderLanes(view.combat.party, 'party', view.effects)}</div>
          </section>
          <div class="battle-divider" aria-hidden="true"><span class="divider-line"></span><span class="divider-status">第 <em>${view.combat.wave}</em> 波</span><span class="divider-seal">战</span><span class="divider-status">斩敌 <em>${view.stats.kills}</em></span><span class="divider-line"></span></div>
          <section class="battle-half enemy" aria-label="敌方阵容">
            <header class="half-heading enemy"><strong>敌方</strong><span>自右来犯 · 前列临阵</span><span class="half-hint">余敌 ${enemyCount}</span></header>
            <div class="battle-grid enemy">${renderLanes(view.combat.enemies, 'enemy', view.effects)}</div>
          </section>
          ${waveEffects.map((effect) => `<div class="wave-banner" data-testid="combat-effect-${effect.id}" aria-hidden="true">${escapeHtml(effect.text ?? '')}</div>`).join('')}
        </section>

        <aside class="combat-rail" aria-label="本场收益与战斗札记">
          <section class="rail-section loot-section">
            <header class="rail-title"><strong>本场收益</strong><small>即时入账</small><span class="rail-extra">${formatDuration(view.stats.elapsedMs)}</span></header>
            <div class="loot-grid">
              <div class="loot-cell"><span class="loot-num">${view.stats.copper.toLocaleString('zh-CN')}</span><span class="loot-label">铜钱</span></div>
              <div class="loot-cell"><span class="loot-num jade">${view.stats.equipment}</span><span class="loot-label">装备</span></div>
              <div class="loot-cell"><span class="loot-num paper">${view.stats.kills}</span><span class="loot-label">斩敌</span></div>
            </div>
            <div class="pack-meter${inventoryFull ? ' full' : ''}"><span class="pack-label">背包</span><span class="pack-track"><span class="pack-fill" style="width:${packPercent}%"></span></span><span class="pack-num">${view.inventoryCount} / ${view.inventoryCapacity}</span></div>
          </section>
          <section class="log-wrap">
            <header class="rail-section rail-log-heading"><span class="rail-title"><strong>战斗札记</strong><small>新事在上</small></span></header>
            <ol class="combat-log" data-testid="combat-log">${renderCombatLog(view.logs)}</ol>
          </section>
          <footer class="rail-section mechanic-legend">
            <span class="legend-item"><i class="legend-dot d-gauge"></i>气机 · 蓄满出手</span>
            <span class="legend-item"><i class="legend-dot d-energy"></i>真气 · 满则绝技</span>
            <span class="legend-item"><i class="legend-dot d-cool"></i>回气 · 冷却</span>
          </footer>
        </aside>
      </div>
    </section>`
}
