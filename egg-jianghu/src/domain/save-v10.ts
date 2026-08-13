import { createInitialStateV10 } from './state'
import { HEROES_V10 } from '../content/heroes'
import { normalizeHeroEquipment, normalizeInventoryDefinitionIds } from './inventory'
import type { GameStateV10, HeroProgressV10 } from './types'

// v14：怪物替换为诸天原版（enemy id 改身份制）。旧档不迁移，读不到新 key 即当新开。
export const SAVE_KEY_V10 = 'egg-jianghu-2-save-v14'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface LoadResultV10 {
  state: GameStateV10
  recoveredFromError: boolean
  serialized: string | null
}

export const hasSaveV10 = (storage: StorageLike): boolean =>
  storage.getItem(SAVE_KEY_V10) !== null

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isNumberRecord = (value: unknown): boolean =>
  isRecord(value) && Object.values(value).every(isFiniteNumber)

const isCareerRecord = (value: unknown): boolean =>
  isRecord(value)
  && isFiniteNumber(value.level)
  && isFiniteNumber(value.experience)

const isLearnedMartial = (value: unknown): boolean =>
  isRecord(value)
  && isFiniteNumber(value.level)
  && isRecord(value.invested)
  && isNumberRecord(value.invested.worldCurrency)
  && isNumberRecord(value.invested.contribution)

const isUidMap = (value: unknown): value is Record<string, string | null> =>
  isRecord(value) && Object.values(value).every((id) => id === null || typeof id === 'string')

const isFormationSlot = (value: unknown): boolean =>
  isRecord(value)
  && typeof value.heroId === 'string'
  && (value.row === 0 || value.row === 1 || value.row === 2)
  && (value.col === 0 || value.col === 1 || value.col === 2 || value.col === 3 || value.col === 4)

const isHeroProgress = (value: unknown): boolean => {
  if (!isRecord(value)) return false
  const hasLoadoutField = 'equipmentBySlot' in value
  const hasSetsField = 'equipmentSets' in value
  if (hasLoadoutField && !isUidMap(value.equipmentBySlot)) return false
  if (hasSetsField && !(Array.isArray(value.equipmentSets) && value.equipmentSets.every(isUidMap))) return false
  if (!hasLoadoutField && !hasSetsField) return false
  const setIndex = value.activeEquipmentSetIndex
  return typeof value.recruited === 'boolean'
    && isFiniteNumber(value.level)
    && isFiniteNumber(value.experience)
    && isRecord(value.careers)
    && Object.values(value.careers).every(isCareerRecord)
    && typeof value.currentCareerId === 'string'
    && isRecord(value.learnedMartials)
    && Object.values(value.learnedMartials).every(isLearnedMartial)
    && Array.isArray(value.equippedMartialIds)
    && value.equippedMartialIds.length === 4
    && value.equippedMartialIds.every((id) => id === null || typeof id === 'string')
    && (value.heartMethodId === null || typeof value.heartMethodId === 'string')
    && (setIndex === undefined || setIndex === 0 || setIndex === 1 || setIndex === 2)
    && (value.customName === undefined || typeof value.customName === 'string')
}

const normalizeLoadedHeroes = (heroes: GameStateV10['heroes'], inventory: GameStateV10['inventory']): void => {
  normalizeInventoryDefinitionIds(inventory)
  for (const hero of Object.values(heroes) as HeroProgressV10[]) {
    normalizeHeroEquipment(hero)
  }
}

const persistentState = (state: GameStateV10, lastSavedAt: number): GameStateV10 => ({
  version: 14,
  worldCurrency: structuredClone(state.worldCurrency),
  contribution: structuredClone(state.contribution),
  heroes: structuredClone(state.heroes),
  jobBooks: structuredClone(state.jobBooks),
  formation: structuredClone(state.formation),
  unlockedWorldIds: structuredClone(state.unlockedWorldIds),
  clearedStageByWorldDifficulty: structuredClone(state.clearedStageByWorldDifficulty),
  encounteredEnemyIds: structuredClone(state.encounteredEnemyIds),
  factionBoards: structuredClone(state.factionBoards),
  inventory: structuredClone(state.inventory),
  statistics: structuredClone(state.statistics),
  lastSavedAt,
})

