import { describe, expect, it } from 'vitest'
import { equipmentDefinitionById, equipmentDisplayName, rollEquipmentLevel } from '../content/equipment'
import { grantKillLoot, pickWeightedQuality, SET_PIECE_DROP_CHANCE, shouldDropSetPiece } from './loot'
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
    expect(state.inventory[0].level).toBe(rollEquipmentLevel('world_01', 1, 1, state.inventory[0].quality))
    expect(['铁爪', '皮帽', '项链', '文卷', '布帽', '护符', '长戟', '头盔', '铁甲', '长弓', '皮甲', '戒指', '古剑', '长衫', '扳指', '符箓']).toContain(definition?.name)
    expect(Object.keys(state.jobBooks)).toEqual([])
  })

  it('地点套装只由首领按每件 15% 独立判定', () => {
    expect(SET_PIECE_DROP_CHANCE).toBe(0.15)
    expect(shouldDropSetPiece('normal', 0)).toBe(false)
    expect(shouldDropSetPiece('elite', 0)).toBe(false)
    expect(shouldDropSetPiece('boss', 0.149_999)).toBe(true)
    expect(shouldDropSetPiece('boss', 0.15)).toBe(false)

    for (const rank of ['normal', 'elite'] as const) {
      for (let seed = 1; seed <= 100; seed += 1) {
        const state = createInitialStateV10()
        grantKillLoot(state, {
          worldId: 'world_01', difficulty: 1, stage: 1, rank, seed, enemyId: rank,
        })
        expect(state.inventory.every((item) => !equipmentDefinitionById(item.definitionId)?.setName)).toBe(true)
      }
    }

    const seenSetIds = new Set<string>()
    for (let seed = 1; seed <= 200; seed += 1) {
      const state = createInitialStateV10()
      grantKillLoot(state, {
        worldId: 'world_01', difficulty: 1, stage: 1, rank: 'boss', seed, enemyId: 'boss',
      })
      const setIdsInThisKill: string[] = []
      for (const item of state.inventory) {
        const definition = equipmentDefinitionById(item.definitionId)!
        if (definition.setName === '鬼谋') {
          seenSetIds.add(definition.id)
          setIdsInThisKill.push(definition.id)
          expect(item.quality).toBe(5)
          expect(item.level).toBe(14)
          expect(item.affixes).toHaveLength(3)
        } else {
          expect(item.level).toBe(rollEquipmentLevel('world_01', 1, 1, item.quality))
        }
      }
      expect(new Set(setIdsInThisKill).size).toBe(setIdsInThisKill.length)
    }
    expect([...seenSetIds].sort()).toEqual(['wp_386', 'wp_387'])
  })

  it('同 seed 掉落完全一致', () => {
    const left = createInitialStateV10()
    const right = createInitialStateV10()
    const input = { worldId: 'world_01' as const, difficulty: 2, stage: 4, rank: 'boss' as const, seed: 99, enemyId: 'boss' }
    expect(grantKillLoot(left, input)).toEqual(grantKillLoot(right, input))
    expect(left.inventory).toEqual(right.inventory)
  })

  it('normal/elite/boss 使用原版品级 1/2/4 的品质权重并叠加位面品质 1', () => {
    expect(pickWeightedQuality('normal', 0)).toBe(1)
    expect(pickWeightedQuality('normal', 0.7)).toBe(2)
    expect(pickWeightedQuality('normal', 0.95)).toBe(3)
    expect(pickWeightedQuality('elite', 0.2)).toBe(2)
    expect(pickWeightedQuality('elite', 0.7)).toBe(3)
    expect(pickWeightedQuality('elite', 0.95)).toBe(4)
    expect(pickWeightedQuality('boss', 0)).toBe(2)
    expect(pickWeightedQuality('boss', 0.1)).toBe(3)
    expect(pickWeightedQuality('boss', 0.7)).toBe(4)
  })

  it('背包满时跳过掉落并记入错过件数', () => {
    const state = createInitialStateV10()
    state.inventory = Array.from({ length: INVENTORY_CAPACITY }, (_, index) => ({
      uid: `full_${index}`,
      definitionId: 'wp_101',
      level: 1,
      quality: 0 as const,
      coreStats: [{ attributeId: 8, coefficient: 180 }, { attributeId: 6, coefficient: 80 }],
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
