import { describe, expect, it } from 'vitest'
import { selectSkill } from './skill-ai'
import { selectTargets } from './targeting'
import type { CombatUnit } from './types'

const unit = (overrides: Partial<CombatUnit> = {}): CombatUnit => ({
  id: 'unit',
  name: '测试单位',
  side: 'party',
  row: 1,
  col: 0,
  formationOrder: 5,
  rank: 'normal',
  alive: true,
  hp: 100,
  maxHp: 100,
  shield: 0,
  energy: 5,
  maxEnergy: 5,
  gauge: 1000,
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

describe('三路五列目标选择', () => {
  it('优先攻击同路最前排目标', () => {
    const enemies = [
      unit({ id: 'mid-deep', side: 'enemy', row: 1, col: 3, formationOrder: 23 }),
      unit({ id: 'mid-front', side: 'enemy', row: 1, col: 1, formationOrder: 21 }),
      unit({ id: 'top-frontmost', side: 'enemy', row: 0, col: 0, formationOrder: 15 }),
    ]

    expect(selectTargets(enemies, { shape: 'single', reach: 'melee', sourceRow: 1 }).map((target) => target.id)).toEqual(['mid-front'])
  })

  it('同路没有目标后攻击它路最前排目标，先比列深再比路距', () => {
    const sameColumn = [
      unit({ id: 'mid', side: 'enemy', row: 1, col: 1, formationOrder: 21 }),
      unit({ id: 'bottom', side: 'enemy', row: 2, col: 1, formationOrder: 26 }),
    ]
    expect(selectTargets(sameColumn, { shape: 'single', reach: 'melee', sourceRow: 0 }).map((target) => target.id)).toEqual(['mid'])

    const frontmostWins = [
      unit({ id: 'mid-deep', side: 'enemy', row: 1, col: 2, formationOrder: 22 }),
      unit({ id: 'bottom-front', side: 'enemy', row: 2, col: 0, formationOrder: 25 }),
    ]
    expect(selectTargets(frontmostWins, { shape: 'single', reach: 'ranged', sourceRow: 0 }).map((target) => target.id)).toEqual(['bottom-front'])
  })

  it('同列与全体目标保持固定站位顺序', () => {
    const enemies = [
      unit({ id: 'bottom-1', side: 'enemy', row: 2, col: 1, formationOrder: 26 }),
      unit({ id: 'top-0', side: 'enemy', row: 0, col: 0, formationOrder: 15 }),
      unit({ id: 'top-1', side: 'enemy', row: 0, col: 1, formationOrder: 16 }),
    ]

    expect(selectTargets(enemies, { shape: 'column', reach: 'ranged', column: 1 }).map((target) => target.id)).toEqual(['top-1', 'bottom-1'])
    expect(selectTargets(enemies, { shape: 'all', reach: 'ranged' }).map((target) => target.id)).toEqual(['top-0', 'top-1', 'bottom-1'])
  })

  it('front-row 与 back-row 取各路最前与最后的存活单位', () => {
    const enemies = [
      unit({ id: 'top-front', side: 'enemy', row: 0, col: 1, formationOrder: 16 }),
      unit({ id: 'top-back', side: 'enemy', row: 0, col: 4, formationOrder: 19 }),
      unit({ id: 'mid-only', side: 'enemy', row: 1, col: 2, formationOrder: 22 }),
    ]

    expect(selectTargets(enemies, { shape: 'front-row', reach: 'ranged' }).map((target) => target.id)).toEqual(['top-front', 'mid-only'])
    expect(selectTargets(enemies, { shape: 'back-row', reach: 'ranged' }).map((target) => target.id)).toEqual(['mid-only', 'top-back'])
  })
})

describe('四槽行招', () => {
  it('能量足够时优先释放耗能技能而不是 0 耗普攻', () => {
    const actor = unit({ energy: 5, skillIds: [32, 74, 10, 47], baseAttackId: 4 })
    const result = selectSkill(actor, [actor], [unit({ id: 'enemy', side: 'enemy' })])
    expect(result.skill.id).toBe(47)
    expect(result.skill.name).toBe('战场庇护')
  })

  it('治疗没有受伤目标时跳过并改用攻击技能', () => {
    const actor = unit({ energy: 3, skillIds: [60, 32], baseAttackId: 1 })
    const result = selectSkill(actor, [unit({ id: 'ally', hp: 100, maxHp: 100 })], [unit({ id: 'enemy', side: 'enemy' })])
    expect(result.skill.id).toBe(32)
  })

  it('四槽都不可用时回退职业普攻', () => {
    const actor = unit({ energy: 0, skillIds: [47], baseAttackId: 1 })
    const result = selectSkill(actor, [actor], [unit({ side: 'enemy' })])
    expect(result.skill.id).toBe(1)
  })

  it('方士普攻在有伤员时选择包扎', () => {
    const actor = unit({ energy: 1, skillIds: [], baseAttackId: 6 })
    const wounded = unit({ id: 'wounded', hp: 20, maxHp: 100 })
    const result = selectSkill(actor, [actor, wounded], [unit({ side: 'enemy' })])
    expect(result.skill.id).toBe(6)
    expect(result.skill.behavior).toBe('heal')
  })
})
