import { describe, expect, it } from 'vitest'
import { addEquipment, INVENTORY_CAPACITY } from './inventory'
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
})
