import { escapeHtml } from './html'
import { panelToAttributeMap, type CombatStats } from '../combat/stats'
import { ATTRIBUTES, type AttributeMap } from '../content/attributes'
import { EQUIPMENT_QUALITIES, EQUIPMENT_SLOTS, EQUIPMENT_SLOT_MARKS, EQUIPMENT_SLOT_NAMES, type EquipmentSlot } from '../content/equipment'
import type { EquipmentQuality } from '../domain/types'
import type { HeroAptitudes } from '../content/heroes'
import { careerIconAsset } from './career-icon-assets'
import { equipmentIconAsset } from './equipment-icon-assets'
import { heroPortraitAsset } from './portrait-assets'
import type { InventoryItemView } from './inventory-page'

export interface CareerGrowthView {
  id: string
  label: string
  grade: string
  coeff: string
}

export interface LearnedCareerView {
  id: string
  name: string
  level: number
  current: boolean
}

export interface CareerTreeNodeView {
  id: string
  name: string
  rank: 1 | 2 | 3 | 4 | 5 | 6
  indexInRank: number
  rankCount: number
  tier: string
  learned: boolean
  current: boolean
  selected: boolean
}

export interface CareerTreeLinkView {
  fromId: string
  toId: string
}

export interface CareerTreeDetailView {
  id: string
  name: string
  description: string
  tier: string
  skillTypeNames: string[]
  growth: CareerGrowthView[]
  requirements: Array<{ name: string; requiredLevel: number; currentLevel: number; met: boolean }>
  bookName: string
  bookOwned: boolean
  learned: boolean
  current: boolean
  actionLabel: string
  actionDisabled: boolean
}

export interface HeroesHeroView {
  id: string
  name: string
  grade: string
  recruited: boolean
  level: number
  careerId: string
  careerName: string
  careerLevel: number
  careerTier: string
  skillTypeNames: string[]
  growth: CareerGrowthView[]
  careerExperience: number
  careerExperienceRequired: number
  careerMaxed: boolean
  learnedCareers: LearnedCareerView[]
  aptitudes: HeroAptitudes
  combatStats: CombatStats
  category?: string
  source?: string
  inFormation?: boolean
}

export interface HeroEquipmentSlotView {
  slot: EquipmentSlot
  item: InventoryItemView | null
}

export interface HeroesEquipmentView {
  heroId: string
  setIndex: 0 | 1 | 2
  averageItemLevel: number
  wornCount: number
  slots: HeroEquipmentSlotView[]
}

export interface HeroesPackItemView extends InventoryItemView {
  ownerName: string | null
  current: boolean
  occupied: boolean
}

export interface HeroesPackView {
  capacity: number
  itemCount: number
  slotFilter: 'all' | EquipmentSlot
  qualityFilter: 'all' | EquipmentQuality
  page: number
  pageCount: number
  items: HeroesPackItemView[]
  batchOpen: boolean
  batchQuality: EquipmentQuality | 'all'
  batchCount: number
}

export interface HeroesPageViewModel {
  selectedHeroId: string | null
  heroes: HeroesHeroView[]
  rosterHeroes?: HeroesHeroView[]
  rosterQuery?: string
  rosterGradeFilter?: string
  rosterCategoryFilter?: string
  careerTreeOpen: boolean
  treeNodes: CareerTreeNodeView[]
  treeLinks: CareerTreeLinkView[]
  treeDetail: CareerTreeDetailView | null
  equipment: HeroesEquipmentView | null
  pack: HeroesPackView | null
}

const ROSTER_GRADES = ['all', '丙', '乙', '甲', '地', '天'] as const
const ROSTER_CATEGORIES = ['all', '剑', '刀', '拳', '暗', '医', '内家'] as const
const CATEGORY_LABELS: Record<string, string> = {
  剑: '剑之脉',
  刀: '刀之脉',
  拳: '拳之脉',
  暗: '暗之脉',
  医: '医之脉',
  内家: '内家之脉',
}
const TREE_RANKS: Array<1 | 2 | 3 | 4 | 5 | 6> = [6, 5, 4, 3, 2, 1]

const formatNumber = (value: number): string => Number.isInteger(value) ? String(value) : value.toFixed(1)

