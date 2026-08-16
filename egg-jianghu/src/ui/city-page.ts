import { escapeHtml, formatNumber } from './html'

export type CityPageSection = 'map' | 'company'

export interface CityMapTileView {
  tileId: number
  buildingName: string
  buildingType: string
  buildingLevel: number
  owned: boolean
  buildable: boolean
  locked: boolean
  selected: boolean
}

export interface CitySelectedTileView {
  tileId: number
  coordinates: string
  buildingName: string
  buildingType: string
  buildingLevel: number
  description: string
  owned: boolean
  buildable: boolean
  landPriceTier: number
  population: number
  commerce: number
  industry: number
  purchasePrice: number | null
  salePrice: number | null
  priceNote: string | null
}

export interface CityFinanceItemView {
  name: string
  amount: number
  expense: boolean
}

export interface CityPageViewModel {
  section: CityPageSection
  gridColumns: number
  gridRows: number
  effectiveColumns: number
  effectiveRows: number
  buildingCount: number
  technologyCount: number
  cityLevel: number
  development: number
  population: number
  commerce: number
  industry: number
  tiles: readonly CityMapTileView[]
  selectedTile: CitySelectedTileView
  company: {
    name: string | null
    cash: number
    ownedLandCount: number
    ownedLandValue: number
    baseMonthlyRent: number
    previousNetIncome: number
    finance: readonly CityFinanceItemView[]
    registrationCost: number
    nameRuleReason: string
    positionRuleReason: string
  }
}

const tileMark = (tile: CityMapTileView): string => {
  if (tile.buildingType === '无') return ''
  if (tile.buildingType === '树木') return '木'
  return [...tile.buildingName][0] ?? ''
}

const renderMap = (view: CityPageViewModel): string => `<div class="city-core-layout">
  <section class="city-map-panel" aria-label="城市地图">
    <header class="city-panel-head">
      <div><span>城市地面</span><strong>${view.effectiveColumns} × ${view.effectiveRows} 有效城区</strong></div>
      <small>点击地块查看土地与建筑详情</small>
    </header>
    <div class="city-map-scroll">
      <div class="city-map-grid" data-testid="city-map" style="--city-grid-columns:${view.gridColumns}">
        ${view.tiles.map((tile) => `<button
          class="city-map-tile type-${escapeHtml(tile.buildingType)}${tile.owned ? ' owned' : ''}${tile.selected ? ' selected' : ''}${tile.locked ? ' locked' : ''}"
          type="button"
          data-action="select-city-tile"
          data-city-tile-id="${tile.tileId}"
          aria-label="${escapeHtml(tile.buildingName)}，${tile.buildingLevel > 0 ? `等级 ${tile.buildingLevel}` : '无等级'}${tile.owned ? '，自有' : ''}"
          aria-pressed="${tile.selected}"
          ${tile.locked ? 'disabled' : ''}
        ><i>${escapeHtml(tileMark(tile))}</i>${tile.buildingLevel > 0 ? `<small>${tile.buildingLevel}</small>` : ''}</button>`).join('')}
      </div>
    </div>
    <footer class="city-map-legend">
      <span><i class="legend-owned"></i>自有土地</span>
      <span><i class="legend-built"></i>城市建筑</span>
      <span><i class="legend-open"></i>可开发</span>
      <span><i class="legend-locked"></i>待扩建城区</span>
    </footer>
  </section>
  <aside class="city-land-deed" data-testid="city-tile-detail">
    <header>
      <div><span>地契 · ${escapeHtml(view.selectedTile.coordinates)}</span><h2>${escapeHtml(view.selectedTile.buildingName)}</h2></div>
      <b class="${view.selectedTile.owned ? 'owned' : ''}">${view.selectedTile.owned ? '自有' : '未购'}</b>
    </header>
    <p>${escapeHtml(view.selectedTile.description)}</p>
    <dl class="city-tile-stats">
      <div><dt>建筑类型</dt><dd>${escapeHtml(view.selectedTile.buildingType)}</dd></div>
      <div><dt>建筑等级</dt><dd>${view.selectedTile.buildingLevel > 0 ? `Lv.${view.selectedTile.buildingLevel}` : '—'}</dd></div>
      <div><dt>地价档</dt><dd>${view.selectedTile.landPriceTier}</dd></div>
      <div><dt>人口</dt><dd>${formatNumber(view.selectedTile.population)}</dd></div>
      <div><dt>商业</dt><dd>${formatNumber(view.selectedTile.commerce)}</dd></div>
      <div><dt>工业</dt><dd>${formatNumber(view.selectedTile.industry)}</dd></div>
    </dl>
    <div class="city-price-ledger">
      <span>买入估价<strong>${view.selectedTile.purchasePrice === null ? '待核验' : formatNumber(view.selectedTile.purchasePrice)}</strong></span>
      <span>卖出估价<strong>${view.selectedTile.salePrice === null ? '待核验' : formatNumber(view.selectedTile.salePrice)}</strong></span>
    </div>
    ${view.selectedTile.priceNote ? `<p class="city-rule-note">${escapeHtml(view.selectedTile.priceNote)}</p>` : ''}
    <div class="city-land-actions">
      <button type="button" disabled>${view.selectedTile.owned ? '出售土地' : '购买土地'}</button>
      <button type="button" disabled>${view.selectedTile.buildable ? '规划建设' : '升级 / 迁移'}</button>
    </div>
    <small class="city-action-reason">价格已按原版公式复算；买卖、建设与迁移前置条件完成核验后开放</small>
  </aside>
</div>`

