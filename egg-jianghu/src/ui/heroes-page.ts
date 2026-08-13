import { escapeHtml } from './html'
import { panelToAttributeMap, type CombatStats } from '../combat/stats'
import { ATTRIBUTES, type AttributeMap } from '../content/attributes'
import { EQUIPMENT_QUALITIES, type EquipmentSlot } from '../content/equipment'
import type { HeroAptitudes } from '../content/heroes'
import type { EquipmentQuality } from '../domain/types'
import { equipmentIconAsset } from './equipment-icon-assets'
import { careerIconAsset, heartMethodIconAsset, martialIconAsset } from './career-icon-assets'
import { heroPortraitAsset } from './portrait-assets'

export interface HeroesEquipmentView {
  uid: string
  definitionId: string
  name: string
  slot: EquipmentSlot
  slotName: string
  level: number
  quality: EquipmentQuality
  locked: boolean
  equippedByHeroId: string | null
  equippedByHeroName: string | null
  baseStat: { name: string; value: number; percent: boolean }
  affixes: Array<{ name: string; value: number; percent: boolean }>
}

export interface HeroesEquipmentSlotView {
  id: EquipmentSlot
  name: string
  equipment: HeroesEquipmentView | null
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
  careerPerfected: boolean
  availableCareerIds: string[]
  aptitudes: HeroAptitudes
  combatStats: CombatStats
  equipmentSlots: HeroesEquipmentSlotView[]
  learnedMartials: Array<{ id: string; name: string; rarity: string; level: number }>
  equippedMartialIds: [string | null, string | null, string | null, string | null]
  heartMethodId: string | null
  category?: string
  source?: string
  inFormation?: boolean
  careerPath?: Array<{ name: string; state: 'done' | 'current' | 'future'; tier?: string }>
}

export interface HeroesCareerView {
  id: string
  name: string
  tier: string
  owned: boolean
  tokenOwned: boolean
}

export interface HeroesPageViewModel {
  selectedHeroId: string | null
  heroes: HeroesHeroView[]
  rosterHeroes?: HeroesHeroView[]
  rosterQuery?: string
  rosterGradeFilter?: string
  rosterCategoryFilter?: string
  careers: HeroesCareerView[]
  martials: Array<{ id: string; name: string; rarity: string; level: number; learned: boolean }>
  heartMethods: Array<{ id: string; name: string; equipped: boolean }>
  inventoryItems: HeroesEquipmentView[]
  inventoryCapacity: number
  inventorySlotFilter: EquipmentSlot | 'all'
  inventoryQualityFilter: EquipmentQuality | 'all'
  inventoryPage: number
  batchDiscardQuality: EquipmentQuality | 'all'
  batchDiscardConfirm: boolean
}

const HERO_INVENTORY_PAGE_SIZE = 8
const CN_NUMBERS = ['壹', '贰', '叁', '肆']
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
const SLOT_MARKS: Record<EquipmentSlot, string> = {
  weapon: '兵',
  head: '冠',
  armor: '甲',
  wrist: '腕',
  waist: '佩',
  boots: '履',
  token: '信',
}

const paginationWindow = (page: number, pageCount: number): number[] => {
  if (pageCount <= 3) return Array.from({ length: pageCount }, (_, index) => index + 1)
  if (page <= 2) return [1, 2, 3]
  if (page >= pageCount - 1) return [pageCount - 2, pageCount - 1, pageCount]
  return [page - 1, page, page + 1]
}

const formatNumber = (value: number): string => Number.isInteger(value) ? String(value) : value.toFixed(1)

