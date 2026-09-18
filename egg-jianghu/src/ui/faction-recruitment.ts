import { escapeHtml, formatNumber } from './html'

export interface FactionRecruitmentHeroView {
  heroSourceId: number; heroId: string; factionId: string; name: string; worldId: string; worldName: string
  factionName: string; grade: string; category: string; careerName: string; recruited: boolean
  price: number; resourceName: string; aptitudes: { strength: number; insight: number; constitution: number; agility: number; resolve: number }
  requiredProgress: number; currentProgress: number; unlocked: boolean; actionReason: string | null; ordinaryPool: boolean
  initialStats: {
    maxHp: number; effectiveAgility: number; externalAttack: number; internalAttack: number; externalDefense: number; internalDefense: number
    criticalChance: number; criticalMultiplier: number; lifeSteal: number; accuracy: number; evade: number
    initialEnergy: number; energyRecovery: number; cooldownRate: number; controlResistance: number
  }
}

export interface FactionRecruitmentViewModel {
  worldFilter: string
  worlds: ReadonlyArray<{ id: string; name: string; selected: boolean }>
  heroes: readonly FactionRecruitmentHeroView[]
  detailHero: FactionRecruitmentHeroView | null
}

const progressText = (hero: FactionRecruitmentHeroView): string => hero.unlocked
  ? `关卡进度 ${hero.currentProgress} · 已解锁`
  : `关卡进度 ${hero.currentProgress} / ${hero.requiredProgress}`

const renderRecruitmentHero = (hero: FactionRecruitmentHeroView): string => `<article class="faction-recruitment-card${hero.actionReason === '已邀请' ? ' recruited' : ''}${hero.unlocked ? '' : ' locked'}" data-testid="faction-recruitment-hero-${hero.heroSourceId}" data-world-id="${escapeHtml(hero.worldId)}">
  <span class="faction-recruitment-seal" aria-hidden="true">侠</span><div class="faction-recruitment-copy"><header><h3>${escapeHtml(hero.name)}</h3><span>${hero.ordinaryPool ? '普通池' : hero.unlocked ? '可邀' : '未解锁'}</span></header><p>${escapeHtml(hero.worldName)} · ${escapeHtml(progressText(hero))}</p><p>勇 ${hero.aptitudes.strength}　智 ${hero.aptitudes.insight}　体 ${hero.aptitudes.constitution}　敏 ${hero.aptitudes.agility}　精 ${hero.aptitudes.resolve}</p></div>
  <div class="faction-recruitment-actions"><button type="button" class="faction-recruitment-detail-button" data-action="open-recruit-detail" data-hero-id="${escapeHtml(hero.heroId)}">查看详情</button>${hero.ordinaryPool && hero.actionReason !== '已邀请' ? '<button type="button" data-action="open-ordinary-pool">前往普通池</button>' : hero.actionReason === null ? `<button type="button" data-action="faction-recruit" data-faction-id="${escapeHtml(hero.factionId)}" data-hero-id="${escapeHtml(hero.heroId)}">邀请入队 · ${formatNumber(hero.price)} ${escapeHtml(hero.resourceName)}</button>` : `<button type="button" disabled>${escapeHtml(hero.actionReason)}</button>`}</div>
</article>`

const formatInitialValue = (value: number, suffix = ''): string => `${Number.isInteger(value) ? String(value) : value.toFixed(1)}${suffix}`

const profileStat = (label: string, value: string): string => `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`

