import { EQUIPMENT_QUALITIES, type EquipmentSlot } from '../content/equipment'
import type { EquipmentQuality } from '../domain/types'
import { escapeHtml } from './html'

export interface InventoryAffixView {
  name: string
  value: number
  min: number
  max: number
  ratio: number
}

export interface InventoryItemView {
  uid: string
  name: string
  slot: EquipmentSlot
  slotName: string
  level: number
  quality: EquipmentQuality
  locked: boolean
  baseStat: { name: string; value: number }
  affixes: InventoryAffixView[]
}

export interface InventorySlotTabView {
  id: 'all' | EquipmentSlot
  name: string
  count: number
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
}

const SLOT_ICON_MARKUP: Record<EquipmentSlot, string> = {
  weapon: '<path d="M4.5 19.5 L15.5 8.5"/><path d="M15.5 8.5 l4 -4"/><path d="M13 6.5 l4.5 4.5"/><path d="M7.5 16.5 l-2.5 4.5 4.5 -2.5"/>',
  head: '<path d="M5 12 a7 5.5 0 0 1 14 0"/><path d="M4.5 12 h15"/><path d="M9 12.5 l-2.5 5 M15 12.5 l2.5 5"/>',
  armor: '<path d="M9 4.5 l-4.5 3 2 4.5 2 -1.2 V20 h7 v-9.2 l2 1.2 2 -4.5 -4.5 -3"/><path d="M9 4.5 a3 3 0 0 0 6 0"/><path d="M12.5 11 v9"/>',
  wrist: '<rect x="7" y="5.5" width="10" height="13" rx="2.5"/><path d="M7 10 h10 M7 14.5 h10"/>',
  waist: '<path d="M12 3.5 v2.5"/><circle cx="12" cy="11.5" r="4.5"/><circle cx="12" cy="11.5" r="1.6"/><path d="M12 16 v4 M10.4 16.5 L9 20.5 M13.6 16.5 L15 20.5"/>',
  boots: '<path d="M7 4 h6 v6.5 c3 0 5.5 1.8 5.5 5 V17 H7 Z"/><path d="M7 14.5 h11.5"/>',
  token: '<rect x="7" y="3.5" width="10" height="17" rx="2"/><path d="M12 7.5 v4.5"/><path d="M10.2 12 h3.6"/><path d="M9.8 16.5 h4.4"/>',
}

const renderSlotIcon = (slot: EquipmentSlot): string => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SLOT_ICON_MARKUP[slot]}</svg>`

const renderSlotTabs = (view: InventoryPageViewModel): string => view.slotTabs.map((tab) => `
  <button type="button" class="inventory-slot-tab${view.slotFilter === tab.id ? ' active' : ''}"
    data-action="inventory-filter" data-inventory-slot="${tab.id}"
    aria-pressed="${view.slotFilter === tab.id}">
    <span>${escapeHtml(tab.name)}</span><small>${tab.count}</small>
  </button>`).join('')

const renderInventoryCell = (item: InventoryItemView, selectedUid: string | null): string => `
  <button type="button" class="inventory-cell${item.uid === selectedUid ? ' selected' : ''}" data-rarity="${escapeHtml(item.quality)}"
    data-equipment-uid="${escapeHtml(item.uid)}" data-testid="equipment-${escapeHtml(item.uid)}"
    data-action="inventory-select" aria-pressed="${item.uid === selectedUid}"
    aria-label="${escapeHtml(`${item.name}，${item.quality}，等级 ${item.level}`)}">
    ${item.locked ? '<span class="inventory-lock-mark" aria-label="已锁定">锁</span>' : ''}
    <span class="inventory-cell-level">Lv.${item.level}</span>
    <span class="inventory-cell-icon" aria-hidden="true">${renderSlotIcon(item.slot)}</span>
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
    <div class="inventory-affix-row" title="真实范围：${affix.min} - ${affix.max}">
      <span class="inventory-affix-name">${escapeHtml(affix.name)}</span>
      <span class="inventory-affix-bar" aria-hidden="true"><i style="width:${affix.ratio}%"></i></span>
      <span class="inventory-affix-value">+${affix.value}</span>
    </div>`).join('')
  : '<div class="inventory-affix-empty">凡品无词缀 · 聊胜于无</div>'

const renderSelectedDetail = (item: InventoryItemView | null): string => {
  if (!item) return `<div class="inventory-appraise-blank">
    <span class="inventory-blank-char">鉴</span>
    <span>点 选 囊 中 一 物<br>细 细 端 详</span>
  </div>`

  return `<div class="inventory-appraise-head">
    <span class="inventory-slot-tag">${escapeHtml(item.slotName)}</span>
    <span class="inventory-quality-tag" data-rarity="${escapeHtml(item.quality)}">${escapeHtml(item.quality)}</span>
    <span class="inventory-slot-tag">Lv.${item.level}</span>
  </div>
  <div class="inventory-appraise-figure">
    <span class="inventory-figure-ring" data-rarity="${escapeHtml(item.quality)}">${renderSlotIcon(item.slot)}</span>
    <div>
      <h2 class="inventory-appraise-name">${escapeHtml(item.name)}</h2>
      <div class="inventory-appraise-latin">${escapeHtml(item.quality)} · ${escapeHtml(item.slotName)} · Level ${item.level}</div>
    </div>
  </div>
  <div class="inventory-base-stat">
    <span class="inventory-base-label">${escapeHtml(item.baseStat.name)}</span>
    <span class="inventory-base-value">${item.baseStat.value}<small>基础</small></span>
  </div>
  <div class="inventory-affix-list">${renderAffixes(item)}</div>
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
    </div>
  </div>`
}

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
        <small>穿戴与卸下 · 请往侠客页操办</small>
      </div>
    </div>
  </header>

  <div class="inventory-layout">
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
              <button type="button" class="inventory-ink-button danger" data-action="inventory-discard-common">丢弃凡品</button>
            </div>
          </div>
        </header>
        <nav class="inventory-slot-tabs" aria-label="部位筛选">${renderSlotTabs(view)}</nav>
        <div class="inventory-grid-wrap"><div class="inventory-grid">${renderInventoryGrid(view)}</div></div>
        <footer class="inventory-legend">
          ${EQUIPMENT_QUALITIES.map((quality) => `<span class="${quality}">${quality}<b>${view.qualityCounts[quality]}</b></span>`).join('')}
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
