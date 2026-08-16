import { describe, expect, it } from 'vitest'
import {
  advanceStatusDurations,
  applyBuff,
  buffAttributeBonus,
  isControlled,
  pulseStatuses,
} from './statuses'
import {
  actionIntervalMs,
  advanceGaugeAndCooldowns,
  effectiveSpeed,
} from './timeline'
import { ORIGINAL_COMBAT_SPEEDS } from './scheduler'
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

  it('四档原版倍率执行相同模拟毫秒会得到相同状态', () => {
    const simulate = (speed: typeof ORIGINAL_COMBAT_SPEEDS[number]) => {
      const unit = fixtureUnit({ cooldowns: { 1: 10_000 } })
      const elapsedPerFrame = 100 * speed
      const frameCount = Math.round(23_400 / elapsedPerFrame)
      for (let frame = 0; frame < frameCount; frame += 1) advanceGaugeAndCooldowns(unit, elapsedPerFrame)
      return { gauge: unit.gauge, cooldown: unit.cooldowns[1] }
    }

    const baseline = simulate(1)
    for (const speed of ORIGINAL_COMBAT_SPEEDS.slice(1)) {
      const actual = simulate(speed)
      expect(actual.gauge).toBeCloseTo(baseline.gauge, 10)
      expect(actual.cooldown).toBeCloseTo(baseline.cooldown, 10)
    }
  })

  it('回气与状态按战斗毫秒减少，不依赖行动次数', () => {
    const unit = fixtureUnit({ cooldowns: { 1: 3000 } })
    applyBuff(unit, 11, 1, 'self')
    const remaining = unit.statuses[0].remainingMs

    advanceGaugeAndCooldowns(unit, 1000)
    advanceStatusDurations(unit, 1000)

    expect(unit.cooldowns[1]).toBe(2000)
    expect(unit.statuses[0].remainingMs).toBe(remaining - 1000)
  })

})

describe('实时状态', () => {
  it('同 id buff 叠层、刷新为本次持续，并保留较强 tick 值', () => {
    const unit = fixtureUnit()
    applyBuff(unit, 3, 1, 'enemy_old', { durationScale: 2, tickValue: 8 })
    advanceStatusDurations(unit, 5000)
    applyBuff(unit, 3, 2, 'enemy_new', { tickValue: 5 })

    expect(unit.statuses).toHaveLength(1)
    expect(unit.statuses[0]).toMatchObject({
      buffId: 3,
      stacks: 3,
      tickValue: 8,
      remainingMs: 15_000,
      sourceId: 'enemy_new',
    })
  })

  it('持续伤害由全局脉冲统一逐次结算', () => {
    const unit = fixtureUnit()
    applyBuff(unit, 3, 1, 'enemy', { tickValue: 5 })

    expect(pulseStatuses(unit).map((tick) => tick.amount)).toEqual([5])
    expect(pulseStatuses(unit).map((tick) => tick.amount)).toEqual([5])
    expect(unit.hp).toBe(90)
  })

  it('time 型状态归零后先移除，不参与同帧状态脉冲', () => {
    const unit = fixtureUnit()
    applyBuff(unit, 3, 1, 'enemy', { tickValue: 5 })
    unit.statuses[0].remainingMs = 1000

    advanceStatusDurations(unit, 1000)

    expect(unit.statuses).toEqual([])
    expect(pulseStatuses(unit)).toEqual([])
    expect(unit.hp).toBe(100)
  })

  it('控制类 buff 使有效速度为 0', () => {
    const unit = fixtureUnit({ gauge: 0 })
    applyBuff(unit, 2, 1, 'enemy')
    expect(isControlled(unit)).toBe(true)
    expect(effectiveSpeed(unit)).toBe(0)
    advanceGaugeAndCooldowns(unit, 1000)
    expect(unit.gauge).toBe(0)
  })

  it('射击、防守、远程、近战四种姿态互斥', () => {
    const unit = fixtureUnit()
    applyBuff(unit, 40, 1, 'self')
    applyBuff(unit, 41, 1, 'self')
    applyBuff(unit, 49, 1, 'self')
    applyBuff(unit, 50, 1, 'self')

    expect(unit.statuses.map((status) => status.buffId)).toEqual([50])
  })

  it('不屈同时提供物防修正和持续恢复', () => {
    const unit = fixtureUnit({ hp: 50 })
    applyBuff(unit, 47, 2, 'self', { tickValue: 3 })

    expect(buffAttributeBonus(unit, 116)).toBe(4)
    expect(pulseStatuses(unit).map((tick) => tick.amount)).toEqual([-6])
    expect(unit.hp).toBe(56)
  })
})
