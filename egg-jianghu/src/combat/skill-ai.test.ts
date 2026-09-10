import { describe, expect, it } from 'vitest'
import { skillRangeById } from '../content/skill-ranges'
import { skillById } from '../content/skills'
import { selectSkill, selectSkillTargets, summonLimit, unitSkillById } from './skill-ai'
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

describe('原版技能等级结算', () => {
  it('包扎用职业普攻等级和技能系加成，按原版在倍率乘完后取整', () => {
    // jn6 初始化51，每10级成长10.2；等级10+sx81的2级 => round(62.22)=62。
    const actor = unit({ baseAttackId: 6, skillLevels: { 6: 10 }, attributes: { 81: 2 } })
    expect(unitSkillById(actor, 6)?.powerPercent).toBe(62)
    expect(selectSkill(actor, [actor], []).skill.powerPercent).toBe(62)
  })

  it('敌方不应用我方技能系等级加成，推条也不套威力成长', () => {
    expect(unitSkillById(unit({ side: 'enemy', attributes: { 81: 20 } }), 6)?.powerPercent).toBe(51)
    expect(unitSkillById(unit({ skillLevels: { 217: 30 }, attributes: { 91: 20 } }), 217)?.powerPercent).toBe(35)
  })
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

  it('治疗比例相同时保留先创建的角色，不按阵位或候选数组顺序', () => {
    const actor = slotUnit(8)
    const first = slotUnit(15, { hp: 50, instanceOrder: 1 })
    const later = slotUnit(1, { hp: 100, maxHp: 200, instanceOrder: 2 })
    for (const allies of [[actor, later, first], [first, actor, later]]) {
      expect(selectSkillTargets(actor, skill(6), allies, [])[0]?.id).toBe(first.id)
    }
  })

  it('攻击同值时回能选先创建者，复活重建后失去同值优先权', () => {
    const actor = slotUnit(8, { externalAttack: 10, internalAttack: 10 })
    const first = slotUnit(15, { instanceOrder: 1 })
    const later = slotUnit(1, { instanceOrder: 2 })
    expect(selectSkillTargets(actor, skill(121), [actor, later, first], [])[0]?.id).toBe(first.id)
    first.instanceOrder = 3
    expect(selectSkillTargets(actor, skill(121), [actor, later, first], [])[0]?.id).toBe(later.id)
  })

  it('新召唤物与角色生命比例相同时，低阵位不抢先获得治疗', () => {
    const actor = slotUnit(8, { instanceOrder: 1, hp: 50 })
    const summon = slotUnit(1, { id: 'summon_new', instanceOrder: 2, hp: 50 })
    expect(selectSkillTargets(actor, skill(6), [summon, actor], [])[0]?.id).toBe(actor.id)
  })

  it('群体治疗范围保留满血队友，全员满血也继续释放', () => {
    const actor = slotUnit(8, { skillIds: [168] })
    const wounded = slotUnit(1, { hp: 50 })
    expect(selectSkillTargets(actor, skill(168), [actor, wounded], []).map(target => target.id)).toEqual([wounded.id, actor.id])
    expect(selectSkill(actor, [actor, wounded], []).skill.id).toBe(168)
    wounded.hp = wounded.maxHp
    expect(selectSkill(actor, [actor, wounded], []).skill.id).toBe(168)
  })

  it('能量目标比较物法双攻最大值，不按普攻的物法类型筛选', () => {
    const actor = slotUnit(8, { externalAttack: 90, internalAttack: 30 })
    const strongerMagic = slotUnit(3, { externalAttack: 10, internalAttack: 200, baseAttackId: 1 })
    expect(selectSkillTargets(actor, skill(121), [actor, strongerMagic], [])[0]?.id).toBe(strongerMagic.id)
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

  it('复活选择原版网格循环最后一个阵亡阵位，不受候选数组顺序影响', () => {
    const actor = slotUnit(8)
    const late = slotUnit(15, { id: 'late', alive: false, hp: 0 })
    const first = slotUnit(2, { id: 'first', alive: false, hp: 0 })

    for (const candidates of [[actor, late, first], [first, actor, late]]) {
      expect(selectSkillTargets(actor, skill(64), candidates, []).map((target) => target.id)).toEqual(['late'])
    }
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

  it('治疗没有受伤目标时仍按槽位优先级释放', () => {
    const actor = unit({ energy: 3, skillIds: [60, 32], baseAttackId: 1 })
    const result = selectSkill(actor, [unit({ id: 'ally', hp: 100, maxHp: 100 })], [unit({ id: 'enemy', side: 'enemy' })])
    expect(result.skill.id).toBe(60)
  })

  it.each([44, 50, 128, 331, 338, 341])('治疗技能 %s 在全员满血时仍可释放', (skillId) => {
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


describe('原版群体回能的自动释放条件', () => {
  it.each([123, 261])('技能%i在施法者满能量时仍能释放', id => {
    const actor = unit({ energy: 5, skillIds: [id] })
    expect(selectSkill(actor, [actor], []).skill.id).toBe(id)
  })

  it('单体自身回能在满能量时继续跳过', () => {
    const actor = unit({ energy: 5, skillIds: [43] })
    expect(selectSkill(actor, [actor], []).skill.id).toBe(actor.baseAttackId)
  })
})


describe('原版器魂召唤上限', () => {
  it('器魂125直接返回99，与普通召唤数量属性分支分离', () => {
    expect(summonLimit(unit({ offhandSoulId: 125, attributes: { 32: 99 } }))).toBe(99)
    // 原版sx32上限3，普通我方角色最多1+3；器魂125绕过此属性分支。
    expect(summonLimit(unit({ attributes: { 32: 99 } }))).toBe(4)
    expect(summonLimit(unit({ side: 'enemy', offhandSoulId: 125, attributes: { 32: 2 } }))).toBe(3)
  })
})
