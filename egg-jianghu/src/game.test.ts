import { describe, expect, it } from 'vitest'
import { COMBO, HEROES, MARTIALS } from './data'
import {
  createInitialState,
  getPartySynergy,
  recruitHero,
  setPartySlot,
  startChallenge,
  stepCombat,
  upgradeHero,
} from './game'

describe('蛋蛋江湖 MVP 核心循环', () => {
  it('按 MVP 规格提供九名侠客、五门武学与三人初始队伍', () => {
    const state = createInitialState(1_000)
    expect(HEROES).toHaveLength(9)
    expect(MARTIALS).toHaveLength(5)
    expect(state.party).toHaveLength(3)
    expect(state.party.every((id) => state.heroes[id].unlocked)).toBe(true)
  })

  it('挂机战斗会自动击败敌人并产出银两与阅历', () => {
    const state = createInitialState()
    const beforeSilver = state.resources.silver
    const beforeExperience = state.resources.experience
    for (let index = 0; index < 20; index += 1) stepCombat(state)
    expect(state.statistics.idleEnemiesDefeated).toBeGreaterThan(0)
    expect(state.resources.silver).toBeGreaterThan(beforeSilver)
    expect(state.resources.experience).toBeGreaterThan(beforeExperience)
    expect(state.combat.logs.some((event) => event.kind === 'reward')).toBe(true)
  })

  it('调整同门阵容会激活门派羁绊', () => {
    const state = createInitialState()
    state.resources.silver = 1_000
    expect(recruitHero(state, 'yan_qiusheng').ok).toBe(true)
    expect(setPartySlot(state, 1, 'yan_qiusheng').ok).toBe(true)
    const synergy = getPartySynergy(state)
    expect(synergy.sectName).toBe('丐帮')
    expect(synergy.sectCount).toBe(2)
    expect(synergy.attackMultiplier).toBe(1.12)
  })

  it('陆青山与江晚同队时按轮次施展唯一合击技', () => {
    const state = createInitialState()
    state.resources.silver = 1_000
    expect(recruitHero(state, 'jiang_wan').ok).toBe(true)
    expect(setPartySlot(state, 1, 'jiang_wan').ok).toBe(true)
    expect(getPartySynergy(state).comboActive).toBe(true)
    expect(startChallenge(state).ok).toBe(true)
    for (let index = 0; index < 45 && state.combat.status === 'fighting'; index += 1) stepCombat(state)
    expect(state.combat.logs.some((event) => event.kind === 'combo' && event.text.includes(COMBO.name))).toBe(true)
  })

  it('玩家可在落败后养成侠客并打过此前未过的关卡', () => {
    const state = createInitialState()

    expect(startChallenge(state).ok).toBe(true)
    for (let index = 0; index < 200 && state.combat.status === 'fighting'; index += 1) stepCombat(state)
    expect(state.combat.status).toBe('victory')
    expect(state.clearedStage).toBe(1)

    expect(startChallenge(state).ok).toBe(true)
    for (let index = 0; index < 300 && state.combat.status === 'fighting'; index += 1) stepCombat(state)
    expect(state.combat.status).toBe('defeat')
    expect(state.clearedStage).toBe(1)

    state.resources.silver = 100_000
    state.resources.experience = 100_000
    for (const heroId of state.party) {
      for (let level = 0; level < 6; level += 1) expect(upgradeHero(state, heroId).ok).toBe(true)
    }
    expect(startChallenge(state).ok).toBe(true)
    for (let index = 0; index < 300 && state.combat.status === 'fighting'; index += 1) stepCombat(state)
    expect(state.combat.status).toBe('victory')
    expect(state.clearedStage).toBe(2)
  })
})
