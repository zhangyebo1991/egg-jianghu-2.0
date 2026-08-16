import { describe, expect, it } from 'vitest'
import { FACTIONS } from './factions'
import {
  ORIGINAL_CITY_FOUNDATION,
  ORIGINAL_TOWN_COUNTS,
  ORIGINAL_WORLD_TOWNS,
  originalWorldTownByIndex,
} from './original-towns.generated'

describe('原版位面城镇快照', () => {
  it('完整包含 13 主城、65 公共场所与 29 势力城镇', () => {
    expect(ORIGINAL_TOWN_COUNTS).toEqual({ worlds: 13, publicLocations: 65, factionTowns: 29 })
    expect(ORIGINAL_WORLD_TOWNS).toHaveLength(13)
    expect(ORIGINAL_WORLD_TOWNS.flatMap((world) => world.publicLocations)).toHaveLength(65)
    expect(ORIGINAL_WORLD_TOWNS.flatMap((world) => world.factionTowns)).toHaveLength(29)
    expect(ORIGINAL_WORLD_TOWNS.every((world) => world.publicLocations.length === 5)).toBe(true)
  })

  it('每个主城具有唯一招募场所，正式势力与势力城镇一一对应', () => {
    for (const world of ORIGINAL_WORLD_TOWNS) {
      expect(world.publicLocations.filter((location) =>
        location.functions.some((fn) => fn.sourceId === 5))).toHaveLength(1)
    }

    const townFactionIds = ORIGINAL_WORLD_TOWNS
      .flatMap((world) => world.factionTowns)
      .map((town) => town.factionSourceId)
      .sort((a, b) => a - b)
    const formalFactionIds = FACTIONS
      .filter((faction) => faction.currencyKind === 'contribution')
      .map((faction) => faction.originalId)
      .sort((a, b) => a - b)
    expect(townFactionIds).toEqual(formalFactionIds)
  })

  it('保留首卷原版名称、功能与现世城市基础规模', () => {
    const first = originalWorldTownByIndex(1)
    expect(first?.mainCity.name).toBe('洛阳')
    expect(first?.publicLocations.map((location) => location.name)).toEqual(['府衙', '商会', '酒馆', '武馆', '铁匠铺'])
    expect(first?.factionTowns.map((town) => town.name)).toEqual(['许昌', '成都', '建业'])
    expect(first?.factionTowns[0].functions.map((fn) => fn.name)).toEqual(['阵营任务', '学习技能', '贡献兑换', '势力招募'])
    expect(ORIGINAL_CITY_FOUNDATION).toEqual({ gridColumns: 18, gridRows: 18, buildings: 25, technologies: 75 })
  })
})
