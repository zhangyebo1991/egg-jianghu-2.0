import { describe, expect, it } from 'vitest'
import { addEquipment, INVENTORY_CAPACITY, organizeInventory } from './inventory'
import { createInitialStateV10 } from './state'
import type { EquipmentInstance } from './types'

const equipment = (uid: string): EquipmentInstance => ({
  uid,
  definitionId: 'world_01_weapon',
  level: 1,
  quality: '凡品',
  affixes: [],
  locked: false,
})

describe('装备背包', () => {
  it('第 301 件被拒绝但既有装备保留', () => {
    const state = createInitialStateV10()
    state.inventory = Array.from({ length: INVENTORY_CAPACITY }, (_, index) => equipment(`uid_${index}`))

    const result = addEquipment(state, equipment('uid_301'))

    expect(result).toEqual({ ok: false, reason: 'inventory-full' })
    expect(state.inventory).toHaveLength(300)
    expect(state.statistics.equipmentMissedAtCapacity).toBe(1)
  })

  it('拒绝重复 uid，避免同一实例进入背包两次', () => {
    const state = createInitialStateV10()
    addEquipment(state, equipment('same'))

    expect(() => addEquipment(state, equipment('same'))).toThrow('重复装备 uid')
  })

  it('整理物品时按部位、品质和等级稳定排序', () => {
    const state = createInitialStateV10()
    state.inventory = [
      { ...equipment('head'), definitionId: 'world_01_head', quality: '绝品', level: 20 },
      { ...equipment('weapon_low'), quality: '良品', level: 8 },
      { ...equipment('weapon_high'), quality: '上品', level: 3 },
    ]

    expect(organizeInventory(state).ok).toBe(true)
    expect(state.inventory.map((item) => item.uid)).toEqual(['weapon_high', 'weapon_low', 'head'])
  })
})
