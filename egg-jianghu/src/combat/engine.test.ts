import { describe, expect, it } from 'vitest'
import { createCombatEngine as createRawCombatEngine } from './engine'
import { advanceToNextWave, createWave, isWaveCleared } from './waves'
import type { CombatStartInput, CombatSummon, CombatUnit } from './types'
import { panelToAttributeMap } from './stats'
import { createActionPlan, createCombatTimeline } from './scheduler'
import { SX } from './attribute-ids'
import { applyBuff, dealCombatDamage, pulseStatuses, unitAttr } from './statuses'

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

/** 既有单元测试聚焦战斗内规则；统一越过新增的原版首波 1.5 秒启动门。 */
const createCombatEngine = (input: CombatStartInput) => {
  const engine = createRawCombatEngine(input)
  engine.advance(1500)
  engine.state.elapsedMs = 0
  return engine
}

const summonOnce = (
  skillId: number,
  actorOverrides: Partial<CombatUnit> = {},
  actorAttributes: Record<number, number> = {},
) => {
  const actor = partyUnit({ skillIds: [skillId], energy: 5, gauge: 1000, ...actorOverrides })
  Object.assign(actor.attributes, actorAttributes)
  const engine = createCombatEngine({
    worldId: 'world_01',
    stage: 1,
    mode: 'guard',
    seed: 73,
    party: [actor],
  })
  engine.state.enemies = [engine.state.enemies[0]]
  engine.state.enemies[0].gauge = 0
  engine.tick(4)
  const summon = engine.state.summons[0]
  if (!summon) throw new Error(`技能 ${skillId} 未生成召唤物`)
  return { engine, summon }
}

describe('十波战斗', () => {
  it('首波按原版先等待 1 秒显示敌人，再等待 0.5 秒开始积攒', () => {
    const engine = createRawCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 7,
      party: [partyUnit()],
    })

    expect(engine.state.timeline).toMatchObject({
      phase: 'wave-transition',
      waveTransition: { kind: 'initial', elapsedMs: 0, refreshed: false },
    })
    expect(engine.advance(999).some((event) => event.type === 'wave-started')).toBe(false)
    expect(engine.state.party[0].gauge).toBe(0)

    expect(engine.advance(1)).toContainEqual({ type: 'wave-started', wave: 1, atMs: 1000 })
    expect(engine.state.timeline).toMatchObject({
      phase: 'wave-transition',
      waveTransition: { kind: 'initial', refreshed: true },
    })
    engine.advance(499)
    expect(engine.state.timeline.phase).toBe('wave-transition')
    expect(engine.state.party[0].gauge).toBe(0)

    engine.advance(1)
    expect(engine.state.timeline).toMatchObject({ phase: 'accumulating', waveTransition: null })
    expect(engine.state.elapsedMs).toBe(1500)
    expect(engine.state.party[0].gauge).toBe(0)
  })

  it('每个小关的第十波都使用六人首领阵型，且恰有一个首领', () => {
    for (let stage = 1; stage <= 10; stage += 1) {
      const wave = createWave('world_01', stage, 10, 1000 + stage)
      expect(wave.enemies).toHaveLength(6)
      expect(wave.enemies.filter((enemy) => enemy.rank === 'boss')).toHaveLength(1)
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
    summon.summonerId = party[0].id
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
      timeline: createCombatTimeline(),
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

  it('闯荡最终胜利从行动结束的阵亡检查起等待 0.8 秒', () => {
    const engine = createCombatEngine({
      worldId: 'world_01', stage: 1, mode: 'roam', seed: 19, party: [partyUnit()],
    })
    const actor = engine.state.party[0]
    const enemy = engine.state.enemies[0]
    engine.state.wave = 10
    engine.state.enemies = [enemy]
    enemy.hp = enemy.maxHp = 1
    enemy.attributes[SX.闪避修正] = 0
    actor.attributes[SX.命中修正] = 10_000
    engine.state.timeline.phase = 'acting'
    engine.state.timeline.activeAction = createActionPlan(actor.id, actor.baseAttackId, [enemy.id])

    const lethalEvents = engine.advance(300)
    expect(lethalEvents.some((event) => event.type === 'stage-cleared')).toBe(false)
    expect(engine.state).toMatchObject({ result: 'fighting' })
    expect(enemy).toMatchObject({ hp: 0, alive: true })
    expect(engine.state.timeline.endingTransition).toBeNull()
    expect(engine.advance(900)).toContainEqual(expect.objectContaining({ type: 'unit-defeated', atMs: 1200 }))
    expect(engine.state.timeline).toMatchObject({
      phase: 'ending',
      endingTransition: { outcome: 'victory', elapsedMs: 0, durationMs: 800 },
    })
    expect(engine.advance(799).some((event) => event.type === 'stage-cleared')).toBe(false)
    expect(engine.state.result).toBe('fighting')

    expect(engine.advance(1)).toContainEqual({ type: 'stage-cleared', atMs: 2000 })
    expect(engine.state.result).toBe('victory')
    expect(engine.state.timeline.activeAction).toBeNull()
  })

  it('驻守最终胜利在行动结束后等待 1 秒打开结算', () => {
    const engine = createCombatEngine({
      worldId: 'world_01', stage: 1, mode: 'guard', seed: 23, party: [partyUnit()],
    })
    const actor = engine.state.party[0]
    const enemy = engine.state.enemies[0]
    engine.state.wave = 10
    engine.state.enemies = [enemy]
    enemy.hp = enemy.maxHp = 1
    enemy.attributes[SX.闪避修正] = 0
    actor.attributes[SX.命中修正] = 10_000
    engine.state.timeline.phase = 'acting'
    engine.state.timeline.activeAction = createActionPlan(actor.id, actor.baseAttackId, [enemy.id])

    engine.advance(300)
    engine.advance(900)
    expect(engine.state.result).toBe('fighting')
    expect(engine.state.timeline.activeAction).toBeNull()
    expect(engine.advance(999).some((event) => event.type === 'stage-cleared')).toBe(false)
    expect(engine.advance(1)).toContainEqual({ type: 'stage-cleared', atMs: 2200 })
    expect(engine.state.result).toBe('victory')
  })

  it('我方团灭等待 1 秒后才发出失败事件', () => {
    const engine = createCombatEngine({
      worldId: 'world_01', stage: 1, mode: 'guard', seed: 29, party: [partyUnit()],
    })
    const hero = engine.state.party[0]
    hero.hp = 0
    hero.alive = false

    const lethalEvents = engine.advance(100)
    expect(lethalEvents.some((event) => event.type === 'party-defeated')).toBe(false)
    expect(engine.state.timeline).toMatchObject({
      phase: 'ending',
      endingTransition: { outcome: 'defeat', elapsedMs: 0, durationMs: 1000 },
    })
    expect(engine.advance(999).some((event) => event.type === 'party-defeated')).toBe(false)
    expect(engine.state.result).toBe('fighting')
    expect(engine.advance(1)).toContainEqual({ type: 'party-defeated', atMs: 1100 })
    expect(engine.state.result).toBe('defeat')
  })

  it('伤害结算应用人物职业物攻系数，敌人无职业系数时按 1', () => {
    const firstDamage = (physicalAttack: number): number => {
      const engine = createCombatEngine({
        worldId: 'world_01',
        stage: 1,
        mode: 'guard',
        seed: 19,
        party: [partyUnit({
          careerCoefficients: {
            physicalAttack,
            physicalDefense: 1,
            magicAttack: 1,
            magicDefense: 1,
            heal: 1,
          },
        })],
      })
      const damage = engine.tick(50).find((event) => event.type === 'damage' && event.sourceId === 'hero_strong')
      return damage?.type === 'damage' ? damage.amount : 0
    }

    expect(firstDamage(2)).toBeGreaterThan(firstDamage(1))
  })

  it('法术治疗以法攻为基础并应用职业编码 6，持续恢复锁定原版每秒值', () => {
    const healer = partyUnit({
      id: 'healer',
      name: '医者',
      hp: 2000,
      maxHp: 2000,
      gauge: 1000,
      energy: 1,
      skillIds: [166],
      careerCoefficients: {
        physicalAttack: 1,
        physicalDefense: 1,
        magicAttack: 1,
        magicDefense: 1,
        heal: 2,
      },
    })
    const target = partyUnit({
      id: 'patient',
      name: '伤员',
      hp: 100,
      maxHp: 10_000,
      gauge: 0,
      effectiveAgility: 1,
      formationOrder: 6,
    })
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 27,
      party: [healer, target],
    })
    engine.state.enemies.forEach((enemy) => { enemy.gauge = 0 })

    const events = engine.tick(10)
    const healing = events.find((event) => event.type === 'healing' && event.sourceId === 'healer')

    // 回春术 I 初始化系数 55%；法攻 1000 × 职业治疗系数 2 × 55%。
    expect(healing).toMatchObject({ type: 'healing', amount: 1100 })
    expect(engine.state.party[1].statuses).toHaveLength(0)
    engine.tick(1) // 起手100ms + 原版buff等待1000ms。
    expect(engine.state.party[1].statuses[0]).toMatchObject({ buffId: 6, tickValue: 22 })
  })

  it('回合 buff 在行动开始前递减，而不是行动结束后递减', () => {
    const actor = partyUnit({
      gauge: 1000,
      statuses: [{ buffId: 1, stacks: 1, remainingMs: Number.MAX_SAFE_INTEGER, remainingTurns: 1 }],
    })
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 29,
      party: [actor],
    })
    engine.state.enemies.forEach((enemy) => { enemy.gauge = 0 })

    engine.tick(1)

    expect(engine.state.party[0].statuses).toEqual([])
    expect(engine.state.timeline.phase).toBe('acting')
  })

  it('多名角色阵亡时起死回生复活最大阵位，保留其他阵亡角色', () => {
    const healer = partyUnit({ id: 'reviver', row: 0, col: 0, formationOrder: 0, gauge: 1000, energy: 4, skillIds: [64] })
    const first = partyUnit({ id: 'first', row: 0, col: 1, formationOrder: 1, alive: false, hp: 0, maxHp: 1000 })
    const last = partyUnit({ id: 'last', row: 2, col: 4, formationOrder: 14, alive: false, hp: 0, maxHp: 2000 })
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 31, party: [last, healer, first] })
    engine.state.enemies.forEach(enemy => { enemy.gauge = 0 })
    const events = engine.tick(10)
    expect(events).toContainEqual(expect.objectContaining({ type: 'unit-revived', targetId: 'last' }))
    expect(engine.state.party.find(unit => unit.id === 'last')).toMatchObject({ alive: true, hp: 400 })
    expect(engine.state.party.find(unit => unit.id === 'first')).toMatchObject({ alive: false, hp: 0 })
  })

  it('起死回生按 jn[23] 的 20% 复活，并重新生成战斗临时状态', () => {
    const healer = partyUnit({
      id: 'reviver',
      instanceOrder: 2,
      gauge: 1000,
      energy: 4,
      skillIds: [64],
    })
    const target = partyUnit({
      id: 'fallen',
      instanceOrder: 1,
      hp: 0,
      maxHp: 1000,
      alive: false,
      shield: 500,
      energy: 3,
      gauge: 900,
      cooldowns: { 1: 2000 },
      statuses: [{ buffId: 11, stacks: 1, remainingMs: 5000 }],
      formationOrder: 6,
    })
    target.attributes[SX.初始能量] = 0
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 31,
      party: [healer, target],
    })
    engine.state.enemies.forEach((enemy) => { enemy.gauge = 0 })

    const events = engine.tick(10)

    expect(events).toContainEqual(expect.objectContaining({ type: 'unit-revived', sourceId: 'reviver', targetId: 'fallen' }))
    expect(engine.state.party[1].instanceOrder).toBe(3)
    expect(engine.state.party[1]).toMatchObject({
      alive: true,
      hp: 200,
      shield: 0,
      energy: 0,
      gauge: 0,
      cooldowns: {},
      statuses: [],
    })
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

  it('张角按原版 jnz 技能组释放火扇并消耗3能量', () => {
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
    boss.energy = 3
    boss.gauge = 1000
    boss.effectiveAgility = 1
    engine.state.party[0].gauge = 0
    engine.state.party[0].effectiveAgility = 1

    const used = engine.tick(5).filter((event) => event.type === 'skill-used' && event.sourceId === boss.id)
    expect(used.some((event) => event.type === 'skill-used' && event.skillId === 93)).toBe(true)
    expect(boss.energy).toBe(1) // 行动回能1，再支付3。
  })

  it('清心施法立即清除自身一种减益，300ms不重复清除', () => {
    const actor = partyUnit({ skillIds: [61], energy: 5, gauge: 1000, effectiveAgility: 1, statuses: [
      { buffId: 4, stacks: 3, remainingMs: 15000, sourceId: 'foe' },
      { buffId: 5, stacks: 2, remainingMs: 15000, sourceId: 'foe' },
      { buffId: 7, stacks: 1, remainingMs: 20000, sourceId: 'self' },
    ] })
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 11, party: [actor] })
    engine.state.enemies.forEach(enemy => { enemy.gauge = 0; enemy.effectiveAgility = 1 })
    engine.advance(100)
    const ids = engine.state.party[0].statuses.map(status => status.buffId)
    expect(ids).toContain(7)
    expect(ids.filter(id => id === 4 || id === 5)).toHaveLength(1)
    engine.advance(300)
    expect(engine.state.party[0].statuses.map(status => status.buffId)).toEqual(ids)
  })

  it.each([64, 72])('特殊技能%i在施法瞬间生效，300ms不重复生成', (skillId) => {
    const actor = partyUnit({ id: 'caster', row: 0, col: 0, formationOrder: 0, skillIds: [skillId], energy: 5, gauge: 1000 })
    const fallen = partyUnit({ id: 'fallen', row: 0, col: 1, formationOrder: 1, alive: false, hp: 0, maxHp: 1000 })
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 73, party: [actor, fallen] })
    engine.state.enemies.forEach(enemy => { enemy.gauge = 0 })
    const events = engine.advance(100)
    const eventType = skillId === 64 ? 'unit-revived' : 'summoned'
    expect(events.filter(event => event.type === eventType)).toHaveLength(1)
    expect(events.find(event => event.type === eventType)?.atMs).toBe(100)
    expect(engine.state.timeline.activeAction?.elapsedMs).toBe(0)
    expect(engine.advance(300).filter(event => event.type === eventType)).toEqual([])
  })

  it('冷却在行动结束才写入，最高缩减保留原版5%冷却', () => {
    const actor = partyUnit({ skillIds: [87], energy: 5, gauge: 1000, effectiveAgility: 1, externalAttack: 1 })
    actor.attributes[SX.技能冷却] = 200
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 11, party: [actor] })
    engine.state.enemies.forEach(enemy => { enemy.gauge = 0; enemy.effectiveAgility = 1 })
    engine.advance(100)
    expect(engine.state.timeline.activeAction?.skillId).toBe(87)
    engine.advance(1100)
    expect(engine.state.party[0].cooldowns[87] ?? 0).toBe(0)
    engine.advance(100)
    expect(engine.state.party[0].cooldowns[87]).toBe(600)
  })

  it('群体护盾上限使用施法者超限属性', () => {
    const actor = partyUnit({ skillIds: [156], energy: 5, gauge: 1000, internalAttack: 100000, effectiveAgility: 1 })
    actor.attributes[SX.护盾超限] = 100
    const ally = partyUnit({ id: 'protected', hp: 100, maxHp: 100, row: 0, col: 1, effectiveAgility: 1 })
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 11, party: [actor, ally] })
    engine.state.enemies.forEach(enemy => { enemy.gauge = 0; enemy.effectiveAgility = 1 })
    engine.tick(4)
    expect(engine.state.party[1].shield).toBe(200)
  })

  it('不屈重复施加保留首次恢复快照，普通恢复采用较强快照', () => {
    const actor = partyUnit()
    for (const id of [6, 47]) {
      applyBuff(actor, id, 1, actor.id, { tickValue: 10 })
      applyBuff(actor, id, 1, actor.id, { tickValue: 100 })
    }
    expect(actor.statuses.find(s => s.buffId === 47)?.tickValue).toBe(10)
    expect(actor.statuses.find(s => s.buffId === 6)?.tickValue).toBe(100)
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
    // 敌方远程普攻还需经过飞行，再检查护盾结算。
    engine.tick(13)
    expect(engine.state.party[0].hp).toBe(beforeHp)
    expect(engine.state.party[0].shield).toBeLessThan(10_000)
  })
})

