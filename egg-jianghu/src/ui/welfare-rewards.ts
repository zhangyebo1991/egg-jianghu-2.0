import type { WelfareReward } from '../domain/welfare-codes'
import { heroAppearanceAsset } from './hero-appearance-assets'
import { escapeHtml } from './html'

export const renderWelfareRewards = (rewards: readonly WelfareReward[]): string => `<dialog class="welfare-dialog" aria-labelledby="welfare-reward-title" data-testid="welfare-rewards">
  <header><span>江湖相逢 · 福利已领取</span><h2 id="welfare-reward-title">恭喜获得</h2></header>
  <ul>${rewards.map(reward => `<li><img src="${escapeHtml(heroAppearanceAsset(reward.id))}" alt="${escapeHtml(reward.name)}"><span class="hero-tier" data-tier="传奇">传奇侠客</span><h3>${escapeHtml(reward.name)} × ${reward.amount}</h3><p>已加入侠客名录，可前往阵容上阵</p></li>`).join('')}</ul>
  <button type="button" data-action="close-welfare-rewards" autofocus>收下福利</button>
</dialog>`
