import { describe, expect, it } from 'vitest'
import { createCombatEngine } from './engine'
import { advanceToNextWave, createWave, isWaveCleared } from './waves'
import type { CombatStartInput, CombatUnit } from './types'

const partyUnit = (overrides: Partial<CombatUnit> = {}): CombatUnit => ({
  id: 'hero_strong',
  name: '强力侠客',
  careerId: 'sword',
  side: 'party',
  row: 'front',
  position: 0,
  formationOrder: 0,
  rank: 'normal',
  alive: true,
  hp: 5000,
  maxHp: 5000,
  energy: 20,
  maxEnergy: 100,
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
  controlDiminishing: {},
  cooldowns: {},
  statuses: [],
  momentum: {},
  skillIds: [null, null, null, null],
  baseSkillId: 'base_sword',
  ...overrides,
})

describe('十波战斗', () => {
  it('每个小关的第十波都含 Boss、精英和小怪', () => {
    for (let stage = 1; stage <= 10; stage += 1) {
      const wave = createWave('world_01', stage, 10, 1000 + stage)
      expect(wave.enemies.some((enemy) => enemy.rank === 'boss')).toBe(true)
      expect(wave.enemies.some((enemy) => enemy.rank === 'elite')).toBe(true)
      expect(wave.enemies.some((enemy) => enemy.rank === 'normal')).toBe(true)
    }
  })

  it('换波继承气血、阵亡、真气、气机、回气、状态和武学势', () => {
    const party = [partyUnit({
      hp: 71,
      energy: 42,
      gauge: 600,
      cooldowns: { skill: 2800 },
      statuses: [{ id: 'guard', remainingMs: 4300, mode: 'refresh', stacks: 1, value: 0.2 }],
      momentum: { sword: 3 },
    })]
    const state = {
      seed: 7,
      worldId: 'world_01',
      stage: 1,
      mode: 'guard' as const,
      wave: 3,
      elapsedMs: 4000,
      result: 'fighting' as const,
      party,
      enemies: createWave('world_01', 1, 3, 7).enemies.map((enemy) => ({ ...enemy, alive: false, hp: 0 })),
      summons: [partyUnit({ id: 'summon', side: 'party' }) as CombatUnit & { remainingMs: number }],
    }
    state.summons[0].remainingMs = 5000

    advanceToNextWave(state)

    expect(state.wave).toBe(4)
    expect(state.party[0]).toMatchObject({
      hp: 71,
      alive: true,
      energy: 42,
      gauge: 600,
      cooldowns: { skill: 2800 },
      momentum: { sword: 3 },
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
})