describe('原版单行动调度', () => {
  it('我方回能和选技等100ms起手，敌方不附加该等待', () => {
    const actor = partyUnit({ energy: 0, gauge: 1000 })
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 12, party: [actor] })
    expect(engine.advance(99).some(event => event.type === 'skill-used')).toBe(false)
    expect(engine.state.timeline.phase).toBe('preparing')
    expect(engine.state.party[0].energy).toBe(0)
    expect(engine.advance(1)).toContainEqual(expect.objectContaining({ type: 'skill-used', sourceId: actor.id, atMs: 100 }))
    expect(engine.state.party[0].energy).toBe(1)

    const enemyFirst = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 12, party: [partyUnit()] })
    enemyFirst.state.enemies[0].gauge = 1000
    expect(enemyFirst.advance(1)).toContainEqual(expect.objectContaining({ type: 'skill-used', sourceId: enemyFirst.state.enemies[0].id, atMs: 0 }))
    expect(enemyFirst.state.timeline.pendingAction).toBeUndefined()
  })

  it('不足100ms也积分，满条的连续时间边界另加我方起手等待', () => {
    const actor = partyUnit({ effectiveAgility: 10000, gauge: 900 })
    actor.attributes = {}
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 12, party: [actor] })
    engine.advance(49)
    expect(engine.state.party[0].gauge).toBeCloseTo(998, 10)
    engine.advance(1)
    expect(engine.state.timeline.phase).toBe('preparing')
    expect(engine.state.party[0].gauge).toBe(0)
    expect(engine.advance(99).some(event => event.type === 'skill-used')).toBe(false)
    expect(engine.advance(1)).toContainEqual(expect.objectContaining({ type: 'skill-used', sourceId: actor.id, atMs: 150 }))
  })

  const readyDuel = () => {
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 23,
      party: [partyUnit({ externalAttack: 1, internalAttack: 1, effectiveAgility: 1 })],
    })
    engine.state.enemies = [engine.state.enemies[0]]
    engine.state.enemies[0].hp = 1_000_000
    engine.state.enemies[0].maxHp = 1_000_000
    engine.state.party[0].gauge = 1000
    engine.state.enemies[0].gauge = 1000
    return engine
  }

  it('同一积攒节点只启动一个行动，其余满条单位按 readySeq 排队', () => {
    const engine = readyDuel()
    const events = engine.tick(1)

    expect(events.filter((event) => event.type === 'skill-used')).toHaveLength(1)
    expect(events.some((event) => event.type === 'damage')).toBe(false)
    expect(engine.state.timeline.phase).toBe('acting')
    expect(engine.state.timeline.activeAction?.actorId).toBe(engine.state.party[0].id)
    expect(engine.state.timeline.readyQueue).toEqual([
      { actorId: engine.state.enemies[0].id, readySeq: 2 },
    ])
  })

  it('技能提示、主特效与命中按原版节点依次发生', () => {
    const engine = readyDuel()
    const started = engine.tick(1)
    const beforeEffect = engine.tick(1)
    const atEffect = engine.tick(1)
    const atHit = engine.tick(1)

    expect(started.find((event) => event.type === 'skill-used')?.atMs).toBe(100)
    expect(beforeEffect).toEqual([])
    expect(atEffect.find((event) => event.type === 'skill-effect')?.atMs).toBe(300)
    expect(atEffect.some((event) => event.type === 'damage')).toBe(false)
    expect(atHit.find((event) => event.type === 'damage')?.atMs).toBe(400)
  })

  it('jn 分段数只控制表现，单个目标在碰撞节点只结算一次伤害', () => {
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 29,
      party: [partyUnit({ skillIds: [42], effectiveAgility: 1 })],
    })
    engine.state.enemies = [engine.state.enemies[0]]
    engine.state.enemies[0].hp = 1_000_000
    engine.state.enemies[0].maxHp = 1_000_000
    engine.state.enemies[0].gauge = 0
    engine.state.party[0].gauge = 1000
    engine.state.party[0].attributes[SX.命中修正] = 10_000
    engine.state.enemies[0].attributes[SX.闪避修正] = 0

    const events = engine.tick(4)

    expect(events).toContainEqual(expect.objectContaining({ type: 'skill-used', skillId: 42 }))
    expect(events.filter((event) => event.type === 'damage' && event.sourceId === 'hero_strong')).toHaveLength(1)
  })

  it('行动锁期间冻结其他单位的行动值、CD、状态和召唤时间', () => {
    const engine = readyDuel()
    const waiting = engine.state.enemies[0]
    waiting.cooldowns[1] = 2000
    waiting.statuses = [{ buffId: 11, stacks: 1, remainingMs: 4000 }]
    const summon = partyUnit({ id: 'summon_freeze', side: 'party' }) as CombatSummon
    summon.summonerId = engine.state.party[0].id
    summon.remainingMs = 5000
    engine.state.summons.push(summon)

    engine.tick(1)
    const frozen = {
      gauge: waiting.gauge,
      cooldown: waiting.cooldowns[1],
      status: waiting.statuses[0].remainingMs,
      summon: summon.remainingMs,
    }
    engine.tick(5)

    expect({
      gauge: waiting.gauge,
      cooldown: waiting.cooldowns[1],
      status: waiting.statuses[0].remainingMs,
      summon: summon.remainingMs,
    }).toEqual(frozen)
  })

  it('召唤系数先保留两位小数，双攻取法攻，六维乘积保留原版精度', () => {
    const { summon } = summonOnce(72, {
      maxHp: 101,
      hp: 101,
      externalAttack: 10001,
      externalDefense: 101,
      internalAttack: 101,
      internalDefense: 101,
      effectiveAgility: 101,
    }, {
      [SX.召唤强度]: 13.37,
    })

    const expected = { maxHp: 148, hp: 148, externalAttack: 79.79,
      externalDefense: 111.1, internalAttack: 79.79, internalDefense: 101, effectiveAgility: 116.15 }
    for (const [key, value] of Object.entries(expected)) expect(summon[key as keyof typeof expected]).toBeCloseTo(value, 8)
    expect(summon.attributes[SX.生命]).toBeCloseTo(148.47, 8)
  })

  it('召唤核心读取当前永久生命强度时间，战斗数组仍读取主人本场属性', () => {
    const actor = partyUnit({ id: 'caster', maxHp: 101, hp: 101, gauge: 1000, energy: 5, skillIds: [72] })
    actor.attributes[SX.召唤强度] = 13.37
    actor.attributes[SX.召唤时间] = 25
    actor.attributes[SX.初始能量] = 5
    const engine = createRawCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 73, party: [actor] }, unit => ({
      ...unit,
      attributes: { ...unit.attributes, [SX.生命]: 201, [SX.召唤强度]: 20, [SX.召唤时间]: 50 },
    }))
    engine.advance(1500)
    engine.state.enemies.forEach(enemy => { enemy.gauge = 0 })
    engine.advance(100)
    expect(engine.state.summons[0]).toMatchObject({ maxHp: 314, hp: 314, remainingMs: 45000, energy: 0 })
    expect(engine.state.summons[0].attributes[SX.生命]).toBeCloseTo(148.47, 8)
    expect(engine.state.summons[0].attributes[SX.初始能量]).toBe(5)
    expect(engine.state.party[0].maxHp).toBe(101)
  })

  it('召唤物获得与到期移除状态时重读主人属性，保留当前生命而不重新召唤', () => {
    const { engine, summon } = summonOnce(72, { maxHp: 101, hp: 101, internalAttack: 101 })
    const owner = engine.state.party[0]
    const summonId = summon.id
    const originalHp = summon.hp
    owner.attributes[SX.生命] = 201
    owner.attributes[SX.法攻] = 202
    expect(summon.attributes[SX.生命]).toBeCloseTo(131.3, 8)
    engine.state.timeline = createCombatTimeline()
    for (const unit of [...engine.state.party, ...engine.state.enemies]) unit.gauge = 0
    summon.skillIds = [105]
    summon.energy = 5
    summon.gauge = 1000
    const events = engine.advance(1100)
    expect(events).toContainEqual(expect.objectContaining({ type: 'status-applied', targetId: summonId, buffId: 7 }))
    expect(summon.maxHp).toBeCloseTo(261.3, 8)
    expect(summon.hp).toBe(originalHp)
    expect(summon.attributes[SX.法攻]).toBeCloseTo(141.4, 8)
    expect(summon.id).toBe(summonId)
    const energy = summon.energy
    const remainingMs = summon.remainingMs
    owner.attributes[SX.生命] = 51
    summon.statuses.find(status => status.buffId === 7)!.remainingMs = 100
    engine.state.timeline = createCombatTimeline()
    summon.gauge = 0
    engine.advance(100)
    expect(summon.statuses.some(status => status.buffId === 7)).toBe(false)
    expect(summon.maxHp).toBeCloseTo(66.3, 8)
    expect(summon.hp).toBeCloseTo(66.3, 8)
    expect(summon.energy).toBe(energy)
    expect(summon.remainingMs).toBe(remainingMs - 100)
    expect(engine.state.summons).toHaveLength(1)
  })

  it('主人阵亡后召唤刷新读取保留的战斗数组，包含阵亡时的状态属性', () => {
    const { engine, summon } = summonOnce(72)
    const owner = engine.state.party[0]
    engine.state.party.push(partyUnit({ id: 'survivor', row: 2, col: 4, gauge: 0 }))
    applyBuff(owner, 7, 1, owner.id)
    applyBuff(owner, 5, 1, 'enemy', { tickValue: 10000 })
    owner.hp = 1
    engine.state.timeline = createCombatTimeline()
    engine.state.timeline.lastStatusPulseAtMs = engine.state.elapsedMs - 900
    for (const unit of [...engine.state.party, ...engine.state.enemies, summon]) unit.gauge = 0
    engine.advance(100)
    expect(owner.alive).toBe(false)
    expect(owner.statuses).toEqual([])
    expect(owner.defeatedAttributes?.[114]).toBe(20)
    summon.skillIds = [105]
    summon.energy = 5
    summon.gauge = 1000
    engine.advance(1100)
    expect(summon.attributes[114]).toBe(20)
    expect(unitAttr(summon, 114)).toBe(40)
  })

  it('倒计时按阵位处理，前排召唤物刷新时仍读取后排主人尚未到期的状态', () => {
    const { engine, summon } = summonOnce(72)
    const owner = engine.state.party[0]
    expect(summon.row * 5 + summon.col).toBeLessThan(owner.row * 5 + owner.col)
    applyBuff(owner, 7, 1, owner.id)
    applyBuff(summon, 8, 1, 'enemy')
    owner.statuses[0].remainingMs = 100
    summon.statuses[0].remainingMs = 100
    engine.state.timeline = createCombatTimeline()
    for (const unit of [...engine.state.party, ...engine.state.enemies, summon]) unit.gauge = 0
    engine.advance(100)
    expect(owner.statuses).toEqual([])
    expect(summon.statuses).toEqual([])
    expect(summon.attributes[114]).toBe(20)
  })

  it('召唤物普攻继承召唤技能有效等级', () => {
    const { summon } = summonOnce(72, { skillLevels: { 72: 12 } })
    expect(summon.skillLevels?.[summon.baseAttackId]).toBe(12)
  })

  it('召唤物继承施法者战斗属性快照、召唤时间和 zh 自动行动技能', () => {
    const { summon } = summonOnce(72, {}, {
      [SX.召唤时间]: 25,
      [SX.初始能量]: 3,
      [SX.命中修正]: 37,
      [SX.闪避修正]: 22,
      [SX.暴击几率]: 17,
      [SX.暴击伤害]: 190,
      [SX.最终增伤]: 23,
      58: 41,
      202: 29,
    })

    expect(summon).toMatchObject({
      summonerId: 'hero_strong',
      remainingMs: 38_000,
      energy: 0,
      accuracy: 0.37,
      evade: 0.22,
      criticalChance: 0.17,
      criticalMultiplier: 1.9,
      baseAttackId: 292,
    })
    expect(summon.attributes).toMatchObject({
      [SX.最终增伤]: 23,
      58: 41,
      202: 29,
    })
  })

  it('孟婆按 zh[3] 使用回魂并自动治疗受伤友方', () => {
    const { engine, summon } = summonOnce(180)
    const actor = engine.state.party[0]
    actor.hp = 1
    summon.gauge = 1000

    const events = engine.tick(20)

    expect(summon.baseAttackId).toBe(68)
    expect(events).toContainEqual(expect.objectContaining({
      type: 'skill-used',
      sourceId: summon.id,
      skillId: 68,
    }))
    expect(events).toContainEqual(expect.objectContaining({
      type: 'healing',
      sourceId: summon.id,
      targetId: actor.id,
    }))
  })

  it('当前行动完整收尾后才启动队首的下一次行动', () => {
    const engine = readyDuel()
    const enemyId = engine.state.enemies[0].id
    engine.tick(1)

    const during = engine.tick(11)
    expect(during.some((event) => event.type === 'skill-used' && event.sourceId === enemyId)).toBe(false)

    const completed = engine.tick(1)
    expect(completed.some(event => event.type === 'skill-used')).toBe(false)
    expect(engine.state.timeline.activeAction).toBeNull()
    expect(engine.advance(499).some(event => event.type === 'skill-used')).toBe(false)
    const after = engine.advance(1)
    expect(after.some((event) => event.type === 'skill-used' && event.sourceId === enemyId)).toBe(true)
    expect(engine.state.timeline.activeAction?.actorId).toBe(enemyId)
  })
})