const statMarks: Record<string, string> = {
  臂力: '力', 悟性: '悟', 体魄: '骨', 身法: '身', 定力: '心',
  // 诸天核心面板 sx6-11
  生命: '♥', 速度: '影', 物攻: '剑', 物防: '盾', 法攻: '气', 法防: '甲',
  // 诸天附加·输出 sx12-27
  暴击几率: '暴', 暴击伤害: '破', 物理增伤: '攻', 法术增伤: '法', 普攻增伤: '拳', 最终增伤: '终', 吸血: '血',
  // 诸天附加·防御
  物理减伤: '减', 法术减伤: '御', 最终减伤: '护', 命中修正: '羽', 闪避修正: '闪',
  // 诸天特殊·资源
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

/** 诸天角色面板标签页（对齐诸天真实 UI：基础/附加/特殊/元素/专精/武器）。 */
const ATTR_TABS: Array<{ tab: string; label: string; cats: string[] }> = [
  { tab: 'basic', label: '基础', cats: ['核心', '能力'] },
  { tab: 'additive', label: '附加', cats: ['附加'] },
  { tab: 'special', label: '特殊', cats: ['特殊'] },
  { tab: 'element', label: '元素', cats: ['元素'] },
  { tab: 'mastery', label: '专精', cats: ['技能效果'] },
  { tab: 'weapon', label: '武器', cats: ['熟练伤害'] },
]
const ATTR_TAB_CATS = ATTR_TABS.flatMap((t) => t.cats)

const renderAttrChips = (cats: readonly string[], attrs: AttributeMap): string =>
  cats.map((cat) => {
    const items = ATTRIBUTES.filter((a) => a.category === cat)
    if (items.length === 0) return ''
    return `<div class="attr-group"><span class="attr-group-title">${escapeHtml(cat)}</span><div class="chips">${items.map((a) => renderCombatChip(a.name, formatAttr(attrs[a.id] ?? 0, a.unit))).join('')}</div></div>`
  }).join('')

const renderAccessibleHeroStats = (hero: HeroesHeroView): string => {
  const attrs = panelToAttributeMap(hero.combatStats, hero.aptitudes)
  const rows: Array<[string, string | number]> = [
    ...aptitudeKeys.map(({ key, label }) => [label, hero.aptitudes[key]] as [string, number]),
    ...ATTRIBUTES.filter((a) => ATTR_TAB_CATS.includes(a.category)).map((a) => [a.name, formatAttr(attrs[a.id] ?? 0, a.unit)] as [string, string]),
  ]
  return `<dl class="hero-stats-a11y" aria-label="侠客属性明细">${rows.map(([label, value]) => {
    const aptitude = aptitudeKeys.some(({ label: aptitudeLabel }) => aptitudeLabel === label)
    return `<div${aptitude ? ` data-stat-label="${escapeHtml(label)}"` : ''}><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(formatStatValue(value))}</dd></div>`
  }).join('')}</dl>`
}

