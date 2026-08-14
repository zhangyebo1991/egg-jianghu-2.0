import type { EquipmentInstance, EquipmentQuality } from '../domain/types'
import type { Rng } from '../combat/rng'
import { ATTRIBUTE_BY_ID, ATTRIBUTES, type AttributeDefinition } from './attributes'
import {
  GENERATED_EQUIPMENT,
  GENERATED_EQUIPMENT_IDS_BY_STYLE,
  GENERATED_ORDINARY_IDS_BY_STAGE,
  GENERATED_SET_EQUIPMENT,
  GENERATED_SET_IDS_BY_STAGE,
  GENERATED_SET_NAME_BY_STAGE,
} from './equipment-generated'

export const EQUIPMENT_SET_COUNT = 3
export const EQUIPMENT_SLOTS = ['weapon', 'offhand', 'head', 'armor', 'wrist', 'boots', 'necklace', 'ring'] as const
export const EQUIPMENT_QUALITIES = ['凡品', '良品', '上品', '珍品', '绝品'] as const
export const EQUIPMENT_STYLE_FAMILIES = ['中式古代', '江湖', '西方', '日式', '近代', '未来'] as const
const EQUIPMENT_QUALITY_MULTIPLIERS = [1, 1.18, 1.42, 1.72, 2.08] as const

export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number]
export type EquipmentSetIndex = 0 | 1 | 2
export type EquipmentStyleFamily = typeof EQUIPMENT_STYLE_FAMILIES[number]

export interface EquipmentDefinitionV10 {
  id: string
  name: string
  slot: EquipmentSlot
  weaponType: number
  weaponTypeName: string
  styleFamily: EquipmentStyleFamily
  rarity: string
  baseStatId: string
  baseValue: number
  setName?: string
}

export interface EquipmentAffixDefinitionV10 {
  id: string
  name: string
  min: number
  max: number
}

export const EQUIPMENT_SLOT_NAMES: Record<EquipmentSlot, string> = {
  weapon: '武器',
  offhand: '副手',
  head: '头部',
  armor: '身体',
  wrist: '护腕',
  boots: '足部',
  necklace: '项链',
  ring: '戒指',
}

export const EQUIPMENT_SLOT_MARKS: Record<EquipmentSlot, string> = {
  weapon: '兵',
  offhand: '副',
  head: '冠',
  armor: '甲',
  wrist: '腕',
  boots: '履',
  necklace: '佩',
  ring: '戒',
}

export const EQUIPMENT_STYLE_BY_WORLD: Record<string, EquipmentStyleFamily> = {
  world_01: '中式古代',
  world_02: '江湖',
  world_03: '中式古代',
  world_04: '西方',
  world_05: '江湖',
  world_06: '日式',
  world_07: '近代',
  world_08: '中式古代',
  world_09: '未来',
  world_10: '江湖',
  world_11: '西方',
  world_12: '近代',
  world_13: '中式古代',
}

const LEGACY_EQUIPMENT_SLOT_MAP: Record<string, EquipmentSlot> = {
  waist: 'necklace',
  token: 'ring',
}

export const EQUIPMENT_DEFINITIONS: EquipmentDefinitionV10[] = [
  ...GENERATED_EQUIPMENT,
  ...GENERATED_SET_EQUIPMENT,
].map((item) => ({
  id: item.id,
  name: item.name,
  slot: item.slot,
  weaponType: item.weaponType,
  weaponTypeName: item.weaponTypeName,
  styleFamily: item.styleFamily,
  rarity: item.rarity,
  baseStatId: item.baseStatId,
  baseValue: item.baseValue,
  setName: 'setName' in item ? item.setName : undefined,
}))

const EQUIPMENT_BY_ID = new Map(EQUIPMENT_DEFINITIONS.map((item) => [item.id, item]))

const ROLLABLE_AFFIX_CATEGORIES = new Set(['核心', '附加', '元素'])
const ROLLABLE_SPECIAL_AFFIX_IDS = new Set([28, 29, 37, 38])

