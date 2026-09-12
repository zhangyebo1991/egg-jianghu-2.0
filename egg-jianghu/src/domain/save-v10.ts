import { createInitialStateV10 } from './state'
import { ORDINARY_POOL_RULES } from '../content/ordinary-hero-pool'
import { isIdleVouchers } from './idle-vouchers'
import { isPremiumCards } from './premium-cards'
import { equipmentDefinitionById } from '../content/equipment'
import { HEROES_V10 } from '../content/heroes'
import {
  ORIGINAL_CITY_INITIAL_TECHNOLOGY_LEVELS,
  ORIGINAL_CITY_TECHNOLOGIES,
} from '../content/original-city.generated'
import { ORIGINAL_FACTION_RULES } from '../content/original-faction-rules.generated'
import { normalizeHeroEquipment, normalizeInventoryInstances } from './inventory'
import type { GameStateV10, HeroProgressV10 } from './types'
import { migrateLegacyProgression } from './save-progression-migration'

// v20 仍使用现有槽位，让旧页面的快照冲突检查及时阻止覆盖；版本以内容字段为准。
export const SAVE_KEY_V10 = 'egg-jianghu-2-save-v19'
export const PRE_V20_SAVE_BACKUP_KEY = 'egg-jianghu-before-v20-migration'
export const LEGACY_SAVE_KEY_V18 = 'egg-jianghu-2-save-v18'
export const LEGACY_SAVE_KEY_V17 = 'egg-jianghu-2-save-v17'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface LoadResultV10 {
  state: GameStateV10
  recoveredFromError: boolean
  serialized: string | null
  needsMigration?: boolean
}

export const hasSaveV10 = (storage: StorageLike): boolean =>
  storage.getItem(SAVE_KEY_V10) !== null

export const hasLegacySave = (storage: StorageLike): boolean =>
  storage.getItem(LEGACY_SAVE_KEY_V18) !== null || storage.getItem(LEGACY_SAVE_KEY_V17) !== null

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
  // v18 早期存档没有穿戴等级，加载时按物品等级与品质补齐。
  && (value.equipmentLevel === undefined
    || (typeof value.equipmentLevel === 'number'
      && Number.isInteger(Number(value.equipmentLevel))
      && Number(value.equipmentLevel) > 0))
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

const isAbilityTraining = (value: unknown): boolean => {
  if (!isRecord(value)) return false
  return Object.entries(value).every(([abilityId, level]) => {
    const id = Number(abilityId)
    return String(id) === abilityId
      && Number.isInteger(id)
      && id >= 1
      && id <= 10
      && Number.isInteger(Number(level))
      && Number(level) >= 0
      && Number(level) <= 5
  })
}

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
    && (value.selectedSkinId === undefined || (Number.isInteger(value.selectedSkinId) && Number(value.selectedSkinId) >= 0))
    && (value.skinStars === undefined || (isRecord(value.skinStars) && Object.entries(value.skinStars).every(([key, stars]) => /^[2-8]$/.test(key) && Number.isInteger(stars) && Number(stars) >= 1 && Number(stars) <= 10)))
    && (value.customName === undefined || typeof value.customName === 'string')
    && (value.abilityTraining === undefined || isAbilityTraining(value.abilityTraining))
}

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string')
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => isFiniteNumber(item))

const isFactionQuestBoardEntry = (value: unknown): boolean =>
  isRecord(value)
  && typeof value.id === 'string'
  && Number.isInteger(Number(value.taskId))
  && Number(value.taskId) >= 1
  && Number(value.taskId) <= 5
  && Number.isInteger(Number(value.quality))
  && Number(value.quality) >= 1
  && Number(value.quality) <= 6
  && Number.isInteger(Number(value.targetId))
  && Number(value.targetId) > 0
  && isFiniteNumber(value.generatedAt)
  && Number.isInteger(Number(value.acceptedRecordId))
  && Number(value.acceptedRecordId) >= -1

