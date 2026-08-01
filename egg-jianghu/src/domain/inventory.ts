import type { EquipmentInstance, GameStateV10 } from './types'

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
