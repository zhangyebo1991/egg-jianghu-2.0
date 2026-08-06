import type { CombatStats } from '../combat/stats'
import type { HeroAptitudes } from '../content/heroes'
import { escapeHtml, formatNumber } from './html'
import { heroPortraitAsset } from './portrait-assets'

export type FormationFilter = 'all' | '剑' | '刀' | '拳' | '暗' | '医' | '内家'

export interface FormationCareerView {
  name: string
  state: 'done' | 'current' | 'future'
}

export interface FormationMartialView {
  name: string
  rarity: string
  level: number
}

export interface FormationHeroView {
  id: string
  name: string
  grade: string
  level: number
  inFormation: boolean
  category: string
  source: string
  careerName: string
  careerLevel: number
  careerPath: FormationCareerView[]
  aptitudes: HeroAptitudes
  combatStats: Pick<CombatStats, 'maxHp' | 'externalAttack' | 'internalAttack' | 'externalDefense' | 'internalDefense' | 'effectiveAgility'>
  equippedMartials: Array<FormationMartialView | null>
  heartMethodName: string | null
  slot: { row: 'front' | 'back'; position: 0 | 1 | 2 } | null
}

export interface FormationPageViewModel {
  selectedHeroId: string | null
  filter: FormationFilter
  formation: Array<{ heroId: string; row: 'front' | 'back'; position: 0 | 1 | 2 }>
  heroes: FormationHeroView[]
}

