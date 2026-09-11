import { escapeHtml, formatNumber } from './html'

export type CityPageSection = 'overview' | 'map' | 'company'

export interface CityShopItemView { uid: string; name: string; level: number; quality: number; price: number }
export interface CityShopView {
  tileId: number
  level: number
  enabled: boolean
  status: string
  introStep: number
  cash: number
  revenue: number
  soldCount: number
  experience: number
  customers: number
  capacity: number
  stock: CityShopItemView[]
  availableItems: CityShopItemView[]
  availableCount: number
  page: number
  pageCount: number
  staff: { slot: number; heroId: string | null; name: string; ability: number; progress: number; serving: boolean; seconds: number }[]
  hiringSlot: number | null
  candidates: { id: string; name: string; ability: number; reason: string | null }[]
  receipts: { sequence: number; name: string; amount: number }[]
}

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
  shop: CityShopView
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

const renderShopItem = (item: CityShopItemView, onShelf: boolean, full: boolean): string => `<div class="city-goods-row" data-rarity="${item.quality}">
  <span><strong>${escapeHtml(item.name)}</strong><small>物品等级 ${item.level}</small></span>
  <span class="city-goods-price">${formatNumber(item.price)}<small>现金</small></span>
  <button type="button" data-action="${onShelf ? 'city-unstock' : 'city-stock'}" data-equipment-uid="${escapeHtml(item.uid)}" ${!onShelf && full ? 'disabled' : ''}>${onShelf ? '取回' : '上架'}</button>
</div>`

const renderCityGuide = (shop: CityShopView): string => {
  const scenes = [
    { title: '旧契归来', text: '城门外的尘土尚未拂去，一位老掌柜已等在檐下。他将一串铜钥匙放进你掌心：“这间古玩店，是你家留下的产业。铺子还在，只等有人重新照看。”', button: '接过钥匙' },
    { title: '江湖有宝，城中有市', text: '掌柜推开木窗，日光落在空货架上。“江湖里带回来的闲置装备，可以放到这里出售。现世现金记在店里的账上，与各卷行囊售卖所得的铜钱分开。锁好的、穿在身上的，咱们不动。”', button: '看看如何经营' },
    { title: '开门迎客', text: '“先请一位空闲侠客照看柜台，再摆上货物，客人自会登门。你也能亲自看店，但要先下阵。开门后去别处办事也无妨；离开游戏，铺子便歇下，回来接着做。”掌柜摊开账簿，“第一笔生意，慢慢来。”', button: '开始打理古玩店' },
  ]
  if (shop.introStep < scenes.length) {
    const scene = scenes[shop.introStep]
    return `<section class="city-story" aria-label="进城剧情" data-testid="city-story"><span class="city-story-seal" aria-hidden="true">契</span><div><small>老掌柜 · ${shop.introStep + 1} / 3</small><h2>${scene.title}</h2><p>${scene.text}</p><div class="city-story-actions"><button type="button" data-action="city-intro-next">${scene.button}</button><button type="button" data-action="city-intro-skip">略过叙话</button></div></div></section>`
  }
  const hasStaff = shop.staff.some(worker => worker.heroId)
  const text = shop.soldCount > 0 ? `账簿已有 ${shop.soldCount} 笔生意，累计收入 ${formatNumber(shop.revenue)} 现金。继续补货，便能积攒经营本钱。`
    : !shop.stock.length ? '先备一件闲置装备。下方可直接上架；没有货物时，可去江湖闯荡，再带着战利品回来。'
      : !hasStaff ? '货已上架，再请一位空闲侠客照看柜台。正在阵中或担任代理人的侠客，需要先卸下原职。'
        : !shop.enabled ? '人手和货物已经齐备，开门营业，等候第一位顾客。' : '招牌已经挂起。顾客到店后，店员会接待并出售一件商品，现金立即记入账簿。'
  return `<section class="city-guide" data-testid="city-guide"><div><strong>${shop.soldCount > 0 ? '第一笔生意已成' : '掌柜的叮嘱'}</strong><p>${text}</p></div><button type="button" data-action="city-intro-replay">重温叙话</button></section>`
}