const statMarks: Record<string, string> = {
  臂力: '力', 悟性: '悟', 体魄: '骨', 身法: '身', 定力: '心',
  生命: '♥', 速度: '影', 物攻: '剑', 物防: '盾', 法攻: '气', 法防: '甲',
  暴击几率: '暴', 暴击伤害: '破', 物理增伤: '攻', 法术增伤: '法', 普攻增伤: '拳', 最终增伤: '终', 吸血: '血',
  物理减伤: '减', 法术减伤: '御', 最终减伤: '护', 命中修正: '羽', 闪避修正: '闪',
  初始能量: '✣', 能量回复: '◉', 技能冷却: '冷', 技能学习: '学',
}

const aptitudeKeys: Array<{ key: keyof HeroAptitudes; label: string }> = [
  { key: 'strength', label: '臂力' },
  { key: 'insight', label: '悟性' },
  { key: 'constitution', label: '体魄' },
  { key: 'agility', label: '身法' },
  { key: 'resolve', label: '定力' },
]

const formatStatValue = (value: string | number): string => typeof value === 'number' ? formatNumber(value) : value

const radarPoint = (index: number, radius: number): [number, number] => {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / aptitudeKeys.length
  return [118 + Math.cos(angle) * radius, 118 + Math.sin(angle) * radius]
}

const renderAptitudeRadar = (aptitudes: HeroAptitudes): string => {
  const rings = [22, 44, 66, 88].map((radius, index) =>
    `<polygon class="radar-ring${index === 3 ? ' outer' : ''}" points="${aptitudeKeys.map((_, pointIndex) => radarPoint(pointIndex, radius).map((value) => value.toFixed(1)).join(',')).join(' ')}"></polygon>`).join('')
  const axes = aptitudeKeys.map((_, index) => {
    const [x, y] = radarPoint(index, 88)
    return `<line class="radar-axis" x1="118" y1="118" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"></line>`
  }).join('')
  const values = aptitudeKeys.map(({ key }) => Math.min(22, aptitudes[key]))
  const shape = values.map((value, index) => radarPoint(index, (value / 22) * 88).map((point) => point.toFixed(1)).join(',')).join(' ')
  const dots = values.map((value, index) => {
    const [x, y] = radarPoint(index, (value / 22) * 88)
    return `<circle class="radar-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2"></circle>`
  }).join('')
  const labels = aptitudeKeys.map(({ key, label }, index) => {
    const [x, y] = radarPoint(index, 108)
    return `<text class="radar-label apt-label" data-apt-label="${escapeHtml(label)}" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${label}<tspan class="radar-value" dx="4">${aptitudes[key]}</tspan></text>`
  }).join('')
  return `<svg class="radar-svg" viewBox="0 0 236 236" role="img" aria-label="五维根骨资质">${rings}${axes}<polygon class="radar-shape" points="${shape}"></polygon>${dots}${labels}</svg>`
}

const renderCombatChip = (label: string, value: string | number, hot = false): string =>
  `<div class="st-chip${hot ? ' hot' : ''}" data-stat-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><i aria-hidden="true">${statMarks[label] ?? '◇'}</i><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(formatStatValue(value))}</dd></div>`

const formatAttr = (value: number, unit: string): string => {
  if (unit === '百分比') return `${formatNumber(value)}%`
  if (unit === '每秒') return `${formatNumber(value)}/s`
  return formatNumber(value)
}

const ATTR_TABS: Array<{ tab: string; label: string; cats: string[] }> = [
  { tab: 'basic', label: '基础', cats: ['核心', '能力'] },
  { tab: 'additive', label: '附加', cats: ['附加'] },
  { tab: 'special', label: '特殊', cats: ['特殊'] },
  { tab: 'element', label: '元素', cats: ['元素'] },
  { tab: 'mastery', label: '专精', cats: ['技能效果'] },
  { tab: 'weapon', label: '武器', cats: ['熟练伤害'] },
]
const ATTR_TAB_CATS = ATTR_TABS.flatMap((tab) => tab.cats)

const renderAttrChips = (cats: readonly string[], attrs: AttributeMap): string =>
  cats.map((cat) => {
    const items = ATTRIBUTES.filter((attribute) => attribute.category === cat)
    if (items.length === 0) return ''
    return `<div class="attr-group"><span class="attr-group-title">${escapeHtml(cat)}</span><div class="chips">${items.map((attribute) => renderCombatChip(attribute.name, formatAttr(attrs[attribute.id] ?? 0, attribute.unit))).join('')}</div></div>`
  }).join('')

