import { escapeHtml, formatNumber } from './html'
import { careerCategoryIconAsset } from './career-icon-assets'
import { heroPortraitAsset } from './portrait-assets'
import type { MartialLore } from '../content/martial-lore'

export type FactionMartialState = 'learned' | 'next' | 'locked'

export interface FactionMartialView {
  id: string
  name: string
  stage: 1 | 2 | 3 | 4
  rarity: string
  cost: number
  upgradeCost: number
  learned: boolean
  level: number
  state: FactionMartialState
  energyCost: number
  cooldownMs: number
  power: number
  previousName: string | null
  careerNames: string[]
  careerCompatible: boolean
  affordable: boolean
  actionDisabled: boolean
  actionReason: string | null
  selected: boolean
  description?: string
  origin?: string
  stageName?: string
  powerNote?: string
  tags?: string[]
}

/** 将展示性 lore 富化进武术视图；无 lore 时原样返回，保证旧数据/未覆盖 id 不崩 */
export const withLore = (view: FactionMartialView, lore?: MartialLore): FactionMartialView =>
  lore
    ? {
      ...view,
      description: lore.description,
      origin: lore.origin,
      stageName: lore.stageName,
      powerNote: lore.powerNote,
      tags: lore.tags.slice(),
    }
    : view

export interface FactionRosterHeroView {
  id: string
  name: string
  grade: string
  category: string
  factionName: string
  compatible: boolean
  selected: boolean
  isPlayer: boolean
}

export interface FactionSelectorView {
  id: string
  name: string
  category: string
  branchNames: [string, string]
  contribution: number
  selected: boolean
}

export interface FactionsPageViewModel {
  worldIndex: number
  worldName: string
  selectedFactionId: string
  factions: FactionSelectorView[]
  refreshRemainingMs: number
  quests: Array<{
    slot: number
    quest: null | {
      id: string
      type: 'normal' | 'boss'
      grade: string
      targetName: string
      progress: number
      targetCount: number
      rewardContribution: number
      accepted: boolean
      completed: boolean
    }
  }>
  branches: Array<{ name: string; martials: FactionMartialView[] }>
  factionHeroes: Array<{ id: string; name: string; grade: string; cost: number; recruited: boolean }>
  selectedHeroId: string | null
  selectedHero: FactionRosterHeroView | null
  roster: FactionRosterHeroView[]
  rosterCount: number
  rosterOpen: boolean
  rosterQuery: string
  selectedMartialId: string | null
  selectedMartial: FactionMartialView | null
}

const questRotations = [-1.6, 0.9, -0.7, 1.4, -1.1, 0.6] as const

const romanNumerals = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const

const formatMinutes = (remainingMs: number): number => Math.max(0, Math.ceil(remainingMs / 60_000))

const renderTally = (progress: number, targetCount: number): string => {
  const filled = targetCount > 0 ? Math.min(5, Math.round((progress / targetCount) * 5)) : 0
  return Array.from({ length: 5 }, (_, index) => `<i class="${index < filled ? 'filled' : ''}"></i>`).join('')
}