const renderEquipmentArt = (slot: EquipmentSlot, definitionId?: string): string => {
  const icon = equipmentIconAsset(slot, definitionId)
  return `<img class="equipment-art" src="${escapeHtml(icon.url)}" data-slot-art="${slot}" data-icon-source="${icon.source}" alt="" aria-hidden="true" draggable="false">`
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
  const radios = ATTR_TABS.map((t, i) =>
    `<input type="radio" name="attrtab-${escapeHtml(uid)}" id="attrtab-${escapeHtml(uid)}-${t.tab}" class="attr-tab-radio" data-attr-tab="${t.tab}"${i === 0 ? ' checked' : ''}>`,
  ).join('')
  const labels = ATTR_TABS.map((t) =>
    `<label for="attrtab-${escapeHtml(uid)}-${t.tab}" class="attr-tab-label" data-attr-tab="${t.tab}">${escapeHtml(t.label)}</label>`,
  ).join('')
  const panels = ATTR_TABS.map((t) =>
    `<div class="attr-panel" data-attr-tab="${t.tab}">${renderAttrChips(t.cats, attrs)}</div>`,
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

const renderEquipmentProperties = (item: HeroesEquipmentView): string => `<dl class="equipment-properties">
  <div><dt>${escapeHtml(item.baseStat.name)}</dt><dd>+${item.baseStat.value}${item.baseStat.percent ? '%' : ''}</dd></div>
  ${item.affixes.map((affix) => `<div><dt>${escapeHtml(affix.name)}</dt><dd>+${affix.value}${affix.percent ? '%' : ''}</dd></div>`).join('')}
</dl>`

const renderEquipmentTooltip = (item: HeroesEquipmentView, comparison: HeroesEquipmentView | null = null): string =>
  `<div class="equipment-tooltip" role="tooltip" popover="manual">
    <header><span>${escapeHtml(item.slotName)} · Lv.${item.level}</span><strong data-rarity="${escapeHtml(item.quality)}">${escapeHtml(item.name)}</strong><em>${escapeHtml(item.quality)}${item.locked ? ' · 已锁定' : ''}</em></header>
    <div class="equipment-tooltip-columns">
      <section><small>${comparison ? '当前查看' : '装备属性'}</small>${renderEquipmentProperties(item)}</section>
      ${comparison ? `<section class="equipment-compare"><small>当前穿戴</small><strong>${escapeHtml(comparison.name)}</strong>${renderEquipmentProperties(comparison)}</section>` : ''}
    </div>
    <footer>${item.equippedByHeroName ? `由 ${escapeHtml(item.equippedByHeroName)} 穿戴` : '双击左键或右键，为当前侠客装备'}</footer>
  </div>`

const renderInventoryPanel = (view: HeroesPageViewModel, selected: HeroesHeroView | undefined): string => {
  const filteredItems = view.inventoryItems.filter((item) =>
    (view.inventorySlotFilter === 'all' || item.slot === view.inventorySlotFilter)
    && (view.inventoryQualityFilter === 'all' || item.quality === view.inventoryQualityFilter))
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / HERO_INVENTORY_PAGE_SIZE))
  const page = Math.min(pageCount, Math.max(1, view.inventoryPage))
  const visibleItems = filteredItems.slice((page - 1) * HERO_INVENTORY_PAGE_SIZE, page * HERO_INVENTORY_PAGE_SIZE)
  const batchDiscardThreshold = view.batchDiscardQuality
  const batchDiscardCount = batchDiscardThreshold === 'all'
    ? 0
    : view.inventoryItems.filter((item) =>
        EQUIPMENT_QUALITIES.indexOf(item.quality) <= EQUIPMENT_QUALITIES.indexOf(batchDiscardThreshold)
        && !item.locked
        && !item.equippedByHeroId).length
  const availableSlots = selected?.equipmentSlots ?? []
  const slotChips = [
    `<button type="button" class="fchip${view.inventorySlotFilter === 'all' ? ' active' : ''}" data-action="hero-inventory-filter" data-filter-kind="slot" data-filter-value="all" aria-pressed="${view.inventorySlotFilter === 'all'}">全</button>`,
    ...availableSlots.map((slot) => `<button type="button" class="fchip seal${view.inventorySlotFilter === slot.id ? ' active' : ''}" data-action="hero-inventory-filter" data-filter-kind="slot" data-filter-value="${slot.id}" aria-pressed="${view.inventorySlotFilter === slot.id}" title="${escapeHtml(slot.name)}">${SLOT_MARKS[slot.id]}</button>`),
  ].join('')
  const qualityChips = [
    `<button type="button" class="fchip${view.inventoryQualityFilter === 'all' ? ' active' : ''}" data-action="hero-inventory-filter" data-filter-kind="quality" data-filter-value="all" aria-pressed="${view.inventoryQualityFilter === 'all'}">全</button>`,
    ...EQUIPMENT_QUALITIES.map((quality) => `<button type="button" class="fchip qc${view.inventoryQualityFilter === quality ? ' active' : ''}" data-action="hero-inventory-filter" data-filter-kind="quality" data-filter-value="${quality}" aria-pressed="${view.inventoryQualityFilter === quality}" style="--qc:var(--q-${quality})"><i aria-hidden="true"></i>${quality.slice(0, 1)}</button>`),
  ].join('')
  const batchChips = EQUIPMENT_QUALITIES.map((quality) => `<button type="button" class="fchip danger qc${view.batchDiscardQuality === quality ? ' active' : ''}" data-action="hero-batch-discard-filter" data-filter-value="${quality}" aria-pressed="${view.batchDiscardQuality === quality}" style="--qc:var(--q-${quality})"><i aria-hidden="true"></i>${quality.slice(0, 1)}</button>`).join('')
  const batchPanel = view.batchDiscardConfirm
    ? `<div class="batch-panel batch-discard-confirm" role="alertdialog" aria-label="确认批量丢弃">
        <p class="bp-tip">择一品质为界，<b>含该品质以下</b>尽数丢弃；<br>已装备与已锁定者不受影响。</p>
        <div class="chip-row">${batchChips}</div>
        <p class="bp-count">${batchDiscardThreshold === 'all' ? '尚未择定品质' : `将丢弃 <b>${batchDiscardCount}</b> 件装备`}<span class="legacy-batch-count">确认丢弃 ${batchDiscardCount} 件装备</span>${batchDiscardThreshold === 'all' ? '' : `<span>品质 ≤${escapeHtml(batchDiscardThreshold)}</span>`}</p>
        <div class="bp-btns"><button type="button" class="pc-yes danger" data-action="confirm-batch-discard" ${batchDiscardCount === 0 ? 'disabled' : ''}>确认丢弃</button><button type="button" class="pc-no" data-action="cancel-batch-discard" aria-label="取消">收手</button></div>
      </div>`
    : ''
  const legacySlotOptions = availableSlots.map((slot) => `<option value="${slot.id}" ${view.inventorySlotFilter === slot.id ? 'selected' : ''}>${escapeHtml(slot.name)}</option>`).join('')
  const legacyQualityOptions = EQUIPMENT_QUALITIES.map((quality) => `<option value="${quality}" ${view.inventoryQualityFilter === quality ? 'selected' : ''}>${quality}</option>`).join('')
  const legacyBatchOptions = EQUIPMENT_QUALITIES.map((quality) => `<option value="${quality}" ${view.batchDiscardQuality === quality ? 'selected' : ''}>${quality}</option>`).join('')
  const inventoryRows = visibleItems.map((item, index) => {
    const comparison = selected?.equipmentSlots.find((slot) => slot.id === item.slot)?.equipment ?? null
    const isSelectedHeroEquipment = item.equippedByHeroId === selected?.id
    const ownerNote = isSelectedHeroEquipment ? '已装备' : item.equippedByHeroName ?? ''
    const ownerMarkup = ownerNote ? ' · <span class="pr-owner">' + escapeHtml(ownerNote) + '</span>' : ''
    return '<button type="button" class="pack-row'
      + (isSelectedHeroEquipment ? ' current' : item.equippedByHeroId ? ' occupied' : '')
      + '" data-equipment-uid="' + escapeHtml(item.uid)
      + '" data-quality="' + escapeHtml(item.quality)
      + '" data-rarity="' + escapeHtml(item.quality)
      + '" data-testid="hero-inventory-item-' + escapeHtml(item.uid)
      + '" aria-label="查看 ' + escapeHtml(item.name)
      + '" style="--row-delay:' + Math.min(index, 12) * 35 + 'ms">'
      + '<span class="pr-icon" aria-hidden="true">' + SLOT_MARKS[item.slot] + '</span><span class="pr-body"><span class="pr-name">'
      + escapeHtml(item.name) + (item.locked ? '<small class="pack-lock">锁</small>' : '')
      + '</span><span class="pr-meta"><span class="pr-q">' + escapeHtml(item.quality) + '</span> · Lv.' + item.level + ownerMarkup
      + '</span></span><span class="pr-slot-tag">' + escapeHtml(item.slotName) + '</span>'
      + renderEquipmentTooltip(item, comparison?.uid === item.uid ? null : comparison)
      + '</button>'
  }).join('') || '<div class="pack-empty hero-inventory-empty"><strong>行囊空空</strong><span>调整筛选，或前往江湖战斗获取</span></div>'
  const paginationNumbers = paginationWindow(page, pageCount)
    .map((pageNumber) => `<button type="button" class="pg-num${pageNumber === page ? ' active' : ''}" data-action="hero-inventory-page" data-page="${pageNumber}" aria-current="${pageNumber === page ? 'page' : 'false'}">${pageNumber}</button>`).join('')
  const capacityPercent = view.inventoryCapacity <= 0 ? 0 : Math.min(100, view.inventoryItems.length / view.inventoryCapacity * 100)
  return `<aside class="pack-rail hero-inventory-panel" data-testid="hero-inventory-panel">
    <div class="pack-inner">
      <header class="pack-head">
        <div class="sec-title"><h2>行囊</h2></div>
        <div class="pack-cap"><div><b>${view.inventoryItems.length}</b><span> / ${view.inventoryCapacity}</span></div><div class="cap-bar"><i style="width:${capacityPercent.toFixed(1)}%"></i></div></div>
      </header>
      <div class="pack-chips">
        <div class="chip-row"><span class="chip-label">部位</span>${slotChips}</div>
        <div class="chip-row"><span class="chip-label">品质</span>${qualityChips}</div>
        <div aria-hidden="true"><select class="legacy-filter-select" data-hero-inventory-filter="slot" aria-label="部位筛选"><option value="all">全部部位</option>${legacySlotOptions}</select><select class="legacy-filter-select" data-hero-inventory-filter="quality" aria-label="品质筛选"><option value="all">全部品质</option>${legacyQualityOptions}</select><select class="legacy-filter-select" data-batch-discard-quality aria-label="批量丢弃品质"><option value="all">选择品质</option>${legacyBatchOptions}</select></div>
      </div>
      <div class="pack-tool-btns"><button type="button" class="pk-btn" data-action="organize-hero-inventory">整理</button><button type="button" class="pk-btn danger" data-action="request-batch-discard" aria-expanded="${view.batchDiscardConfirm}">${view.batchDiscardConfirm ? '收起丢弃' : '批量丢弃'}</button></div>
      ${batchPanel}
      <div class="pack-list hero-inventory-viewport"><div class="hero-inventory-list" data-testid="hero-inventory-list">${inventoryRows}</div></div>
      <nav class="pack-page" aria-label="行囊分页">
        <button type="button" class="pg-btn" data-action="hero-inventory-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
        <div class="pg-nums">${paginationNumbers}</div>
        <span class="pack-page-status">${page}/${pageCount} · ${visibleItems.length}件</span>
        <button type="button" class="pg-btn" data-action="hero-inventory-page" data-page="${page + 1}" ${page >= pageCount ? 'disabled' : ''}>下一页</button>
      </nav>
      <footer>悬停查看属性笺 · 双击为当前侠客装备</footer>
    </div>
  </aside>`
}

