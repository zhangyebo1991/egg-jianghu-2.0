import { escapeHtml, formatNumber } from './html'

export interface FactionRecruitmentHeroView {
  heroSourceId: number; heroId: string; factionId: string; name: string; worldId: string; worldName: string
  price: number; resourceName: string; aptitudes: { strength: number; insight: number; constitution: number; agility: number; resolve: number }
  requiredProgress: number; currentProgress: number; unlocked: boolean; actionReason: string | null; ordinaryPool: boolean
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

const renderDetail = (hero: FactionRecruitmentHeroView | null): string => hero ? `<dialog class="faction-recruitment-detail-dialog" open data-testid="faction-recruitment-detail" aria-labelledby="recruit-detail-title"><button type="button" class="faction-recruitment-detail-close" data-action="close-recruit-detail" aria-label="关闭侠客详情">×</button><span class="faction-recruitment-seal">侠</span><div><p>${escapeHtml(hero.worldName)} · ${escapeHtml(progressText(hero))}</p><h2 id="recruit-detail-title">${escapeHtml(hero.name)}</h2><p>五维禀赋：勇 ${hero.aptitudes.strength}　智 ${hero.aptitudes.insight}　体 ${hero.aptitudes.constitution}　敏 ${hero.aptitudes.agility}　精 ${hero.aptitudes.resolve}</p><strong>${hero.ordinaryPool ? '可在商城普通池招募' : `邀请所需：${formatNumber(hero.price)} ${escapeHtml(hero.resourceName)}`}</strong></div></dialog>` : ''

export const renderFactionRecruitment = (view: FactionRecruitmentViewModel): string => `
  <section class="faction-recruitment" data-testid="faction-recruitment"><header class="faction-recruitment-head"><div><span>JIANGHU RECRUITMENT</span><h2>招募名册</h2><p>按位面关卡进度解锁 · 位面贡献统一结算</p></div></header>
    <nav class="exchange-world-tabs faction-recruitment-world-tabs" aria-label="招募位面筛选">${view.worlds.map((world) => `<button type="button" class="exchange-chip${world.selected ? ' active' : ''}" data-action="recruitment-world" data-world="${escapeHtml(world.id)}" aria-pressed="${world.selected}">${escapeHtml(world.name)}</button>`).join('')}</nav>
    <div class="faction-recruitment-notice">不再按势力分别招募；推进关卡即可解锁该位面名册，点击卡片可查看侠客资料。</div><div class="faction-recruitment-grid">${view.heroes.map(renderRecruitmentHero).join('') || '<p class="faction-recruitment-empty">当前位面尚无可查看的招募名册</p>'}</div></section>${renderDetail(view.detailHero)}`
