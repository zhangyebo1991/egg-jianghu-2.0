import { describe, expect, it } from 'vitest'
import { applyBuff, isControlled, tickStatuses } from './statuses'
import {
  actionIntervalMs,
  advanceCombatTime,
  advanceGaugeAndCooldowns,
  effectiveSpeed,
} from './timeline'
import type { CombatUnit } from './types'

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
  shield: 0,
  energy: 0,
  maxEnergy: 5,
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
  cooldowns: {},
  statuses: [],
  skillIds: [],
  baseAttackId: 1,
  attributes: {},
  ...overrides,
})

describe('战斗时间轴', () => {
  it('身法 100 的行动间隔为 5 秒', () => {
    expect(actionIntervalMs(100)).toBe(5000)
  })

  it('1×、2×、4×执行相同模拟毫秒会得到相同状态', () => {
    const simulate = (frames: number, speed: 1 | 2 | 4) => {
      const unit = fixtureUnit({ cooldowns: { 1: 10_000 } })
      for (let frame = 0; frame < frames; frame += 1) advanceCombatTime([unit], speed)
      return { gauge: unit.gauge, cooldown: unit.cooldowns[1] }
    }

    expect(simulate(50, 2)).toEqual(simulate(100, 1))
    expect(simulate(25, 4)).toEqual(simulate(100, 1))
  })

  it('回气与状态按战斗毫秒减少，不依赖行动次数', () => {
    const unit = fixtureUnit({ cooldowns: { 1: 3000 } })
    applyBuff(unit, 11, 1, 'self')
    const remaining = unit.statuses[0].remainingMs

    advanceGaugeAndCooldowns(unit, 1000)
    tickStatuses(unit, 1000)

    expect(unit.cooldowns[1]).toBe(2000)
    expect(unit.statuses[0].remainingMs).toBe(remaining - 1000)
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
  it('同 id buff 叠层并刷新较长持续', () => {
    const unit = fixtureUnit()
    applyBuff(unit, 3, 1, 'enemy', { tickValue: 5 })
    applyBuff(unit, 3, 2, 'enemy', { tickValue: 8 })

    expect(unit.statuses).toHaveLength(1)
    expect(unit.statuses[0]).toMatchObject({ buffId: 3, stacks: 3, tickValue: 8 })
  })

  it('持续伤害每 1000 战斗毫秒结算', () => {
    const unit = fixtureUnit()
    applyBuff(unit, 3, 1, 'enemy', { tickValue: 5 })

    expect(tickStatuses(unit, 2500).map((tick) => tick.amount)).toEqual([5, 5])
    expect(unit.hp).toBe(90)
  })

  it('控制类 buff 使有效速度为 0', () => {
    const unit = fixtureUnit({ gauge: 0 })
    applyBuff(unit, 2, 1, 'enemy')
    expect(isControlled(unit)).toBe(true)
    expect(effectiveSpeed(unit)).toBe(0)
    advanceGaugeAndCooldowns(unit, 1000)
    expect(unit.gauge).toBe(0)
  })
})
