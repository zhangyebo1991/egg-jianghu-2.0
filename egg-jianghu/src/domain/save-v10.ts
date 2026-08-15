import { createInitialStateV10 } from './state'
import { HEROES_V10 } from '../content/heroes'
import { normalizeHeroEquipment, normalizeInventoryDefinitionIds } from './inventory'
import type { GameStateV10, HeroProgressV10 } from './types'

// v17：完整原版技能、至宝与高阶系统。旧档不迁移，保留原 key 且仅提示新建存档。
export const SAVE_KEY_V10 = 'egg-jianghu-2-save-v17'
export const LEGACY_SAVE_KEY_V16 = 'egg-jianghu-2-save-v16'

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

export const hasLegacySaveV16 = (storage: StorageLike): boolean =>
  storage.getItem(LEGACY_SAVE_KEY_V16) !== null

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
  && isFiniteNumber(value.investedSp)
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

const isEquipmentRoll = (value: unknown): boolean =>
  isRecord(value)
  && typeof value.attributeId === 'number'
  && Number.isInteger(Number(value.attributeId))
  && Number(value.attributeId) >= 6
  && Number(value.attributeId) <= 59
  && isFiniteNumber(value.coefficient)

const isEquipmentInstance = (value: unknown): boolean =>
  isRecord(value)
  && typeof value.uid === 'string'
  && typeof value.definitionId === 'string'
  && typeof value.level === 'number'
  && Number.isInteger(Number(value.level))
  && Number(value.level) > 0
  && typeof value.quality === 'number'
  && Number.isInteger(Number(value.quality))
  && Number(value.quality) >= 0
  && Number(value.quality) <= 9
  && Array.isArray(value.coreStats)
  && value.coreStats.length <= 2
  && value.coreStats.every(isEquipmentRoll)
  && Array.isArray(value.affixes)
  && value.affixes.every(isEquipmentRoll)
  && typeof value.locked === 'boolean'

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
    && isFiniteNumber(value.skillPoints)
    && Array.isArray(value.permanentMartialIds)
    && value.permanentMartialIds.every((id) => typeof id === 'string')
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

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string')

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => isFiniteNumber(item))

const isShrineProgress = (value: unknown): boolean =>
  isRecord(value)
  && ['raid', 'siege', 'occupation', 'subdued'].includes(String(value.phase))
  && isFiniteNumber(value.progress)
  && Number(value.progress) >= -1
  && Number(value.progress) <= 5000

const isDeityProgress = (value: unknown): boolean =>
  isRecord(value)
  && Number.isInteger(Number(value.level))
  && Number(value.level) >= 1

const isSacredBeastProgress = (value: unknown): boolean =>
  isRecord(value)
  && Number.isInteger(Number(value.highestClearedStage))
  && Number(value.highestClearedStage) >= 0
  && Number(value.highestClearedStage) <= 9
  && isNumberArray(value.claimedStages)
  && value.claimedStages.every((stage) => Number.isInteger(stage) && stage >= 1 && stage <= 9)

const normalizeLoadedHeroes = (heroes: GameStateV10['heroes'], inventory: GameStateV10['inventory']): void => {
  normalizeInventoryDefinitionIds(inventory)
  for (const hero of Object.values(heroes) as HeroProgressV10[]) {
    normalizeHeroEquipment(hero)
  }
}

const persistentState = (state: GameStateV10, lastSavedAt: number): GameStateV10 => ({
  version: 17,
  worldCurrency: structuredClone(state.worldCurrency),
  contribution: structuredClone(state.contribution),
  unlockedFactionIds: structuredClone(state.unlockedFactionIds),
  heroes: structuredClone(state.heroes),
  jobBooks: structuredClone(state.jobBooks),
  formation: structuredClone(state.formation),
  unlockedWorldIds: structuredClone(state.unlockedWorldIds),
  clearedStageByWorldDifficulty: structuredClone(state.clearedStageByWorldDifficulty),
  encounteredEnemyIds: structuredClone(state.encounteredEnemyIds),
  factionBoards: structuredClone(state.factionBoards),
  inventory: structuredClone(state.inventory),
  materials: structuredClone(state.materials),
  starSoul: state.starSoul,
  blueprints: structuredClone(state.blueprints),
  unlockedRecipeIds: structuredClone(state.unlockedRecipeIds),
  treasureManualGrants: structuredClone(state.treasureManualGrants),
  infiniteTowerFloor: state.infiniteTowerFloor,
  divineLadderFloor: state.divineLadderFloor,
  divineRankLevel: state.divineRankLevel,
  shrines: structuredClone(state.shrines),
  deities: structuredClone(state.deities),
  sacredBeasts: structuredClone(state.sacredBeasts),
  largeDungeonClears: structuredClone(state.largeDungeonClears),
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
    || raw.version !== 17
    || !Array.isArray(raw.inventory)
    || !raw.inventory.every(isEquipmentInstance)
    || !Array.isArray(raw.formation)
    || !raw.formation.every(isFormationSlot)
    || !isRecord(raw.heroes)
    || !Object.values(raw.heroes).every(isHeroProgress)
    || !isStringArray(raw.unlockedFactionIds)
    || !isNumberRecord(raw.materials)
    || !isFiniteNumber(raw.starSoul)
    || !isNumberRecord(raw.blueprints)
    || !isNumberArray(raw.unlockedRecipeIds)
    || !isStringRecord(raw.treasureManualGrants)
    || !Number.isInteger(Number(raw.infiniteTowerFloor))
    || !Number.isInteger(Number(raw.divineLadderFloor))
    || !Number.isInteger(Number(raw.divineRankLevel))
    || !isRecord(raw.shrines)
    || !Object.values(raw.shrines).every(isShrineProgress)
    || !isRecord(raw.deities)
    || !Object.values(raw.deities).every(isDeityProgress)
    || !isRecord(raw.sacredBeasts)
    || !Object.values(raw.sacredBeasts).every(isSacredBeastProgress)
    || !isNumberRecord(raw.largeDungeonClears)) {
    throw new Error('存档版本不受支持或格式无效')
  }

  const state = createInitialStateV10(now)
  const loaded = pruneUnknownHeroes(persistentState({
    ...state,
    worldCurrency: isRecord(raw.worldCurrency) ? structuredClone(raw.worldCurrency) as GameStateV10['worldCurrency'] : state.worldCurrency,
    contribution: isRecord(raw.contribution) ? structuredClone(raw.contribution) as GameStateV10['contribution'] : state.contribution,
    unlockedFactionIds: structuredClone(raw.unlockedFactionIds) as string[],
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
    materials: structuredClone(raw.materials) as Record<string, number>,
    starSoul: Number(raw.starSoul),
    blueprints: structuredClone(raw.blueprints) as Record<string, number>,
    unlockedRecipeIds: structuredClone(raw.unlockedRecipeIds) as number[],
    treasureManualGrants: structuredClone(raw.treasureManualGrants) as Record<string, string>,
    infiniteTowerFloor: Number(raw.infiniteTowerFloor),
    divineLadderFloor: Number(raw.divineLadderFloor),
    divineRankLevel: Number(raw.divineRankLevel),
    shrines: structuredClone(raw.shrines) as GameStateV10['shrines'],
    deities: structuredClone(raw.deities) as GameStateV10['deities'],
    sacredBeasts: structuredClone(raw.sacredBeasts) as GameStateV10['sacredBeasts'],
    largeDungeonClears: structuredClone(raw.largeDungeonClears) as Record<string, number>,
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
