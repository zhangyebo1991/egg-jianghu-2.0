import { describe, expect, it } from 'vitest'
import { skillRangeById } from '../content/skill-ranges'
import { skillById } from '../content/skills'
import { selectSkill, selectSkillTargets } from './skill-ai'
import {
  attackTargetPriority,
  firstEmptySlot,
  formationSlot,
  selectSkillRangeTargets,
} from './targeting'
import type { CombatSummon, CombatUnit } from './types'

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

const skill = (id: number) => {
  const result = skillById(id)
  if (!result) throw new Error(`测试缺少技能 ${id}`)
  return result
}

const range = (id: number) => {
  const result = skillRangeById(id)
  if (!result) throw new Error(`测试缺少范围 ${id}`)
  return result
}

const slotUnit = (slot: number, overrides: Partial<CombatUnit> = {}): CombatUnit => unit({
  id: `slot-${slot}`,
  row: Math.floor((slot - 1) / 5) as 0 | 1 | 2,
  col: ((slot - 1) % 5) as 0 | 1 | 2 | 3 | 4,
  formationOrder: slot - 1,
  ...overrides,
})

describe('原版阵位目标选择', () => {
  it('三个发起排使用原版固定攻击优先序', () => {
    expect(attackTargetPriority(0)).toEqual([11, 12, 13, 14, 15, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5])
    expect(attackTargetPriority(1)).toEqual([11, 12, 13, 14, 15, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(attackTargetPriority(2)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])

    const enemies = [slotUnit(1, { side: 'enemy' }), slotUnit(6, { side: 'enemy' })]
    expect(selectSkillTargets(unit({ row: 0 }), skill(1), [], enemies)[0]?.id).toBe('slot-6')
    expect(selectSkillTargets(unit({ row: 1 }), skill(1), [], enemies)[0]?.id).toBe('slot-1')
    expect(selectSkillTargets(unit({ row: 2 }), skill(1), [], enemies)[0]?.id).toBe('slot-1')
  })

  it('我方攻击时小兵与首领并存会跳过首领主目标', () => {
    const actor = unit({ row: 2 })
    const boss = slotUnit(1, { id: 'boss', side: 'enemy', rank: 'boss' })
    const minion = slotUnit(15, { id: 'minion', side: 'enemy' })

    expect(selectSkillTargets(actor, skill(1), [actor], [boss, minion]).map((target) => target.id)).toEqual(['minion'])
    expect(selectSkillTargets(actor, skill(1), [actor], [boss]).map((target) => target.id)).toEqual(['boss'])
  })

  it('直接使用原版 fw 单体、横排、十字与全体矩阵', () => {
    const grid = Array.from({ length: 15 }, (_, index) => slotUnit(index + 1, { side: 'enemy' }))
    const ids = (rangeId: number) => selectSkillRangeTargets(grid, range(rangeId), 8).map(formationSlot)

    expect(ids(1)).toEqual([8])
    expect(ids(16)).toEqual([7, 8, 9])
    expect(ids(17)).toEqual([3, 7, 8, 9, 13])
    expect(ids(33)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
  })

  it('生命治疗以生命比例最低者为核心', () => {
    const actor = slotUnit(8)
    const allies = [
      actor,
      slotUnit(1, { id: 'half', hp: 50, maxHp: 100 }),
      slotUnit(15, { id: 'lowest', hp: 20, maxHp: 200 }),
    ]

    expect(selectSkillTargets(actor, skill(6), allies, []).map((target) => target.id)).toEqual(['lowest'])
  })

  it('我方状态以施法者阵位为核心后应用范围', () => {
    const actor = slotUnit(8, { id: 'actor' })
    const ally = slotUnit(1, { id: 'ally' })

    expect(selectSkillTargets(actor, skill(61), [ally, actor], []).map((target) => target.id)).toEqual(['actor'])
  })

  it('加能量选择非召唤单位中攻击最高者为核心', () => {
    const actor = slotUnit(8, { id: 'actor', externalAttack: 30 })
    const strongest = slotUnit(3, { id: 'strongest', externalAttack: 90 })
    const summon = slotUnit(1, { id: 'summon_1', externalAttack: 999 })

    expect(selectSkillTargets(actor, skill(121), [actor, strongest, summon], []).map((target) => target.id)).toEqual(['strongest'])
  })

  it('复活按阵位号选择首个阵亡单位', () => {
    const actor = slotUnit(8)
    const late = slotUnit(15, { id: 'late', alive: false, hp: 0 })
    const first = slotUnit(2, { id: 'first', alive: false, hp: 0 })

    expect(selectSkillTargets(actor, skill(64), [actor, late, first], []).map((target) => target.id)).toEqual(['first'])
  })

  it('召唤空位使用原版固定优先序', () => {
    const occupied = [slotUnit(1), slotUnit(11), slotUnit(6)]
    expect(firstEmptySlot(occupied)).toEqual({ row: 0, col: 1 })
  })

  it('每个施法者分别计算自己的存活召唤上限', () => {
    const first = slotUnit(1, { id: 'first', skillIds: [72] })
    const second = slotUnit(2, { id: 'second', skillIds: [72] })
    const firstSummon: CombatSummon = {
      ...slotUnit(3, { id: 'summon_first', side: 'party' }),
      summonerId: first.id,
      remainingMs: 30_000,
    }
    const allies = [first, second, firstSummon]
    const enemies = [slotUnit(15, { id: 'enemy', side: 'enemy' })]

    expect(selectSkill(first, allies, enemies).skill.id).toBe(first.baseAttackId)
    expect(selectSkill(second, allies, enemies).skill.id).toBe(72)
  })
})

describe('四槽行招', () => {
  it('严格选择从左到右第一个可用技能，不把耗能技能提到 0 耗技能前', () => {
    const actor = unit({ energy: 5, skillIds: [32, 74, 10, 47], baseAttackId: 4 })
    const result = selectSkill(actor, [actor], [unit({ id: 'enemy', side: 'enemy' })])
    expect(result.skill.id).toBe(32)
    expect(result.skill.name).toBe('御雷III')
  })

  it('多个 0 耗攻击技能始终选择最左槽位', () => {
    const actor = unit({ energy: 0, skillIds: [31, 32, 10], baseAttackId: 1 })
    const enemies = [unit({ id: 'enemy', side: 'enemy' })]

    expect(Array.from({ length: 5 }, () => selectSkill(actor, [actor], enemies).skill.id)).toEqual([31, 31, 31, 31, 31])
  })

  it('能量达到 5 时跳过自身增加能量技能', () => {
    const actor = unit({ energy: 5, skillIds: [43, 32], baseAttackId: 1 })
    const result = selectSkill(actor, [actor], [unit({ id: 'enemy', side: 'enemy' })])

    expect(result.skill.id).toBe(32)
  })

  it('自身状态已满层且剩余超过 3.5 秒时跳过，临近结束时允许刷新', () => {
    const enemies = [unit({ id: 'enemy', side: 'enemy' })]
    const fullBuff = { buffId: 19, stacks: 5, remainingMs: 3501 }
    const actor = unit({ energy: 5, skillIds: [56, 32], statuses: [fullBuff] })

    expect(selectSkill(actor, [actor], enemies).skill.id).toBe(32)

    actor.statuses[0].remainingMs = 3500
    expect(selectSkill(actor, [actor], enemies).skill.id).toBe(56)
  })

  it('治疗没有受伤目标时跳过并改用攻击技能', () => {
    const actor = unit({ energy: 3, skillIds: [60, 32], baseAttackId: 1 })
    const result = selectSkill(actor, [unit({ id: 'ally', hp: 100, maxHp: 100 })], [unit({ id: 'enemy', side: 'enemy' })])
    expect(result.skill.id).toBe(32)
  })

  it.each([338, 341])('特殊生命治疗技能 %s 在全员满血时仍可释放', (skillId) => {
    const actor = unit({ energy: 5, skillIds: [skillId, 32] })
    const result = selectSkill(actor, [actor], [unit({ id: 'enemy', side: 'enemy' })])

    expect(result.skill.id).toBe(skillId)
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
