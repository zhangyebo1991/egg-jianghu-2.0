import { buildAttributeMap } from '../combat/stats'
import type { Rng } from '../combat/rng'
import { equipmentDefinitionById } from '../content/equipment'
import { heroByIdV10, PLAYER_HERO_ID } from '../content/heroes'
import { originalHeroAbilityBase } from '../content/original-hero-abilities.generated'
import { originalCityTechnologyEffectBonus } from '../content/original-city.generated'
import { originalAbilityAttributeBonus, originalFinalAbilityLevel } from './faction-agent'
import { backpackEquipment, equipmentOwnerId, INVENTORY_CAPACITY } from './inventory'
import { recordCityFinance } from './city'
import type { ActionResult, EquipmentInstance, GameStateV10 } from './types'

// 原版 Event 12545 / 12555 / 12748 / 17695，完整来源见 city-startup-rules.md。
export const CITY_SHOP_CAPACITY = 20
export const CITY_SHOP_CUSTOMER_CAPACITY = 5
const SALE_PROGRESS = 1000
const TICK_MS = 1000

export const cityShopTile = (state: GameStateV10) =>
  state.city.tiles.find(tile => tile.tileId === state.city.shop.tileId && tile.owned && tile.buildingId === 15)

export const cityShopStaffCount = (state: GameStateV10): number =>
  Math.min(6, Math.max(0, (cityShopTile(state)?.buildingLevel ?? -1) + 1))

export const cityShopAbility = (state: GameStateV10, heroId: string): number => {
  const hero = state.heroes[heroId]
  if (!hero?.recruited) return 0
  return originalFinalAbilityLevel(
    originalHeroAbilityBase(heroByIdV10(heroId)?.sourceId, 7),
    hero.abilityTraining?.['7'] ?? 0,
    originalAbilityAttributeBonus(hero, state.inventory, 7),
  )
}

const technologyBonus = (state: GameStateV10, id: number): number =>
  originalCityTechnologyEffectBonus(id, state.city.technologyLevels[String(id)] ?? 0)

export const cityShopSalePrice = (state: GameStateV10, item: EquipmentInstance): number => {
  const definition = equipmentDefinitionById(item.definitionId)
  if (!definition) return 0
  // 普通装备系数 1，原版其他装备系数 1.2；现世货币比 40，售卖折率 0.4。
  const coefficient = definition.rarity === '普通' ? 1 : 1.2
  const base = Math.max(1, Math.round(coefficient * 0.4 * 40 * 10 * (10 + item.level) * 2.5 ** item.quality))
  return Math.round(base * (1 + (cityShopTile(state)?.commerce ?? 0) / 20000) * (1 + technologyBonus(state, 5)))
}

export const cityShopSalesAbility = (state: GameStateV10, heroId: string): number => {
  const hero = state.heroes[heroId]
  const definition = heroByIdV10(heroId)
  if (!hero?.recruited || !definition) return 0
  const attributes = buildAttributeMap(definition, hero, state.inventory, state.unlockedSkinIds)
  const ability = cityShopAbility(state, heroId)
  const playerAbility = cityShopAbility(state, PLAYER_HERO_ID)
  const playerBonus = playerAbility > 0 ? 1 + Math.round(4 * 1.6 ** playerAbility) / 100 : 1
  const speedBonus = (1 + (cityShopTile(state)?.industry ?? 0) / 10000) * (1 + technologyBonus(state, 4))
  return Math.round(10 * (1 + Math.min(2000, attributes[43] ?? 0) / 100 + Math.min(2500, attributes[143] ?? 0) / 100)
    * 3 * 1.6 ** ability * speedBonus * playerBonus) / 10
}

export const cityShopProgressPerSecond = (state: GameStateV10, heroId: string): number =>
  Math.max(0, Math.log10(Math.max(1, cityShopSalesAbility(state, heroId))) * 20)

export const cityShopWorkerReason = (state: GameStateV10, heroId: string, fightingIds: ReadonlySet<string> = new Set()): string | null => {
  if (!state.heroes[heroId]?.recruited || !heroByIdV10(heroId)) return '侠客尚未加入'
  if (fightingIds.has(heroId)) return '正在战斗，请先结束战斗'
  if (state.formation.some(slot => slot.heroId === heroId)) return '正在阵中，请先下阵'
  if (Object.values(state.factionAgents).some(agent => agent.heroId === heroId)) return '已担任位面代理人，请先卸任'
  if (Object.values(state.city.company.appointments).includes(heroId)) return '已有公司职位，请先卸任'
  return null
}

const resetService = (state: GameStateV10): void => {
  for (const worker of state.city.shop.staff) { worker.progress = 0; worker.serving = false }
}

export const stockCityShop = (state: GameStateV10, uid: string): ActionResult => {
  if (!cityShopTile(state)) return { ok: false, message: '尚未拥有古玩店' }
  const item = state.inventory.find(item => item.uid === uid)
  if (!item || !equipmentDefinitionById(item.definitionId)) return { ok: false, message: '装备不存在' }
  if (item.locked || equipmentOwnerId(state, uid)) return { ok: false, message: '锁定或已穿戴装备不能上架' }
  if (state.city.shop.stock.length >= CITY_SHOP_CAPACITY) return { ok: false, message: '货架已满' }
  if (state.city.shop.stock.some(item => item.uid === uid)) return { ok: false, message: '装备已经上架' }
  state.city.shop.stock.push(item)
  state.inventory.splice(state.inventory.indexOf(item), 1)
  return { ok: true, message: '已移入古玩店货架，营业时由店员出售' }
}