const renderPrototypeEquipmentSlots = (hero: HeroesHeroView): string => {
  const worn = hero.equipmentSlots.filter((slot) => slot.equipment).length
  const fine = hero.equipmentSlots.filter((slot) => slot.equipment && EQUIPMENT_QUALITIES.indexOf(slot.equipment.quality) >= 2).length
  const excellent = hero.equipmentSlots.filter((slot) => slot.equipment && EQUIPMENT_QUALITIES.indexOf(slot.equipment.quality) >= 3).length
  const slotHtml = (slot: HeroesEquipmentSlotView): string => {
    const item = slot.equipment
    const rarity = item ? ' data-rarity="' + escapeHtml(item.quality) + '"' : ''
    const itemName = item ? escapeHtml(item.name) : '虚位以待'
    const itemMeta = item ? escapeHtml(item.quality) + ' · Lv.' + item.level : '未装备'
    const action = item
      ? (item.locked ? '<span class="pd-lock">已锁</span>' : '') + '<button type="button" class="pd-unequip" data-action="equipment-unequip" data-hero-id="' + escapeHtml(hero.id) + '" data-slot="' + slot.id + '">卸下</button>' + renderEquipmentTooltip(item)
      : ''
    return `<article class="pd-slot hero-equipment-slot${item ? ' equipped' : ' empty'} pd-pos-${slot.id}" data-slot="${slot.id}"${rarity} data-testid="hero-equipment-slot-${slot.id}">
      <span class="pd-icon" aria-hidden="true">${SLOT_MARKS[slot.id]}</span><span class="pd-slot-name">${escapeHtml(slot.name)}</span>${renderEquipmentArt(slot.id, item?.definitionId)}<strong class="pd-item-name">${itemName}</strong><span class="pd-item-meta">${itemMeta}</span>${action}
    </article>`
  }
  return `<section class="dossier-sec equipment-dossier" data-testid="hero-equipment-slots">
    <header><div class="sec-title"><h2>随身装备</h2><span class="sub">其贰 · 七部位 · <i>悬停查看属性</i></span></div></header>
    <div class="sec-body pd-grid">
      <div class="pd-sil" aria-hidden="true"><span class="sil-char">${escapeHtml(hero.category ?? '侠')}</span><span class="sil-dantian"></span><div class="sil-sum"><span>穿戴 <b>${worn} / 7</b></span><span>精良 <b>${fine}</b></span></div><span class="sil-cap">立身中正 · 气沉丹田</span></div>
      ${hero.equipmentSlots.map(slotHtml).join('')}
      <div class="pd-extra"><div class="pe-row"><span>已穿戴</span><b>${worn} 件</b></div><div class="pe-row"><span>珍品以上</span><b>${excellent} 件</b></div><p class="pe-hint">悬停装备格查看属性笺<br>行囊物品双击即可穿戴</p></div>
    </div>
  </section>`
}

