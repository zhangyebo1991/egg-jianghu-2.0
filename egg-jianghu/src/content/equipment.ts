import type { EquipmentInstance, EquipmentQuality } from '../domain/types'
import type { Rng } from '../combat/rng'
import { equipmentName } from './equipment-names'

export const EQUIPMENT_SET_COUNT = 3
export const EQUIPMENT_SLOTS = ['weapon', 'offhand', 'head', 'armor', 'wrist', 'boots', 'necklace', 'ring'] as const
export const EQUIPMENT_QUALITIES = ['凡品', '良品', '上品', '珍品', '绝品'] as const
const EQUIPMENT_QUALITY_MULTIPLIERS = [1, 1.18, 1.42, 1.72, 2.08] as const

export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number]
export type EquipmentSetIndex = 0 | 1 | 2

export interface EquipmentDefinitionV10 {
  id: string
  name: string
  worldId: string
  slot: EquipmentSlot
  baseStatId: string
  baseValue: number
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

const LEGACY_EQUIPMENT_SLOT_MAP: Record<string, EquipmentSlot> = {
  waist: 'necklace',
  token: 'ring',
}

const baseStatBySlot: Record<EquipmentSlot, string> = {
  weapon: 'attack',
  offhand: 'externalDefense',
  head: 'internalDefense',
  armor: 'externalDefense',
  wrist: 'accuracy',
  boots: 'agility',
  necklace: 'maxHp',
  ring: 'energyRecovery',
}

export const EQUIPMENT_DEFINITIONS: EquipmentDefinitionV10[] = Array.from({ length: 10 }, (_, worldOffset) => {
  const worldIndex = worldOffset + 1
  const worldId = `world_${String(worldIndex).padStart(2, '0')}`
  return EQUIPMENT_SLOTS.map((slot) => ({
    id: `${worldId}_${slot}`,
    name: equipmentName(worldId, slot) ?? `第${worldIndex}卷${EQUIPMENT_SLOT_NAMES[slot]}`,
    worldId,
    slot,
    baseStatId: baseStatBySlot[slot],
    baseValue: 5 + worldIndex * 3,
  }))
}).flat()

export const EQUIPMENT_AFFIXES: EquipmentAffixDefinitionV10[] = [
  // 核心面板词条（egg 字段 id，进 CombatStats）
  { id: 'externalAttack', name: '外功', min: 3, max: 18 },
  { id: 'internalAttack', name: '内功', min: 3, max: 18 },
  { id: 'maxHp', name: '气血', min: 12, max: 80 },
  { id: 'externalDefense', name: '外防', min: 2, max: 15 },
  { id: 'internalDefense', name: '内防', min: 2, max: 15 },
  { id: 'agility', name: '身法', min: 1, max: 8 },
  { id: 'energyRecovery', name: '行气', min: 1, max: 5 },
  { id: 'cooldownRate', name: '回气', min: 1, max: 6 },
  { id: 'criticalChance', name: '会心', min: 1, max: 7 },
  { id: 'controlResistance', name: '定力', min: 1, max: 7 },
  // 诸天附加词条（id = sx 属性编号；buildAttributeMap 直接累加进 AttributeMap，单位百分点）
  { id: '13', name: '暴伤', min: 5, max: 30 },
  { id: '14', name: '吸血', min: 1, max: 8 },
  { id: '16', name: '疗效', min: 2, max: 15 },
  { id: '17', name: '护盾', min: 2, max: 15 },
  { id: '20', name: '物增', min: 3, max: 18 },
  { id: '21', name: '物减', min: 2, max: 12 },
  { id: '22', name: '法增', min: 3, max: 18 },
  { id: '23', name: '法减', min: 2, max: 12 },
  { id: '26', name: '终增', min: 2, max: 12 },
  { id: '27', name: '终减', min: 1, max: 8 },
]

export const equipmentDefinitionById = (id: string): EquipmentDefinitionV10 | undefined =>
  EQUIPMENT_DEFINITIONS.find((definition) => definition.id === id)

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
