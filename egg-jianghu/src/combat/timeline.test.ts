import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import { applyStatus, resolveControlDuration, tickStatuses } from './statuses'
import {
  actionIntervalMs,
  advanceCombatTime,
  advanceUnitTime,
} from './timeline'
import type { CombatStatus, CombatUnit } from './types'

const fixtureUnit = (overrides: Partial<CombatUnit> = {}): CombatUnit => ({
  id: 'hero_fixture',
  name: '测试侠客',
  side: 'party',
  row: 1,
  col: 0,
  formationOrder: 5,
  rank: 'normal',
  alive: true,
  hp: 100,
  maxHp: 100,
  energy: 20,
  maxEnergy: 100,
  gauge: 0,
  effectiveAgility: 100,
  externalAttack: 50,
  internalAttack: 50,
  externalDefense: 20,
  internalDefense: 20,
  accuracy: 0,
  evade: 0,
  criticalChance: 0,
  criticalMultiplier: 1.5,
  controlResistance: 0,
  controlDiminishing: {},
  cooldowns: {},
  statuses: [],
  momentum: {},
  skillIds: [],
  baseSkillId: 'base_fixture',
  attributes: {},
  ...overrides,
})

describe('战斗时间轴', () => {
  it('身法 100 的行动间隔为 5 秒', () => {
    expect(actionIntervalMs(100)).toBe(5000)
  })

  it('1×、2×、4×执行相同模拟毫秒会得到相同状态', () => {
    const simulate = (frames: number, speed: 1 | 2 | 4) => {
      const unit = fixtureUnit({ cooldowns: { skill_a: 10_000 } })
      for (let frame = 0; frame < frames; frame += 1) advanceCombatTime([unit], speed)
      return { gauge: unit.gauge, cooldown: unit.cooldowns.skill_a }
    }

    expect(simulate(50, 2)).toEqual(simulate(100, 1))
    expect(simulate(25, 4)).toEqual(simulate(100, 1))
  })

  it('回气与状态按战斗毫秒减少，不依赖行动次数', () => {
    const unit = fixtureUnit({
      cooldowns: { skill_a: 3000 },
      statuses: [{ id: 'slow', remainingMs: 2500, mode: 'refresh', stacks: 1, value: 0.2 }],
    })

    advanceUnitTime(unit, 1000)

    expect(unit.cooldowns.skill_a).toBe(2000)
    expect(unit.statuses[0].remainingMs).toBe(1500)
  })

  it('同帧满气机按溢出、身法和固定站位顺序裁定', () => {
    const units = [
      fixtureUnit({ id: 'position', gauge: 1000, effectiveAgility: 90, formationOrder: 0 }),
      fixtureUnit({ id: 'agility', gauge: 1000, effectiveAgility: 100, formationOrder: 2 }),
      fixtureUnit({ id: 'overflow', gauge: 1100, effectiveAgility: 50, formationOrder: 5 }),
    ]

    expect(advanceCombatTime(units, 0).map((unit) => unit.id)).toEqual(['overflow', 'agility', 'position'])
  })
})

describe('实时状态', () => {
  const status = (overrides: Partial<CombatStatus> = {}): CombatStatus => ({
    id: 'bleed',
    remainingMs: 3000,
    mode: 'refresh',
    stacks: 1,
    value: 5,
    ...overrides,
  })

  it('刷新、取强、叠层与独立结算使用各自规则', () => {
    const unit = fixtureUnit()
    applyStatus(unit, status({ id: 'refresh', remainingMs: 1000, value: 1 }))
    applyStatus(unit, status({ id: 'refresh', remainingMs: 3000, value: 2 }))
    applyStatus(unit, status({ id: 'strongest', mode: 'strongest', value: 5 }))
    applyStatus(unit, status({ id: 'strongest', mode: 'strongest', value: 3, remainingMs: 5000 }))
    applyStatus(unit, status({ id: 'stack', mode: 'stack', stacks: 1 }))
    applyStatus(unit, status({ id: 'stack', mode: 'stack', stacks: 2 }))
    applyStatus(unit, status({ id: 'independent', mode: 'independent' }))
    applyStatus(unit, status({ id: 'independent', mode: 'independent' }))

    expect(unit.statuses.find((item) => item.id === 'refresh')).toMatchObject({ remainingMs: 3000, value: 2 })
    expect(unit.statuses.find((item) => item.id === 'strongest')).toMatchObject({ remainingMs: 5000, value: 5 })
    expect(unit.statuses.find((item) => item.id === 'stack')).toMatchObject({ stacks: 3 })
    expect(unit.statuses.filter((item) => item.id === 'independent')).toHaveLength(2)
  })

  it('持续伤害每 1000 战斗毫秒结算且 PRNG 可复现', () => {
    const first = fixtureUnit()
    const second = fixtureUnit()
    applyStatus(first, status({ sourceId: 'enemy', tickIntervalMs: 1000, nextTickMs: 1000 }))
    applyStatus(second, status({ sourceId: 'enemy', tickIntervalMs: 1000, nextTickMs: 1000 }))

    expect(tickStatuses(first, 2500, createRng(42))).toEqual(tickStatuses(second, 2500, createRng(42)))
    expect(first.hp).toBe(90)
  })

  it('Boss 控制递减降低持续时间但不会完全免疫', () => {
    expect(resolveControlDuration(4000, 0.5, 3)).toBeGreaterThan(0)
    expect(resolveControlDuration(4000, 0.5, 3)).toBeLessThan(2000)
  })
})