export const unstockCityShop = (state: GameStateV10, uid: string): ActionResult => {
  const index = state.city.shop.stock.findIndex(item => item.uid === uid)
  if (index < 0) return { ok: false, message: '商品已售出或不存在' }
  if (backpackEquipment(state).length >= INVENTORY_CAPACITY) return { ok: false, message: '行囊已满，请先腾出一格' }
  const [item] = state.city.shop.stock.splice(index, 1)
  state.inventory.push(item)
  if (!state.city.shop.stock.length) resetService(state)
  return { ok: true, message: '装备已退回行囊' }
}

export const appointCityShopWorker = (state: GameStateV10, slot: number, heroId: string | null, fightingIds: ReadonlySet<string> = new Set()): ActionResult => {
  if (!cityShopTile(state) || !Number.isInteger(slot) || slot < 0 || slot >= cityShopStaffCount(state)) return { ok: false, message: '店员席位尚未开放' }
  if (heroId !== null) {
    const reason = cityShopWorkerReason(state, heroId, fightingIds)
    if (reason) return { ok: false, message: reason }
    if (state.city.shop.staff.some(worker => worker.heroId === heroId)) return { ok: false, message: '该侠客已在店中任职' }
  }
  state.city.shop.staff[slot] = { heroId, progress: 0, serving: false }
  return { ok: true, message: heroId ? '店员已到任' : '店员已卸任' }
}

export const toggleCityShop = (state: GameStateV10): ActionResult => {
  if (!cityShopTile(state)) return { ok: false, message: '尚未拥有古玩店' }
  const shop = state.city.shop
  shop.enabled = !shop.enabled
  if (!shop.enabled) { resetService(state); shop.customers = 0; shop.elapsedMs = 0 }
  return { ok: true, message: shop.enabled ? '古玩店已开门营业' : '古玩店已打烊，货架商品保留' }
}

export const advanceCityIntro = (state: GameStateV10, skip = false): ActionResult => {
  state.city.shop.introStep = skip ? 3 : Math.min(3, state.city.shop.introStep + 1)
  return { ok: true, message: '已记下掌柜的叮嘱' }
}

export const replayCityIntro = (state: GameStateV10): ActionResult => {
  state.city.shop.introStep = 0
  return { ok: true, message: '重温初到城中的叙话' }
}

export const cityShopStatus = (state: GameStateV10): string => {
  const shop = state.city.shop
  if (!cityShopTile(state)) return '未拥有产业'
  if (!shop.enabled) return '已打烊'
  if (!shop.staff.some(worker => worker.heroId)) return '等待店员'
  if (!shop.stock.length) return '等待补货'
  return shop.staff.some(worker => worker.serving) ? '正在接待' : '等待顾客'
}

/** 原版简易分支每秒结算：先来客，按席位分配顾客，再推进销售；每件售出原子记账。 */
export const advanceCityShop = (state: GameStateV10, elapsedMs: number, rng: Rng): boolean => {
  const shop = state.city.shop
  const tile = cityShopTile(state)
  if (!tile || !shop.enabled || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return false
  const before = JSON.stringify(shop)
  shop.elapsedMs += elapsedMs
  let ticks = Math.floor(shop.elapsedMs / TICK_MS)
  shop.elapsedMs %= TICK_MS
  const arrival = 0.1 * (1 + tile.population / 20000) * (1 + technologyBonus(state, 10))
  const workers = shop.staff.slice(0, cityShopStaffCount(state))
  const rates = workers.map(worker => worker.heroId && !cityShopWorkerReason(state, worker.heroId)
    ? cityShopProgressPerSecond(state, worker.heroId) : 0)
  while (ticks > 0) {
    if (!shop.stock.length || !rates.some(rate => rate > 0)) {
      // 没有可完成的销售时直接推进来客，避免后台恢复长时间逐秒空转。
      shop.customers = Math.min(CITY_SHOP_CUSTOMER_CAPACITY, shop.customers + arrival * ticks)
      if (!shop.stock.length) resetService(state)
      break
    }
    ticks--
    shop.customers = Math.min(CITY_SHOP_CUSTOMER_CAPACITY, shop.customers + arrival)
    for (let i = 0; i < workers.length && shop.stock.length; i++) {
      const worker = workers[i]
      if (rates[i] <= 0) continue
      const serving = workers.filter(other => other.serving).length
      if (!worker.serving && Math.floor(shop.customers + 1e-9) - serving >= 1) worker.serving = true
      if (!worker.serving) continue
      worker.progress = Math.min(SALE_PROGRESS, worker.progress + rates[i])
      if (worker.progress < SALE_PROGRESS) continue
      worker.progress = 0
      worker.serving = false
      shop.customers = Math.max(0, shop.customers - 1)
      const [item] = shop.stock.splice(rng.nextInt(0, shop.stock.length), 1)
      const amount = cityShopSalePrice(state, item)
      state.city.company.cash += amount
      recordCityFinance(state, '销售收入', amount)
      shop.experience = Math.min(tile.buildingLevel ** 3 * 10000, shop.experience + Math.round(4 * item.quality))
      shop.soldCount++
      shop.revenue += amount
      shop.receipts.unshift({ sequence: shop.soldCount, definitionId: item.definitionId, level: item.level, quality: item.quality, amount })
      shop.receipts.length = Math.min(10, shop.receipts.length)
      if (!shop.stock.length) resetService(state)
    }
  }
  return JSON.stringify(shop) !== before
}