describe('原版死亡结算与普通换波', () => {
  const lethalAttackEngine = () => {
    const actor = partyUnit({ gauge: 1000 })
    actor.attributes[SX.命中修正] = 10_000
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 41,
      party: [actor],
    })
    engine.state.enemies = [engine.state.enemies[0]]
    const enemy = engine.state.enemies[0]
    enemy.hp = 1
    enemy.maxHp = 1
    enemy.gauge = 1000
    enemy.cooldowns = { [enemy.baseAttackId]: 1800 }
    enemy.statuses = [{ buffId: 11, stacks: 1, remainingMs: 5000 }]
    enemy.attributes[SX.闪避修正] = 0
    return { engine, enemy }
  }

  const quietPulseEngine = () => {
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 43,
      party: [partyUnit({ effectiveAgility: 1 })],
    })
    engine.state.enemies = [engine.state.enemies[0]]
    for (const unit of [...engine.state.party, ...engine.state.enemies]) {
      unit.gauge = 0
      unit.effectiveAgility = 1
    }
    return engine
  }

  it('致死命中保留核心和状态，行动结束后发放击杀收益并清理阵亡', () => {
    const { engine, enemy } = lethalAttackEngine()

    const hitEvents = engine.tick(4)
    expect(enemy).toMatchObject({ hp: 0, alive: true })
    expect(enemy.statuses).toHaveLength(1)
    expect(hitEvents.some(event => event.type === 'enemy-defeated')).toBe(false)
    expect(engine.state.timeline.waveTransition).toBeNull()
    const events = [...hitEvents, ...engine.advance(900)]
    const damageIndex = events.findIndex((event) => event.type === 'damage' && event.targetId === enemy.id)
    const rewardIndex = events.findIndex((event) => event.type === 'enemy-defeated' && event.enemyId === enemy.id)
    const deathIndex = events.findIndex((event) => event.type === 'unit-defeated' && event.unitId === enemy.id)

    expect(damageIndex).toBeGreaterThanOrEqual(0)
    expect(rewardIndex).toBeGreaterThan(damageIndex)
    expect(deathIndex).toBeGreaterThan(rewardIndex)
    expect(events[rewardIndex]).toMatchObject({ atMs: 1300 })
    expect(events[deathIndex]).toMatchObject({ atMs: 1300, summon: false })
    expect(enemy).toMatchObject({ alive: false, hp: 0, shield: 0, gauge: 0, cooldowns: {}, statuses: [] })
    expect(engine.state.timeline).toMatchObject({ phase: 'wave-transition', readyQueue: [] })
  })

  it('普通换波从行动结束起等待 0.5 秒刷新，再等待 0.5 秒恢复', () => {
    const { engine } = lethalAttackEngine()
    engine.tick(13)
    expect(engine.state.timeline.activeAction).toBeNull()
    expect(engine.advance(499).some(event => event.type === 'wave-started')).toBe(false)
    expect(engine.state.wave).toBe(1)
    expect(engine.advance(1)).toContainEqual(expect.objectContaining({ type: 'wave-started', wave: 2, atMs: 1800 }))
    expect(engine.state.timeline.phase).toBe('wave-transition')
    engine.advance(499)
    expect(engine.state.timeline.phase).toBe('wave-transition')
    engine.advance(1)
    expect(engine.state.timeline).toMatchObject({ phase: 'accumulating', activeAction: null, waveTransition: null })
    expect(engine.state.elapsedMs).toBe(2300)
  })

  it('同一攻击批次的多个目标在同一时点结算死亡且每个敌人只发一次收益', () => {
    const engine = quietPulseEngine()
    const actor = engine.state.party[0]
    actor.attributes[SX.命中修正] = 10_000
    const first = engine.state.enemies[0]
    const second = structuredClone(first)
    second.id = `${first.id}_second`
    for (const enemy of [first, second]) {
      enemy.hp = 1
      enemy.maxHp = 1
      enemy.attributes[SX.闪避修正] = 0
    }
    engine.state.enemies = [first, second]
    engine.state.timeline.phase = 'acting'
    engine.state.timeline.activeAction = createActionPlan(actor.id, actor.baseAttackId, [first.id, second.id])

    const events = engine.advance(1200)
    const rewards = events.filter((event) => event.type === 'enemy-defeated')
    const deaths = events.filter((event) => event.type === 'unit-defeated')

    expect(rewards).toHaveLength(2)
    expect(deaths).toHaveLength(2)
    expect(rewards.every((event) => event.atMs === 1200)).toBe(true)
    expect(deaths.every((event) => event.atMs === 1200)).toBe(true)
  })

  it('同批阵亡按阵位发放收益，重排敌人数组不改变各自收益种子', () => {
    const run = (reverse: boolean) => {
      const engine = quietPulseEngine()
      const first = engine.state.enemies[0]
      const second = structuredClone(first)
      Object.assign(first, { id: 'front', row: 0, col: 0, hp: 0 })
      Object.assign(second, { id: 'rear', row: 2, col: 4, hp: 0 })
      for (const enemy of [first, second]) {
        enemy.hp = 1
        enemy.statuses = [{ buffId: 3, stacks: 1, remainingMs: 5000, tickValue: 100_000 }]
      }
      engine.state.enemies = reverse ? [second, first] : [first, second]
      return engine.advance(1000).filter(event => event.type === 'enemy-defeated')
    }
    const events = run(false)
    expect(events.map(event => event.enemyId)).toEqual(['front', 'rear'])
    expect(run(true)).toEqual(events)
  })

  it('DoT 与 HoT 在同一全局脉冲全部结算后才判死，回到正气血时保持存活', () => {
    const engine = quietPulseEngine()
    const enemy = engine.state.enemies[0]
    enemy.hp = 5
    enemy.maxHp = 100
    enemy.statuses = [
      { buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'dot', tickValue: 10 },
      { buffId: 47, stacks: 1, remainingMs: 5000, sourceId: 'hot', tickValue: 10 },
    ]

    const events = engine.advance(1000)

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'damage', sourceId: 'dot', targetId: enemy.id }),
      expect.objectContaining({ type: 'healing', sourceId: 'hot', targetId: enemy.id }),
    ]))
    expect(events.some((event) => event.type === 'unit-defeated' && event.unitId === enemy.id)).toBe(false)
    expect(enemy).toMatchObject({ alive: true, hp: 10 })
  })

  it('DoT 致死只结算一次收益，并在同一脉冲清理临时状态', () => {
    const engine = quietPulseEngine()
    const enemy = engine.state.enemies[0]
    enemy.hp = 5
    enemy.shield = 0
    enemy.cooldowns = { [enemy.baseAttackId]: 900 }
    enemy.statuses = [{ buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'dot', tickValue: 10 }]

    const lethalEvents = engine.advance(1000)
    const laterEvents = engine.advance(2000)

    expect(lethalEvents.filter((event) => event.type === 'enemy-defeated' && event.enemyId === enemy.id)).toHaveLength(1)
    expect(laterEvents.some((event) => event.type === 'enemy-defeated' && event.enemyId === enemy.id)).toBe(false)
    expect(enemy).toMatchObject({ alive: false, statuses: [], cooldowns: {}, gauge: 0 })
  })

  it('召唤物阵亡立即释放阵位，我方永久单位阵亡保留供复活', () => {
    const engine = quietPulseEngine()
    const summon = partyUnit({
      id: 'summon_death',
      side: 'party',
      row: 0,
      col: 0,
      hp: 5,
      maxHp: 100,
      effectiveAgility: 1,
      statuses: [{ buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'dot', tickValue: 10 }],
    }) as CombatSummon
    summon.summonerId = engine.state.party[0].id
    summon.remainingMs = 5000
    engine.state.summons.push(summon)

    const summonEvents = engine.advance(1000)
    expect(summonEvents).toContainEqual(expect.objectContaining({
      type: 'unit-defeated',
      unitId: summon.id,
      summon: true,
    }))
    expect(engine.state.summons).toEqual([])

    const hero = engine.state.party[0]
    hero.hp = 5
    hero.statuses = [{ buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'dot', tickValue: 10 }]
    const heroEvents = engine.advance(1000)
    expect(heroEvents).toContainEqual(expect.objectContaining({
      type: 'unit-defeated',
      unitId: hero.id,
      summon: false,
    }))
    expect(engine.state.party).toContain(hero)
    expect(engine.state.timeline.phase).toBe('ending')
    engine.advance(1000)
    expect(engine.state.result).toBe('defeat')
  })

  it('双方在同一状态脉冲归零时先结算敌方收益，再按团灭优先进入失败', () => {
    const engine = quietPulseEngine()
    const hero = engine.state.party[0]
    const enemy = engine.state.enemies[0]
    for (const unit of [hero, enemy]) {
      unit.hp = 5
      unit.statuses = [{ buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'dot', tickValue: 10 }]
    }

    const events = engine.advance(1000)
    const settledEvents = [...events, ...engine.advance(1000)]
    const rewardIndex = events.findIndex((event) => event.type === 'enemy-defeated' && event.enemyId === enemy.id)
    const defeatIndex = settledEvents.findIndex((event) => event.type === 'party-defeated')

    expect(rewardIndex).toBeGreaterThanOrEqual(0)
    expect(defeatIndex).toBeGreaterThan(rewardIndex)
    expect(settledEvents.some((event) => event.type === 'wave-started')).toBe(false)
    expect(engine.state).toMatchObject({ result: 'defeat', wave: 1 })
  })
})

