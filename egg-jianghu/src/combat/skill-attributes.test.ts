import originalRuntimeEvidence from '../../../docs/evidence/original-world/all-skills-runtime-audit.json?raw'
import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_BY_ID } from '../content/attributes'
import { COMBAT_SKILLS } from '../content/skills'
import { heroByIdV10 } from '../content/heroes'
import { createNewGameStateV10 } from '../domain/state'
import { buildCombatParty } from '../app/game-session'
import { buildCombatStats, equippedSkillAttributes, skillAttributeValue } from './stats'

const evidence = JSON.parse(originalRuntimeEvidence)
const attributeFunction = evidence.find((entry: { name: string }) => entry.name === '通用单条属性function')
const expressions: string[] = attributeFunction.operations
  .filter((op: { reference: string }) => op.reference.endsWith('.SetFunctionReturnValue'))
  .map((op: { parameters: string[] }) => op.parameters[0])
const affected = Object.values(COMBAT_SKILLS).filter(skill => skill.equippedAttributes?.length)

describe('原版技能装配属性', () => {
  it('263个技能的全部装配属性在多个等级逐一重放原版表达式', () => {
    expect(affected).toHaveLength(263)
    for (const skill of affected) for (const modifier of skill.equippedAttributes ?? []) for (const level of [1, 10, 50]) {
      const attribute = ATTRIBUTE_BY_ID[modifier.sxId]
      const expression = expressions.find(value => value.includes(attribute.calcType === '增幅' ? '100 * 原始等级' : '1000 * 原始等级'))!
      expect(expression).toBeDefined()
      const context = {
        multiply: (a: number, b: number) => a * b,
        divide: (a: number, b: number) => a / b,
        sx: { At: () => attribute.default },
        属性编号: modifier.sxId, 原始等级: level, 技能等阶: skill.skillTier, 品质系数: modifier.coefficient,
      }
      const expected = Function(...Object.keys(context), `return (${expression})`)(...Object.values(context))
      expect(skillAttributeValue(modifier.sxId, modifier.coefficient, level, skill.skillTier)).toBe(expected)
    }
  })

  it('主动野球拳装配后增加物攻，升级与卸下同时更新面板和战斗', () => {
    const state = createNewGameStateV10('装配属性')
    const hero = state.heroes.hero_player
    const definition = heroByIdV10('hero_player')!
    state.formation = [{ heroId: 'hero_player', row: 0, col: 0 }]
    const baseline = buildCombatStats(definition, hero)
    hero.learnedMartials.original_skill_42 = { level: 10, investedSp: 0, invested: { worldCurrency: {}, contribution: {} } }
    hero.equippedMartialIds[0] = 'original_skill_42'
    expect(equippedSkillAttributes(hero)[133]).toBe(3.5)
    expect(equippedSkillAttributes(hero, { 76: 2 })[133]).toBe(4.2)
    const equipped = buildCombatStats(definition, hero)
    expect(equipped.externalAttack).toBeGreaterThan(baseline.externalAttack)
    const unit = buildCombatParty(state)[0]
    expect(unit.externalAttack).toBe(equipped.externalAttack)
    expect(unit.attributes[8]).toBe(equipped.externalAttack)
    expect(unit.attributes[133]).toBe(3.5)
    hero.learnedMartials.original_skill_42.level = 20
    expect(buildCombatStats(definition, hero).externalAttack).toBeGreaterThan(equipped.externalAttack)
    hero.equippedMartialIds[0] = null
    expect(buildCombatStats(definition, hero)).toEqual(baseline)
  })

  it('原版品质系数120不等于120%加成，经验属性也走技能专用公式', () => {
    expect(skillAttributeValue(131, 120, 1, 8)).toBe(4.43)
    expect(skillAttributeValue(40, 100, 1, 6)).toBe(3.76)
  })
})
