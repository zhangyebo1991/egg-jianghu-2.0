import {
  heartMethodByIdV10,
  martialResourceCost,
  martialSpCost,
  martialByIdV10,
  type MartialDefinitionV10,
} from '../content/martials'
import type {
  ActionResult,
  GameStateV10,
  HeroProgressV10,
  InvestmentLedger,
} from './types'

export const MAX_LEARNED_MARTIALS_V10 = 12

const emptyLedger = (): InvestmentLedger => ({ worldCurrency: {}, contribution: {} })

export const canLearnMartial = (
  hero: HeroProgressV10,
  martial: MartialDefinitionV10,
): ActionResult => {
  if (hero.learnedMartials[martial.id]) return { ok: false, message: '已经学会该武功' }
  if (Object.keys(hero.learnedMartials).length >= MAX_LEARNED_MARTIALS_V10) {
    return { ok: false, message: '最多学习 12 门技能' }
  }
  if (!martial.careerIds.includes(hero.currentCareerId)) return { ok: false, message: '当前职业不符' }
  const previous = martial.previousId ? martialByIdV10(martial.previousId) : undefined
  if (previous && hero.learnedMartials[previous.id]?.level !== previous.maxLevel) {
    return { ok: false, message: `前置技能必须达到 Lv.${previous.maxLevel}` }
  }
  return { ok: true, message: '可以学习' }
}

const spendMartialLevelCost = (
  state: GameStateV10,
  hero: HeroProgressV10,
  martial: MartialDefinitionV10,
  targetLevel: number,
): ActionResult & { spCost?: number, resourceCost?: number } => {
  const spCost = martialSpCost(martial.difficulty, targetLevel)
  const resourceCost = martialResourceCost(martial.currencySource.kind, martial.difficulty, targetLevel)
  const wallet = martial.currencySource.kind === 'contribution' ? state.contribution : state.worldCurrency
  if (hero.skillPoints < spCost) return { ok: false, message: `技能点不足，需要 ${spCost} SP` }
  if ((wallet[martial.currencySource.id] ?? 0) < resourceCost) {
    return { ok: false, message: martial.currencySource.kind === 'contribution' ? '势力贡献不足' : '位面货币不足' }
  }
  hero.skillPoints -= spCost
  wallet[martial.currencySource.id] -= resourceCost
  return { ok: true, message: '支付成功', spCost, resourceCost }
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
  const payment = spendMartialLevelCost(state, hero, martial, 1)
  if (!payment.ok) return payment
  const invested = emptyLedger()
  const resourceLedger = martial.currencySource.kind === 'contribution' ? invested.contribution : invested.worldCurrency
  resourceLedger[martial.currencySource.id] = payment.resourceCost ?? 0
  hero.learnedMartials[martialId] = { level: 1, investedSp: payment.spCost ?? 0, invested }
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
  if (learned.level >= martial.maxLevel) return { ok: false, message: `技能已经达到 Lv.${martial.maxLevel}` }
  const payment = spendMartialLevelCost(state, hero, martial, learned.level + 1)
  if (!payment.ok) return payment
  const ledger = martial.currencySource.kind === 'contribution'
    ? learned.invested.contribution
    : learned.invested.worldCurrency
  ledger[martial.currencySource.id] = (ledger[martial.currencySource.id] ?? 0) + (payment.resourceCost ?? 0)
  learned.investedSp += payment.spCost ?? 0
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

export interface ForgetMartialResult extends ActionResult {
  refundedSp: number
}

export const grantPermanentMartial = (
  state: GameStateV10,
  heroId: string,
  martialId: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  const martial = martialByIdV10(martialId)
  if (!hero?.recruited) return { ok: false, message: '侠客尚未加入' }
  if (!martial) return { ok: false, message: '技能不存在' }
  if (hero.permanentMartialIds.includes(martialId)) return { ok: true, message: '永久技能已经领悟' }
  if (!hero.learnedMartials[martialId]) {
    hero.learnedMartials[martialId] = { level: 1, investedSp: 0, invested: emptyLedger() }
  }
  hero.permanentMartialIds.push(martialId)
  return { ok: true, message: `永久领悟 ${martial.name}` }
}

export const relearnPermanentMartial = (
  state: GameStateV10,
  heroId: string,
  martialId: string,
): ActionResult => {
  const hero = state.heroes[heroId]
  const martial = martialByIdV10(martialId)
  if (!hero?.recruited || !martial) return { ok: false, message: '技能不存在' }
  if (!hero.permanentMartialIds.includes(martialId)) return { ok: false, message: '尚未获得永久领悟资格' }
  if (hero.learnedMartials[martialId]) return { ok: false, message: '已经学会该技能' }
  hero.learnedMartials[martialId] = { level: 1, investedSp: 0, invested: emptyLedger() }
  return { ok: true, message: `重新领悟 ${martial.name}` }
}

export const forgetMartial = (
  state: GameStateV10,
  heroId: string,
  martialId: string,
): ForgetMartialResult => {
  const hero = state.heroes[heroId]
  const learned = hero?.learnedMartials[martialId]
  if (!hero || !learned) {
    return { ok: false, message: '尚未学会该武功', refundedSp: 0 }
  }

  const refundedSp = learned.investedSp
  hero.skillPoints += refundedSp

  delete hero.learnedMartials[martialId]
  hero.equippedMartialIds = hero.equippedMartialIds.map((id) => id === martialId ? null : id) as HeroProgressV10['equippedMartialIds']
  return {
    ok: true,
    message: `已遗忘技能并返还 ${refundedSp} SP`,
    refundedSp,
  }
}