describe('原版全局状态脉冲', () => {
  const quietEngine = () => {
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 37,
      party: [partyUnit({ effectiveAgility: 1 })],
    })
    engine.state.enemies = [engine.state.enemies[0]]
    for (const unit of [...engine.state.party, ...engine.state.enemies]) {
      unit.gauge = 0
      unit.effectiveAgility = 1
      unit.hp = 100_000
      unit.maxHp = 100_000
      unit.shield = 0
    }
    return engine
  }

  it('控制状态到期的积攒步仍使用步开始时的速度，下一步恢复增长', () => {
    const engine = quietEngine()
    const actor = engine.state.party[0]
    actor.statuses = [{ buffId: 2, stacks: 1, remainingMs: 100 }]
    engine.advance(100)
    expect(actor.statuses).toEqual([])
    expect(actor.gauge).toBe(0)
    engine.advance(100)
    expect(actor.gauge).toBeGreaterThan(0)
  })

  it('行动就绪与持续伤害同刻到期时先出手，暂停拦截该次脉冲', () => {
    const engine = quietEngine()
    const actor = engine.state.party[0]
    engine.state.elapsedMs = 900
    actor.gauge = 1000
    actor.hp = 5
    actor.statuses = [{ buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'lethal-dot', tickValue: 10 }]
    const started = engine.advance(100)
    expect(started).toContainEqual(expect.objectContaining({ type: 'skill-used', sourceId: actor.id, atMs: 1000 }))
    expect(started.some(event => event.type === 'damage' && event.sourceId === 'lethal-dot')).toBe(false)
    expect(actor).toMatchObject({ alive: true, hp: 5 })
    expect(engine.state.timeline.lastStatusPulseAtMs).toBe(0)
    engine.advance(1700)
    expect(actor.alive).toBe(true)
    expect(engine.advance(100)).toContainEqual(expect.objectContaining({ type: 'damage', sourceId: 'lethal-dot', atMs: 2700 }))
    expect(actor.alive).toBe(false)
  })

  it('不同施加时点的 DoT 在同一个战斗级 1 秒节点一起结算', () => {
    const engine = quietEngine()
    engine.state.party[0].statuses = [{ buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'first', tickValue: 5 }]

    expect(engine.advance(500).some((event) => event.type === 'damage')).toBe(false)
    engine.state.enemies[0].statuses = [{ buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'second', tickValue: 7 }]
    const events = engine.advance(500)
    const ticks = events.filter((event) => event.type === 'damage' && ['first', 'second'].includes(event.sourceId))

    expect(ticks).toEqual([
      expect.objectContaining({ sourceId: 'first', targetId: 'hero_strong', amount: 5, atMs: 1000 }),
      expect.objectContaining({ sourceId: 'second', targetId: engine.state.enemies[0].id, amount: 7, atMs: 1000 }),
    ])
  })

  it('行动暂停冻结状态时长，恢复后只结算一次已到期的全局脉冲', () => {
    const engine = quietEngine()
    const actor = engine.state.party[0]
    const target = engine.state.enemies[0]
    actor.gauge = 1000
    actor.externalAttack = 1
    actor.internalAttack = 1
    target.statuses = [{ buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'dot_source', tickValue: 5 }]

    engine.tick(1)
    const frozenDuration = target.statuses[0].remainingMs
    const frozenPulseTime = engine.state.timeline.lastStatusPulseAtMs
    const duringAction = engine.advance(1200)

    expect(duringAction.some((event) => event.type === 'damage' && event.sourceId === 'dot_source')).toBe(false)
    expect(target.statuses[0].remainingMs).toBe(frozenDuration)
    expect(engine.state.timeline.lastStatusPulseAtMs).toBe(frozenPulseTime)
    engine.advance(500)
    expect(target.statuses[0].remainingMs).toBe(frozenDuration)
    expect(engine.state.timeline.lastStatusPulseAtMs).toBe(frozenPulseTime)
    const resumed = engine.advance(100).filter(event => event.type === 'damage' && event.sourceId === 'dot_source')
    expect(resumed).toHaveLength(1)
    expect(resumed).toContainEqual(expect.objectContaining({
      type: 'damage',
      sourceId: 'dot_source',
      targetId: target.id,
      amount: 5,
    }))
    expect(engine.state.timeline.lastStatusPulseAtMs).toBe(1800)
    expect(engine.advance(800).some(event => event.type === 'damage' && event.sourceId === 'dot_source')).toBe(false)
    expect(engine.advance(100).filter(event => event.type === 'damage' && event.sourceId === 'dot_source')).toHaveLength(1)
  })

  it('同帧先移除持续时间归零的状态，不补最后一跳', () => {
    const engine = quietEngine()
    const target = engine.state.enemies[0]
    target.statuses = [{ buffId: 3, stacks: 1, remainingMs: 1000, sourceId: 'expiring', tickValue: 9 }]

    const events = engine.advance(1000)

    expect(events.some((event) => event.type === 'damage' && event.sourceId === 'expiring')).toBe(false)
    expect(target.statuses).toEqual([])
  })

  it('按阵位逐个处理生命恢复和持续效果，再处理下个角色', () => {
    const engine = quietEngine()
    const unit = engine.state.party[0]
    unit.hp = 500
    unit.maxHp = 1000
    unit.attributes[SX.生命恢复] = 100
    unit.statuses = [{ buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'poisoner', tickValue: 150 }]
    const enemy = engine.state.enemies[0]
    enemy.hp = 500
    enemy.maxHp = 1000
    enemy.attributes[SX.生命恢复] = 100
    enemy.statuses = [{ buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'other-poisoner', tickValue: 150 }]

    const events = engine.advance(1000).filter((event) =>
      event.type === 'healing' || event.type === 'damage')

    expect(events).toEqual([
      expect.objectContaining({ type: 'healing', sourceId: unit.id, amount: 100 }),
      expect.objectContaining({ type: 'damage', sourceId: 'poisoner', amount: 150 }),
      expect.objectContaining({ type: 'healing', sourceId: enemy.id, amount: 100 }),
      expect.objectContaining({ type: 'damage', sourceId: 'other-poisoner', amount: 150 }),
    ])
    expect(unit.hp).toBe(450)
  })
})

