import { createRng } from '../combat/rng'
import type { CombatRank } from '../combat/types'
import {
  equipmentPoolForStage,
  equipmentSetPoolForStage,
  rollEquipmentLevel,
  equipmentWearLevel,
  rollEquipmentStats,
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

/** 诸天 `wp.col32`：地点套装的两件装备各自以 1500/10000 判定，且只挂在首领掉落表。 */
export const SET_PIECE_DROP_CHANCE = 0.15

export const shouldDropSetPiece = (rank: CombatRank, roll: number): boolean =>
  rank === 'boss' && roll < SET_PIECE_DROP_CHANCE

const DROP_COUNT: Record<CombatRank, number> = {
  normal: 1,
  elite: 2,
  captain: 2,
  boss: 2,
}

export const ENEMY_GRADE_BY_RANK: Record<CombatRank, 1 | 2 | 3 | 4> = {
  normal: 1,
  elite: 2,
  captain: 3,
  boss: 4,
}

export const BASE_QUALITY_WEIGHTS: Record<1 | 2 | 3 | 4, readonly [number, number, number, number]> = {
  1: [70, 25, 5, 0],
  2: [20, 50, 25, 5],
  3: [10, 30, 45, 15],
  4: [0, 10, 60, 30],
}

/** 当前 13 个普通位面的 wm.col20 均为 1。 */
export const WORLD_EQUIPMENT_QUALITY_BONUS = 1

export const pickWeightedQuality = (rank: CombatRank, roll: number): EquipmentQuality => {
  const weights = BASE_QUALITY_WEIGHTS[ENEMY_GRADE_BY_RANK[rank]]
  let cursor = 0
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const target = roll * total
  for (let index = 0; index < weights.length; index += 1) {
    cursor += weights[index]
    if (target < cursor) return (index + WORLD_EQUIPMENT_QUALITY_BONUS) as EquipmentQuality
  }
  return (weights.length - 1 + WORLD_EQUIPMENT_QUALITY_BONUS) as EquipmentQuality
}

export const dropCountForRank = (rank: CombatRank): number => DROP_COUNT[rank]

export const grantKillLoot = (state: GameStateV10, input: LootDropInput): string[] => {
  const pool = equipmentPoolForStage(input.worldId, input.stage)
  if (pool.length === 0) return []
  const setPool = equipmentSetPoolForStage(input.worldId, input.stage)
  const rng = createRng(input.seed)
  const added: string[] = []
  const count = input.rank === 'elite' ? rng.nextInt(1, 3) : DROP_COUNT[input.rank]
  for (let index = 0; index < count; index += 1) {
    const setDefinition = setPool[index]
    const fromSet = setDefinition !== undefined && shouldDropSetPiece(input.rank, rng.nextFloat())
    const definition = fromSet ? setDefinition : rng.pick(pool)
    const quality = definition.fixedQuality ?? pickWeightedQuality(input.rank, rng.nextFloat())
      const level = rollEquipmentLevel(input.worldId, input.difficulty, input.stage, quality)
    const equipment: EquipmentInstance = {
      uid: `eq_${input.seed}_${input.enemyId}_${index}`,
      definitionId: definition.id,
      level,
      equipmentLevel: equipmentWearLevel(level, quality),
      quality,
      ...rollEquipmentStats(definition, quality, rng),
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
