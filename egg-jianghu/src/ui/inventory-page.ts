import { EQUIPMENT_QUALITIES, EQUIPMENT_QUALITY_NAMES, type EquipmentSlot } from '../content/equipment'
import type { EquipmentQuality } from '../domain/types'
import { equipmentIconAsset } from './equipment-icon-assets'
import { escapeHtml } from './html'

export interface InventoryAttributeView {
  attributeId: number
  name: string
  value: number
  formattedValue: string
}

export interface InventoryCoreStatView extends InventoryAttributeView {
  rollPercent: number
}

export interface InventoryAffixView extends InventoryAttributeView {
  grade: string
}

export interface InventoryItemView {
  uid: string
  definitionId: string
  name: string
  slot: EquipmentSlot
  slotName: string
  level: number
  equipmentLevel: number
  quality: EquipmentQuality
  locked: boolean
  weaponTypeName?: string
  coreStats: InventoryCoreStatView[]
  affixes: InventoryAffixView[]
  equipmentKindLabel?: string
  description?: string
  fixedEffects?: InventoryAttributeView[]
  artifactSoul?: {
    name: string
    tier: number
    description: string
    formattedValue: string
  }
  manualSkill?: {
    name: string
    learned: boolean
  }
}

export interface InventorySlotTabView {
  id: 'all' | EquipmentSlot
  name: string
  count: number
}

export interface InventoryPagerView {
  page: number
  pageCount: number
  pageSize: number
  total: number
  rangeStart: number
  rangeEnd: number
  columns?: number
  rows?: number
  cellSize?: number
}

export interface InventoryPageViewModel {
  pager?: InventoryPagerView
  sellOpen?: boolean
  heroSidebar?: string
  heroEquipment?: string
  selectedHeroName?: string
  equippedBySlot?: Partial<Record<EquipmentSlot, InventoryItemView>>
  qualityFilter?: EquipmentQuality | 'all'
  sort?: 'level' | 'quality'
  category?: 'all' | 'equipment' | 'material' | 'special'
  query?: string
  categoryCounts?: Record<'all' | 'equipment' | 'material' | 'special', number>
  stacks?: InventoryStackView[]
  selectedStack?: InventoryStackView | null
  worldName: string
  capacity: number
  itemCount: number
  capacityRatio: number
  qualityCounts: Record<EquipmentQuality, number>
  slotFilter: 'all' | EquipmentSlot
  slotTabs: InventorySlotTabView[]
  selectedUid: string | null
  detailOpen: boolean
  items: InventoryItemView[]
  selectedItem: InventoryItemView | null
  gridColumns?: number
  gridRows?: number
  gridCellSize?: number
}

export interface InventoryStackView {
  id: number
  name: string
  kind: 'material' | 'special'
  quality: number
  quantity: number
  description: string
}

const renderStack = (item: InventoryStackView, selectedId?: number): string => `
  <button type="button" class="inventory-cell${selectedId === item.id ? ' selected' : ''}" data-rarity="${item.quality}"
    data-action="inventory-stack-select" data-item-id="${item.id}" data-testid="stack-item-${item.id}"
    aria-pressed="${selectedId === item.id}" aria-label="${escapeHtml(item.name)}，数量 ${item.quantity}">
    <span class="inventory-cell-level">×${item.quantity.toLocaleString('zh-CN')}</span>
    <span class="inventory-cell-icon inventory-stack-mark" aria-hidden="true">${item.kind === 'material' ? '材' : '物'}</span>
    <span class="inventory-cell-name">${escapeHtml(item.name)}</span>
    <span class="inventory-cell-slot">${item.kind === 'material' ? '材料' : '特殊物品'}</span>
  </button>`

const renderStackDetail = (item: InventoryStackView): string => `
  <div class="inventory-appraise-head"><span class="inventory-slot-tag">${item.kind === 'material' ? '材料' : '特殊物品'}</span><span class="inventory-quality-tag" data-rarity="${item.quality}">品质 ${escapeHtml(EQUIPMENT_QUALITY_NAMES[item.quality] ?? String(item.quality))}</span></div>
  <h2>${escapeHtml(item.name)}</h2><p>持有数量：<strong>${item.quantity.toLocaleString('zh-CN')}</strong></p>
  <p class="inventory-original-description">${escapeHtml(item.description)}</p>
  <p>${item.kind === 'material' ? '收集任务提交时会扣除所需数量。' : '在对应玩法中使用。'}</p>`

