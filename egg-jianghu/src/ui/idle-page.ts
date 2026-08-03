import { escapeHtml, percent } from './html'

export interface IdleCombatUnitView {
  id: string
  name: string
  rank: 'normal' | 'elite' | 'boss'
  row: 'front' | 'back'
  position: 0 | 1 | 2
  hp: number
  maxHp: number
  energy: number
  maxEnergy: number
  gauge: number
  cooldownMs: number
  alive: boolean
}

export interface IdleCombatView {
  mode: 'guard' | 'roam'
  wave: number
  party: IdleCombatUnitView[]
  enemies: IdleCombatUnitView[]
}

export interface IdlePageViewModel {
  worldName: string
  selectedStage: number
  inventoryCount: number
  inventoryCapacity: number
  combatSpeed: 1 | 2 | 4
  combat: IdleCombatView
  logs: string[]
}

const rankName = { normal: '小怪', elite: '精英', boss: 'Boss' } as const

const renderGauge = (label: string, value: number, maximum: number, className: string): string => `
  <div class="meter ${className}">
    <span>${label}</span><i><b style="width:${percent(value, maximum)}%"></b></i><em>${Math.floor(value)} / ${Math.floor(maximum)}</em>
  </div>`

const renderUnit = (unit: IdleCombatUnitView, side: 'party' | 'enemy'): string => `
  <article class="combat-unit ${side} ${unit.alive ? '' : 'fallen'}" data-unit-id="${escapeHtml(unit.id)}" data-rank="${unit.rank}">
    <header><strong>${escapeHtml(unit.name)}</strong><span>${unit.row === 'front' ? '前排' : '后排'}${side === 'enemy' ? ` · ${rankName[unit.rank]}` : ''}</span></header>
    ${renderGauge('气血', unit.hp, unit.maxHp, 'hp-meter')}
    ${renderGauge('气机', unit.gauge, 1000, 'gauge-meter')}
    ${side === 'party' ? renderGauge('真气', unit.energy, unit.maxEnergy, 'energy-meter') : ''}
    <footer><span>回气</span><strong>${(unit.cooldownMs / 1000).toFixed(1)}s</strong></footer>
  </article>`

const formationSlots = (combat: IdleCombatView | null): string => (['front', 'back'] as const).flatMap((row) =>
  ([0, 1, 2] as const).map((position) => {
    const unit = combat?.party.find((member) => member.row === row && member.position === position)
    return `<div class="formation-slot ${unit ? 'filled' : 'empty'}" data-formation-slot="${row}-${position}" data-row="${row}" data-position="${position}">
      ${unit ? renderUnit(unit, 'party') : `<span>${row === 'front' ? '前排' : '后排'} ${position + 1}</span>`}
    </div>`
  }),
).join('')

const enemySlots = (combat: IdleCombatView): string => {
  if (!combat.enemies.length) return '<div class="battle-empty"><strong>山道暂静</strong><span>下一波敌人正在赶来</span></div>'
  return (['back', 'front'] as const).flatMap((row) =>
    ([0, 1, 2] as const).map((position) => {
      const unit = combat.enemies.find((enemy) => enemy.row === row && enemy.position === position)
      return `<div class="enemy-slot ${unit ? 'filled' : 'empty'}" data-enemy-slot="${row}-${position}" data-row="${row}" data-position="${position}">
        ${unit ? renderUnit(unit, 'enemy') : `<span>${row === 'front' ? '前排' : '后排'} ${position + 1}</span>`}
      </div>`
    }),
  ).join('')
}

export const renderIdlePage = (view: IdlePageViewModel): string => {
  const inventoryFull = view.inventoryCount >= view.inventoryCapacity
  return `
    <section class="idle-layout" data-testid="idle-page">
      <section class="battle-theatre panel">
        <header class="battle-heading">
          <div><small>${escapeHtml(view.worldName)} · 第 ${view.selectedStage} 关</small><h1>第 ${view.combat.wave} / 10 波</h1></div>
          ${inventoryFull ? '<strong class="capacity-warning" role="status">背包已满 · 新装备无法获得</strong>' : `<span class="capacity-safe">背包 ${view.inventoryCount} / ${view.inventoryCapacity}</span>`}
        </header>
        <div class="battlefield">
          <section class="battle-side enemy-side" aria-label="敌方阵容">
            <header class="battle-side-heading"><strong>敌方</strong><span>后排在上 · 前排临阵</span></header>
            <div class="enemy-board" data-testid="enemy-board">${enemySlots(view.combat)}</div>
          </section>
          <div class="battle-divider" aria-hidden="true"><span>战</span></div>
          <section class="battle-side party-side" aria-label="我方阵容">
            <header class="battle-side-heading"><strong>我方</strong><span>前排临阵 · 后排在下</span></header>
            <div class="formation-board" aria-label="六侠两排阵容">${formationSlots(view.combat)}</div>
          </section>
        </div>
        <footer class="battle-controls">
          <div class="mode-controls">
            <button type="button" class="primary${view.combat.mode === 'guard' ? ' active' : ''}" data-action="set-mode-guard" data-testid="mode-guard">驻守</button>
            <button type="button" class="primary roam${view.combat.mode === 'roam' ? ' active' : ''}" data-action="set-mode-roam" data-testid="mode-roam">闯荡</button>
            <button type="button" data-action="stop-combat" data-testid="stop-combat">停止战斗</button>
          </div>
          <div class="speed-controls" aria-label="战斗速度">
            ${([1, 2, 4] as const).map((speed) => `<button type="button" data-action="speed-${speed}" class="${view.combatSpeed === speed ? 'active' : ''}">${speed}×</button>`).join('')}
          </div>
        </footer>
      </section>

      <aside class="combat-rail panel">
        <header><small>战斗札记</small><strong>即时结算</strong></header>
        <div class="mechanic-legend"><span>气机</span><span>真气</span><span>回气</span></div>
        <ol class="combat-log" data-testid="combat-log">
          ${view.logs.length ? view.logs.slice(-12).reverse().map((entry) => `<li>${escapeHtml(entry)}</li>`).join('') : '<li>敌人死亡时，货币与随机装备立即入账。</li>'}
        </ol>
      </aside>
    </section>`
}
