import { escapeHtml } from './html'
import { panelToAttributeMap, type CombatStats } from '../combat/stats'
import { ATTRIBUTES, type AttributeMap } from '../content/attributes'
import {
  EQUIPMENT_QUALITIES,
  EQUIPMENT_QUALITY_NAMES,
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_MARKS,
  EQUIPMENT_SLOT_NAMES,
  type EquipmentSlot,
} from '../content/equipment'
import type { EquipmentQuality } from '../domain/types'
import type { HeroAptitudes } from '../content/heroes'
import { careerIconAsset } from './career-icon-assets'
import { equipmentIconAsset } from './equipment-icon-assets'
import { heroPortraitAsset } from './portrait-assets'
import heroStandFigure from '../assets/heroes/hero_stand.webp'
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

export type HeroesMainTab = 'basic' | 'equipment' | 'career'

export interface HeroesHeroView {
  id: string
  name: string
  grade: string
  recruited: boolean
  level: number
  experience: number
  experienceRequired: number
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
  slots: HeroEquipmentSlotView[]
}

export interface HeroesPackView {
  capacity: number
  itemCount: number
  slotFilter: 'all' | EquipmentSlot
  qualityFilter: 'all' | EquipmentQuality
  page: number
  pageCount: number
  items: InventoryItemView[]
  sellOpen: boolean
}

