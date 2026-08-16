import { escapeHtml, formatNumber } from './html'

export interface TownTavernHeroView {
  id: string
  name: string
  grade: string
  category: string
  careerName: string
  cost: number
  recruited: boolean
  line: string | null
}

export interface TownLocationView {
  name: string
  npcTitle: string | null
  functions: readonly string[]
  tavern: boolean
}

export interface FactionTownView {
  name: string
  factionId: string
  factionName: string
  unlocked: boolean
  functions: readonly string[]
}

export interface TownsPageViewModel {
  worldIndex: number
  worldName: string
  mainCityName: string
  worldCurrency: number
  publicLocations: readonly TownLocationView[]
  factionTowns: readonly FactionTownView[]
  tavernHeroes: readonly TownTavernHeroView[]
}

const noteRotations = [-0.9, 0.7, -0.5, 0.9, -0.7, 0.6] as const

const renderPageHead = (view: TownsPageViewModel): string => `<header class="city-page-head towns-page-head">
  <div>
    <p class="city-crumb">第${view.worldIndex}卷 · <b>${escapeHtml(view.worldName)}</b> · ${escapeHtml(view.mainCityName)}</p>
    <h1 class="city-page-title" data-testid="towns-page-title">城镇</h1>
    <p class="city-page-latin">TOWNS · ORIGINAL PLANE SETTLEMENTS</p>
  </div>
  <div class="city-purse" data-testid="towns-purse">
    <span class="towns-coin" aria-hidden="true">钱</span>
    <div><strong>${formatNumber(view.worldCurrency)}</strong><span>本卷货币</span><small>${escapeHtml(view.worldName)}通用</small></div>
  </div>
</header>`

const renderFunctionTags = (functions: readonly string[]): string =>
  functions.map((name) => `<span>${escapeHtml(name)}</span>`).join('')

const renderPublicLocations = (view: TownsPageViewModel): string => `<section class="towns-section" aria-labelledby="towns-public-title">
  <header class="towns-section-head">
    <div><span class="towns-kicker">MAIN CITY</span><h2 id="towns-public-title">${escapeHtml(view.mainCityName)} · 公共场所</h2></div>
    <p>原版主城固定连接五处公共场所；已确认入口完整保留。</p>
  </header>
  <div class="town-place-grid" data-testid="town-public-locations">
    ${view.publicLocations.map((location, index) => `<article class="town-place-card${location.tavern ? ' active' : ''}" data-testid="town-location-${index}">
      <span class="town-place-mark" aria-hidden="true">${escapeHtml(location.name.slice(0, 1))}</span>
      <div class="town-place-copy">
        <header><h3>${escapeHtml(location.name)}</h3>${location.npcTitle ? `<small>${escapeHtml(location.npcTitle)}坐馆</small>` : ''}</header>
        <div class="town-function-tags">${renderFunctionTags(location.functions)}</div>
        <p>${location.tavern ? '侠客名录已开放，可在下方直接邀请。' : '场所资料已录入；操作将在原版规则复算后开放。'}</p>
      </div>
      <span class="town-place-state${location.tavern ? ' ready' : ''}">${location.tavern ? '已开放' : '暂不可用'}</span>
    </article>`).join('')}
  </div>
</section>`

const renderFactionTowns = (view: TownsPageViewModel): string => `<section class="towns-section" aria-labelledby="towns-faction-title">
  <header class="towns-section-head">
    <div><span class="towns-kicker">FACTION TOWNS</span><h2 id="towns-faction-title">势力城镇</h2></div>
    <p>阵营任务、技能学习、贡献兑换与势力招募共用同一套势力状态。</p>
  </header>
  <div class="faction-town-grid" data-testid="faction-towns">
    ${view.factionTowns.map((town) => `<article class="faction-town-card${town.unlocked ? '' : ' locked'}" data-testid="faction-town-${escapeHtml(town.factionId)}">
      <header><span class="faction-town-seal" aria-hidden="true">镇</span><div><h3>${escapeHtml(town.name)}</h3><p>${escapeHtml(town.factionName)}</p></div></header>
      <div class="town-function-tags">${renderFunctionTags(town.functions)}</div>
      ${town.unlocked
        ? `<button type="button" data-action="open-faction-town" data-faction-id="${escapeHtml(town.factionId)}">查看势力总览</button>`
        : '<p class="faction-town-lock">本存档尚未解锁此势力</p>'}
    </article>`).join('')}
  </div>
</section>`

const renderTavern = (view: TownsPageViewModel): string => {
  const tavern = view.publicLocations.find((location) => location.tavern)
  if (!tavern) return ''
  const waiting = view.tavernHeroes.filter((hero) => !hero.recruited).length
  const grade = view.tavernHeroes[0]?.grade ?? '本卷'
  return `<section class="shop shop-tavern towns-tavern" data-testid="town-tavern">
    <header class="shop-head">
      <span class="shop-sigil sigil-wine" aria-hidden="true">酒</span>
      <div><h2>${escapeHtml(tavern.name)}</h2><span class="sub">侠客名录 · <i>明码相邀</i> · ${escapeHtml(grade)}级侠客</span></div>
      <div class="head-note">候邀 <b>${waiting}</b> 人<br>每卷${view.tavernHeroes.length}名</div>
    </header>
    <div class="shop-body">
      ${view.tavernHeroes.length === 0
        ? '<div class="towns-tavern-empty"><strong>当前没有候邀侠客</strong><span>名录将随原版角色接入继续补全。</span></div>'
        : view.tavernHeroes.map((hero, index) => `<article class="hero-note${hero.recruited ? ' recruited' : ''}" style="--rot:${noteRotations[index % noteRotations.length]}deg" data-category="${escapeHtml(hero.category)}" data-testid="tavern-${escapeHtml(hero.id)}">
          ${hero.recruited ? '<span class="hn-stamp">已入麾下</span>' : ''}
          <div class="hn-rail"><span class="hn-name">${escapeHtml(hero.name)}</span><span class="hn-grade">${escapeHtml(hero.grade)}</span></div>
          <div class="hn-body">
            <div class="hn-tags"><span class="hn-cat">${escapeHtml(hero.category)}脉</span><span class="hn-role">${escapeHtml(hero.careerName)} · 坐馆相候</span></div>
            ${hero.line ? `<p class="hn-line">${escapeHtml(hero.line)}</p>` : ''}
            <div class="hn-foot">
              <span class="hn-cost">聘资 <b>${formatNumber(hero.cost)}</b> 本卷货币</span>
              <button type="button" class="btn-invite" data-action="tavern-recruit" data-hero-id="${escapeHtml(hero.id)}" aria-label="${hero.recruited ? '已加入' : '直接邀请'}" ${hero.recruited ? 'disabled' : ''}>邀</button>
            </div>
          </div>
        </article>`).join('')}
    </div>
  </section>`
}

export const renderTownsPage = (view: TownsPageViewModel): string => `<section class="city-layout city-page towns-page" data-testid="towns-page">
  <span class="city-ghost" aria-hidden="true">镇</span>
  ${renderPageHead(view)}
  <div class="towns-scroll">
    ${renderPublicLocations(view)}
    ${renderFactionTowns(view)}
    ${renderTavern(view)}
  </div>
  <footer class="city-page-foot">原版城镇 · ${view.publicLocations.length} 处公共场所 · ${view.factionTowns.length} 座势力城镇</footer>
</section>`
