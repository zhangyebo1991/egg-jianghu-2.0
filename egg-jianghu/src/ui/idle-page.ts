import { heroByIdV10, heroMeridianCategory } from '../content/heroes'
import { escapeHtml, percent } from './html'
import { enemyPortraitAsset, heroPortraitAsset } from './portrait-assets'
import { worldSceneAsset } from './world-scene-assets'
import { ORIGINAL_COMBAT_SPEEDS, type CombatSpeed } from '../combat/scheduler'
import partyDeathImageUrl from '../assets/combat/zt-party-death.webp'

export interface IdleCombatUnitView {
  id: string
  name: string
  rank: 'normal' | 'elite' | 'captain' | 'boss'
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
  shield?: number
  statuses?: IdleCombatStatusView[]
}

export interface IdleCombatStatusView {
  name: string
  stacks: number
  polarity: 'buff' | 'debuff'
}

export interface IdleCombatView {
  mode: 'guard' | 'roam'
  wave: number
  enemyVisible?: boolean
  party: IdleCombatUnitView[]
  enemies: IdleCombatUnitView[]
  settlement?: {
    outcome: 'victory' | 'defeat'
    countdownSeconds: number
    closing: boolean
  } | null
  timeline: {
    phase: 'accumulating' | 'acting' | 'wave-transition' | 'ending'
    activeActorId: string | null
    readyQueue: Array<{ actorId: string; readySeq: number }>
  }
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
  /** 已按当前战斗倍率换算的 CSS 动画时长。 */
  durationMs?: number
  /** 已按当前战斗倍率换算的 CSS 动画年龄，用负 delay 对齐模拟阶段。 */
  elapsedMs?: number
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
  combatSpeed: CombatSpeed
  combat: IdleCombatView
  stats: IdleCombatStatsView
  logs: IdleCombatLogView[]
  effects: IdleCombatEffectView[]
}

const rankLabel = { normal: '', elite: '精英', captain: '头目', boss: 'BOSS' } as const
const laneNames = ['上路', '中路', '下路'] as const
const LANE_ROWS = [0, 1, 2] as const
const LANE_COLS = [0, 1, 2, 3, 4] as const
const DISPLAY_ENERGY_CAP = 5
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

const displayedEnergy = (unit: IdleCombatUnitView): number =>
  Math.max(0, Math.min(DISPLAY_ENERGY_CAP, Math.floor(unit.energy)))

const renderPartyEnergy = (unit: IdleCombatUnitView): string => {
  const energy = displayedEnergy(unit)
  const full = energy === DISPLAY_ENERGY_CAP
  return `<span class="unit-energy-orbs${full ? ' full' : ''}" data-testid="unit-energy-${escapeHtml(unit.id)}"
      role="meter" aria-label="${escapeHtml(unit.name)}能量" aria-valuemin="0" aria-valuemax="${DISPLAY_ENERGY_CAP}" aria-valuenow="${energy}">
    ${Array.from({ length: DISPLAY_ENERGY_CAP }, (_, index) => `<i class="energy-orb${index < energy ? ' charged' : ''}" aria-hidden="true"></i>`).join('')}
  </span>`
}

const renderEffect = (effect: IdleCombatEffectView): string => {
  const testId = `combat-effect-${effect.id}`
  const timingStyle = renderEffectTimingStyle(effect)
  if (effect.kind === 'slash') return `<span class="slash-arc" data-testid="${testId}"${timingStyle} aria-hidden="true"></span>`
  if (effect.kind === 'skill-aura' || effect.kind === 'heal-aura') {
    return `<span class="unit-aura ${effect.kind}" data-testid="${testId}"${timingStyle} aria-hidden="true"></span>`
  }
  const className = effect.kind === 'critical'
    ? 'dmg-float crit'
    : effect.kind === 'healing'
      ? 'dmg-float heal'
      : effect.kind === 'skill-name'
        ? 'dmg-float skill-name-float'
        : 'dmg-float'
  return `<span class="${className}" data-testid="${testId}"${timingStyle} aria-hidden="true">${escapeHtml(effect.text ?? '')}</span>`
}

