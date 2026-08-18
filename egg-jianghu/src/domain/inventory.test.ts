import { describe, expect, it } from 'vitest'
import {
  addEquipment,
  backpackEquipment,
  discardEquipment,
  discardEquipmentByQuality,
  equipEquipment,
  INVENTORY_CAPACITY,
  organizeInventory,
  switchEquipmentSet,
  unequipEquipment,
} from './inventory'
import { equipmentDefinitionById, equipmentIdBySlot, equipmentWearLevel } from '../content/equipment'
import { createHeroProgress, createInitialStateV10, createNewGameStateV10 } from './state'
import type { EquipmentInstance, EquipmentQuality, GameStateV10 } from './types'

const equipment = (uid: string, quality: EquipmentQuality = 0): EquipmentInstance => {
  const definitionId = equipmentIdBySlot('weapon')
  const definition = equipmentDefinitionById(definitionId)!
  return {
    uid,
    definitionId,
    level: 1,
    equipmentLevel: equipmentWearLevel(1, quality),
    quality,
    coreStats: definition.coreStats.map((core) => ({ attributeId: core.attributeId, coefficient: core.baseCoefficient })),
    affixes: [],
    locked: false,
  }
}

// 穿戴等级门槛由 equipmentWearLevel 独立计算；只验证部位与占用规则的用例把侠客等级抬到门槛之上。
const liftHeroLevels = (state: GameStateV10): void => {
  for (const hero of Object.values(state.heroes)) hero.level = 50
}

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
    liftHeroLevels(state)
    state.inventory = [equipment('weapon')]

    expect(equipEquipment(state, 'hero_player', 'weapon')).toEqual({ ok: true, message: '装备成功' })
    expect(backpackEquipment(state)).toEqual([])

    expect(unequipEquipment(state, 'hero_player', 'weapon')).toEqual({ ok: true, message: '已卸下装备' })
    expect(backpackEquipment(state).map((item) => item.uid)).toEqual(['weapon'])
  })

  it('人物等级低于穿戴等级时不能穿戴', () => {
    const state = createNewGameStateV10('测试')
    // 品质 0 物品等级 10 → 穿戴等级 10-(0-1)*2 = 12
    state.inventory = [{ ...equipment('high'), level: 10, equipmentLevel: equipmentWearLevel(10, 0) }]

    expect(equipEquipment(state, 'hero_player', 'high')).toEqual({
      ok: false,
      message: '人物等级不足，需达到穿戴等级 Lv.12',
    })
    expect(state.heroes.hero_player.equipmentBySlot.weapon).toBeUndefined()
  })

  it('人物等级达到穿戴等级即可穿戴，与物品等级无关', () => {
    const state = createNewGameStateV10('测试')
    // 品质 5 物品等级 20 → 穿戴等级 20-(5-1)*2 = 12；人物 Lv.12 已足够
    state.inventory = [{ ...equipment('rare'), level: 20, quality: 5, equipmentLevel: equipmentWearLevel(20, 5) }]
    state.heroes.hero_player.level = 12

    expect(equipEquipment(state, 'hero_player', 'rare')).toEqual({ ok: true, message: '装备成功' })
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
    liftHeroLevels(state)
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
      { ...equipment('head'), definitionId: equipmentIdBySlot('head'), quality: 9, level: 20 },
      { ...equipment('weapon_low'), quality: 1, level: 8 },
      { ...equipment('weapon_high'), quality: 2, level: 3 },
    ]

    expect(organizeInventory(state).ok).toBe(true)
    expect(state.inventory.map((item) => item.uid)).toEqual(['weapon_high', 'weapon_low', 'head'])
  })

  describe('单件丢弃', () => {
    it('真实删除未锁定且未穿戴的装备', () => {
      const state = createInitialStateV10()
      state.inventory = [equipment('keep'), equipment('drop')]

      expect(discardEquipment(state, 'drop')).toEqual({ ok: true, message: '已丢弃 勇士的长戟' })
      expect(state.inventory.map((item) => item.uid)).toEqual(['keep'])
    })

    it('保护锁定和已穿戴装备', () => {
      const state = createNewGameStateV10('测试')
      state.inventory = [
        { ...equipment('locked'), locked: true },
        equipment('worn'),
      ]
      state.heroes.hero_player.equipmentBySlot.weapon = 'worn'

      expect(discardEquipment(state, 'locked')).toEqual({ ok: false, message: '此物已上锁，先解锁再丢弃' })
      expect(discardEquipment(state, 'worn')).toEqual({ ok: false, message: '已穿戴装备请先到侠客页卸下' })
      expect(state.inventory).toHaveLength(2)
    })
  })

  describe('按稀有度批量丢弃', () => {
    it('丢弃低于等于阈值的装备并保留更高品质', () => {
      const state = createInitialStateV10()
      state.inventory = [
        equipment('a', 0),
        equipment('b', 1),
        equipment('c', 2),
        equipment('d', 3),
      ]

      const result = discardEquipmentByQuality(state, 1)

      expect(result).toEqual({ ok: true, message: '已丢弃 2 件品质 1 及以下装备' })
      expect(state.inventory.map((item) => item.uid)).toEqual(['c', 'd'])
    })

    it('跳过已锁定装备', () => {
      const state = createInitialStateV10()
      state.inventory = [
        { ...equipment('locked', 0), locked: true },
        { ...equipment('free', 0) },
      ]

      discardEquipmentByQuality(state, 0)

      expect(state.inventory.map((item) => item.uid)).toEqual(['locked'])
    })

    it('跳过已被侠客穿戴的装备', () => {
      const state = createNewGameStateV10('测试')
      state.inventory = [
        { ...equipment('worn', 0) },
        { ...equipment('loose', 0) },
      ]
      state.heroes.hero_player.equipmentBySlot.weapon = 'worn'

      discardEquipmentByQuality(state, 0)

      expect(state.inventory.map((item) => item.uid)).toEqual(['worn'])
    })

    it('无可丢弃装备时返回失败提示且不改变库存', () => {
      const state = createInitialStateV10()
      state.inventory = [
        { ...equipment('locked', 0), locked: true },
        equipment('high', 3),
      ]

      const result = discardEquipmentByQuality(state, 1)

      expect(result).toEqual({ ok: false, message: '没有可丢弃的装备' })
      expect(state.inventory.map((item) => item.uid)).toEqual(['locked', 'high'])
    })

    it('阈值品质 9 清空全部未锁定未穿戴装备', () => {
      const state = createInitialStateV10()
      state.inventory = Array.from({ length: 10 }, (_, quality) =>
        equipment(`e${quality}`, quality as EquipmentQuality))

      const result = discardEquipmentByQuality(state, 9)

      expect(result.ok).toBe(true)
      expect(state.inventory).toHaveLength(0)
    })
  })

  describe('三套装备预设', () => {
    it('每位侠客可独立保存三套并切换当前生效套', () => {
      const state = createNewGameStateV10('测试')
      liftHeroLevels(state)
      state.inventory = [
        equipment('weapon-a'),
        { ...equipment('weapon-b'), uid: 'weapon-b', definitionId: equipmentIdBySlot('weapon', '江湖') },
        { ...equipment('head-a'), uid: 'head-a', definitionId: equipmentIdBySlot('head') },
      ]

      expect(equipEquipment(state, 'hero_player', 'weapon-a')).toEqual({ ok: true, message: '装备成功' })
      expect(switchEquipmentSet(state, 'hero_player', 1)).toEqual({ ok: true, message: '已切换至第2套装备' })
      expect(equipEquipment(state, 'hero_player', 'weapon-b')).toEqual({ ok: true, message: '装备成功' })
      expect(equipEquipment(state, 'hero_player', 'head-a')).toEqual({ ok: true, message: '装备成功' })

      expect(state.heroes.hero_player.equipmentBySlot.weapon).toBe('weapon-b')
      expect(backpackEquipment(state)).toEqual([])

      expect(switchEquipmentSet(state, 'hero_player', 0)).toEqual({ ok: true, message: '已切换至第1套装备' })
      expect(state.heroes.hero_player.equipmentBySlot.weapon).toBe('weapon-a')
      expect(state.heroes.hero_player.equipmentBySlot.head).toBeUndefined()
      expect(state.heroes.hero_player.equipmentSets[1].weapon).toBe('weapon-b')
      expect(state.heroes.hero_player.equipmentSets[1].head).toBe('head-a')
    })

    it('非当前套占用的装备仍视为已穿戴，不可丢弃也不可给其他侠客', () => {
      const state = createNewGameStateV10('测试')
      state.heroes.hero_other = createHeroProgress('blade')
      liftHeroLevels(state)
      state.inventory = [equipment('weapon-a')]
      expect(equipEquipment(state, 'hero_player', 'weapon-a').ok).toBe(true)
      expect(switchEquipmentSet(state, 'hero_player', 1).ok).toBe(true)

      expect(backpackEquipment(state)).toEqual([])
      expect(discardEquipment(state, 'weapon-a')).toEqual({ ok: false, message: '已穿戴装备请先到侠客页卸下' })
      expect(equipEquipment(state, 'hero_other', 'weapon-a')).toEqual({ ok: false, message: '装备已被其他侠客穿戴' })
    })

    it('同一侠客可把其他套中的装备改穿到当前套', () => {
      const state = createNewGameStateV10('测试')
      liftHeroLevels(state)
      state.inventory = [equipment('weapon-a')]
      expect(equipEquipment(state, 'hero_player', 'weapon-a').ok).toBe(true)
      expect(switchEquipmentSet(state, 'hero_player', 2).ok).toBe(true)
      expect(equipEquipment(state, 'hero_player', 'weapon-a')).toEqual({ ok: true, message: '装备成功' })
      expect(state.heroes.hero_player.equipmentSets[0].weapon).toBeNull()
      expect(state.heroes.hero_player.equipmentBySlot.weapon).toBe('weapon-a')
    })
  })
})