const renderPrototypeHeroHead = (hero: HeroesHeroView): string => {
  const category = hero.category ?? '剑'
  const gradeLabel = hero.grade === '主' ? '天命主角' : hero.grade + '品侠客'
  return `<header class="dossier-head"><div class="dossier-head-inner">
    <span class="dh-ghost" aria-hidden="true">${escapeHtml(category)}</span><span class="hero-medallion" data-grade="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span>${renderHeroPortrait(hero, 'dh-portrait')}
    <div class="dh-main"><p class="dh-kicker">侠客列传 · <i>${escapeHtml(category)}之脉</i></p><h2 class="dh-name">${escapeHtml(hero.name)}</h2>
      <div class="dh-tags"><span class="dh-tag gold">${gradeLabel}</span><span class="dh-tag">${escapeHtml(category)}之脉系</span><span class="dh-tag">${escapeHtml(hero.source ?? '江湖行走')}</span>${hero.careerPerfected ? '<span class="dh-tag hot">圆满心得已悟</span>' : ''}</div>
    </div>
    <div class="dh-level"><small>侠客</small><b>Lv.${hero.level}</b><span class="dh-career">${escapeHtml(hero.careerName)}</span></div><span class="dh-vertical">侠之大者 · 为国为民</span>
  </div></header>`
}

