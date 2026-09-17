import type { CombatStats } from '../combat/stats'
import { escapeHtml, formatNumber } from './html'
import { heroPortraitAsset } from './portrait-assets'

export type FormationFilter = 'all' | '剑' | '刀' | '拳' | '暗' | '医' | '内家'

export type FormationLane = 0 | 1 | 2
export type FormationDepth = 0 | 1 | 2 | 3 | 4

export interface FormationHeroView {
  id: string
  name: string
  grade: string
  level: number
  inFormation: boolean
  category: string
  source: string
  combatStats: Pick<CombatStats, 'maxHp' | 'externalAttack' | 'internalAttack' | 'externalDefense' | 'internalDefense' | 'effectiveAgility'>
}

export interface FormationPageViewModel {
  locked: boolean
  selectedHeroId: string | null
  filter: FormationFilter
  formation: Array<{ heroId: string; row: FormationLane; col: FormationDepth }>
  heroes: FormationHeroView[]
}

const filterOptions: Array<{ id: FormationFilter; label: string }> = [
  { id: 'all', label: '全' },
  { id: '剑', label: '剑' },
  { id: '刀', label: '刀' },
  { id: '拳', label: '拳' },
  { id: '暗', label: '暗' },
  { id: '医', label: '医' },
  { id: '内家', label: '内' },
]

const gradeClass = (grade: string): string => `g-${grade}`

const categoryLabel = (category: string): string => category === '内家' ? '内' : category

const FORMATION_LANES: readonly FormationLane[] = [0, 1, 2]
const FORMATION_DEPTHS: readonly FormationDepth[] = [0, 1, 2, 3, 4]

const laneSigils = ['☰', '☲', '☷'] as const
const rowNames = ['上路', '中路', '下路'] as const
const rowMoods = ['先声夺人 · 居高临敌', '中军坐镇 · 承前启后', '奇兵侧翼 · 伺机而动'] as const
const positionNames = ['壹', '贰', '叁', '肆', '伍'] as const
const orderNames = ['壹', '贰', '叁', '肆', '伍', '陆'] as const

const slotName = (row: FormationLane, col: FormationDepth): string => `${rowNames[row]}·${positionNames[col]}位`

const heroAt = (view: FormationPageViewModel, heroId: string | null | undefined): FormationHeroView | undefined =>
  heroId ? view.heroes.find((hero) => hero.id === heroId) : undefined

const placedHeroes = (view: FormationPageViewModel): FormationHeroView[] =>
  view.formation.flatMap((slot) => {
    const hero = heroAt(view, slot.heroId)
    return hero ? [hero] : []
  })

const renderGradeSeal = (hero: FormationHeroView, compact = false): string =>
  `<span class="formation-grade-seal${compact ? ' compact' : ''} ${gradeClass(hero.grade)}" data-grade="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span>`

const renderPortrait = (hero: FormationHeroView, className: string): string => {
  const portrait = heroPortraitAsset(hero.id, hero.category)
  return `<img class="${className}" src="${escapeHtml(portrait.url)}" data-portrait-source="${portrait.source}" alt="" aria-hidden="true" draggable="false">`
}

const renderPortraitWithGrade = (hero: FormationHeroView, portraitClass: string, compact = false): string =>
  `<span class="formation-portrait-frame${compact ? ' compact' : ' card'}">${renderPortrait(hero, portraitClass)}${renderGradeSeal(hero, compact)}</span>`