describe('原版 Buff 增效结算', () => {
  const attackOnce = (
    skillId: number,
    actorStatuses: CombatUnit['statuses'] = [],
    targetStatuses: CombatUnit['statuses'] = [],
    actorAttributes: Record<number, number> = {},
    mainhandWeaponType?: number,
  ) => {
    const actor = partyUnit({
      gauge: 1000,
      energy: 5,
      skillIds: [skillId],
      statuses: structuredClone(actorStatuses),
      mainhandWeaponType,
    })
    actor.attributes[SX.命中修正] = 10_000
    actor.attributes[SX.暴击几率] = 0
    Object.assign(actor.attributes, actorAttributes)
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 41,
      party: [actor],
    })
    engine.state.enemies = [engine.state.enemies[0]]
    const target = engine.state.enemies[0]
    target.hp = 1_000_000_000
    target.maxHp = 1_000_000_000
    target.gauge = 0
    target.attributes[SX.闪避修正] = 0
    target.statuses = structuredClone(targetStatuses)

    const events = engine.tick(11)
    const used = events.find((event) => event.type === 'skill-used' && event.sourceId === actor.id)
    if (!used || used.type !== 'skill-used' || used.skillId !== skillId) {
      throw new Error(`预期释放技能 ${skillId}，实际为 ${used?.type === 'skill-used' ? used.skillId : '无'}`)
    }
    const damage = events.find((event) => event.type === 'damage' && event.sourceId === actor.id)
    if (!damage || damage.type !== 'damage') throw new Error(`技能 ${skillId} 未造成伤害`)
    return { engine, actor: engine.state.party[0], target, events, damage: damage.amount }
  }

  it.each([
    [54, 19, 1],
    [113, 21, 2],
  ])('技能 %i 等待1秒后给施法者附加 Buff %i × %i', (skillId, buffId, stacks) => {
    const { actor, events } = attackOnce(skillId)

    expect(actor.statuses).toContainEqual(expect.objectContaining({ buffId, stacks }))
    expect(events).toContainEqual(expect.objectContaining({
      type: 'status-applied',
      sourceId: actor.id,
      targetId: actor.id,
      buffId,
      stacks,
    }))
  })

  it.each([[-50, 15000], [-200, 3000]])('自附状态读取增益时间 %i%%，保留原版最低10%%时长', (bonus, duration) => {
    const { actor } = attackOnce(54, [], [], { [SX.增益时间]: bonus })
    expect(actor.statuses.find((status) => status.buffId === 19)?.remainingMs).toBe(duration)
  })

  it('长生斩首次自附不屈保存法术治疗快照，叠层保留首次快照', () => {
    const first = attackOnce(232)
    // 原版 ceil(0.2 / 10秒 × floor(法攻1000 × 140%)) = 28。
    expect(first.actor.statuses.find((status) => status.buffId === 47)).toMatchObject({ tickValue: 28, stacks: 1 })
    const stacked = attackOnce(232, [{ buffId: 47, stacks: 1, remainingMs: 5000, tickValue: 7 }])
    expect(stacked.actor.statuses.find((status) => status.buffId === 47)).toMatchObject({ tickValue: 7, stacks: 2 })
  })

  it('技能 57 按施法者专注层数增伤，并在本次行动结算后清空', () => {
    const baseline = attackOnce(57)
    const enhanced = attackOnce(57, [{ buffId: 19, stacks: 2, remainingMs: 30_000 }])

    expect(enhanced.damage / baseline.damage).toBeCloseTo(1.3, 2)
    expect(enhanced.actor.statuses.some((status) => status.buffId === 19)).toBe(false)
  })

  it('技能 103 逐目标读取流血层数增伤，jn[43]=0 时不消耗', () => {
    const baseline = attackOnce(103)
    const enhanced = attackOnce(103, [], [{ buffId: 5, stacks: 3, remainingMs: 15_000 }])

    expect(enhanced.damage / baseline.damage).toBeCloseTo(1.3, 2)
    expect(enhanced.target.statuses).toContainEqual(expect.objectContaining({ buffId: 5, stacks: 3 }))
  })

  it('技能 140 逐目标读取箭伤层数增伤，并在结算后清空目标层数', () => {
    const baseline = attackOnce(140)
    const enhanced = attackOnce(140, [], [{ buffId: 26, stacks: 4, remainingMs: 30_000 }])

    expect(enhanced.damage / baseline.damage).toBeCloseTo(1.08, 2)
    expect(enhanced.target.statuses.some((status) => status.buffId === 26)).toBe(false)
  })

  it.each([63, 65])('治疗增效技能 %i 使用仁心后清空施法者层数', (skillId) => {
    const healer = partyUnit({
      id: `healer_${skillId}`,
      gauge: 1000,
      energy: 5,
      skillIds: [skillId],
      statuses: [{ buffId: 20, stacks: 2, remainingMs: 30_000 }],
    })
    const patient = partyUnit({
      id: `patient_${skillId}`,
      hp: 1,
      maxHp: 100_000,
      gauge: 0,
      effectiveAgility: 1,
      formationOrder: 6,
    })
    const engine = createCombatEngine({
      worldId: 'world_01',
      stage: 1,
      mode: 'guard',
      seed: 43,
      party: [healer, patient],
    })
    engine.state.enemies.forEach((enemy) => { enemy.gauge = 0 })

    const events = engine.tick(11)

    expect(events).toContainEqual(expect.objectContaining({
      type: 'healing',
      sourceId: healer.id,
      targetId: patient.id,
    }))
    expect(engine.state.party[0].statuses.some((status) => status.buffId === 20)).toBe(false)
  })

  it('伤害按 jn[49] 读取对应技能组威力', () => {
    const baseline = attackOnce(54)
    const powered = attackOnce(54, [], [], { 156: 100 })

    expect(powered.damage / baseline.damage).toBeCloseTo(2, 2)
  })

  it('只在装备主手时按 wp[7] 读取对应武器熟练增伤', () => {
    const baseline = attackOnce(54)
    const unequipped = attackOnce(54, [], [], { 92: 50 })
    const equipped = attackOnce(54, [], [], { 92: 50 }, 1)

    expect(unequipped.damage).toBe(baseline.damage)
    expect(equipped.damage / baseline.damage).toBeCloseTo(1.5, 2)
  })

  it('治疗和护盾同样应用技能组威力与主手熟练增伤', () => {
    const supportOnce = (skillId: 63 | 280, enhanced: boolean): number => {
      const actor = partyUnit({
        id: `support_${skillId}`,
        hp: skillId === 63 ? 5000 : 1000,
        maxHp: 10_000,
        gauge: 1000,
        energy: 5,
        skillIds: [skillId],
        mainhandWeaponType: enhanced ? 10 : undefined,
      })
      if (enhanced) {
        actor.attributes[skillId === 63 ? 155 : 187] = 100
        actor.attributes[101] = 50
      }
      const patient = partyUnit({
        id: `patient_${skillId}`,
        hp: 1,
        maxHp: 100_000,
        gauge: 0,
        effectiveAgility: 1,
        col: 1,
        formationOrder: 6,
      })
      const engine = createCombatEngine({
        worldId: 'world_01',
        stage: 1,
        mode: 'guard',
        seed: 47,
        party: skillId === 63 ? [actor, patient] : [actor],
      })
      engine.state.enemies.forEach((enemy) => { enemy.gauge = 0 })
      const events = engine.tick(4)
      const used = events.find((event) => event.type === 'skill-used' && event.sourceId === actor.id)
      if (!used || used.type !== 'skill-used' || used.skillId !== skillId) {
        throw new Error(`预期释放技能 ${skillId}，实际为 ${used?.type === 'skill-used' ? used.skillId : '无'}`)
      }
      const settled = events.find((event) => skillId === 63
        ? event.type === 'healing' && event.sourceId === actor.id && event.targetId === patient.id
        : event.type === 'shield-applied' && event.sourceId === actor.id)
      if (!settled || (settled.type !== 'healing' && settled.type !== 'shield-applied')) {
        throw new Error(`技能 ${skillId} 未产生回复或护盾`)
      }
      return settled.amount
    }

    const healingBaseline = supportOnce(63, false)
    const healingEnhanced = supportOnce(63, true)
    const shieldBaseline = supportOnce(280, false)
    const shieldEnhanced = supportOnce(280, true)
    expect(healingEnhanced).toBeCloseTo(healingBaseline * 3, 0)
    expect(shieldEnhanced).toBeCloseTo(shieldBaseline * 3, 0)
  })
})