// 内容目录改版后，旧存档可能残留已删除侠客的进度；按当前英雄目录剪枝，避免孤儿英雄。
const pruneUnknownHeroes = (state: GameStateV10): GameStateV10 => {
  const knownIds = new Set(HEROES_V10.map((hero) => hero.id))
  const heroes = Object.fromEntries(
    Object.entries(state.heroes).filter(([id]) => knownIds.has(id)),
  )
  const formation = state.formation.filter((slot) => knownIds.has(slot.heroId))
  return { ...state, heroes, formation }
}

export const hydrateStateV10 = (raw: unknown, now = Date.now()): GameStateV10 => {
  if (!isRecord(raw)
    || raw.version !== 14
    || !Array.isArray(raw.inventory)
    || !Array.isArray(raw.formation)
    || !raw.formation.every(isFormationSlot)
    || !isRecord(raw.heroes)
    || !Object.values(raw.heroes).every(isHeroProgress)) {
    throw new Error('存档版本不受支持或格式无效')
  }

  const state = createInitialStateV10(now)
  const loaded = pruneUnknownHeroes(persistentState({
    ...state,
    worldCurrency: isRecord(raw.worldCurrency) ? structuredClone(raw.worldCurrency) as GameStateV10['worldCurrency'] : state.worldCurrency,
    contribution: isRecord(raw.contribution) ? structuredClone(raw.contribution) as GameStateV10['contribution'] : state.contribution,
    heroes: structuredClone(raw.heroes) as GameStateV10['heroes'],
    jobBooks: isNumberRecord(raw.jobBooks) ? structuredClone(raw.jobBooks) as GameStateV10['jobBooks'] : state.jobBooks,
    formation: structuredClone(raw.formation) as GameStateV10['formation'],
    unlockedWorldIds: Array.isArray(raw.unlockedWorldIds) ? structuredClone(raw.unlockedWorldIds) as string[] : state.unlockedWorldIds,
    clearedStageByWorldDifficulty: isRecord(raw.clearedStageByWorldDifficulty)
      ? structuredClone(raw.clearedStageByWorldDifficulty) as GameStateV10['clearedStageByWorldDifficulty']
      : state.clearedStageByWorldDifficulty,
    encounteredEnemyIds: Array.isArray(raw.encounteredEnemyIds) ? structuredClone(raw.encounteredEnemyIds) as string[] : state.encounteredEnemyIds,
    factionBoards: isRecord(raw.factionBoards) ? structuredClone(raw.factionBoards) as GameStateV10['factionBoards'] : state.factionBoards,
    inventory: structuredClone(raw.inventory) as GameStateV10['inventory'],
    statistics: isRecord(raw.statistics) ? structuredClone(raw.statistics) as GameStateV10['statistics'] : state.statistics,
  }, Math.min(now, Number(raw.lastSavedAt) || now)))
  normalizeLoadedHeroes(loaded.heroes, loaded.inventory)
  return loaded
}

export const loadExistingGameV10 = (storage: StorageLike, now = Date.now()): LoadResultV10 | null => {
  const serialized = storage.getItem(SAVE_KEY_V10)
  if (serialized === null) return null

  try {
    return { state: hydrateStateV10(JSON.parse(serialized) as unknown, now), recoveredFromError: false, serialized }
  } catch {
    return { state: createInitialStateV10(now), recoveredFromError: true, serialized }
  }
}

export const loadGameV10 = (storage: StorageLike, now = Date.now()): LoadResultV10 =>
  loadExistingGameV10(storage, now) ?? { state: createInitialStateV10(now), recoveredFromError: false, serialized: null }

export const saveGameV10 = (
  storage: StorageLike,
  state: GameStateV10,
  now = Date.now(),
): string => {
  const serialized = JSON.stringify(persistentState(state, now))
  storage.setItem(SAVE_KEY_V10, serialized)
  state.lastSavedAt = now
  return serialized
}

export const clearSaveV10 = (storage: StorageLike): void => {
  storage.removeItem(SAVE_KEY_V10)
}

export const exportSaveV10 = (state: GameStateV10, now = Date.now()): string =>
  JSON.stringify(persistentState(state, now), null, 2)

export const importSaveV10 = (serialized: string, now = Date.now()): { state: GameStateV10 } => ({
  state: hydrateStateV10(JSON.parse(serialized) as unknown, now),
})