const renderRoster = (view: FormationPageViewModel): string => {
  const heroes = view.filter === 'all' ? view.heroes : view.heroes.filter((hero) => hero.category === view.filter)
  return `<aside class="formation-roster panel" data-testid="formation-roster" aria-label="点将名册">
    <div class="formation-roster-inner">
      <header class="formation-roster-head">
        <div><h2>点将名册</h2><small>演武点将 · 既入江湖</small></div>
        <span>在册 <b>${view.heroes.length}</b><i>·</i> 在阵 <b>${view.heroes.filter((hero) => hero.inFormation).length}</b></span>
      </header>
      <div class="formation-filter" id="formationFilter" role="group" aria-label="按职业筛选">
        ${filterOptions.map((filter) => `<button type="button" class="formation-filter-chip${view.filter === filter.id ? ' active' : ''}" data-action="formation-filter" data-filter="${escapeHtml(filter.id)}" aria-pressed="${view.filter === filter.id}">${filter.label}</button>`).join('')}
      </div>
      <div class="formation-roster-list">
        ${heroes.map((hero) => `<div class="formation-roster-row${hero.inFormation ? ' in-formation' : ''}${hero.id === view.selectedHeroId ? ' active' : ''}">
          <button type="button" draggable="${!view.locked}" data-action="formation-select" data-hero-id="${escapeHtml(hero.id)}" data-testid="formation-hero-${escapeHtml(hero.id)}" class="formation-roster-select" aria-pressed="${hero.id === view.selectedHeroId}" aria-label="点选 ${escapeHtml(hero.name)} 布阵">
          ${renderPortraitWithGrade(hero, 'formation-roster-portrait', true)}
          <span class="formation-roster-copy"><strong>${escapeHtml(hero.name)}</strong><small>${escapeHtml(categoryLabel(hero.category))} · ${escapeHtml(hero.source)}</small></span>
          <span class="formation-roster-level">Lv.${hero.level}</span>
          </button>
          ${hero.inFormation ? '<em class="formation-roster-stamp">在阵</em>' : ''}
          <button type="button" class="formation-roster-detail" data-action="formation-view-hero" data-hero-id="${escapeHtml(hero.id)}" aria-label="查看 ${escapeHtml(hero.name)} 的侠客详情">详情</button>
        </div>`).join('') || '<p class="formation-empty-roster">此类侠客尚未入册</p>'}
      </div>
      <footer>${view.locked ? '战斗中可查看侠客，退出战斗后可布阵' : '点击选将 · 拖拽令牌亦可布阵'}</footer>
    </div>
  </aside>`
}

const renderFormationSlot = (view: FormationPageViewModel, row: FormationLane, col: FormationDepth): string => {
  const slot = view.formation.find((item) => item.row === row && item.col === col)
  const hero = heroAt(view, slot?.heroId)
  const label = slotName(row, col)
  return `<div class="formation-slot${hero ? ' filled' : ''}${hero?.id === view.selectedHeroId ? ' selected' : ''}" data-row="${row}" data-col="${col}" data-action="formation-slot-tap" ${hero ? `data-hero-id="${escapeHtml(hero.id)}" draggable="${!view.locked}"` : ''} data-testid="formation-slot-${row}-${col}" aria-label="${label}">
    ${hero ? `<div class="formation-token" draggable="${!view.locked}" data-hero-id="${escapeHtml(hero.id)}">
      <span class="formation-token-hole" aria-hidden="true"></span>
      ${renderPortrait(hero, 'formation-token-portrait')}
      <span class="formation-token-cat"><i>${escapeHtml(categoryLabel(hero.category))}</i></span>
      <span class="formation-token-name">${escapeHtml(hero.name)}</span>
      <span class="formation-token-level">Lv.${hero.level}</span>
      ${renderGradeSeal(hero, true)}
      <button type="button" class="formation-token-remove formation-slot-remove" data-action="formation-remove" ${view.locked ? 'disabled' : ''} data-hero-id="${escapeHtml(hero.id)}" aria-label="下阵 ${escapeHtml(hero.name)}">×</button>
    </div>` : '<div class="formation-token-ghost"><span>虚位</span></div>'}
    <div class="formation-slot-disc" aria-hidden="true"><span>${laneSigils[row]}</span></div>
    <div class="formation-slot-label">${label}</div>
  </div>`
}