describe('原版角色战斗属性限制', () => {
  it('我方受伤害修正只限制负向减伤，正向增伤不封顶', () => {
    const actor = partyUnit()
    actor.attributes[118] = 200
    expect(unitAttr(actor, 118)).toBe(200)
    actor.attributes[118] = -200
    expect(unitAttr(actor, 118)).toBe(-95)
    actor.attributes[21] = 200
    expect(unitAttr(actor, 21)).toBe(80)
  })

  it('敌方及召唤物保留原版独立刷新分支，不应用我方角色限制', () => {
    const enemy = partyUnit({ side: 'enemy' })
    enemy.attributes[118] = -200
    enemy.attributes[21] = 200
    expect(unitAttr(enemy, 118)).toBe(-200)
    expect(unitAttr(enemy, 21)).toBe(200)
    const summon = Object.assign(partyUnit(), { summonerId: 'owner' })
    summon.attributes[21] = 200
    expect(unitAttr(summon, 21)).toBe(200)
  })
})


describe('原版自动普攻召唤满额', () => {
  it('选中存活召唤格后被空格条件拦截，不替换已有召唤物', () => {
    const actor = partyUnit({ id: 'owner', baseAttackId: 72, gauge: 1000 })
    actor.attributes[SX.召唤数量] = 1
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 73, party: [actor] })
    const makeSummon = (id: string, summonerId: string, remainingMs: number, col: 0 | 1 | 2): CombatSummon => ({
      ...partyUnit({ id, row: 0, col, gauge: 0 }), summonerId, remainingMs,
    })
    engine.state.summons = [
      makeSummon('owned-long', actor.id, 10000, 0),
      makeSummon('owned-short', actor.id, 5000, 1),
      makeSummon('other-shortest', 'other', 2000, 2),
    ]
    const events = engine.tick(4)
    expect(engine.state.summons.map(summon => summon.id)).toContain('owned-long')
    expect(engine.state.summons.map(summon => summon.id)).toContain('other-shortest')
    expect(engine.state.summons.map(summon => summon.id)).toContain('owned-short')
    expect(events.filter(event => event.type === 'summoned')).toEqual([])
    expect(engine.state.summons).toHaveLength(3)
  })
})


