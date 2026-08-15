import { describe, expect, it } from 'vitest'
import { equipmentDefinitionById, equipmentIdBySlot } from '../content/equipment'
import { learnCityMartial, spend } from './city'
import { equipEquipment, toggleEquipmentLock } from './inventory'
import { upgradeMartial } from './martial-training'
import { recruitFromFaction } from './recruitment'
import { createHeroProgress, createInitialStateV10 } from './state'
import type { EquipmentInstance, GameStateV10 } from './types'

const stateWithHero = (): GameStateV10 => {
  const state = createInitialStateV10(0)
  state.heroes.hero_mu_nianci = createHeroProgress('sword')
  return state
}

const unlockedThrough = (worldIndex: number): GameStateV10 => {
  const state = stateWithHero()
  state.unlockedWorldIds = Array.from({ length: worldIndex }, (_, index) => `world_${String(index + 1).padStart(2, '0')}`)
  for (const worldId of state.unlockedWorldIds) state.worldCurrency[worldId] = 10_000
  return state
}

const equipment = (uid: string, definitionId: string, locked = false): EquipmentInstance => {
  const definition = equipmentDefinitionById(definitionId)!
  return {
    uid,
    definitionId,
    level: 1,
    quality: 0,
    coreStats: definition.coreStats.map((core) => ({
      attributeId: core.attributeId,
      coefficient: core.baseCoefficient,
    })),
    affixes: [],
    locked,
  }
}

describe('城市、势力与装备操作', () => {
  it('不再混入虚构城市通用武功', () => {
    const state = unlockedThrough(3)
    state.worldCurrency.world_03 = 600
    const before = structuredClone(state)

    const result = learnCityMartial(state, 'hero_mu_nianci', 'world_03_common_sword_01')

    expect(result.ok).toBe(false)
    expect(state).toEqual(before)
  })

  it('势力侠客消耗贡献直接邀请', () => {
    const state = createInitialStateV10(0)
    state.contribution.qingfeng_hall = 800

    expect(recruitFromFaction(state, 'qingfeng_hall', 'hero_qingfeng_hall_01').ok).toBe(true)
    expect(state.contribution.qingfeng_hall).toBe(0)
    expect(state.heroes.hero_qingfeng_hall_01.recruited).toBe(true)
  })

  it('失败交易不会留下部分扣款或升级', () => {
    const state = stateWithHero()
    state.heroes.hero_mu_nianci.skillPoints = 1_000_000
    state.worldCurrency.world_01 = 0
    state.heroes.hero_mu_nianci.learnedMartials.original_skill_42 = {
      level: 1,
      investedSp: 451,
      invested: { worldCurrency: { world_01: 1_069 }, contribution: {} },
    }
    const before = structuredClone(state)

    expect(upgradeMartial(state, 'hero_mu_nianci', 'original_skill_42').ok).toBe(false)
    expect(state).toEqual(before)
    expect(spend(state.worldCurrency, 'world_01', 1_000_000).ok).toBe(false)
  })

  it('装备校验部位和占用关系，锁定不禁止穿戴', () => {
    const state = stateWithHero()
    state.heroes.hero_yang_tiexin = createHeroProgress('blade')
    state.inventory.push(equipment('weapon_uid', equipmentIdBySlot('weapon'), true))

    expect(equipEquipment(state, 'hero_mu_nianci', 'weapon_uid').ok).toBe(true)
    expect(state.heroes.hero_mu_nianci.equipmentBySlot.weapon).toBe('weapon_uid')
    expect(equipEquipment(state, 'hero_yang_tiexin', 'weapon_uid').ok).toBe(false)
    expect(toggleEquipmentLock(state, 'weapon_uid').ok).toBe(true)
    expect(state.inventory[0].locked).toBe(false)
  })
})
