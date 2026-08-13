import { martialByIdV10 } from '../content/martials'
import { canLearnMartial } from './martial-training'
import type { ActionResult, GameStateV10, InvestmentLedger } from './types'

export const spend = (wallet: Record<string, number>, id: string, amount: number): ActionResult => {
  const cost = Math.max(0, Math.floor(amount))
  if ((wallet[id] ?? 0) < cost) return { ok: false, message: '资源不足' }
  wallet[id] -= cost
  return { ok: true, message: '支付成功' }
}

export const learnCityMartial = (
  state: GameStateV10,
  heroId: string,
  martialId: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  const martial = martialByIdV10(martialId)
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  if (!martial || martial.source !== 'city') return { ok: false, message: '城市武功不存在' }
  if (!state.unlockedWorldIds.includes(martial.worldId)) return { ok: false, message: '尚未解锁所在江湖卷' }
  const allowed = canLearnMartial(hero, martial)
  if (!allowed.ok) return allowed
  const cost = martial.currencySource.amount
  if ((state.worldCurrency[martial.worldId] ?? 0) < cost) return { ok: false, message: '本卷货币不足' }

  state.worldCurrency[martial.worldId] -= cost
  const invested: InvestmentLedger = { worldCurrency: { [martial.worldId]: cost }, contribution: {} }
  hero.learnedMartials[martialId] = { level: 1, invested }
  return { ok: true, message: '学会城市武功' }
}