const renderAccessibleHeroStats = (hero: HeroesHeroView): string => {
  const attrs = panelToAttributeMap(hero.combatStats, hero.aptitudes)
  const rows: Array<[string, string | number]> = [
    ...aptitudeKeys.map(({ key, label }) => [label, hero.aptitudes[key]] as [string, number]),
    ...ATTRIBUTES.filter((attribute) => ATTR_TAB_CATS.includes(attribute.category)).map((attribute) => [attribute.name, formatAttr(attrs[attribute.id] ?? 0, attribute.unit)] as [string, string]),
  ]
  return `<dl class="hero-stats-a11y" aria-label="侠客属性明细">${rows.map(([label, value]) => {
    const aptitude = aptitudeKeys.some(({ label: aptitudeLabel }) => aptitudeLabel === label)
    return `<div${aptitude ? ` data-stat-label="${escapeHtml(label)}"` : ''}><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(formatStatValue(value))}</dd></div>`
  }).join('')}</dl>`
}

const renderHeroPortrait = (hero: HeroesHeroView, className: string): string => {
  const portrait = heroPortraitAsset(hero.id, hero.category ?? '剑')
  return `<img class="${className}" src="${escapeHtml(portrait.url)}" data-portrait-source="${portrait.source}" alt="" aria-hidden="true" draggable="false">`
}

const renderHeroStats = (hero: HeroesHeroView): string => {
  const aptitudes = hero.aptitudes
  const attrs = panelToAttributeMap(hero.combatStats, aptitudes)
  const aptitudeTotal = aptitudeKeys.reduce((total, { key }) => total + aptitudes[key], 0)
  const uid = hero.id
  const radios = ATTR_TABS.map((tab, index) =>
    `<input type="radio" name="attrtab-${escapeHtml(uid)}" id="attrtab-${escapeHtml(uid)}-${tab.tab}" class="attr-tab-radio" data-attr-tab="${tab.tab}"${index === 0 ? ' checked' : ''}>`,
  ).join('')
  const labels = ATTR_TABS.map((tab) =>
    `<label for="attrtab-${escapeHtml(uid)}-${tab.tab}" class="attr-tab-label" data-attr-tab="${tab.tab}">${escapeHtml(tab.label)}</label>`,
  ).join('')
  const panels = ATTR_TABS.map((tab) =>
    `<div class="attr-panel" data-attr-tab="${tab.tab}">${renderAttrChips(tab.cats, attrs)}</div>`,
  ).join('')
  return `<section class="dossier-sec hero-stats-section" data-testid="hero-stats">
    <header><div class="sec-title"><h2>根骨资质</h2><span class="sub">其壹 · 五维天资 · <i>诸天属性 · 基础 / 附加 / 特殊 / 元素 / 专精 / 武器</i></span></div></header>
    <div class="sec-body aptitude-grid">
      <div class="radar-box">${renderAptitudeRadar(aptitudes)}<div class="radar-total"><b>${aptitudeTotal}</b><span>天资总和</span></div></div>
      <div class="combat-stats attr-tabs">
        <div class="attr-tab-bar">${radios}${labels}</div>
        <div class="attr-panels">${panels}</div>
        ${renderAccessibleHeroStats(hero)}
      </div>
    </div>
  </section>`
}

const renderGrowthGrid = (growth: CareerGrowthView[]): string =>
  `<div class="cg-grid">${growth.map((item) => `<div class="cg-cell" data-grade="${escapeHtml(item.grade)}"><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.grade)}</b><em>${escapeHtml(item.coeff)}</em></div>`).join('')}</div>`

const renderPrototypeHeroHead = (hero: HeroesHeroView): string => {
  const category = hero.category ?? '剑'
  const gradeLabel = hero.grade === '主' ? '天命主角' : hero.grade + '品侠客'
  return `<header class="dossier-head"><div class="dossier-head-inner">
    <span class="dh-ghost" aria-hidden="true">${escapeHtml(category)}</span><span class="hero-medallion" data-grade="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span>${renderHeroPortrait(hero, 'dh-portrait')}
    <div class="dh-main"><p class="dh-kicker">侠客列传 · <i>${escapeHtml(category)}之脉</i></p><h2 class="dh-name">${escapeHtml(hero.name)}</h2>
      <div class="dh-tags"><span class="dh-tag gold">${gradeLabel}</span><span class="dh-tag">${escapeHtml(category)}之脉系</span><span class="dh-tag">${escapeHtml(hero.source ?? '江湖行走')}</span></div>
    </div>
    <div class="dh-level"><small>侠客</small><b>Lv.${hero.level}</b><span class="dh-career">${escapeHtml(hero.careerName)}</span></div><span class="dh-vertical">侠之大者 · 为国为民</span>
  </div></header>`
}