const isFactionBoardState = (value: unknown): boolean =>
  isRecord(value)
  && isFiniteNumber(value.refreshRemainingMs)
  && Number(value.refreshRemainingMs) >= 0
  && Array.isArray(value.slots)
  && value.slots.length === 5
  && value.slots.every((slot) => slot === null || isFactionQuestBoardEntry(slot))

const isAcceptedFactionQuest = (value: unknown): boolean =>
  isRecord(value)
  && Number.isInteger(Number(value.recordId))
  && Number(value.recordId) > 0
  && typeof value.factionId === 'string'
  && Number.isInteger(Number(value.factionSourceId))
  && Number(value.factionSourceId) > 0
  && Number.isInteger(Number(value.worldIndex))
  && Number(value.worldIndex) >= 1
  && Number(value.worldIndex) <= 13
  && Number.isInteger(Number(value.taskId))
  && Number(value.taskId) >= 1
  && Number(value.taskId) <= 5
  && Number.isInteger(Number(value.quality))
  && Number(value.quality) >= 1
  && Number(value.quality) <= 6
  && Number.isInteger(Number(value.targetId))
  && Number(value.targetId) > 0
  && isFiniteNumber(value.requiredAmount)
  && Number(value.requiredAmount) >= 0
  && isFiniteNumber(value.progress)
  && Number(value.progress) >= 0
  && Number.isInteger(Number(value.boardSlot))
  && Number(value.boardSlot) >= 0
  && Number(value.boardSlot) < 5
  && value.status === 1

const isFactionAgentState = (value: unknown): boolean =>
  isRecord(value)
  && (value.heroId === null || typeof value.heroId === 'string')
  && typeof value.enabled === 'boolean'

/**
 * 筛选矩阵校验。key 形如 `${worldId}:${taskId}`（taskId 1..5），
 * value 是被排除的列号数组，列号取值 1..20 且不重复。缺省（undefined）视为全放行。
 */
const isFactionAgentFilters = (value: unknown): boolean => {
  if (value === undefined) return true
  if (!isRecord(value)) return false
  const [columnMin, columnMax] = [1, ORIGINAL_FACTION_RULES.stateLayout.agentFilter.targetSubtypeColumns[1]]
  const taskRows = ORIGINAL_FACTION_RULES.stateLayout.agentFilter.taskRowsPerWorld
  return Object.entries(value).every(([key, columns]) => {
    const [worldId, taskId] = key.split(':')
    const parsedTaskId = Number(taskId)
    return Boolean(worldId)
      && String(parsedTaskId) === taskId
      && Number.isInteger(parsedTaskId)
      && parsedTaskId >= 1
      && parsedTaskId <= taskRows
      && Array.isArray(columns)
      && columns.every((column) => Number.isInteger(column) && column >= columnMin && column <= columnMax)
      && new Set(columns).size === columns.length
  })
}

const hasConsistentFactionQuestLinks = (boards: unknown, acceptedQuests: unknown): boolean => {
  if (!isRecord(boards) || !isRecord(acceptedQuests)) return false
  for (const [factionId, boardValue] of Object.entries(boards)) {
    if (!isFactionBoardState(boardValue)) return false
    const board = boardValue as Record<string, unknown>
    const slots = board.slots as unknown[]
    for (const [slotIndex, slotValue] of slots.entries()) {
      if (slotValue === null) continue
      const slot = slotValue as Record<string, unknown>
      const recordId = Number(slot.acceptedRecordId)
      if (recordId <= 0) continue
      const accepted = acceptedQuests[String(recordId)]
      if (!isAcceptedFactionQuest(accepted)) return false
      const record = accepted as Record<string, unknown>
      if (record.factionId !== factionId || Number(record.boardSlot) !== slotIndex) return false
    }
  }
  for (const accepted of Object.values(acceptedQuests)) {
    if (!isAcceptedFactionQuest(accepted)) return false
    const record = accepted as Record<string, unknown>
    const boardValue = boards[String(record.factionId)]
    if (!isFactionBoardState(boardValue)) return false
    const slot = (boardValue as Record<string, unknown>).slots as unknown[]
    const boardQuest = slot[Number(record.boardSlot)]
    if (!isRecord(boardQuest) || Number(boardQuest.acceptedRecordId) !== Number(record.recordId)) return false
  }
  return true
}

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