const renderDetail = (hero: FactionRecruitmentHeroView | null): string => hero ? `<dialog class="faction-recruitment-detail-dialog" open data-testid="faction-recruitment-detail" aria-labelledby="recruit-detail-title">
  <button type="button" class="faction-recruitment-detail-close" data-action="close-recruit-detail" aria-label="关闭侠客详情">×</button>
  <header class="faction-recruitment-detail-head"><span class="faction-recruitment-seal" aria-hidden="true">侠</span><div><p>${escapeHtml(hero.worldName)} · ${escapeHtml(progressText(hero))}</p><h2 id="recruit-detail-title">${escapeHtml(hero.name)}</h2><p>未培养、未穿戴装备时的初始档案</p></div></header>
  <div class="faction-recruitment-profile-meta"><span>${escapeHtml(hero.grade)}级侠客</span><span>${escapeHtml(hero.category)}之脉</span><span>初始职业 · ${escapeHtml(hero.careerName)}</span><span>来源 · ${escapeHtml(hero.factionName)}</span></div>
  <section class="faction-recruitment-profile-section"><h3>初始战斗属性</h3><div class="faction-recruitment-profile-stats">${[
    profileStat('生命', formatInitialValue(hero.initialStats.maxHp)), profileStat('速度', formatInitialValue(hero.initialStats.effectiveAgility)),
    profileStat('物攻', formatInitialValue(hero.initialStats.externalAttack)), profileStat('法攻', formatInitialValue(hero.initialStats.internalAttack)),
    profileStat('物防', formatInitialValue(hero.initialStats.externalDefense)), profileStat('法防', formatInitialValue(hero.initialStats.internalDefense)),
  ].join('')}</div></section>
  <section class="faction-recruitment-profile-section"><h3>附加与特殊属性</h3><div class="faction-recruitment-profile-stats compact">${[
    profileStat('暴击几率', formatInitialValue(hero.initialStats.criticalChance * 100, '%')), profileStat('暴击伤害', formatInitialValue(hero.initialStats.criticalMultiplier * 100, '%')),
    profileStat('吸血比例', formatInitialValue(hero.initialStats.lifeSteal, '%')), profileStat('命中修正', formatInitialValue(hero.initialStats.accuracy * 100, '%')),
    profileStat('闪避修正', formatInitialValue(hero.initialStats.evade * 100, '%')), profileStat('初始能量', formatInitialValue(hero.initialStats.initialEnergy)),
    profileStat('能量回复', formatInitialValue(hero.initialStats.energyRecovery, '/s')), profileStat('技能冷却', formatInitialValue(hero.initialStats.cooldownRate * 100, '%')),
    profileStat('控制抗性', formatInitialValue(hero.initialStats.controlResistance * 100, '%')),
  ].join('')}</div><p class="faction-recruitment-profile-note">元素、专精与武器属性初始无加成，邀请后可通过武学、装备与培养提升。</p></section>
  <footer class="faction-recruitment-profile-actions"><strong>${hero.ordinaryPool ? '可在商城普通池招募' : `邀请所需：${formatNumber(hero.price)} ${escapeHtml(hero.resourceName)}`}</strong>${hero.recruited ? '<button type="button" data-action="open-recruit-hero-profile">前往侠客页</button>' : '<span>邀请入队后可查看实时培养属性</span>'}</footer>
</dialog>` : ''

export const renderFactionRecruitment = (view: FactionRecruitmentViewModel): string => `
  <section class="faction-recruitment" data-testid="faction-recruitment"><header class="faction-recruitment-head"><div><span>JIANGHU RECRUITMENT</span><h2>招募名册</h2><p>按位面关卡进度解锁 · 位面贡献统一结算</p></div></header>
    <nav class="exchange-world-tabs faction-recruitment-world-tabs" aria-label="招募位面筛选">${view.worlds.map((world) => `<button type="button" class="exchange-chip${world.selected ? ' active' : ''}" data-action="recruitment-world" data-world="${escapeHtml(world.id)}" aria-pressed="${world.selected}">${escapeHtml(world.name)}</button>`).join('')}</nav>
    <div class="faction-recruitment-notice">不再按势力分别招募；推进关卡即可解锁该位面名册，点击卡片可查看侠客资料。</div><div class="faction-recruitment-grid">${view.heroes.map(renderRecruitmentHero).join('') || '<p class="faction-recruitment-empty">当前位面尚无可查看的招募名册</p>'}</div></section>${renderDetail(view.detailHero)}`
