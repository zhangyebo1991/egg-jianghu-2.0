import { escapeHtml, formatNumber } from './html'

export interface CityPageViewModel {
  worldId: string
  worldName: string
  worldCurrency: number
  selectedHeroId: string | null
  heroes: Array<{ id: string; name: string }>
  tavernHeroes: Array<{ id: string; name: string; grade: string; cost: number; recruited: boolean }>
  martials: Array<{ id: string; name: string; rarity: string; cost: number; learned: boolean }>
  careerTokens: Array<{ id: string; name: string; tier: string; cost: number; owned: boolean }>
}

export const renderCityPage = (view: CityPageViewModel): string => {
  if (view.tavernHeroes.length === 0 && view.martials.length === 0 && view.careerTokens.length === 0) {
    return `<section class="city-layout empty-page" data-testid="city-page">
      <header class="city-heading panel"><div><small>${escapeHtml(view.worldName)}</small><h1>城中行走</h1></div></header>
      <div class="panel section-empty"><strong>本卷城市暂无可用内容</strong><span>返回关卡继续推进江湖进度。</span></div>
    </section>`
  }
  return `<section class="city-layout" data-testid="city-page">
  <header class="city-heading panel"><div><small>${escapeHtml(view.worldName)}</small><h1>城中行走</h1></div><div><span>本卷货币</span><strong>${formatNumber(view.worldCurrency)}</strong></div></header>
  <label class="hero-picker">传授对象<select data-action="select-hero-input">${view.heroes.map((hero) => `<option value="${hero.id}" ${hero.id === view.selectedHeroId ? 'selected' : ''}>${escapeHtml(hero.name)}</option>`).join('')}</select></label>
  <div class="city-columns">
    <section class="tavern panel"><header><small>酒馆名录</small><strong>明码直接邀请</strong></header>${view.tavernHeroes.map((hero) => `<article data-testid="tavern-${hero.id}"><span data-rarity="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span><div><strong>${escapeHtml(hero.name)}</strong><small>本卷货币 ${hero.cost}</small></div><button type="button" data-action="tavern-recruit" data-hero-id="${hero.id}" ${hero.recruited ? 'disabled' : ''}>${hero.recruited ? '已加入' : '直接邀请'}</button></article>`).join('')}</section>
    <section class="academy panel"><header><small>城市武馆</small><strong>通用武功</strong></header>${view.martials.map((martial) => `<article data-rarity="${escapeHtml(martial.rarity)}"><div><strong>${escapeHtml(martial.name)}</strong><small>${escapeHtml(martial.rarity)} · 本卷货币 ${martial.cost}</small></div><button type="button" data-action="city-martial-learn" data-hero-id="${view.selectedHeroId ?? ''}" data-martial-id="${martial.id}" ${martial.learned ? 'disabled' : ''}>${martial.learned ? '已学习' : '学习'}</button></article>`).join('')}</section>
    <section class="token-shop panel"><header><small>转职信物</small><strong>高阶信物随江湖卷开放</strong></header>${view.careerTokens.map((token) => `<article><div><strong>${escapeHtml(token.name)}</strong><small>${escapeHtml(token.tier)} · 本卷货币 ${token.cost}</small></div><button type="button" data-action="career-buy-token" data-world-id="${view.worldId}" data-token-id="${token.id}" ${token.owned ? 'disabled' : ''}>${token.owned ? '已持有' : '购取'}</button></article>`).join('')}</section>
  </div>
</section>`
}