const renderOverview = (view: CityPageViewModel): string => {
  const shop = view.shop
  return `${renderCityGuide(shop)}
  <div class="city-business-ribbon"><span>现世现金<strong data-testid="city-cash">${formatNumber(shop.cash)}</strong></span><span>古玩店收入<strong>${formatNumber(shop.revenue)}</strong></span><span>已售商品<strong>${shop.soldCount} 件</strong></span><span>自有产业<strong>古玩店 · Lv.${shop.level}</strong></span></div>
  <div class="city-business-layout">
    <section class="city-shop-book" aria-label="古玩店经营">
      <header class="city-shop-head"><div><small>旧业新开 · 自有产业</small><h2>古玩店 <span>Lv.${shop.level}</span></h2><p data-testid="city-shop-status">${escapeHtml(shop.status)} · 店内顾客 ${Math.floor(shop.customers)} / 5</p></div><div class="city-shop-controls"><button type="button" data-action="city-toggle" aria-pressed="${shop.enabled}">${shop.enabled ? '打烊' : '开门营业'}</button><button type="button" data-action="city-locate">地图定位</button></div></header>
      <div class="city-staff-grid">${shop.staff.map(worker => `<article class="city-worker"><header><span>店员 ${worker.slot + 1}</span><strong>${escapeHtml(worker.name)}</strong></header>${worker.heroId ? `<p>商业等级 ${worker.ability} · 单客接待约 ${worker.seconds} 秒</p><progress max="100" value="${worker.progress}" aria-label="店员 ${worker.slot + 1} 接待进度"></progress><small>${worker.serving ? `正在接待 · ${Math.floor(worker.progress)}%` : '等待顾客与货物'}</small><button type="button" data-action="city-dismiss" data-slot="${worker.slot}">卸任</button>` : `<p>请空闲侠客照看柜台</p><button type="button" data-action="city-hire-open" data-slot="${worker.slot}">任命店员</button>`}</article>`).join('')}</div>
      ${shop.hiringSlot !== null ? `<section class="city-hiring" aria-label="选择店员"><header><strong>任命店员 ${shop.hiringSlot + 1}</strong><button type="button" data-action="city-hire-close">收起</button></header><p>店员在任期间不能上阵或担任位面代理人。</p>${shop.candidates.map(hero => `<div><span><strong>${escapeHtml(hero.name)}</strong><small>商业等级 ${hero.ability}${hero.reason ? ` · ${escapeHtml(hero.reason)}` : ''}</small></span><button type="button" data-action="city-hire" data-hero-id="${escapeHtml(hero.id)}" data-slot="${shop.hiringSlot}" ${hero.reason ? 'disabled' : ''}>任命</button></div>`).join('')}<button type="button" data-action="city-to-factions">去势力招募侠客</button></section>` : ''}
      <section class="city-goods" aria-label="货架"><header><h3>柜上货物</h3><span>${shop.stock.length} / ${shop.capacity}</span></header><p>营业中由店员出售，显示预计现金售价；未售出前可取回。</p>${shop.stock.length ? shop.stock.map(item => renderShopItem(item, true, false)).join('') : '<div class="city-empty-note">货架尚空，把旅途中用不上的装备带来吧。</div>'}</section>
      <section class="city-goods" aria-label="待上架装备"><header><h3>行囊补货</h3><span>${shop.availableCount} 件可上架</span></header><p>仅列出未锁定、未穿戴装备。上架后移出行囊，售出获得现世现金。</p>${shop.availableItems.length ? shop.availableItems.map(item => renderShopItem(item, false, shop.stock.length >= shop.capacity)).join('') : '<div class="city-empty-note">暂时没有可上架的闲置装备。</div>'}<footer><button type="button" data-action="city-to-stages">去江湖寻货</button><span>${shop.page} / ${shop.pageCount}</span><button type="button" data-action="city-stock-prev" ${shop.page <= 1 ? 'disabled' : ''}>上一页</button><button type="button" data-action="city-stock-next" ${shop.page >= shop.pageCount ? 'disabled' : ''}>下一页</button></footer></section>
    </section>
    <aside class="city-receipts"><header><small>经营账簿</small><h2>生意往来</h2></header><div class="city-receipt-total"><span>累计销售收入</span><strong>${formatNumber(shop.revenue)}</strong><small>现金到账即记账，无需手动领取</small></div>${shop.receipts.length ? shop.receipts.map(receipt => `<article><span>第 ${receipt.sequence} 笔 · 售出</span><strong>${escapeHtml(receipt.name)}</strong><b>+${formatNumber(receipt.amount)} 现金</b></article>`).join('') : '<p class="city-empty-note">账页尚白，静候第一笔生意。</p>'}<footer>显示最近十笔销售<br>游戏运行期间营业 · 关闭游戏后暂停</footer></aside>
  </div>`
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
      ${view.selectedTile.tileId === view.shop.tileId && view.selectedTile.owned ? '<button type="button" data-action="select-city-section" data-city-section="overview">进入古玩店经营</button>' : ''}
      <button type="button" disabled>${view.selectedTile.owned ? '出售土地' : '购买土地'}</button>
      <button type="button" disabled>${view.selectedTile.buildable ? '规划建设' : '升级 / 迁移'}</button>
    </div>
    <small class="city-action-reason">土地买卖、建设与迁移暂未开放</small>
  </aside>
</div>`

const renderCompany = (view: CityPageViewModel): string => `<div class="city-company-layout" data-testid="city-company">
  <section class="city-company-overview">
    <header class="city-company-name">
      <div><span>现世公司</span><h2>${escapeHtml(view.company.name ?? '尚未成立')}</h2></div>
      <button type="button" disabled>${view.company.name ? '公司更名' : '注册公司'}</button>
    </header>
    <p class="city-rule-note">公司注册与更名暂未开放，古玩店可独立营业积攒现金。</p>
    <div class="city-company-metrics">
      <article><span>公司现金</span><strong>${formatNumber(view.company.cash)}</strong></article>
      <article><span>自有土地</span><strong>${view.company.ownedLandCount}</strong></article>
      <article><span>已接入土地价值</span><strong>${formatNumber(view.company.ownedLandValue)}</strong></article>
      <article><span>基础月租</span><strong>${formatNumber(view.company.baseMonthlyRent)}</strong></article>
    </div>
    <section class="city-position-board">
      <header><h3>公司职位</h3><span>暂未开放</span></header>
      <div>${['CEO', '建筑总监', '产业主管'].map((title) => `<article><b>${title}</b><span>暂未任命</span></article>`).join('')}</div>
      <p>古玩店店员可在经营总览中任命。</p>
    </section>
  </section>
  <section class="city-finance-book">
    <header><div><span>财务簿</span><h2>累计收支</h2></div></header>
    <div class="city-finance-lines">
      ${view.company.finance.map((item) => `<div><span>${escapeHtml(item.name)}</span><b class="${item.expense ? 'expense' : 'income'}">${item.expense ? '−' : '+'}${formatNumber(item.amount)}</b></div>`).join('')}
    </div>
    <footer>古玩店销售实时入账 · 游戏关闭后暂停营业</footer>
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
    <button type="button" data-action="select-city-section" data-city-section="overview" aria-pressed="${view.section === 'overview'}">经营总览</button>
    <button type="button" data-action="select-city-section" data-city-section="map" aria-pressed="${view.section === 'map'}">城市地图</button>
    <button type="button" data-action="select-city-section" data-city-section="company" aria-pressed="${view.section === 'company'}">公司总览</button>
    <span>${view.gridColumns}×${view.gridRows} 地块 · ${view.technologyCount} 项科技</span>
  </nav>
  <div class="city-attribute-ribbon" aria-label="城市总属性">
    <span>人口<strong>${formatNumber(view.population)}</strong></span>
    <span>商业<strong>${formatNumber(view.commerce)}</strong></span>
    <span>工业<strong>${formatNumber(view.industry)}</strong></span>
  </div>
  ${view.section === 'overview' ? renderOverview(view) : view.section === 'map' ? renderMap(view) : renderCompany(view)}
  <footer class="city-page-foot">城中一隅 · 江湖之外亦有生计</footer>
</section>`
