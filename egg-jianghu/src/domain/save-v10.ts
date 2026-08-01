import { createInitialStateV10 } from './state'
import type { GameStateV10 } from './types'

export const SAVE_KEY_V10 = 'egg-jianghu-2-save-v10'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface LoadResultV10 {
  state: GameStateV10
  recoveredFromError: boolean
}

export const loadGameV10 = (storage: StorageLike, now = Date.now()): LoadResultV10 => {
  const serialized = storage.getItem(SAVE_KEY_V10)
  if (!serialized) return { state: createInitialStateV10(now), recoveredFromError: false }

  try {
    const raw = JSON.parse(serialized) as Partial<GameStateV10>
    if (raw.version !== 10 || !Array.isArray(raw.inventory) || !Array.isArray(raw.formation)) {
      throw new Error('存档版本不受支持或格式无效')
    }

    const state = createInitialStateV10(now)
    Object.assign(state, {
      worldCurrency: structuredClone(raw.worldCurrency ?? state.worldCurrency),
      contribution: structuredClone(raw.contribution ?? state.contribution),
      heroes: structuredClone(raw.heroes ?? state.heroes),
      careerTokens: structuredClone(raw.careerTokens ?? state.careerTokens),
      formation: structuredClone(raw.formation),
      unlockedWorldIds: structuredClone(raw.unlockedWorldIds ?? state.unlockedWorldIds),
      clearedStageByWorld: structuredClone(raw.clearedStageByWorld ?? state.clearedStageByWorld),
      encounteredEnemyIds: structuredClone(raw.encounteredEnemyIds ?? state.encounteredEnemyIds),
      factionBoards: structuredClone(raw.factionBoards ?? state.factionBoards),
      inventory: structuredClone(raw.inventory),
      statistics: structuredClone(raw.statistics ?? state.statistics),
      lastSavedAt: Math.min(now, Number(raw.lastSavedAt) || now),
    })
    return { state, recoveredFromError: false }
  } catch {
    return { state: createInitialStateV10(now), recoveredFromError: true }
  }
}

export const saveGameV10 = (
  storage: StorageLike,
  state: GameStateV10,
  now = Date.now(),
): void => {
  state.lastSavedAt = now
  storage.setItem(SAVE_KEY_V10, JSON.stringify(state))
}
