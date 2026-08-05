import { escapeHtml, formatNumber } from './html'

export interface FactionMartialView {
  id: string
  name: string
  stage: 1 | 2 | 3 | 4
  rarity: string
  cost: number
  learned: boolean
  level: number
}

export interface FactionsPageViewModel {
  selectedFactionId: string
  factions: Array<{ id: string; name: string; category: string; contribution: number; selected: boolean }>
  refreshRemainingMs: number
  quests: Array<{ slot: number; quest: null | { id: string; type: 'normal' | 'boss'; grade: string; targetName: string; progress: number; targetCount: number; rewardContribution: number; accepted: boolean; completed: boolean } }>
  branches: Array<{ name: string; martials: FactionMartialView[] }>
  factionHeroes: Array<{ id: string; name: string; grade: string; cost: number; recruited: boolean }>
  selectedHeroId: string | null
}

const stageNames = ['初传', '进境', '真传', '秘传'] as const

const renderQuest = (factionId: string, slot: number, quest: FactionsPageViewModel['quests'][number]['quest']): string => `<article class="quest-card ${quest?.accepted ? 'accepted' : ''}" data-quest-slot="${slot}" data-testid="quest-slot-${slot}">
  ${quest ? `<header><span data-rarity="${escapeHtml(quest.grade)}">${escapeHtml(quest.grade)}</span><strong>${quest.type === 'boss' ? '首领悬赏' : '江湖悬赏'}</strong></header><p>${escapeHtml(quest.targetName)}</p><div><span>${quest.progress} / ${quest.targetCount}</span><strong>贡献 ${quest.rewardContribution}</strong></div>
    ${quest.accepted ? quest.completed ? `<button type="button" data-action="quest-claim" data-faction-id="${factionId}" data-slot="${slot}">领取</button>` : `<button type="button" data-action="quest-cancel" data-faction-id="${factionId}" data-slot="${slot}">取消</button>` : `<button type="button" data-action="quest-accept" data-faction-id="${factionId}" data-slot="${slot}">接受</button>`}
  ` : '<strong>待刷新</strong><span>此格暂无悬榜</span>'}
</article>`

export const renderFactionsPage = (view: FactionsPageViewModel): string => {
  if (view.factions.length === 0) {
    return `<section class="factions-layout empty-page" data-testid="factions-page">
      <div class="panel section-empty"><strong>本卷暂无可用势力</strong><span>返回关卡继续推进江湖进度。</span></div>
    </section>`
  }
  const selected = view.factions.find((faction) => faction.id === view.selectedFactionId) ?? view.factions[0]
  const minutes = Math.max(0, Math.ceil(view.refreshRemainingMs / 60_000))
  return `<section class="factions-layout" data-testid="factions-page">
    <aside class="faction-rail panel"><header><small>十卷势力</small><strong>${selected ? escapeHtml(selected.name) : '未解锁'}</strong></header>${view.factions.map((faction) => `<button type="button" data-action="select-faction" data-faction-id="${faction.id}" class="${faction.id === selected?.id ? 'active' : ''}"><span>${escapeHtml(faction.category)}</span><strong>${escapeHtml(faction.name)}</strong><small>${formatNumber(faction.contribution)}</small></button>`).join('')}</aside>
    <div class="faction-content">
      <section class="quest-board panel"><header><div><small>六格悬榜</small><h1>${escapeHtml(selected?.name ?? '势力')}悬榜</h1></div><span>${minutes} 分钟后刷新未接任务</span></header><div class="quest-grid">${view.quests.map(({ slot, quest }) => renderQuest(view.selectedFactionId, slot, quest)).join('')}</div></section>
      <section class="inheritance panel"><header><small>双线传承</small><strong>初传至秘传</strong></header><div class="branch-grid">${view.branches.map((branch) => `<section><h2>${escapeHtml(branch.name)}</h2>${branch.martials.map((martial) => `<article data-rarity="${escapeHtml(martial.rarity)}"><span>${stageNames[martial.stage - 1]}</span><div><strong>${escapeHtml(martial.name)}</strong><small>${escapeHtml(martial.rarity)} · 贡献 ${martial.cost}${martial.learned ? ` · Lv.${martial.level}` : ''}</small></div><button type="button" data-action="${martial.learned ? 'martial-upgrade' : 'martial-learn'}" data-hero-id="${view.selectedHeroId ?? ''}" data-martial-id="${martial.id}">${martial.learned ? '升级' : '学习'}</button></article>`).join('')}</section>`).join('')}</div></section>
      ${view.factionHeroes.length > 0 ? `<section class="faction-invite panel"><header><small>势力侠客</small><strong>三席可邀</strong></header><div class="faction-invite-list">${view.factionHeroes.map((hero) => `<article data-testid="faction-hero-${hero.id}"><span data-rarity="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span><div><strong>${escapeHtml(hero.name)}</strong><small>贡献 ${hero.cost}</small></div><button type="button" data-action="faction-recruit" data-faction-id="${view.selectedFactionId}" data-hero-id="${hero.id}" ${hero.recruited ? 'disabled' : ''}>${hero.recruited ? '已加入' : '直接邀请'}</button></article>`).join('')}</div></section>` : ''}
    </div>
  </section>`
}
