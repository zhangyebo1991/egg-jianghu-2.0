import { EQUIPMENT_QUALITIES, type EquipmentSlot } from '../content/equipment'
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

export interface InventoryShopItemView {
  careerId: string
  bookName: string
  careerName: string
  price: number
  owned: number
  affordable: boolean
}

export interface InventoryShopView {
  worldName: string
  currencyName: string
  currency: number
  rank: 2 | 3 | 4 | 5 | 6
  ranks: Array<{ id: 2 | 3 | 4 | 5 | 6; name: string }>
  items: InventoryShopItemView[]
}

export interface InventoryPageViewModel {
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
  shop: InventoryShopView
}

const renderEquipmentIcon = (item: InventoryItemView): string => {
  const icon = equipmentIconAsset(item.slot, item.definitionId)
  return `<img src="${escapeHtml(icon.url)}" alt="" aria-hidden="true" draggable="false" data-equipment-icon-source="${icon.source}">`
}

const renderSlotTabs = (view: InventoryPageViewModel): string => view.slotTabs.map((tab) => `
  <button type="button" class="inventory-slot-tab${view.slotFilter === tab.id ? ' active' : ''}"
    data-action="inventory-filter" data-inventory-slot="${tab.id}"
    aria-pressed="${view.slotFilter === tab.id}">
    <span>${escapeHtml(tab.name)}</span><small>${tab.count}</small>
  </button>`).join('')

const renderInventoryCell = (item: InventoryItemView, selectedUid: string | null): string => `
  <button type="button" class="inventory-cell${item.uid === selectedUid ? ' selected' : ''}" data-rarity="${item.quality}"
    data-equipment-uid="${escapeHtml(item.uid)}" data-testid="equipment-${escapeHtml(item.uid)}"
    data-action="inventory-select" aria-pressed="${item.uid === selectedUid}"
    aria-label="${escapeHtml(`${item.name}，品质 ${item.quality}，物品等级 ${item.level}，穿戴等级 ${item.equipmentLevel}`)}">
    ${item.locked ? '<span class="inventory-lock-mark" aria-label="已锁定">锁</span>' : ''}
    <span class="inventory-cell-level" title="物品等级">Lv.${item.level}</span>
    <span class="inventory-cell-icon" aria-hidden="true">${renderEquipmentIcon(item)}</span>
    <span class="inventory-cell-name">${escapeHtml(item.name)}</span>
    <span class="inventory-cell-slot">${escapeHtml(item.slotName)}</span>
  </button>`

const renderInventoryGrid = (view: InventoryPageViewModel): string => view.items.length
  ? view.items.map((item) => renderInventoryCell(item, view.selectedUid)).join('')
  : `<div class="inventory-empty">
      <span class="inventory-empty-seal" aria-hidden="true">空</span>
      <strong>囊 中 无 物</strong>
      <span>${view.itemCount ? '此部位暂未收得装备。' : '敌人殒命之时，随机装备即刻入囊。'}</span>
    </div>`

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

const renderSelectedDetail = (item: InventoryItemView | null): string => {
  if (!item) return `<div class="inventory-appraise-blank">
    <span class="inventory-blank-char">鉴</span>
    <span>点 选 囊 中 一 物<br>细 细 端 详</span>
  </div>`

  return `<div class="inventory-appraise-head">
    <span class="inventory-slot-tag">${escapeHtml(item.slotName)}</span>
    <span class="inventory-quality-tag" data-rarity="${item.quality}">品质 ${item.quality}</span>
    <span class="inventory-slot-tag" data-testid="inventory-item-level">物品等级 Lv.${item.level}</span>
    <span class="inventory-slot-tag" data-testid="inventory-equipment-level">穿戴等级 Lv.${item.equipmentLevel}</span>
  </div>
  <div class="inventory-appraise-figure">
    <span class="inventory-figure-ring" data-rarity="${item.quality}">${renderEquipmentIcon(item)}</span>
    <div>
      <h2 class="inventory-appraise-name">${escapeHtml(item.name)}</h2>
      <div class="inventory-appraise-latin">品质 ${item.quality} · ${escapeHtml(item.slotName)}${item.weaponTypeName ? ` · ${escapeHtml(item.weaponTypeName)}` : ''} · Item Lv.${item.level} · Wear Lv.${item.equipmentLevel}</div>
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
      ${item.locked ? '<b>已锁定</b> · 不参与批量丢弃，亦不误手。' : '锁定后可免于「批量丢弃」误伤。'}
      <span>物品等级决定属性与词条系数；人物等级达到穿戴等级 Lv.${item.equipmentLevel} 方可穿戴。</span>
    </div>
  </div>`
}

