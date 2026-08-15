import { describe, expect, it } from 'vitest'
import { FACTION_MARTIALS, martialByIdV10, martialResourceCost, martialSpCost } from '../content/martials'
import { createInitialStateV10, createHeroProgress } from './state'
import {
  equipHeartMethod,
  equipMartial,
  forgetMartial,
  learnFactionMartial,
  upgradeMartial,
} from './martial-training'
import { recruitFromTavern } from './recruitment'
import type { GameStateV10, InvestmentLedger, LearnedMartial } from './types'

const seededState = (
  worldCurrency: Record<string, number> = {},
  contribution: Record<string, number> = {},
): GameStateV10 => {
  const state = createInitialStateV10(1000)
  state.worldCurrency = { ...state.worldCurrency, ...worldCurrency }
  state.contribution = { ...contribution }
  state.heroes.hero_mu_nianci = createHeroProgress('inner')
  state.heroes.hero_mu_nianci.skillPoints = 1_000_000_000
  return state
}

const learnedAt = (
  level: number,
  invested: InvestmentLedger = { worldCurrency: {}, contribution: {} },
  investedSp = 0,
): LearnedMartial => ({ level, investedSp, invested })

describe('邀请与技能修习', () => {
  it('从明确名单直接邀请侠客，不返回随机结果', () => {
    const state = createInitialStateV10(1000)

    const result = recruitFromTavern(state, 'hero_mu_nianci')

    expect(result).toEqual({ ok: true, heroId: 'hero_mu_nianci', spent: 240 })
    expect(state.heroes.hero_mu_nianci.recruited).toBe(true)
    expect(state.worldCurrency.world_01).toBe(760)
  })

  it('同线前置必须达到自身上限，遗忘只返还累计投入的 100% SP', () => {
    const state = seededState({ world_01: 1_000_000 })
    const hero = state.heroes.hero_mu_nianci
    const first = martialByIdV10('original_skill_42')!

    expect(learnFactionMartial(state, 'hero_mu_nianci', 'original_skill_45').ok).toBe(false)
    hero.learnedMartials.original_skill_42 = learnedAt(first.maxLevel, {
      worldCurrency: { world_01: 99_999 },
      contribution: {},
    }, 12_345)
    expect(learnFactionMartial(state, 'hero_mu_nianci', 'original_skill_45').ok).toBe(true)
    expect(learnFactionMartial(state, 'hero_mu_nianci', 'original_skill_43').ok).toBe(false)

    const currencyBeforeForget = state.worldCurrency.world_01
    const refund = forgetMartial(state, 'hero_mu_nianci', 'original_skill_42')
    expect(refund.refundedSp).toBe(12_345)
    expect(state.worldCurrency.world_01).toBe(currencyBeforeForget)
  })

  it('学习和升级按目标等级同时扣除精确 SP 与资源', () => {
    const state = seededState({ world_01: 1_000_000 })
    const hero = state.heroes.hero_mu_nianci
    const martial = martialByIdV10('original_skill_42')!
    const spBefore = hero.skillPoints
    const currencyBefore = state.worldCurrency.world_01

    expect(learnFactionMartial(state, 'hero_mu_nianci', martial.id).ok).toBe(true)
    expect(spBefore - hero.skillPoints).toBe(martialSpCost(martial.difficulty, 1))
    expect(currencyBefore - state.worldCurrency.world_01).toBe(martialResourceCost('worldCurrency', martial.difficulty, 1))

    const spAfterLearn = hero.skillPoints
    const currencyAfterLearn = state.worldCurrency.world_01
    expect(upgradeMartial(state, 'hero_mu_nianci', martial.id).ok).toBe(true)
    expect(spAfterLearn - hero.skillPoints).toBe(martialSpCost(martial.difficulty, 2))
    expect(currencyAfterLearn - state.worldCurrency.world_01).toBe(martialResourceCost('worldCurrency', martial.difficulty, 2))
  })

  it('每名侠客只能主修一门心法且不占四个主动槽', () => {
    const state = seededState({ world_01: 1000 })

    expect(equipHeartMethod(state, 'hero_mu_nianci', 'qingfeng_hall_heart_01').ok).toBe(true)

    expect(state.heroes.hero_mu_nianci.heartMethodId).toBe('qingfeng_hall_heart_01')
    expect(state.heroes.hero_mu_nianci.equippedMartialIds).toEqual([null, null, null, null])
  })

  it('生成 42 势力共 252 门技能且第 13 门被拒绝', () => {
    expect(FACTION_MARTIALS).toHaveLength(252)
    const state = seededState({ world_01: 1_000_000 })
    const hero = state.heroes.hero_mu_nianci
    for (let index = 0; index < 12; index += 1) {
      hero.learnedMartials[`fixture_${index}`] = learnedAt(1)
    }

    expect(learnFactionMartial(state, 'hero_mu_nianci', 'original_skill_42').ok).toBe(false)
  })

  it('四个主动槽按指定位置装备且禁止重复', () => {
    const state = seededState()
    const hero = state.heroes.hero_mu_nianci
    hero.learnedMartials.original_skill_42 = learnedAt(1)

    expect(equipMartial(state, 'hero_mu_nianci', 'original_skill_42', 2).ok).toBe(true)
    expect(hero.equippedMartialIds).toEqual([null, null, 'original_skill_42', null])
    expect(equipMartial(state, 'hero_mu_nianci', 'original_skill_42', 0).ok).toBe(false)
  })
})
