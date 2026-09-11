import { heroLifecycleById } from '../content/hero-lifecycle'
import { escapeHtml } from './html'

export const renderHeroLifecycle = (heroId: string, expanded = false): string => {
  const view = heroLifecycleById(heroId)
  if (!view) return ''
  return `<section class="hero-lifecycle" data-testid="hero-lifecycle-${escapeHtml(heroId)}" aria-label="阶段与用途">
    <div class="hero-lifecycle-tags"><strong>${escapeHtml(view.label)}</strong><span>${escapeHtml(view.stage)}</span>${view.jobs.map(job => `<span>${escapeHtml(job)}</span>`).join('')}</div>
    <details data-preserve-open data-testid="hero-lifecycle-details-${escapeHtml(heroId)}"${expanded ? ' open' : ''}><summary>培养与替换建议</summary>
      <p>${escapeHtml(view.training)}</p><p>${escapeHtml(view.replacement)}</p><p>${escapeHtml(view.longTerm)}</p>
    </details>
  </section>`
}
