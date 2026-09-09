import { CAMPAIGN_LOOT_STAGES, CAMPAIGN_ENEMY_DROPS, CAMPAIGN_DROP_ITEMS, CAMPAIGN_MATERIALS } from '../content/campaign-loot.generated'
import { enemyDefinitionById } from '../content/enemy-names'
import { heroByIdV10 } from '../content/heroes'
import { originalCityTechnologyEffectBonus } from '../content/original-city.generated'
import { buildAttributeMap } from '../combat/stats'
import { createRng } from '../combat/rng'
import type { CombatRank } from '../combat/types'
import {
  equipmentDefinitionById,
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

/** 原版掉落计算：每个 dl 表项独立判定，材料两个槽位也各自判定。 */
export const MATERIAL_QUALITY_WEIGHTS = {
  normal: [90, 10, 0, 0], elite: [50, 40, 10, 0],
  captain: [0, 70, 30, 0], boss: [0, 0, 70, 30],
} as const

export const materialExtraQuality = (rank: CombatRank, roll: number): number => {
  let cumulative = 0
  for (const [quality, weight] of MATERIAL_QUALITY_WEIGHTS[rank].entries()) {
    cumulative += weight
    if (roll * 100 < cumulative) return quality
  }
  return 3
}

export const campaignDropChance = (baseChance: number, bonus: number): number =>
  Math.min(1, Math.max(0, baseChance * (100 + bonus) / 100))

/** 原版总掉落率加成：当前队伍 sx42 合计 + 科技 65 的百分比效果。 */
export const campaignDropBonus = (state: GameStateV10): number => {
  let bonus = originalCityTechnologyEffectBonus(65, state.city.technologyLevels['65'] ?? 0) * 100
  for (const heroId of new Set(state.formation.map(slot => slot.heroId))) {
    const progress = state.heroes[heroId]
    const definition = heroByIdV10(heroId)
    if (progress?.recruited && definition) bonus += buildAttributeMap(definition, progress, state.inventory)[42] ?? 0
  }
  return Math.round(bonus * 100) / 100
}

export const grantKillLoot = (state: GameStateV10, input: LootDropInput): string[] => {
  const stage = CAMPAIGN_LOOT_STAGES.find(s => s.worldId === input.worldId && s.stage === input.stage)
  const enemy = enemyDefinitionById(input.enemyId)
  if (!stage || !enemy || !(stage.enemyIds as readonly number[]).includes(enemy.drId)) return []
  const rng = createRng(input.seed)
  const bonus = campaignDropBonus(state)
  const added: string[] = []
  const addMaterial = (id: number): void => {
    const key = String(id)
    state.materials[key] = (state.materials[key] ?? 0) + 1
  }
  for (const [index, id] of (CAMPAIGN_ENEMY_DROPS[enemy.drId] ?? []).entries()) {
    const item = CAMPAIGN_DROP_ITEMS[id]
    if (rng.nextFloat() >= campaignDropChance(item.chance, bonus)) continue
    if (item.kind === 'material') {
      addMaterial(id)
      continue
    }
    const definition = equipmentDefinitionById(`wp_${id}`)
    if (!definition) throw new Error(`原版掉落装备定义缺失：${id}`)
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
    if (addEquipment(state, equipment).ok) added.push(equipment.uid)
  }
  // 材料是独立堆叠库存；装备背包满不能截断后续物品与材料结算。
  for (const slot of stage.materials) {
    if (rng.nextFloat() >= campaignDropChance(slot.baseChance, bonus)) continue
    const quality = slot.baseQuality + materialExtraQuality(input.rank, rng.nextFloat())
    const material = CAMPAIGN_MATERIALS.find(m => m.family === slot.family && m.quality === quality)
    if (material) addMaterial(material.id)
  }
  return added
}

export const isWearableByHeroLevel = (heroLevel: number, itemLevel: number): boolean =>
  heroLevel >= itemLevel

export type { EquipmentSlot }
