import { describe, expect, it } from 'vitest'
import { buildCombatParty } from './game-session'
import { createNewGameStateV10 } from '../domain/state'
import { equipMartial, unequipMartial } from '../domain/martial-training'
import { martialByIdV10, martialEffectAtLevel } from '../content/martials'
import { unitSkillById } from '../combat/skill-ai'
import { createCombatEngine } from '../combat/engine'

describe('携带武学进入实战', () => {
  it('装入的技能由自动战斗实际施放并结算命中', () => {
    const state = createNewGameStateV10('配招测试')
    const hero = state.heroes.hero_player
    state.formation = [{ heroId: 'hero_player', row: 0, col: 0 }]
    hero.learnedMartials.original_skill_42 = { level: 1, investedSp: 0, invested: { worldCurrency: {}, contribution: {} } }
    equipMartial(state, 'hero_player', 'original_skill_42', 0)
    const unit = buildCombatParty(state)[0]
    unit.energy = 5
    unit.gauge = 1000
    const engine = createCombatEngine({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 13, party: [unit] })
    const events = engine.advance(5000)
    expect(events.some((event) => event.type === 'skill-used' && event.sourceId === unit.id && event.skillId === 42)).toBe(true)
    expect(events.some((event) => event.type === 'skill-effect' && event.sourceId === unit.id && event.skillId === 42)).toBe(true)
  })

  it('只携带指定槽位的已学技能，替换和卸下不删除学习记录', () => {
    const state = createNewGameStateV10('配招测试')
    const hero = state.heroes.hero_player
    state.formation = [{ heroId: 'hero_player', row: 0, col: 0 }]
    for (const id of [42, 43, 44]) hero.learnedMartials[`original_skill_${id}`] = {
      level: 10, investedSp: 0, invested: { worldCurrency: {}, contribution: {} },
    }
    expect(equipMartial(state, 'hero_player', 'original_skill_42', 2).ok).toBe(true)
    expect(equipMartial(state, 'hero_player', 'original_skill_43', 0).ok).toBe(true)
    const unit = buildCombatParty(state)[0]
    expect(unit.skillIds).toEqual([43, 42])
    expect(unitSkillById(unit, 42)?.powerPercent).toBe(martialEffectAtLevel(martialByIdV10('original_skill_42')!, 10))
    expect(equipMartial(state, 'hero_player', 'original_skill_44', 2).ok).toBe(true)
    expect(unequipMartial(state, 'hero_player', 0).ok).toBe(true)
    expect(buildCombatParty(state)[0].skillIds).toEqual([44])
    expect(Object.keys(hero.learnedMartials)).toHaveLength(3)
    expect(unit.skillIds).toEqual([43, 42])
    hero.learnedMartials.original_skill_42.level = 1
    expect(unit.skillLevels?.[42]).toBe(10)
  })

  it('无效技能和仅持有永久资格的技能不进入战斗', () => {
    const state = createNewGameStateV10('配招测试')
    const hero = state.heroes.hero_player
    state.formation = [{ heroId: 'hero_player', row: 0, col: 0 }]
    hero.permanentMartialIds = ['original_skill_42']
    hero.equippedMartialIds = ['original_skill_42', 'missing', null, null]
    expect(buildCombatParty(state)[0].skillIds).toEqual([])
    expect(equipMartial(state, 'hero_player', 'original_skill_42', 0).ok).toBe(false)
  })
})
