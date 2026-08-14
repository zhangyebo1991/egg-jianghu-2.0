import { describe, expect, it } from 'vitest'
import type { Rng } from '../combat/rng'
import type { EquipmentQuality } from '../domain/types'
import {
  EQUIPMENT_AFFIX_COUNTS,
  EQUIPMENT_DEFINITIONS,
  equipmentAffixGrade,
  equipmentAttributeValue,
  equipmentDefinitionById,
  equipmentCoreRollPercent,
  isAffixAllowedForSetElement,
  rollAffixes,
  rollEquipmentStats,
  type EquipmentDefinitionV10,
} from './equipment'

const expectedCoreStats: Record<string, readonly [readonly [number, number], readonly [number, number]]> = {
  'weapon:1': [[8, 180], [6, 80]],
  'weapon:2': [[8, 220], [20, 100]],
  'weapon:3': [[8, 200], [12, 100]],
  'weapon:4': [[8, 210], [37, 100]],
  'weapon:5': [[10, 220], [22, 100]],
  'weapon:6': [[10, 200], [13, 100]],
  'weapon:7': [[8, 230], [7, 100]],
  'weapon:8': [[8, 240], [10, 240]],
  'weapon:9': [[10, 180], [34, 100]],
  'weapon:10': [[10, 190], [16, 100]],
  'offhand:11': [[6, 80], [21, 100]],
  'offhand:12': [[8, 40], [13, 100]],
  'offhand:13': [[10, 40], [12, 100]],
  'offhand:14': [[8, 40], [18, 100]],
  'offhand:15': [[10, 40], [23, 100]],
  'head:16': [[9, 120], [11, 80]],
  'head:17': [[9, 100], [11, 100]],
  'head:18': [[9, 80], [11, 120]],
  'armor:16': [[6, 120], [9, 120]],
  'armor:17': [[6, 100], [9, 100]],
  'armor:18': [[6, 80], [9, 80]],
  'wrist:16': [[6, 120], [11, 80]],
  'wrist:17': [[6, 100], [11, 100]],
  'wrist:18': [[6, 80], [11, 120]],
  'boots:16': [[7, 80], [6, 120]],
  'boots:17': [[7, 120], [6, 100]],
  'boots:18': [[7, 100], [6, 80]],
  'necklace:20': [[8, 40], [19, 200]],
  'necklace:21': [[10, 40], [19, 200]],
  'ring:20': [[8, 40], [18, 200]],
  'ring:21': [[10, 40], [18, 200]],
}

const scriptedRng = (
  floats: number[],
  picks: number[] = [],
  log: string[] = [],
): Rng => ({
  nextFloat: () => {
    log.push('float')
    return floats.shift() ?? 0
  },
  nextInt: () => {
    log.push('int')
    return 0
  },
  pick: <T>(values: readonly T[]): T => {
    log.push('pick')
    const scripted = picks.shift()
    return (scripted === undefined ? values[0] : scripted) as T
  },
})

describe('原版装备随机属性', () => {
  it('所有装备类型都使用已逆向确认的双核心模板', () => {
    const actualTypes = new Set(EQUIPMENT_DEFINITIONS.map((item) => `${item.slot}:${item.weaponType}`))
    expect([...actualTypes].sort()).toEqual(Object.keys(expectedCoreStats).sort())
    for (const definition of EQUIPMENT_DEFINITIONS) {
      const key = `${definition.slot}:${definition.weaponType}`
      const expected = expectedCoreStats[key]
      expect(expected, key).toBeDefined()
      expect(definition.coreStats, definition.id).toEqual(expected.map(([attributeId, baseCoefficient]) => ({
        attributeId,
        baseCoefficient,
      })))
    }
  })

  it('核心独立在 90%–110% 掷值并显示真实百分比', () => {
    const ancientSword = equipmentDefinitionById('wp_257')!
    const result = rollEquipmentStats(ancientSword, 0, scriptedRng([0, 0.999]))
    expect(result.coreStats).toEqual([
      { attributeId: 8, coefficient: 198 },
      { attributeId: 20, coefficient: 110 },
    ])
    expect(equipmentCoreRollPercent(37.4, 40)).toBe(94)
  })

  it('十档品质严格决定附词条数量', () => {
    const definition = equipmentDefinitionById('wp_257')!
    for (let quality = 0; quality <= 9; quality += 1) {
      const rng = scriptedRng(Array(EQUIPMENT_AFFIX_COUNTS[quality]).fill(0), Array(5).fill(8))
      expect(rollAffixes(definition, quality as EquipmentQuality, rng)).toHaveLength(EQUIPMENT_AFFIX_COUNTS[quality])
    }
  })

  it('词条系数评价边界与原版一致', () => {
    expect([59.99, 60, 79.99, 80, 99.99, 100, 119.99, 120, 139.99, 140, 159.99, 160, 179.99, 180]
      .map(equipmentAffixGrade))
      .toEqual(['E', 'D', 'D', 'C', 'C', 'B', 'B', 'A', 'A', 'S', 'S', 'SS', 'SS', 'SSS'])
  })

  it('随机顺序为双核心、全部附词条系数、全部附词条类型', () => {
    const log: string[] = []
    rollEquipmentStats(equipmentDefinitionById('wp_257')!, 2, scriptedRng([0.5, 0.5, 0.5, 0.5], [8, 8], log))
    expect(log).toEqual(['float', 'float', 'float', 'float', 'pick', 'pick'])
  })

  it('保留 zbct 重复权重且同件装备允许重复词条', () => {
    const halberd = equipmentDefinitionById('wp_101')!
    expect(halberd.affixPool.filter((id) => id === 17)).toHaveLength(2)
    const result = rollAffixes(halberd, 2, scriptedRng([0, 0], [17, 17]))
    expect(result.map((affix) => affix.attributeId)).toEqual([17, 17])
  })

  it('套装元素不预过滤候选池，抽到异系元素时继续消耗 RNG 重抽', () => {
    const base = equipmentDefinitionById('wp_458')!
    const definition: EquipmentDefinitionV10 = { ...base, affixPool: [48, 44], setElement: 1 }
    const log: string[] = []
    const result = rollAffixes(definition, 1, scriptedRng([0], [48, 44], log))
    expect(result[0].attributeId).toBe(44)
    expect(log).toEqual(['float', 'pick', 'pick'])
    expect(isAffixAllowedForSetElement(45, 1)).toBe(true)
    expect(isAffixAllowedForSetElement(46, 1)).toBe(false)
    expect(isAffixAllowedForSetElement(20, 1)).toBe(true)
  })

  it('Lv.5 物攻项链按原版公式结算为物攻 12、闪避约 5.84%', () => {
    expect(equipmentAttributeValue(8, 5, 37.4, 100)).toBe(12)
    expect(equipmentAttributeValue(19, 5, 189.4, 100)).toBeCloseTo(5.84, 2)
  })
})
