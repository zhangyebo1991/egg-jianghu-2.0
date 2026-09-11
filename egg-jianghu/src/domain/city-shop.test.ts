import { describe, expect, it } from 'vitest'
import { createRng } from '../combat/rng'
import { equipmentDefinitionById } from '../content/equipment'
import { GameSession } from '../app/game-session'
import { createHeroProgress, createNewGameStateV10 } from './state'
import { hydrateStateV10, SAVE_KEY_V10 } from './save-v10'
import { addEquipment, equipEquipment, INVENTORY_CAPACITY } from './inventory'
import { placeFormation } from './formation'
import { appointFactionAgent } from './faction-agent'
import { advanceCityIntro, advanceCityShop, appointCityShopWorker, cityShopSalePrice, cityShopProgressPerSecond, stockCityShop, toggleCityShop, unstockCityShop } from './city-shop'
import type { EquipmentInstance } from './types'

const item = (uid: string, quality: EquipmentInstance['quality'] = 0): EquipmentInstance => ({
  uid, definitionId: 'wp_101', level: 1, equipmentLevel: 1, quality, locked: false,
  coreStats: equipmentDefinitionById('wp_101')!.coreStats.map(stat => ({ attributeId: stat.attributeId, coefficient: stat.baseCoefficient })), affixes: [],
})
const ready = () => {
  const state = createNewGameStateV10('经营少侠', 1000)
  state.heroes.hero_guo_jing = createHeroProgress('fist')
  state.inventory.push(item('sale'))
  expect(stockCityShop(state, 'sale').ok).toBe(true)
  expect(appointCityShopWorker(state, 0, 'hero_guo_jing').ok).toBe(true)
  return state
}

