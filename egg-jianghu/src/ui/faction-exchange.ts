import type { OriginalFactionExchangeKind } from '../content/original-faction-exchange.generated'
import { escapeHtml, formatNumber } from './html'

export type ExchangeMainTab = 'general' | 'contribution'
export type ExchangeCategory = 'all' | OriginalFactionExchangeKind

export interface ExchangeWalletView {
  worldId: string
  worldName: string
  currencyName: string
  balance: number
  selected: boolean
}

export interface ExchangeJobBookItemView {
  careerId: string
  bookName: string
  price: number
  owned: number
  affordable: boolean
}

export interface ExchangeGeneralTabView {
  wallets: readonly ExchangeWalletView[]
  selectedWorldName: string
  currencyName: string
  balance: number
  fundsShort: boolean
  ranks: ReadonlyArray<{ id: number; name: string; unlocked: boolean; lockedReason: string | null }>
  rank: number
  items: readonly ExchangeJobBookItemView[]
}

export interface FactionExchangeItemView {
  slot: number
  kind: OriginalFactionExchangeKind
  name: string
  price: number
  requiredReputationLevel: number | null
  requiredReputationName: string | null
  quantity: number
  owned: boolean
  reputationLocked: boolean
  insufficientFunds: boolean
  actionReason: string | null
}

export interface FactionExchangeGroupView {
  factionId: string
  factionName: string
  worldId: string
  worldName: string
  contribution: number
  reputationLevel: number
  reputationLevelName: string
  fundsShort: boolean
  items: readonly FactionExchangeItemView[]
}

export interface FactionExchangeContributionTabView {
  category: ExchangeCategory
  categories: ReadonlyArray<{ id: ExchangeCategory; name: string; count: number }>
  worldFilter: string
  worlds: ReadonlyArray<{ id: string; name: string; selected: boolean }>
  groups: readonly FactionExchangeGroupView[]
  totalShown: number
}

export interface FactionExchangeViewModel {
  tab: ExchangeMainTab
  general: ExchangeGeneralTabView
  contribution: FactionExchangeContributionTabView
}

const kindLabels: Record<OriginalFactionExchangeKind, string> = {
  'job-book': '转职书',
  blueprint: '装备图纸',
  'secret-realm-ticket': '秘境门票',
  skin: '幻型',
}

const exchangeGotoButton = (worldId: string, dest: 'stages' | 'factions', label: string, title: string): string =>
  `<button type="button" class="exchange-goto" data-action="exchange-goto-world" data-world-id="${escapeHtml(worldId)}" data-dest="${dest}" title="${escapeHtml(title)}">${escapeHtml(label)}</button>`

const renderItemAction = (group: FactionExchangeGroupView, item: FactionExchangeItemView): string => {
  if (item.reputationLocked) {
    return `<button type="button" disabled title="在${escapeHtml(group.worldName)}办差挂机提升声望后解锁">${escapeHtml(item.actionReason ?? `需${item.requiredReputationName}声望`)}</button>`
  }
  if (item.owned) {
    return '<button type="button" disabled title="该物品已在囊中">已拥有</button>'
  }  if (item.insufficientFunds) {
    return exchangeGotoButton(
      group.worldId,
      'factions',
      `前往${group.worldName}`,
      `贡献不足 · 前往${group.worldName}悬榜办差与挂机赚取`,
    )
  }
  return `<button type="button" data-action="faction-exchange" data-faction-id="${escapeHtml(group.factionId)}" data-slot="${item.slot}">兑换</button>`
}

const renderExchangeItem = (group: FactionExchangeGroupView, item: FactionExchangeItemView): string => {
  const reputationRequirement = item.requiredReputationLevel === null
    ? '无声望门槛'
    : `${item.requiredReputationName}可兑`
  const quantity = item.quantity > 0 && !item.owned
    ? `<span class="faction-exchange-count">持有 ${formatNumber(item.quantity)}</span>`
    : ''
  const shortNote = item.insufficientFunds && !item.reputationLocked && !item.owned
    ? `<span class="faction-exchange-count">贡献不足 · 点击前往赚取</span>`
    : ''
  return `<article class="faction-exchange-item ${item.owned ? 'owned' : ''}" data-kind="${item.kind}" data-testid="faction-exchange-item-${escapeHtml(group.factionId)}-${item.slot}">
    <header><span>${escapeHtml(kindLabels[item.kind])}</span><small>${escapeHtml(reputationRequirement)}</small></header>
    <h4>${escapeHtml(item.name)}</h4>
    <div class="faction-exchange-item-foot">
      <div><b>${formatNumber(item.price)}</b><small>贡献</small>${quantity}${shortNote}</div>
      ${renderItemAction(group, item)}
    </div>
  </article>`
}