const renderCompany = (view: CityPageViewModel): string => `<div class="city-company-layout" data-testid="city-company">
  <section class="city-company-overview">
    <header class="city-company-name">
      <div><span>现世公司</span><h2>${escapeHtml(view.company.name ?? '尚未成立')}</h2></div>
      <button type="button" disabled>${view.company.name ? '公司更名' : '注册公司'}</button>
    </header>
    <p class="city-rule-note">${escapeHtml(view.company.nameRuleReason)}；注册与更名原版费用均为 ${formatNumber(view.company.registrationCost)} 现金。</p>
    <div class="city-company-metrics">
      <article><span>公司现金</span><strong>${formatNumber(view.company.cash)}</strong></article>
      <article><span>自有土地</span><strong>${view.company.ownedLandCount}</strong></article>
      <article><span>已接入土地价值</span><strong>${formatNumber(view.company.ownedLandValue)}</strong></article>
      <article><span>基础月租</span><strong>${formatNumber(view.company.baseMonthlyRent)}</strong></article>
    </div>
    <section class="city-position-board">
      <header><h3>公司职位</h3><span>职位能力待接入</span></header>
      <div>${['CEO', '建筑总监', '产业主管'].map((title) => `<article><b>${title}</b><span>暂未任命</span></article>`).join('')}</div>
      <p>${escapeHtml(view.company.positionRuleReason)}，因此不使用侠客等级或资质代替原版职位加成。</p>
    </section>
  </section>
  <section class="city-finance-book">
    <header><div><span>财务簿</span><h2>本期收支</h2></div><strong class="${view.company.previousNetIncome < 0 ? 'negative' : ''}">上期 ${formatNumber(view.company.previousNetIncome)}</strong></header>
    <div class="city-finance-lines">
      ${view.company.finance.map((item) => `<div><span>${escapeHtml(item.name)}</span><b class="${item.expense ? 'expense' : 'income'}">${item.expense ? '−' : '+'}${formatNumber(item.amount)}</b></div>`).join('')}
    </div>
    <footer>原版七类收支 · 当前在线结算 · 离线暂停</footer>
  </section>
</div>`

export const renderCityPage = (view: CityPageViewModel): string => `<section class="city-layout city-page city-core-page" data-testid="city-page">
  <span class="city-ghost" aria-hidden="true">城</span>
  <header class="city-page-head">
    <div>
      <p class="city-crumb">现世 · <b>跨位面经营</b> · 独立城市</p>
      <h1 class="city-page-title">城市</h1>
      <p class="city-page-latin">CITY · MORTAL WORLD OPERATIONS</p>
    </div>
    <div class="city-foundation-counts" aria-label="原版城市内容规模">
      <span><strong>Lv.${view.cityLevel}</strong>城市等级</span>
      <span><strong>${formatNumber(view.development)}</strong>发展度</span>
      <span><strong>${view.buildingCount}</strong>类建筑</span>
    </div>
  </header>
  <nav class="city-core-tabs" aria-label="城市功能">
    <button type="button" data-action="select-city-section" data-city-section="map" aria-pressed="${view.section === 'map'}">城市地图</button>
    <button type="button" data-action="select-city-section" data-city-section="company" aria-pressed="${view.section === 'company'}">公司总览</button>
    <span>${view.gridColumns}×${view.gridRows} 地块 · ${view.technologyCount} 项科技</span>
  </nav>
  <div class="city-attribute-ribbon" aria-label="城市总属性">
    <span>人口<strong>${formatNumber(view.population)}</strong></span>
    <span>商业<strong>${formatNumber(view.commerce)}</strong></span>
    <span>工业<strong>${formatNumber(view.industry)}</strong></span>
  </div>
  ${view.section === 'map' ? renderMap(view) : renderCompany(view)}
  <footer class="city-page-foot">现世城市经营 · 原版数据与公式驱动 · 未核验操作保持关闭</footer>
</section>`
