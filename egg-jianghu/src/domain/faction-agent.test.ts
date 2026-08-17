import { describe, expect, it } from 'vitest'
import { PLAYER_HERO_ID, heroByIdV10 } from '../content/heroes'
import {
  ORIGINAL_ABILITY_ID_STRATEGY,
  originalHeroAbilityBase,
} from '../content/original-hero-abilities.generated'
import { createHeroProgress, createNewGameStateV10 } from './state'
import {
  applyFactionQuestAgentReward,
  appointFactionAgent,
  dismissFactionAgent,
  factionAgentAbilityLevel,
  factionAgentCandidateIds,
  originalAbilityAttributeBonus,
  originalFinalAbilityLevel,
  toggleFactionAgent,
} from './faction-agent'

const recruitedState = () => {
  const state = createNewGameStateV10('少侠', 1000)
  state.heroes.hero_guo_jing = createHeroProgress('job_1')
  state.heroes.hero_mu_nianci = createHeroProgress('job_1')
  return state
}

describe('位面代理人', () => {
  it('候选只包含已招募的非主角侠客', () => {
    const state = recruitedState()
    state.heroes.hero_mu_nianci.recruited = false

    expect(factionAgentCandidateIds(state)).toEqual(['hero_guo_jing'])
    expect(factionAgentCandidateIds(state)).not.toContain(PLAYER_HERO_ID)
  })

  it('任命与替换都按原版把自动化开关置为关闭', () => {
    const state = recruitedState()

    // 原版 Event 11656 在写入角色列后把开关列写为 1，而开关列 1 = 关闭。
    expect(appointFactionAgent(state, 'world_01', 'hero_guo_jing')).toEqual({
      ok: true,
      message: '已任命郭靖为位面代理人',
    })
    expect(state.factionAgents.world_01).toEqual({ heroId: 'hero_guo_jing', enabled: false })

    state.factionAgents.world_01.enabled = true
    expect(appointFactionAgent(state, 'world_01', 'hero_mu_nianci').ok).toBe(true)
    expect(state.factionAgents.world_01).toEqual({ heroId: 'hero_mu_nianci', enabled: false })
  })

  it('拒绝未招募、主角、战斗中侠客和未解锁位面', () => {
    const state = recruitedState()

    expect(appointFactionAgent(state, 'world_01', 'hero_unknown').message).toBe('该侠客尚未加入')
    expect(appointFactionAgent(state, 'world_01', PLAYER_HERO_ID).message).toBe('主角不能担任位面代理人')
    expect(appointFactionAgent(state, 'world_01', 'hero_guo_jing', new Set(['hero_guo_jing'])).message)
      .toBe('该侠客正在战斗中，暂不能任命')
    expect(appointFactionAgent(state, 'world_02', 'hero_guo_jing').message).toBe('位面尚未解锁')
    expect(state.factionAgents.world_01).toEqual({ heroId: null, enabled: false })
  })

  it('开关独立保存，卸任按原版清空角色并关闭自动化', () => {
    const state = recruitedState()
    expect(toggleFactionAgent(state, 'world_01').message).toBe('已开启位面代理人')
    expect(state.factionAgents.world_01).toEqual({ heroId: null, enabled: true })
    expect(toggleFactionAgent(state, 'world_01').message).toBe('已关闭位面代理人')

    appointFactionAgent(state, 'world_01', 'hero_guo_jing')
    expect(dismissFactionAgent(state, 'world_01').message).toBe('已卸任当前位面代理人')
    // 原版卸任分支同样把开关列写为 1（= 关闭）。
    expect(state.factionAgents.world_01).toEqual({ heroId: null, enabled: false })
    expect(dismissFactionAgent(state, 'world_01').message).toBe('当前位面尚未任命代理人')
  })

  it('复算最终能力等级并按计略乘任务奖励', () => {
    expect(originalFinalAbilityLevel(0, 4)).toBe(4)
    expect(originalFinalAbilityLevel(4, 2)).toBe(5)
    expect(originalFinalAbilityLevel(0, 0, 1.4)).toBe(1)

    const state = recruitedState()
    expect(factionAgentAbilityLevel(state, 'world_01')).toBe(0)
    expect(applyFactionQuestAgentReward({ currency: 100, contribution: 450, reputation: 4 }, 0))
      .toEqual({ currency: 100, contribution: 450, reputation: 4 })

    appointFactionAgent(state, 'world_01', 'hero_guo_jing')
    state.heroes.hero_guo_jing.abilityTraining = { 9: 4 }
    expect(factionAgentAbilityLevel(state, 'world_01')).toBe(4)
    expect(applyFactionQuestAgentReward({ currency: 100, contribution: 450, reputation: 4 }, 4))
      .toEqual({ currency: 100, contribution: 540, reputation: 4 })
  })

  it('白板按原版角色列取值，自创侠客无原版对应记 0', () => {
    // 原版真值锚点（js.json 第 20 列，即 11 + 能力 9）。
    expect(originalHeroAbilityBase(12, ORIGINAL_ABILITY_ID_STRATEGY)).toBe(4) // 诸葛亮
    expect(originalHeroAbilityBase(9, ORIGINAL_ABILITY_ID_STRATEGY)).toBe(2) // 关羽
    expect(originalHeroAbilityBase(175, ORIGINAL_ABILITY_ID_STRATEGY)).toBe(5) // 洛基，clamp 上限
    // 主角在原版能力白板全为 0，0 是真值而非缺省。
    expect(heroByIdV10(PLAYER_HERO_ID)?.sourceId).toBe(1)
    expect(originalHeroAbilityBase(1, ORIGINAL_ABILITY_ID_STRATEGY)).toBe(0)
    // 自创侠客无 sourceId：原版无此角色，白板 0；越界能力编号同样记 0。
    expect(heroByIdV10('hero_guo_jing')?.sourceId).toBeUndefined()
    expect(originalHeroAbilityBase(undefined, ORIGINAL_ABILITY_ID_STRATEGY)).toBe(0)
    expect(originalHeroAbilityBase(12, 0)).toBe(0)
    expect(originalHeroAbilityBase(12, 11)).toBe(0)

    // 白板与培养相加后仍受 clamp(0, 5) 约束。
    expect(originalFinalAbilityLevel(originalHeroAbilityBase(12, ORIGINAL_ABILITY_ID_STRATEGY), 2)).toBe(5)
  })

  it('装备加成按原版「固定」类语义每条记 1，不使用词条数值', () => {
    const state = recruitedState()
    appointFactionAgent(state, 'world_01', 'hero_guo_jing')
    const progress = state.heroes.hero_guo_jing

    expect(originalAbilityAttributeBonus(progress, state.inventory, ORIGINAL_ABILITY_ID_STRATEGY)).toBe(0)

    // 孙子兵法 wp#215 的 fixedEffects 为 [{110, 50}, {43, 50}]；
    // 计略等级是「固定」类属性，原版每条命中恒定 +1，与该 50 无关。
    state.inventory.push({
      uid: 'eq_sunzi',
      definitionId: 'wp_215',
      level: 1,
      quality: 8,
      coreStats: [],
      affixes: [],
      locked: false,
    })
    progress.equipmentBySlot.treasure = 'eq_sunzi'

    expect(originalAbilityAttributeBonus(progress, state.inventory, ORIGINAL_ABILITY_ID_STRATEGY)).toBe(1)
    expect(factionAgentAbilityLevel(state, 'world_01')).toBe(1)

    // 三项叠加后仍受上限约束：白板 0 + 培养 4 + 装备 1 = 5。
    progress.abilityTraining = { 9: 4 }
    expect(factionAgentAbilityLevel(state, 'world_01')).toBe(5)

    // sx101 是「仪器增伤」而非能力组（能力 1..10 对应 sx 102..111），非「固定」类记 0。
    expect(originalAbilityAttributeBonus(progress, state.inventory, 0)).toBe(0)
  })
})
