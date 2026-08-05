import { describe, expect, it } from 'vitest'
import { FACTION_MARTIALS } from '../content/martials'
import { createInitialStateV10, createHeroProgress } from './state'
import {
  equipHeartMethod,
  equipMartial,
  forgetMartial,
  learnFactionMartial,
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
  state.heroes.hero_mu_nianci = createHeroProgress('sword')
  return state
}

const learnedAt = (level: number, invested: InvestmentLedger): LearnedMartial => ({ level, invested })

describe('邀请与武功修习', () => {
  it('从明确名单直接邀请侠客，不返回随机结果', () => {
    const state = createInitialStateV10(1000)

    const result = recruitFromTavern(state, 'hero_mu_nianci')

    expect(result).toEqual({ ok: true, heroId: 'hero_mu_nianci', spent: 240 })
    expect(state.heroes.hero_mu_nianci.recruited).toBe(true)
    expect(state.worldCurrency.world_01).toBe(760)
  })

  it('A1 Lv.20 只解锁同线 B1，遗忘返还分账投入的 80%', () => {
    const state = seededState({ world_01: 1000 }, { qingfeng_hall: 1000 })
    const hero = state.heroes.hero_mu_nianci

    expect(learnFactionMartial(state, 'hero_mu_nianci', 'qingfeng_hall_b1').ok).toBe(false)
    hero.learnedMartials.qingfeng_hall_a1 = learnedAt(20, {
      contribution: { qingfeng_hall: 500 },
      worldCurrency: {},
    })
    expect(learnFactionMartial(state, 'hero_mu_nianci', 'qingfeng_hall_b1').ok).toBe(true)
    expect(learnFactionMartial(state, 'hero_mu_nianci', 'qingfeng_hall_b2').ok).toBe(false)

    const refund = forgetMartial(state, 'hero_mu_nianci', 'qingfeng_hall_a1')
    expect(refund.refundedContribution.qingfeng_hall).toBe(400)
  })

  it('每名侠客只能主修一门心法且不占四个主动槽', () => {
    const state = seededState({ world_01: 1000 }, { qingfeng_hall: 1000 })

    expect(equipHeartMethod(state, 'hero_mu_nianci', 'qingfeng_hall_heart_01').ok).toBe(true)

    expect(state.heroes.hero_mu_nianci.heartMethodId).toBe('qingfeng_hall_heart_01')
    expect(state.heroes.hero_mu_nianci.equippedMartialIds).toEqual([null, null, null, null])
  })

  it('生成 30 势力共 240 门主动武功且第 21 门被拒绝', () => {
    expect(FACTION_MARTIALS).toHaveLength(240)
    const state = seededState({}, { qingfeng_hall: 1000 })
    const hero = state.heroes.hero_mu_nianci
    for (let index = 0; index < 20; index += 1) {
      hero.learnedMartials[`fixture_${index}`] = learnedAt(1, { worldCurrency: {}, contribution: {} })
    }

    expect(learnFactionMartial(state, 'hero_mu_nianci', 'qingfeng_hall_a1').ok).toBe(false)
  })

  it('四个主动槽按指定位置装备且禁止重复', () => {
    const state = seededState()
    const hero = state.heroes.hero_mu_nianci
    hero.learnedMartials.qingfeng_hall_a1 = learnedAt(1, { worldCurrency: {}, contribution: {} })

    expect(equipMartial(state, 'hero_mu_nianci', 'qingfeng_hall_a1', 2).ok).toBe(true)
    expect(hero.equippedMartialIds).toEqual([null, null, 'qingfeng_hall_a1', null])
    expect(equipMartial(state, 'hero_mu_nianci', 'qingfeng_hall_a1', 0).ok).toBe(false)
  })
})
