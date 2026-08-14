import { createRng } from '../combat/rng'
import type { CombatRank } from '../combat/types'
import {
  EQUIPMENT_QUALITIES,
  EQUIPMENT_QUALITY_LEVEL_GAP,
  equipmentPoolForStage,
  equipmentSetPoolForStage,
  rollAffixes,
  rollEquipmentLevel,
  type EquipmentSlot,
} from '../content/equipment'
import type { EquipmentInstance, EquipmentQuality, GameStateV10 } from './types'
import { addEquipment } from './inventory'

export interface LootDropInput {
  worldId: string
  difficulty: number
  stage: number
  rank: CombatRank
  seed: number
  enemyId: string
}

const SET_DROP_CHANCE: Record<CombatRank, number> = {
  normal: 0.12,
  elite: 0.28,
  boss: 0.45,
}

const DROP_COUNT: Record<CombatRank, number> = {
  normal: 1,
  elite: 2,
  boss: 2,
}

const QUALITY_WEIGHTS: Record<CombatRank, readonly number[]> = {
  normal: [70, 22, 7, 1, 0],
  elite: [40, 35, 18, 6, 1],
  boss: [15, 30, 32, 18, 5],
}

const pickWeightedQuality = (rank: CombatRank, roll: number): EquipmentQuality => {
  const weights = QUALITY_WEIGHTS[rank]
  let cursor = 0
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const target = roll * total
  for (let index = 0; index < weights.length; index += 1) {
    cursor += weights[index]
    if (target < cursor) return EQUIPMENT_QUALITIES[index]
  }
  return EQUIPMENT_QUALITIES[EQUIPMENT_QUALITIES.length - 1]
}

export const dropCountForRank = (rank: CombatRank): number => DROP_COUNT[rank]

export const grantKillLoot = (state: GameStateV10, input: LootDropInput): string[] => {
  const pool = equipmentPoolForStage(input.worldId, input.stage)
  if (pool.length === 0) return []
  const setPool = equipmentSetPoolForStage(input.worldId, input.stage)
  const rng = createRng(input.seed)
  const added: string[] = []
  const count = input.rank === 'elite' ? rng.nextInt(1, 3) : DROP_COUNT[input.rank]
  const baseLevel = rollEquipmentLevel(input.worldId, input.difficulty, input.stage)

  for (let index = 0; index < count; index += 1) {
    const fromSet = setPool.length > 0 && rng.nextFloat() < SET_DROP_CHANCE[input.rank]
    const definition = fromSet ? rng.pick(setPool) : rng.pick(pool)
    let quality = pickWeightedQuality(input.rank, rng.nextFloat())
    if (definition.setName && EQUIPMENT_QUALITIES.indexOf(quality) < 2) quality = '上品'
    const level = baseLevel + (definition.setName ? EQUIPMENT_QUALITY_LEVEL_GAP : 0)
    const equipment: EquipmentInstance = {
      uid: `eq_${input.seed}_${input.enemyId}_${index}`,
      definitionId: definition.id,
      level,
      quality,
      affixes: rollAffixes(quality, level, rng),
      locked: false,
    }
    const result = addEquipment(state, equipment)
    if (!result.ok) break
    added.push(equipment.uid)
  }
  return added
}

export const isWearableByHeroLevel = (heroLevel: number, itemLevel: number): boolean =>
  heroLevel >= itemLevel

export type { EquipmentSlot }