const renderEquipmentIcon = (item: InventoryItemView): string => {
  const icon = equipmentIconAsset(item.slot, item.definitionId)
  return `<img src="${escapeHtml(icon.url)}" alt="" aria-hidden="true" draggable="false" data-equipment-icon-source="${icon.source}">`
}

type TooltipStat = InventoryCoreStatView | InventoryAffixView

// 与身上同部位装备逐词条对比，标注 ▲/▼ 差值，便于扫一眼定优劣。
const tooltipDeltaMark = (stat: TooltipStat, reference: Map<number, number>): string => {
  const against = reference.get(stat.attributeId)
  if (against === undefined) return ''
  const difference = stat.value - against
  const percent = stat.formattedValue.endsWith('%')
  if (Math.abs(difference) < (percent ? 0.05 : 0.5)) return ''
  const text = percent
    ? `${difference > 0 ? '+' : ''}${Number(difference.toFixed(1))}%`
    : `${difference > 0 ? '+' : ''}${Math.round(difference).toLocaleString('zh-CN')}`
  return `<i class="tt-delta ${difference > 0 ? 'up' : 'down'}">${difference > 0 ? '▲' : '▼'}${text}</i>`
}

const renderTooltipStats = (stats: TooltipStat[], reference: Map<number, number> | null): string =>
  `<dl class="equipment-properties">${stats.map((stat) => {
    const grade = 'grade' in stat ? stat.grade : null
    const roll = 'rollPercent' in stat ? stat.rollPercent : null
    const delta = reference ? tooltipDeltaMark(stat, reference) : ''
    const label = roll !== null ? ` <i>(${roll}%)</i>` : grade ? ` <i>[${grade}]</i>` : ''
    return `<div${grade ? ` data-affix-grade="${grade}"` : ''}><dt>${escapeHtml(stat.name)}${label}</dt><dd>+${escapeHtml(stat.formattedValue)}${delta}</dd></div>`
  }).join('')}</dl>`

const renderTooltipStatGroups = (item: InventoryItemView, reference: Map<number, number> | null): string =>
  `<div class="tt-stat-group"><h4>核心词条</h4>${renderTooltipStats(item.coreStats, reference)}</div>
  ${item.affixes.length ? `<div class="tt-stat-group"><h4>附加词条</h4>${renderTooltipStats(item.affixes, reference)}</div>` : ''}`

const renderEquipmentTooltipHeader = (item: InventoryItemView): string => `
    <header>
      <span>${escapeHtml(item.slotName)}${item.weaponTypeName ? ` · ${escapeHtml(item.weaponTypeName)}` : ''}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <em>品质 <b class="tt-q">${escapeHtml(EQUIPMENT_QUALITY_NAMES[item.quality])}</b> · 物品等级 Lv.${item.level} · 穿戴等级 Lv.${item.equipmentLevel}</em>
    </header>`

export const renderEquipmentTooltip = (item: InventoryItemView, footer: string, comparison?: InventoryItemView | null): string => {
  if (!comparison) {
    return `
  <div class="equipment-tooltip" popover="manual" data-rarity="${item.quality}">
    ${renderEquipmentTooltipHeader(item)}
    <div class="equipment-tooltip-columns">
      <section>
        <small>核心词条</small>
        ${renderTooltipStats(item.coreStats, null)}
      </section>
      ${item.affixes.length ? `<section>
        <small>附加词条</small>
        ${renderTooltipStats(item.affixes, null)}
      </section>` : ''}
    </div>
    <footer>${escapeHtml(footer)}</footer>
  </div>`
  }
  const reference = new Map<number, number>()
  comparison.coreStats.forEach((stat) => reference.set(stat.attributeId, stat.value))
  comparison.affixes.forEach((stat) => reference.set(stat.attributeId, stat.value))
  return `
  <div class="equipment-tooltip has-compare" popover="manual" data-rarity="${item.quality}">
    ${renderEquipmentTooltipHeader(item)}
    <div class="tt-compare">
      <section class="tt-col">
        <small>行囊物品</small>
        <strong class="tt-compare-name" data-rarity="${item.quality}">${escapeHtml(item.name)}</strong>
        ${renderTooltipStatGroups(item, reference)}
      </section>
      <section class="tt-col">
        <small>身上装备</small>
        <strong class="tt-compare-name" data-rarity="${comparison.quality}">${escapeHtml(comparison.name)}</strong>
        ${renderTooltipStatGroups(comparison, null)}
      </section>
    </div>
    <footer>${escapeHtml(footer)}</footer>
  </div>`
}

