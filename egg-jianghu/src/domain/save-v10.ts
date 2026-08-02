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

export const hasSaveV10 = (storage: StorageLike): boolean =>
  storage.getItem(SAVE_KEY_V10) !== null

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const persistentState = (state: GameStateV10, lastSavedAt: number): GameStateV10 => ({
  version: 10,
  worldCurrency: structuredClone(state.worldCurrency),
  contribution: structuredClone(state.contribution),
  heroes: structuredClone(state.heroes),
  careerTokens: structuredClone(state.careerTokens),
  formation: structuredClone(state.formation),
  unlockedWorldIds: structuredClone(state.unlockedWorldIds),
  clearedStageByWorld: structuredClone(state.clearedStageByWorld),
  encounteredEnemyIds: structuredClone(state.encounteredEnemyIds),
  factionBoards: structuredClone(state.factionBoards),
  inventory: structuredClone(state.inventory),
  statistics: structuredClone(state.statistics),
  lastSavedAt,
})

export const hydrateStateV10 = (raw: unknown, now = Date.now()): GameStateV10 => {
  if (!isRecord(raw) || raw.version !== 10 || !Array.isArray(raw.inventory) || !Array.isArray(raw.formation)) {
    throw new Error('存档版本不受支持或格式无效')
  }

  const state = createInitialStateV10(now)
  return persistentState({
    ...state,
    worldCurrency: isRecord(raw.worldCurrency) ? structuredClone(raw.worldCurrency) as GameStateV10['worldCurrency'] : state.worldCurrency,
    contribution: isRecord(raw.contribution) ? structuredClone(raw.contribution) as GameStateV10['contribution'] : state.contribution,
    heroes: isRecord(raw.heroes) ? structuredClone(raw.heroes) as GameStateV10['heroes'] : state.heroes,
    careerTokens: Array.isArray(raw.careerTokens) ? structuredClone(raw.careerTokens) as string[] : state.careerTokens,
    formation: structuredClone(raw.formation) as GameStateV10['formation'],
    unlockedWorldIds: Array.isArray(raw.unlockedWorldIds) ? structuredClone(raw.unlockedWorldIds) as string[] : state.unlockedWorldIds,
    clearedStageByWorld: isRecord(raw.clearedStageByWorld) ? structuredClone(raw.clearedStageByWorld) as GameStateV10['clearedStageByWorld'] : state.clearedStageByWorld,
    encounteredEnemyIds: Array.isArray(raw.encounteredEnemyIds) ? structuredClone(raw.encounteredEnemyIds) as string[] : state.encounteredEnemyIds,
    factionBoards: isRecord(raw.factionBoards) ? structuredClone(raw.factionBoards) as GameStateV10['factionBoards'] : state.factionBoards,
    inventory: structuredClone(raw.inventory) as GameStateV10['inventory'],
    statistics: isRecord(raw.statistics) ? structuredClone(raw.statistics) as GameStateV10['statistics'] : state.statistics,
  }, Math.min(now, Number(raw.lastSavedAt) || now))
}

export const loadExistingGameV10 = (storage: StorageLike, now = Date.now()): LoadResultV10 | null => {
  const serialized = storage.getItem(SAVE_KEY_V10)
  if (serialized === null) return null

  try {
    return { state: hydrateStateV10(JSON.parse(serialized) as unknown, now), recoveredFromError: false }
  } catch {
    return { state: createInitialStateV10(now), recoveredFromError: true }
  }
}

export const loadGameV10 = (storage: StorageLike, now = Date.now()): LoadResultV10 =>
  loadExistingGameV10(storage, now) ?? { state: createInitialStateV10(now), recoveredFromError: false }

export const saveGameV10 = (
  storage: StorageLike,
  state: GameStateV10,
  now = Date.now(),
): void => {
  state.lastSavedAt = now
  storage.setItem(SAVE_KEY_V10, JSON.stringify(persistentState(state, now)))
}

export const clearSaveV10 = (storage: StorageLike): void => {
  storage.removeItem(SAVE_KEY_V10)
}

export const exportSaveV10 = (state: GameStateV10, now = Date.now()): string =>
  JSON.stringify(persistentState(state, now), null, 2)

export const importSaveV10 = (serialized: string, now = Date.now()): { state: GameStateV10 } => ({
  state: hydrateStateV10(JSON.parse(serialized) as unknown, now),
})
