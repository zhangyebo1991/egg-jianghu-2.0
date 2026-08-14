import { STARTER_CAREER_ID } from '../content/careers'
import { PLAYER_HERO_ID } from '../content/heroes'
import type { GameStateV10, HeroProgressV10 } from './types'

export const createHeroEquipmentSets = (): HeroProgressV10['equipmentSets'] => [{}, {}, {}]

export const createHeroProgress = (careerId: string): HeroProgressV10 => {
  const equipmentSets = createHeroEquipmentSets()
  return {
    recruited: true,
    level: 1,
    experience: 0,
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

export const createInitialStateV10 = (now = Date.now()): GameStateV10 => ({
  version: 16,
  worldCurrency: { world_01: 1000 },
  contribution: {},
  heroes: {},
  jobBooks: {},
  formation: [],
  unlockedWorldIds: ['world_01'],
  clearedStageByWorldDifficulty: { 'world_01:1': 0 },
  encounteredEnemyIds: [],
  factionBoards: {},
  inventory: [],
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