export interface HeroesPageViewModel {
  selectedHeroId: string | null
  mainTab: HeroesMainTab
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

const HERO_MAIN_TABS: Array<{ tab: HeroesMainTab; label: string }> = [
  { tab: 'basic', label: '基础' },
  { tab: 'equipment', label: '装备' },
  { tab: 'career', label: '职业' },
]

// 装备页槽位左右分列（对齐原版）：左 武器/头部/护腕/项链/至宝，右 副手/身体/足部/戒指
const EQUIP_LEFT_SLOTS: EquipmentSlot[] = ['weapon', 'head', 'wrist', 'necklace', 'treasure']
const EQUIP_RIGHT_SLOTS: EquipmentSlot[] = ['offhand', 'armor', 'boots', 'ring']

// 行囊右缘竖排部位筛选的显示字（对齐原版）
const PACK_STRIP_MARKS: Record<EquipmentSlot, string> = { ...EQUIPMENT_SLOT_MARKS, necklace: '链' }

const formatNumber = (value: number): string => Number.isInteger(value) ? String(value) : value.toFixed(1)
const formatExp = (value: number): string => Math.floor(value).toLocaleString('zh-CN')

const statMarks: Record<string, string> = {
  臂力: '力', 悟性: '悟', 体魄: '骨', 身法: '身', 定力: '心',
  生命: '♥', 速度: '影', 物攻: '剑', 物防: '盾', 法攻: '气', 法防: '甲',
  暴击几率: '暴', 暴击伤害: '破', 物理增伤: '攻', 法术增伤: '法', 普攻增伤: '拳', 最终增伤: '终', 吸血: '血',
  物理减伤: '减', 法术减伤: '御', 最终减伤: '护', 命中修正: '羽', 闪避修正: '闪',
  初始能量: '✣', 能量回复: '◉', 技能冷却: '冷', 技能学习: '学',
  驯兽等级: '驯', 管理等级: '管', 锻造等级: '锻', 修习等级: '修', 研究等级: '研',
  建造等级: '建', 商业等级: '商', 合成等级: '合', 计略等级: '计', 收藏等级: '藏',
}

const aptitudeKeys: Array<{ key: keyof HeroAptitudes; label: string; sub: string }> = [
  { key: 'strength', label: '臂力', sub: '勇' },
  { key: 'insight', label: '悟性', sub: '智' },
  { key: 'constitution', label: '体魄', sub: '体' },
  { key: 'agility', label: '身法', sub: '敏' },
  { key: 'resolve', label: '定力', sub: '精' },
]

// 五维天资评级字母（对齐原版资质评级风格）
const aptitudeGrade = (value: number): string =>
  value >= 22 ? 'S' : value >= 18 ? 'A' : value >= 14 ? 'B' : value >= 10 ? 'C' : 'D'

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

// 能力区对齐原版：名称 + Lv.N + 5 格历练印（ORIGINAL_ABILITY_MAX_LEVEL = 5），已修得的印点亮
const renderAbilityRows = (items: typeof ATTRIBUTES, attrs: AttributeMap): string =>
  `<div class="ability-grid">${items.map((attribute) => {
    const value = Math.max(0, Math.floor(attrs[attribute.id] ?? 0))
    const pips = Array.from({ length: 5 }, (_, index) =>
      `<i class="pip${index < value ? ' lit' : ''}" aria-hidden="true">${statMarks[attribute.name] ?? '◇'}</i>`,
    ).join('')
    return `<div class="ability-row${value === 0 ? ' zero' : ''}" data-stat-label="${escapeHtml(attribute.name)}" title="${escapeHtml(attribute.name)}"><span class="ab-name">${escapeHtml(attribute.name.replace(/等级$/, ''))}</span><span class="ab-lv">Lv.${value}</span><span class="ab-pips">${pips}</span></div>`
  }).join('')}</div>`

const renderAttrRows = (cats: readonly string[], attrs: AttributeMap): string =>
  cats.map((cat) => {
    const items = ATTRIBUTES.filter((attribute) => attribute.category === cat)
    if (items.length === 0) return ''
    if (cat === '能力') {
      return `<div class="attr-group"><span class="attr-group-title">${escapeHtml(cat)}</span>${renderAbilityRows(items, attrs)}</div>`
    }
    return `<div class="attr-group"><span class="attr-group-title">${escapeHtml(cat)}</span><div class="attr2-grid">${items.map((attribute) => {
      const value = attrs[attribute.id] ?? 0
      return `<div class="attr2${value === 0 ? ' zero' : ''}" data-stat-label="${escapeHtml(attribute.name)}" title="${escapeHtml(attribute.name)}"><i aria-hidden="true">${statMarks[attribute.name] ?? '◇'}</i><span class="an">${escapeHtml(attribute.name)}</span><span class="av">${escapeHtml(formatAttr(value, attribute.unit))}</span></div>`
    }).join('')}</div></div>`
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

const renderXpBar = (value: number, required: number, maxed: boolean, extraClass = ''): string => {
  const ratio = maxed ? 100 : Math.min(100, value / Math.max(1, required) * 100)
  return `<span class="bar${extraClass}" aria-hidden="true"><i style="width:${ratio.toFixed(1)}%"></i></span>`
}

const renderBasicTab = (hero: HeroesHeroView): string => {
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
    `<div class="attr-panel" data-attr-tab="${tab.tab}">${renderAttrRows(tab.cats, attrs)}</div>`,
  ).join('')
  const aptitudeRows = aptitudeKeys.map(({ key, label, sub }) =>
    `<div class="apt"><span class="an">${label}（${sub}）</span><span class="av">${aptitudes[key]}</span><span class="ag">${aptitudeGrade(aptitudes[key])}</span></div>`,
  ).join('')
  const careerXpText = hero.careerMaxed ? '已达上限' : `${formatExp(hero.careerExperience)} / ${formatExp(hero.careerExperienceRequired)}`
  return `<div class="hero-basic">
    <div class="hb-idrow">
      <div class="hb-idcard">
        ${renderHeroPortrait(hero, 'hb-portrait')}
        <div class="hb-idmain">
          <b class="hb-name">${escapeHtml(hero.name)}</b>
          <div class="hb-idtags"><span class="hero-medallion" data-grade="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span><span class="hb-cat">${escapeHtml(hero.category ?? '侠')}之脉系</span></div>
        </div>
      </div>
      <div class="hb-radar"><div class="radar-box">${renderAptitudeRadar(aptitudes)}<div class="radar-total"><b>${aptitudeTotal}</b><span>天资总和</span></div></div></div>
      <div class="hb-aptlist">${aptitudeRows}</div>
    </div>
    <div class="hb-growrow">
      <div class="hb-growline"><span class="gl-label">等级</span><b>Lv.${hero.level}</b>${renderXpBar(hero.experience, hero.experienceRequired, false)}<span class="gl-num">${formatExp(hero.experience)} / ${formatExp(hero.experienceRequired)}</span></div>
      <div class="hb-growline"><span class="gl-label">职业</span><b>${escapeHtml(hero.careerName)} Lv.${hero.careerLevel}</b>${renderXpBar(hero.careerExperience, hero.careerExperienceRequired, hero.careerMaxed, ' xp')}<span class="gl-num">${escapeHtml(careerXpText)}</span></div>
    </div>
    <div class="hb-attrs attr-tabs" data-testid="hero-stats">
      <div class="attr-tab-bar">${radios}${labels}</div>
      <div class="attr-panels">${panels}</div>
      ${renderAccessibleHeroStats(hero)}
    </div>
  </div>`
}

const renderGrowthGrid = (growth: CareerGrowthView[]): string =>
  `<div class="cg-grid">${growth.map((item) => `<div class="cg-cell" data-grade="${escapeHtml(item.grade)}"><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.grade)}</b><em>×${escapeHtml(item.coeff)}</em></div>`).join('')}</div>`

