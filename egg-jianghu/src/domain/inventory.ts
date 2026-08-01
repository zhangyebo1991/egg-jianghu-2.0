import type { EquipmentInstance, GameStateV10 } from './types'
import { equipmentDefinitionById } from '../content/equipment'
import type { ActionResult } from './types'

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
