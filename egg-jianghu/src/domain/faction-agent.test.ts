import { describe, expect, it } from 'vitest'
import { PLAYER_HERO_ID } from '../content/heroes'
import { createHeroProgress, createNewGameStateV10 } from './state'
import {
  appointFactionAgent,
  dismissFactionAgent,
  factionAgentCandidateIds,
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

  it('任命与替换都会按原版自动开启代理人', () => {
    const state = recruitedState()

    expect(appointFactionAgent(state, 'world_01', 'hero_guo_jing')).toEqual({
      ok: true,
      message: '已任命郭靖为位面代理人',
    })
    expect(state.factionAgents.world_01).toEqual({ heroId: 'hero_guo_jing', enabled: true })

    state.factionAgents.world_01.enabled = false
    expect(appointFactionAgent(state, 'world_01', 'hero_mu_nianci').ok).toBe(true)
    expect(state.factionAgents.world_01).toEqual({ heroId: 'hero_mu_nianci', enabled: true })
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

  it('开关独立保存，卸任按原版清空角色并保留开启状态', () => {
    const state = recruitedState()
    expect(toggleFactionAgent(state, 'world_01').message).toBe('已开启位面代理人')
    expect(state.factionAgents.world_01).toEqual({ heroId: null, enabled: true })
    expect(toggleFactionAgent(state, 'world_01').message).toBe('已关闭位面代理人')

    appointFactionAgent(state, 'world_01', 'hero_guo_jing')
    expect(dismissFactionAgent(state, 'world_01').message).toBe('已卸任当前位面代理人')
    expect(state.factionAgents.world_01).toEqual({ heroId: null, enabled: true })
    expect(dismissFactionAgent(state, 'world_01').message).toBe('当前位面尚未任命代理人')
  })
})
