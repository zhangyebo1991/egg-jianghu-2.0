import { describe, expect, it } from 'vitest'
import placement from '../../../docs/brainstorms/2026-09-11-hero-placement-v1.json'
import { HERO_PLACEMENTS, heroPlacement } from '../content/hero-placement'
import { HEROES_V10, heroByIdV10 } from '../content/heroes'
import { createHeroProgress, createInitialStateV10 } from './state'
import { hydrateStateV10, exportSaveV10, importSaveV10 } from './save-v10'
import { recruitFromFaction } from './recruitment'
import { chapterPool, chapterSummoning, setSummoningTarget, summonHeroes, isHeroSummoning } from './hero-summoning'
import { redeemWelfareCode, ZHAO_YUN_ID } from './welfare-codes'

const setup = () => {
  const state = createInitialStateV10(1_800_000_000_000)
  state.idleVouchers.balance = 1_000_000
  setSummoningTarget(state, 'world_01', 'hero_orig_12')
  return state
}
describe('投放名单和兼容性', () => {
  it('逐人保持已确认名单，131章节角色70兑换61入池，储备不误上架', () => {
    expect(HERO_PLACEMENTS).toHaveLength(223)
    expect(new Set(HERO_PLACEMENTS.map(row => row.id)).size).toBe(223)
    for (const row of placement.original) {
      const id = row.sourceId === 1 ? 'hero_player' : `hero_orig_${row.sourceId}`
      expect(heroPlacement(id)).toMatchObject({ name: row.name, tier: row.tier.replace('（版本待核）', ''), route: row.sourceId === 165 ? '福利码' : row.primaryRoute })
    }
    for (const row of placement.tavern) expect(heroPlacement(row.id)).toMatchObject({ name: row.name, tier: '基础', route: '酒馆定向购买' })
    const live = HEROES_V10.map(hero => heroPlacement(hero.id)!)
    expect(live.filter(row => row.route === '章节兑换')).toHaveLength(70)
    expect(live.filter(row => row.route === '章节池')).toHaveLength(61)
    expect(live.filter(row => row.route === '章节兑换' && row.tier === '名侠')).toHaveLength(6)
    expect(live.every(Boolean)).toBe(true)
    for (let chapter = 1; chapter <= 13; chapter++) {
      const pool = chapterPool(`world_${String(chapter).padStart(2, '0')}`)
      expect(pool.some(hero => heroPlacement(hero.id)?.tier === '名侠')).toBe(true)
      expect(pool.some(hero => heroPlacement(hero.id)?.tier === '传奇')).toBe(true)
    }
  })
  it('关闭所有池角色的旧兑换入口，同时保留70人兑换', () => {
    for (const hero of HEROES_V10.filter(hero => hero.source === 'faction')) {
      const state = setup()
      state.unlockedWorldIds.push(hero.worldId)
      state.worldReputation[hero.worldId] = 1e15
      state.worldCurrency[hero.worldId] = 1e15
      state.contribution[hero.factionId!] = 1e15
      expect(recruitFromFaction(state, hero.factionId!, hero.id).ok).toBe(heroPlacement(hero.id)?.route === '章节兑换')
    }
  })
  it('补齐缺少字段的v19档，保存往返保留已有传奇、培养、阵容和领取记录', () => {
    const state = setup()
    state.heroes.hero_orig_9 = createHeroProgress('job_1')
    state.heroes.hero_orig_9.level = 37
    state.formation = [{ heroId: 'hero_orig_9', row: 0, col: 0 }]
    const old = JSON.parse(exportSaveV10(state))
    delete old.heroSummoning
    delete old.redeemedWelfareCodes
    const loaded = hydrateStateV10(old)
    expect(loaded.heroSummoning).toEqual({ chapters: {} })
    expect(loaded.heroes.hero_orig_9).toEqual(state.heroes.hero_orig_9)
    expect(loaded.formation).toEqual(state.formation)
    expect(redeemWelfareCode(loaded, '花花蛋无敌').ok).toBe(true)
    const restored = importSaveV10(exportSaveV10(loaded)).state
    expect(restored.heroes[ZHAO_YUN_ID].recruited).toBe(true)
    expect(redeemWelfareCode(restored, '花花蛋无敌').ok).toBe(false)
  })
})
describe('抽池结算', () => {
  it('第70抽侠客、第280抽传奇、第560抽指定传奇；触发优先级及重置正确', () => {
    const state = setup()
    const draw = () => summonHeroes(state, 'world_01', 1, () => 0.99)
    for (let i = 1; i < 70; i++) draw()
    expect(state.heroes.hero_orig_5).toBeUndefined()
    expect(draw()).toMatchObject({ ok: true, rewards: [{ id: 'hero_orig_5', guarantee: '侠客保底' }] })
    // 选第一个传奇，避免提前抽到心愿诸葛亮。
    const miss = () => { let n = 0; return summonHeroes(state, 'world_01', 1, () => n++ === 0 ? 0.99 : 0) }
    for (let i = 71; i < 280; i++) miss()
    expect(miss()).toMatchObject({ ok: true, rewards: [{ id: 'hero_orig_8', guarantee: '传奇保底' }] })
    expect(chapterSummoning(state, 'world_01')).toMatchObject({ sinceHero: 0, sinceLegendary: 0, sinceTarget: 280 })
    for (let i = 281; i < 560; i++) miss()
    expect(miss()).toMatchObject({ ok: true, rewards: [{ id: 'hero_orig_12', guarantee: '心愿保障' }] })
    expect(chapterSummoning(state, 'world_01')).toMatchObject({ sinceHero: 0, sinceLegendary: 0, sinceTarget: 0 })
  })
  it('十连与逐次单抽等价，重复保留培养且只返还少量蛋蛋', () => {
    const a = setup(), b = setup()
    a.heroes.hero_orig_8 = createHeroProgress('job_1')
    a.heroes.hero_orig_8.level = 42
    b.heroes = structuredClone(a.heroes)
    summonHeroes(a, 'world_01', 10, () => 0)
    for (let i = 0; i < 10; i++) summonHeroes(b, 'world_01', 1, () => 0)
    expect(a).toEqual(b)
    expect(a.heroes.hero_orig_8.level).toBe(42)
    expect(a.idleVouchers.balance).toBe(1_000_000 - 1000 + 200)
  })
  it('自然概率边界、材料数量和名侠重复返还', () => {
    for (const [roll, kind, tier] of [[0.001999, 'hero', '传奇'], [0.002, 'hero', '名侠'], [0.011999, 'hero', '名侠'], [0.012, 'material', undefined]] as const) {
      const state = setup()
      const result = summonHeroes(state, 'world_01', 1, () => roll)
      expect(result).toMatchObject({ ok: true, rewards: [{ kind, ...(tier ? { tier } : { amount: 2 }) }] })
    }
    const state = setup()
    summonHeroes(state, 'world_01', 1, () => 0.005)
    expect(summonHeroes(state, 'world_01', 1, () => 0.005)).toMatchObject({ rewards: [{ duplicate: true, refund: 10 }] })
  })
  it('切章独立；同目标不重置，换目标仅重置心愿，进度随存档保留', () => {
    const state = setup()
    summonHeroes(state, 'world_01', 10, () => 0.99)
    setSummoningTarget(state, 'world_01', 'hero_orig_12')
    expect(chapterSummoning(state, 'world_01').sinceTarget).toBe(10)
    setSummoningTarget(state, 'world_01', 'hero_orig_9')
    expect(chapterSummoning(state, 'world_01')).toMatchObject({ sinceHero: 10, sinceLegendary: 10, sinceTarget: 0 })
    state.unlockedWorldIds.push('world_02')
    setSummoningTarget(state, 'world_02', 'hero_orig_15')
    summonHeroes(state, 'world_02', 1, () => 0.99)
    const restored = importSaveV10(exportSaveV10(state)).state
    expect(restored.heroSummoning).toEqual(state.heroSummoning)
    expect(chapterSummoning(restored, 'world_01').sinceHero).toBe(10)
  })
  it('未解锁、无目标、余额不足、非法输入不扣款也不推进保底', () => {
    const state = setup()
    const before = structuredClone(state)
    expect(summonHeroes(state, 'world_02', 1).ok).toBe(false)
    expect(setSummoningTarget(state, 'world_01', 'hero_orig_15').ok).toBe(false)
    expect(summonHeroes(state, 'world_01', 2).ok).toBe(false)
    expect(summonHeroes(state, 'world_01', 10, () => NaN).ok).toBe(false)
    expect(state).toEqual(before)
    state.idleVouchers.balance = 99
    expect(summonHeroes(state, 'world_01', 1).ok).toBe(false)
    expect(state.heroSummoning).toEqual(before.heroSummoning)
    state.idleVouchers.balance = 1000
    state.heroSummoning.chapters = {}
    expect(summonHeroes(state, 'world_01', 1).ok).toBe(false)
  })
  it('拒绝负数、越界和跨池心愿的损坏存档', () => {
    for (const fields of [{ sinceHero: -1 }, { sinceHero: 70 }, { sinceLegendary: 280 }, { sinceTarget: 560 }, { targetId: 'hero_orig_15' }, { sinceTarget: 1, targetId: null }]) {
      const state = setup()
      Object.assign(state.heroSummoning.chapters.world_01, fields)
      expect(isHeroSummoning(state.heroSummoning)).toBe(false)
      expect(() => hydrateStateV10(state)).toThrow()
    }
  })
})
it('福利码仅发赵云，无效、重复或已拥有不覆盖培养、不额外发物品', () => {
  const state = setup(), before = structuredClone(state)
  expect(redeemWelfareCode(state, '花花蛋无敌呀').ok).toBe(false)
  expect(state).toEqual(before)
  expect(redeemWelfareCode(state, ' 花花蛋无敌 ').ok).toBe(true)
  expect(heroByIdV10(ZHAO_YUN_ID)?.aptitudes).toEqual({ strength: 71, insight: 33, constitution: 47, agility: 73, resolve: 27 })
  state.heroes[ZHAO_YUN_ID].level = 30
  expect(redeemWelfareCode(state, '花花蛋无敌').ok).toBe(false)
  state.redeemedWelfareCodes = []
  expect(redeemWelfareCode(state, '花花蛋无敌').ok).toBe(false)
  expect(state.heroes[ZHAO_YUN_ID].level).toBe(30)
  expect(state.materials).toEqual(before.materials)
  expect(state.idleVouchers.balance).toBe(before.idleVouchers.balance)
})
