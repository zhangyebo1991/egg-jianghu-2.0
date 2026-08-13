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

export interface CityPageViewModel {
  worldId: string
  worldIndex: number
  worldName: string
  worldCurrency: number
  tavernHeroes: CityTavernHeroView[]
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

export const renderCityPage = (view: CityPageViewModel): string => {
  if (view.tavernHeroes.length === 0) {
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
    </div>
    <footer class="city-page-foot">蛋蛋江湖 2.0 · 城市页 · 本阶段仅开放酒馆</footer>
  </section>`
}
