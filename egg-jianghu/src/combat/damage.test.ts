import { describe, expect, it } from 'vitest'
import { equipmentIdBySlot } from '../content/equipment'
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
  it('命中率 = clamp(97×(100+命中修正)/(100+闪避修正), 30, 100)，闪避率互补', () => {
    expect(hitChance(0, 0)).toBeCloseTo(0.97) // 白板：97% 命中
    expect(evadeRate(0, 0)).toBeCloseTo(0.03) // 3% 闪避
    expect(hitChance(100, 100)).toBeCloseTo(0.97) // 修正相等相互抵消，恒 97%
    expect(hitChance(300, 0)).toBeCloseTo(0.3) // 最低真实命中率 30%
    expect(evadeRate(300, 0)).toBeCloseTo(0.7)
    expect(hitChance(0, 300)).toBeCloseTo(1) // 命中上限 100%
  })

  it('暴击判定：几率阈值与裸系数 sx13/100（白板 5% / 150 → 1.5 倍）', () => {
    expect(rollCritical(5, 150, 0.03).isCritical).toBe(true) // 3% < 5%
    expect(rollCritical(5, 150, 0.03).coefficient).toBeCloseTo(1.5) // 150/100
    expect(rollCritical(5, 150, 0.5).isCritical).toBe(false)
    expect(rollCritical(5, 150, 0.5).coefficient).toBe(1)
  })
})

describe('战斗面板派生（egg 现有模型，Phase 3 起切换诸天派生）', () => {
  it('职业六维系数进入攻防与速度，圆满池恒为 0', () => {
    const definition: HeroDefinitionV10 = {
      id: 'fixture',
      name: '测试侠客',
      grade: '乙',
      baseCareerId: 'job_1',
      worldId: 'world_01',
      source: 'tavern',
      cost: 0,
      factionId: null,
      aptitudes: { strength: 12, insight: 6, constitution: 10, agility: 8, resolve: 7 },
    }
    const progress = createHeroProgress('job_1')
    const baseline = buildCombatStats(definition, progress)
    progress.currentCareerId = 'job_5'
    progress.careers.job_5 = { level: 1, experience: 0 }

    const archer = buildCombatStats(definition, progress)

    expect(archer.externalAttack).toBeGreaterThan(baseline.externalAttack)
    expect(archer.effectiveAgility).toBeLessThan(baseline.effectiveAgility)
    expect(archer.perfectedBonusPool).toBe(0)
  })

  it('白板号参考面板对齐白丁成长系数', () => {
    const definition: HeroDefinitionV10 = {
      id: 'fixture', name: '白板号', grade: '乙', baseCareerId: 'job_1', worldId: 'world_01',
      source: 'tavern', cost: 0, factionId: null,
      aptitudes: { strength: 10, insight: 10, constitution: 10, agility: 10, resolve: 10 },
    }
    const stats = buildCombatStats(definition, createHeroProgress('job_1'))

    expect(stats.maxHp).toBe(580)
    expect(stats.effectiveAgility).toBe(135)
    expect(stats.externalDefense).toBe(52)
    expect(stats.internalAttack).toBe(105)
    expect(stats.internalDefense).toBe(52)
    expect(stats.externalAttack).toBe(105)
  })

  it('已穿戴装备的基础属性与词条进入战斗面板', () => {
    const definition: HeroDefinitionV10 = {
      id: 'fixture', name: '测试侠客', grade: '乙', baseCareerId: 'job_1', worldId: 'world_01',
      source: 'tavern', cost: 0, factionId: null,
      aptitudes: { strength: 10, insight: 8, constitution: 8, agility: 8, resolve: 8 },
    }
    const progress = createHeroProgress('job_1')
    const baseline = buildCombatStats(definition, progress)
    progress.equipmentBySlot.weapon = 'weapon_uid'
    const equipment: EquipmentInstance[] = [{
      uid: 'weapon_uid', definitionId: equipmentIdBySlot('weapon'), level: 1, quality: 2,
      coreStats: [{ attributeId: 8, coefficient: 180 }, { attributeId: 6, coefficient: 80 }],
      affixes: [{ attributeId: 8, coefficient: 100 }], locked: true,
    }]

    expect(buildCombatStats(definition, progress, equipment).externalAttack).toBeGreaterThan(baseline.externalAttack)
  })

  it('护腕双核心按原版映射进入生命与法防', () => {
    const definition: HeroDefinitionV10 = {
      id: 'fixture', name: '测试侠客', grade: '乙', baseCareerId: 'job_1', worldId: 'world_01',
      source: 'tavern', cost: 0, factionId: null,
      aptitudes: { strength: 8, insight: 8, constitution: 8, agility: 8, resolve: 8 },
    }
    const progress = createHeroProgress('job_1')
    const baseline = buildCombatStats(definition, progress)
    progress.equipmentBySlot.wrist = 'wrist_uid'
    const wrist: EquipmentInstance = {
      uid: 'wrist_uid', definitionId: equipmentIdBySlot('wrist'), level: 1, quality: 1,
      coreStats: [{ attributeId: 6, coefficient: 120 }, { attributeId: 11, coefficient: 80 }],
      affixes: [], locked: false,
    }

    const equipped = buildCombatStats(definition, progress, [wrist])
    expect(equipped.maxHp).toBeGreaterThan(baseline.maxHp)
    expect(equipped.internalDefense).toBeGreaterThan(baseline.internalDefense)
  })

  it('战斗面板只计入当前装备套，其他套不生效', () => {
    const definition: HeroDefinitionV10 = {
      id: 'fixture', name: '测试侠客', grade: '乙', baseCareerId: 'job_1', worldId: 'world_01',
      source: 'tavern', cost: 0, factionId: null,
      aptitudes: { strength: 10, insight: 8, constitution: 8, agility: 8, resolve: 8 },
    }
    const progress = createHeroProgress('job_1')
    const baseline = buildCombatStats(definition, progress)
    const equipment: EquipmentInstance[] = [{
      uid: 'weapon_uid', definitionId: equipmentIdBySlot('weapon'), level: 1, quality: 2,
      coreStats: [], affixes: [{ attributeId: 8, coefficient: 100 }], locked: true,
    }]
    progress.equipmentSets[1].weapon = 'weapon_uid'
    progress.activeEquipmentSetIndex = 0
    progress.equipmentBySlot = progress.equipmentSets[0]

    expect(buildCombatStats(definition, progress, equipment).externalAttack).toBe(baseline.externalAttack)

    progress.activeEquipmentSetIndex = 1
    progress.equipmentBySlot = progress.equipmentSets[1]
    expect(buildCombatStats(definition, progress, equipment).externalAttack).toBeGreaterThan(baseline.externalAttack)
  })
})
