import { describe, expect, it } from 'vitest'
import { addEquipment, discardEquipmentByQuality, INVENTORY_CAPACITY, organizeInventory } from './inventory'
import { createInitialStateV10, createNewGameStateV10 } from './state'
import type { EquipmentInstance, EquipmentQuality } from './types'

const equipment = (uid: string, quality: EquipmentQuality = '凡品'): EquipmentInstance => ({
  uid,
  definitionId: 'world_01_weapon',
  level: 1,
  quality,
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

  describe('按稀有度批量丢弃', () => {
    it('丢弃低于等于阈值的装备并保留更高品质', () => {
      const state = createInitialStateV10()
      state.inventory = [
        equipment('a', '凡品'),
        equipment('b', '良品'),
        equipment('c', '上品'),
        equipment('d', '珍品'),
      ]

      const result = discardEquipmentByQuality(state, '良品')

      expect(result).toEqual({ ok: true, message: '已丢弃 2 件良品及以下装备' })
      expect(state.inventory.map((item) => item.uid)).toEqual(['c', 'd'])
    })

    it('跳过已锁定装备', () => {
      const state = createInitialStateV10()
      state.inventory = [
        { ...equipment('locked', '凡品'), locked: true },
        { ...equipment('free', '凡品') },
      ]

      discardEquipmentByQuality(state, '凡品')

      expect(state.inventory.map((item) => item.uid)).toEqual(['locked'])
    })

    it('跳过已被侠客穿戴的装备', () => {
      const state = createNewGameStateV10('测试')
      state.inventory = [
        { ...equipment('worn', '凡品') },
        { ...equipment('loose', '凡品') },
      ]
      state.heroes.hero_player.equipmentBySlot.weapon = 'worn'

      discardEquipmentByQuality(state, '凡品')

      expect(state.inventory.map((item) => item.uid)).toEqual(['worn'])
    })

    it('无可丢弃装备时返回失败提示且不改变库存', () => {
      const state = createInitialStateV10()
      state.inventory = [
        { ...equipment('locked', '凡品'), locked: true },
        equipment('high', '珍品'),
      ]

      const result = discardEquipmentByQuality(state, '良品')

      expect(result).toEqual({ ok: false, message: '没有可丢弃的装备' })
      expect(state.inventory.map((item) => item.uid)).toEqual(['locked', 'high'])
    })

    it('阈值绝品清空全部未锁定未穿戴装备', () => {
      const state = createInitialStateV10()
      state.inventory = ['凡品', '良品', '上品', '珍品', '绝品'].map((quality, index) =>
        equipment(`e${index}`, quality as EquipmentQuality))

      const result = discardEquipmentByQuality(state, '绝品')

      expect(result.ok).toBe(true)
      expect(state.inventory).toHaveLength(0)
    })
  })
})