interface FormationSynergyView {
  id: string
  name: string
  needs: Array<{ label: string; required: number; current: number; met: boolean }>
  effect: string
  active: boolean
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

const fitText: Record<string, string> = {
  拳: '拳师根骨沉厚，宜列前排，为队友遮拦锋镝。',
  刀: '刀势沉猛，宜居前以先手破敌，势不可挡。',
  剑: '剑走轻灵，前列可抢先手，后列可保其锋。',
  暗: '淬毒暗器，藏于帷幄之中，出手最难提防。',
  医: '医者仁心，居后方得悬壶续命、安稳施救。',
  内家: '内家气脉绵长，居后运气，可护全队心脉。',
}

const trigram: Record<'front' | 'back', [string, string, string]> = {
  front: ['☰', '☱', '☲'],
  back: ['☵', '☶', '☷'],
}

const rowNames = { front: '前排', back: '后排' } as const
const positionNames = ['壹', '贰', '叁'] as const
const orderNames = ['壹', '贰', '叁', '肆', '伍', '陆'] as const

const synergyDefinitions: Array<{
  id: string
  name: string
  need: Array<[string, number]>
  effect: string
}> = [
  { id: 'fist', name: '双拳镇岳', need: [['拳', 2]], effect: '气血上限 +10% · 前排承伤更稳' },
  { id: 'sword', name: '三剑齐鸣', need: [['剑', 3]], effect: '会心一击 +8% · 剑光相映成辉' },
  { id: 'doctor-fist', name: '医武相济', need: [['医', 1], ['拳', 1]], effect: '每回合回复 2% 气血' },
  { id: 'blade-shadow', name: '刀暗双绝', need: [['刀', 1], ['暗', 1]], effect: '破甲 +6% · 攻其不备' },
  { id: 'inner', name: '内家护脉', need: [['内家', 2]], effect: '内力回复 +12% · 气脉悠长' },
  { id: 'full', name: '六侠成阵', need: [['满员', 6]], effect: '全属性 +3% · 阵势圆熟' },
]

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
        ${heroes.map((hero) => `<button type="button" draggable="true" data-action="formation-select" data-hero-id="${escapeHtml(hero.id)}" data-testid="formation-hero-${escapeHtml(hero.id)}" class="formation-roster-row${hero.inFormation ? ' in-formation' : ''}${hero.id === view.selectedHeroId ? ' active' : ''}" aria-pressed="${hero.id === view.selectedHeroId}">
          ${renderPortrait(hero, 'formation-roster-portrait')}${renderGradeSeal(hero, true)}
          <span class="formation-roster-copy"><strong>${escapeHtml(hero.name)}</strong><small>${escapeHtml(categoryLabel(hero.category))} · ${escapeHtml(hero.careerName)} · ${escapeHtml(hero.source)}</small></span>
          <span class="formation-roster-level">Lv.${hero.level}</span>
          ${hero.inFormation ? '<em class="formation-roster-stamp">在阵</em>' : ''}
        </button>`).join('') || '<p class="formation-empty-roster">此类侠客尚未入册</p>'}
      </div>
      <footer>点击选将 · 拖拽令牌亦可布阵</footer>
    </div>
  </aside>`
}

const renderFormationSlot = (view: FormationPageViewModel, row: 'front' | 'back', position: 0 | 1 | 2): string => {
  const slot = view.formation.find((item) => item.row === row && item.position === position)
  const hero = heroAt(view, slot?.heroId)
  const label = `${rowNames[row]}·${positionNames[position]}位`
  return `<div class="formation-slot${hero ? ' filled' : ''}${hero?.id === view.selectedHeroId ? ' selected' : ''}" data-row="${row}" data-position="${position}" data-action="formation-slot-tap" ${hero ? `data-hero-id="${escapeHtml(hero.id)}" draggable="true"` : ''} data-testid="formation-slot-${row}-${position}" aria-label="${label}">
    ${hero ? `<div class="formation-token" draggable="true" data-hero-id="${escapeHtml(hero.id)}">
      <span class="formation-token-hole" aria-hidden="true"></span>
      ${renderPortrait(hero, 'formation-token-portrait')}
      <span class="formation-token-cat"><i>${escapeHtml(categoryLabel(hero.category))}</i></span>
      <span class="formation-token-name">${escapeHtml(hero.name)}</span>
      <span class="formation-token-level">Lv.${hero.level}</span>
      ${renderGradeSeal(hero, true)}
      <button type="button" class="formation-token-remove formation-slot-remove" data-action="formation-remove" data-hero-id="${escapeHtml(hero.id)}" aria-label="下阵 ${escapeHtml(hero.name)}">×</button>
    </div>` : '<div class="formation-token-ghost"><span>虚位</span></div>'}
    <div class="formation-slot-disc" aria-hidden="true"><span>${trigram[row][position]}</span></div>
    <div class="formation-slot-label">${label}</div>
  </div>`
}

const renderFormationRow = (view: FormationPageViewModel, row: 'front' | 'back'): string => `<div class="formation-row ${row}">
  <div class="formation-row-tag"><span>${rowNames[row]}</span><small>${row === 'front' ? '锋镝所迎 · 受敌先击' : '藏锋蓄锐 · 出手稍缓'}</small></div>
  <div class="formation-slots">${([0, 1, 2] as const).map((position) => renderFormationSlot(view, row, position)).join('')}</div>
</div>`

const renderFormationField = (view: FormationPageViewModel): string => {
  const order = [...(['front', 'back'] as const).flatMap((row) => ([0, 1, 2] as const).map((position) => {
    const slot = view.formation.find((item) => item.row === row && item.position === position)
    return heroAt(view, slot?.heroId)
  }))]
  return `<section class="formation-field panel" aria-label="演武场">
    <header class="formation-field-head">
      <div><div class="formation-field-title"><h2>演武场</h2><span>前后两列 · <i>各陈三将</i></span></div><p>令牌落位，阵势自成 · 拖拽可移动或交换</p></div>
      <div class="formation-field-ops"><button type="button" class="formation-btn-gold" data-action="formation-auto-arrange">自动列阵</button><button type="button" class="formation-btn-ghost" data-action="formation-clear">悉数下阵</button></div>
    </header>
    <div class="formation-enemy-strip" aria-hidden="true"><span class="formation-ember"></span><span>狼烟起处 · 敌军来向</span><i>› › ›</i></div>
    <div class="formation-field-rows">${renderFormationRow(view, 'front')}${renderFormationRow(view, 'back')}</div>
    <div class="formation-order-ribbon" data-testid="formation-order"><span class="formation-order-label">出手<br>次第</span>${order.map((hero, index) => `<div class="formation-order-node${hero ? ' lit' : ''}"><span>${orderNames[index]}</span><small>${hero ? escapeHtml(hero.name) : '虚'}</small></div>`).join('')}</div>
  </section>`
}

const renderRadar = (hero: FormationHeroView): string => {
  const axes = [
    ['臂力', 'strength'], ['悟性', 'insight'], ['体魄', 'constitution'], ['身法', 'agility'], ['定力', 'resolve'],
  ] as const
  const cx = 100
  const cy = 95
  const radius = 58
  const max = 16
  const point = (index: number, distance: number): [number, number] => {
    const angle = (-90 + index * 72) * Math.PI / 180
    return [cx + distance * Math.cos(angle), cy + distance * Math.sin(angle)]
  }
  const polygon = (distance: number, className: string): string => `<polygon class="${className}" points="${axes.map((_, index) => point(index, distance).map((value) => value.toFixed(1)).join(',')).join(' ')}"></polygon>`
  const lines = axes.map((_, index) => {
    const [x, y] = point(index, radius)
    return `<line class="axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"></line>`
  }).join('')
  const shape = axes.map((axis, index) => point(index, radius * Math.min(hero.aptitudes[axis[1]] / max, 1)).map((value) => value.toFixed(1)).join(',')).join(' ')
  const dots = axes.map((axis, index) => {
    const [x, y] = point(index, radius * Math.min(hero.aptitudes[axis[1]] / max, 1))
    return `<circle class="dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4"></circle>`
  }).join('')
  const labels = axes.map(([label, key], index) => {
    const angle = -90 + index * 72
    const cosine = Math.cos(angle * Math.PI / 180)
    const anchor = Math.abs(cosine) < 0.2 ? 'middle' : cosine > 0 ? 'start' : 'end'
    const [x, y] = point(index, radius + 18)
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${label} ${hero.aptitudes[key]}</text>`
  }).join('')
  return `<svg class="formation-radar" width="200" height="190" viewBox="0 0 200 190" role="img" aria-label="${escapeHtml(hero.name)}五维资质"><polygon class="ring" points="${axes.map((_, index) => point(index, radius / 3).map((value) => value.toFixed(1)).join(',')).join(' ')}"></polygon>${polygon(radius * 2 / 3, 'ring')} ${polygon(radius, 'ring outer')}${lines}<polygon class="shape" points="${shape}"></polygon>${dots}${labels}</svg>`
}

