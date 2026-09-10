/**
 * 原版回复公式：表达式 10728 为生命分支，10729 为法术分支。
 *
 * 所有加成参数均为面板百分比，函数内部转换为倍率。attack 已包含对应的
 * 攻击修正与职业编码 6。原版最终统一 floor，并保底 1。
 */

interface SharedSupportMultipliers {
  attack: number
  skillCoeff: number
  factionPower: number
  elementPower: number
  elementDamage: number
  specialization: number
  mastery: number
  buffMultiplier: number
}

export interface HealingMultipliers extends SharedSupportMultipliers {
  /** 原版 jn[26] 为“生命”时，治疗加成独立相乘；法术治疗合并到加法池。 */
  healingStat?: 'health' | 'internalAttack'
  healingBonus: number
  receivedHealing: number
  healingReduction: number
}

export interface ShieldMultipliers extends SharedSupportMultipliers {
  shieldBonus: number
  shieldReduction: number
}

/** 原版 clamp((100 + value) / 100, 0, Infinity)。 */
export const supportBonusFactor = (value: number): number => Math.max(0, 1 + value / 100)

/** 原版 clamp((100 - value) / 100, 0, Infinity)。负值会令倍率高于 1，保留原版行为。 */
const supportReductionFactor = (value: number): number => Math.max(0, 1 - value / 100)

/** 原版攻击修正：显示属性 × clamp((100 + 修正) / 100, 0, Infinity) × 职业系数。 */
export const calculateModifiedSupportStat = (
  displayedStat: number,
  statModifier: number,
  careerCoefficient: number,
): number => Math.max(0, displayedStat) * supportBonusFactor(statModifier) * careerCoefficient

/** 回复计算function：生命治疗独立乘治疗加成，法术治疗合并加法池。 */
export const calculateHealing = (m: HealingMultipliers): number => {
  const groupPower = supportBonusFactor(m.factionPower) + supportBonusFactor(m.elementPower) - 1
  const additivePower = [m.elementDamage, m.specialization, m.mastery]
    .reduce((sum, value) => sum + supportBonusFactor(value), -2)
  const enhance = Math.max(1, supportBonusFactor(m.buffMultiplier))
  const healingPower = m.healingStat === 'health'
    ? supportBonusFactor(m.healingBonus) * additivePower
    : additivePower + supportBonusFactor(m.healingBonus) - 1
  const amount = m.attack
    * m.skillCoeff
    * groupPower
    * healingPower
    * supportBonusFactor(m.receivedHealing)
    * supportReductionFactor(m.healingReduction)
    * enhance

  return Math.max(1, Math.floor(amount))
}

/** 护盾计算function：护盾加成与元素/专精/熟练处在同一加法池。 */
export const calculateShield = (m: ShieldMultipliers): number => {
  const groupPower = supportBonusFactor(m.factionPower) + supportBonusFactor(m.elementPower) - 1
  const additivePower = [m.shieldBonus, m.elementDamage, m.specialization, m.mastery]
    .reduce((sum, value) => sum + supportBonusFactor(value), -3)
  const enhance = Math.max(1, supportBonusFactor(m.buffMultiplier))
  const amount = m.attack
    * m.skillCoeff
    * groupPower
    * additivePower
    * supportReductionFactor(m.shieldReduction)
    * enhance

  return Math.max(1, Math.floor(amount))
}