const renderCareerTab = (hero: HeroesHeroView): string => {
  const xpText = hero.careerMaxed
    ? '已达上限'
    : `${formatExp(hero.careerExperience)} / ${formatExp(hero.careerExperienceRequired)}`
  const learned = hero.learnedCareers.map((career) =>
    `<div class="hc-cell${career.current ? ' current' : ''}"><img src="${escapeHtml(careerIconAsset(career.id))}" alt="" aria-hidden="true" draggable="false"><b>${escapeHtml(career.name)}</b><small>Lv.${career.level}${career.current ? ' · 当前' : ''}</small></div>`).join('')
  return `<div class="hc-wrap" data-testid="hero-career-panel">
    <section class="hc-now">
      <div class="hc-title">当前职业<small>${escapeHtml(hero.careerTier)}</small></div>
      <div class="hc-main">
        <img class="hc-icon" src="${escapeHtml(careerIconAsset(hero.careerId))}" alt="" aria-hidden="true" draggable="false">
        <div class="hc-names"><b>${escapeHtml(hero.careerName)}</b><span>可用技能 · ${escapeHtml(hero.skillTypeNames.join('、') || '通用')}</span></div>
        <b class="hc-lv">Lv.${hero.careerLevel}</b>
      </div>
      ${renderGrowthGrid(hero.growth)}
      <div class="hc-xp"><span class="gl-label">经验</span>${renderXpBar(hero.careerExperience, hero.careerExperienceRequired, hero.careerMaxed, ' xp')}<span class="gl-num">${escapeHtml(xpText)}</span></div>
    </section>
    <section class="hc-learned">
      <div class="hc-title">已修职业<small>${hero.learnedCareers.length}</small></div>
      <div class="hc-grid">${learned || '<div class="hc-none">尚未修习任何职业</div>'}</div>
    </section>
    <footer class="hc-foot"><button type="button" class="btn-career-tree" data-action="open-career-tree" data-hero-id="${escapeHtml(hero.id)}" data-testid="open-career-tree">转职</button></footer>
  </div>`
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
  <div class="equipment-tooltip" popover="manual" data-rarity="${item.quality}">
    <header>
      <span>${escapeHtml(item.slotName)}${item.weaponTypeName ? ` · ${escapeHtml(item.weaponTypeName)}` : ''}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <em>品质 <b class="tt-q">${escapeHtml(EQUIPMENT_QUALITY_NAMES[item.quality])}</b> · 物品等级 Lv.${item.level} · 穿戴等级 Lv.${item.equipmentLevel}</em>
    </header>
    <div class="equipment-tooltip-columns">
      <section>
        <small>核心词条</small>
        <dl class="equipment-properties">${item.coreStats.map((core) => `<div><dt>${escapeHtml(core.name)} <i>(${core.rollPercent}%)</i></dt><dd>+${escapeHtml(core.formattedValue)}</dd></div>`).join('')}</dl>
      </section>
      ${item.affixes.length ? `<section>
        <small>附加词条</small>
        <dl class="equipment-properties">${item.affixes.map((affix) => `<div data-affix-grade="${affix.grade}"><dt>${escapeHtml(affix.name)} <i>[${affix.grade}]</i></dt><dd>+${escapeHtml(affix.formattedValue)}</dd></div>`).join('')}</dl>
      </section>` : ''}
    </div>
    <footer>${escapeHtml(footer)}</footer>
  </div>`

const renderEquipmentSlot = (hero: HeroesHeroView, entry: HeroEquipmentSlotView): string => {
  const item = entry.item
  const icon = equipmentIconAsset(entry.slot, item?.definitionId)
  return `<article class="eq-slot${item ? ' hero-equipment-slot' : ' empty'}"
    ${item ? `data-rarity="${item.quality}" data-equipment-uid="${escapeHtml(item.uid)}"` : ''} data-slot="${entry.slot}">
    <span class="eq-box">${item
      ? `<img class="equipment-art" src="${escapeHtml(icon.url)}" alt="" aria-hidden="true" draggable="false" data-equipment-icon-source="${icon.source}">`
      : `<span class="eq-mark" aria-hidden="true">${EQUIPMENT_SLOT_MARKS[entry.slot]}</span>`}</span>
    <span class="eq-slot-name">${EQUIPMENT_SLOT_NAMES[entry.slot]}</span>
    ${item ? `<button type="button" class="eq-unequip" data-action="equipment-unequip" data-hero-id="${escapeHtml(hero.id)}" data-slot="${entry.slot}" aria-label="卸下${escapeHtml(item.name)}">卸</button>` : ''}
    ${item ? renderEquipmentTooltip(item, hero.level < item.equipmentLevel ? `需人物 Lv.${item.equipmentLevel} 方可穿戴` : '双击行囊中物品，可替换此位') : ''}
  </article>`
}

const renderEquipmentTab = (hero: HeroesHeroView, equipment: HeroesEquipmentView): string => {
  const bySlot = new Map(equipment.slots.map((entry) => [entry.slot, entry]))
  const column = (slots: EquipmentSlot[]): string =>
    slots.map((slot) => renderEquipmentSlot(hero, bySlot.get(slot) ?? { slot, item: null })).join('')
  const gradeLabel = hero.grade === '主' ? '天命主角' : `${hero.grade}品侠客`
  return `<div class="hero-equip" data-testid="hero-equipment-slots">
    <header class="eq-head">
      <b class="eq-name">${escapeHtml(hero.name)}</b>
      <span class="eq-lv">Lv.${hero.level}</span>
      <span class="eq-sub">${escapeHtml(hero.careerName)} · ${escapeHtml(gradeLabel)}</span>
    </header>
    <div class="eq-wrap">
      <div class="eq-col">${column(EQUIP_LEFT_SLOTS)}</div>
      <div class="eq-stand">
        <img class="eq-figure-img" src="${escapeHtml(heroStandFigure)}" alt="" aria-hidden="true" draggable="false">
        <div class="eq-disc" aria-hidden="true"></div>
      </div>
      <div class="eq-col">${column(EQUIP_RIGHT_SLOTS)}</div>
    </div>
    <footer class="eq-foot">
      <div class="eq-sets">
        ${[0, 1, 2].map((index) => `<button type="button" class="eq-set-btn${equipment.setIndex === index ? ' active' : ''}"
          data-action="equipment-set-switch" data-hero-id="${escapeHtml(hero.id)}" data-set-index="${index}"
          data-testid="equipment-set-${index}">第${index + 1}套</button>`).join('')}
      </div>
      <span class="eq-hint">双击行囊物品直接换装 · 悬停槽位看详情</span>
    </footer>
  </div>`
}

const renderMainTabs = (view: HeroesPageViewModel, hero: HeroesHeroView): string => `
  <nav class="hero-htabs" aria-label="侠客资料分页">
    ${HERO_MAIN_TABS.map(({ tab, label }) => `<button type="button" class="htab${view.mainTab === tab ? ' active' : ''}" data-action="hero-main-tab" data-main-tab="${tab}" aria-pressed="${view.mainTab === tab}">${label}</button>`).join('')}
  </nav>
  <div class="hero-tab-panel" data-main-tab="basic"${view.mainTab === 'basic' ? '' : ' hidden'}>${renderBasicTab(hero)}</div>
  <div class="hero-tab-panel" data-main-tab="equipment"${view.mainTab === 'equipment' ? '' : ' hidden'}>${view.equipment ? renderEquipmentTab(hero, view.equipment) : ''}</div>
  <div class="hero-tab-panel" data-main-tab="career"${view.mainTab === 'career' ? '' : ' hidden'}>${renderCareerTab(hero)}</div>`

const renderPackRail = (view: HeroesPageViewModel): string => {
  const pack = view.pack
  if (!pack) return ''
  const slotIds: Array<'all' | EquipmentSlot> = ['all', ...EQUIPMENT_SLOTS]
  const strip = slotIds.map((id) => id === 'all'
    ? `<button type="button" class="strip-btn${pack.slotFilter === 'all' ? ' active' : ''}" data-action="hero-pack-slot" data-inventory-slot="all" title="全部">全</button>`
    : `<button type="button" class="strip-btn${pack.slotFilter === id ? ' active' : ''}" data-action="hero-pack-slot" data-inventory-slot="${id}" title="${EQUIPMENT_SLOT_NAMES[id]}">${PACK_STRIP_MARKS[id]}</button>`).join('')
  const qualityChips = (['all', ...EQUIPMENT_QUALITIES] as const).map((quality) => quality === 'all'
    ? `<button type="button" class="qchip${pack.qualityFilter === 'all' ? ' active' : ''}" data-action="hero-pack-quality" data-filter-value="all">全部</button>`
    : `<button type="button" class="qchip${pack.qualityFilter === quality ? ' active' : ''}" data-action="hero-pack-quality" data-filter-value="${quality}" style="--qc:var(--q-${quality})"><i></i>${EQUIPMENT_QUALITY_NAMES[quality]}</button>`).join('')
  const sellPanel = pack.sellOpen ? `<div class="sellpop">
      <div class="sp-title">按等阶售出<small>点档位立即售出 ≤ 该档的未装备物品</small></div>
      ${EQUIPMENT_QUALITIES.map((quality) => `<button type="button" class="sp-opt" data-action="hero-sell-quality" data-quality="${quality}" style="color:var(--q-${quality})">${EQUIPMENT_QUALITY_NAMES[quality]}及以下</button>`).join('')}
    </div>` : ''
  const cells = pack.items.map((item) => {
    const icon = equipmentIconAsset(item.slot, item.definitionId)
    return `
      <button type="button" class="pack-cell" data-quality="${item.quality}" style="--qc:var(--q-${item.quality})"
        data-equipment-uid="${escapeHtml(item.uid)}" data-testid="hero-pack-${escapeHtml(item.uid)}"
        aria-label="${escapeHtml(item.name)}">
        ${item.locked ? '<span class="pk-lock">锁</span>' : ''}
        <img src="${escapeHtml(icon.url)}" alt="" aria-hidden="true" draggable="false" data-equipment-icon-source="${icon.source}">
        <span class="pk-lv">Lv.${item.level}</span>
        ${renderEquipmentTooltip(item, '双击左键，为当前侠客装备')}
      </button>`
  }).join('')
  const pages = Array.from({ length: pack.pageCount }, (_, index) => index + 1)
  return `<aside class="pack-rail hero-inventory-panel" data-testid="hero-inventory-panel">
    <div class="pack-inner">
      <header class="pack-head">
        <div class="sec-title"><h2>行囊</h2><span class="sub">仅未装备</span></div>
        <div class="pack-cap"><b>${pack.itemCount}</b><span> / ${pack.capacity}</span></div>
      </header>
      <div class="pack-tool-btns">
        <button type="button" class="pk-btn" data-action="organize-hero-inventory">整理</button>
        <button type="button" class="pk-btn danger${pack.sellOpen ? ' active' : ''}" data-action="hero-sell-toggle">按等阶售出</button>
      </div>
      <div class="qchips">${qualityChips}</div>
      <div class="packbody">
        <div class="pack-grid">${cells || '<div class="pack-empty"><strong>行囊空空</strong><span>调整筛选，或往江湖战斗获取</span></div>'}</div>
        <div class="slotstrip">${strip}</div>
      </div>
      ${sellPanel}
      <nav class="pack-page" aria-label="行囊分页">
        <button type="button" class="pg-btn" data-action="hero-pack-page" data-page="${pack.page - 1}" ${pack.page <= 1 ? 'disabled' : ''}>‹</button>
        <div class="pg-nums">${pages.map((page) => `<button type="button" class="pg-num${page === pack.page ? ' active' : ''}" data-action="hero-pack-page" data-page="${page}">${page}</button>`).join('')}</div>
        <span class="pack-page-status">第 ${pack.page} / ${pack.pageCount} 页</span>
        <button type="button" class="pg-btn" data-action="hero-pack-page" data-page="${pack.page + 1}" ${pack.page >= pack.pageCount ? 'disabled' : ''}>›</button>
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
    <div class="heroes-stage">
      <aside class="roster-rail hero-roster" data-testid="hero-roster-panel"><div class="roster-inner"><header class="roster-head"><div class="sec-title"><h2>点将谱</h2></div><div class="roster-head-right"><button type="button" class="btn-locate" data-action="locate-hero">定位</button><div class="roster-count"><span>${rosterCount === total ? '在队' : '筛中'}</span><b>${rosterCount === total ? total : `${rosterCount} / ${total}`}</b></div></div></header>
        <div class="roster-search-row"><input type="search" class="roster-search" data-action="hero-roster-search" value="${escapeHtml(view.rosterQuery ?? '')}" placeholder="以名相寻…" autocomplete="off" aria-label="搜索侠客">${renderPrototypeRosterFilters(view)}</div>
        <div class="roster-list" data-testid="hero-roster-list">${renderPrototypeRoster(view)}</div><footer class="roster-foot">品级印 <b>丙乙甲地天</b> · 点将即阅其列传</footer>
      </div></aside>
      <section class="dossier hero-workbench" data-testid="selected-hero">${selected
        ? renderMainTabs(view, selected)
        : '<section class="dossier-sec hero-empty"><strong>尚无侠客</strong><span>前往城市酒馆直接邀请。</span></section>'}</section>
      ${renderPackRail(view)}
    </div>
    ${selected ? renderCareerTreeOverlay(selected, view) : ''}
    <footer class="page-foot heroes-page-foot"><span><b>侠客页</b> · 蛋蛋江湖 2.0 · 装备、职业与转职树</span><span>获取侠客请前往城市或势力</span></footer>
  </section>`
}