const renderGeneralTab = (view: ExchangeGeneralTabView): string => `
  <div class="exchange-general" data-testid="exchange-general">
    <div class="exchange-wallet-row">
      <div class="exchange-wallets" role="group" aria-label="选择付款位面">
        ${view.wallets.map((wallet) => `
          <button type="button" class="exchange-wallet${wallet.selected ? ' active' : ''}" data-action="exchange-wallet" data-world-id="${escapeHtml(wallet.worldId)}" data-testid="exchange-wallet-${escapeHtml(wallet.worldId)}" aria-pressed="${wallet.selected}">
            <span>${escapeHtml(wallet.worldName)}</span>
            <b>${formatNumber(wallet.balance)}</b>
            <small>${escapeHtml(wallet.currencyName)}</small>
          </button>`).join('')}
      </div>
      ${view.fundsShort
        ? exchangeGotoButton(view.wallets.find((wallet) => wallet.selected)?.worldId ?? '', 'stages', `铜钱不足 · 前往${view.selectedWorldName}挂机`, `铜钱不足 · 前往${view.selectedWorldName}闯荡挂机赚取`)
        : ''}
    </div>
    <nav class="inventory-shop-ranks" aria-label="转职书阶位">
      ${view.ranks.map((rank) => rank.unlocked
        ? `<button type="button" class="inventory-shop-rank${view.rank === rank.id ? ' active' : ''}"
            data-action="shop-rank" data-rank="${rank.id}" data-testid="shop-rank-${rank.id}"
            aria-pressed="${view.rank === rank.id}">${escapeHtml(rank.name)}</button>`
        : `<button type="button" class="inventory-shop-rank locked" disabled title="${escapeHtml(rank.lockedReason ?? '尚未解锁')}">🔒 ${escapeHtml(rank.name)}</button>`).join('')}
    </nav>
    <ul class="inventory-shop-list">
      ${view.items.map((item) => `
        <li class="inventory-shop-item" data-testid="shop-book-${escapeHtml(item.careerId)}">
          <div>
            <strong>${escapeHtml(item.bookName)}</strong>
            <span>持有 ${item.owned} · ${formatNumber(item.price)} ${escapeHtml(view.currencyName)}</span>
          </div>
          <button type="button" class="inventory-shop-buy" data-action="shop-buy"
            data-career-id="${escapeHtml(item.careerId)}" data-testid="shop-buy-${escapeHtml(item.careerId)}"
            ${item.affordable ? '' : 'disabled'}>购入</button>
        </li>`).join('')}
    </ul>
    <p class="inventory-shop-note">战斗不掉转职书，可先囤书，转职仍需前置职业等级。新等阶随侠客习得上阶职业解锁，铜钱取自所选位面。</p>
  </div>`

const renderContributionTab = (view: FactionExchangeContributionTabView): string => `
  <div class="exchange-contribution" data-testid="exchange-contribution">
    <div class="exchange-filter-row">
      <nav class="exchange-kind-tabs" aria-label="物品种类">
        ${view.categories.map((category) => `
          <button type="button" class="exchange-chip${view.category === category.id ? ' active' : ''}"
            data-action="exchange-category" data-category="${category.id}" aria-pressed="${view.category === category.id}">
            ${escapeHtml(category.name)}<small>${category.count}</small>
          </button>`).join('')}
      </nav>
      <nav class="exchange-world-tabs" aria-label="位面筛选">
        ${view.worlds.map((world) => `
          <button type="button" class="exchange-chip${world.selected ? ' active' : ''}"
            data-action="exchange-world" data-world="${escapeHtml(world.id)}" aria-pressed="${world.selected}">
            ${escapeHtml(world.name)}
          </button>`).join('')}
      </nav>
    </div>
    ${view.groups.length > 0
      ? `<div class="faction-exchange-groups">
          ${view.groups.map((group) => `
            <section class="faction-exchange-group exchange-faction-group" data-faction-id="${escapeHtml(group.factionId)}">
              <header>
                <h3>${escapeHtml(group.factionName)}</h3>
                <div class="exchange-faction-meta">
                  <span>${escapeHtml(group.worldName)} · 声望 ${escapeHtml(group.reputationLevelName)} · 等级 ${group.reputationLevel} / 5</span>
                  <b><i>${formatNumber(group.contribution)}</i> 贡献</b>
                  ${group.fundsShort ? exchangeGotoButton(group.worldId, 'factions', `前往${group.worldName}`, `贡献不足 · 前往${group.worldName}悬榜办差赚取`) : ''}
                </div>
              </header>
              <div class="faction-exchange-grid">${group.items.map((item) => renderExchangeItem(group, item)).join('')}</div>
            </section>`).join('')}
        </div>
        <p class="exchange-shown-note">当前筛选共 ${view.totalShown} 件 · 全部来自已解锁势力的原版目录</p>`
      : '<div class="faction-exchange-empty"><strong>此筛选下暂无可兑换物品</strong><span>推进关卡解锁更多位面与势力。</span></div>'}
  </div>`

export const renderFactionExchange = (view: FactionExchangeViewModel): string => `<section class="faction-exchange exchange-page" data-testid="faction-exchange">
  <header class="faction-exchange-head">
    <div><span>PLANE EXCHANGE</span><h2>兑换</h2><p>已解锁位面随时可购 · 货币不足时点击前往挂机</p></div>
    <nav class="exchange-main-tabs" aria-label="兑换方式">
      <button type="button" class="${view.tab === 'general' ? 'active' : ''}" data-action="exchange-tab" data-exchange-tab="general" aria-pressed="${view.tab === 'general'}" data-testid="exchange-tab-general">通用兑换<small>转职书 · 位面铜钱</small></button>
      <button type="button" class="${view.tab === 'contribution' ? 'active' : ''}" data-action="exchange-tab" data-exchange-tab="contribution" aria-pressed="${view.tab === 'contribution'}" data-testid="exchange-tab-contribution">贡献兑换<small>原版完整目录</small></button>
    </nav>
  </header>
  ${view.tab === 'general' ? renderGeneralTab(view.general) : renderContributionTab(view.contribution)}
</section>`
