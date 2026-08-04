import type { ActionResult, EquipmentInstance, EquipmentQuality, GameStateV10 } from './types'
import { EQUIPMENT_QUALITIES, EQUIPMENT_SLOTS, equipmentDefinitionById } from '../content/equipment'

export const INVENTORY_CAPACITY = 300

export type AddEquipmentResult = { ok: true } | { ok: false; reason: 'inventory-full' }

export const addEquipment = (
  state: GameStateV10,
  equipment: EquipmentInstance,
): AddEquipmentResult => {
  if (state.inventory.length >= INVENTORY_CAPACITY) {
    state.statistics.equipmentMissedAtCapacity += 1
    return { ok: false, reason: 'inventory-full' }
  }
  if (state.inventory.some((item) => item.uid === equipment.uid)) {
    throw new Error(`重复装备 uid: ${equipment.uid}`)
  }
  state.inventory.push(equipment)
  return { ok: true }
}

export const equipEquipment = (
  state: GameStateV10,
  heroId: string,
  equipmentUid: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  const equipment = state.inventory.find((item) => item.uid === equipmentUid)
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  if (!equipment) return { ok: false, message: '装备不存在' }
  const definition = equipmentDefinitionById(equipment.definitionId)
  if (!definition) return { ok: false, message: '装备部位定义不存在' }
  for (const [otherHeroId, progress] of Object.entries(state.heroes)) {
    if (otherHeroId !== heroId && Object.values(progress.equipmentBySlot).includes(equipmentUid)) {
      return { ok: false, message: '装备已被其他侠客穿戴' }
    }
  }
  if (hero.equipmentBySlot[definition.slot] === equipmentUid) return { ok: false, message: '装备已经穿戴' }

  hero.equipmentBySlot[definition.slot] = equipmentUid
  return { ok: true, message: '装备成功' }
}

export const unequipEquipment = (
  state: GameStateV10,
  heroId: string,
  slot: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  if (!hero?.equipmentBySlot[slot]) return { ok: false, message: '该部位没有装备' }
  hero.equipmentBySlot[slot] = null
  return { ok: true, message: '已卸下装备' }
}

export const toggleEquipmentLock = (state: GameStateV10, equipmentUid: string): ActionResult => {
  const equipment = state.inventory.find((item) => item.uid === equipmentUid)
  if (!equipment) return { ok: false, message: '装备不存在' }
  equipment.locked = !equipment.locked
  return { ok: true, message: equipment.locked ? '装备已锁定' : '装备已解锁' }
}

export const organizeInventory = (state: GameStateV10): ActionResult => {
  state.inventory.sort((left, right) => {
    const leftDefinition = equipmentDefinitionById(left.definitionId)
    const rightDefinition = equipmentDefinitionById(right.definitionId)
    const slotDifference = EQUIPMENT_SLOTS.indexOf(leftDefinition?.slot ?? 'token')
      - EQUIPMENT_SLOTS.indexOf(rightDefinition?.slot ?? 'token')
    if (slotDifference !== 0) return slotDifference
    const qualityDifference = EQUIPMENT_QUALITIES.indexOf(right.quality) - EQUIPMENT_QUALITIES.indexOf(left.quality)
    if (qualityDifference !== 0) return qualityDifference
    if (left.level !== right.level) return right.level - left.level
    const definitionDifference = left.definitionId.localeCompare(right.definitionId)
    return definitionDifference || left.uid.localeCompare(right.uid)
  })
  return { ok: true, message: '物品已按部位、品质和等级整理' }
}

// 判断装备是否正被某位侠客穿戴
const isEquipmentEquipped = (state: GameStateV10, uid: string): boolean =>
  Object.values(state.heroes).some((progress) =>
    Object.values(progress.equipmentBySlot).includes(uid))

export const discardEquipmentByQuality = (
  state: GameStateV10,
  maxQuality: EquipmentQuality,
): ActionResult => {
  const maxIndex = EQUIPMENT_QUALITIES.indexOf(maxQuality)
  const discarded = state.inventory.filter((item) =>
    EQUIPMENT_QUALITIES.indexOf(item.quality) <= maxIndex
    && !item.locked
    && !isEquipmentEquipped(state, item.uid))
  if (discarded.length === 0) return { ok: false, message: '没有可丢弃的装备' }
  const removed = new Set(discarded.map((item) => item.uid))
  state.inventory = state.inventory.filter((item) => !removed.has(item.uid))
  return { ok: true, message: `已丢弃 ${discarded.length} 件${maxQuality}及以下装备` }
}
