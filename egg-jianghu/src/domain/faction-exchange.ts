import {
  originalFactionExchangeByFaction,
  type OriginalFactionExchangeItem,
} from '../content/original-faction-exchange.generated'
import { factionById } from '../content/factions'
import {
  originalWorldReputationLevel,
  originalWorldReputationLevelName,
} from '../content/original-faction-rules.generated'
import type { ActionResult, GameStateV10 } from './types'

export const factionExchangeItemQuantity = (
  state: GameStateV10,
  item: OriginalFactionExchangeItem,
): number => {
  switch (item.target.kind) {
    case 'job':
      return state.jobBooks[item.target.stateKey] ?? 0
    case 'blueprint':
      return state.unlockedRecipeIds.includes(item.target.recipeId)
        ? 1
        : state.blueprints[item.target.stateKey] ?? 0
    case 'material':
      return state.materials[item.target.stateKey] ?? 0
    case 'skin':
      return state.unlockedSkinIds.includes(item.target.sourceId) ? 1 : 0
  }
}

export const factionExchangeItemOwned = (
  state: GameStateV10,
  item: OriginalFactionExchangeItem,
): boolean => (item.kind === 'blueprint' || item.kind === 'skin')
  && factionExchangeItemQuantity(state, item) > 0

export const exchangeFactionItem = (
  state: GameStateV10,
  factionId: string,
  slot: number,
): ActionResult => {
  const faction = factionById(factionId)
  if (!faction) return { ok: false, message: '势力不存在' }
  if (!state.unlockedFactionIds.includes(factionId)) return { ok: false, message: '势力尚未解锁' }
  if (faction.currencyKind !== 'contribution') return { ok: false, message: '此势力不使用贡献兑换' }

  const item = originalFactionExchangeByFaction(faction.originalId)
    .find((candidate) => candidate.slot === slot)
  if (!item) return { ok: false, message: '兑换商品不存在' }

  const reputation = state.worldReputation[faction.worldId] ?? 0
  const reputationLevel = originalWorldReputationLevel(reputation, item.worldIndex)
  if (item.requiredReputationLevel !== null && reputationLevel < item.requiredReputationLevel) {
    return {
      ok: false,
      message: `声望等级不足，需达到${originalWorldReputationLevelName(item.requiredReputationLevel)}`,
    }
  }
  if (factionExchangeItemOwned(state, item)) {
    return { ok: false, message: item.kind === 'skin' ? '该幻型已经拥有' : '该图纸已经拥有' }
  }

  const contribution = state.contribution[factionId] ?? 0
  if (contribution < item.price) return { ok: false, message: '势力贡献不足' }

  state.contribution[factionId] = contribution - item.price
  switch (item.target.kind) {
    case 'job':
      state.jobBooks[item.target.stateKey] = (state.jobBooks[item.target.stateKey] ?? 0) + 1
      break
    case 'blueprint':
      state.blueprints[item.target.stateKey] = (state.blueprints[item.target.stateKey] ?? 0) + 1
      break
    case 'material':
      state.materials[item.target.stateKey] = (state.materials[item.target.stateKey] ?? 0) + 1
      break
    case 'skin':
      state.unlockedSkinIds.push(item.target.sourceId)
      break
  }

  return { ok: true, message: `兑换成功：${item.originalName}` }
}