describe('原版普通伤害碰撞', () => {
  it.each([[0, 850, 425], [200, 650, 325], [1000, 850, 425]])(
    '护盾%i时结算伤害%i、50%%吸血%i，并清除目标剑势', (shield, settled, healing) => {
      const actor = partyUnit({ id: 'vamp', hp: 1000, maxHp: 10000, gauge: 1000 })
      actor.attributes = { [SX.物攻]: 1000, [SX.命中修正]: 10000, [SX.吸血]: 50 }
      const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 3, party: [actor] })
      const target = partyUnit({ id: 'target', side: 'enemy', hp: 10000, maxHp: 10000, shield, gauge: 0 })
      target.attributes = {}
      applyBuff(target, 21, 5, target.id)
      engine.state.enemies = [target]
      const events = engine.tick(4)
      expect(events).toContainEqual(expect.objectContaining({ type: 'damage', amount: settled, sourceId: actor.id }))
      expect(engine.state.party[0].hp).toBe(1000 + healing)
      expect(target.statuses.some(status => status.buffId === 21)).toBe(false)
    },
  )

  it('DoT碰撞不清除剑势', () => {
    const target = partyUnit()
    applyBuff(target, 21, 5, target.id)
    applyBuff(target, 5, 1, 'attacker', { tickValue: 10 })
    pulseStatuses(target)
    expect(target.statuses.find(status => status.buffId === 21)?.stacks).toBe(5)
  })

  it('浮点护盾击穿后先ceil剩余伤害，再round剩余生命', () => {
    const target = partyUnit({ hp: 100.7, shield: 2.5 })
    expect(dealCombatDamage(target, 10)).toMatchObject({ settledAmount: 8, shieldLost: 2.5 })
    expect(target.hp).toBe(93)
  })
})


describe('群体回能完整释放', () => {
  it('真武七星阵消耗5能量后为施法者与队友各恢复1点', () => {
    const actor = partyUnit({ id: 'caster', energy: 5, gauge: 1000, skillIds: [123] })
    const ally = partyUnit({ id: 'ally', energy: 0, gauge: 0, col: 1 })
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 12, party: [actor, ally] })
    const events = engine.tick(4)
    expect(events).toContainEqual(expect.objectContaining({ type: 'skill-used', sourceId: actor.id, skillId: 123 }))
    expect(engine.state.party.map(unit => unit.energy)).toEqual([1, 1])
  })
})


describe('原版副手器魂效果', () => {
  it.each([123, undefined])('我方器魂%s不改变后续波次敌人的技能冷却', (soulId) => {
    const party = partyUnit({ hp: 100000, maxHp: 100000, offhandSoulId: soulId })
    party.attributes = {}
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 12, party: [party] })
    advanceToNextWave(engine.state)
    const enemy = engine.state.enemies[0]
    enemy.skillIds = [89]
    enemy.energy = 5
    enemy.gauge = 1000
    enemy.attributes = {}
    expect(engine.tick(1)).toContainEqual(expect.objectContaining({ type: 'skill-used', sourceId: enemy.id, skillId: 89 }))
    engine.advance(1200)
    expect(enemy.cooldowns[89]).toBe(12000)
  })

  it.each([true, false])('召唤物从主人读取无冷却器魂，主人存活=%s', (ownerAlive) => {
    const owner = partyUnit({ id: 'owner', alive: ownerAlive, hp: ownerAlive ? 5000 : 0, offhandSoulId: 123 })
    owner.attributes = {}
    const ally = partyUnit({ id: 'ally', row: 0, col: 1 })
    ally.attributes = {}
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 12, party: [owner, ally] })
    const summon: CombatSummon = { ...partyUnit({ id: 'summon', energy: 5, gauge: 1000, skillIds: [261], row: 2, col: 4 }), summonerId: 'owner', remainingMs: 30000 }
    summon.attributes = {}
    engine.state.summons = [summon]
    expect(engine.tick(1)).toContainEqual(expect.objectContaining({ type: 'skill-used', sourceId: 'summon', skillId: 261 }))
    engine.advance(1200)
    expect(summon.cooldowns[261]).toBe(0)
    expect(summon.offhandSoulId).toBeUndefined()
  })

  it.each([[123, 0], [undefined, 800]])('副手器魂%s在行动结束时写入冷却%i，不受普通5%%下限限制', (soulId, cooldown) => {
    const actor = partyUnit({ energy: 5, gauge: 1000, skillIds: [261], offhandSoulId: soulId })
    actor.attributes = { [SX.技能冷却]: 100 }
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 12, party: [actor] })
    expect(engine.tick(1)).toContainEqual(expect.objectContaining({ type: 'skill-used', skillId: 261 }))
    engine.advance(1199)
    expect(engine.state.party[0].cooldowns[261]).toBeUndefined()
    engine.advance(1)
    expect(engine.state.party[0].cooldowns[261]).toBe(cooldown)
  })

  it.each([[129, 5], [undefined, 2]])('副手器魂%s释放耗能3技能后剩余%i', (soulId, remaining) => {
    const actor = partyUnit({ id: 'caster', energy: 5, gauge: 1000, skillIds: [89], offhandSoulId: soulId })
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 12, party: [actor] })
    const events = engine.tick(1)
    expect(events).toContainEqual(expect.objectContaining({ type: 'skill-used', skillId: 89 }))
    expect(engine.state.party[0].energy).toBe(remaining)
  })

  it('源流不息不绕过选择技能时的能量门槛', () => {
    const actor = partyUnit({ energy: 0, gauge: 1000, skillIds: [89], offhandSoulId: 129 })
    actor.attributes[SX.能量回复] = 0
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 12, party: [actor] })
    const events = engine.tick(1)
    expect(events).toContainEqual(expect.objectContaining({ type: 'skill-used', skillId: actor.baseAttackId }))
  })
})


describe('原版jn27普攻标记', () => {
  const hitOnce = (skillId: number, baseAttackId: number, bonus: number) => {
    const actor = partyUnit({ id: 'attacker', gauge: 1000, energy: 5, baseAttackId, skillIds: [skillId] })
    actor.attributes = { [SX.物攻]: 1000, [SX.命中修正]: 10000, [SX.普攻增伤]: bonus }
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 12, party: [actor] })
    const target = partyUnit({ id: 'target', side: 'enemy', hp: 10000, maxHp: 10000, gauge: 0 })
    target.attributes = {}
    engine.state.enemies = [target]
    const event = engine.tick(4).find(event => event.type === 'damage')
    if (!event || event.type !== 'damage') throw new Error('未命中')
    return event.amount
  }

  it('表中普攻标记的攻击即使放在主动槽，仍享受普攻增伤', () => {
    expect(hitOnce(1, 10, 0)).toBe(850)
    expect(hitOnce(1, 10, 100)).toBe(1700)
  })

  it('野球拳即使与普攻ID相同，也不会被错误归为普攻增伤', () => {
    expect(hitOnce(42, 42, 100)).toBe(hitOnce(42, 42, 0))
  })
})


