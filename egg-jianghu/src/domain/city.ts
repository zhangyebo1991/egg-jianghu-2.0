import { CITY_MARTIALS } from '../content/martials'
import {
  ORIGINAL_CITY_CONSTANTS,
  ORIGINAL_CITY_PENDING_RULES,
  originalCityDevelopment,
  originalCityEffectiveGrid,
  originalCityLandPrice,
  originalCityMonthlyRent,
  originalCityTotals,
} from '../content/original-city.generated'
import { canLearnMartial } from './martial-training'
import { createEmptyCityFinanceLedger } from './state'
import type { ActionResult, CityFinanceLedger, CityTileState, GameStateV10, InvestmentLedger } from './types'

export const spend = (wallet: Record<string, number>, id: string, amount: number): ActionResult => {
  const cost = Math.max(0, Math.floor(amount))
  if ((wallet[id] ?? 0) < cost) return { ok: false, message: '资源不足' }
  wallet[id] -= cost
  return { ok: true, message: '支付成功' }
}

export const cityTileById = (state: GameStateV10, tileId: number): CityTileState | undefined =>
  state.city.tiles.find((tile) => tile.tileId === tileId)

export const cityTotals = (state: GameStateV10): { population: number; commerce: number; industry: number } =>
  originalCityTotals(state.city.tiles, state.city.level)

export const cityDevelopment = (state: GameStateV10): number => {
  const totals = cityTotals(state)
  return originalCityDevelopment(totals.population, totals.commerce, totals.industry)
}

export const cityTilePrice = (
  state: GameStateV10,
  tile: CityTileState,
  mode: 'buy' | 'sell',
): number => originalCityLandPrice({
  development: cityDevelopment(state),
  population: tile.population,
  commerce: tile.commerce,
  industry: tile.industry,
  landPriceTier: tile.landPriceTier,
  buildingId: tile.buildingId,
  buildingLevel: tile.buildingLevel,
  mode,
})

export const cityOwnedLandValue = (state: GameStateV10): number =>
  state.city.tiles
    .filter((tile) => tile.owned)
    .reduce((total, tile) => total + cityTilePrice(state, tile, 'buy'), 0)

export const cityBaseMonthlyRent = (state: GameStateV10): number =>
  state.city.tiles
    .filter((tile) => tile.owned)
    .reduce((total, tile) => total + originalCityMonthlyRent(
      tile.buildingId,
      cityTilePrice(state, tile, 'buy'),
    ), 0)

export const cityFinanceNetIncome = (ledger: CityFinanceLedger): number =>
  ledger.销售收入 + ledger.租金收入 + ledger.门票收入 + ledger.其他收入
  - ledger.科研支出 - ledger.建造支出 - ledger.其他支出

export const recordCityFinance = (
  state: GameStateV10,
  category: keyof CityFinanceLedger,
  amount: number,
): ActionResult => {
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, message: '收支金额无效' }
  state.city.company.currentFinance[category] += amount
  return { ok: true, message: '收支已记录' }
}

export const settleCityFinance = (state: GameStateV10): ActionResult => {
  if (state.city.company.name === null) return { ok: false, message: '公司尚未成立' }
  state.city.company.previousFinance = structuredClone(state.city.company.currentFinance)
  state.city.company.previousNetIncome = cityFinanceNetIncome(state.city.company.currentFinance)
  state.city.company.currentFinance = createEmptyCityFinanceLedger()
  return { ok: true, message: '本期财务已结算' }
}

const cityCompanyNameReady = (name: string, originalValidationPassed: boolean): ActionResult => {
  if (!name.trim()) return { ok: false, message: '请输入公司名称' }
  if (!originalValidationPassed) return { ok: false, message: ORIGINAL_CITY_PENDING_RULES.companyNameValidation }
  return { ok: true, message: '名称已通过原版校验' }
}

export const registerCityCompany = (
  state: GameStateV10,
  name: string,
  originalValidationPassed = false,
): ActionResult => {
  if (state.city.company.name !== null) return { ok: false, message: '公司已经成立' }
  const nameResult = cityCompanyNameReady(name, originalValidationPassed)
  if (!nameResult.ok) return nameResult
  if (state.city.company.cash < ORIGINAL_CITY_CONSTANTS.companyRegistrationCost) {
    return { ok: false, message: '公司现金不足' }
  }
  state.city.company.cash -= ORIGINAL_CITY_CONSTANTS.companyRegistrationCost
  state.city.company.name = name.trim()
  recordCityFinance(state, '其他支出', ORIGINAL_CITY_CONSTANTS.companyRegistrationCost)
  return { ok: true, message: '公司成立' }
}

export const renameCityCompany = (
  state: GameStateV10,
  name: string,
  originalValidationPassed = false,
): ActionResult => {
  if (state.city.company.name === null) return { ok: false, message: '公司尚未成立' }
  const nameResult = cityCompanyNameReady(name, originalValidationPassed)
  if (!nameResult.ok) return nameResult
  if (state.city.company.cash < ORIGINAL_CITY_CONSTANTS.companyRenameCost) {
    return { ok: false, message: '公司现金不足' }
  }
  state.city.company.cash -= ORIGINAL_CITY_CONSTANTS.companyRenameCost
  state.city.company.name = name.trim()
  recordCityFinance(state, '其他支出', ORIGINAL_CITY_CONSTANTS.companyRenameCost)
  return { ok: true, message: '公司已更名' }
}

export const cityEffectiveGrid = (state: GameStateV10): { columns: number; rows: number } =>
  originalCityEffectiveGrid(state.city.level)

export const learnCityMartial = (
  state: GameStateV10,
  heroId: string,
  martialId: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  const martial = CITY_MARTIALS.find((item) => item.id === martialId)
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  if (!martial) return { ok: false, message: '城市武功不存在' }
  if (!state.unlockedWorldIds.includes(martial.worldId)) return { ok: false, message: '尚未解锁所在江湖卷' }
  const allowed = canLearnMartial(hero, martial)
  if (!allowed.ok) return allowed
  const cost = martial.currencySource.amount
  if ((state.worldCurrency[martial.worldId] ?? 0) < cost) return { ok: false, message: '本卷货币不足' }

  state.worldCurrency[martial.worldId] -= cost
  const invested: InvestmentLedger = { worldCurrency: { [martial.worldId]: cost }, contribution: {} }
  hero.learnedMartials[martialId] = { level: 1, investedSp: 0, invested }
  return { ok: true, message: '学会城市武功' }
}
