import { heroPlacement } from '../content/hero-placement'
import { escapeHtml, formatNumber } from './html'

export interface FactionRecruitmentHeroView {
  heroSourceId: number
  heroId: string
  name: string
  requiredReputationLevel: number
  requiredReputationName: string
  price: number
  aptitudes: { strength: number; insight: number; constitution: number; agility: number; resolve: number }
  actionReason: string | null
}

export interface FactionRecruitmentViewModel {
  factionId: string
  factionName: string
  resourceName: string
  balance: number
  reputationLevel: number
  reputationLevelName: string
  heroes: readonly FactionRecruitmentHeroView[]
}

const renderRecruitmentHero = (
  view: FactionRecruitmentViewModel,
  hero: FactionRecruitmentHeroView,
): string => `<article class="faction-recruitment-card${hero.actionReason === '已邀请' ? ' recruited' : ''}" data-testid="faction-recruitment-hero-${hero.heroSourceId}">
  <span class="faction-recruitment-seal" aria-hidden="true">侠</span>
  <div class="faction-recruitment-copy">
    <header><h3>${escapeHtml(hero.name)}</h3><span class="hero-tier" data-tier="${heroPlacement(hero.heroId)?.tier ?? ''}">${heroPlacement(hero.heroId)?.tier ?? ''}</span></header>
    <p>${heroPlacement(hero.heroId)?.route === '章节池' ? '获取：商城 · 章节招募' : `声望等级 ${hero.requiredReputationLevel} / 5 · 聘资 ${formatNumber(hero.price)} ${escapeHtml(view.resourceName)}`}</p>
    <p>勇${hero.aptitudes.strength} · 智${hero.aptitudes.insight} · 体${hero.aptitudes.constitution} · 敏${hero.aptitudes.agility} · 精${hero.aptitudes.resolve}</p>
  </div>
  ${hero.actionReason === null
    ? `<button type="button" data-action="faction-recruit" data-faction-id="${escapeHtml(view.factionId)}" data-hero-id="${escapeHtml(hero.heroId)}">邀请入队</button>`
    : `<button type="button" disabled>${escapeHtml(hero.actionReason)}</button>`}
</article>`

export const renderFactionRecruitment = (view: FactionRecruitmentViewModel): string => `
  <section class="faction-recruitment" data-testid="faction-recruitment" data-faction-id="${escapeHtml(view.factionId)}">
    <header class="faction-recruitment-head">
      <div><span>ORIGINAL RECRUITMENT</span><h2>势力招募</h2><p>${escapeHtml(view.factionName)} · 侠客名录</p></div>
      <div class="faction-recruitment-wallet"><strong>${formatNumber(view.balance)}</strong><span>${escapeHtml(view.resourceName)}</span><small>${escapeHtml(view.reputationLevelName)}声望</small></div>
    </header>
    <div class="faction-recruitment-notice">章节兑换侠客沿用声望与聘资要求；章节池侠客前往商城招募。已邀请的侠客及培养进度保留。</div>
    <div class="faction-recruitment-grid">
      ${view.heroes.map((hero) => renderRecruitmentHero(view, hero)).join('')}
    </div>
  </section>`