const cityFinanceCategories = ['销售收入', '租金收入', '门票收入', '其他收入', '科研支出', '建造支出', '其他支出'] as const
const cityTechnologyById = new Map(ORIGINAL_CITY_TECHNOLOGIES.map((technology) => [technology.sourceId, technology]))

const isCityFinanceLedger = (value: unknown): boolean =>
  isRecord(value)
  && Object.keys(value).length === cityFinanceCategories.length
  && cityFinanceCategories.every((category) => isFiniteNumber(value[category]) && Number(value[category]) >= 0)

const isCityTechnologyLevels = (value: unknown): boolean => {
  if (!isRecord(value)) return false
  for (const [sourceId, level] of Object.entries(value)) {
    const technologyId = Number(sourceId)
    const technology = cityTechnologyById.get(technologyId)
    if (String(technologyId) !== sourceId
      || !technology
      || !Number.isInteger(Number(level))
      || Number(level) < 0
      || Number(level) > technology.maxLevel) return false
  }
  return Object.entries(ORIGINAL_CITY_INITIAL_TECHNOLOGY_LEVELS).every(([sourceId, level]) => (
    Number(value[sourceId]) >= level
  ))
}

const isCityTile = (value: unknown): boolean =>
  isRecord(value)
  && Number.isInteger(Number(value.tileId))
  && Number(value.tileId) >= 1
  && Number(value.tileId) <= 324
  && Number.isInteger(Number(value.buildingId))
  && Number(value.buildingId) >= 0
  && Number(value.buildingId) <= 25
  && Number.isInteger(Number(value.buildingLevel))
  && Number(value.buildingLevel) >= 0
  && typeof value.owned === 'boolean'
  && typeof value.buildable === 'boolean'
  && Number.isInteger(Number(value.gridX))
  && Number(value.gridX) >= 0
  && Number(value.gridX) < 18
  && Number.isInteger(Number(value.gridY))
  && Number(value.gridY) >= 0
  && Number(value.gridY) < 18
  && isFiniteNumber(value.landPriceTier)
  && Number(value.landPriceTier) >= 0
  && isFiniteNumber(value.population)
  && Number(value.population) >= 0
  && isFiniteNumber(value.commerce)
  && Number(value.commerce) >= 0
  && isFiniteNumber(value.industry)
  && Number(value.industry) >= 0

const isShopNumber = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max

const isCityShop = (value: unknown): boolean => {
  if (!isRecord(value) || value.tileId !== 172 || typeof value.enabled !== 'boolean'
    || !Array.isArray(value.stock) || value.stock.length > 20
    || !value.stock.every(item => isEquipmentInstance(item) && isRecord(item) && item.locked === false && equipmentDefinitionById(String(item.definitionId)))
    || !Array.isArray(value.staff) || value.staff.length !== 6
    || !value.staff.every(worker => isRecord(worker) && (worker.heroId === null || typeof worker.heroId === 'string')
      && isShopNumber(worker.progress, 1000) && typeof worker.serving === 'boolean'
      && (worker.heroId !== null || (worker.progress === 0 && !worker.serving)))
    || !isShopNumber(value.customers, 5) || !isShopNumber(value.elapsedMs, 999.999999)
    || !isShopNumber(value.experience) || !isShopNumber(value.soldCount) || !Number.isInteger(value.soldCount)
    || !isShopNumber(value.revenue) || !Number.isInteger(value.revenue)
    || !isShopNumber(value.introStep, 3) || !Number.isInteger(value.introStep)
    || !Array.isArray(value.receipts) || value.receipts.length > 10
    || !value.receipts.every(receipt => isRecord(receipt)
      && typeof receipt.definitionId === 'string' && equipmentDefinitionById(receipt.definitionId)
      && isShopNumber(receipt.sequence, Number(value.soldCount)) && Number.isInteger(receipt.sequence) && receipt.sequence > 0
      && isShopNumber(receipt.amount) && Number.isInteger(receipt.amount)
      && isShopNumber(receipt.quality, 9) && Number.isInteger(receipt.quality)
      && isShopNumber(receipt.level) && Number.isInteger(receipt.level))) return false
  const ids = value.staff.map(worker => (worker as Record<string, unknown>).heroId).filter(id => id !== null)
  return new Set(ids).size === ids.length
}