const renderSlotTabs = (view: InventoryPageViewModel): string => view.slotTabs.map((tab) => `
  <button type="button" class="inventory-slot-tab${view.slotFilter === tab.id ? ' active' : ''}"
    data-action="inventory-filter" data-inventory-slot="${tab.id}"
    aria-pressed="${view.slotFilter === tab.id}">
    <span>${escapeHtml(tab.name)}</span><small>${tab.count}</small>
  </button>`).join('')

const renderInventoryCell = (item: InventoryItemView, selectedUid: string | null, equippedBySlot?: InventoryPageViewModel['equippedBySlot']): string => {
  const equipped = equippedBySlot?.[item.slot] ?? null
  return `
  <button type="button" class="inventory-cell${item.uid === selectedUid ? ' selected' : ''}" data-rarity="${item.quality}"
    data-equipment-uid="${escapeHtml(item.uid)}" data-testid="equipment-${escapeHtml(item.uid)}"
    data-action="inventory-select" aria-pressed="${item.uid === selectedUid}"
    aria-label="${escapeHtml(`${item.name}，品质 ${EQUIPMENT_QUALITY_NAMES[item.quality] ?? item.quality}，物品等级 ${item.level}，穿戴等级 ${item.equipmentLevel}`)}">
    ${item.locked ? '<span class="inventory-lock-mark" aria-label="已锁定">锁</span>' : ''}
    <span class="inventory-cell-level" title="物品等级">Lv.${item.level}</span>
    <span class="inventory-cell-icon" aria-hidden="true">${renderEquipmentIcon(item)}</span>
    <span class="inventory-cell-name">${escapeHtml(item.name)}</span>
    <span class="inventory-cell-slot">${escapeHtml(item.slotName)}</span>
    ${renderEquipmentTooltip(item, '悬停查看属性 · 详情区可为选中侠客装备', equipped?.uid === item.uid ? null : equipped)}
  </button>`
}

const renderInventoryGrid = (view: InventoryPageViewModel): string => view.items.length || view.stacks?.length
  ? view.items.map((item) => renderInventoryCell(item, view.selectedUid, view.equippedBySlot)).join('') + (view.stacks ?? []).map(item => renderStack(item, view.selectedStack?.id)).join('')
  : `<div class="inventory-empty">
      <span class="inventory-empty-seal" aria-hidden="true">空</span>
      <strong>囊 中 无 物</strong>
      <span>暂无符合当前分类和搜索条件的物品。</span>
    </div>`

// 页码窗口：首末页常驻，当前页前后各一页，其余折叠为省略号，总槽位恒不超过 7。
const pagerSlots = (page: number, pageCount: number): Array<number | 'gap'> => {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)
  const start = Math.max(2, Math.min(page - 1, pageCount - 4))
  const end = Math.min(pageCount - 1, Math.max(page + 1, 5))
  return [
    1,
    ...(start > 2 ? ['gap' as const] : []),
    ...Array.from({ length: end - start + 1 }, (_, index) => start + index),
    ...(end < pageCount - 1 ? ['gap' as const] : []),
    pageCount,
  ]
}

const renderPagerStep = (label: string, target: number, disabled: boolean, name: string): string =>
  `<button type="button" class="inventory-pager-step" data-action="inventory-page" data-page="${target}" aria-label="${name}"${disabled ? ' disabled' : ''}>${label}</button>`

