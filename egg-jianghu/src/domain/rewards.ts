import { createRng, type Rng } from '../combat/rng'
import type { CombatEvent, CombatRank } from '../combat/types'
import {
  EQUIPMENT_QUALITIES,
  EQUIPMENT_SLOTS,
  rollAffixes,
} from '../content/equipment'
import { addCareerExperience } from './careers'
import { addEquipment } from './inventory'
import type { EquipmentInstance, EquipmentQuality, GameStateV10 } from './types'

export interface CombatSettlementResult {
  needsSave: boolean
  addedEquipmentUids: string[]
}

const qualityWeights: Record<CombatRank, readonly number[]> = {
  normal: [70, 22, 7, 1, 0],
  elite: [35, 35, 20, 8, 2],
  boss: [10, 25, 35, 22, 8],
}

const weightedQuality = (rank: CombatRank, worldIndex: number, rng: Rng): EquipmentQuality => {
  const weights = [...qualityWeights[rank]]
  const promotion = Math.floor((worldIndex - 1) / 2)
  for (let step = 0; step < promotion; step += 1) {
    for (let index = weights.length - 1; index > 0; index -= 1) {
      const moved = Math.floor(weights[index - 1] * 0.08)
      weights[index - 1] -= moved
      weights[index] += moved
    }
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = rng.nextFloat() * total
  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index]
    if (roll < 0) return EQUIPMENT_QUALITIES[index]
  }
  return '凡品'
}

const dropCount = (rank: CombatRank, rng: Rng): number => {
  if (rank === 'boss') return 2 + (rng.nextFloat() < 0.5 ? 1 : 0)
  if (rank === 'elite') return 1 + (rng.nextFloat() < 0.25 ? 1 : 0)
  return rng.nextFloat() < 0.35 ? 1 : 0
}

const createEquipmentDrops = (
  event: Extract<CombatEvent, { type: 'enemy-defeated' }>,
): EquipmentInstance[] => {
  const rng = createRng(event.seed)
  const worldIndex = Number(event.worldId.slice(-2)) || 1
  const level = (worldIndex - 1) * 10 + event.stage
  return Array.from({ length: dropCount(event.rank, rng) }, (_, index) => {
    const slot = rng.pick(EQUIPMENT_SLOTS)
    const quality = weightedQuality(event.rank, worldIndex, rng)
    return {
      uid: `${event.enemyId}-${event.seed.toString(36)}-${index}`,
      definitionId: `${event.worldId}_${slot}`,
      level,
      quality,
      affixes: rollAffixes(quality, level, rng),
      locked: false,
    }
  })
}

const grantKillProgress = (
  state: GameStateV10,
  event: Extract<CombatEvent, { type: 'enemy-defeated' }>,
): void => {
  const rankMultiplier = event.rank === 'boss' ? 5 : event.rank === 'elite' ? 2 : 1
  const currency = (5 + event.stage * 2) * rankMultiplier
  state.worldCurrency[event.worldId] = (state.worldCurrency[event.worldId] ?? 0) + currency
  state.statistics.kills += 1
  if (event.rank === 'boss') state.statistics.bossKills += 1
  if (!state.encounteredEnemyIds.includes(event.enemyId)) state.encounteredEnemyIds.push(event.enemyId)

  const participatingHeroIds = new Set(state.formation.map((slot) => slot.heroId))
  for (const heroId of participatingHeroIds) {
    const hero = state.heroes[heroId]
    if (!hero?.recruited) continue
    const experience = 8 * rankMultiplier
    hero.experience += experience
    while (hero.experience >= hero.level * 100) {
      hero.experience -= hero.level * 100
      hero.level += 1
    }
    addCareerExperience(hero, experience)
  }
}

export const settleCombatEvent = (
  state: GameStateV10,
  event: CombatEvent,
): CombatSettlementResult => {
  if (event.type !== 'enemy-defeated') return { needsSave: false, addedEquipmentUids: [] }

  grantKillProgress(state, event)
  const addedEquipmentUids: string[] = []
  for (const equipment of createEquipmentDrops(event)) {
    if (addEquipment(state, equipment).ok) addedEquipmentUids.push(equipment.uid)
  }
  return { needsSave: true, addedEquipmentUids }
}
