import type { GameStateV10, HeroProgressV10 } from './types'

export const createHeroProgress = (careerId: string): HeroProgressV10 => ({
  recruited: true,
  level: 1,
  experience: 0,
  careers: {
    [careerId]: {
      level: 1,
      experience: 0,
      perfected: false,
    },
  },
  currentCareerId: careerId,
  learnedMartials: {},
  equippedMartialIds: [null, null, null, null],
  heartMethodId: null,
  equipmentBySlot: {},
})

export const createInitialStateV10 = (now = Date.now()): GameStateV10 => ({
  version: 10,
  worldCurrency: { world_01: 1000 },
  contribution: {},
  heroes: {},
  careerTokens: [],
  formation: [],
  unlockedWorldIds: ['world_01'],
  clearedStageByWorld: { world_01: 0 },
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
