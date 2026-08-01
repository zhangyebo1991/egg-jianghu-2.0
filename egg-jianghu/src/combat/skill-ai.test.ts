import { describe, expect, it } from 'vitest'
import { selectSkill, type CombatSkillDefinition } from './skill-ai'
import { selectTargets } from './targeting'
import type { CombatUnit } from './types'

const unit = (overrides: Partial<CombatUnit> = {}): CombatUnit => ({
  id: 'unit',
  name: '测试单位',
  side: 'party',
  row: 'front',
  position: 0,
  formationOrder: 0,
  rank: 'normal',
  alive: true,
  hp: 100,
  maxHp: 100,
  energy: 20,
  maxEnergy: 100,
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
  controlDiminishing: {},
  cooldowns: {},
  statuses: [],
  momentum: {},
  skillIds: [],
  baseSkillId: 'base',
  ...overrides,
})

describe('两排目标选择', () => {
  it('前排存活时普通近战不能选择后排', () => {
    const enemies = [
      unit({ id: 'front', side: 'enemy', row: 'front', position: 0 }),
      unit({ id: 'back', side: 'enemy', row: 'back', position: 0 }),
    ]

    expect(selectTargets(enemies, { shape: 'single', reach: 'melee' }).map((target) => target.row)).toEqual(['front'])
  })

  it('同列与全体目标保持固定站位顺序', () => {
    const enemies = [
      unit({ id: 'back-1', side: 'enemy', row: 'back', position: 1, formationOrder: 4 }),
      unit({ id: 'front-0', side: 'enemy', row: 'front', position: 0, formationOrder: 0 }),
      unit({ id: 'front-1', side: 'enemy', row: 'front', position: 1, formationOrder: 1 }),
    ]

    expect(selectTargets(enemies, { shape: 'column', reach: 'ranged', column: 1 }).map((target) => target.id)).toEqual(['front-1', 'back-1'])
    expect(selectTargets(enemies, { shape: 'all', reach: 'ranged' }).map((target) => target.id)).toEqual(['front-0', 'front-1', 'back-1'])
  })
})

describe('四槽行招', () => {
  const skills: Record<string, CombatSkillDefinition> = {
    heal: {
      id: 'heal', energyCost: 10, cooldownMs: 1000, semantic: 'heal', target: { shape: 'single', reach: 'ranged' },
    },
    expensive: {
      id: 'expensive', energyCost: 50, cooldownMs: 1000, semantic: 'damage', target: { shape: 'single', reach: 'melee' },
    },
    strike: {
      id: 'strike', energyCost: 20, cooldownMs: 1000, semantic: 'damage', target: { shape: 'single', reach: 'melee' },
    },
    base: {
      id: 'base', energyCost: 0, cooldownMs: 0, semantic: 'damage', target: { shape: 'single', reach: 'melee' },
    },
  }

  it('四槽每次行动从第一式检查并跳过非法条件', () => {
    const actor = unit({ energy: 30, skillIds: ['heal', 'expensive', 'strike', null] })
    const allies = [unit({ id: 'ally', hp: 100, maxHp: 100 })]
    const enemies = [unit({ id: 'enemy', side: 'enemy' })]

    const result = selectSkill(actor, allies, enemies, skills)

    expect(result).toEqual({
      skillId: 'strike',
      skipped: [
        { skillId: 'heal', reason: '没有受伤目标' },
        { skillId: 'expensive', reason: '真气不足' },
      ],
    })
  })

  it('四槽都不可用时回退零耗职业基础招式', () => {
    const actor = unit({ energy: 0, skillIds: ['expensive', null, null, null] })

    expect(selectSkill(actor, [actor], [unit({ side: 'enemy' })], skills)).toEqual({
      skillId: 'base',
      skipped: [{ skillId: 'expensive', reason: '真气不足' }],
    })
  })
})