const renderPrototypeCareer = (hero: HeroesHeroView, view: HeroesPageViewModel): string => {
  const path = hero.careerPath?.length ? hero.careerPath : [{ name: hero.careerName, state: 'current' as const, tier: '当前职业' }]
  const category = hero.category ? hero.category + '之脉' : '职业一脉'
  const pathHtml = path.map((node) => `<div class="cp-node ${node.state}">
    <span class="cp-dot">${escapeHtml(node.name.slice(0, 1))}</span><span class="cp-tier">${escapeHtml(node.tier ?? (node.state === 'current' ? '当前阶段' : '职业进境'))}</span><span class="cp-name">${escapeHtml(node.name)}</span><span class="cp-lv">${node.state === 'current' ? '职业 ' : ''}${node.state === 'current' ? '<b>Lv.' + hero.careerLevel + '</b>' : node.state === 'done' ? '已历' : '未至'}</span>
  </div>`).join('')
  const options = view.careers.map((career) => `<article class="career-card"><img class="cc-icon" src="${escapeHtml(careerIconAsset(career.id))}" alt="" aria-hidden="true" draggable="false"><span class="cc-tier">${escapeHtml(career.tier)}</span><strong class="cc-name">${escapeHtml(career.name)}</strong><span class="cc-state ${career.owned ? 'ok' : career.tokenOwned ? 'token' : 'no'}">${career.owned ? '已解锁' : career.tokenOwned ? '信物已备' : '缺少信物'}</span><button type="button" class="cc-btn${career.owned ? ' switch' : ''}" data-action="career-change" data-hero-id="${escapeHtml(hero.id)}" data-career-id="${escapeHtml(career.id)}">${career.owned ? '切换' : '转职'}</button></article>`).join('')
  return `<section class="dossier-sec career-dossier"><header><div class="sec-title"><h2>职业进阶</h2><span class="sub">其叁 · ${escapeHtml(category)} · <i>圆满心得需职业 Lv.20</i></span></div></header>
    <div class="sec-body"><div class="career-path">${pathHtml}</div>
      <div class="career-strip"><span class="cs-label">当前职业</span><span class="cs-name">${escapeHtml(hero.careerName)}</span><span class="cs-lv">职业 <b>Lv.${hero.careerLevel}</b>${hero.careerLevel >= 20 ? ' · 已至圆满' : ''}</span><button type="button" class="btn-perfect${hero.careerPerfected ? ' done' : ''}" data-action="career-perfect" data-hero-id="${escapeHtml(hero.id)}" data-career-id="${escapeHtml(hero.careerId)}" ${hero.careerLevel < 20 || hero.careerPerfected ? 'disabled' : ''}>${hero.careerPerfected ? '圆满心得已领悟' : '领悟圆满心得'}</button></div>
      <div class="career-cards">${options || '<p class="career-empty">暂无可切换职业</p>'}</div>
    </div></section>`
}

