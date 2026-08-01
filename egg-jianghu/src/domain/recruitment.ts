import { heroByIdV10 } from '../content/heroes'
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
  if ((state.contribution[factionId] ?? 0) < definition.cost) return { ok: false, message: '势力贡献不足' }

  state.contribution[factionId] -= definition.cost
  state.heroes[heroId] = createHeroProgress(definition.baseCareerId)
  return { ok: true, message: '邀请成功' }
}
