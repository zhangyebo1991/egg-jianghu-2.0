import { describe, expect, it } from 'vitest'
import { equipmentDefinitionById, equipmentDisplayName, rollEquipmentLevel } from '../content/equipment'
import { grantKillLoot } from './loot'
import { createInitialStateV10 } from './state'
import { INVENTORY_CAPACITY } from './inventory'

describe('击杀掉落', () => {
  it('小怪掉 1 件诸天具名装，不进转职书', () => {
    const state = createInitialStateV10()
    const added = grantKillLoot(state, {
      worldId: 'world_01', difficulty: 1, stage: 1, rank: 'normal', seed: 11, enemyId: 'mob_1',
    })

    expect(added).toHaveLength(1)
    expect(state.inventory).toHaveLength(1)
    expect(state.inventory[0].uid).toBe(added[0])
    expect(state.inventory[0].definitionId.startsWith('wp_')).toBe(true)
    const definition = equipmentDefinitionById(state.inventory[0].definitionId)
    expect(['柴刀', '屠龙宝刀', '祝融灵珠', '小李飞刀']).not.toContain(definition?.name)
    const displayName = equipmentDisplayName(definition!, state.inventory[0].affixes)
    expect(displayName.includes('的') || displayName.includes('·')).toBe(true)
    expect(state.inventory[0].level).toBe(rollEquipmentLevel('world_01', 1, 1) + (definition?.setName ? 2 : 0))
    expect(['铁爪', '皮帽', '项链', '文卷', '布帽', '护符', '长戟', '头盔', '铁甲', '长弓', '皮甲', '戒指', '古剑', '长衫', '扳指', '符箓']).toContain(definition?.name)
    expect(Object.keys(state.jobBooks)).toEqual([])
  })

  it('黄巾起义首领有概率掉鬼谋套装件，凡品装等 6、套装再加品质等级差 2', () => {
    const names: string[] = []
    for (let seed = 1; seed <= 80; seed += 1) {
      const state = createInitialStateV10()
      grantKillLoot(state, {
        worldId: 'world_01', difficulty: 1, stage: 1, rank: 'boss', seed, enemyId: 'boss',
      })
      for (const item of state.inventory) {
        const definition = equipmentDefinitionById(item.definitionId)!
        names.push(equipmentDisplayName(definition, item.affixes))
        if (definition.setName === '鬼谋') expect(item.level).toBe(8)
        else expect(item.level).toBe(6)
      }
    }
    expect(names.some((name) => name.startsWith('鬼谋·'))).toBe(true)
    expect(names.some((name) => name.includes('屠龙'))).toBe(false)
  })

  it('同 seed 掉落完全一致', () => {
    const left = createInitialStateV10()
    const right = createInitialStateV10()
    const input = { worldId: 'world_01' as const, difficulty: 2, stage: 4, rank: 'boss' as const, seed: 99, enemyId: 'boss' }
    expect(grantKillLoot(left, input)).toEqual(grantKillLoot(right, input))
    expect(left.inventory).toEqual(right.inventory)
  })

  it('背包满时跳过掉落并记入错过件数', () => {
    const state = createInitialStateV10()
    state.inventory = Array.from({ length: INVENTORY_CAPACITY }, (_, index) => ({
      uid: `full_${index}`,
      definitionId: 'wp_101',
      level: 1,
      quality: '凡品' as const,
      affixes: [],
      locked: false,
    }))

    const added = grantKillLoot(state, {
      worldId: 'world_01', difficulty: 1, stage: 1, rank: 'boss', seed: 3, enemyId: 'boss',
    })

    expect(added).toEqual([])
    expect(state.inventory).toHaveLength(INVENTORY_CAPACITY)
    expect(state.statistics.equipmentMissedAtCapacity).toBeGreaterThan(0)
  })
})