const affixRollRange = (attr: AttributeDefinition): { min: number; max: number } => {
  if (attr.id === 6) return { min: 12, max: 80 }
  if (attr.id === 7) return { min: 1, max: 8 }
  if (attr.id === 15) return { min: 2, max: 15 }
  if (attr.id === 28 || attr.id === 29) return { min: 1, max: 5 }
  if (attr.unit === '百分比') return { min: 2, max: 12 }
  return { min: 3, max: 18 }
}

export const EQUIPMENT_AFFIXES: EquipmentAffixDefinitionV10[] = ATTRIBUTES
  .filter((attr) => {
    if (!attr.uiFlag) return false
    if (ROLLABLE_AFFIX_CATEGORIES.has(attr.category)) return true
    return ROLLABLE_SPECIAL_AFFIX_IDS.has(attr.id)
  })
  .map((attr) => {
    const range = affixRollRange(attr)
    return { id: String(attr.id), name: attr.name, min: range.min, max: range.max }
  })

const BASE_STAT_TO_SX: Record<string, number> = {
  attack: 8,
  externalAttack: 8,
  internalAttack: 10,
  maxHp: 6,
  externalDefense: 9,
  internalDefense: 11,
  agility: 7,
  effectiveAgility: 7,
  accuracy: 18,
  energyRecovery: 29,
  cooldownRate: 37,
  criticalChance: 12,
}

export const affixPrefix = (affixId: string): string => {
  const sxId = Number(affixId)
  const attribute = Number.isInteger(sxId) && sxId > 0
    ? ATTRIBUTE_BY_ID[sxId]
    : ATTRIBUTE_BY_ID[BASE_STAT_TO_SX[affixId]]
  const prefix = attribute?.affix?.trim()
  return prefix && prefix !== '无' ? prefix : ''
}

export const equipmentDisplayName = (
  definition: EquipmentDefinitionV10,
  affixes: Array<{ id: string }> = [],
): string => {
  if (definition.setName) return `${definition.setName}·${definition.name}`
  const prefix = affixes.map((affix) => affixPrefix(affix.id)).find(Boolean)
    ?? affixPrefix(definition.baseStatId)
  return `${prefix ?? ''}${definition.name}`
}

export const equipmentDefinitionById = (id: string): EquipmentDefinitionV10 | undefined =>
  EQUIPMENT_BY_ID.get(id)

export const equipmentStyleForWorld = (worldId: string): EquipmentStyleFamily =>
  EQUIPMENT_STYLE_BY_WORLD[worldId] ?? '中式古代'

export const equipmentPoolForWorld = (worldId: string): EquipmentDefinitionV10[] => {
  const ids = GENERATED_EQUIPMENT_IDS_BY_STYLE[equipmentStyleForWorld(worldId)]
  return ids.map((id) => equipmentDefinitionById(id)).filter((item): item is EquipmentDefinitionV10 => Boolean(item))
}

export const equipmentPoolForStage = (worldId: string, stage: number): EquipmentDefinitionV10[] => {
  const ids = (GENERATED_ORDINARY_IDS_BY_STAGE as Record<string, readonly string[]>)[`${worldId}:${stage}`] ?? []
  return ids.map((id) => equipmentDefinitionById(id)).filter((item): item is EquipmentDefinitionV10 => Boolean(item))
}

export const equipmentSetPoolForStage = (worldId: string, stage: number): EquipmentDefinitionV10[] => {
  const ids = (GENERATED_SET_IDS_BY_STAGE as Record<string, readonly string[]>)[`${worldId}:${stage}`] ?? []
  return ids.map((id) => equipmentDefinitionById(id)).filter((item): item is EquipmentDefinitionV10 => Boolean(item))
}

export const equipmentSetNameForStage = (worldId: string, stage: number): string =>
  (GENERATED_SET_NAME_BY_STAGE as Record<string, string>)[`${worldId}:${stage}`] ?? ''

