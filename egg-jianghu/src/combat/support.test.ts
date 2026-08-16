import { describe, expect, it } from 'vitest'
import { calculateHealing, calculateModifiedSupportStat, calculateShield } from './support'

describe('原版回复与护盾公式', () => {
  it('表达式 10729 的全部乘区得到固定 golden 值', () => {
    expect(calculateHealing({
      attack: 1000,
      skillCoeff: 1.4,
      factionPower: 20,
      elementPower: 30,
      healingBonus: 25,
      elementDamage: 40,
      specialization: 50,
      mastery: 60,
      receivedHealing: 15,
      healingReduction: 20,
      buffMultiplier: 10,
    })).toBe(6641)
  })

  it('表达式 10733 将护盾加成放进元素/专精/熟练加法池', () => {
    expect(calculateShield({
      attack: 1000,
      skillCoeff: 1.4,
      factionPower: 20,
      elementPower: 30,
      shieldBonus: 25,
      elementDamage: 40,
      specialization: 50,
      mastery: 60,
      shieldReduction: 20,
      buffMultiplier: 10,
    })).toBe(5082)
  })

  it('攻击修正与职业编码 6 先合并进基础属性，并保留最低 1', () => {
    expect(calculateModifiedSupportStat(500, 20, 1.5)).toBe(900)
    expect(calculateHealing({
      attack: 0,
      skillCoeff: 0,
      factionPower: 0,
      elementPower: 0,
      healingBonus: 0,
      elementDamage: 0,
      specialization: 0,
      mastery: 0,
      receivedHealing: 0,
      healingReduction: 0,
      buffMultiplier: 0,
    })).toBe(1)
  })
})
