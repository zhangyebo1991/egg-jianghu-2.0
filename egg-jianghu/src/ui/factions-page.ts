import { escapeHtml, formatNumber } from './html'
import { careerCategoryIconAsset } from './career-icon-assets'
import type { MartialLore } from '../content/martial-lore'
import { renderFactionExchange, type FactionExchangeViewModel } from './faction-exchange'
import { renderFactionRecruitment, type FactionRecruitmentViewModel } from './faction-recruitment'

export type FactionMartialState = 'learned' | 'next' | 'locked'

export interface FactionMartialView {
  id: string
  name: string
  stage: 1 | 2 | 3 | 4
  rarity: string
  cost: number
  upgradeCost: number
  spCost: number
  availableSp: number
  resourceKind: 'worldCurrency' | 'contribution'
  resourceName: string
  learned: boolean
  level: number
  maxLevel: number
  currentEffect: number | null
  nextEffect: number | null
  currentBuffChance: number | null
  nextBuffChance: number | null
  sourceName: string
  refundableSp: number
  state: FactionMartialState
  energyCost: number
  cooldownMs: number
  power: number
  previousName: string | null
  previousMaxLevel: number | null
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
  exchange: FactionExchangeViewModel | null
  refreshRemainingMs: number
  quests: Array<{
    slot: number
    quest: null | {
      id: string
      taskId: number
      taskName: string
      actionName: string
      targetKind: string
      quality: number
      targetName: string
      progress: number
      targetCount: number
      rewardContribution: number
      rewardReputation: number
      accepted: boolean
      completed: boolean
      settled: boolean
    }
  }>
  branches: Array<{ name: string; martials: FactionMartialView[] }>
  recruitment: FactionRecruitmentViewModel | null
  selectedHeroId: string | null
  selectedHero: FactionRosterHeroView | null
  roster: FactionRosterHeroView[]
  rosterCount: number
  rosterOpen: boolean
  rosterQuery: string
  selectedMartialId: string | null
  selectedMartial: FactionMartialView | null
}

const stageNames = ['初传', '进境', '真传', '秘传'] as const
const stageLetters = ['初', '进', '真', '秘'] as const
const nodePositions = [16, 50, 84, 96] as const
const questRotations = [-1.6, 0.9, -0.7, 1.4, -1.1, 0.6] as const

const romanNumerals = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const

const formatMinutes = (remainingMs: number): number => Math.max(0, Math.ceil(remainingMs / 60_000))

const formatCooldown = (cooldownMs: number): string => `${(cooldownMs / 1000).toFixed(1)}s`

