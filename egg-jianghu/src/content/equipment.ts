import type { EquipmentInstance, EquipmentQuality } from '../domain/types'
import type { Rng } from '../combat/rng'
import { ATTRIBUTE_BY_ID } from './attributes'
import { STAGE_COUNT } from './worlds'
import {
  GENERATED_EQUIPMENT,
  GENERATED_EQUIPMENT_IDS_BY_STYLE,
  GENERATED_ORDINARY_IDS_BY_STAGE,
  GENERATED_SET_EQUIPMENT,
  GENERATED_SET_IDS_BY_STAGE,
  GENERATED_SET_NAME_BY_STAGE,
} from './equipment-generated'
import {
  ORIGINAL_ARTIFACT_SOULS,
  ORIGINAL_DEITIES,
  ORIGINAL_LARGE_DUNGEONS,
  ORIGINAL_SACRED_BEASTS,
  ORIGINAL_SACRED_UPGRADES,
  ORIGINAL_TREASURES,
} from './original-progression.generated'

export const EQUIPMENT_SET_COUNT = 3
export const COMBAT_EQUIPMENT_SLOTS = ['weapon', 'offhand', 'head', 'armor', 'wrist', 'boots', 'necklace', 'ring'] as const
export const EQUIPMENT_SLOTS = [...COMBAT_EQUIPMENT_SLOTS, 'treasure'] as const
export const EQUIPMENT_QUALITIES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export const EQUIPMENT_STYLE_FAMILIES = ['中式古代', '江湖', '西方', '日式', '近代', '未来'] as const
export const EQUIPMENT_AFFIX_COUNTS = [0, 1, 2, 2, 3, 3, 4, 4, 5, 5] as const

export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number]
export type EquipmentSetIndex = 0 | 1 | 2
export type EquipmentStyleFamily = typeof EQUIPMENT_STYLE_FAMILIES[number]

export const isEquipmentQuality = (value: unknown): value is EquipmentQuality =>
  typeof value === 'number' && EQUIPMENT_QUALITIES.includes(value as EquipmentQuality)

export interface EquipmentDefinitionV10 {
  id: string
  iconKey: string
  name: string
  slot: EquipmentSlot
  weaponType: number
  weaponTypeName: string
  styleFamily: EquipmentStyleFamily
  rarity: string
  coreStats: readonly EquipmentCoreStatDefinition[]
  affixPool: readonly number[]
  fixedQuality?: EquipmentQuality
  setFactionId?: number
  setElement?: number
  setName?: string
  sourceItemId?: number
  equipmentKind?: 'standard' | 'artifact-soul' | 'treasure' | 'treasure-manual'
  description?: string
  grantSkillId?: number
  fixedEffects?: readonly { attributeId: number; value: number }[]
  fixedAffixes?: readonly { attributeId: number; coefficient: number }[]
  artifactSoulId?: number
  recipeId?: number
  passiveSkillId?: number
}

export interface EquipmentCoreStatDefinition {
  attributeId: number
  baseCoefficient: number
}

export type EquipmentAffixGrade = 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS'

