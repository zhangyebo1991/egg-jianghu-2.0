import { describe, expect, it } from 'vitest'
import {
  addEquipment,
  backpackEquipment,
  discardEquipmentByQuality,
  equipEquipment,
  INVENTORY_CAPACITY,
  organizeInventory,
  unequipEquipment,
} from './inventory'
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

  it('穿戴后移出物品栏，卸下后重新进入物品栏', () => {
    const state = createNewGameStateV10('测试')
    state.inventory = [equipment('weapon')]

    expect(equipEquipment(state, 'hero_player', 'weapon')).toEqual({ ok: true, message: '装备成功' })
    expect(backpackEquipment(state)).toEqual([])

    expect(unequipEquipment(state, 'hero_player', 'weapon')).toEqual({ ok: true, message: '已卸下装备' })
    expect(backpackEquipment(state).map((item) => item.uid)).toEqual(['weapon'])
  })

  it('已穿戴装备不占用物品栏容量', () => {
    const state = createNewGameStateV10('测试')
    state.inventory = [
      equipment('worn'),
      ...Array.from({ length: INVENTORY_CAPACITY - 1 }, (_, index) => equipment(`loose_${index}`)),
    ]
    state.heroes.hero_player.equipmentBySlot.weapon = 'worn'

    expect(addEquipment(state, equipment('last-slot'))).toEqual({ ok: true })
    expect(backpackEquipment(state)).toHaveLength(INVENTORY_CAPACITY)
    expect(state.inventory).toHaveLength(INVENTORY_CAPACITY + 1)
  })

  it('物品栏已满时禁止卸下且保持当前穿戴', () => {
    const state = createNewGameStateV10('测试')
    state.inventory = [
      equipment('worn'),
      ...Array.from({ length: INVENTORY_CAPACITY }, (_, index) => equipment(`loose_${index}`)),
    ]
    state.heroes.hero_player.equipmentBySlot.weapon = 'worn'

    expect(unequipEquipment(state, 'hero_player', 'weapon'))
      .toEqual({ ok: false, message: '物品栏已满，无法卸下装备' })
    expect(state.heroes.hero_player.equipmentBySlot.weapon).toBe('worn')
    expect(backpackEquipment(state)).toHaveLength(INVENTORY_CAPACITY)
  })

  it('物品栏已满时仍可原子替换同部位装备', () => {
    const state = createNewGameStateV10('测试')
    state.inventory = [
      equipment('worn'),
      equipment('replacement'),
      ...Array.from({ length: INVENTORY_CAPACITY - 1 }, (_, index) => equipment(`loose_${index}`)),
    ]
    state.heroes.hero_player.equipmentBySlot.weapon = 'worn'

    expect(equipEquipment(state, 'hero_player', 'replacement')).toEqual({ ok: true, message: '装备成功' })
    expect(state.heroes.hero_player.equipmentBySlot.weapon).toBe('replacement')
    expect(backpackEquipment(state)).toHaveLength(INVENTORY_CAPACITY)
    expect(backpackEquipment(state).map((item) => item.uid)).toContain('worn')
    expect(backpackEquipment(state).map((item) => item.uid)).not.toContain('replacement')
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
