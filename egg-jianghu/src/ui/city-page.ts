import { escapeHtml, formatNumber } from './html'

export interface CityTavernHeroView {
  id: string
  name: string
  grade: string
  category: string
  careerName: string
  cost: number
  recruited: boolean
  /** 英雄帖一句话点评，缺省不渲染 */
  line: string | null
}

export interface CityMartialView {
  id: string
  name: string
  rarity: string
  category: string
  cost: number
  energyCost: number
  cooldownMs: number
  power: number
  learned: boolean
  compatible: boolean
  selected: boolean
}

export interface CityTokenView {
  id: string
  name: string
  tier: string
  category: string
  cost: number
  owned: boolean
}

export interface CityLockedTierView {
  tier: string
  cost: number
  minWorld: number
}

export interface CityPageViewModel {
  worldId: string
  worldIndex: number
  worldName: string
  worldCurrency: number
  selectedHeroId: string | null
  selectedHeroName: string | null
  heroes: Array<{ id: string; name: string }>
  tavernHeroes: CityTavernHeroView[]
  martials: CityMartialView[]
  fitCount: number
  careerTokens: CityTokenView[]
  lockedTiers: CityLockedTierView[]
}

const romanNumerals = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const
const noteRotations = [-0.9, 0.7, -0.5, 0.9, -0.7, 0.6] as const

const renderPageHead = (view: CityPageViewModel, withPurse: boolean): string => {
  const worldRoman = romanNumerals[view.worldIndex] ?? String(view.worldIndex)
  return `<header class="city-page-head">
    <div>
      <p class="city-crumb">第${view.worldIndex}卷 · <b>${escapeHtml(view.worldName)}</b> · 城中行走</p>
      <h1 class="city-page-title">城市</h1>
      <p class="city-page-latin">CITY · ${escapeHtml(view.worldName)} VOLUME ${worldRoman}</p>
    </div>
    ${withPurse ? `<div class="city-purse">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="12.5" fill="url(#city-coin)" stroke="#8f6f3a" stroke-width="1"/>
        <rect x="12.2" y="12.2" width="7.6" height="7.6" rx="1" fill="#141812" stroke="#8f6f3a" stroke-width="0.8"/>
        <circle cx="16" cy="16" r="12.5" stroke="#e6c67f" stroke-width="0.6" opacity="0.5"/>
        <defs><linearGradient id="city-coin" x1="4" y1="4" x2="28" y2="28"><stop stop-color="#e6c67f"/><stop offset="1" stop-color="#a37e3f"/></linearGradient></defs>
      </svg>
      <div><strong>${formatNumber(view.worldCurrency)}</strong><span>本卷货币</span><small>${escapeHtml(view.worldName)}通用</small></div>
    </div>` : ''}
  </header>`
}

const renderTavern = (view: CityPageViewModel): string => {
  const waiting = view.tavernHeroes.filter((hero) => !hero.recruited).length
  const grade = view.tavernHeroes[0]?.grade ?? '乙'
  return `<section class="shop shop-tavern">
    <header class="shop-head">
      <span class="shop-sigil sigil-wine" aria-hidden="true">酒</span>
      <div><h2>无名酒馆</h2><span class="sub">酒馆名录 · <i>明码相邀</i> · ${escapeHtml(grade)}级侠客</span></div>
      <div class="head-note">候邀 <b>${waiting}</b> 人<br>每卷${view.tavernHeroes.length}名</div>
    </header>
    <div class="shop-body">
      ${view.tavernHeroes.map((hero, index) => `<article class="hero-note${hero.recruited ? ' recruited' : ''}" style="--rot:${noteRotations[index % noteRotations.length]}deg" data-category="${escapeHtml(hero.category)}" data-testid="tavern-${hero.id}">
        ${hero.recruited ? '<span class="hn-stamp">已入麾下</span>' : ''}
        <div class="hn-rail"><span class="hn-name">${escapeHtml(hero.name)}</span><span class="hn-grade">${escapeHtml(hero.grade)}</span></div>
        <div class="hn-body">
          <div class="hn-tags"><span class="hn-cat">${escapeHtml(hero.category)}脉</span><span class="hn-role">${escapeHtml(hero.careerName)} · 坐馆相候</span></div>
          ${hero.line ? `<p class="hn-line">${escapeHtml(hero.line)}</p>` : ''}
          <div class="hn-foot">
            <span class="hn-cost">聘资 <b>${formatNumber(hero.cost)}</b> 本卷货币</span>
            <button type="button" class="btn-invite" data-action="tavern-recruit" data-hero-id="${hero.id}" aria-label="${hero.recruited ? '已加入' : '直接邀请'}" ${hero.recruited ? 'disabled' : ''}>邀</button>
          </div>
        </div>
      </article>`).join('')}
    </div>
  </section>`
}