const renderInventoryPager = (pager?: InventoryPagerView): string => {
  if (!pager || pager.pageCount <= 1) return ''
  const { page, pageCount } = pager
  return `<nav class="inventory-pager" aria-label="百宝囊分页" data-testid="inventory-pager" data-page-size="${pager.pageSize}" data-grid-columns="${pager.columns ?? ''}" data-grid-rows="${pager.rows ?? ''}" data-cell-size="${pager.cellSize ?? ''}">
    ${renderPagerStep('‹ 上页', page - 1, page <= 1, '上一页')}
    <div class="inventory-pager-nums">${pagerSlots(page, pageCount).map((slot) => slot === 'gap'
      ? '<span class="inventory-pager-gap" aria-hidden="true">···</span>'
      : `<button type="button" class="inventory-pager-num${slot === page ? ' active' : ''}" data-action="inventory-page" data-page="${slot}" aria-label="第 ${slot} 页"${slot === page ? ' aria-current="page"' : ''}>${slot}</button>`).join('')}</div>
    ${renderPagerStep('下页 ›', page + 1, page >= pageCount, '下一页')}
    <span class="inventory-pager-meta">第 <b>${page}</b> / ${pageCount} 页 · 本页 ${pager.rangeStart}-${pager.rangeEnd} 件 · 共 ${pager.total} 件</span>
  </nav>`
}

const renderAffixes = (item: InventoryItemView): string => item.affixes.length
  ? item.affixes.map((affix) => `
    <div class="inventory-affix-row" data-affix-grade="${affix.grade}">
      <span class="inventory-affix-name">${escapeHtml(affix.name)}</span>
      <span class="inventory-affix-grade">[${affix.grade}]</span>
      <span class="inventory-affix-value">+${escapeHtml(affix.formattedValue)}</span>
    </div>`).join('')
  : '<div class="inventory-affix-empty">无附加词条</div>'

const renderCoreStats = (item: InventoryItemView): string => item.coreStats.map((core) => `
  <div class="inventory-core-row">
    <span class="inventory-base-label">${escapeHtml(core.name)}</span>
    <span class="inventory-core-roll">(${core.rollPercent}%)</span>
    <span class="inventory-base-value">+${escapeHtml(core.formattedValue)}</span>
  </div>`).join('')

const renderOriginalFixedDetails = (item: InventoryItemView): string => `
  ${item.description ? `<p class="inventory-original-description">${escapeHtml(item.description)}</p>` : ''}
  ${item.fixedEffects?.length ? `<section class="inventory-fixed-effects"><h3>至宝固定属性</h3>${item.fixedEffects.map((effect) => `<div><span>${escapeHtml(effect.name)}</span><b>+${escapeHtml(effect.formattedValue)}</b></div>`).join('')}</section>` : ''}
  ${item.manualSkill ? `<section class="inventory-manual-skill" data-learned="${item.manualSkill.learned}"><h3>秘籍传承 · ${escapeHtml(item.manualSkill.name)}</h3><b>${item.manualSkill.learned ? '已领悟' : '未领悟'}</b><p>首次装备后永久领悟；卸下不会失去，重复装备不会重复授予。</p></section>` : ''}
  ${item.artifactSoul ? `<section class="inventory-artifact-soul" data-tier="${item.artifactSoul.tier}"><header><h3>器魂 · ${escapeHtml(item.artifactSoul.name)}</h3><b>${item.artifactSoul.tier} 阶</b></header><p>${escapeHtml(item.artifactSoul.description)}</p><strong>当前生效 +${escapeHtml(item.artifactSoul.formattedValue)}</strong></section>` : ''}`