const isCityState = (value: unknown): boolean => {
  if (!isRecord(value)
    || !Number.isInteger(Number(value.level))
    || Number(value.level) < 0
    || Number(value.level) > 12
    || !Array.isArray(value.tiles)
    || value.tiles.length !== 324
    || !value.tiles.every(isCityTile)
    || !isCityTechnologyLevels(value.technologyLevels)
    || !isRecord(value.company) || !isCityShop(value.shop)) return false
  const tileIds = new Set(value.tiles.map((tile) => Number((tile as Record<string, unknown>).tileId)))
  const coordinates = new Set(value.tiles.map((tile) => {
    const record = tile as Record<string, unknown>
    return `${record.gridX}:${record.gridY}`
  }))
  if (tileIds.size !== 324 || coordinates.size !== 324) return false
  const company = value.company
  return (company.name === null || typeof company.name === 'string')
    && isFiniteNumber(company.cash)
    && Number(company.cash) >= 0
    && isRecord(company.appointments)
    && Object.values(company.appointments).every((heroId) => heroId === null || typeof heroId === 'string')
    && isCityFinanceLedger(company.currentFinance)
    && isCityFinanceLedger(company.previousFinance)
    && isFiniteNumber(company.previousNetIncome)
}

const normalizeLoadedHeroes = (heroes: GameStateV10['heroes'], inventory: GameStateV10['inventory']): void => {
  normalizeInventoryInstances(inventory)
  for (const hero of Object.values(heroes) as HeroProgressV10[]) {
    normalizeHeroEquipment(hero)
  }
}