const renderAcademy = (view: CityPageViewModel): string => {
  const first = view.martials[0]
  const selected = view.martials.find((martial) => martial.selected) ?? first
  return `<section class="shop shop-academy">
    <header class="shop-head">
      <span class="shop-sigil sigil-martial" aria-hidden="true">武</span>
      <div><h2>城南武馆</h2><span class="sub">城市武馆 · 通用武功 · <i>${escapeHtml(first?.rarity ?? '')}${view.martials.length}册</i></span></div>
      <div class="head-note">每册 <b>${formatNumber(first?.cost ?? 0)}</b><br>择人而传</div>
    </header>
    <div class="shop-body">
      <div class="tutor-bar">
        <span class="tutor-label">传授对象</span>
        <select class="tutor-select" data-action="select-hero-input" aria-label="传授对象">${view.heroes.map((hero) => `<option value="${hero.id}" ${hero.id === view.selectedHeroId ? 'selected' : ''}>${escapeHtml(hero.name)}</option>`).join('')}</select>
        <span class="tutor-hint">脉路相合 <b>${view.fitCount}</b> / ${view.martials.length} 册</span>
      </div>
      <div class="shelf-wrap"><div class="shelf">
        ${view.martials.map((martial) => `<button type="button" class="book${martial.selected ? ' selected' : ''}${martial.compatible ? '' : ' dim'}" data-category="${escapeHtml(martial.category)}" data-action="select-city-martial" data-martial-id="${martial.id}" data-testid="city-martial-${martial.id}" title="${escapeHtml(martial.name)}">
          ${martial.learned ? '<span class="b-learned">已研习</span>' : ''}
          <span class="b-tag">${escapeHtml(martial.name)}</span>
          <span class="b-rarity">${escapeHtml(martial.rarity)}</span>
        </button>`).join('')}
      </div></div>
      ${selected ? `<div class="book-detail">
        <div>
          <div class="bd-head">
            <span class="bd-name">${escapeHtml(selected.name)}</span>
            <span class="bd-rarity">${escapeHtml(selected.rarity)}</span>
            <span class="bd-fit ${selected.compatible ? 'ok' : 'no'}">${selected.compatible ? `脉路相合 · 可传${escapeHtml(view.selectedHeroName ?? '')}` : `${escapeHtml(view.selectedHeroName ?? '所选侠客')}非${escapeHtml(selected.category)}脉 · 不可传`}</span>
          </div>
          <div class="bd-stats">
            <span>耗能 <b>${selected.energyCost}</b></span>
            <span>冷却 <b>${(selected.cooldownMs / 1000).toFixed(1)} 秒</b></span>
            <span>威力 <b>×${selected.power.toFixed(2)}</b></span>
            <span class="bd-cost">束脩 <b>${formatNumber(selected.cost)}</b> 本卷货币</span>
          </div>
        </div>
        <button type="button" class="btn-learn" data-action="city-martial-learn" data-hero-id="${view.selectedHeroId ?? ''}" data-martial-id="${selected.id}" ${selected.learned || !selected.compatible ? 'disabled' : ''}>${selected.learned ? '已学习' : selected.compatible ? '学习' : '脉路不合'}</button>
      </div>` : ''}
    </div>
  </section>`
}

const renderPawnShop = (view: CityPageViewModel): string => {
  const tiers = [...new Set(view.careerTokens.map((token) => token.tier))]
  const first = view.careerTokens[0]
  return `<section class="shop shop-pawn">
    <header class="shop-head">
      <span class="shop-sigil sigil-pawn" aria-hidden="true">当</span>
      <div><h2>恒昌当铺</h2><span class="sub">转职信物 · <i>${tiers.join('·')}现货</i> · 高阶随卷</span></div>
      <div class="head-note">${escapeHtml(first?.tier ?? '')} <b>${formatNumber(first?.cost ?? 0)}</b><br>每人一枚</div>
    </header>
    <div class="shop-body">
      <div class="token-grid">
        ${view.careerTokens.map((token) => `<button type="button" class="token-cell${token.owned ? ' owned' : ''}" data-category="${escapeHtml(token.category)}" data-action="career-buy-token" data-world-id="${view.worldId}" data-token-id="${token.id}" ${token.owned ? 'disabled' : ''}>
          ${token.owned ? '<span class="t-owned-mark">已持</span>' : ''}
          <span class="jade-ring" aria-hidden="true"></span>
          <span class="t-name">${escapeHtml(token.name)}</span>
          <span class="t-price">${escapeHtml(token.tier)} · ${formatNumber(token.cost)}</span>
        </button>`).join('')}
      </div>
      ${view.lockedTiers.map((locked) => `<div class="locked-row">
        <span class="lock-mark" aria-hidden="true">🔒</span>
        <span class="lr-name">${escapeHtml(locked.tier)}信物</span>
        <span class="lr-meta">第${locked.minWorld}卷江湖启 · <b>${formatNumber(locked.cost)}</b></span>
      </div>`).join('')}
    </div>
  </section>`
}

export const renderCityPage = (view: CityPageViewModel): string => {
  if (view.tavernHeroes.length === 0 && view.martials.length === 0 && view.careerTokens.length === 0) {
    return `<section class="city-layout city-page city-page-empty" data-testid="city-page">
      ${renderPageHead(view, false)}
      <div class="city-empty-note"><strong>本卷城市暂无可用内容</strong><span>返回关卡继续推进江湖进度。</span></div>
    </section>`
  }
  return `<section class="city-layout city-page" data-testid="city-page">
    <span class="city-ghost" aria-hidden="true">城</span>
    ${renderPageHead(view, true)}
    <div class="street">
      ${renderTavern(view)}
      ${renderAcademy(view)}
      ${renderPawnShop(view)}
    </div>
    <footer class="city-page-foot">蛋蛋江湖 2.0 · 城市页 · 数据与规则取自游戏真实配置</footer>
  </section>`
}
