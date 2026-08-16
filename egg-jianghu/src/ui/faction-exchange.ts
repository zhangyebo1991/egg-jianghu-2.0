import type { OriginalFactionExchangeKind } from '../content/original-faction-exchange.generated'
import { escapeHtml, formatNumber } from './html'

export interface FactionExchangeItemView {
  slot: number
  kind: OriginalFactionExchangeKind
  name: string
  price: number
  requiredReputationLevel: number | null
  requiredReputationName: string | null
  quantity: number
  owned: boolean
  actionDisabled: boolean
  actionReason: string | null
}

export interface FactionExchangeViewModel {
  factionId: string
  factionName: string
  contribution: number
  reputation: number
  reputationLevel: number
  reputationLevelName: string
  reputationCurrentThreshold: number
  reputationNextThreshold: number | null
  items: readonly FactionExchangeItemView[]
}

const kindLabels: Record<OriginalFactionExchangeKind, string> = {
  'job-book': '转职书',
  blueprint: '装备图纸',
  'secret-realm-ticket': '秘境门票',
  skin: '幻型',
}

const kindOrder = ['job-book', 'blueprint', 'secret-realm-ticket', 'skin'] as const

const renderExchangeItem = (view: FactionExchangeViewModel, item: FactionExchangeItemView): string => {
  const actionLabel = item.owned ? '已拥有' : item.actionReason ?? '兑换'
  const reputationRequirement = item.requiredReputationLevel === null
    ? '无声望门槛'
    : `${item.requiredReputationName}可兑`
  const quantity = item.quantity > 0 && !item.owned
    ? `<span class="faction-exchange-count">持有 ${formatNumber(item.quantity)}</span>`
    : ''
  return `<article class="faction-exchange-item ${item.owned ? 'owned' : ''}" data-kind="${item.kind}" data-testid="faction-exchange-item-${item.slot}">
    <header><span>${escapeHtml(kindLabels[item.kind])}</span><small>${escapeHtml(reputationRequirement)}</small></header>
    <h4>${escapeHtml(item.name)}</h4>
    <div class="faction-exchange-item-foot">
      <div><b>${formatNumber(item.price)}</b><small>贡献</small>${quantity}</div>
      <button type="button" data-action="faction-exchange" data-faction-id="${escapeHtml(view.factionId)}" data-slot="${item.slot}"${item.actionDisabled ? ' disabled' : ''}>${escapeHtml(actionLabel)}</button>
    </div>
  </article>`
}

export const renderFactionExchange = (view: FactionExchangeViewModel): string => {
  const nextThreshold = view.reputationNextThreshold
  const reputationRange = nextThreshold === null
    ? 0
    : Math.max(1, nextThreshold - view.reputationCurrentThreshold)
  const reputationProgress = nextThreshold === null
    ? 100
    : Math.max(0, Math.min(100,
      ((view.reputation - view.reputationCurrentThreshold) / reputationRange) * 100))
  const reputationTarget = nextThreshold === null
    ? '已达最高声望'
    : `距下一等级 ${formatNumber(Math.max(0, nextThreshold - view.reputation))}`
  const groups = kindOrder.map((kind) => ({
    kind,
    items: view.items.filter((item) => item.kind === kind),
  })).filter((group) => group.items.length > 0)

  return `<section class="faction-exchange" data-testid="faction-exchange" data-faction-id="${escapeHtml(view.factionId)}">
    <header class="faction-exchange-head">
      <div><span>CONTRIBUTION EXCHANGE</span><h2>贡献兑换</h2><p>${escapeHtml(view.factionName)} · 原版完整目录</p></div>
      <div class="faction-exchange-wallet"><strong>${formatNumber(view.contribution)}</strong><span>可用贡献</span></div>
    </header>
    <div class="faction-reputation" data-testid="faction-reputation">
      <div class="faction-reputation-level"><span>位面声望</span><strong>${escapeHtml(view.reputationLevelName)}</strong><small>等级 ${view.reputationLevel} / 5</small></div>
      <div class="faction-reputation-progress">
        <div><span>${formatNumber(view.reputation)} 声望</span><small>${escapeHtml(reputationTarget)}</small></div>
        <span class="faction-reputation-track"><i style="width:${reputationProgress.toFixed(2)}%"></i></span>
      </div>
    </div>
    ${groups.length > 0
      ? `<div class="faction-exchange-groups">${groups.map((group) => `<section class="faction-exchange-group" data-kind="${group.kind}"><header><h3>${escapeHtml(kindLabels[group.kind])}</h3><span>${group.items.length} 项</span></header><div class="faction-exchange-grid">${group.items.map((item) => renderExchangeItem(view, item)).join('')}</div></section>`).join('')}</div>`
      : '<div class="faction-exchange-empty"><strong>此地无贡献兑换</strong><span>民团使用位面货币，不设正式势力贡献目录。</span></div>'}
  </section>`
}