export const equipmentIdBySlot = (slot: EquipmentSlot, styleFamily: EquipmentStyleFamily = '中式古代'): string => {
  const found = EQUIPMENT_DEFINITIONS.find((item) => item.slot === slot && item.styleFamily === styleFamily && !item.setName)
  if (!found) throw new Error(`缺少 ${styleFamily} ${slot} 装备`)
  return found.id
}

export const canonicalEquipmentSlot = (slot: string): EquipmentSlot | undefined => {
  const mapped = LEGACY_EQUIPMENT_SLOT_MAP[slot] ?? slot
  return EQUIPMENT_SLOTS.includes(mapped as EquipmentSlot) ? mapped as EquipmentSlot : undefined
}

export const canonicalEquipmentDefinitionId = (definitionId: string): string =>
  definitionId.replace(/_waist$/, '_necklace').replace(/_token$/, '_ring')

export const isEquipmentSetIndex = (value: unknown): value is EquipmentSetIndex =>
  value === 0 || value === 1 || value === 2

export const equipmentBaseStatValue = (
  definition: EquipmentDefinitionV10,
  equipment: EquipmentInstance,
): number => Math.floor(
  (definition.baseValue + equipment.level)
  * EQUIPMENT_QUALITY_MULTIPLIERS[EQUIPMENT_QUALITIES.indexOf(equipment.quality)],
)

export const equipmentAffixRange = (
  definition: EquipmentAffixDefinitionV10,
  level: number,
): { min: number; max: number } => ({
  min: definition.min + Math.floor(level / 10),
  max: definition.max + Math.floor(level / 5),
})

export const rollAffixes = (
  quality: EquipmentQuality,
  level: number,
  rng: Rng,
): Array<{ id: string; value: number }> => {
  const count = EQUIPMENT_QUALITIES.indexOf(quality)
  const pool = [...EQUIPMENT_AFFIXES]
  return Array.from({ length: count }, () => {
    const index = rng.nextInt(0, pool.length)
    const affix = pool.splice(index, 1)[0]
    const range = equipmentAffixRange(affix, level)
    return { id: affix.id, value: rng.nextInt(range.min, range.max + 1) }
  })
}

/** 诸天 `装备品质等级差` 全局初值，套装件在凡品装等上再加这一档。 */
export const EQUIPMENT_QUALITY_LEVEL_GAP = 2

/** 诸天开战默认 `当前层数`。本游戏无地点内层数，固定用 1。 */
export const ZHUTIAN_BATTLE_FLOOR = 1

/** 诸天 `普通物品等级function`：clamp((位面-1)*25, 5)。 */
export const planeBaseItemLevel = (worldIndex: number): number =>
  Math.max(5, (Math.max(1, worldIndex) - 1) * 25)

/**
 * 诸天 `普通战斗难度系数`：((难度编号-1)*100)+((地点编号-1)*10)+层数。
 * 地点编号用位面内 1–10（地点标识.地点编号），不是 sq 总表 id。
 */
export const combatDifficultyCoefficient = (
  difficulty: number,
  stage: number,
  floor = ZHUTIAN_BATTLE_FLOOR,
): number => ((Math.max(1, difficulty) - 1) * 100) + ((Math.max(1, stage) - 1) * 10) + Math.max(1, floor)

/** 诸天 `装备装等计算function`：floor((系数+9)/10)+(物品品质-1)*装备品质等级差。凡品品质=1。 */
export const equipmentLevelFromCoefficient = (
  coefficient: number,
  qualityIndex = 1,
  qualityGap = EQUIPMENT_QUALITY_LEVEL_GAP,
): number => Math.floor((coefficient + 9) / 10) + (Math.max(1, qualityIndex) - 1) * qualityGap

/**
 * 战斗掉落物品等级 = 普通物品等级(位面) + 装备装等计算(难度系数, 凡品)。
 * 套装件的 +装备品质等级差 在掉落处另加。
 */
export const rollEquipmentLevel = (worldId: string, difficulty: number, stage: number): number => {
  const worldIndex = Number(worldId.replace(/\D/g, '')) || 1
  return planeBaseItemLevel(worldIndex)
    + equipmentLevelFromCoefficient(combatDifficultyCoefficient(difficulty, stage))
}
