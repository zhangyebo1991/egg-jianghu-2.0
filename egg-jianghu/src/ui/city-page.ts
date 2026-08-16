export interface CityPageViewModel {
  gridColumns: number
  gridRows: number
  buildingCount: number
  technologyCount: number
}

const cityModules = [
  { mark: '地', title: '城市地图与土地', copy: '地块、所有权、买卖、建设、升级、扩建与迁移。' },
  { mark: '司', title: '公司与财务', copy: '注册、资产、职位任命、租金、收支记录与项目建设。' },
  { mark: '业', title: '产业与长期经营', copy: '科研、锻造、合成、展览、修习、驯养、教育与派遣。' },
] as const

export const renderCityPage = (view: CityPageViewModel): string => `<section class="city-layout city-page city-domain-page" data-testid="city-page">
  <span class="city-ghost" aria-hidden="true">城</span>
  <header class="city-page-head">
    <div>
      <p class="city-crumb">现世 · <b>跨位面经营</b> · 独立城市</p>
      <h1 class="city-page-title">城市</h1>
      <p class="city-page-latin">CITY · MORTAL WORLD OPERATIONS</p>
    </div>
    <div class="city-foundation-counts" aria-label="原版城市内容规模">
      <span><strong>${view.gridColumns}×${view.gridRows}</strong>初始地块</span>
      <span><strong>${view.buildingCount}</strong>类建筑</span>
      <span><strong>${view.technologyCount}</strong>项科技</span>
    </div>
  </header>
  <div class="city-domain-intro">
    <div class="city-grid-preview" aria-hidden="true">
      ${Array.from({ length: 36 }, (_, index) => `<i style="--i:${index}"></i>`).join('')}
      <span>现世</span>
    </div>
    <div>
      <span class="towns-kicker">CITY FOUNDATION</span>
      <h2>城市经营将作为独立系统成套开放</h2>
      <p>这里不跟随当前位面切换。土地、公司、建筑、科技与产业队列会共享同一份城市状态，并采用全新存档边界。</p>
      <p>原版价格、租金、生产周期与结算顺序完成复算前，不会提供近似操作或虚构收益。</p>
    </div>
  </div>
  <div class="city-domain-modules">
    ${cityModules.map((module) => `<article>
      <span aria-hidden="true">${module.mark}</span>
      <div><h3>${module.title}</h3><p>${module.copy}</p></div>
      <small>规则核验中</small>
    </article>`).join('')}
  </div>
  <footer class="city-page-foot">现世城市经营 · 原版数据已建档 · 功能按证据逐项开放</footer>
</section>`
