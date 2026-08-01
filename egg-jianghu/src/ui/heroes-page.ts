import { escapeHtml } from './html'

export interface HeroesHeroView {
  id: string
  name: string
  grade: string
  recruited: boolean
  level: number
  careerId: string
  careerName: string
  careerLevel: number
  careerPerfected: boolean
  availableCareerIds: string[]
  learnedMartials: Array<{ id: string; name: string; rarity: string; level: number }>
  equippedMartialIds: [string | null, string | null, string | null, string | null]
  heartMethodId: string | null
}

export interface HeroesCareerView {
  id: string
  name: string
  tier: string
  owned: boolean
  tokenOwned: boolean
}

export interface HeroesPageViewModel {
  selectedHeroId: string | null
  formation: Array<{ heroId: string; row: 'front' | 'back'; position: 0 | 1 | 2 }>
  heroes: HeroesHeroView[]
  careers: HeroesCareerView[]
  martials: Array<{ id: string; name: string; rarity: string; level: number; learned: boolean }>
  heartMethods: Array<{ id: string; name: string; equipped: boolean }>
}

const renderFormation = (view: HeroesPageViewModel): string => (['back', 'front'] as const).flatMap((row) =>
  ([0, 1, 2] as const).map((position) => {
    const slot = view.formation.find((item) => item.row === row && item.position === position)
    const hero = slot ? view.heroes.find((item) => item.id === slot.heroId) : undefined
    return `<div class="formation-editor-slot ${hero ? 'filled' : ''}" data-row="${row}" data-position="${position}">
      <span>${row === 'front' ? '前排' : '后排'} ${position + 1}</span>
      ${hero ? `<button type="button" data-action="select-hero" data-hero-id="${hero.id}"><strong>${escapeHtml(hero.name)}</strong><small>${escapeHtml(hero.grade)}品</small></button>
        <button type="button" class="text-action" data-action="formation-remove" data-hero-id="${hero.id}">下阵</button>`
        : `<button type="button" class="text-action" data-action="formation-place" data-target-row="${row}" data-position="${position}" data-hero-id="${view.selectedHeroId ?? ''}">置入所选侠客</button>`}
    </div>`
  }),
).join('')

export const renderHeroesPage = (view: HeroesPageViewModel): string => {
  const selected = view.heroes.find((hero) => hero.id === view.selectedHeroId) ?? view.heroes[0]
  return `<section class="heroes-layout" data-testid="heroes-page">
    <aside class="hero-roster panel">
      <header><small>已邀侠客</small><strong>${view.heroes.length} 人</strong></header>
      <div class="hero-list">${view.heroes.map((hero) => `<button type="button" data-action="select-hero" data-hero-id="${hero.id}" data-testid="hero-${hero.id}" class="hero-row${hero.id === selected?.id ? ' active' : ''}">
        <span data-rarity="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span><strong>${escapeHtml(hero.name)}</strong><small>侠客 Lv.${hero.level}</small>
      </button>`).join('')}</div>
    </aside>
    <section class="hero-workbench">
      <section class="formation-editor panel"><header><small>六侠阵容</small><strong>前后排各三格</strong></header><div class="formation-editor-grid">${renderFormation(view)}</div></section>
      ${selected ? `<section class="hero-detail panel" data-testid="selected-hero">
        <header><div><small>${escapeHtml(selected.grade)}品侠客</small><h1>${escapeHtml(selected.name)}</h1></div><strong>侠客 Lv.${selected.level}</strong></header>
        <div class="career-summary"><span>当前职业</span><strong>${escapeHtml(selected.careerName)}</strong><em>职业 Lv.${selected.careerLevel}</em>
          <button type="button" data-action="career-perfect" data-hero-id="${selected.id}" data-career-id="${selected.careerId}" ${selected.careerLevel < 20 || selected.careerPerfected ? 'disabled' : ''}>${selected.careerPerfected ? '圆满心得已领悟' : '领悟圆满心得'}</button>
        </div>
        <div class="career-options"><h2>转职与切换</h2>${view.careers.map((career) => `<article><span>${escapeHtml(career.tier)}</span><strong>${escapeHtml(career.name)}</strong><small>${career.owned ? '已解锁' : career.tokenOwned ? '信物已备' : '缺少信物'}</small><button type="button" data-action="career-change" data-hero-id="${selected.id}" data-career-id="${career.id}">${career.owned ? '切换' : '转职'}</button></article>`).join('')}</div>
        <div class="martial-workbench"><h2>四槽武功 · 优先级</h2><div class="martial-slots">${selected.equippedMartialIds.map((martialId, slot) => `<article data-testid="martial-slot-${slot + 1}"><span>${slot + 1}</span><strong>${escapeHtml(view.martials.find((item) => item.id === martialId)?.name ?? '空槽')}</strong>${martialId ? `<button type="button" data-action="martial-unequip" data-hero-id="${selected.id}" data-slot="${slot}">卸下</button>` : ''}</article>`).join('')}</div>
          <div class="learned-martials">${selected.learnedMartials.map((martial) => `<article data-rarity="${escapeHtml(martial.rarity)}"><div><strong>${escapeHtml(martial.name)}</strong><small>${escapeHtml(martial.rarity)} · Lv.${martial.level}</small></div><button type="button" data-action="martial-upgrade" data-hero-id="${selected.id}" data-martial-id="${martial.id}">升级</button>${[0, 1, 2, 3].map((slot) => `<button type="button" data-action="martial-equip" data-hero-id="${selected.id}" data-martial-id="${martial.id}" data-slot="${slot}">槽 ${slot + 1}</button>`).join('')}<button type="button" data-action="martial-forget" data-hero-id="${selected.id}" data-martial-id="${martial.id}">遗忘返还 80%</button></article>`).join('') || '<p>尚未学会武功</p>'}</div>
        </div>
        <div class="heart-methods"><h2>主修心法</h2>${view.heartMethods.map((method) => `<button type="button" data-action="heart-method-equip" data-hero-id="${selected.id}" data-heart-method-id="${method.id}" class="${method.equipped ? 'active' : ''}">${escapeHtml(method.name)}</button>`).join('') || '<span>尚无可用心法</span>'}</div>
      </section>` : '<section class="hero-detail panel"><strong>尚无侠客</strong><span>前往城市酒馆直接邀请。</span></section>'}
    </section>
  </section>`
}
