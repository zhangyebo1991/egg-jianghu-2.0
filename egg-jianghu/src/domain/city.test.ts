import { describe, expect, it } from 'vitest'
import { ORIGINAL_CITY_CONSTANTS } from '../content/original-city.generated'
import { equipmentDefinitionById, equipmentIdBySlot } from '../content/equipment'
import {
  cityBaseMonthlyRent,
  cityDevelopment,
  cityEffectiveGrid,
  cityFinanceNetIncome,
  cityOwnedLandValue,
  cityTileById,
  cityTilePrice,
  cityTotals,
  recordCityFinance,
  registerCityCompany,
  renameCityCompany,
  settleCityFinance,
  learnCityMartial,
  spend,
} from './city'
import { equipEquipment, toggleEquipmentLock } from './inventory'
import { upgradeMartial } from './martial-training'
import { recruitFromFaction } from './recruitment'
import { createHeroProgress, createInitialStateV10 } from './state'
import type { EquipmentInstance, GameStateV10 } from './types'

const stateWithHero = (): GameStateV10 => {
  const state = createInitialStateV10(0)
  state.heroes.hero_mu_nianci = createHeroProgress('sword')
  return state
}

const unlockedThrough = (worldIndex: number): GameStateV10 => {
  const state = stateWithHero()
  state.unlockedWorldIds = Array.from({ length: worldIndex }, (_, index) => `world_${String(index + 1).padStart(2, '0')}`)
  for (const worldId of state.unlockedWorldIds) state.worldCurrency[worldId] = 10_000
  return state
}

const equipment = (uid: string, definitionId: string, locked = false): EquipmentInstance => {
  const definition = equipmentDefinitionById(definitionId)!
  return {
    uid,
    definitionId,
    level: 1,
    quality: 0,
    coreStats: definition.coreStats.map((core) => ({
      attributeId: core.attributeId,
      coefficient: core.baseCoefficient,
    })),
    affixes: [],
    locked,
  }
}

describe('原版城市与公司核心 Domain', () => {
  it('新档从原版 324 地块、古玩店资产和零现金开始', () => {
    const state = createInitialStateV10(1000)
    expect(state.city.level).toBe(0)
    expect(state.city.tiles).toHaveLength(324)
    expect(state.city.tiles.filter((tile) => tile.owned)).toEqual([
      expect.objectContaining({ tileId: 172, buildingId: 15, buildingLevel: 1 }),
    ])
    expect(state.city.company.cash).toBe(0)
    expect(state.city.company.name).toBeNull()
  })

  it('按有效城区汇总属性、发展度和地块价格', () => {
    const state = createInitialStateV10(1000)
    expect(cityEffectiveGrid(state)).toEqual({ columns: 12, rows: 12 })
    expect(cityTotals(state)).toEqual({ population: 74_000, commerce: 117_350, industry: 56_400 })
    expect(cityDevelopment(state)).toBe(4_129)
    const antiqueShop = cityTileById(state, 172)!
    expect(cityTilePrice(state, antiqueShop, 'buy')).toBe(7_708_812)
    expect(cityTilePrice(state, antiqueShop, 'sell')).toBe(4_685_287)
    expect(cityOwnedLandValue(state)).toBe(7_708_812)
    expect(cityBaseMonthlyRent(state)).toBe(0)
  })

  it('公司名称规则未解码时拒绝注册，不消耗现金', () => {
    const state = createInitialStateV10(1000)
    state.city.company.cash = ORIGINAL_CITY_CONSTANTS.companyRegistrationCost

    expect(registerCityCompany(state, '试剑商会')).toEqual({
      ok: false,
      message: '原版创建宗门判断的字符与长度规则尚未解码',
    })
    expect(state.city.company.cash).toBe(100_000)
    expect(state.city.company.name).toBeNull()
  })

  it('显式通过原版名称校验后按固定费用注册和更名', () => {
    const state = createInitialStateV10(1000)
    state.city.company.cash = 250_000

    expect(registerCityCompany(state, '试剑商会', true)).toEqual({ ok: true, message: '公司成立' })
    expect(state.city.company.name).toBe('试剑商会')
    expect(state.city.company.cash).toBe(150_000)
    expect(renameCityCompany(state, '问剑公司', true)).toEqual({ ok: true, message: '公司已更名' })
    expect(state.city.company.name).toBe('问剑公司')
    expect(state.city.company.cash).toBe(50_000)
    expect(state.city.company.currentFinance.其他支出).toBe(200_000)
  })

  it('按原版七类收支结算并清空本期累计', () => {
    const state = createInitialStateV10(1000)
    state.city.company.name = '试剑商会'
    recordCityFinance(state, '销售收入', 120_000)
    recordCityFinance(state, '租金收入', 10_000)
    recordCityFinance(state, '科研支出', 30_000)
    recordCityFinance(state, '其他支出', 5_000)

    expect(cityFinanceNetIncome(state.city.company.currentFinance)).toBe(95_000)
    expect(settleCityFinance(state)).toEqual({ ok: true, message: '本期财务已结算' })
    expect(state.city.company.previousNetIncome).toBe(95_000)
    expect(state.city.company.previousFinance.销售收入).toBe(120_000)
    expect(Object.values(state.city.company.currentFinance).every((amount) => amount === 0)).toBe(true)
  })
})

describe('城市、势力与装备操作', () => {
  it('不再混入虚构城市通用武功', () => {
    const state = unlockedThrough(3)
    state.worldCurrency.world_03 = 600
    const before = structuredClone(state)

    const result = learnCityMartial(state, 'hero_mu_nianci', 'world_03_common_sword_01')

    expect(result.ok).toBe(false)
    expect(state).toEqual(before)
  })

  it('势力侠客消耗贡献直接邀请', () => {
    const state = createInitialStateV10(0)
    state.contribution.qingfeng_hall = 800

    expect(recruitFromFaction(state, 'qingfeng_hall', 'hero_qingfeng_hall_01').ok).toBe(true)
    expect(state.contribution.qingfeng_hall).toBe(0)
    expect(state.heroes.hero_qingfeng_hall_01.recruited).toBe(true)
  })

  it('失败交易不会留下部分扣款或升级', () => {
    const state = stateWithHero()
    state.heroes.hero_mu_nianci.skillPoints = 1_000_000
    state.worldCurrency.world_01 = 0
    state.heroes.hero_mu_nianci.learnedMartials.original_skill_42 = {
      level: 1,
      investedSp: 451,
      invested: { worldCurrency: { world_01: 1_069 }, contribution: {} },
    }
    const before = structuredClone(state)

    expect(upgradeMartial(state, 'hero_mu_nianci', 'original_skill_42').ok).toBe(false)
    expect(state).toEqual(before)
    expect(spend(state.worldCurrency, 'world_01', 1_000_000).ok).toBe(false)
  })

  it('装备校验部位和占用关系，锁定不禁止穿戴', () => {
    const state = stateWithHero()
    state.heroes.hero_yang_tiexin = createHeroProgress('blade')
    state.inventory.push(equipment('weapon_uid', equipmentIdBySlot('weapon'), true))

    expect(equipEquipment(state, 'hero_mu_nianci', 'weapon_uid').ok).toBe(true)
    expect(state.heroes.hero_mu_nianci.equipmentBySlot.weapon).toBe('weapon_uid')
    expect(equipEquipment(state, 'hero_yang_tiexin', 'weapon_uid').ok).toBe(false)
    expect(toggleEquipmentLock(state, 'weapon_uid').ok).toBe(true)
    expect(state.inventory[0].locked).toBe(false)
  })
})