const renderCareerPath = (hero: FormationHeroView): string => `<div class="formation-career-path">${hero.careerPath.map((career, index) => `${index ? '<span class="formation-career-arrow">›</span>' : ''}<span class="formation-career-node ${career.state}">${escapeHtml(career.name)}</span>`).join('')}</div>`

const renderMartials = (hero: FormationHeroView): string => `${hero.equippedMartials.map((martial, index) => martial
  ? `<span class="formation-martial-chip"><small>武学 ${positionNames[index] ?? '肆'}</small>${escapeHtml(martial.name)}<em>${escapeHtml(martial.rarity)} · Lv.${martial.level}</em></span>`
  : `<span class="formation-martial-chip empty"><small>武学 ${positionNames[index] ?? '肆'}</small>虚位</span>`).join('')}${hero.heartMethodName
  ? `<span class="formation-martial-chip heart"><small>心法</small>${escapeHtml(hero.heartMethodName)}</span>`
  : '<span class="formation-martial-chip heart empty"><small>心法</small>未装备心法</span>'}`

const renderHeroCard = (view: FormationPageViewModel): string => {
  const hero = heroAt(view, view.selectedHeroId)
  if (!hero) return `<aside class="formation-hero-card panel empty" data-testid="formation-hero-card"><span class="formation-card-corner"></span><div class="formation-card-empty"><b>帖</b><span>点选名册侠客 · 览其身手帖</span></div></aside>`
  const slotText = hero.slot ? `${rowNames[hero.slot.row]}·${positionNames[hero.slot.position]}位` : '未在阵中'
  return `<aside class="formation-hero-card panel" data-testid="formation-hero-card">
    <span class="formation-card-corner" aria-hidden="true"></span>
    <div class="formation-hero-head">${renderPortrait(hero, 'formation-card-portrait')}${renderGradeSeal(hero)}<div><small>${escapeHtml(hero.source)} · ${escapeHtml(hero.category)}门</small><h2>${escapeHtml(hero.name)}</h2><p>侠客 · 行走江湖</p></div><span class="formation-level-badge"><b>${hero.level}</b><i>等级</i></span></div>
    <div class="formation-hero-fit"><b>宜</b><span>${escapeHtml(fitText[hero.category] ?? '身随阵势，择位而行。')}</span></div>
    <div class="formation-card-title">五维禀赋</div>
    ${renderRadar(hero)}
    <div class="formation-card-title">职业进境 <small>职业 Lv.${hero.careerLevel}</small></div>
    ${renderCareerPath(hero)}
    <div class="formation-card-title">随身武学</div>
    <div class="formation-martials">${renderMartials(hero)}</div>
    <div class="formation-card-foot"><span>现居 <b>${escapeHtml(slotText)}</b></span>${hero.slot ? `<button type="button" class="formation-btn-line" data-action="formation-remove" data-hero-id="${escapeHtml(hero.id)}">遣其下阵</button>` : ''}</div>
  </aside>`
}