describe('城市起步经营', () => {
  it('上架转移物品，保护所有套装穿戴、锁定与满货架，下架不复制', () => {
    const state = createNewGameStateV10('经营少侠')
    state.inventory.push(item('equipped'), { ...item('locked'), locked: true }, item('free'))
    expect(equipEquipment(state, 'hero_player', 'equipped').ok).toBe(true)
    expect(stockCityShop(state, 'equipped').ok).toBe(false)
    expect(stockCityShop(state, 'locked').ok).toBe(false)
    expect(stockCityShop(state, 'free').ok).toBe(true)
    expect(stockCityShop(state, 'free').ok).toBe(false)
    expect(state.inventory.map(item => item.uid)).not.toContain('free')
    expect(() => addEquipment(state, item('free'))).toThrow('重复装备 uid')
    expect(unstockCityShop(state, 'free').ok).toBe(true)
    expect(unstockCityShop(state, 'free').ok).toBe(false)
    state.city.shop.stock = Array.from({ length: 20 }, (_, i) => item(`s${i}`))
    expect(stockCityShop(state, 'free').ok).toBe(false)
  })

  it('行囊满时拒绝取回，货物原样保留', () => {
    const state = ready()
    state.inventory = Array.from({ length: INVENTORY_CAPACITY }, (_, i) => item(`full${i}`))
    expect(unstockCityShop(state, 'sale').ok).toBe(false)
    expect(state.city.shop.stock[0].uid).toBe('sale')
  })

  it('多店员批量营业与逐秒执行一致，每件商品仅售出一次', () => {
    const state = ready()
    state.heroes.hero_mu_nianci = createHeroProgress('sword')
    appointCityShopWorker(state, 1, 'hero_mu_nianci')
    state.city.shop.stock = Array.from({ length: 20 }, (_, i) => item(`stock${i}`, i % 2 ? 1 : 0))
    const expectedRevenue = state.city.shop.stock.reduce((sum, item) => sum + cityShopSalePrice(state, item), 0)
    const split = structuredClone(state)
    const rng = createRng(11)
    for (let i = 0; i < 1800; i++) advanceCityShop(split, 1000, rng)
    advanceCityShop(state, 1_800_000, createRng(11))
    expect(state.city.shop).toEqual(split.city.shop)
    expect(state.city.shop.soldCount).toBe(20)
    expect(state.city.shop.receipts).toHaveLength(10)
    expect(state.city.company.cash).toBe(expectedRevenue)
    expect(state.city.shop.experience).toBe(40)
  })

  it('两个初始店员席位，任职与阵容、代理人双向互斥', () => {
    const state = ready()
    expect(appointCityShopWorker(state, 2, 'hero_player').ok).toBe(false)
    expect(appointCityShopWorker(state, 1, 'hero_player').ok).toBe(false)
    expect(appointCityShopWorker(state, 1, 'hero_guo_jing').ok).toBe(false)
    expect(placeFormation(state, 'hero_guo_jing', 0, 0).ok).toBe(false)
    expect(appointFactionAgent(state, 'world_01', 'hero_guo_jing').ok).toBe(false)
    expect(appointCityShopWorker(state, 0, null).ok).toBe(true)
    expect(placeFormation(state, 'hero_guo_jing', 0, 0).ok).toBe(true)
  })

  it('低级普通装备按现世价格售出，现金和销售账同时入账，铜钱不变', () => {
    const state = ready()
    expect(cityShopSalePrice(state, item('preview'))).toBe(1782)
    expect(cityShopProgressPerSecond(state, 'hero_guo_jing')).toBeCloseTo(Math.log10(3) * 20)
    const copper = structuredClone(state.worldCurrency)
    advanceCityShop(state, 120_000, createRng(1))
    expect(state.city.shop.stock).toHaveLength(0)
    expect(state.city.company.cash).toBe(1782)
    expect(state.city.company.currentFinance.销售收入).toBe(1782)
    expect(state.city.shop.revenue).toBe(1782)
    expect(state.city.shop.soldCount).toBe(1)
    expect(state.city.shop.receipts[0]).toMatchObject({ sequence: 1, amount: 1782 })
    expect(state.worldCurrency).toEqual(copper)
    advanceCityShop(state, 86_400_000, createRng(1))
    expect(state.city.company.cash).toBe(1782)
  })

  it('拆分时长与整段推进一致，重载不补离线收益，剩余进度继续', () => {
    const one = ready()
    const split = structuredClone(one)
    const rng = createRng(9)
    for (let i = 0; i < 307; i++) advanceCityShop(split, 100, rng)
    advanceCityShop(one, 30_700, createRng(9))
    expect(split.city.shop).toEqual(one.city.shop)
    const loaded = hydrateStateV10(JSON.parse(JSON.stringify(split)), 9_000_000)
    expect(loaded.city.shop).toEqual(split.city.shop)
    advanceCityShop(loaded, 90_000, createRng(9))
    expect(loaded.city.company.cash).toBe(1782)
  })

  it('缺货、缺人、打烊均不生钱；打烊清接待但保留货物', () => {
    const state = ready()
    advanceCityShop(state, 20_000, createRng(1))
    expect(state.city.shop.staff[0].progress).toBeGreaterThan(0)
    toggleCityShop(state)
    advanceCityShop(state, 1_000_000, createRng(1))
    expect(state.city.company.cash).toBe(0)
    expect(state.city.shop.stock).toHaveLength(1)
    expect(state.city.shop.staff[0].progress).toBe(0)
    toggleCityShop(state)
    appointCityShopWorker(state, 0, null)
    advanceCityShop(state, 1_000_000, createRng(1))
    expect(state.city.company.cash).toBe(0)
  })

  it('拒绝非法时长，剧情不发钱，略过和重载保存进度', () => {
    const state = ready()
    const before = JSON.stringify(state)
    for (const ms of [NaN, Infinity, -1, 0]) expect(advanceCityShop(state, ms, createRng(1))).toBe(false)
    expect(JSON.stringify(state)).toBe(before)
    advanceCityIntro(state)
    expect(state.city.shop.introStep).toBe(1)
    advanceCityIntro(state, true)
    const loaded = hydrateStateV10(JSON.parse(JSON.stringify(state)))
    expect(loaded.city.shop.introStep).toBe(3)
    expect(loaded.city.company.cash).toBe(0)
  })

  it('存档拒绝旧版本、缺失经营状态、重复物品和负数进度', () => {
    for (const version of [17, 18]) expect(() => hydrateStateV10({ ...ready(), version })).toThrow()
    const missing = ready() as unknown as { city: { shop?: unknown } }
    delete missing.city.shop
    expect(() => hydrateStateV10(missing)).toThrow()
    const duplicate = ready()
    duplicate.inventory.push(item('sale'))
    expect(() => hydrateStateV10(duplicate)).toThrow('存档装备归属重复')
    const invalid = ready()
    invalid.city.shop.staff[0].progress = -1
    expect(() => hydrateStateV10(invalid)).toThrow()
    const equippedStock = ready()
    equippedStock.heroes.hero_player.equipmentSets[0].weapon = 'sale'
    expect(() => hydrateStateV10(equippedStock)).toThrow('货架装备不能同时穿戴')
  })

  it('无战斗时在线经营也会保存，重新进入不补发现金', () => {
    const values = new Map<string, string>([[SAVE_KEY_V10, JSON.stringify(ready())]])
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
    const session = GameSession.continue(storage, 2000)
    session.advanceRuntime(120_000)
    expect(JSON.parse(values.get(SAVE_KEY_V10)!).city.company.cash).toBe(1782)
    const continued = GameSession.continue(storage, Date.now() + 86_400_000)
    expect(continued.state.city.company.cash).toBe(1782)
    expect(continued.state.city.shop.stock).toHaveLength(0)
  })
})
