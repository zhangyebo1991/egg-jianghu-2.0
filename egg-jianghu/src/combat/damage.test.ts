import { describe, expect, it } from 'vitest'
import type { HeroDefinitionV10 } from '../content/heroes'
import { createHeroProgress } from '../domain/state'
import { calculateDamage, evadeChance, hitChance } from './damage'
import { buildCombatStats } from './stats'

describe('战斗面板与伤害乘区', () => {
  it('使用 A²/(A+D) 并按层乘算', () => {
    expect(calculateDamage({
      attack: 100,
      defense: 100,
      power: 2,
      additive: 0.5,
      critical: 1,
      momentum: 0,
      reduction: 0,
      vulnerability: 0,
      final: 0,
    })).toBe(150)
  })

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

  it('命中率钳制 30%～100%，闪避率不超过 70%', () => {
    expect(hitChance(-99)).toBe(0.3)
    expect(hitChance(99)).toBe(1)
    expect(evadeChance(99)).toBe(0.7)
    expect(evadeChance(-1)).toBe(0)
  })
})
