import { PREMIUM_CARDS, premiumBonuses } from '../domain/premium-cards'
import { campaignDropBonus } from '../domain/loot'
import { originalCityTechnologyEffectBonus } from '../content/original-city.generated'
import type { GameStateV10 } from '../domain/types'

export type PremiumPanel = 'bonuses'
const percent = (value: number): string => `${Number(value.toFixed(2))}%`
const expiry = (timestamp: number): string => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(timestamp)

const renderPremiumContent = (state: GameStateV10, panel: 'shop' | 'bonuses', now: number): string => {
  const bonus = premiumBonuses(state, now)
  const original = campaignDropBonus(state)
  const technology = originalCityTechnologyEffectBonus(65, state.city.technologyLevels['65'] ?? 0) * 100
  const cards = PREMIUM_CARDS.map(card => {
    const end = state.premiumCards.expiresAt[card.id]
    const active = end > now
    return `<article class="premium-card" data-testid="premium-card-${card.id}">
      <header><h3>${card.name}</h3><span class="${active ? 'active' : ''}">${active ? '生效中' : end ? '已到期' : '未购买'}</span></header>
      <p>${card.description}</p><small>${active ? `有效至 ${expiry(end)}（北京时间）` : `购买后立即生效，持续 ${card.days} 天`}</small>
      ${panel === 'shop' ? `<button type="button" data-action="buy-premium-card" data-card-id="${card.id}" ${state.idleVouchers.balance < card.price ? 'disabled' : ''}>${active ? '续购' : '购买'} ${card.days} 天 · ${card.price.toLocaleString('zh-CN')} 蛋蛋</button>` : ''}
    </article>`
  }).join('')
  return `${panel === 'shop' ? '' : `<div class="premium-source"><h3>当前队伍掉率来源</h3><p>上阵侠客合计：+${percent(original - technology)}<br>城市科技：+${percent(technology)}<br>原有加成合计：+${percent(original)}</p></div>`}
      <div class="premium-cards">${cards}</div>
      <h3>当前收益加成</h3>
      <dl class="premium-totals" data-testid="premium-totals">
        <div><dt>装备掉落概率</dt><dd>原掉率 × ${(1 + bonus.equipment / 100).toFixed(2)}</dd></div>
        <div><dt>普通材料掉落概率</dt><dd>原掉率 × ${(1 + bonus.material / 100).toFixed(2)}</dd></div>
        <div><dt>战斗角色／职业经验</dt><dd>原收益 × ${(1 + bonus.experience / 100).toFixed(2)}</dd></div>
        <div><dt>战斗 SP</dt><dd>原收益 × ${(1 + bonus.skillPoints / 100).toFixed(2)}</dd></div>
      </dl>
      <p class="premium-rules">同项目卡片加成相加后乘算；续购延长有效期，不叠加同卡效果。有效期包含离线时间，到期自动停止加成。</p>
      <p class="premium-rules">原掉率由基础概率与队伍、科技加成计算，最终概率最高 100%。卡片不增加掉落数量或品质，不影响蛋蛋、特殊票券、抽池和任务奖励。经验与 SP 的不足 1 点加成累计后发放。</p>
      ${panel === 'bonuses' ? '<p class="premium-rules">本页列出实际生效的收益加成；下方阵势搭配仍为预览，不计入战斗属性。</p><button type="button" data-action="open-premium-shop">前往商城</button>' : ''}`
}

export const renderPremiumPanel = (state: GameStateV10, panel: PremiumPanel, now = Date.now()): string =>
  `<div class="premium-overlay" data-action="close-premium-panel">
    <section class="premium-panel" role="dialog" aria-modal="true" aria-labelledby="premium-title" data-testid="premium-panel">
      <header class="premium-head"><h2 id="premium-title">查看加成</h2><button type="button" data-action="close-premium-panel" aria-label="关闭加成窗口">×</button></header>
      ${renderPremiumContent(state, panel, now)}
    </section>
  </div>`

export const renderShopPage = (state: GameStateV10, now = Date.now(), summoning = ''): string =>
  `<section class="shop-page" data-testid="shop-page">
    <header class="shop-head"><div><p>江湖百货 · 蛋蛋兑换</p><h1>商城</h1></div><div class="shop-wallet"><span>持有蛋蛋</span><strong>${state.idleVouchers.balance.toLocaleString('zh-CN')}</strong></div></header>
    ${summoning}
    <section class="shop-section" aria-labelledby="shop-premium-title">
      <header class="shop-section-head"><div><h2 id="shop-premium-title">收益特权</h2><p>周卡与月卡 · 购买即生效，续购延长有效期</p></div><span>共 ${PREMIUM_CARDS.length} 款</span></header>
      ${renderPremiumContent(state, 'shop', now)}
    </section>
  </section>`
