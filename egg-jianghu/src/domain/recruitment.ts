import { factionById } from '../content/factions'
import { heroByIdV10 } from '../content/heroes'
import { originalWorldReputationLevel, originalWorldReputationLevelName } from '../content/original-faction-rules.generated'
import { createHeroProgress } from './state'
import type { ActionResult, GameStateV10 } from './types'

export type RecruitmentResult =
  | { ok: true; heroId: string; spent: number }
  | { ok: false; message: string }

export const recruitFromTavern = (state: GameStateV10, heroId: string): RecruitmentResult => {
  const definition = heroByIdV10(heroId)
  if (!definition || definition.source !== 'tavern') return { ok: false, message: '酒馆中没有这名侠客' }
  if (!state.unlockedWorldIds.includes(definition.worldId)) return { ok: false, message: '尚未解锁所在江湖卷' }
  if (state.heroes[heroId]?.recruited) return { ok: false, message: '侠客已经加入' }
  if ((state.worldCurrency[definition.worldId] ?? 0) < definition.cost) return { ok: false, message: '本卷货币不足' }

  state.worldCurrency[definition.worldId] -= definition.cost
  state.heroes[heroId] = createHeroProgress(definition.baseCareerId)
  return { ok: true, heroId, spent: definition.cost }
}

export const recruitFromFaction = (
  state: GameStateV10,
  factionId: string,
  heroId: string,
): ActionResult => {
  const definition = heroByIdV10(heroId)
  if (!definition || definition.source !== 'faction' || definition.factionId !== factionId) {
    return { ok: false, message: '该势力没有这名侠客' }
  }
  if (!state.unlockedWorldIds.includes(definition.worldId)) return { ok: false, message: '尚未解锁所在江湖卷' }
  if (state.heroes[heroId]?.recruited) return { ok: false, message: '侠客已经加入' }

  const faction = factionById(factionId)
  if (!faction) return { ok: false, message: '该势力没有这名侠客' }
  const worldIndex = Number(faction.worldId.slice(-2))
  const reputationLevel = originalWorldReputationLevel(
    state.worldReputation[faction.worldId] ?? 0,
    worldIndex,
  )
  if (definition.requiredReputationLevel !== undefined && reputationLevel < definition.requiredReputationLevel) {
    return { ok: false, message: `需${originalWorldReputationLevelName(definition.requiredReputationLevel)}声望` }
  }

  // 原版口径：民团（货币势力）消耗位面货币，正式势力消耗贡献。
  const useWorldCurrency = faction.currencyKind === 'worldCurrency'
  const walletKey = useWorldCurrency ? definition.worldId : factionId
  const wallet = useWorldCurrency ? state.worldCurrency : state.contribution
  if ((wallet[walletKey] ?? 0) < definition.cost) {
    return { ok: false, message: useWorldCurrency ? '位面货币不足' : '势力贡献不足' }
  }

  wallet[walletKey] -= definition.cost
  state.heroes[heroId] = createHeroProgress(definition.baseCareerId)
  return { ok: true, message: '邀请成功' }
}
