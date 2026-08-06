import type { EquipmentSlot } from '../content/equipment'
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
  glyph: string
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
  slotFilter: 'all' | EquipmentSlot
  slotTabs: InventorySlotTabView[]
  selectedUid: string | null
  detailOpen: boolean
  items: InventoryItemView[]
  selectedItem: InventoryItemView | null
}

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
    <span class="inventory-cell-glyph" aria-hidden="true">${escapeHtml(item.glyph)}</span>
    <span class="inventory-cell-name">${escapeHtml(item.name)}</span>
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
  <h2 class="inventory-appraise-name">${escapeHtml(item.name)}</h2>
  <div class="inventory-appraise-latin">${escapeHtml(item.quality)} · ${escapeHtml(item.slotName)} · Level ${item.level}</div>
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
      <span>纯行囊之地 · <b>已装备不入此囊</b></span>
      <small>穿戴与卸下 · 请往侠客页操办</small>
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
          <span class="凡品">凡品</span><span class="良品">良品</span><span class="上品">上品</span>
          <span class="珍品">珍品</span><span class="绝品">绝品</span>
        </footer>
      </div>
    </section>

    <aside class="inventory-appraise${view.detailOpen ? ' open' : ''}" data-testid="inventory-detail" aria-label="装备详情">
      <button type="button" class="inventory-appraise-close" data-action="inventory-close-detail" aria-label="关闭详情">✕</button>
      <div class="inventory-appraise-paper">${renderSelectedDetail(view.selectedItem)}</div>
    </aside>
  </div>

  <footer class="inventory-page-foot">蛋蛋江湖 2.0 · 背包页高保真重设计 · 墨底宣纸 / 朱砂印 / 金漆匾</footer>
</section>`