const renderCurrentCareer = (hero: HeroesHeroView): string => {
  const required = Math.max(1, hero.careerExperienceRequired)
  const ratio = hero.careerMaxed ? 100 : Math.min(100, hero.careerExperience / required * 100)
  const xpText = hero.careerMaxed
    ? '已达上限'
    : `${hero.careerExperience} / ${hero.careerExperienceRequired}`
  const learned = hero.learnedCareers.map((career) =>
    `<li class="${career.current ? 'current' : ''}"><img src="${escapeHtml(careerIconAsset(career.id))}" alt="" aria-hidden="true" draggable="false"><span>${escapeHtml(career.name)}</span><b>Lv.${career.level}</b></li>`).join('')
  return `<section class="dossier-sec career-dossier" data-testid="hero-career-panel">
    <header><div class="sec-title"><h2>当前职业</h2><span class="sub">其贰 · ${escapeHtml(hero.careerTier)} · <i>${escapeHtml(hero.skillTypeNames.join(' / ') || '通用')}</i></span></div></header>
    <div class="sec-body">
      <div class="career-now">
        <img class="cn-icon" src="${escapeHtml(careerIconAsset(hero.careerId))}" alt="" aria-hidden="true" draggable="false">
        <div class="cn-copy">
          <span class="cn-tier">${escapeHtml(hero.careerTier)}</span>
          <strong class="cn-name">${escapeHtml(hero.careerName)}</strong>
          <span class="cn-lv">职业 <b>Lv.${hero.careerLevel}</b></span>
        </div>
        <div class="cn-xp"><span>${xpText}</span><span class="cn-bar" aria-hidden="true"><i style="width:${ratio.toFixed(1)}%"></i></span></div>
      </div>
      <div class="cn-skills">可用技能类型 · <b>${escapeHtml(hero.skillTypeNames.join('、') || '通用')}</b></div>
      ${renderGrowthGrid(hero.growth)}
      <div class="learned-careers">
        <div class="lc-head"><span>已修职业</span><b>${hero.learnedCareers.length}</b></div>
        <ul>${learned}</ul>
      </div>
      <div class="career-actions"><button type="button" class="btn-career-tree" data-action="open-career-tree" data-hero-id="${escapeHtml(hero.id)}" data-testid="open-career-tree">转职</button></div>
    </div>
  </section>`
}

const treePoint = (node: CareerTreeNodeView): { x: number; y: number } => ({
  x: (node.indexInRank + 0.5) / node.rankCount * 1000,
  y: (6 - node.rank + 0.5) / 6 * 600,
})