const renderSelectedDetail = (item: InventoryItemView | null, selectedHeroName?: string): string => {
  if (!item) return `<div class="inventory-appraise-blank">
    <span class="inventory-blank-char">鉴</span>
    <span>点 选 囊 中 一 物<br>细 细 端 详</span>
  </div>`

  return `${selectedHeroName ? `<div class="inventory-detail-toolbar">
    <button type="button" class="inventory-detail-equip" data-action="inventory-equip" data-equipment-uid="${escapeHtml(item.uid)}" aria-label="为${escapeHtml(selectedHeroName)}装备${escapeHtml(item.name)}" title="为${escapeHtml(selectedHeroName)}装备此物品">装备</button>
  </div>` : ''}<div class="inventory-appraise-head">
    <span class="inventory-slot-tag">${escapeHtml(item.slotName)}</span>
    <span class="inventory-quality-tag" data-rarity="${item.quality}">品质 ${escapeHtml(EQUIPMENT_QUALITY_NAMES[item.quality] ?? String(item.quality))}</span>
    <span class="inventory-slot-tag" data-testid="inventory-item-level">物品等级 Lv.${item.level}</span>
    <span class="inventory-slot-tag" data-testid="inventory-equipment-level">穿戴等级 Lv.${item.equipmentLevel}</span>
  </div>
  <div class="inventory-appraise-figure">
    <span class="inventory-figure-ring" data-rarity="${item.quality}">${renderEquipmentIcon(item)}</span>
    <div>
      <h2 class="inventory-appraise-name">${escapeHtml(item.name)}</h2>
      <div class="inventory-appraise-latin">品质 ${escapeHtml(EQUIPMENT_QUALITY_NAMES[item.quality] ?? String(item.quality))} · ${escapeHtml(item.slotName)}${item.weaponTypeName ? ` · ${escapeHtml(item.weaponTypeName)}` : ''} · Item Lv.${item.level} · Wear Lv.${item.equipmentLevel}</div>
      ${item.equipmentKindLabel ? `<div class="inventory-kind-label">${escapeHtml(item.equipmentKindLabel)}</div>` : ''}
    </div>
  </div>
  <div class="inventory-base-stat">${renderCoreStats(item)}</div>
  <div class="inventory-affix-list">${renderAffixes(item)}</div>
  ${renderOriginalFixedDetails(item)}
  <div class="inventory-appraise-actions">
    <div class="inventory-action-row">
      <button type="button" class="inventory-action-ghost${item.locked ? ' on' : ''}"
        data-action="inventory-toggle-lock" data-equipment-uid="${escapeHtml(item.uid)}">
        ${item.locked ? '解 锁' : '锁 定'}
      </button>
      <button type="button" class="inventory-action-ghost" data-action="inventory-discard"
        data-equipment-uid="${escapeHtml(item.uid)}">丢 弃</button>
    </div>
    <div class="inventory-appraise-note">
      ${item.locked ? '<b>已锁定</b> · 不参与批量出售，亦不误手。' : '锁定后可免于「按等阶出售」误伤。'}
      <span>物品等级决定属性与词条系数；人物等级达到穿戴等级 Lv.${item.equipmentLevel} 方可穿戴。</span>
    </div>
  </div>`
}

