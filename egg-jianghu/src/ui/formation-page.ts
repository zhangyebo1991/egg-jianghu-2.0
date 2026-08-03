import { escapeHtml } from './html'

export interface FormationHeroView {
  id: string
  name: string
  grade: string
  level: number
  inFormation: boolean
}

export interface FormationPageViewModel {
  selectedHeroId: string | null
  formation: Array<{ heroId: string; row: 'front' | 'back'; position: 0 | 1 | 2 }>
  heroes: FormationHeroView[]
}

const renderFormationSlots = (view: FormationPageViewModel): string => (['back', 'front'] as const).flatMap((row) =>
  ([0, 1, 2] as const).map((position) => {
    const slot = view.formation.find((item) => item.row === row && item.position === position)
    const hero = slot ? view.heroes.find((item) => item.id === slot.heroId) : undefined
    return `<div class="formation-editor-slot ${hero ? 'filled' : ''}" data-row="${row}" data-position="${position}" data-action="formation-slot-tap" ${hero ? `data-hero-id="${hero.id}" draggable="true"` : ''}>
      <span>${row === 'front' ? '前排' : '后排'} ${position + 1}</span>
      ${hero ? `<strong>${escapeHtml(hero.name)}</strong><small>${escapeHtml(hero.grade)}品</small><button type="button" class="formation-slot-remove" data-action="formation-remove" data-hero-id="${hero.id}" aria-label="下阵 ${escapeHtml(hero.name)}">×</button>` : ''}
    </div>`
  }),
).join('')

export const renderFormationPage = (view: FormationPageViewModel): string => `
  <section class="heroes-layout" data-testid="formation-page">
    <aside class="hero-roster formation-roster panel">
      <header><small>待上阵侠客</small><strong>${view.heroes.length} 人</strong></header>
      <div class="hero-list">${view.heroes.map((hero) => `<button type="button" draggable="true" data-action="formation-select" data-hero-id="${hero.id}" class="hero-row${hero.inFormation ? ' in-formation' : ''}${hero.id === view.selectedHeroId ? ' active' : ''}" data-testid="formation-hero-${hero.id}">
        <span data-rarity="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span><strong>${escapeHtml(hero.name)}</strong><small>侠客 Lv.${hero.level}${hero.inFormation ? ' · 已上阵' : ''}</small>
      </button>`).join('') || '<p>尚无侠客</p>'}</div>
    </aside>
    <section class="hero-workbench">
      <section class="formation-editor panel"><header><small>六侠阵容</small><strong>前后排各三格</strong></header><div class="formation-editor-grid">${renderFormationSlots(view)}</div></section>
    </section>
  </section>`