const renderPrototypeMartials = (hero: HeroesHeroView, view: HeroesPageViewModel): string => {
  const slots = hero.equippedMartialIds.map((martialId, index) => {
    const martial = martialId ? view.martials.find((item) => item.id === martialId) : undefined
    return `<div class="mslot${martial ? '' : ' empty'}"${martial ? ' data-rarity="' + escapeHtml(martial.rarity) + '"' : ''}>
      <span class="ms-no">${CN_NUMBERS[index]}</span>${martial ? `<img class="ms-icon" src="${escapeHtml(martialIconAsset(martial.id))}" alt="" aria-hidden="true" draggable="false">` : ''}<div><span class="ms-name">${martial ? escapeHtml(martial.name) : '空槽'}</span><span class="ms-meta">第${CN_NUMBERS[index]}顺位 · ${martial ? escapeHtml(martial.rarity) + ' · Lv.' + martial.level : '虚位'}</span></div>${martialId ? '<button type="button" class="ms-unequip" data-action="martial-unequip" data-hero-id="' + escapeHtml(hero.id) + '" data-slot="' + index + '">卸下</button>' : ''}
    </div>`
  }).join('')
  const learned = hero.learnedMartials.map((martial) => {
    const equippedSlot = hero.equippedMartialIds.indexOf(martial.id)
    const slotButtons = [0, 1, 2, 3].map((slot) => `<button type="button" class="lc-btn slot-btn${equippedSlot === slot ? ' in' : ''}" data-action="martial-equip" data-hero-id="${escapeHtml(hero.id)}" data-martial-id="${escapeHtml(martial.id)}" data-slot="${slot}" title="装入第${CN_NUMBERS[slot]}槽">${slot + 1}</button>`).join('')
    return `<article class="learned-card" data-rarity="${escapeHtml(martial.rarity)}"><img class="lc-icon" src="${escapeHtml(martialIconAsset(martial.id))}" alt="" aria-hidden="true" draggable="false"><div><strong class="lc-name">${escapeHtml(martial.name)}</strong><div class="lc-meta"><span class="lc-rarity">${escapeHtml(martial.rarity)}</span><span>Lv.${martial.level}</span>${equippedSlot >= 0 ? '<span class="lc-equipped">已列第' + CN_NUMBERS[equippedSlot] + '槽</span>' : ''}</div></div>
      <div class="lc-actions"><button type="button" class="lc-btn" data-action="martial-upgrade" data-hero-id="${escapeHtml(hero.id)}" data-martial-id="${escapeHtml(martial.id)}">升级</button>${slotButtons}<button type="button" class="lc-btn danger" data-action="martial-forget" data-hero-id="${escapeHtml(hero.id)}" data-martial-id="${escapeHtml(martial.id)}">遗忘</button></div>
    </article>`
  }).join('') || '<p class="learned-empty">尚未习得武功</p>'
  return `<section class="dossier-sec martial-dossier"><header><div class="sec-title"><h2>四槽武功</h2><span class="sub">其肆 · 出战四式 · <i>按顺位出手</i></span></div></header><div class="sec-body martial-layout"><div><div class="martial-slots">${slots}</div><p class="slots-hint">战斗中自第壹槽起依序施展；<br>高顺位宜放真气充裕之快招。</p></div><div class="learned-list">${learned}</div></div></section>`
}