const formationSynergies = (view: FormationPageViewModel): FormationSynergyView[] => {
  const heroes = placedHeroes(view)
  const counts = heroes.reduce<Record<string, number>>((result, hero) => {
    result[hero.category] = (result[hero.category] ?? 0) + 1
    return result
  }, {})
  return synergyDefinitions.map((synergy) => {
    const needs = synergy.need.map(([category, required]) => {
      const current = category === '满员' ? heroes.length : counts[category] ?? 0
      return { label: categoryLabel(category), required, current, met: current >= required }
    })
    return { ...synergy, needs, active: needs.every((need) => need.met) }
  })
}

const displayPower = (heroes: FormationHeroView[]): number => heroes.reduce((total, hero) => {
  const stats = hero.combatStats
  return total + Math.round(
    stats.maxHp * 0.5
    + (stats.externalAttack + stats.internalAttack) * 4
    + (stats.externalDefense + stats.internalDefense) * 3
    + stats.effectiveAgility * 2,
  )
}, 0)

const renderSynergy = (view: FormationPageViewModel): string => {
  const synergies = formationSynergies(view)
  const active = synergies.filter((synergy) => synergy.active).length
  return `<section class="formation-synergy" aria-label="阵势">
    <header class="formation-synergy-head"><div><h2>阵势</h2><span>同气相求 · 其势自生</span></div><small>已激发 <b>${active}</b> / ${synergies.length}</small></header>
    <div class="formation-synergy-grid">${synergies.map((synergy) => `<article class="formation-synergy-card${synergy.active ? ' active' : ''}" data-testid="formation-synergy-${escapeHtml(synergy.id)}"><div class="formation-synergy-node"></div><div class="formation-synergy-body"><h3>${escapeHtml(synergy.name)}</h3><div class="formation-synergy-needs">${synergy.needs.map((need) => `<span class="${need.met ? 'met' : ''}">${escapeHtml(need.label)} ${Math.min(need.current, need.required)}/${need.required}</span>`).join('')}</div><p>${escapeHtml(synergy.effect)}</p><b class="formation-synergy-state">${synergy.active ? '已激发' : '未竟'}</b></div></article>`).join('')}</div>
  </section>`
}

export const renderFormationPage = (view: FormationPageViewModel): string => {
  const heroesInFormation = placedHeroes(view)
  const synergies = formationSynergies(view)
  return `<section class="formation-page" data-testid="formation-page">
    <span class="formation-ghost formation-ghost-array" aria-hidden="true">陣</span><span class="formation-ghost formation-ghost-muster" aria-hidden="true">將</span>
    <header class="formation-page-head"><div><p class="formation-crumb">蛋蛋江湖 2.0 <b>/</b> 阵容 · 演武点将</p><h1>阵容</h1><span>FORMATION · MUSTER AT THE ARENA</span></div><div class="formation-stats" aria-label="队伍概览"><div><b>${formatNumber(displayPower(heroesInFormation))}</b><small>队伍战力</small></div><div><b><i>${heroesInFormation.length}</i>/6</b><small>上阵侠客</small></div><div class="accent"><b>${synergies.filter((synergy) => synergy.active).length}</b><small>阵势激发</small></div></div></header>
    <div class="formation-muster-layout">${renderRoster(view)}${renderFormationField(view)}${renderHeroCard(view)}</div>
    ${renderSynergy(view)}
    <footer class="formation-page-foot"><span><b>阵容页高保真重设计</b> · 蛋蛋江湖 2.0 · 演武点将</span><span>阵势仅作队伍搭配预览，不改变战斗数值</span></footer>
  </section>`
}
