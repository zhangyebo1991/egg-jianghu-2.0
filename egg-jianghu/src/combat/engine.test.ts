import { describe, expect, it } from 'vitest'
import { createCombatEngine as createRawCombatEngine } from './engine'
import { advanceToNextWave, createWave, isWaveCleared } from './waves'
import type { CombatStartInput, CombatSummon, CombatUnit } from './types'
import { panelToAttributeMap } from './stats'
import { createActionPlan, createCombatTimeline } from './scheduler'
import { SX } from './attribute-ids'

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

  it('闯荡最终胜利从致死节点等待 0.8 秒后才发出通关事件', () => {
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
    expect(engine.state.timeline).toMatchObject({
      phase: 'ending',
      endingTransition: { outcome: 'victory', elapsedMs: 0, durationMs: 800 },
    })
    expect(engine.advance(799).some((event) => event.type === 'stage-cleared')).toBe(false)
    expect(engine.state.result).toBe('fighting')

    expect(engine.advance(1)).toContainEqual({ type: 'stage-cleared', atMs: 1100 })
    expect(engine.state.result).toBe('victory')
    expect(engine.state.timeline.activeAction).toBeNull()
  })

  it('驻守最终胜利等待 1 秒打开结算，且与剩余行动锁并行', () => {
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
    expect(engine.advance(99).some((event) => event.type === 'stage-cleared')).toBe(false)
    expect(engine.advance(1)).toContainEqual({ type: 'stage-cleared', atMs: 1300 })
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

  it('治疗以施法者生命为基础并应用职业编码 6，持续恢复锁定原版每秒值', () => {
    const healer = partyUnit({
      id: 'healer',
      name: '医者',
      hp: 1000,
      maxHp: 1000,
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

    expect(healing).toMatchObject({ type: 'healing', amount: 1400 })
    expect(engine.state.party[1].statuses[0]).toMatchObject({ buffId: 6, tickValue: 28 })
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

  it('起死回生按 jn[23] 的 20% 复活，并重新生成战斗临时状态', () => {
    const healer = partyUnit({
      id: 'reviver',
      gauge: 1000,
      energy: 4,
      skillIds: [64],
    })
    const target = partyUnit({
      id: 'fallen',
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
    for (const skillId of boss.skillIds) {
      if (skillId !== 47) boss.cooldowns[skillId] = 1000
    }
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

describe('原版单行动调度', () => {
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

  it('召唤系数先保留两位小数，强度只强化生命物攻法攻，六维最终取整', () => {
    const { summon } = summonOnce(72, {
      maxHp: 101,
      hp: 101,
      externalAttack: 101,
      externalDefense: 101,
      internalAttack: 101,
      internalDefense: 101,
      effectiveAgility: 101,
    }, {
      [SX.召唤强度]: 13.37,
    })

    expect(summon).toMatchObject({
      maxHp: 148,
      hp: 148,
      externalAttack: 131,
      externalDefense: 131,
      internalAttack: 80,
      internalDefense: 111,
      effectiveAgility: 101,
    })
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
      remainingMs: 37_500,
      energy: 3,
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

    const after = engine.tick(1)
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

  it('命中节点先发放击杀收益事件，再一次性清理死亡状态并立即启动换波计时', () => {
    const { engine, enemy } = lethalAttackEngine()

    const events = engine.tick(4)
    const damageIndex = events.findIndex((event) => event.type === 'damage' && event.targetId === enemy.id)
    const rewardIndex = events.findIndex((event) => event.type === 'enemy-defeated' && event.enemyId === enemy.id)
    const deathIndex = events.findIndex((event) => event.type === 'unit-defeated' && event.unitId === enemy.id)

    expect(damageIndex).toBeGreaterThanOrEqual(0)
    expect(rewardIndex).toBeGreaterThan(damageIndex)
    expect(deathIndex).toBeGreaterThan(rewardIndex)
    expect(events[rewardIndex]).toMatchObject({ atMs: 400 })
    expect(events[deathIndex]).toMatchObject({ atMs: 400, summon: false })
    expect(enemy).toMatchObject({ alive: false, hp: 0, shield: 0, gauge: 0, cooldowns: {}, statuses: [] })
    expect(engine.state.timeline).toMatchObject({ phase: 'wave-transition', readyQueue: [] })
  })

  it('普通换波按命中致死时点执行 0.5 秒刷新和 0.5 秒恢复，且与剩余行动锁并行', () => {
    const { engine } = lethalAttackEngine()
    engine.tick(4)

    expect(engine.advance(499).some((event) => event.type === 'wave-started')).toBe(false)
    expect(engine.state.wave).toBe(1)
    const refreshed = engine.advance(1)
    expect(refreshed).toContainEqual(expect.objectContaining({ type: 'wave-started', wave: 2, atMs: 900 }))
    expect(engine.state.timeline.phase).toBe('wave-transition')
    expect(engine.state.timeline.activeAction).not.toBeNull()

    engine.advance(399)
    expect(engine.state.timeline.activeAction).not.toBeNull()
    engine.advance(1)
    expect(engine.state.timeline.activeAction).toBeNull()
    expect(engine.state.timeline.phase).toBe('wave-transition')
    engine.advance(99)
    expect(engine.state.timeline.phase).toBe('wave-transition')
    engine.advance(1)
    expect(engine.state.timeline).toMatchObject({ phase: 'accumulating', activeAction: null, waveTransition: null })
    expect(engine.state.elapsedMs).toBe(1400)
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

    const events = engine.advance(300)
    const rewards = events.filter((event) => event.type === 'enemy-defeated')
    const deaths = events.filter((event) => event.type === 'unit-defeated')

    expect(rewards).toHaveLength(2)
    expect(deaths).toHaveLength(2)
    expect(rewards.every((event) => event.atMs === 300)).toBe(true)
    expect(deaths.every((event) => event.atMs === 300)).toBe(true)
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

  it('行动锁期间冻结状态持续时间和全局脉冲 carry', () => {
    const engine = quietEngine()
    const actor = engine.state.party[0]
    const target = engine.state.enemies[0]
    actor.gauge = 1000
    actor.externalAttack = 1
    actor.internalAttack = 1
    target.statuses = [{ buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'dot_source', tickValue: 5 }]

    engine.tick(1)
    const frozenDuration = target.statuses[0].remainingMs
    const frozenCarry = engine.state.timeline.statusPulseCarryMs
    const duringAction = engine.advance(1200)

    expect(duringAction.some((event) => event.type === 'damage' && event.sourceId === 'dot_source')).toBe(false)
    expect(target.statuses[0].remainingMs).toBe(frozenDuration)
    expect(engine.state.timeline.statusPulseCarryMs).toBe(frozenCarry)
    expect(engine.advance(800).some((event) => event.type === 'damage' && event.sourceId === 'dot_source')).toBe(false)
    expect(engine.advance(100)).toContainEqual(expect.objectContaining({
      type: 'damage',
      sourceId: 'dot_source',
      targetId: target.id,
      amount: 5,
    }))
  })

  it('同帧先移除持续时间归零的状态，不补最后一跳', () => {
    const engine = quietEngine()
    const target = engine.state.enemies[0]
    target.statuses = [{ buffId: 3, stacks: 1, remainingMs: 1000, sourceId: 'expiring', tickValue: 9 }]

    const events = engine.advance(1000)

    expect(events.some((event) => event.type === 'damage' && event.sourceId === 'expiring')).toBe(false)
    expect(target.statuses).toEqual([])
  })

  it('每个全局节点先结算全体生命恢复，再按状态槽结算 DoT/HoT', () => {
    const engine = quietEngine()
    const unit = engine.state.party[0]
    unit.hp = 500
    unit.maxHp = 1000
    unit.attributes[SX.生命恢复] = 100
    unit.statuses = [{ buffId: 3, stacks: 1, remainingMs: 5000, sourceId: 'poisoner', tickValue: 150 }]

    const events = engine.advance(1000).filter((event) =>
      (event.type === 'healing' || event.type === 'damage') && event.targetId === unit.id)

    expect(events).toEqual([
      expect.objectContaining({ type: 'healing', sourceId: unit.id, amount: 100 }),
      expect.objectContaining({ type: 'damage', sourceId: 'poisoner', amount: 150 }),
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

    const events = engine.tick(4)
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
  ])('技能 %i 命中结算后给施法者附加 Buff %i × %i', (skillId, buffId, stacks) => {
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

    const events = engine.tick(4)

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
