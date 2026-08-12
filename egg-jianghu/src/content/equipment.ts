import type { EquipmentInstance, EquipmentQuality } from '../domain/types'
import type { Rng } from '../combat/rng'
import { equipmentName } from './equipment-names'

export const EQUIPMENT_SLOTS = ['weapon', 'head', 'armor', 'wrist', 'waist', 'boots', 'token'] as const
export const EQUIPMENT_QUALITIES = ['凡品', '良品', '上品', '珍品', '绝品'] as const
const EQUIPMENT_QUALITY_MULTIPLIERS = [1, 1.18, 1.42, 1.72, 2.08] as const

export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number]

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

const slotNames: Record<EquipmentSlot, string> = {
  weapon: '兵刃',
  head: '冠巾',
  armor: '衣甲',
  wrist: '护腕',
  waist: '腰佩',
  boots: '履靴',
  token: '信物',
}

const baseStatBySlot: Record<EquipmentSlot, string> = {
  weapon: 'attack',
  head: 'internalDefense',
  armor: 'externalDefense',
  wrist: 'accuracy',
  waist: 'maxHp',
  boots: 'agility',
  token: 'energyRecovery',
}

export const EQUIPMENT_DEFINITIONS: EquipmentDefinitionV10[] = Array.from({ length: 10 }, (_, worldOffset) => {
  const worldIndex = worldOffset + 1
  const worldId = `world_${String(worldIndex).padStart(2, '0')}`
  return EQUIPMENT_SLOTS.map((slot) => ({
    id: `${worldId}_${slot}`,
    name: equipmentName(worldId, slot) ?? `第${worldIndex}卷${slotNames[slot]}`,
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