export const EQUIPMENT_SLOT_NAMES: Record<EquipmentSlot, string> = {
  weapon: '武器',
  offhand: '副手',
  head: '头部',
  armor: '身体',
  wrist: '护腕',
  boots: '足部',
  necklace: '项链',
  ring: '戒指',
  treasure: '至宝',
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
  treasure: '宝',
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

const GENERATED_DEFINITIONS: EquipmentDefinitionV10[] = [
  ...GENERATED_EQUIPMENT,
  ...GENERATED_SET_EQUIPMENT,
].map((item) => ({
  id: item.id,
  iconKey: item.iconKey,
  name: item.name,
  slot: item.slot,
  weaponType: item.weaponType,
  weaponTypeName: item.weaponTypeName,
  styleFamily: item.styleFamily,
  rarity: item.rarity,
  coreStats: item.coreStats,
  affixPool: item.affixPool,
  fixedQuality: 'fixedQuality' in item ? item.fixedQuality as EquipmentQuality : undefined,
  setFactionId: 'setFactionId' in item ? item.setFactionId : undefined,
  setElement: 'setElement' in item ? item.setElement : undefined,
  setName: 'setName' in item ? item.setName : undefined,
  sourceItemId: Number(item.id.replace(/\D/g, '')) || undefined,
  equipmentKind: 'standard',
}))

const ORIGINAL_SLOT_BY_ID: Record<number, EquipmentSlot> = {
  1: 'weapon',
  2: 'offhand',
  3: 'head',
  4: 'armor',
  5: 'wrist',
  6: 'boots',
  7: 'necklace',
  8: 'ring',
}

interface OriginalEquipmentSnapshot {
  readonly itemId: number
  readonly name: string
  readonly quality: number
  readonly slotId: number
  readonly weaponType: number
  readonly rarity: string
  readonly recipeId: number | null
  readonly fixedAffixes: readonly { readonly attributeId: number; readonly coefficient: number }[]
  readonly artifactSoulId: number | null
  readonly setFactionId: number | null
  readonly passiveSkillId: number | null
}

const originalEquipmentSnapshots: OriginalEquipmentSnapshot[] = [
  ...ORIGINAL_LARGE_DUNGEONS.flatMap((dungeon) => dungeon.rewards.flatMap((reward) =>
    reward.kind === 'equipment' ? [reward.item] : [])),
  ...ORIGINAL_SACRED_BEASTS.flatMap((beast) => beast.stages.map((stage) => stage.equipment)),
  ...ORIGINAL_DEITIES.map((deity) => deity.imperialWeapon),
  ...ORIGINAL_SACRED_UPGRADES.flatMap((upgrade) => [upgrade.source, upgrade.target]),
]

const originalSnapshotByItemId = new Map<number, OriginalEquipmentSnapshot>()
for (const snapshot of originalEquipmentSnapshots) originalSnapshotByItemId.set(snapshot.itemId, snapshot)

const templateForOriginalEquipment = (slot: EquipmentSlot, weaponType: number): EquipmentDefinitionV10 | undefined =>
  GENERATED_DEFINITIONS.find((definition) => definition.slot === slot && definition.weaponType === weaponType)
  ?? GENERATED_DEFINITIONS.find((definition) => definition.slot === slot)

const ORIGINAL_FIXED_EQUIPMENT: EquipmentDefinitionV10[] = [...originalSnapshotByItemId.values()].map((snapshot) => {
  const slot = ORIGINAL_SLOT_BY_ID[snapshot.slotId]
  if (!slot) throw new Error(`原版装备 wp#${snapshot.itemId} 的部位无效: ${snapshot.slotId}`)
  const template = templateForOriginalEquipment(slot, snapshot.weaponType)
  if (!template) throw new Error(`原版装备 wp#${snapshot.itemId} 缺少 ${slot} 属性模板`)
  return {
    id: `wp_${snapshot.itemId}`,
    iconKey: `zt_eq_${snapshot.itemId}`,
    name: snapshot.name,
    slot,
    weaponType: snapshot.weaponType,
    weaponTypeName: template.weaponTypeName,
    styleFamily: template.styleFamily,
    rarity: snapshot.rarity,
    coreStats: template.coreStats,
    affixPool: template.affixPool,
    fixedQuality: snapshot.quality as EquipmentQuality,
    setFactionId: snapshot.setFactionId ?? undefined,
    sourceItemId: snapshot.itemId,
    equipmentKind: snapshot.artifactSoulId ? 'artifact-soul' : 'standard',
    fixedAffixes: snapshot.fixedAffixes,
    artifactSoulId: snapshot.artifactSoulId ?? undefined,
    recipeId: snapshot.recipeId ?? undefined,
    passiveSkillId: snapshot.passiveSkillId ?? undefined,
  }
})

const ORIGINAL_TREASURE_EQUIPMENT: EquipmentDefinitionV10[] = ORIGINAL_TREASURES.map((treasure) => ({
  id: `wp_${treasure.itemId}`,
  iconKey: `zt_eq_${treasure.itemId}`,
  name: treasure.name,
  slot: 'treasure',
  weaponType: 0,
  weaponTypeName: treasure.kind === 'manual' ? '秘籍' : '至宝',
  styleFamily: '中式古代',
  rarity: '至宝',
  coreStats: [],
  affixPool: [],
  fixedQuality: treasure.quality as EquipmentQuality,
  sourceItemId: treasure.itemId,
  equipmentKind: treasure.kind === 'manual' ? 'treasure-manual' : 'treasure',
  description: treasure.description,
  grantSkillId: treasure.grantSkillId ?? undefined,
  fixedEffects: treasure.effectIds.map((attributeId) => ({ attributeId, value: treasure.effectValue })),
}))

export const EQUIPMENT_DEFINITIONS: EquipmentDefinitionV10[] = [
  ...GENERATED_DEFINITIONS,
  ...ORIGINAL_FIXED_EQUIPMENT,
  ...ORIGINAL_TREASURE_EQUIPMENT,
]

const EQUIPMENT_BY_ID = new Map(EQUIPMENT_DEFINITIONS.map((item) => [item.id, item]))

export const affixPrefix = (attributeId: number): string => {
  const attribute = ATTRIBUTE_BY_ID[attributeId]
  const prefix = attribute?.affix?.trim()
  return prefix && prefix !== '无' ? prefix : ''
}

export const equipmentDisplayName = (
  definition: EquipmentDefinitionV10,
  affixes: Array<{ attributeId: number }> = [],
): string => {
  if (definition.equipmentKind && definition.equipmentKind !== 'standard') return definition.name
  if (definition.setName) return `${definition.setName}·${definition.name}`
  const prefix = affixes.map((affix) => affixPrefix(affix.attributeId)).find(Boolean)
    ?? affixPrefix(definition.coreStats[0]?.attributeId ?? 0)
  return `${prefix ?? ''}${definition.name}`
}

export const equipmentDefinitionById = (id: string): EquipmentDefinitionV10 | undefined =>
  EQUIPMENT_BY_ID.get(id)

export const artifactSoulById = (id: number | undefined) =>
  id === undefined ? undefined : ORIGINAL_ARTIFACT_SOULS.find((soul) => soul.id === id)

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

const roundTo = (value: number, digits: number): number => {
  const multiplier = 10 ** digits
  return Math.round(value * multiplier) / multiplier
}

/** 核心属性在模板系数的 90%–110% 独立掷值，原版记录到一位小数。 */
export const rollCoreCoefficient = (baseCoefficient: number, rng: Rng): number =>
  roundTo(baseCoefficient * (0.9 + rng.nextFloat() * 0.2), 1)

/** 附词条先按品质掷系数，原版记录到两位小数。 */
export const rollAffixCoefficient = (quality: EquipmentQuality, rng: Rng): number => {
  const min = 30 + quality * 10
  const max = 110 + quality * 10 - 0.01
  return roundTo(min + rng.nextFloat() * (max - min), 2)
}

export const equipmentAffixGrade = (coefficient: number): EquipmentAffixGrade => {
  if (coefficient < 60) return 'E'
  if (coefficient < 80) return 'D'
  if (coefficient < 100) return 'C'
  if (coefficient < 120) return 'B'
  if (coefficient < 140) return 'A'
  if (coefficient < 160) return 'S'
  if (coefficient < 180) return 'SS'
  return 'SSS'
}

export const equipmentCoreRollPercent = (
  coefficient: number,
  baseCoefficient: number,
): number => Math.round(coefficient / baseCoefficient * 100)

/**
 * 原版装备属性结算。装备属性等级为物品等级 ×10，强化星级为 0；
 * 核心权重 100，附词条权重 50。
 */
export const equipmentAttributeValue = (
  attributeId: number,
  itemLevel: number,
  coefficient: number,
  weight: 50 | 100,
): number => {
  const attribute = ATTRIBUTE_BY_ID[attributeId]
  if (!attribute) throw new Error(`未知装备属性: ${attributeId}`)
  const attributeLevel = itemLevel * 10
  if (attributeId === 7) {
    return Math.max(1, Math.floor(
      (10 + attributeLevel / 40)
      * coefficient / 100
      * weight / 100,
    ))
  }
  if (attribute.calcType === '指数' && (attribute.unit === '整数' || attribute.unit === '每秒')) {
    return Math.max(1, Math.floor(
      attribute.default / 100
      * Math.pow(1.0095, attributeLevel)
      * coefficient / 100
      * weight / 100,
    ))
  }
  if (attribute.calcType === '乘法' && attribute.unit === '百分比') {
    return (6 + attributeLevel / 300)
      * coefficient / 100
      * weight / 100
      * attribute.default / 10
  }
  throw new Error(`装备属性 ${attributeId} 使用了未确认的结算类型`)
}

export const formatEquipmentAttributeValue = (attributeId: number, value: number): string => {
  const attribute = ATTRIBUTE_BY_ID[attributeId]
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '')
  if (attribute?.unit === '百分比') return `${formatted}%`
  if (attribute?.unit === '每秒') return `${formatted}/秒`
  return formatted
}