const renderCareerTreeOverlay = (hero: HeroesHeroView, view: HeroesPageViewModel): string => {
  if (!view.careerTreeOpen) return ''
  const byId = new Map(view.treeNodes.map((node) => [node.id, node]))
  const lines = view.treeLinks.flatMap((link) => {
    const from = byId.get(link.fromId)
    const to = byId.get(link.toId)
    if (!from || !to) return []
    const start = treePoint(from)
    const end = treePoint(to)
    return [`<line x1="${start.x.toFixed(1)}" y1="${start.y.toFixed(1)}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}"></line>`]
  }).join('')
  const ranks = TREE_RANKS.map((rank) => {
    const nodes = view.treeNodes.filter((node) => node.rank === rank)
    const cells = nodes.map((node) => `<button type="button" class="ct-node${node.current ? ' current' : ''}${node.learned ? ' learned' : ''}${node.selected ? ' selected' : ''}" data-action="select-career-node" data-career-id="${escapeHtml(node.id)}" data-testid="career-node-${escapeHtml(node.id)}"><img src="${escapeHtml(careerIconAsset(node.id))}" alt="" aria-hidden="true" draggable="false"><strong>${escapeHtml(node.name)}</strong><small>${escapeHtml(node.tier)}</small></button>`).join('')
    return `<div class="ct-rank" data-rank="${rank}" style="--ct-count:${nodes.length || 1}">${cells}</div>`
  }).join('')
  const detail = view.treeDetail
  const requirements = detail?.requirements.map((item) =>
    `<li class="${item.met ? 'ok' : 'no'}">${escapeHtml(item.name)} Lv.${item.requiredLevel}<small>已修 ${item.currentLevel}</small></li>`).join('') ?? ''
  const detailHtml = detail
    ? `<aside class="ct-detail" data-testid="career-tree-detail">
        <img src="${escapeHtml(careerIconAsset(detail.id))}" alt="" aria-hidden="true" draggable="false">
        <span class="ct-tier">${escapeHtml(detail.tier)}</span>
        <h3>${escapeHtml(detail.name)}</h3>
        <p>${escapeHtml(detail.description)}</p>
        <div class="ct-skills">技能类型 · ${escapeHtml(detail.skillTypeNames.join('、'))}</div>
        ${renderGrowthGrid(detail.growth)}
        <div class="ct-reqs"><span>前置</span><ul>${requirements || '<li class="ok">无前置</li>'}</ul></div>
        <div class="ct-book">${escapeHtml(detail.bookName)} · ${detail.learned ? '已修' : detail.bookOwned ? '已持有' : '未持有'}</div>
        <button type="button" class="ct-action${detail.learned && !detail.current ? ' switch' : ''}" data-action="career-change" data-hero-id="${escapeHtml(hero.id)}" data-career-id="${escapeHtml(detail.id)}" data-testid="career-change" ${detail.actionDisabled ? 'disabled' : ''}>${escapeHtml(detail.actionLabel)}</button>
      </aside>`
    : '<aside class="ct-detail empty"><span>点选职业节点，查看转职条件</span></aside>'
  return `<div class="career-tree-overlay" data-testid="career-tree">
    <div class="career-tree-dialog" role="dialog" aria-modal="true" aria-labelledby="career-tree-title">
      <header>
        <div><p>转职 · ${escapeHtml(hero.name)}</p><h2 id="career-tree-title">职业树</h2></div>
        <button type="button" class="ct-close" data-action="close-career-tree" aria-label="关闭">收起</button>
      </header>
      <div class="ct-body">
        <div class="ct-tree">
          <svg class="ct-links" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
          ${ranks}
        </div>
        ${detailHtml}
      </div>
    </div>
  </div>`
}

const renderPrototypeRosterFilters = (view: HeroesPageViewModel): string => {
  const grade = view.rosterGradeFilter ?? 'all'
  const category = view.rosterCategoryFilter ?? 'all'
  const grades = ROSTER_GRADES.map((value) => `<button type="button" class="fchip seal${value !== 'all' ? ' g-' + value : ''}${grade === value ? ' active' : ''}" data-action="hero-roster-filter" data-filter-kind="grade" data-filter-value="${value}" aria-pressed="${grade === value}">${value === 'all' ? '全' : value}</button>`).join('')
  const categories = ROSTER_CATEGORIES.map((value) => `<button type="button" class="fchip${category === value ? ' active' : ''}" data-action="hero-roster-filter" data-filter-kind="category" data-filter-value="${value}" aria-pressed="${category === value}" title="${value === 'all' ? '全部脉系' : escapeHtml(CATEGORY_LABELS[value])}">${value === 'all' ? '全' : value === '内家' ? '内' : value}</button>`).join('')
  return '<div class="chip-row"><span class="chip-label">品级</span>' + grades + '</div><div class="chip-row"><span class="chip-label">脉系</span>' + categories + '</div>'
}