const persistentState = (state: GameStateV10, lastSavedAt: number): GameStateV10 => ({
  settings: structuredClone(state.settings),
  version: 20,
  idleVouchers: structuredClone(state.idleVouchers),
  premiumCards: structuredClone(state.premiumCards),
  ordinaryPoolMisses: state.ordinaryPoolMisses,
  redeemedWelfareCodes: [...state.redeemedWelfareCodes],
  worldCurrency: structuredClone(state.worldCurrency),
  contribution: structuredClone(state.contribution),
  worldReputation: structuredClone(state.worldReputation),
  factionAgents: structuredClone(state.factionAgents),
  factionAgentFilters: structuredClone(state.factionAgentFilters),
  unlockedFactionIds: structuredClone(state.unlockedFactionIds),
  heroes: structuredClone(state.heroes),
  jobBooks: structuredClone(state.jobBooks),
  formation: structuredClone(state.formation),
  unlockedWorldIds: structuredClone(state.unlockedWorldIds),
  clearedStageByWorldDifficulty: structuredClone(state.clearedStageByWorldDifficulty),
  encounteredEnemyIds: structuredClone(state.encounteredEnemyIds),
  factionBoards: structuredClone(state.factionBoards),
  acceptedFactionQuests: structuredClone(state.acceptedFactionQuests),
  unlockedSkinIds: structuredClone(state.unlockedSkinIds),
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
  city: structuredClone(state.city),
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
    || (raw.version !== 19 && raw.version !== 20)
    || (raw.ordinaryPoolMisses !== undefined && (typeof raw.ordinaryPoolMisses !== 'number' || !Number.isInteger(raw.ordinaryPoolMisses) || raw.ordinaryPoolMisses < 0 || raw.ordinaryPoolMisses >= ORDINARY_POOL_RULES.heroPity))
    || (raw.idleVouchers !== undefined && !isIdleVouchers(raw.idleVouchers))
    || (raw.premiumCards !== undefined && !isPremiumCards(raw.premiumCards))
    || (raw.redeemedWelfareCodes !== undefined && (!isStringArray(raw.redeemedWelfareCodes) || new Set(raw.redeemedWelfareCodes).size !== raw.redeemedWelfareCodes.length))
    || (raw.settings !== undefined && (!isRecord(raw.settings)
      || (raw.settings.autoDiscardBelowQuality !== null
        && !(typeof raw.settings.autoDiscardBelowQuality === 'number'
          && Number.isInteger(raw.settings.autoDiscardBelowQuality)
          && raw.settings.autoDiscardBelowQuality >= 0 && raw.settings.autoDiscardBelowQuality <= 9))))
    || !Array.isArray(raw.inventory)
    || !raw.inventory.every(isEquipmentInstance)
    || !Array.isArray(raw.formation)
    || !raw.formation.every(isFormationSlot)
    || !isRecord(raw.heroes)
    || !Object.values(raw.heroes).every(isHeroProgress)
    || !isNumberRecord(raw.worldReputation)
    || !isRecord(raw.factionAgents)
    || !Object.values(raw.factionAgents).every(isFactionAgentState)
    || !isFactionAgentFilters(raw.factionAgentFilters)
    || !isStringArray(raw.unlockedFactionIds)
    || !isRecord(raw.factionBoards)
    || !Object.values(raw.factionBoards).every(isFactionBoardState)
    || !isRecord(raw.acceptedFactionQuests)
    || !Object.entries(raw.acceptedFactionQuests).every(([recordId, quest]) =>
      isAcceptedFactionQuest(quest) && String((quest as Record<string, unknown>).recordId) === recordId)
    || !hasConsistentFactionQuestLinks(raw.factionBoards, raw.acceptedFactionQuests)
    || !isNumberArray(raw.unlockedSkinIds)
    || !raw.unlockedSkinIds.every((skinId) => Number.isInteger(skinId) && skinId > 0)
    || new Set(raw.unlockedSkinIds).size !== raw.unlockedSkinIds.length
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
    || !isNumberRecord(raw.largeDungeonClears)
    || !isCityState(raw.city)) {
    throw new Error('存档版本不受支持或格式无效')
  }

  const state = createInitialStateV10(now)
  const loaded = pruneUnknownHeroes(persistentState({
    ...state,
    idleVouchers: raw.idleVouchers === undefined ? state.idleVouchers : structuredClone(raw.idleVouchers) as GameStateV10['idleVouchers'],
    premiumCards: raw.premiumCards === undefined ? state.premiumCards : structuredClone(raw.premiumCards) as GameStateV10['premiumCards'],
    ordinaryPoolMisses: raw.ordinaryPoolMisses === undefined ? 0 : raw.ordinaryPoolMisses as number,
    redeemedWelfareCodes: raw.redeemedWelfareCodes === undefined ? [] : [...raw.redeemedWelfareCodes as string[]],
    settings: raw.settings === undefined ? state.settings : {
      autoDiscardBelowQuality: (raw.settings as GameStateV10['settings']).autoDiscardBelowQuality,
    },
    worldCurrency: isRecord(raw.worldCurrency) ? structuredClone(raw.worldCurrency) as GameStateV10['worldCurrency'] : state.worldCurrency,
    contribution: isRecord(raw.contribution) ? structuredClone(raw.contribution) as GameStateV10['contribution'] : state.contribution,
    worldReputation: structuredClone(raw.worldReputation) as GameStateV10['worldReputation'],
    factionAgents: structuredClone(raw.factionAgents) as GameStateV10['factionAgents'],
    // v18 早期存档没有筛选矩阵，缺省即全部放行。
    factionAgentFilters: isRecord(raw.factionAgentFilters)
      ? structuredClone(raw.factionAgentFilters) as GameStateV10['factionAgentFilters']
      : state.factionAgentFilters,
    unlockedFactionIds: structuredClone(raw.unlockedFactionIds) as string[],
    heroes: structuredClone(raw.heroes) as GameStateV10['heroes'],
    jobBooks: isNumberRecord(raw.jobBooks) ? structuredClone(raw.jobBooks) as GameStateV10['jobBooks'] : state.jobBooks,
    formation: structuredClone(raw.formation) as GameStateV10['formation'],
    unlockedWorldIds: Array.isArray(raw.unlockedWorldIds) ? structuredClone(raw.unlockedWorldIds) as string[] : state.unlockedWorldIds,
    clearedStageByWorldDifficulty: isRecord(raw.clearedStageByWorldDifficulty)
      ? structuredClone(raw.clearedStageByWorldDifficulty) as GameStateV10['clearedStageByWorldDifficulty']
      : state.clearedStageByWorldDifficulty,
    encounteredEnemyIds: Array.isArray(raw.encounteredEnemyIds) ? structuredClone(raw.encounteredEnemyIds) as string[] : state.encounteredEnemyIds,
    factionBoards: structuredClone(raw.factionBoards) as GameStateV10['factionBoards'],
    acceptedFactionQuests: structuredClone(raw.acceptedFactionQuests) as GameStateV10['acceptedFactionQuests'],
    unlockedSkinIds: structuredClone(raw.unlockedSkinIds) as number[],
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
    city: structuredClone(raw.city) as GameStateV10['city'],
    statistics: isRecord(raw.statistics) ? structuredClone(raw.statistics) as GameStateV10['statistics'] : state.statistics,
  }, Math.min(now, Number(raw.lastSavedAt) || now)))
  const allItems = [...loaded.inventory, ...loaded.city.shop.stock]
  if (new Set(allItems.map(item => item.uid)).size !== allItems.length) throw new Error('存档装备归属重复')
  const stockedIds = new Set(loaded.city.shop.stock.map(item => item.uid))
  if (Object.values(loaded.heroes).some(hero => hero.equipmentSets.some(set => Object.values(set).some(uid => uid && stockedIds.has(uid))))) {
    throw new Error('货架装备不能同时穿戴')
  }
  if (loaded.city.shop.staff.some(worker => worker.heroId !== null && (!loaded.heroes[worker.heroId]?.recruited
    || loaded.formation.some(slot => slot.heroId === worker.heroId)
    || Object.values(loaded.factionAgents).some(agent => agent.heroId === worker.heroId)
    || Object.values(loaded.city.company.appointments).includes(worker.heroId)))) throw new Error('店员任职状态冲突')
  const shopTile = loaded.city.tiles.find(tile => tile.tileId === loaded.city.shop.tileId)
  if (!shopTile?.owned || shopTile.buildingId !== 15
    || loaded.city.shop.staff.some((worker, index) => worker.heroId && index >= Math.min(6, shopTile.buildingLevel + 1))) throw new Error('古玩店地块或席位状态无效')
  normalizeLoadedHeroes(loaded.heroes, loaded.inventory)
  normalizeInventoryInstances(loaded.city.shop.stock)
  if (raw.version === 19) migrateLegacyProgression(loaded)
  return loaded
}

export const loadExistingGameV10 = (storage: StorageLike, now = Date.now()): LoadResultV10 | null => {
  const serialized = storage.getItem(SAVE_KEY_V10)
  if (serialized === null) return null

  try {
    const raw = JSON.parse(serialized) as unknown
    return { state: hydrateStateV10(raw, now), recoveredFromError: false, serialized,
      needsMigration: isRecord(raw) && raw.version === 19 }
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
  const previous = storage.getItem(SAVE_KEY_V10)
  // 备份失败就中止写入，不能在空间不足时覆盖唯一的旧档。
  if (previous !== null && storage.getItem(PRE_V20_SAVE_BACKUP_KEY) === null) {
    let oldVersion: unknown
    try { oldVersion = (JSON.parse(previous) as { version?: unknown })?.version } catch { /* 损坏档由既有确认流程处理。 */ }
    if (oldVersion === 19) storage.setItem(PRE_V20_SAVE_BACKUP_KEY, previous)
  }
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