const renderShop = (shop: InventoryShopView): string => `
  <aside class="inventory-shop" data-testid="job-book-shop" aria-label="坊市">
    <header class="inventory-shop-head">
      <div>
        <h2>坊市</h2>
        <span>转职书 · ${escapeHtml(shop.worldName)}</span>
      </div>
      <div class="inventory-shop-purse">
        <b data-testid="shop-currency">${shop.currency}</b>
        <small>${escapeHtml(shop.currencyName)}</small>
      </div>
    </header>
    <nav class="inventory-shop-ranks" aria-label="转职书阶位">
      ${shop.ranks.map((rank) => `
        <button type="button" class="inventory-shop-rank${shop.rank === rank.id ? ' active' : ''}"
          data-action="shop-rank" data-rank="${rank.id}" data-testid="shop-rank-${rank.id}"
          aria-pressed="${shop.rank === rank.id}">${escapeHtml(rank.name)}</button>`).join('')}
    </nav>
    <ul class="inventory-shop-list">
      ${shop.items.map((item) => `
        <li class="inventory-shop-item" data-testid="shop-book-${escapeHtml(item.careerId)}">
          <div>
            <strong>${escapeHtml(item.bookName)}</strong>
            <span>持有 ${item.owned} · ${item.price} 铜钱</span>
          </div>
          <button type="button" class="inventory-shop-buy" data-action="shop-buy"
            data-career-id="${escapeHtml(item.careerId)}" data-testid="shop-buy-${escapeHtml(item.careerId)}"
            ${item.affordable ? '' : 'disabled'}>购入</button>
        </li>`).join('')}
    </ul>
    <p class="inventory-shop-note">战斗不掉转职书。可先囤书，转职仍需前置职业等级。</p>
  </aside>`

export const renderInventoryPage = (view: InventoryPageViewModel): string => `<section class="inventory-page" data-testid="inventory-page">
  <span class="inventory-ghost-char" aria-hidden="true">囊</span>

  <header class="inventory-page-head">
    <div>
      <div class="inventory-crumb">行囊 · <b>即时掉落</b> · ${escapeHtml(view.worldName)}</div>
      <h1>装备背包</h1>
      <div class="inventory-latin">Inventory · Spoils of the Jianghu</div>
    </div>
    <div class="inventory-head-note">
      <span class="inventory-head-note-seal" aria-hidden="true">囊</span>
      <div class="inventory-head-note-copy">
        <span>纯行囊之地 · <b>已装备不入此囊</b></span>
        <small>穿戴与卸下 · 请往侠客页操办 · 坊市只卖转职书</small>
      </div>
    </div>
  </header>

  <div class="inventory-layout">
    ${renderShop(view.shop)}
    <section class="inventory-board" aria-label="百宝囊">
      <div class="inventory-board-inner">
        <header class="inventory-board-head">
          <div class="inventory-board-title">
            <h2>百宝囊</h2>
            <span>敌人殒命 · <i>随机装备即刻入囊</i></span>
          </div>
          <div class="inventory-board-side">
            <div class="inventory-capacity">
              <span class="inventory-capacity-number"><b>${view.itemCount}</b> / ${view.capacity}</span>
              <span class="inventory-capacity-bar"><i style="width:${view.capacityRatio}%"></i></span>
            </div>
            <div class="inventory-actions">
              <button type="button" class="inventory-ink-button" data-action="inventory-organize">整理囊袋</button>
              <button type="button" class="inventory-ink-button danger" data-action="inventory-discard-common">丢弃品质 0</button>
            </div>
          </div>
        </header>
        <nav class="inventory-slot-tabs" aria-label="部位筛选">${renderSlotTabs(view)}</nav>
        <div class="inventory-grid-wrap"><div class="inventory-grid">${renderInventoryGrid(view)}</div></div>
        <footer class="inventory-legend">
          ${EQUIPMENT_QUALITIES.map((quality) => `<span data-quality="${quality}">品质 ${quality}<b>${view.qualityCounts[quality]}</b></span>`).join('')}
          <span class="inventory-legend-total">共 ${view.itemCount} 件 · 囊容 ${view.capacity}</span>
        </footer>
      </div>
    </section>

    <aside class="inventory-appraise${view.detailOpen ? ' open' : ''}" data-testid="inventory-detail" aria-label="装备详情">
      <button type="button" class="inventory-appraise-close" data-action="inventory-close-detail" aria-label="关闭详情">✕</button>
      <div class="inventory-appraise-paper">${renderSelectedDetail(view.selectedItem)}</div>
    </aside>
  </div>

  <footer class="inventory-page-foot">蛋蛋江湖 2.0 · 背包页重设计 v2 · 墨底宣纸 / 朱砂印 / 金漆匾</footer>
</section>`
