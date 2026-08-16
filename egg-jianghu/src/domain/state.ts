import { STARTER_CAREER_ID } from '../content/careers'
import { FACTIONS } from '../content/factions'
import { PLAYER_HERO_ID } from '../content/heroes'
import { ORIGINAL_CITY_CONSTANTS, ORIGINAL_CITY_INITIAL_TILES } from '../content/original-city.generated'
import { ORIGINAL_DEITIES, ORIGINAL_SACRED_BEASTS } from '../content/original-progression.generated'
import type { CityFinanceLedger, CityState, GameStateV10, HeroProgressV10 } from './types'

export const createHeroEquipmentSets = (): HeroProgressV10['equipmentSets'] => [{}, {}, {}]

export const createHeroProgress = (careerId: string): HeroProgressV10 => {
  const equipmentSets = createHeroEquipmentSets()
  return {
    recruited: true,
    level: 1,
    experience: 0,
    skillPoints: 0,
    permanentMartialIds: [],
    careers: {
      [careerId]: {
        level: 1,
        experience: 0,
      },
    },
    currentCareerId: careerId,
    learnedMartials: {},
    equippedMartialIds: [null, null, null, null],
    heartMethodId: null,
    equipmentSets,
    activeEquipmentSetIndex: 0,
    equipmentBySlot: equipmentSets[0],
  }
}

export const createEmptyCityFinanceLedger = (): CityFinanceLedger => ({
  销售收入: 0,
  租金收入: 0,
  门票收入: 0,
  其他收入: 0,
  科研支出: 0,
  建造支出: 0,
  其他支出: 0,
})

export const createInitialCityState = (): CityState => ({
  level: 0,
  tiles: ORIGINAL_CITY_INITIAL_TILES.map((tile) => ({ ...tile })),
  company: {
    name: null,
    cash: ORIGINAL_CITY_CONSTANTS.initialCash,
    appointments: {},
    currentFinance: createEmptyCityFinanceLedger(),
    previousFinance: createEmptyCityFinanceLedger(),
    previousNetIncome: 0,
  },
})

export const createInitialStateV10 = (now = Date.now()): GameStateV10 => ({
  version: 18,
  worldCurrency: { world_01: 1000 },
  contribution: {},
  worldReputation: { world_01: 0 },
  factionAgents: { world_01: { heroId: null, enabled: false } },
  unlockedFactionIds: FACTIONS
    .filter((faction) => faction.worldId === 'world_01' && faction.currencyKind === 'worldCurrency')
    .map((faction) => faction.id),
  heroes: {},
  jobBooks: {},
  formation: [],
  unlockedWorldIds: ['world_01'],
  clearedStageByWorldDifficulty: { 'world_01:1': 0 },
  encounteredEnemyIds: [],
  factionBoards: {},
  acceptedFactionQuests: {},
  unlockedSkinIds: [],
  inventory: [],
  materials: {},
  starSoul: 0,
  blueprints: {},
  unlockedRecipeIds: [],
  treasureManualGrants: {},
  infiniteTowerFloor: 0,
  divineLadderFloor: 0,
  divineRankLevel: 1,
  shrines: Object.fromEntries(ORIGINAL_DEITIES.map((deity) => [String(deity.shrineId), { phase: 'raid', progress: 0 }])),
  deities: {},
  sacredBeasts: Object.fromEntries(ORIGINAL_SACRED_BEASTS.map((beast) => [String(beast.id), {
    highestClearedStage: 0,
    claimedStages: [],
  }])),
  largeDungeonClears: {},
  city: createInitialCityState(),
  statistics: {
    kills: 0,
    bossKills: 0,
    equipmentMissedAtCapacity: 0,
  },
  lastSavedAt: now,
})

export const normalizePlayerName = (input: string): string => {
  const name = input.trim()
  if (!name) throw new Error('请输入玩家姓名')
  if ([...name].length > 8) throw new Error('玩家姓名最多 8 个字符')
  return name
}

export const createNewGameStateV10 = (playerName: string, now = Date.now()): GameStateV10 => {
  const state = createInitialStateV10(now)
  state.heroes[PLAYER_HERO_ID] = {
    ...createHeroProgress(STARTER_CAREER_ID),
    customName: normalizePlayerName(playerName),
  }
  state.formation = [{ heroId: PLAYER_HERO_ID, row: 1, col: 0 }]
  return state
}
