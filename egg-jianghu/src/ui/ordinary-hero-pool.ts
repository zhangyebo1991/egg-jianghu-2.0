import type { HeroDefinitionV10 } from '../content/heroes'
import { careerById } from '../content/careers'
import { ORIGINAL_ABILITY_NAMES, originalHeroAbilityBase } from '../content/original-hero-abilities.generated'
import { buildCombatStats } from '../combat/stats'
import { createHeroProgress } from '../domain/state'
import { heroPortraitAsset } from './portrait-assets'
import { escapeHtml, formatNumber } from './html'

export interface OrdinaryPoolHeroView {
  hero: HeroDefinitionV10
  baseProbability: number
  nextProbability: number
}
export interface OrdinaryPoolView {
  heroes: OrdinaryPoolHeroView[]
  selectedId: string | null
  balance: number
  cost: number
  heroRate: number
  pityRemaining: number
  hasLockedHeroes: boolean
  results: Array<{ name: string; amount: number; hero: boolean }>
  materialNames: string[]
}

const percent = (value: number): string => `${Number((value * 100).toFixed(6))}%`
const renderPreview = ({ hero }: OrdinaryPoolHeroView): string => {
  const progress = createHeroProgress(hero.baseCareerId)
  const stats = buildCombatStats(hero, progress)
  const rows = (values: Array<[string, number]>) => values.map(([label, value]) => `<div><dt>${label}</dt><dd>${Number(value.toFixed(2)).toLocaleString('zh-CN')}</dd></div>`).join('')
  return `<section class="ordinary-pool-preview" aria-label="侠客属性" data-testid="ordinary-pool-preview">
    <header><img src="${escapeHtml(heroPortraitAsset(hero.id).url)}" alt="${escapeHtml(hero.name)}"/><div><h3>${escapeHtml(hero.name)}</h3><p>${escapeHtml(careerById(hero.baseCareerId)?.name ?? '白丁')} Lv.1 · 初始面板</p></div></header>
    <h4>资质</h4><dl>${rows([['勇', hero.aptitudes.strength], ['智', hero.aptitudes.insight], ['体', hero.aptitudes.constitution], ['敏', hero.aptitudes.agility], ['精', hero.aptitudes.resolve]])}</dl>
    <h4>战斗属性</h4><dl>${rows([['生命', stats.maxHp], ['物攻', stats.externalAttack], ['法攻', stats.internalAttack], ['物防', stats.externalDefense], ['法防', stats.internalDefense], ['速度', stats.effectiveAgility]])}</dl>
    <h4>能力</h4><dl>${rows(ORIGINAL_ABILITY_NAMES.map((name, index) => [name, originalHeroAbilityBase(hero.sourceId, index + 1)]))}</dl>
  </section>`
}

export const renderOrdinaryHeroPool = (view: OrdinaryPoolView): string => {
  const selected = view.heroes.find(row => row.hero.id === view.selectedId) ?? view.heroes[0]
  const empty = view.heroes.length === 0
  return `<section class="ordinary-pool shop-section" aria-labelledby="ordinary-pool-title" data-testid="ordinary-hero-pool">
    <header class="shop-section-head"><div><h2 id="ordinary-pool-title">普通池</h2><p>随世界解锁加入侠客，获得后移出池子</p></div><span>可抽 ${view.heroes.length} 人</span></header>
    ${empty ? `<p class="ordinary-pool-empty" data-testid="ordinary-pool-empty">暂无可抽取角色<br><small>${view.hasLockedHeroes ? '解锁新的世界后，可继续招募' : '普通池侠客已全部获得'}</small></p>` : `
      <p class="ordinary-pool-rules">侠客基础概率 ${percent(view.heroRate)} · 最多再抽 ${view.pityRemaining} 次必得侠客<br>未获得侠客时，随机获得${escapeHtml(view.materialNames.join('或'))} × 2（本次合计${percent(view.pityRemaining === 1 ? 0 : 1 - view.heroRate)}，两种均分）。收益卡不改变抽取概率。</p>
      <div class="ordinary-pool-layout"><div class="ordinary-pool-roster" aria-label="可抽取侠客">${view.heroes.map(row => `<button type="button" data-action="ordinary-pool-preview" data-hero-id="${escapeHtml(row.hero.id)}" aria-pressed="${row.hero.id === selected?.hero.id}" data-testid="ordinary-pool-hero-${escapeHtml(row.hero.id)}">
        <img src="${escapeHtml(heroPortraitAsset(row.hero.id).url)}" alt=""/><span><strong>${escapeHtml(row.hero.name)}</strong><span>本次 ${percent(row.nextProbability)}</span><small>基础 ${percent(row.baseProbability)}</small></span>
      </button>`).join('')}</div>${selected ? renderPreview(selected) : ''}</div>
      <p class="ordinary-pool-rules">剩余侠客均分概率；保底时本次概率合计为100%。每次获得侠客后重新计算，保底进度跨世界保留。</p>`}
    <div class="ordinary-pool-actions"><button type="button" data-action="ordinary-pool-draw" data-count="1" ${empty || view.balance < view.cost ? 'disabled' : ''}>招募一次 · ${formatNumber(view.cost)}蛋蛋</button><button type="button" data-action="ordinary-pool-draw" data-count="10" ${empty || view.balance < view.cost * 10 ? 'disabled' : ''}>招募十次 · ${formatNumber(view.cost * 10)}蛋蛋</button></div>
    <p class="ordinary-pool-rules">十次招募途中抽空即停止，只扣实际招募次数的蛋蛋。</p>
    ${view.results.length ? `<div class="ordinary-pool-results" role="status" aria-live="polite"><h3>本次获得</h3><ul>${view.results.map(result => `<li${result.hero ? ' class="hero-result"' : ''}>${escapeHtml(result.name)} × ${result.amount}</li>`).join('')}</ul></div>` : ''}
  </section>`
}
