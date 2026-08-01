import {
  heartMethodByIdV10,
  martialByIdV10,
  type MartialDefinitionV10,
} from '../content/martials'
import type {
  ActionResult,
  GameStateV10,
  HeroProgressV10,
  InvestmentLedger,
} from './types'

export const MAX_LEARNED_MARTIALS_V10 = 20
export const MAX_MARTIAL_LEVEL = 20

const emptyLedger = (): InvestmentLedger => ({ worldCurrency: {}, contribution: {} })

export const canLearnMartial = (
  hero: HeroProgressV10,
  martial: MartialDefinitionV10,
): ActionResult => {
  if (hero.learnedMartials[martial.id]) return { ok: false, message: '已经学会该武功' }
  if (Object.keys(hero.learnedMartials).length >= MAX_LEARNED_MARTIALS_V10) {
    return { ok: false, message: '最多学习 20 门武功' }
  }
  if (!martial.careerIds.includes(hero.currentCareerId)) return { ok: false, message: '当前职业不符' }
  if (martial.previousId && hero.learnedMartials[martial.previousId]?.level !== MAX_MARTIAL_LEVEL) {
    return { ok: false, message: '同线前置武功必须达到 Lv.20' }
  }
  return { ok: true, message: '可以学习' }
}

export const learnFactionMartial = (
  state: GameStateV10,
  heroId: string,
  martialId: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  const martial = martialByIdV10(martialId)
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  if (!martial || martial.source !== 'faction' || !martial.factionId) return { ok: false, message: '势力武功不存在' }

  const allowed = canLearnMartial(hero, martial)
  if (!allowed.ok) return allowed
  const cost = martial.currencySource.amount
  if ((state.contribution[martial.factionId] ?? 0) < cost) return { ok: false, message: '势力贡献不足' }

  state.contribution[martial.factionId] -= cost
  const invested = emptyLedger()
  invested.contribution[martial.factionId] = cost
  hero.learnedMartials[martialId] = { level: 1, invested }
  return { ok: true, message: '学会武功' }
}

export const upgradeMartial = (
  state: GameStateV10,
  heroId: string,
  martialId: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  const learned = hero?.learnedMartials[martialId]
  const martial = martialByIdV10(martialId)
  if (!hero?.recruited || !learned) return { ok: false, message: '尚未学会该武功' }
  if (!martial) return { ok: false, message: '武功定义不存在' }
  if (learned.level >= MAX_MARTIAL_LEVEL) return { ok: false, message: '武功已经达到 Lv.20' }
  const cost = Math.ceil(martial.currencySource.amount * (1 + learned.level * 0.2))
  const wallet = martial.currencySource.kind === 'contribution' ? state.contribution : state.worldCurrency
  if ((wallet[martial.currencySource.id] ?? 0) < cost) return { ok: false, message: '升级资源不足' }

  wallet[martial.currencySource.id] -= cost
  const ledger = martial.currencySource.kind === 'contribution'
    ? learned.invested.contribution
    : learned.invested.worldCurrency
  ledger[martial.currencySource.id] = (ledger[martial.currencySource.id] ?? 0) + cost
  learned.level += 1
  return { ok: true, message: `武功提升至 Lv.${learned.level}` }
}

export const equipMartial = (
  state: GameStateV10,
  heroId: string,
  martialId: string,
  slot: number,
): ActionResult => {
  const hero = state.heroes[heroId]
  if (!hero?.learnedMartials[martialId]) return { ok: false, message: '尚未学会该武功' }
  if (!Number.isInteger(slot) || slot < 0 || slot >= hero.equippedMartialIds.length) {
    return { ok: false, message: '主动槽位无效' }
  }
  if (hero.equippedMartialIds.includes(martialId)) return { ok: false, message: '该武功已经装备' }

  hero.equippedMartialIds[slot] = martialId
  return { ok: true, message: '已装备武功' }
}

export const unequipMartial = (
  state: GameStateV10,
  heroId: string,
  slot: number,
): ActionResult => {
  const hero = state.heroes[heroId]
  if (!hero || !Number.isInteger(slot) || slot < 0 || slot >= hero.equippedMartialIds.length) {
    return { ok: false, message: '主动槽位无效' }
  }
  hero.equippedMartialIds[slot] = null
  return { ok: true, message: '已卸下武功' }
}

export const equipHeartMethod = (
  state: GameStateV10,
  heroId: string,
  heartMethodId: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  const heartMethod = heartMethodByIdV10(heartMethodId)
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  if (!heartMethod) return { ok: false, message: '心法不存在' }
  if (!heartMethod.careerIds.includes(hero.currentCareerId)) return { ok: false, message: '当前职业不符' }

  hero.heartMethodId = heartMethodId
  return { ok: true, message: '已主修心法' }
}

export const refundLedger = (ledger: InvestmentLedger): InvestmentLedger => ({
  worldCurrency: Object.fromEntries(
    Object.entries(ledger.worldCurrency).map(([id, value]) => [id, Math.floor(value * 0.8)]),
  ),
  contribution: Object.fromEntries(
    Object.entries(ledger.contribution).map(([id, value]) => [id, Math.floor(value * 0.8)]),
  ),
})

export interface ForgetMartialResult extends ActionResult {
  refundedWorldCurrency: Record<string, number>
  refundedContribution: Record<string, number>
}

export const forgetMartial = (
  state: GameStateV10,
  heroId: string,
  martialId: string,
): ForgetMartialResult => {
  const hero = state.heroes[heroId]
  const learned = hero?.learnedMartials[martialId]
  if (!hero || !learned) {
    return { ok: false, message: '尚未学会该武功', refundedWorldCurrency: {}, refundedContribution: {} }
  }

  const refund = refundLedger(learned.invested)
  for (const [id, value] of Object.entries(refund.worldCurrency)) {
    state.worldCurrency[id] = (state.worldCurrency[id] ?? 0) + value
  }
  for (const [id, value] of Object.entries(refund.contribution)) {
    state.contribution[id] = (state.contribution[id] ?? 0) + value
  }

  delete hero.learnedMartials[martialId]
  hero.equippedMartialIds = hero.equippedMartialIds.map((id) => id === martialId ? null : id) as HeroProgressV10['equippedMartialIds']
  return {
    ok: true,
    message: '已遗忘武功并返还 80% 投入',
    refundedWorldCurrency: refund.worldCurrency,
    refundedContribution: refund.contribution,
  }
}