// 阵面朝右：每路自左向右为 伍→壹（col 4→0），最前列贴敌方来向
const renderFormationRow = (view: FormationPageViewModel, row: FormationLane): string => `<div class="formation-row lane-${row}" style="--lane:${row}">
  <div class="formation-row-tag"><span>${rowNames[row]}</span><small>${rowMoods[row]}</small></div>
  <div class="formation-slots">${[...FORMATION_DEPTHS].reverse().map((col) => renderFormationSlot(view, row, col)).join('')}</div>
</div>`

const formationOrderKey = (slot: { row: FormationLane; col: FormationDepth }): number => slot.row * 5 + slot.col

const renderFormationField = (view: FormationPageViewModel): string => {
  const order = [...view.formation]
    .sort((left, right) => formationOrderKey(left) - formationOrderKey(right))
    .map((slot) => heroAt(view, slot.heroId))
    .filter((hero): hero is FormationHeroView => Boolean(hero))
  const orderSlots = Array.from({ length: 6 }, (_, index) => order[index])
  return `<section class="formation-field panel" aria-label="演武场">
    <header class="formation-field-head">
      <div><div class="formation-field-title"><h2>演武场</h2><span>三路五列 · <i>至多六将</i></span></div><p>${view.locked ? '战斗进行中 · 结束或退出战斗后可调整阵容' : '令牌落位 · 拖拽可移动或交换'}</p></div>
      <div class="formation-field-ops"><button type="button" class="formation-btn-gold" data-action="formation-auto-arrange" ${view.locked ? 'disabled' : ''}>自动列阵</button><button type="button" class="formation-btn-ghost" data-action="formation-clear" ${view.locked ? 'disabled' : ''}>悉数下阵</button></div>
    </header>
    <div class="formation-field-body">
      <div class="formation-field-rows">${FORMATION_LANES.map((row) => renderFormationRow(view, row)).join('')}</div>
      <div class="formation-enemy-strip" aria-hidden="true"><span class="formation-ember"></span><span>狼烟起处 · 敌军自右来袭</span><i>‹ ‹ ‹</i></div>
    </div>
    <div class="formation-order-ribbon" data-testid="formation-order"><span class="formation-order-label">出手<br>次第</span>${orderSlots.map((hero, index) => `<div class="formation-order-node${hero ? ' lit' : ''}"><span>${orderNames[index]}</span><small>${hero ? escapeHtml(hero.name) : '虚'}</small></div>`).join('')}</div>
  </section>`
}

export const displayPower = (heroes: FormationHeroView[]): number => heroes.reduce((total, hero) => {
  const stats = hero.combatStats
  return total + Math.round(
    stats.maxHp * 0.5
    + (stats.externalAttack + stats.internalAttack) * 4
    + (stats.externalDefense + stats.internalDefense) * 3
    + stats.effectiveAgility * 2,
  )
}, 0)

export const renderFormationPage = (view: FormationPageViewModel): string => {
  const heroesInFormation = placedHeroes(view)
  return `<section class="formation-page" data-testid="formation-page">
    <span class="formation-ghost formation-ghost-array" aria-hidden="true">陣</span><span class="formation-ghost formation-ghost-muster" aria-hidden="true">將</span>
    <header class="formation-page-head"><div><p class="formation-crumb">蛋蛋江湖 2.0 <b>/</b> 阵容 · 演武点将</p><h1>阵容</h1><span>FORMATION · MUSTER AT THE ARENA</span></div><div class="formation-stats" aria-label="队伍概览"><div><b>${formatNumber(displayPower(heroesInFormation))}</b><small>队伍战力</small></div><div><b><i>${heroesInFormation.length}</i>/6</b><small>上阵侠客</small></div></div></header>
    <div class="formation-bonus-entry"><button type="button" class="formation-btn-line" data-action="open-formation-bonuses">查看加成</button></div>
    <div class="formation-muster-layout">${renderRoster(view)}${renderFormationField(view)}</div>
    <footer class="formation-page-foot"><span><b>阵容页高保真重设计</b> · 蛋蛋江湖 2.0 · 演武点将</span></footer>
  </section>`
}