describe('原版敌方治疗技能', () => {
  it.each([[3, 99, 1940], [0, 16, 650]])('敌方治疗者能量%i选择技能%i，为低生命比例同伴治疗', (energy, skillId, expectedHp) => {
    const player = partyUnit({ id: 'player', hp: 3000, gauge: 0 })
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 12, party: [player] })
    const medic = partyUnit({ id: 'medic', side: 'enemy', energy, gauge: 1000, skillIds: [99], baseAttackId: 16, hp: 200, maxHp: 1000 })
    medic.attributes = { [SX.法攻]: 1000 }
    const wounded = partyUnit({ id: 'wounded', side: 'enemy', col: 1, hp: 100, maxHp: 2000, gauge: 0 })
    wounded.attributes = {}
    engine.state.enemies = [medic, wounded]
    const events = engine.tick(4)
    expect(events).toContainEqual(expect.objectContaining({ type: 'skill-used', sourceId: 'medic', skillId, targetIds: ['wounded'] }))
    expect(wounded.hp).toBe(expectedHp)
    expect(medic.hp).toBe(200)
    expect(engine.state.party[0].hp).toBe(3000)
    expect(medic.energy).toBe(0)
    engine.tick(9)
    expect(medic.cooldowns[skillId]).toBe(skillId === 99 ? 12000 : 0)
  })
})


describe('原版回能与治疗复合技能', () => {
  it.each([[0.49, false], [0.5, true]])(
    '行动自然回能%s先取整再选择可支付技能', (recovery, canCast) => {
      const actor = partyUnit({ energy: 3, gauge: 1000, skillIds: [261] })
      actor.attributes = { [SX.能量回复]: recovery }
      const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 17, party: [actor] })
      const used = engine.tick(1).find(event => event.type === 'skill-used' && event.sourceId === actor.id)
      expect(used).toMatchObject({ skillId: canCast ? 261 : 1 })
      expect(engine.state.party[0].energy).toBe(canCast ? 2 : 3)
    },
  )

  it.each([[4.49, 2.49, 2, 4], [4.5, 2.5, 3, 5]])(
    '施法耗能与队友回能分别按原版截断到0至5后取整（%s，%s）', (energy, allyEnergy, expectedActor, expectedAlly) => {
      const actor = partyUnit({ id: 'caster', energy, gauge: 1000, skillIds: [261], row: 0, col: 0 })
      const ally = partyUnit({ id: 'ally', energy: allyEnergy, row: 2, col: 4 })
      actor.attributes = {}
      ally.attributes = {}
      const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 17, party: [actor, ally] })
      expect(engine.tick(1)).toContainEqual(expect.objectContaining({ type: 'skill-used', skillId: 261 }))
      expect(engine.state.party.map(unit => unit.energy)).toEqual([expectedActor, expectedAlly])
    },
  )

  it('落云回天阵自动回能覆盖存活全队，施法核心为自身使复活分支不触发', () => {
    const actor = partyUnit({ id: 'caster', energy: 4, gauge: 1000, skillIds: [261], row: 0, col: 0 })
    const ally = partyUnit({ id: 'ally', energy: 4, row: 2, col: 4 })
    const fallen = partyUnit({ id: 'fallen', energy: 0, row: 2, col: 3, alive: false, hp: 0 })
    for (const unit of [actor, ally, fallen]) unit.attributes = {}
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 17, party: [actor, ally, fallen] })
    const used = engine.tick(1)
    expect(used).toContainEqual(expect.objectContaining({ type: 'skill-used', skillId: 261, targetIds: ['caster', 'ally'] }))
    expect(engine.state.party.map(unit => unit.energy)).toEqual([2, 5, 0])
    expect(engine.state.party[2]).toMatchObject({ alive: false, hp: 0 })
    expect(used.some(event => event.type === 'unit-revived')).toBe(false)
    const rest = engine.advance(1200)
    expect(rest.some(event => event.type === 'unit-revived' || event.type === 'healing')).toBe(false)
    expect(engine.state.party[0].cooldowns[261]).toBe(16000)
    expect(engine.state.party.map(unit => unit.energy)).toEqual([2, 5, 0])
  })

  it.each([[256, 5, 940], [257, 3, 2920], [258, 2, 3770]])(
    '技能%i立即回能至%i，300毫秒后治疗%i', (skillId, energy, healing) => {
      const actor = partyUnit({ energy: 5, gauge: 1000, skillIds: [skillId], hp: 500, maxHp: 10000 })
      actor.attributes = { [SX.法攻]: 1000 }
      const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 17, party: [actor] })
      engine.state.enemies.forEach(enemy => { enemy.gauge = 0 })
      const used = engine.tick(1)
      expect(used).toContainEqual(expect.objectContaining({ type: 'skill-used', skillId }))
      expect(engine.state.party[0].energy).toBe(energy)
      expect(engine.state.party[0].hp).toBe(500)
      engine.advance(299)
      expect(engine.state.party[0].hp).toBe(500)
      const hit = engine.advance(1)
      expect(hit).toContainEqual(expect.objectContaining({ type: 'healing', amount: healing, atMs: 400 }))
      expect(engine.state.party[0].hp).toBe(500 + healing)
      expect(engine.state.party[0].energy).toBe(energy)
    },
  )

  it('推进度在施法时立即生效，后续命中节点不重复增加', () => {
    const actor = partyUnit({ energy: 1, gauge: 1000, skillIds: [217] })
    actor.attributes = { [SX.法攻]: 1000 }
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 17, party: [actor] })
    engine.tick(1)
    expect(engine.state.party[0].gauge).toBe(350)
    engine.advance(300)
    expect(engine.state.party[0].gauge).toBe(350)
  })
})


describe('原版远程弹体', () => {
  it('弹体生成后飞行，锁定暴击/闪避，但碰撞时读取暴伤', () => {
    const actor = partyUnit({ row: 0, col: 0, gauge: 1000, baseAttackId: 4 })
    actor.attributes = { [SX.法攻]: 1000, [SX.暴击几率]: 100, [SX.暴击伤害]: 150 }
    const enemy = partyUnit({ id: 'target', side: 'enemy', row: 0, col: 4, hp: 10000, maxHp: 10000 })
    enemy.attributes = {}
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 17, party: [actor] })
    engine.state.enemies = [enemy]
    expect(engine.advance(400).filter(event => event.type === 'damage')).toEqual([])
    engine.state.party[0].attributes[SX.暴击几率] = 0
    engine.state.party[0].attributes[SX.暴击伤害] = 300
    enemy.attributes[SX.闪避修正] = 100
    // 两核心相距920，方形首次接触需要飞行(920-125)/2000秒。
    expect(engine.advance(397).filter(event => event.type === 'damage')).toEqual([])
    expect(engine.advance(0.5)).toContainEqual(expect.objectContaining({
      type: 'damage', targetId: 'target', critical: true, amount: 2850, atMs: 797.5,
    }))
  })

  it('破魔阵各目标按飞行距离命中，分段数2不会重复扣血', () => {
    const actor = partyUnit({ row: 0, col: 0, gauge: 1000, energy: 2, skillIds: [134] })
    actor.attributes = { [SX.法攻]: 1000 }
    const enemies = [0, 1].map(col => {
      const enemy = partyUnit({ id: `target${col}`, side: 'enemy', row: 1, col: col as 0 | 1, hp: 10000, maxHp: 10000 })
      enemy.attributes = {}
      return enemy
    })
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 17, party: [actor] })
    engine.state.enemies = enemies
    const events = engine.advance(1300)
    const damage = events.filter(event => event.type === 'damage')
    expect(damage.map(event => event.targetId)).toEqual(['target1', 'target0'])
    expect(damage[0].atMs).toBeLessThan(damage[1].atMs)
    expect(engine.state.party[0].cooldowns[134]).toBe(8000)
    expect(engine.state.timeline.activeAction).toBeNull()
  })
})


describe('原版控制与行动权重', () => {
  it.each([0, 1000])('眩晕阻止积攒，但不撤销已有的%i行动进度', gauge => {
    const actor = partyUnit({ gauge, skillIds: [1] })
    applyBuff(actor, 2, 1, 'enemy')
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 17, party: [actor] })
    engine.state.enemies.forEach(enemy => { enemy.gauge = 0 })
    const events = engine.tick(1)
    expect(events.some(event => event.type === 'skill-used' && event.sourceId === actor.id)).toBe(gauge === 1000)
    expect(engine.state.party[0].gauge).toBe(0)
    expect(engine.state.party[0].statuses.some(status => status.buffId === 2)).toBe(true)
  })
})


describe('多状态计时边界', () => {
  it('自动分配到第13槽的眩晕到期后恢复积攒，大步与小步结果一致', () => {
    const setup = () => {
      const actor = partyUnit({ effectiveAgility: 100, gauge: 0 })
      const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 12, party: [actor] })
      for (const enemy of engine.state.enemies) enemy.attributes[SX.速度] = 0
      const unit = engine.state.party[0]
      for (const id of [7, 9, 11, 13, 15, 19, 20, 22, 23, 26, 27, 28]) applyBuff(unit, id, 1, unit.id)
      applyBuff(unit, 2, 1, 'enemy', { durationScale: 0.1 })
      expect(unit.statuses.find(status => status.buffId === 2)?.slot).toBe(13)
      return engine
    }
    const large = setup()
    const small = setup()
    large.advance(600)
    for (let step = 0; step < 6; step++) small.advance(100)
    expect(large.state.party[0].statuses.some(status => status.buffId === 2)).toBe(false)
    expect(large.state.party[0].gauge).toBeGreaterThan(0)
    expect(large.state.party[0].gauge).toBeCloseTo(small.state.party[0].gauge, 10)
    expect(large.state.party[0].statuses).toEqual(small.state.party[0].statuses)
  })
})
