import { describe, expect, it } from 'vitest'
import {
  ORIGINAL_CITY_BUILDINGS,
  ORIGINAL_CITY_CONSTANTS,
  ORIGINAL_CITY_INITIAL_TECHNOLOGY_LEVELS,
  ORIGINAL_CITY_INITIAL_TILES,
  ORIGINAL_CITY_PENDING_RULES,
  ORIGINAL_CITY_TECHNOLOGIES,
  originalCityAccumulatedBuildingValue,
  originalCityBuildingAttribute,
  originalCityBuildingCashCost,
  originalCityBuildingInfluenceRange,
  originalCityDevelopment,
  originalCityEffectiveGrid,
  originalCityLandPrice,
  originalCityMonthlyRent,
  originalCityRecalculateTileAttributes,
  originalCityTechnologyById,
  originalCityTechnologyCalculatedLevel,
  originalCityTechnologyCashCost,
  originalCityTechnologyEffectBonus,
  originalCityTechnologyResearchPoints,
  originalCityTotals,
  originalCityUpgradeAttribute,
} from './original-city.generated'

describe('原版现世城市核心快照', () => {
  it('完整保留 25 类建筑与 324 块初始地块', () => {
    expect(ORIGINAL_CITY_BUILDINGS).toHaveLength(25)
    expect(ORIGINAL_CITY_INITIAL_TILES).toHaveLength(324)
    expect(ORIGINAL_CITY_INITIAL_TILES.map((tile) => tile.tileId)).toEqual(
      Array.from({ length: 324 }, (_, index) => index + 1),
    )
    expect(new Set(ORIGINAL_CITY_INITIAL_TILES.map((tile) => `${tile.gridX}:${tile.gridY}`)).size).toBe(324)
  })

  it('仅古玩店初始归玩家所有，空地和树木等级归零', () => {
    const owned = ORIGINAL_CITY_INITIAL_TILES.filter((tile) => tile.owned)
    expect(owned).toEqual([expect.objectContaining({
      tileId: 172,
      buildingId: 15,
      buildingLevel: 1,
      gridX: 9,
      gridY: 9,
    })])
    expect(ORIGINAL_CITY_INITIAL_TILES.every((tile) => !tile.buildable || tile.buildingLevel === 0)).toBe(true)
    expect(ORIGINAL_CITY_CONSTANTS.initialCash).toBe(0)
    expect(ORIGINAL_CITY_CONSTANTS.headquartersBuildingId).toBe(16)
  })

  it('完整保留 75 项科技及原版新档的三项初始科技', () => {
    expect(ORIGINAL_CITY_TECHNOLOGIES).toHaveLength(75)
    expect(ORIGINAL_CITY_TECHNOLOGIES.filter((technology) => technology.category === '基础')).toHaveLength(60)
    expect(ORIGINAL_CITY_TECHNOLOGIES.filter((technology) => technology.category === '位面')).toHaveLength(15)
    expect(ORIGINAL_CITY_INITIAL_TECHNOLOGY_LEVELS).toEqual({ 1: 1, 2: 1, 3: 1 })
    expect(originalCityTechnologyById(13)).toEqual(expect.objectContaining({
      name: '强化科技树',
      prerequisiteTechnologyIds: [57],
    }))
  })

  it('按原版公式复算科技研发点、现金和效果参数', () => {
    expect(originalCityTechnologyCalculatedLevel(1, 1)).toBe(2)
    expect(originalCityTechnologyResearchPoints(1, 1)).toBe(2_220)
    expect(originalCityTechnologyCashCost(1, 1)).toBe(55_000)
    expect(originalCityTechnologyCashCost(1, 1, 0, 0.8)).toBe(44_000)
    expect(originalCityTechnologyEffectBonus(4, 10)).toBe(0.5)
    expect(originalCityTechnologyResearchPoints(999, 1)).toBe(0)
  })

  it('复算发展度、建筑属性、建造成本和城市有效尺寸', () => {
    expect(originalCityDevelopment(600, 300, 300)).toBe(20)
    expect(originalCityBuildingAttribute(15, 1, 'commerce')).toBe(50)
    expect(originalCityBuildingInfluenceRange(15, 1)).toBe(2)
    expect(originalCityBuildingCashCost(15, 0)).toBe(300_000)
    expect(originalCityBuildingCashCost(15, 1)).toBe(2_400_000)
    expect(originalCityAccumulatedBuildingValue(15, 2)).toBe(1_350_000)
    expect(originalCityEffectiveGrid(0)).toEqual({ columns: 12, rows: 12 })
    expect(originalCityEffectiveGrid(1)).toEqual({ columns: 13, rows: 12 })
    expect(originalCityEffectiveGrid(2)).toEqual({ columns: 13, rows: 13 })
    expect(originalCityEffectiveGrid(12)).toEqual({ columns: 18, rows: 18 })
    expect(originalCityUpgradeAttribute(2)).toBe(450_000)
    expect(originalCityRecalculateTileAttributes(ORIGINAL_CITY_INITIAL_TILES)).toEqual(ORIGINAL_CITY_INITIAL_TILES)
    const totals = originalCityTotals(ORIGINAL_CITY_INITIAL_TILES, 0)
    expect(totals).toEqual({ population: 74_000, commerce: 117_350, industry: 56_400 })
    expect(originalCityDevelopment(totals.population, totals.commerce, totals.industry)).toBe(4_129)
  })

  it('复算土地买卖价格与基础区月租', () => {
    const purchasePrice = originalCityLandPrice({
      development: 20,
      population: 0,
      commerce: 0,
      industry: 0,
      landPriceTier: 2,
      buildingId: 15,
      buildingLevel: 1,
      mode: 'buy',
    })
    expect(purchasePrice).toBe(4_166_000)
    expect(originalCityMonthlyRent(1, purchasePrice)).toBe(10_415)
    expect(originalCityMonthlyRent(15, purchasePrice)).toBe(0)
  })

  it('未解码规则只作为阻塞说明，不生成近似值', () => {
    expect(ORIGINAL_CITY_PENDING_RULES.companyNameValidation).toContain('尚未解码')
    expect(ORIGINAL_CITY_PENDING_RULES.specialTile48Unlock).toContain('尚未解码')
    expect(ORIGINAL_CITY_PENDING_RULES.companyPositionBonuses).toContain('尚未接入')
  })
})
