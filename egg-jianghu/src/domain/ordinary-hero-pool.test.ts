import { describe, expect, it } from 'vitest'
import { FACTIONS } from '../content/factions'
import { FACTION_HEROES, HEROES_V10 } from '../content/heroes'
import { ORDINARY_POOL_HEROES, ORDINARY_POOL_RULES, isOrdinaryPoolHero } from '../content/ordinary-hero-pool'
import { availableOrdinaryPoolHeroes, drawOrdinaryPool } from './ordinary-hero-pool'
import { createHeroProgress, createInitialStateV10 } from './state'
import { recruitFromFaction } from './recruitment'
import { hydrateStateV10, exportSaveV10, importSaveV10 } from './save-v10'

const funded = () => {
  const state = createInitialStateV10(1_800_000_000_000)
  state.idleVouchers.balance = 100_000
  return state
}
const sequence = (...values: number[]) => { let i = 0; return () => values[i++] }

describe('统一普通池', () => {
  it('29个任务势力各一名最高门槛，按名录顺序打破并列，武馆和赵云不入池', () => {
    expect(ORDINARY_POOL_HEROES).toHaveLength(29)
    expect(new Set(ORDINARY_POOL_HEROES.map(hero => hero.factionId)).size).toBe(29)
    for (const faction of FACTIONS) {
      const pool = ORDINARY_POOL_HEROES.filter(hero => hero.factionId === faction.id)
      if (faction.currencyKind === 'worldCurrency') { expect(pool).toEqual([]); continue }
      const candidates = FACTION_HEROES.filter(hero => hero.factionId === faction.id)
      const highest = Math.max(...candidates.map(hero => hero.requiredReputationLevel!))
      expect(pool).toEqual([candidates.find(hero => hero.requiredReputationLevel === highest)])
    }
    expect(availableOrdinaryPoolHeroes(funded()).map(hero => hero.name)).toEqual(['王异', '关羽', '孙尚香'])
    expect(isOrdinaryPoolHero('hero_orig_12')).toBe(false)
    expect(isOrdinaryPoolHero('hero_orig_5')).toBe(false)
    expect(isOrdinaryPoolHero('hero_orig_165')).toBe(false)
  })

  it('未解锁世界不入池、旧已拥有角色不重发，解锁后累积补入', () => {
    const state = funded()
    state.heroes.hero_orig_11 = createHeroProgress('job_1')
    state.heroes.hero_orig_11.level = 88
    expect(availableOrdinaryPoolHeroes(state).map(hero => hero.name)).toEqual(['关羽', '孙尚香'])
    state.ordinaryPoolMisses = 20
    state.unlockedWorldIds.push('world_02')
    expect(availableOrdinaryPoolHeroes(state).map(hero => hero.name)).toEqual(['关羽', '孙尚香', '扫地僧', '令狐少侠', '张三丰'])
    drawOrdinaryPool(state, 1, () => 0)
    expect(state.heroes.hero_orig_11.level).toBe(88)
    expect(availableOrdinaryPoolHeroes(state)).toHaveLength(4)
  })

  it('1.2%边界、均分选择与材料数量固定，不吃收益卡', () => {
    for (const [pick, name] of [[0, '王异'], [0.5, '关羽'], [0.999, '孙尚香']] as const) {
      const state = funded()
      expect(drawOrdinaryPool(state, 1, sequence(0.011999, pick))).toMatchObject({ ok: true, rewards: [{ name, amount: 1 }] })
      expect(availableOrdinaryPoolHeroes(state)).toHaveLength(2)
      expect(state.ordinaryPoolMisses).toBe(0)
    }
    const state = funded()
    expect(drawOrdinaryPool(state, 1, sequence(0.012, 0))).toMatchObject({ ok: true, spent: 100, rewards: [{ kind: 'material', id: '11', amount: 2 }] })
    expect(state.materials['11']).toBe(2)
    expect(state.ordinaryPoolMisses).toBe(1)
    expect(drawOrdinaryPool(state, 1, sequence(0.9, 0.999))).toMatchObject({ ok: true, rewards: [{ id: '20', amount: 2 }] })
    const withCards = funded()
    const withoutCards = funded()
    for (const key of ['monthly', 'treasure', 'training'] as const) withCards.premiumCards.expiresAt[key] = 9_000_000_000_000
    expect(drawOrdinaryPool(withCards, 10, () => 0.5)).toEqual(drawOrdinaryPool(withoutCards, 10, () => 0.5))
  })

  it('69次未中后第70次必出，跨世界保留，自然出货重置', () => {
    const state = funded()
    for (let i = 0; i < 69; i++) expect(drawOrdinaryPool(state, 1, () => 0.5).ok).toBe(true)
    expect(state.ordinaryPoolMisses).toBe(69)
    state.unlockedWorldIds.push('world_02')
    expect(state.ordinaryPoolMisses).toBe(69)
    expect(drawOrdinaryPool(state, 1, () => 0.999)).toMatchObject({ ok: true, rewards: [{ kind: 'hero', name: '张三丰' }] })
    expect(state.ordinaryPoolMisses).toBe(0)
    state.ordinaryPoolMisses = 50
    drawOrdinaryPool(state, 1, () => 0)
    expect(state.ordinaryPoolMisses).toBe(0)
  })

  it('十连中抽空立刻停止，只扣实际次数；空池不消耗、不调用随机源', () => {
    const state = funded()
    const result = drawOrdinaryPool(state, 10, () => 0)
    expect(result).toMatchObject({ ok: true, draws: 3, spent: 300 })
    if (result.ok) expect(new Set(result.rewards.map(reward => reward.id)).size).toBe(3)
    expect(state.idleVouchers.balance).toBe(99_700)
    const before = structuredClone(state)
    expect(drawOrdinaryPool(state, 10, () => { throw new Error('不应调用') })).toMatchObject({ ok: false, message: '暂无可抽取角色' })
    expect(state).toEqual(before)
    state.unlockedWorldIds.push('world_02')
    expect(availableOrdinaryPoolHeroes(state)).toHaveLength(3)
  })

  it('十连逐次执行保底与移除，与相同随机数的单抽一致', () => {
    const batch = funded(), singles = funded()
    batch.ordinaryPoolMisses = singles.ordinaryPoolMisses = 68
    const values = Array.from({ length: 20 }, () => 0.5)
    drawOrdinaryPool(batch, 10, sequence(...values))
    const rng = sequence(...values)
    for (let i = 0; i < 10; i++) drawOrdinaryPool(singles, 1, rng)
    expect(batch).toEqual(singles)
  })

  it('非法数量、余额不足、随机数异常与中途抛错均不产生部分消费', () => {
    for (const count of [0, -1, 2, 11, NaN, Infinity]) {
      const state = funded(), before = structuredClone(state)
      expect(drawOrdinaryPool(state, count).ok).toBe(false)
      expect(state).toEqual(before)
    }
    for (const value of [-1, 1, NaN, Infinity]) {
      const state = funded(), before = structuredClone(state)
      expect(drawOrdinaryPool(state, 10, sequence(0.5, 0.5, value, 0)).ok).toBe(false)
      expect(state).toEqual(before)
    }
    const state = funded()
    state.idleVouchers.balance = 99
    const before = structuredClone(state)
    expect(drawOrdinaryPool(state, 1).ok).toBe(false)
    expect(state).toEqual(before)
    state.idleVouchers.balance = 1000
    const beforeThrow = structuredClone(state)
    expect(drawOrdinaryPool(state, 10, () => { throw new Error('随机源异常') }).ok).toBe(false)
    expect(state).toEqual(beforeThrow)
  })

  it('所有池角色不能通过旧势力兑换绕过，旧拥有培养不受影响', () => {
    for (const hero of ORDINARY_POOL_HEROES) {
      const state = funded()
      state.unlockedWorldIds.push(hero.worldId)
      state.worldReputation[hero.worldId] = 1_000_000_000
      state.contribution[hero.worldId] = 1_000_000_000
      const before = structuredClone(state)
      expect(recruitFromFaction(state, hero.factionId!, hero.id)).toMatchObject({ ok: false, message: '该侠客由商城普通池招募' })
      expect(state).toEqual(before)
    }
  })

  it('旧v19默认零保底；导入导出保留角色和计数，损坏计数拒绝加载', () => {
    const state = funded()
    state.ordinaryPoolMisses = 68
    const hero = HEROES_V10.find(hero => hero.id === 'hero_orig_11')!
    state.heroes[hero.id] = createHeroProgress(hero.baseCareerId)
    state.heroes[hero.id].level = 77
    const restored = importSaveV10(exportSaveV10(state)).state
    expect(restored.ordinaryPoolMisses).toBe(68)
    expect(restored.heroes[hero.id].level).toBe(77)
    expect(availableOrdinaryPoolHeroes(restored)).toHaveLength(2)
    const old = JSON.parse(exportSaveV10(state))
    delete old.ordinaryPoolMisses
    expect(hydrateStateV10(old).ordinaryPoolMisses).toBe(0)
    expect(hydrateStateV10(old).heroes).toEqual(state.heroes)
    for (const value of [null, -1, 70, 0.1, '1', Infinity, {}, []]) {
      expect(() => hydrateStateV10({ ...state, ordinaryPoolMisses: value })).toThrow()
    }
    expect(ORDINARY_POOL_RULES).toMatchObject({ cost: 100, heroRate: 0.012, heroPity: 70 })
  })
})