const renderPrototypeHearts = (hero: HeroesHeroView, view: HeroesPageViewModel): string =>
  `<section class="dossier-sec heart-dossier"><header><div class="sec-title"><h2>主修心法</h2><span class="sub">其伍 · 择一而修 · <i>行气之根本</i></span></div></header><div class="sec-body heart-row">${view.heartMethods.map((method) => '<button type="button" class="heart-pill' + (method.equipped ? ' active' : '') + '" data-action="heart-method-equip" data-hero-id="' + escapeHtml(hero.id) + '" data-heart-method-id="' + escapeHtml(method.id) + '">' + '<img class="heart-icon" src="' + escapeHtml(heartMethodIconAsset(method.id)) + '" alt="" aria-hidden="true" draggable="false">' + escapeHtml(method.name) + (method.equipped ? '<small>主修中</small>' : '') + '</button>').join('') || '<span class="heart-empty">尚无可用心法</span>'}</div></section>`

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

export const renderHeroesPage = (view: HeroesPageViewModel): string => {
  const selected = view.heroes.find((hero) => hero.id === view.selectedHeroId) ?? view.heroes[0]
  const rosterCount = (view.rosterHeroes ?? view.heroes).length
  const total = view.heroes.length
  return `<section class="heroes-page" data-testid="heroes-page">
    <span class="ghost-char ghost-roster" aria-hidden="true">侠</span><span class="ghost-char ghost-martial" aria-hidden="true">武</span><span class="ghost-char ghost-pack" aria-hidden="true">囊</span>
    <header class="page-head heroes-page-head"><div><p class="crumb">侠客 · <b>点将谱</b> · 群侠列传</p><h1>侠客</h1><p class="latin">Heroes · The Roster &amp; Records</p></div></header>
    <div class="heroes-stage">
      <aside class="roster-rail hero-roster" data-testid="hero-roster-panel"><div class="roster-inner"><header class="roster-head"><div class="sec-title"><h2>点将谱</h2></div><div class="roster-head-right"><button type="button" class="btn-locate" data-action="locate-hero">定位</button><div class="roster-count"><b>${total}</b><span>${rosterCount === total ? '在队' : '筛中 / ' + total}</span></div></div></header>
        <div class="roster-search-row"><input type="search" class="roster-search" data-action="hero-roster-search" value="${escapeHtml(view.rosterQuery ?? '')}" placeholder="以名相寻…" autocomplete="off" aria-label="搜索侠客">${renderPrototypeRosterFilters(view)}</div>
        <div class="roster-list" data-testid="hero-roster-list">${renderPrototypeRoster(view)}</div><footer class="roster-foot">品级印 <b>丙乙甲地天</b> · 点将即阅其列传</footer>
      </div></aside>
      <section class="dossier hero-workbench" data-testid="selected-hero">${selected ? renderPrototypeHeroHead(selected) + renderHeroStats(selected) + renderPrototypeEquipmentSlots(selected) + renderPrototypeCareer(selected, view) + renderPrototypeMartials(selected, view) + renderPrototypeHearts(selected, view) : '<section class="dossier-sec hero-empty"><strong>尚无侠客</strong><span>前往城市酒馆直接邀请。</span></section>'}</section>
      ${renderInventoryPanel(view, selected)}
    </div>
    <footer class="page-foot heroes-page-foot"><span><b>侠客页高保真重设计</b> · 蛋蛋江湖 2.0 · 数据与规则取自游戏真实配置</span><span>获取侠客与学习武功请前往城市或势力</span></footer>
  </section>`
}