const renderPrototypeRoster = (view: HeroesPageViewModel): string => {
  const roster = view.rosterHeroes ?? view.heroes
  const player = roster.filter((hero) => hero.grade === '主')
  const groups: Array<{ label: string; heroes: HeroesHeroView[] }> = []
  if (player.length) groups.push({ label: '天命所归', heroes: player })
  ROSTER_CATEGORIES.slice(1).forEach((value) => {
    const heroes = roster.filter((hero) => hero.grade !== '主' && (hero.category ?? '剑') === value)
    if (heroes.length) groups.push({ label: CATEGORY_LABELS[value], heroes })
  })
  let rowIndex = 0
  const rows = groups.map((group) => `<div class="roster-ghead"><b>${escapeHtml(group.label)}</b><span class="gcount">${group.heroes.length} 人</span></div>${group.heroes.map((hero) => {
    const index = rowIndex++
    const source = hero.source ?? (hero.inFormation ? '在阵' : '江湖行走')
    return `<button type="button" class="roster-row${hero.id === view.selectedHeroId ? ' active' : ''}" data-action="select-hero" data-hero-id="${escapeHtml(hero.id)}" data-testid="hero-${escapeHtml(hero.id)}" style="--row-delay:${Math.min(index, 12) * 35}ms"><span class="r-face">${renderHeroPortrait(hero, 'r-portrait')}<span class="r-seal g-${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span></span><span class="r-body"><span class="r-name">${escapeHtml(hero.name)}</span><span class="r-meta">${escapeHtml(hero.careerName)} · Lv.${hero.level} · ${escapeHtml(source)}</span></span>${hero.id === view.selectedHeroId ? '<span class="r-flag">列传中</span>' : ''}</button>`
  }).join('')}`).join('')
  return rows || '<div class="roster-none">查无此侠</div>'
}

const renderEquipmentTooltip = (item: InventoryItemView, footer: string): string => `
  <div class="equipment-tooltip" popover="manual">
    <header>
      <span>${escapeHtml(item.slotName)}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <em>${escapeHtml(item.quality)} · Lv.${item.level}${item.weaponTypeName ? ` · ${escapeHtml(item.weaponTypeName)}` : ''}</em>
    </header>
    <div class="equipment-tooltip-columns">
      <section>
        <small>基础</small>
        <dl class="equipment-properties"><div><dt>${escapeHtml(item.baseStat.name)}</dt><dd>+${item.baseStat.value}</dd></div></dl>
      </section>
      ${item.affixes.length ? `<section>
        <small>词条</small>
        <dl class="equipment-properties">${item.affixes.map((affix) => `<div><dt>${escapeHtml(affix.name)}</dt><dd>+${affix.value}</dd></div>`).join('')}</dl>
      </section>` : ''}
    </div>
    <footer>${escapeHtml(footer)}</footer>
  </div>`

const renderEquipmentSection = (hero: HeroesHeroView, equipment: HeroesEquipmentView): string => {
  const slots = equipment.slots.map((entry) => {
    const item = entry.item
    const empty = !item
    const icon = equipmentIconAsset(entry.slot)
    return `<article class="pd-slot pd-pos-${entry.slot}${empty ? ' empty' : ' equipped hero-equipment-slot'}"
      ${item ? `data-rarity="${escapeHtml(item.quality)}" data-equipment-uid="${escapeHtml(item.uid)}"` : ''} data-slot="${entry.slot}">
      <span class="pd-icon">${EQUIPMENT_SLOT_MARKS[entry.slot]}</span>
      ${item ? `<img class="equipment-art" src="${escapeHtml(icon.url)}" alt="" aria-hidden="true">` : ''}
      <span class="pd-slot-name">${EQUIPMENT_SLOT_NAMES[entry.slot]}</span>
      <strong class="pd-item-name">${item ? escapeHtml(item.name) : '虚位以待'}</strong>
      <span class="pd-item-meta">${item ? `${escapeHtml(item.quality)} · Lv.${item.level}` : '未装备'}</span>
      ${item ? `<button type="button" class="pd-unequip" data-action="equipment-unequip" data-hero-id="${escapeHtml(hero.id)}" data-slot="${entry.slot}">卸下</button>` : ''}
      ${item ? renderEquipmentTooltip(item, hero.level < item.level ? `需人物 Lv.${item.level} 方可穿戴` : '双击行囊中物品，可替换此位') : ''}
    </article>`
  }).join('')
  return `<section class="dossier-sec" data-testid="hero-equipment-slots">
    <header><div class="sec-title"><h2>随身装备</h2><span class="sub">其贰 · 八部位 · <i>三套方案</i></span></div></header>
    <div class="sec-body pd-grid">
      <div class="pd-sil">
        <span class="sil-char">${escapeHtml(hero.category ?? '侠')}</span>
        <span class="sil-dantian" aria-hidden="true"></span>
        <div class="sil-sum"><span>穿戴 <b>${equipment.wornCount} / 8</b></span><span>均装等 <b>${equipment.averageItemLevel}</b></span></div>
        <span class="sil-cap">立身中正 · 气沉丹田</span>
      </div>
      ${slots}
      <div class="pd-sets">
        <div class="pd-ilvl">当前方案均装等 <b>${equipment.averageItemLevel}</b></div>
        <div class="pd-set-row">
          ${[0, 1, 2].map((index) => `<button type="button" class="pd-set-btn${equipment.setIndex === index ? ' active' : ''}"
            data-action="equipment-set-switch" data-hero-id="${escapeHtml(hero.id)}" data-set-index="${index}"
            data-testid="equipment-set-${index}">第${index + 1}套</button>`).join('')}
        </div>
        <p class="pd-set-hint">人物等级低于物品等级时不能穿戴</p>
      </div>
    </div>
  </section>`
}

const renderPackRail = (view: HeroesPageViewModel): string => {
  const pack = view.pack
  if (!pack) return ''
  const slotIds: Array<'all' | EquipmentSlot> = ['all', ...EQUIPMENT_SLOTS]
  const slotChips = slotIds.map((id) => id === 'all'
    ? `<button type="button" class="fchip${pack.slotFilter === 'all' ? ' active' : ''}" data-action="hero-pack-slot" data-inventory-slot="all">全</button>`
    : `<button type="button" class="fchip seal${pack.slotFilter === id ? ' active' : ''}" data-action="hero-pack-slot" data-inventory-slot="${id}" title="${EQUIPMENT_SLOT_NAMES[id]}">${EQUIPMENT_SLOT_MARKS[id]}</button>`).join('')
  const qualityChips = (['all', ...EQUIPMENT_QUALITIES] as const).map((quality) => quality === 'all'
    ? `<button type="button" class="fchip${pack.qualityFilter === 'all' ? ' active' : ''}" data-action="hero-pack-quality" data-filter-value="all">全</button>`
    : `<button type="button" class="fchip qc${pack.qualityFilter === quality ? ' active' : ''}" data-action="hero-pack-quality" data-filter-value="${quality}" style="--qc:var(--q-${quality})"><i></i>${quality[0]}</button>`).join('')
  const batchPanel = pack.batchOpen ? `<div class="batch-panel">
      <p class="bp-tip">择一品质为界，<b>含该品质以下</b>尽数丢弃；已装备与已锁定者不受影响。</p>
      <div class="chip-row">${EQUIPMENT_QUALITIES.map((quality) => `<button type="button" class="fchip danger qc${pack.batchQuality === quality ? ' active' : ''}" data-action="hero-batch-discard-filter" data-filter-value="${quality}" style="--qc:var(--q-${quality})"><i></i>${quality[0]}</button>`).join('')}</div>
      <p class="bp-count">${pack.batchQuality === 'all' ? '尚未择定品质' : `将丢弃 <b>${pack.batchCount}</b> 件装备`}</p>
      <div class="bp-btns">
        <button type="button" class="pc-yes" data-action="confirm-batch-discard" ${pack.batchQuality === 'all' || pack.batchCount === 0 ? 'disabled' : ''}>确认丢弃</button>
        <button type="button" class="pc-no" data-action="cancel-batch-discard">收手</button>
      </div>
    </div>` : ''
  const rows = pack.items.map((item, index) => `
    <button type="button" class="pack-row${item.current ? ' current' : item.occupied ? ' occupied' : ''}" data-quality="${escapeHtml(item.quality)}"
      data-equipment-uid="${escapeHtml(item.uid)}" data-testid="hero-pack-${escapeHtml(item.uid)}" style="--row-delay:${index * 35}ms"
      aria-label="${escapeHtml(item.name)}">
      <span class="pr-icon">${EQUIPMENT_SLOT_MARKS[item.slot]}</span>
      <span class="pr-body">
        <span class="pr-name">${escapeHtml(item.name)}${item.locked ? ' <span class="pack-lock">锁</span>' : ''}</span>
        <span class="pr-meta"><span class="pr-q">${escapeHtml(item.quality)}</span> · Lv.${item.level}${item.current ? ' · <span class="pr-owner">已装备</span>' : item.ownerName ? ` · <span class="pr-owner">${escapeHtml(item.ownerName)}</span>` : ''}</span>
      </span>
      <span class="pr-slot-tag">${escapeHtml(item.slotName)}</span>
      ${renderEquipmentTooltip(item, item.current ? '正穿于当前侠客' : item.ownerName ? `由 ${item.ownerName} 穿戴 · 双击仍可换装` : '双击左键，为当前侠客装备')}
    </button>`).join('')
  const pages = Array.from({ length: pack.pageCount }, (_, index) => index + 1)
  return `<aside class="pack-rail hero-inventory-panel" data-testid="hero-inventory-panel">
    <div class="pack-inner">
      <header class="pack-head">
        <div class="sec-title"><h2>行囊</h2></div>
        <div class="pack-cap">
          <div><b>${pack.itemCount}</b> <span>/ ${pack.capacity}</span></div>
          <div class="cap-bar"><i style="width:${Math.max(2, Math.min(100, pack.itemCount / pack.capacity * 100))}%"></i></div>
        </div>
      </header>
      <div class="pack-chips">
        <div class="chip-row"><span class="chip-label">部位</span>${slotChips}</div>
        <div class="chip-row"><span class="chip-label">品质</span>${qualityChips}</div>
      </div>
      <div class="pack-tool-btns">
        <button type="button" class="pk-btn" data-action="organize-hero-inventory">整理</button>
        <button type="button" class="pk-btn danger" data-action="request-batch-discard">${pack.batchOpen ? '收起丢弃' : '批量丢弃'}</button>
      </div>
      ${batchPanel}
      <div class="pack-list">${rows || '<div class="pack-empty"><strong>行囊空空</strong><span>调整筛选，或往江湖战斗获取</span></div>'}</div>
      <nav class="pack-page" aria-label="行囊分页">
        <button type="button" class="pg-btn" data-action="hero-pack-page" data-page="${pack.page - 1}" ${pack.page <= 1 ? 'disabled' : ''}>上一页</button>
        <div class="pg-nums">${pages.map((page) => `<button type="button" class="pg-num${page === pack.page ? ' active' : ''}" data-action="hero-pack-page" data-page="${page}">${page}</button>`).join('')}</div>
        <span class="pack-page-status">${pack.page}/${pack.pageCount} · ${pack.items.length}件</span>
        <button type="button" class="pg-btn" data-action="hero-pack-page" data-page="${pack.page + 1}" ${pack.page >= pack.pageCount ? 'disabled' : ''}>下一页</button>
      </nav>
      <footer class="pack-foot">悬停查看属性笺 · 双击为当前侠客装备</footer>
    </div>
  </aside>`
}

export const renderHeroesPage = (view: HeroesPageViewModel): string => {
  const selected = view.heroes.find((hero) => hero.id === view.selectedHeroId) ?? view.heroes[0]
  const rosterCount = (view.rosterHeroes ?? view.heroes).length
  const total = view.heroes.length
  return `<section class="heroes-page" data-testid="heroes-page">
    <span class="ghost-char ghost-roster" aria-hidden="true">侠</span>
    <span class="ghost-char ghost-pack" aria-hidden="true">囊</span>
    <header class="page-head heroes-page-head"><div><p class="crumb">侠客 · <b>点将谱</b> · 群侠列传</p><h1>侠客</h1><p class="latin">Heroes · The Roster &amp; Records</p></div></header>
    <div class="heroes-stage">
      <aside class="roster-rail hero-roster" data-testid="hero-roster-panel"><div class="roster-inner"><header class="roster-head"><div class="sec-title"><h2>点将谱</h2></div><div class="roster-head-right"><button type="button" class="btn-locate" data-action="locate-hero">定位</button><div class="roster-count"><b>${total}</b><span>${rosterCount === total ? '在队' : '筛中 / ' + total}</span></div></div></header>
        <div class="roster-search-row"><input type="search" class="roster-search" data-action="hero-roster-search" value="${escapeHtml(view.rosterQuery ?? '')}" placeholder="以名相寻…" autocomplete="off" aria-label="搜索侠客">${renderPrototypeRosterFilters(view)}</div>
        <div class="roster-list" data-testid="hero-roster-list">${renderPrototypeRoster(view)}</div><footer class="roster-foot">品级印 <b>丙乙甲地天</b> · 点将即阅其列传</footer>
      </div></aside>
      <section class="dossier hero-workbench" data-testid="selected-hero">${selected
        ? renderPrototypeHeroHead(selected) + renderHeroStats(selected) + (view.equipment ? renderEquipmentSection(selected, view.equipment) : '') + renderCurrentCareer(selected)
        : '<section class="dossier-sec hero-empty"><strong>尚无侠客</strong><span>前往城市酒馆直接邀请。</span></section>'}</section>
      ${renderPackRail(view)}
    </div>
    ${selected ? renderCareerTreeOverlay(selected, view) : ''}
    <footer class="page-foot heroes-page-foot"><span><b>侠客页</b> · 蛋蛋江湖 2.0 · 装备、职业与转职树</span><span>获取侠客请前往城市或势力</span></footer>
  </section>`
}
