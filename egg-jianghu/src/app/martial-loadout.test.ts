import { describe, expect, it } from 'vitest'
import { buildCombatParty, buildCombatStartInput } from './game-session'
import { createNewGameStateV10 } from '../domain/state'
import { equipMartial, unequipMartial } from '../domain/martial-training'
import { MARTIALS_V10, martialByIdV10, martialEffectAtLevel, martialBuffChanceAtLevel } from '../content/martials'
import { unitSkillById } from '../combat/skill-ai'
import { createCombatEngine } from '../combat/engine'
import { EQUIPMENT_DEFINITIONS } from '../content/equipment'

describe('携带武学进入实战', () => {
  it('所有可学武学的效果说明在超过学习上限后仍与战斗有效等级一致', () => {
    const state = createNewGameStateV10('技能加成')
    state.formation = [{ heroId: 'hero_player', row: 0, col: 0 }]
    const unit = buildCombatParty(state)[0]
    for (const martial of MARTIALS_V10) {
      unit.skillLevels = { [martial.originalSkillId]: martial.maxLevel }
      unit.attributes[75 + martial.skillCategory] = 2
      const skill = unitSkillById(unit, martial.originalSkillId)!
      expect(skill.effectiveLevel, martial.name).toBe(martial.maxLevel + 2)
      if (martial.description.includes('数值')) {
        expect(martialEffectAtLevel(martial, martial.maxLevel + 2), martial.name).toBe(skill.powerPercent)
      }
      if (martial.description.includes('buff几率')) {
        expect(martialBuffChanceAtLevel(martial, martial.maxLevel + 2), martial.name).toBeCloseTo(skill.appliedBuffChance! * 100, 8)
      }
    }
  })
  it('器魂替换普攻使用等级1且不把技能编号误加为属性，卸下恢复职业等级', () => {
    const state = createNewGameStateV10('器魂测试')
    const hero = state.heroes.hero_player
    state.formation = [{ heroId: 'hero_player', row: 0, col: 0 }]
    hero.careers[hero.currentCareerId].level = 10
    const definition = EQUIPMENT_DEFINITIONS.find((item) => item.artifactSoulId === 45)!
    expect(definition).toBeDefined()
    const before = buildCombatParty(state)[0]
    state.inventory.push({ uid: 'soul-test', definitionId: definition.id, level: 1, quality: 1, coreStats: [], affixes: [], locked: false })
    hero.equipmentBySlot[definition.slot] = 'soul-test'
    const equipped = buildCombatParty(state)[0]
    expect(equipped.baseAttackId).toBe(81)
    expect(equipped.skillLevels?.[81]).toBe(1)
    expect(equipped.attributes[81] ?? 0).toBe(before.attributes[81] ?? 0)
    hero.equipmentBySlot[definition.slot] = null
    const restored = buildCombatParty(state)[0]
    expect(restored.baseAttackId).toBe(before.baseAttackId)
    expect(restored.skillLevels?.[restored.baseAttackId]).toBe(10)
  })

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


describe('副手器魂进入战斗', () => {
  it('未上阵角色装备梵行无终不改变战斗输入', () => {
    const state = createNewGameStateV10('跨阵营器魂')
    const definition = EQUIPMENT_DEFINITIONS.find(item => item.artifactSoulId === 123)!
    state.inventory.push({ uid: 'cooldown-soul', definitionId: definition.id, level: 1, quality: 1, coreStats: [], affixes: [], locked: false })
    state.heroes.hero_player.equipmentBySlot.offhand = 'cooldown-soul'
    state.formation = []
    const selection = { worldId: 'world_01', stage: 1, mode: 'guard' as const, seed: 12 }
    const equipped = buildCombatStartInput(state, selection)
    expect(equipped.party).toEqual([])
    state.heroes.hero_player.equipmentBySlot.offhand = null
    expect(buildCombatStartInput(state, selection)).toEqual(equipped)
  })

  it.each([123, 125, 129])('器魂%i只由实际副手槽生效，卸下后消失', soulId => {
    const state = createNewGameStateV10('器魂效果')
    const hero = state.heroes.hero_player
    state.formation = [{ heroId: 'hero_player', row: 0, col: 0 }]
    const definition = EQUIPMENT_DEFINITIONS.find(item => item.artifactSoulId === soulId)!
    expect(definition?.slot).toBe('offhand')
    state.inventory.push({ uid: 'soul-offhand', definitionId: definition.id, level: 1, quality: 1, coreStats: [], affixes: [], locked: false })
    hero.equipmentBySlot.offhand = 'soul-offhand'
    expect(buildCombatParty(state)[0].offhandSoulId).toBe(soulId)
    hero.equipmentBySlot.offhand = null
    expect(buildCombatParty(state)[0].offhandSoulId).toBeUndefined()
  })
})