const renderQuest = (
  factionId: string,
  slot: number,
  quest: FactionsPageViewModel['quests'][number]['quest'],
): string => {
  const rotation = questRotations[slot] ?? 0
  const style = `--faction-rotation:${rotation}deg;--faction-delay:${slot * 70}ms`
  if (!quest) {
    return `<article class="faction-notice faction-notice-empty" style="${style}" data-quest-slot="${slot}" data-testid="quest-slot-${slot}">
      <strong>榜位空悬</strong><span>此榜已揭 · 静待换榜</span>
    </article>`
  }

  const completed = quest.completed
  const accepted = quest.accepted
  const action = completed ? 'quest-claim' : accepted ? 'quest-cancel' : 'quest-accept'
  const actionLabel = completed ? '领赏' : accepted ? '收榜' : '揭榜'
  const stateLabel = completed ? '功成' : accepted ? '已揭' : ''
  return `<article class="faction-notice ${quest.type === 'boss' ? 'boss' : ''} ${accepted ? 'accepted' : ''} ${completed ? 'done' : ''}" style="${style}" data-quest-slot="${slot}" data-testid="quest-slot-${slot}">
    ${stateLabel ? `<span class="faction-stamp ${completed ? 'done' : ''}">${stateLabel}</span>` : ''}
    <div class="faction-notice-top">
      <span class="faction-notice-type">${quest.type === 'boss' ? '首领悬赏' : '江湖悬赏'}</span>
      <span class="faction-grade-seal" data-grade="${escapeHtml(quest.grade)}">${escapeHtml(quest.grade)}</span>
    </div>
    <h3>${escapeHtml(quest.targetName)}</h3>
    <p class="faction-notice-scene">出没于 ${escapeHtml(quest.type === 'boss' ? '关底 · 当前江湖卷' : '沿途 · 当前江湖卷')}</p>
    <div class="faction-tally-row">
      <span class="faction-tally" aria-hidden="true">${renderTally(quest.progress, quest.targetCount)}</span>
      <span><b>${quest.progress}</b> / ${quest.targetCount} 杀</span>
    </div>
    <div class="faction-notice-foot">
      <span class="faction-reward">赏 <b>${formatNumber(quest.rewardContribution)}</b> 贡献</span>
      <button type="button" class="faction-action-button faction-action-${action}" data-action="${action}" data-faction-id="${escapeHtml(factionId)}" data-slot="${slot}">${actionLabel}</button>
    </div>
  </article>`
}

const renderFactionPlaques = (view: FactionsPageViewModel): string => view.factions.map((faction) => `
  <button type="button" class="faction-plaque ${faction.selected ? 'active' : ''}" data-action="select-faction" data-faction-id="${escapeHtml(faction.id)}" data-testid="faction-plaque-${escapeHtml(faction.id)}" aria-pressed="${faction.selected}">
    <span class="faction-plaque-char" aria-hidden="true"><img class="faction-plaque-icon" src="${escapeHtml(careerCategoryIconAsset(faction.category))}" alt="" draggable="false"></span>
    <span class="faction-plaque-main">
      <strong class="faction-plaque-name">${escapeHtml(faction.name)}</strong>
      <span class="faction-plaque-meta"><b>${escapeHtml(faction.category)}</b>${escapeHtml(faction.branchNames.join(' · '))} 双线</span>
    </span>
    <span class="faction-plaque-contrib"><b>${formatNumber(faction.contribution)}</b><small>贡献</small></span>
  </button>`).join('')

const renderCallingCards = (view: FactionsPageViewModel, selected: FactionSelectorView): string => view.factionHeroes.map((hero, index) => `
  <article class="faction-calling-card ${hero.recruited ? 'recruited' : ''}" style="--faction-card-rotation:${[-1.2, 0.8, -0.6][index] ?? 0}deg;--faction-delay:${index * 90}ms" data-testid="faction-hero-${escapeHtml(hero.id)}">
    ${hero.recruited ? '<span class="faction-calling-stamp">已入麾下</span>' : ''}
    <div class="faction-calling-rail"><img class="faction-calling-portrait" src="${escapeHtml(heroPortraitAsset(hero.id, selected.category).url)}" alt="" aria-hidden="true" draggable="false"><span class="faction-calling-grade" data-grade="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span><strong>${escapeHtml(hero.name)}</strong></div>
    <div class="faction-calling-body">
      <p class="faction-calling-title">${escapeHtml(selected.name)} · 拜帖</p>
      <p class="faction-calling-line">${escapeHtml(selected.category)}脉门人，可以贡献为聘邀入麾下。</p>
      <div class="faction-calling-foot"><span>聘 <b>${formatNumber(hero.cost)}</b> 贡献</span><button type="button" class="faction-invite-button" data-action="faction-recruit" data-faction-id="${escapeHtml(view.selectedFactionId)}" data-hero-id="${escapeHtml(hero.id)}"${hero.recruited ? ' disabled' : ''} aria-label="邀请${escapeHtml(hero.name)}">${hero.recruited ? '✓' : '邀'}</button></div>
    </div>
  </article>`).join('')