const ELEMENT_ATTRIBUTE_MIN = 44
const ELEMENT_ATTRIBUTE_MAX = 59

export const isAffixAllowedForSetElement = (attributeId: number, setElement = 0): boolean => {
  if (attributeId < ELEMENT_ATTRIBUTE_MIN || attributeId > ELEMENT_ATTRIBUTE_MAX || setElement === 0) return true
  const firstAllowed = 42 + setElement * 2
  return attributeId === firstAllowed || attributeId === firstAllowed + 1
}

const rollAffixAttributeId = (definition: EquipmentDefinitionV10, rng: Rng): number => {
  while (true) {
    const attributeId = rng.pick(definition.affixPool)
    if (isAffixAllowedForSetElement(attributeId, definition.setElement)) return attributeId
  }
}

export const rollAffixes = (
  definition: EquipmentDefinitionV10,
  quality: EquipmentQuality,
  rng: Rng,
): EquipmentInstance['affixes'] => {
  const coefficients = Array.from(
    { length: EQUIPMENT_AFFIX_COUNTS[quality] },
    () => rollAffixCoefficient(quality, rng),
  )
  return coefficients.map((coefficient) => ({
    attributeId: rollAffixAttributeId(definition, rng),
    coefficient,
  }))
}

export const rollEquipmentStats = (
  definition: EquipmentDefinitionV10,
  quality: EquipmentQuality,
  rng: Rng,
): Pick<EquipmentInstance, 'coreStats' | 'affixes'> => {
  const coreStats = definition.coreStats.map((core) => ({
    attributeId: core.attributeId,
    coefficient: rollCoreCoefficient(core.baseCoefficient, rng),
  }))
  return { coreStats, affixes: rollAffixes(definition, quality, rng) }
}