export const renderInventoryPage = (view: InventoryPageViewModel): string => `<section class="inventory-page" data-testid="inventory-page">
  <span class="inventory-ghost-char" aria-hidden="true">囊</span>

  <header class="inventory-page-head">
    <div>
      <div class="inventory-crumb">行囊 · <b>即时掉落</b> · ${escapeHtml(view.worldName)}</div>
      <h1>背包</h1>
      <div class="inventory-latin">Inventory · Spoils of the Jianghu</div>
    </div>
    <div class="inventory-head-note">
      <span class="inventory-head-note-seal" aria-hidden="true">囊</span>
      <div class="inventory-head-note-copy">
        <span>装备 · 材料 · 特殊物品 · <b>已装备不入此囊</b></span>
        <small>穿戴与卸下 · 请往侠客页操办 · 转职书在兑换页购入</small>
      </div>
    </div>
  </header>

  <div class="inventory-layout">
    ${view.heroSidebar ?? ''}
    <section class="inventory-board" aria-label="百宝囊">
      <div class="inventory-board-inner">
        <header class="inventory-board-head">
          <div class="inventory-board-title">
            <h2>百宝囊</h2>
            <span>战斗掉落入囊 · <i>材料与特殊物品自动堆叠</i></span>
          </div>
          <div class="inventory-board-side">
            <div class="inventory-capacity">
              <span class="inventory-capacity-number">装备 <b>${view.itemCount}</b> / ${view.capacity}</span>
              <span class="inventory-capacity-bar"><i style="width:${view.capacityRatio}%"></i></span>
            </div>
            <div class="inventory-actions">
              <button type="button" class="inventory-ink-button" data-action="inventory-organize">整理囊袋</button>
              <span class="inventory-sell-wrap">
                <button type="button" class="inventory-ink-button danger${view.sellOpen ? ' active' : ''}" data-action="inventory-sell-toggle" aria-haspopup="true" aria-expanded="${view.sellOpen ? 'true' : 'false'}">按等阶出售</button>
                ${view.sellOpen ? `<div class="sellpop inventory-sellpop" role="menu" aria-label="按等阶出售">
                  <div class="sp-title">按等阶出售<small>点档位立即售出 ≤ 该档的未装备物品 · 收入当前世界铜钱</small></div>
                  ${EQUIPMENT_QUALITIES.map((quality) => `<button type="button" class="sp-opt" role="menuitem" data-action="inventory-sell-quality" data-quality="${quality}" style="color:var(--q-${quality})">${EQUIPMENT_QUALITY_NAMES[quality]}及以下</button>`).join('')}
                </div>` : ''}
              </span>
            </div>
          </div>
        </header>
        <nav class="inventory-slot-tabs" aria-label="物品分类">${(['all', 'equipment', 'material', 'special'] as const).map((category, index) => `<button type="button" class="inventory-slot-tab${(view.category ?? 'all') === category ? ' active' : ''}" data-action="inventory-category" data-category="${category}" aria-pressed="${(view.category ?? 'all') === category}">${['全部', '装备', '材料', '特殊物品'][index]}<small>${view.categoryCounts?.[category] ?? (category === 'all' || category === 'equipment' ? view.itemCount : 0)}</small></button>`).join('')}</nav>
        <label class="inventory-search">搜索物品<input type="search" data-action="inventory-search" aria-label="搜索背包物品" placeholder="输入物品名称" value="${escapeHtml(view.query ?? '')}"></label>
        ${(view.category ?? 'all') === 'equipment' || (view.category ?? 'all') === 'all' ? `<nav class="inventory-slot-tabs" aria-label="部位筛选">${renderSlotTabs(view)}</nav>` : ''}
        ${(view.category ?? 'all') === 'equipment' || (view.category ?? 'all') === 'all' ? `<nav class="ink-bag-filters" aria-label="品质与排序"><button type="button" data-action="inventory-quality" data-quality="all" aria-pressed="${(view.qualityFilter ?? 'all') === 'all'}">全品质</button>${EQUIPMENT_QUALITIES.map(quality => `<button type="button" data-action="inventory-quality" data-quality="${quality}" aria-pressed="${view.qualityFilter === quality}">${EQUIPMENT_QUALITY_NAMES[quality]}</button>`).join('')}<button type="button" data-action="inventory-sort" data-sort="level" aria-pressed="${(view.sort ?? 'level') === 'level'}">等级↓</button><button type="button" data-action="inventory-sort" data-sort="quality" aria-pressed="${view.sort === 'quality'}">品质↓</button></nav>` : ''}
        <div class="inventory-grid-wrap" data-testid="inventory-grid-wrap" data-grid-columns="${view.gridColumns ?? ''}" data-grid-rows="${view.gridRows ?? ''}" data-cell-size="${view.gridCellSize ?? ''}"><div class="inventory-grid" data-testid="inventory-grid">${renderInventoryGrid(view)}</div></div>
        ${renderInventoryPager(view.pager)}
      </div>
    </section>

    <div class="ink-bag-side">${view.heroEquipment ?? ''}
    <aside class="inventory-appraise${view.detailOpen ? ' open' : ''}" data-testid="inventory-detail" aria-label="物品详情">
      <button type="button" class="inventory-appraise-close" data-action="inventory-close-detail" aria-label="关闭详情">✕</button>
      <div class="inventory-appraise-paper">${view.selectedStack ? renderStackDetail(view.selectedStack) : renderSelectedDetail(view.selectedItem, view.selectedHeroName)}</div>
    </aside>
    </div>
  </div>

</section>`