export const renderFactionsPage = (view: FactionsPageViewModel): string => {
  if (view.factions.length === 0) {
    return `<section class="factions-layout faction-empty-page" data-testid="factions-page">
      <div class="panel section-empty"><strong>本卷暂无可用势力</strong><span>返回关卡继续推进江湖进度。</span></div>
    </section>`
  }

  const selected = view.factions.find((faction) => faction.id === view.selectedFactionId) ?? view.factions[0]
  const minutes = formatMinutes(view.refreshRemainingMs)
  const worldRoman = romanNumerals[view.worldIndex] ?? String(view.worldIndex)
  return `<section class="factions-layout faction-page" data-testid="factions-page">
    <span class="faction-ghost faction-ghost-board" aria-hidden="true">榜</span>
    <span class="faction-ghost faction-ghost-heroes" aria-hidden="true">侠</span>

    <header class="faction-page-head">
      <div>
        <p class="faction-crumb">第${view.worldIndex}卷 · <b>${escapeHtml(view.worldName)}</b> · 江湖${view.factions.length}派</p>
        <h1 class="faction-page-title" data-testid="faction-page-title">势力</h1>
        <p class="faction-page-latin">FACTIONS · ${escapeHtml(view.worldName)} VOLUME ${worldRoman}</p>
      </div>
      <div class="faction-purse" data-testid="faction-purse">
        <svg width="34" height="30" viewBox="0 0 34 30" fill="none" aria-hidden="true"><path d="M17 3C10 3 5 8 4.5 14C4 20 9 26 17 26C25 26 30 20 29.5 14C29 8 24 3 17 3Z" fill="url(#faction-ingot)" stroke="#8f6f3a" stroke-width="1"/><ellipse cx="17" cy="9.5" rx="5.5" ry="3" fill="#f2ddab" opacity=".85"/><defs><linearGradient id="faction-ingot" x1="4" y1="4" x2="30" y2="26"><stop stop-color="#e6c67f"/><stop offset="1" stop-color="#a37e3f"/></linearGradient></defs></svg>
        <div><strong>${formatNumber(selected.contribution)}</strong><span>势力贡献</span><small>${escapeHtml(selected.name)}</small></div>
      </div>
    </header>

    <div class="faction-plaque-row" data-testid="faction-selector">${renderFactionPlaques(view)}</div>

    <section class="faction-board" data-testid="faction-quest-board">
      <div class="faction-board-inner">
        <header class="faction-section-head">
          <div class="faction-section-title"><h2>悬榜</h2><span>六格悬榜 · <i>揭榜追杀</i> · 以功易赏</span></div>
          <div class="faction-incense" title="一炷香尽，未揭之榜尽数更换"><span>一炷香后换榜 · <b>${minutes}</b> 分钟</span><span class="faction-incense-track"><i style="width:${Math.max(0, Math.min(100, (view.refreshRemainingMs / 3_600_000) * 100))}%"></i><em></em></span></div>
        </header>
        <div class="faction-quest-grid">${view.quests.map(({ slot, quest }) => renderQuest(view.selectedFactionId, slot, quest)).join('')}</div>
      </div>
    </section>

    <section class="faction-disciples" data-testid="faction-invite-panel">
      <header class="faction-disciples-head"><div><h2>门人拜帖</h2><span>三席可邀 · 以贡献为聘</span></div></header>
      <div class="faction-calling-cards">${renderCallingCards(view, selected)}</div>
    </section>

    <footer class="faction-page-foot">蛋蛋江湖 2.0 · 势力页 · 数据与规则取自游戏真实配置</footer>
  </section>`
}
