import { describe, expect, it } from 'vitest'
import { createCombatEngine } from './engine'
import { advanceToNextWave, createWave, isWaveCleared } from './waves'
import type { CombatStartInput, CombatSummon, CombatUnit } from './types'
import { panelToAttributeMap } from './stats'

const partyUnit = (overrides: Partial<CombatUnit> = {}): CombatUnit => {
  const merged: CombatUnit = {
    id: 'hero_strong',
    name: '强力侠客',
    careerId: 'job_1',
    side: 'party',
    row: 1,
    col: 0,
    formationOrder: 5,
    rank: 'normal',
    alive: true,
    hp: 5000,
    maxHp: 5000,
    shield: 0,
    energy: 0,
    maxEnergy: 5,
    gauge: 0,
    effectiveAgility: 2500,
    externalAttack: 5000,
    internalAttack: 1000,
    externalDefense: 1000,
    internalDefense: 1000,
    accuracy: 1,
    evade: 0.7,
    criticalChance: 0,
    criticalMultiplier: 1.5,
    controlResistance: 0.5,
    cooldowns: {},
    statuses: [],
    skillIds: [],
    baseAttackId: 1,
    attributes: {},
    ...overrides,
  }
  merged.attributes = panelToAttributeMap({
    maxHp: merged.maxHp,
    effectiveAgility: merged.effectiveAgility,
    externalAttack: merged.externalAttack,
    externalDefense: merged.externalDefense,
    internalAttack: merged.internalAttack,
    internalDefense: merged.internalDefense,
    accuracy: merged.accuracy,
    evade: merged.evade,
    criticalChance: merged.criticalChance,
    criticalMultiplier: merged.criticalMultiplier,
    controlResistance: merged.controlResistance,
    initialEnergy: merged.energy,
    energyRecovery: 1,
    cooldownRate: 0,
    lifeSteal: 0,
  })
  return merged
}

describe('十波战斗', () => {
  it('每个小关的第十波都含 Boss、精英和小怪', () => {
    for (let stage = 1; stage <= 10; stage += 1) {
      const wave = createWave('world_01', stage, 10, 1000 + stage)
      expect(wave.enemies.some((enemy) => enemy.rank === 'boss')).toBe(true)
      expect(wave.enemies.some((enemy) => enemy.rank === 'elite')).toBe(true)
      expect(wave.enemies.some((enemy) => enemy.rank === 'normal')).toBe(true)
    }
  })

  it('换波继承气血、阵亡、能量、气机、回气和状态', () => {
    const party = [partyUnit({
      hp: 71,
      energy: 2,
      gauge: 600,
      cooldowns: { 1: 2800 },
      statuses: [{ buffId: 11, stacks: 1, remainingMs: 4300 }],
    })]
    const summon = partyUnit({ id: 'summon_1_0', side: 'party' }) as CombatSummon
    summon.remainingMs = 5000
    const state = {
      seed: 7,
      worldId: 'world_01',
      difficulty: 1,
      stage: 1,
      mode: 'guard' as const,
      wave: 3,
      elapsedMs: 4000,
      result: 'fighting' as const,
      party,
      enemies: createWave('world_01', 1, 3, 7).enemies.map((enemy) => ({ ...enemy, alive: false, hp: 0 })),
      summons: [summon],
    }

    advanceToNextWave(state)

    expect(state.wave).toBe(4)
    expect(state.party[0]).toMatchObject({
      hp: 71,
      alive: true,
      energy: 2,
      gauge: 600,
      cooldowns: { 1: 2800 },
    })
    expect(state.party[0].statuses[0].remainingMs).toBe(4300)
    expect(state.summons[0].remainingMs).toBe(5000)
  })

  it('同 seed 的十波事件序列完全一致', () => {
    const input: CombatStartInput = { worldId: 'world_01', stage: 1, mode: 'guard', seed: 42, party: [partyUnit()] }
    const run = () => {
      const engine = createCombatEngine(input)
      const events = engine.tick(2000)
      return { events, result: engine.state.result, wave: engine.state.wave }
    }

    expect(run()).toEqual(run())
    expect(run()).toMatchObject({ result: 'victory', wave: 10 })
  })

  it('只击败 Boss 但仍有其余敌人时不能通关', () => {
    const wave = createWave('world_01', 1, 10, 7)
    const boss = wave.enemies.find((enemy) => enemy.rank === 'boss')!
    boss.alive = false
    boss.hp = 0

    expect(isWaveCleared(wave.enemies)).toBe(false)
  })

  it('伤害事件携带准确的会心标记供战斗表现使用', () => {
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 17,
      party: [partyUnit({ criticalChance: 1 })],
    })

    const damage = engine.tick(20).find((event) => event.type === 'damage' && event.sourceId === 'hero_strong')

    expect(damage).toMatchObject({ type: 'damage', critical: true })
  })

  it('吸血：伤害后按 sx14/100 回复攻击方（原版 c3runtime 56015）', () => {
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 3,
      party: [partyUnit({ id: 'vamp', hp: 100, maxHp: 10_000, externalAttack: 5000, criticalChance: 0 })],
    })
    engine.state.party[0].attributes[14] = 100
    const actor = engine.state.party[0]
    const damage = engine.tick(50).find((event) => event.type === 'damage' && event.sourceId === 'vamp') as
      | { amount: number }
      | undefined
    expect(damage).toBeDefined()
    if (damage) {
      expect(actor.hp).toBeGreaterThan(100)
      expect(actor.hp).toBeLessThanOrEqual(actor.maxHp)
    }
  })

  it('张角攒满 5 能量后释放战场庇护', () => {
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 11,
      party: [partyUnit()],
    })
    const bossWave = createWave('world_01', 1, 10, 11)
    engine.state.wave = 10
    engine.state.enemies = bossWave.enemies
    const boss = engine.state.enemies.find((enemy) => enemy.rank === 'boss')!
    boss.energy = 4
    boss.gauge = 1000
    boss.effectiveAgility = 1
    engine.state.party[0].gauge = 0
    engine.state.party[0].effectiveAgility = 1

    const used = engine.tick(5).filter((event) => event.type === 'skill-used' && event.sourceId === boss.id)
    expect(used.some((event) => event.type === 'skill-used' && event.skillId === 47)).toBe(true)
  })

  it('护盾先于气血吸收伤害', () => {
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 5,
      party: [partyUnit({
        hp: 500,
        maxHp: 500,
        shield: 10_000,
        evade: 0,
        effectiveAgility: 1,
        externalAttack: 1,
        internalAttack: 1,
      })],
    })
    engine.state.party[0].gauge = 0
    engine.state.enemies[0].gauge = 1000
    const beforeHp = engine.state.party[0].hp
    engine.tick(5)
    expect(engine.state.party[0].hp).toBe(beforeHp)
    expect(engine.state.party[0].shield).toBeLessThan(10_000)
  })
})
