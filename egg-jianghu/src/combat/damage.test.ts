import { describe, expect, it } from 'vitest'
import type { HeroDefinitionV10 } from '../content/heroes'
import { createHeroProgress } from '../domain/state'
import type { EquipmentInstance } from '../domain/types'
import { calculateDamage, evadeRate, hitChance, rollCritical } from './damage'
import { buildCombatStats } from './stats'

describe('诸天 18 乘区伤害公式', () => {
  it('核心 A²/(A+D) × 技能系数 × 加法池（5 路求和）', () => {
    expect(calculateDamage({
      attack: 100, defense: 100, skillCoeff: 2,
      factionPower: 0, elementPower: 0,
      damageType: 50, basicAttack: 0, elementDamage: 0, specialization: 0, mastery: 0,
      typeReduction: 0, elementResist: 0,
      receivedType: 0, receivedElement: 0, receivedAll: 0,
      finalDamage: 0, finalReduction: 0,
      critical: 1, buffMultiplier: 0,
    })).toBe(150) // core 50 × skill 2 × 加法池(1+0.5)
  })

  it('减伤/元素抗性/最终减伤均受 cap 80 保护', () => {
    const invincible = calculateDamage({
      attack: 100, defense: 100, skillCoeff: 1,
      factionPower: 0, elementPower: 0,
      damageType: 0, basicAttack: 0, elementDamage: 0, specialization: 0, mastery: 0,
      typeReduction: 80, elementResist: 80,
      receivedType: 0, receivedElement: 0, receivedAll: 0,
      finalDamage: 0, finalReduction: 80,
      critical: 1, buffMultiplier: 0,
    })
    // core 50 × 0.2(物减) × 0.2(元抗) × 0.2(终层) = 0.4 → 保底 1
    expect(invincible).toBe(1)
  })

  it('暴击为裸系数，最终层 (1+终增−终减) 同括号', () => {
    expect(calculateDamage({
      attack: 100, defense: 0, skillCoeff: 1,
      factionPower: 0, elementPower: 0,
      damageType: 0, basicAttack: 0, elementDamage: 0, specialization: 0, mastery: 0,
      typeReduction: 0, elementResist: 0,
      receivedType: 0, receivedElement: 0, receivedAll: 0,
      finalDamage: 100, finalReduction: 0,
      critical: 1.5, buffMultiplier: 0,
    })).toBe(300) // core 100 × 终伤(1+1) × 暴击裸系数 1.5
  })
})

describe('诸天闪避与暴击判定', () => {
  it('闪避率 = clamp(0.3 + 闪避修正 − 命中修正)，命中率互补且保底 5%', () => {
    expect(evadeRate(5, 5)).toBeCloseTo(0.3) // 默认净闪避 30%
    expect(evadeRate(95, 5)).toBeCloseTo(0.95) // 上限 95%
    expect(evadeRate(0, 99)).toBe(0) // 下限 0
    expect(hitChance(5, 5)).toBeCloseTo(0.7) // 1 − 0.3
    expect(hitChance(95, 5)).toBeCloseTo(0.05) // 命中保底 5%
  })

  it('暴击判定：几率阈值与裸系数 1 + 暴伤/100', () => {
    expect(rollCritical(6, 40, 0.05).isCritical).toBe(true) // 5% < 6%
    expect(rollCritical(6, 40, 0.05).coefficient).toBeCloseTo(1.4) // 1 + 40/100
    expect(rollCritical(6, 40, 0.5).isCritical).toBe(false)
    expect(rollCritical(6, 40, 0.5).coefficient).toBe(1)
  })
})

describe('战斗面板派生（egg 现有模型，Phase 3 起切换诸天派生）', () => {
  it('五维资质决定成长，圆满心得只进入统一加法池', () => {
    const definition: HeroDefinitionV10 = {
      id: 'fixture',
      name: '测试侠客',
      grade: '乙',
      baseCareerId: 'sword',
      worldId: 'world_01',
      source: 'tavern',
      cost: 0,
      factionId: null,
      aptitudes: { strength: 12, insight: 6, constitution: 10, agility: 8, resolve: 7 },
    }
    const progress = createHeroProgress('sword')
    progress.careers.sword.level = 20
    progress.careers.sword.perfected = true
    progress.careers.sword_swift_mid = { level: 20, experience: 0, perfected: true }

    const stats = buildCombatStats(definition, progress)

    expect(stats.externalAttack).toBeGreaterThan(stats.internalAttack)
    expect(stats.perfectedBonusPool).toBeCloseTo(0.1)
  })

  it('已穿戴装备的基础属性与词条进入战斗面板', () => {
    const definition: HeroDefinitionV10 = {
      id: 'fixture', name: '测试侠客', grade: '乙', baseCareerId: 'sword', worldId: 'world_01',
      source: 'tavern', cost: 0, factionId: null,
      aptitudes: { strength: 10, insight: 8, constitution: 8, agility: 8, resolve: 8 },
    }
    const progress = createHeroProgress('sword')
    const baseline = buildCombatStats(definition, progress)
    progress.equipmentBySlot.weapon = 'weapon_uid'
    const equipment: EquipmentInstance[] = [{
      uid: 'weapon_uid', definitionId: 'world_01_weapon', level: 1, quality: '上品',
      affixes: [{ id: 'externalAttack', value: 12 }], locked: true,
    }]

    expect(buildCombatStats(definition, progress, equipment).externalAttack).toBeGreaterThan(baseline.externalAttack)
  })

  it('护腕基础命中正确换算为百分比加成', () => {
    const definition: HeroDefinitionV10 = {
      id: 'fixture', name: '测试侠客', grade: '乙', baseCareerId: 'sword', worldId: 'world_01',
      source: 'tavern', cost: 0, factionId: null,
      aptitudes: { strength: 8, insight: 8, constitution: 8, agility: 8, resolve: 8 },
    }
    const progress = createHeroProgress('sword')
    const baseline = buildCombatStats(definition, progress)
    progress.equipmentBySlot.wrist = 'wrist_uid'
    const wrist: EquipmentInstance = {
      uid: 'wrist_uid', definitionId: 'world_01_wrist', level: 1, quality: '凡品', affixes: [], locked: false,
    }

    expect(buildCombatStats(definition, progress, [wrist]).accuracy).toBeCloseTo(baseline.accuracy + 0.09)
  })
})
