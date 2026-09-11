import { WORLDS } from '../content/worlds'
import { heroPlacement } from '../content/hero-placement'
import { SUMMON_RULES as RULES, chapterPool, chapterSummoning, type SummonReward } from '../domain/hero-summoning'
import type { GameStateV10 } from '../domain/types'
import { heroAppearanceAsset } from './hero-appearance-assets'
import { escapeHtml } from './html'

export const renderHeroSummoning = (state: GameStateV10, worldId: string, rewards: readonly SummonReward[]): string => {
  const pool = chapterPool(worldId)
  const progress = chapterSummoning(state, worldId)
  const unlocked = state.unlockedWorldIds.includes(worldId)
  const legendary = pool.filter(hero => heroPlacement(hero.id)?.tier === '传奇')
  const target = legendary.find(hero => hero.id === progress.targetId)
  const candidates = (tier: string) => pool.filter(hero => heroPlacement(hero.id)?.tier === tier).length
  return `<section class="shop-section hero-summoning" aria-labelledby="summoning-title" data-testid="hero-summoning">
    <header class="shop-section-head"><div><h2 id="summoning-title">章节招募</h2><p>名侠与传奇 · 每次 ${RULES.cost} 蛋蛋</p></div><span>长期结缘</span></header>
    <label class="summon-world-label" for="summon-world">招募章节</label>
    <select id="summon-world" data-action="summon-world">${WORLDS.map(world => `<option value="${world.id}" ${world.id === worldId ? 'selected' : ''}>${escapeHtml(world.name)}${state.unlockedWorldIds.includes(world.id) ? '' : ' · 未解锁'}</option>`).join('')}</select>
    <div class="summon-hero-grid">${pool.map(hero => {
      const tier = heroPlacement(hero.id)!.tier
      const rate = (tier === '传奇' ? RULES.legendaryRate : RULES.renownedRate) / candidates(tier) * 100
      return `<article class="summon-hero" data-tier="${tier}"><img src="${escapeHtml(heroAppearanceAsset(hero.id))}" alt="" loading="lazy"><div><span class="hero-tier" data-tier="${tier}">${tier}</span><h3>${escapeHtml(hero.name)}</h3><small>${state.heroes[hero.id]?.recruited ? '已结缘 · 重复返还蛋蛋' : '尚未结缘'}</small><small>基础概率 ${Number(rate.toFixed(4))}%</small></div></article>`
    }).join('')}</div>
    <div class="summon-wish">
      <label for="summon-target">心愿传奇</label>
      <select id="summon-target" data-action="summon-target" ${unlocked ? '' : 'disabled'}><option value="">请选择目标</option>${legendary.map(hero => `<option value="${hero.id}" ${hero.id === progress.targetId ? 'selected' : ''}>${escapeHtml(hero.name)}${state.heroes[hero.id]?.recruited ? ' · 已拥有' : ''}</option>`).join('')}</select>
      <p>当前：${target ? escapeHtml(target.name) : '未设置'}。选择立即保存；更换目标会清空心愿进度，章节保底保留。选中已有侠客仍可能重复获得。</p>
    </div>
    <div class="summon-pity" data-testid="summon-pity">
      <div><span>名侠或传奇</span><b>${progress.sinceHero} / ${RULES.heroPity}</b><small>至多还需 ${RULES.heroPity - progress.sinceHero} 抽</small></div>
      <div><span>传奇保底</span><b>${progress.sinceLegendary} / ${RULES.legendaryPity}</b><small>至多还需 ${RULES.legendaryPity - progress.sinceLegendary} 抽</small></div>
      <div><span>心愿保障</span><b>${progress.sinceTarget} / ${RULES.targetPity}</b><small>${target ? `至多还需 ${RULES.targetPity - progress.sinceTarget} 抽` : '设置目标后开始累计'}</small></div>
    </div>
    <div class="summon-actions">${[1, 10].map(count => `<button type="button" data-action="summon-heroes" data-count="${count}" ${!unlocked || !target || state.idleVouchers.balance < RULES.cost * count ? 'disabled' : ''}>${count === 1 ? '招募一次' : '招募十次'} · ${RULES.cost * count} 蛋蛋</button>`).join('')}</div>
    ${!unlocked ? '<p class="summon-notice">通关推进并解锁此章节后可招募。</p>' : !target ? '<p class="summon-notice">先设置心愿传奇，即可开始招募。</p>' : ''}
    <details class="summon-rules"><summary>概率、保底与奖励说明</summary>
      <p>基础概率：名侠 1%，传奇 0.2%，普通材料 98.8%。同档侠客均分该档概率，心愿不提高基础概率。保底触发时替换本次结果，综合概率高于基础概率；无软保底，收益卡不影响抽池。</p>
      <p>连续 ${RULES.heroPity} 抽必得名侠或传奇，连续 ${RULES.legendaryPity} 抽必得传奇，心愿目标连续 ${RULES.targetPity} 抽未出现则必得目标。心愿保障优先于传奇保底，传奇优先于名侠；十次招募逐次结算。</p>
      <p>获得任意侠客重置侠客保底；获得传奇同时重置传奇保底；获得目标同时重置心愿进度。重复获得也按这些规则重置。各章进度独立，切章、退出和读档保留。</p>
      <p>重复名侠返还 ${RULES.renownedRefund} 蛋蛋，重复传奇返还 ${RULES.legendaryRefund} 蛋蛋，保留已有培养。普通材料为初晶矿石或灵风松木各 2 个，二者均分材料概率。十次招募需先持有 1000 蛋蛋。</p>
      <p>基础日产最多 700 蛋蛋，相当于 7 抽；全部用于本章时，心愿最迟 80 天。购买其他商品或未拿满每日蛋蛋会延长时间。</p>
    </details>
    ${rewards.length ? `<section class="summon-results" aria-label="最近招募结果" aria-live="polite"><h3>本次结缘</h3><ul>${rewards.map(reward => `<li data-tier="${reward.tier ?? ''}"><strong>${escapeHtml(reward.name)} × ${reward.amount}</strong><span>${reward.duplicate ? `已拥有，返还 ${reward.refund} 蛋蛋` : reward.kind === 'hero' ? `${reward.tier} · 新侠客加入` : '已放入背包'}${reward.guarantee ? ` · ${reward.guarantee}` : ''}</span></li>`).join('')}</ul></section>` : ''}
  </section>`
}