const formatEffect = (value: number): string => Number.isInteger(value) ? formatNumber(value) : value.toFixed(2)

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
  const actionLabel = quest.settled ? '已结' : completed ? '领赏' : accepted ? '放弃' : '揭榜'
  const stateLabel = quest.settled ? '已结' : completed ? '功成' : accepted ? '已揭' : ''
  const isBoss = quest.taskId === 4
  const unit = quest.taskId === 5 ? '件' : quest.taskId === 3 ? '个' : quest.taskId === 2 ? '' : '次'
  return `<article class="faction-notice ${isBoss ? 'boss' : ''} ${accepted ? 'accepted' : ''} ${completed || quest.settled ? 'done' : ''}" style="${style}" data-quest-slot="${slot}" data-testid="quest-slot-${slot}">
    ${stateLabel ? `<span class="faction-stamp ${completed || quest.settled ? 'done' : ''}">${stateLabel}</span>` : ''}
    <div class="faction-notice-top">
      <span class="faction-notice-type">${escapeHtml(quest.taskName)}</span>
      <span class="faction-grade-seal" data-grade="${quest.quality}">${quest.quality}品</span>
    </div>
    <h3>${escapeHtml(quest.targetName)}</h3>
    <p class="faction-notice-scene">${escapeHtml(quest.actionName)} · ${escapeHtml(quest.targetKind)}</p>
    <div class="faction-tally-row">
      <span class="faction-tally" aria-hidden="true">${renderTally(quest.progress, quest.targetCount)}</span>
      <span><b>${formatNumber(quest.progress)}</b> / ${formatNumber(quest.targetCount)} ${unit}</span>
    </div>
    <div class="faction-notice-foot">
      <span class="faction-reward">赏 <b>${formatNumber(quest.rewardContribution)}</b> 贡献 · ${formatNumber(quest.rewardReputation)} 声望</span>
      <button type="button" class="faction-action-button faction-action-${action}" data-action="${action}" data-faction-id="${escapeHtml(factionId)}" data-slot="${slot}"${quest.settled ? ' disabled' : ''}>${actionLabel}</button>
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

const renderRoster = (view: FactionsPageViewModel): string => {
  const rosterRows = view.roster.length > 0
    ? view.roster.map((hero) => `<button type="button" class="faction-roster-row ${hero.selected ? 'active' : ''} ${hero.compatible ? '' : 'dim'}" data-action="select-faction-hero" data-hero-id="${escapeHtml(hero.id)}" data-testid="faction-roster-${escapeHtml(hero.id)}">
        <span class="faction-roster-seal" data-grade="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span>
        <span class="faction-roster-copy"><strong>${escapeHtml(hero.name)}</strong><small>${escapeHtml(hero.factionName)} · ${escapeHtml(hero.category)}脉</small></span>
        <span class="faction-roster-fit ${hero.compatible ? 'ok' : 'no'}">${hero.compatible ? '可传' : '职不符'}</span>
      </button>`).join('')
    : '<p class="faction-roster-empty">江湖无此人</p>'
  return `<div class="faction-roster-pop" data-testid="faction-roster"${view.rosterOpen ? '' : ' hidden'}>
    <header><strong>点将谱</strong><input type="search" data-action="faction-roster-search" value="${escapeHtml(view.rosterQuery)}" placeholder="以名相寻…" autocomplete="off" aria-label="搜索研习对象"></header>
    <div class="faction-roster-list">${rosterRows}</div>
    <footer>已招募侠客 · 共 <b>${view.rosterCount}</b> 人</footer>
  </div>`
}

const renderMartialNode = (martial: FactionMartialView, selected: boolean): string => {
  const resourceCost = martial.learned ? martial.upgradeCost : martial.cost
  const levelLabel = martial.learned ? `Lv.${martial.level}/${martial.maxLevel}` : `Lv.0/${martial.maxLevel}`
  return `<article class="faction-node faction-node-${martial.state} ${selected ? 'selected' : ''}" data-rarity="${escapeHtml(martial.rarity)}" data-stage-name="${stageNames[martial.stage - 1]}" style="--faction-node-left:${nodePositions[martial.stage - 1]}%" data-testid="faction-martial-${escapeHtml(martial.id)}">
    <button type="button" class="faction-node-button" data-action="select-martial" data-martial-id="${escapeHtml(martial.id)}" aria-label="查看${escapeHtml(martial.name)}">
      <span>${stageLetters[martial.stage - 1]}</span><small>${levelLabel}</small>
    </button>
    <strong class="faction-node-name">${escapeHtml(martial.name)}</strong>
    <span class="faction-node-sub"><b>${escapeHtml(martial.rarity)}</b> · <i>${escapeHtml(martial.resourceName)} ${formatNumber(resourceCost)} · ${formatNumber(martial.spCost)} SP</i></span>
  </article>`
}

const renderBranch = (view: FactionsPageViewModel, branch: FactionsPageViewModel['branches'][number]): string => {
  const learned = branch.martials.filter((martial) => martial.learned)
  const furthestStage = learned.reduce((max, martial) => Math.max(max, martial.stage), 0)
  const litPercent = furthestStage > 0 ? nodePositions[furthestStage - 1] : 0
  return `<section class="faction-branch" data-branch="${escapeHtml(branch.name)}">
    <div class="faction-branch-label"><strong>${escapeHtml(branch.name)}</strong><span>${learned.length} / ${branch.martials.length} 已通</span></div>
    <div class="faction-branch-track">
      <svg class="faction-vein-svg" viewBox="0 0 1000 118" preserveAspectRatio="none" aria-hidden="true">
        <path class="faction-vein-base" d="M 16 49 Q 180 29 340 49 Q 500 69 660 49 Q 820 29 984 49"></path>
        <path class="faction-vein-lit" d="M 16 49 Q 180 29 340 49 Q 500 69 660 49 Q 820 29 984 49" style="--faction-lit:${litPercent}%;visibility:${furthestStage > 0 ? 'visible' : 'hidden'}"></path>
      </svg>
      ${branch.martials.map((martial) => renderMartialNode(martial, martial.id === view.selectedMartialId)).join('')}
    </div>
  </section>`
}

const renderEffectLine = (label: string, level: number, effect: number, buffChance: number | null): string =>
  `<span><b>${label} Lv.${level}</b> · 效果值 ${formatEffect(effect)}${buffChance === null ? '' : ` · Buff ${formatEffect(buffChance)}%`}</span>`

const renderMartialDetail = (view: FactionsPageViewModel): string => {
  const martial = view.selectedMartial
  if (!martial) return '<div class="faction-martial-detail empty" data-testid="faction-martial-detail"><span>选择一处经脉节点，查看武功详情</span></div>'
  const action = martial.learned ? 'martial-upgrade' : 'martial-learn'
  const actionCost = martial.learned ? martial.upgradeCost : martial.cost
  const actionLabel = martial.actionDisabled
    ? martial.actionReason ?? (martial.learned ? '暂不可升级' : '暂不可研习')
    : `${martial.learned ? '升级' : '研习'} · ${formatNumber(martial.spCost)} SP + ${martial.resourceName} ${formatNumber(actionCost)}`
  const targetLevel = martial.learned ? martial.level + 1 : 1
  return `<div class="faction-martial-detail ${martial.state}" data-testid="faction-martial-detail">
    <div class="faction-detail-copy">
      <div class="faction-detail-name">${escapeHtml(martial.name)} <small>Lv.${martial.level}/${martial.maxLevel}</small>${martial.origin ? `<span class="faction-detail-origin">${escapeHtml(martial.origin)}</span>` : ''}</div>
      ${martial.description ? `<p class="faction-detail-desc">${escapeHtml(martial.description)}</p>` : ''}
      <div class="faction-detail-stats">
        <span>品阶 <b data-rarity="${escapeHtml(martial.rarity)}">${escapeHtml(martial.rarity)}</b></span>
        <span>来源 <b>${escapeHtml(martial.sourceName)}</b></span>
        <span>耗气 <b>${martial.energyCost}</b></span>
        <span>调息 <b>${formatCooldown(martial.cooldownMs)}</b></span>
        <span>威力 <b>${martial.powerNote ? escapeHtml(martial.powerNote) : martial.power.toFixed(2)}</b></span>
        ${martial.previousName ? `<span>前置 <b>${escapeHtml(martial.previousName)} Lv.${martial.previousMaxLevel ?? 1}</b></span>` : '<span>前置 <b>无</b></span>'}
        <span>职业 <b>${escapeHtml(martial.careerNames.join(' / '))}</b></span>
      </div>
      <div class="faction-detail-effects">
        ${martial.currentEffect === null ? '<span><b>当前</b> · 尚未习得</span>' : renderEffectLine('当前', martial.level, martial.currentEffect, martial.currentBuffChance)}
        ${martial.nextEffect === null ? '<span><b>下一级</b> · 已臻化境</span>' : renderEffectLine('下一级', targetLevel, martial.nextEffect, martial.nextBuffChance)}
      </div>
      ${martial.tags?.length ? `<div class="faction-detail-tags">${martial.tags.map((tag) => `<i>${escapeHtml(tag)}</i>`).join('')}</div>` : ''}
    </div>
    <div class="faction-detail-action">
      <span>${view.selectedHero ? `研习对象 · ${escapeHtml(view.selectedHero.name)} · 可用 ${formatNumber(martial.availableSp)} SP` : '请先选择研习对象'}</span>
      <button type="button" class="faction-learn-button ${martial.learned ? 'upgrade' : ''}" data-action="${action}" data-hero-id="${escapeHtml(view.selectedHeroId ?? '')}" data-martial-id="${escapeHtml(martial.id)}"${martial.actionDisabled ? ' disabled' : ''}>${escapeHtml(actionLabel)}</button>
      ${martial.learned ? `<button type="button" class="faction-forget-button" data-action="martial-forget" data-hero-id="${escapeHtml(view.selectedHeroId ?? '')}" data-martial-id="${escapeHtml(martial.id)}">遗忘 · 返还 ${formatNumber(martial.refundableSp)} SP</button>` : ''}
    </div>
  </div>`
}

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
    <span class="faction-ghost faction-ghost-meridian" aria-hidden="true">脉</span>
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
          <div class="faction-section-title"><h2>悬榜</h2><span>五格悬榜 · <i>揭榜办差</i> · 以功易赏</span></div>
          <div class="faction-incense" title="一炷香尽，未揭之榜尽数更换"><span>一炷香后换榜 · <b>${minutes}</b> 分钟</span><span class="faction-incense-track"><i style="width:${Math.max(0, Math.min(100, (view.refreshRemainingMs / 3_600_000) * 100))}%"></i><em></em></span></div>
        </header>
        <div class="faction-quest-grid">${view.quests.map(({ slot, quest }) => renderQuest(view.selectedFactionId, slot, quest)).join('')}</div>
      </div>
    </section>

    ${view.exchange ? renderFactionExchange(view.exchange) : ''}

    <section class="faction-meridian" data-testid="faction-meridian">
      <header class="faction-section-head faction-meridian-head">
        <div class="faction-section-title"><h2>传承</h2><span>双线行功 · 每线三门 · <i>逐穴打通</i></span></div>
        <div class="faction-disciple"><span class="faction-disciple-label">研习对象</span><button type="button" class="faction-disciple-plate" data-action="toggle-faction-roster" aria-haspopup="dialog" aria-expanded="${view.rosterOpen}">${view.selectedHero ? `<span class="faction-disciple-seal" data-grade="${escapeHtml(view.selectedHero.grade)}">${escapeHtml(view.selectedHero.grade)}</span><strong>${escapeHtml(view.selectedHero.name)}</strong><small>${escapeHtml(view.selectedHero.category)}脉</small><i>⌄</i>` : '<strong>选择侠客</strong><i>⌄</i>'}</button>${renderRoster(view)}</div>
      </header>
      <div class="faction-branch-zone">${view.branches.map((branch) => renderBranch(view, branch)).join('')}</div>
      ${renderMartialDetail(view)}
    </section>

    ${view.recruitment ? renderFactionRecruitment(view.recruitment) : ''}

    <footer class="faction-page-foot">蛋蛋江湖 2.0 · 势力页 · 数据与规则取自游戏真实配置</footer>
  </section>`
}