const renderEffectTimingStyle = (effect: IdleCombatEffectView): string => {
  if (effect.durationMs === undefined || effect.elapsedMs === undefined) return ''
  const durationMs = Math.max(1, Math.round(effect.durationMs))
  const elapsedMs = Math.max(0, Math.min(durationMs, Math.round(effect.elapsedMs)))
  return ` style="--combat-effect-duration:${durationMs}ms;--combat-effect-delay:-${elapsedMs}ms"`
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
  const motionEffect = unitEffects.findLast((effect) => motionKinds.has(effect.kind))
  const hpPercent = unit.maxHp > 0 ? unit.hp / unit.maxHp * 100 : 0
  const rank = rankLabel[unit.rank]
  const statuses = (unit.statuses ?? []).slice(0, 3)
  const shield = unit.shield ?? 0
  if (side === 'party' && !unit.alive) {
    return `<article class="combat-unit party fallen" data-unit-id="${escapeHtml(unit.id)}" data-rank="${unit.rank}" data-testid="combat-unit-${escapeHtml(unit.id)}" aria-label="${escapeHtml(unit.name)}已阵亡">
      <img class="combat-death-image" src="${escapeHtml(partyDeathImageUrl)}" data-testid="party-death-image-${escapeHtml(unit.id)}" alt="" aria-hidden="true" draggable="false">
    </article>`
  }
  const energyFull = side === 'party' && displayedEnergy(unit) === DISPLAY_ENERGY_CAP
  return `<article class="combat-unit ${side}${unit.alive ? '' : ' fallen'}${energyFull ? ' energy-full' : ''}${motionClasses ? ` ${motionClasses}` : ''}"
      data-unit-id="${escapeHtml(unit.id)}" data-rank="${unit.rank}" data-testid="combat-unit-${escapeHtml(unit.id)}"${motionEffect ? renderEffectTimingStyle(motionEffect) : ''}>
    ${renderUnitPortrait(unit, side)}
    <span class="unit-body">
      <span class="unit-head">
        <strong class="unit-name">${escapeHtml(unit.name)}</strong>
        ${rank ? `<span class="unit-tag rank-${unit.rank}">${rank}</span>` : ''}
        <span class="unit-tag row-tag">${laneNames[unit.row]}</span>
      </span>
      ${renderGauge('气血', unit.hp, unit.maxHp, 'hp-meter', unit.alive && hpPercent <= 30 ? 'low' : '')}
      ${shield > 0 ? renderGauge('护盾', shield, Math.max(shield, unit.maxHp), 'shield-meter') : ''}
      ${statuses.length ? `<span class="unit-statuses">${statuses.map((status) =>
        `<span class="status-chip ${status.polarity}">${escapeHtml(status.name)}${status.stacks > 1 ? `×${status.stacks}` : ''}</span>`
      ).join('')}</span>` : ''}
      <span class="unit-foot"><span class="foot-label">回气</span><span class="cool-num">${(unit.cooldownMs / 1000).toFixed(1)}s</span><span class="skill-name">${escapeHtml(unit.skillName)}</span></span>
      ${side === 'party' ? renderPartyEnergy(unit) : ''}
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
    const unit = units.find((candidate) =>
      candidate.row === row && candidate.col === col && (side === 'party' || candidate.alive))
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

const renderActionTimeline = (combat: IdleCombatView): string => {
  const enemies = combat.enemyVisible === false ? [] : combat.enemies
  const units = [...combat.party, ...enemies].filter((unit) => unit.alive)
  const queueById = new Map(combat.timeline.readyQueue.map((entry, index) => [entry.actorId, { ...entry, index: index + 1 }]))
  const phaseLabel = combat.timeline.phase === 'acting'
    ? '行动锁定'
    : combat.timeline.phase === 'wave-transition'
      ? '换阵'
      : combat.timeline.phase === 'ending'
        ? '结算'
        : '行动积攒'
  return `<section class="combat-action-timeline" data-testid="combat-action-timeline" aria-label="共用行动条">
    <span class="action-timeline-label"><strong>气机</strong><small>${phaseLabel}</small></span>
    <span class="action-track" aria-hidden="true">
      <span class="action-track-fill"></span>
      ${units.map((unit) => {
        const queued = queueById.get(unit.id)
        const active = combat.timeline.activeActorId === unit.id
        const progress = active || queued ? 100 : Math.max(0, Math.min(100, unit.gauge / 10))
        const queueOffset = active ? 0 : queued?.index ?? 0
        const side = combat.party.some((candidate) => candidate.id === unit.id) ? 'party' : 'enemy'
        const classes = ['action-marker', side, active ? 'active' : '', queued ? 'ready' : ''].filter(Boolean).join(' ')
        return `<span class="${classes}" data-action-unit="${escapeHtml(unit.id)}" data-ready-seq="${queued?.readySeq ?? ''}" style="--action-progress:${progress};--queue-offset:${queueOffset}" title="${escapeHtml(unit.name)} · ${active ? '正在行动' : queued ? `待出手 #${queued.readySeq}` : `气机 ${Math.floor(unit.gauge)}`}"><i>${escapeHtml(unit.name.slice(0, 1))}</i></span>`
      }).join('')}
    </span>
    <span class="action-ready-label">出手</span>
  </section>`
}

const renderCombatLog = (logs: IdleCombatLogView[]): string => {
  if (!logs.length) return '<li class="log-loot"><span class="log-mark">获</span><span>敌人死亡时，本卷货币立即入账。</span></li>'
  return logs.slice(-60).reverse().map((entry) => `<li class="log-${entry.kind}" data-testid="combat-log-${entry.id}">
    <span class="log-mark">${escapeHtml(entry.mark)}</span><span>${escapeHtml(entry.text)}</span>
  </li>`).join('')
}

const renderSettlement = (combat: IdleCombatView): string => {
  const settlement = combat.settlement
  if (!settlement) return ''
  const victory = settlement.outcome === 'victory'
  const countdown = settlement.closing
    ? '重整战场中'
    : `${settlement.countdownSeconds} 秒后自动重新挑战`
  return `<section class="combat-settlement ${settlement.outcome}" data-testid="combat-settlement" role="status" aria-live="polite">
    <span class="settlement-seal" aria-hidden="true">${victory ? '胜' : '退'}</span>
    <span class="settlement-copy"><small>${victory ? '十波尽破' : '侠客力竭'}</small><strong>${victory ? '破阵告捷' : '败退重整'}</strong><em>${countdown}</em></span>
  </section>`
}

export const renderIdlePage = (view: IdlePageViewModel): string => {
  const inventoryFull = view.inventoryCount >= view.inventoryCapacity
  const scene = worldSceneAsset(view.worldId)
  const enemyVisible = view.combat.enemyVisible !== false
  const visibleEnemies = enemyVisible ? view.combat.enemies : []
  const enemyCount = visibleEnemies.filter((enemy) => enemy.alive).length
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
            ${ORIGINAL_COMBAT_SPEEDS.map((speed) => `<button type="button" data-action="speed-${speed}" class="ctl-btn${view.combatSpeed === speed ? ' active' : ''}" aria-pressed="${view.combatSpeed === speed}">${speed}×</button>`).join('')}
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
            <header class="half-heading enemy"><strong>敌方</strong><span>自右来犯 · 前列临阵</span><span class="half-hint">${enemyVisible ? `余敌 ${enemyCount}` : '敌阵未现'}</span></header>
            <div class="battle-grid enemy">${renderLanes(visibleEnemies, 'enemy', view.effects)}</div>
            ${enemyVisible ? '' : '<div class="enemy-arrival" data-testid="enemy-arrival"><span>敌</span><strong>敌阵正在逼近</strong></div>'}
          </section>
          ${renderActionTimeline(view.combat)}
          ${waveEffects.map((effect) => `<div class="wave-banner" data-testid="combat-effect-${effect.id}"${renderEffectTimingStyle(effect)} aria-hidden="true">${escapeHtml(effect.text ?? '')}</div>`).join('')}
          ${renderSettlement(view.combat)}
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
            <span class="legend-item"><i class="legend-dot d-gauge"></i>气机 · 底部共用行动条</span>
            <span class="legend-item"><i class="legend-dot d-energy"></i>能量 · 满则绝技</span>
            <span class="legend-item"><i class="legend-dot d-cool"></i>回气 · 冷却</span>
          </footer>
        </aside>
      </div>
    </section>`
}
