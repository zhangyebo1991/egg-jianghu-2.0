import { describe, expect, it } from 'vitest'
import { buyCareerToken, learnCityMartial, spend } from './city'
import { equipEquipment, toggleEquipmentLock } from './inventory'
import { upgradeMartial } from './martial-training'
import { recruitFromFaction } from './recruitment'
import { createHeroProgress, createInitialStateV10 } from './state'
import type { EquipmentInstance, GameStateV10 } from './types'

const stateWithHero = (): GameStateV10 => {
  const state = createInitialStateV10(0)
  state.heroes.hero_shen_yanqiu = createHeroProgress('sword')
  return state
}

const unlockedThrough = (worldIndex: number): GameStateV10 => {
  const state = stateWithHero()
  state.unlockedWorldIds = Array.from({ length: worldIndex }, (_, index) => `world_${String(index + 1).padStart(2, '0')}`)
  for (const worldId of state.unlockedWorldIds) state.worldCurrency[worldId] = 10_000
  return state
}

const equipment = (uid: string, definitionId: string, locked = false): EquipmentInstance => ({
  uid,
  definitionId,
  level: 1,
  quality: '凡品',
  affixes: [],
  locked,
})

describe('城市、势力与装备操作', () => {
  it('城市武馆消耗当前卷货币学习当地通用武功', () => {
    const state = unlockedThrough(3)
    state.worldCurrency.world_03 = 600

    const result = learnCityMartial(state, 'hero_shen_yanqiu', 'world_03_common_sword_01')

    expect(result.ok).toBe(true)
    expect(state.worldCurrency.world_03).toBe(300)
    expect(state.heroes.hero_shen_yanqiu.learnedMartials.world_03_common_sword_01.level).toBe(1)
  })

  it('势力侠客消耗贡献直接邀请', () => {
    const state = createInitialStateV10(0)
    state.contribution.qingfeng_hall = 800

    expect(recruitFromFaction(state, 'qingfeng_hall', 'hero_qingfeng_hall').ok).toBe(true)
    expect(state.contribution.qingfeng_hall).toBe(0)
    expect(state.heroes.hero_qingfeng_hall.recruited).toBe(true)
  })

  it('顶级转职信物只在配置的更高世界出售', () => {
    const state = unlockedThrough(3)
    expect(buyCareerToken(state, 'world_03', 'token_sword_swift_top').ok).toBe(false)

    const later = unlockedThrough(7)
    expect(buyCareerToken(later, 'world_07', 'token_sword_swift_top').ok).toBe(true)
    expect(later.careerTokens).toContain('token_sword_swift_top')
  })

  it('失败交易不会留下部分扣款或升级', () => {
    const state = stateWithHero()
    state.heroes.hero_shen_yanqiu.learnedMartials.qingfeng_hall_a1 = {
      level: 1,
      invested: { worldCurrency: {}, contribution: { qingfeng_hall: 80 } },
    }
    state.contribution.qingfeng_hall = 0
    const before = structuredClone(state)

    expect(upgradeMartial(state, 'hero_shen_yanqiu', 'qingfeng_hall_a1').ok).toBe(false)
    expect(state).toEqual(before)
    expect(spend(state.worldCurrency, 'world_01', 1_000_000).ok).toBe(false)
  })

  it('装备校验部位和占用关系，锁定不禁止穿戴', () => {
    const state = stateWithHero()
    state.heroes.hero_huo_chuan = createHeroProgress('blade')
    state.inventory.push(equipment('weapon_uid', 'world_01_weapon', true))

    expect(equipEquipment(state, 'hero_shen_yanqiu', 'weapon_uid').ok).toBe(true)
    expect(state.heroes.hero_shen_yanqiu.equipmentBySlot.weapon).toBe('weapon_uid')
    expect(equipEquipment(state, 'hero_huo_chuan', 'weapon_uid').ok).toBe(false)
    expect(toggleEquipmentLock(state, 'weapon_uid').ok).toBe(true)
    expect(state.inventory[0].locked).toBe(false)
  })
})