/** 诸天 `装备品质等级差` 全局初值。 */
export const EQUIPMENT_QUALITY_LEVEL_GAP = 2

/** 诸天开战默认 `当前层数`。本游戏无地点内层数，固定用 1。 */
export const ZHUTIAN_BATTLE_FLOOR = 1

/**
 * 诸天 `普通物品等级function`：clamp((阶级-1)*25, 5)。
 * 仅用于「普通物品」（材料等）等级，装备装等不走这条链路。
 */
export const planeBaseItemLevel = (worldIndex: number): number =>
  Math.max(5, (Math.max(1, worldIndex) - 1) * 25)

/**
 * 诸天 `地点编号`：sq 总表全局编号，13 位面 × 10 关连续编号（1–130）。
 * sq.json col2 为位面编号，验证「东汉三国」占 1–10、「武侠江湖」占 11–20。
 */
export const originalStageId = (worldIndex: number, stage: number): number =>
  (Math.max(1, worldIndex) - 1) * STAGE_COUNT + Math.max(1, stage)

/**
 * 诸天 `普通战斗难度系数`：((难度编号-1)*100)+((地点编号-1)*10)+层数。
 * 地点编号用 sq 总表全局编号，位面成长由它承载。
 */
export const combatDifficultyCoefficient = (
  difficulty: number,
  stageId: number,
  floor = ZHUTIAN_BATTLE_FLOOR,
): number => ((Math.max(1, difficulty) - 1) * 100) + ((Math.max(1, stageId) - 1) * 10) + Math.max(1, floor)

/** 诸天 `装备装等计算function`：floor((系数+9)/10)+(物品品质-1)*装备品质等级差。 */
export const equipmentLevelFromCoefficient = (
  coefficient: number,
  quality: EquipmentQuality = 1,
  qualityGap = EQUIPMENT_QUALITY_LEVEL_GAP,
): number => Math.floor((coefficient + 9) / 10) + (quality - 1) * qualityGap

/**
 * 原版 `装备穿戴等级function`：round(clamp(物品等级-(物品品质-1)*装备品质等级差, 1))。
 * 正好是 `装备装等计算` 的逆运算，即扣掉品质加成后的基础难度等级。
 */
export const equipmentWearLevel = (
  itemLevel: number,
  quality: EquipmentQuality,
  qualityGap = EQUIPMENT_QUALITY_LEVEL_GAP,
): number => Math.max(1, Math.round(itemLevel - (quality - 1) * qualityGap))

/**
 * 战斗掉落物品等级 = 装备装等计算(难度系数, 实际品质)。
 * 原版 `掉落计算function` 只调用 `装备装等计算`，位面不额外加基础等级；
 * 位面差异通过 sq 全局地点编号进入难度系数。
 */
export const rollEquipmentLevel = (
  worldId: string,
  difficulty: number,
  stage: number,
  quality: EquipmentQuality,
): number => {
  const worldIndex = Number(worldId.replace(/\D/g, '')) || 1
  return equipmentLevelFromCoefficient(
    combatDifficultyCoefficient(difficulty, originalStageId(worldIndex, stage)),
    quality,
  )
}
