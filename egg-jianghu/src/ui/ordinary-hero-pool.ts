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
  rulesOpen?: boolean
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
    <header><div class="ordinary-pool-portrait"><img src="${escapeHtml(heroPortraitAsset(hero.id).url)}" alt="${escapeHtml(hero.name)}"/></div><div><span class="ordinary-pool-eyebrow">侠客档案</span><h3>${escapeHtml(hero.name)}</h3><p>${escapeHtml(careerById(hero.baseCareerId)?.name ?? '白丁')} Lv.1 · 初始面板</p><small>选中仅查看属性，不影响抽取</small></div></header>
    <h4>资质</h4><dl class="ordinary-pool-aptitudes">${rows([['勇', hero.aptitudes.strength], ['智', hero.aptitudes.insight], ['体', hero.aptitudes.constitution], ['敏', hero.aptitudes.agility], ['精', hero.aptitudes.resolve]])}</dl>
    <h4>战斗属性</h4><dl>${rows([['生命', stats.maxHp], ['物攻', stats.externalAttack], ['法攻', stats.internalAttack], ['物防', stats.externalDefense], ['法防', stats.internalDefense], ['速度', stats.effectiveAgility]])}</dl>
    <h4>能力</h4><dl>${rows(ORIGINAL_ABILITY_NAMES.map((name, index) => [name, originalHeroAbilityBase(hero.sourceId, index + 1)]))}</dl>
  </section>`
}

export const renderOrdinaryHeroPool = (view: OrdinaryPoolView): string => {
  const selected = view.heroes.find(row => row.hero.id === view.selectedId) ?? view.heroes[0]
  const empty = view.heroes.length === 0
  return `<section class="ordinary-pool shop-section" aria-labelledby="ordinary-pool-title" data-testid="ordinary-hero-pool">
    <header class="ordinary-pool-head"><div><span class="ordinary-pool-eyebrow">江湖相逢 · 随缘结交</span><h2 id="ordinary-pool-title">普通池</h2><p>新的世界，新的相逢。获得的侠客不会再次出现。</p></div><span class="ordinary-pool-count"><strong>${view.heroes.length}</strong> 位待结缘</span></header>
    <div class="ordinary-pool-layout">
      <div class="ordinary-pool-recruit">
        <div class="ordinary-pool-roster-heading"><h3>可招募侠客</h3><span>点击查看档案</span></div>
        ${empty ? `<div class="ordinary-pool-empty" data-testid="ordinary-pool-empty"><span aria-hidden="true">缘</span><h3>暂无可抽取角色</h3><p>${view.hasLockedHeroes ? '解锁新的世界后，可继续招募' : '普通池侠客已全部获得'}</p></div>` : `<div class="ordinary-pool-roster" aria-label="可抽取侠客">${view.heroes.map(row => `<button type="button" data-action="ordinary-pool-preview" data-hero-id="${escapeHtml(row.hero.id)}" aria-pressed="${row.hero.id === selected?.hero.id}" data-testid="ordinary-pool-hero-${escapeHtml(row.hero.id)}">
          <img src="${escapeHtml(heroPortraitAsset(row.hero.id).url)}" alt=""/><span><strong>${escapeHtml(row.hero.name)}</strong><span>本次 ${percent(row.nextProbability)}</span><small>基础 ${percent(row.baseProbability)}</small></span>
        </button>`).join('')}</div>`}
        <div class="ordinary-pool-draw-panel">
          <div class="ordinary-pool-guarantee"><span>侠客基础概率 <b>${percent(view.heroRate)}</b></span><strong>${view.pityRemaining === 1 ? '下次必得侠客' : `再抽 ${view.pityRemaining} 次内必得侠客`}</strong></div>
          <div class="ordinary-pool-wallet"><span>持有蛋蛋</span><strong>${formatNumber(view.balance)}</strong></div>
          <div class="ordinary-pool-actions"><button type="button" data-action="ordinary-pool-draw" data-count="1" ${empty || view.balance < view.cost ? 'disabled' : ''}><strong>招募一次</strong><span>${formatNumber(view.cost)} 蛋蛋</span></button><button type="button" data-action="ordinary-pool-draw" data-count="10" ${empty || view.balance < view.cost * 10 ? 'disabled' : ''}><strong>招募十次</strong><span>${formatNumber(view.cost * 10)} 蛋蛋</span></button></div>
          <p class="ordinary-pool-hint">${empty ? '当前池已抽空，暂不可招募' : view.balance < view.cost ? `蛋蛋不足，还差 ${formatNumber(view.cost - view.balance)} 蛋蛋可招募一次` : '随机结缘，获得后即从池中移除'}</p>
        </div>
        <div class="ordinary-pool-results" role="status" aria-live="polite">${view.results.length ? `<h3>本次获得</h3><ul>${view.results.map(result => `<li${result.hero ? ' class="hero-result"' : ''}><span>${result.hero ? '侠客加入' : '材料'}</span><strong>${escapeHtml(result.name)} × ${result.amount}</strong></li>`).join('')}</ul>` : ''}</div>
      </div>
      ${selected ? renderPreview(selected) : ''}
    </div>
    <section class="ordinary-pool-rules"><button type="button" data-action="ordinary-pool-rules" aria-expanded="${Boolean(view.rulesOpen)}" aria-controls="ordinary-pool-rule-content">概率与招募规则<span>${view.rulesOpen ? '收起 −' : '查看完整说明 ＋'}</span></button><div id="ordinary-pool-rule-content" ${view.rulesOpen ? '' : 'hidden'}>
      <p>侠客基础总概率 ${percent(view.heroRate)}，剩余侠客均分概率。保底时本次概率合计为 100%；获得侠客后重新计算，保底进度跨世界保留。</p>
      <p>未获得侠客时，随机获得${escapeHtml(view.materialNames.join('或'))} × 2。本次材料概率合计 ${percent(view.pityRemaining === 1 ? 0 : 1 - view.heroRate)}，两种均分。收益卡不改变抽取概率。</p>
      <p>十次招募需持有 ${formatNumber(view.cost * 10)} 蛋蛋；途中抽空即停止，只扣实际招募次数的蛋蛋。</p>
    </div></section>
  </section>`
}
