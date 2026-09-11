import { describe, expect, it } from 'vitest'
import type { CombatEvent } from '../combat/types'
import { careerExperienceForEnemyLevel, heroExperienceForEnemyLevel, heroExperienceForNextLevel, settleCombatEvent, skillPointsForEnemyLevel } from './rewards'
import { createHeroProgress, createInitialStateV10 } from './state'
import { exportSaveV10, importSaveV10 } from './save-v10'

const enemyDefeatedEvent = (overrides: Partial<Extract<CombatEvent, { type: 'enemy-defeated' }>> = {}): Extract<CombatEvent, { type: 'enemy-defeated' }> => ({
  type: 'enemy-defeated',
  atMs: 1000,
  enemyId: 'world_01_stage_03_mob_2',
  enemyLevel: 3,
  rank: 'elite',
  worldId: 'world_01',
  stage: 3,
  difficulty: 1,
  seed: 7,
  ...overrides,
})

describe('击杀即时结算', () => {
  it.each([[1, 62, 5], [10, 81, 6], [50, 166, 8], [100, 277, 10], [200, 523, 15], [500, 2498, 30]])(
    '难度系数 %i 的侠客经验 %i、职业经验 %i 符合原版', (difficulty, heroXp, careerXp) => {
      expect(heroExperienceForEnemyLevel(difficulty)).toBe(heroXp)
      expect(careerExperienceForEnemyLevel(difficulty)).toBe(careerXp)
    },
  )

  it.each([[1, 1000], [2, 2290], [4, 5391], [5, 7247], [10, 20802], [20, 91273], [44, 1835334], [50, 3810470]])(
    '侠客 %i 级升级门槛为 %i', (level, required) => {
      expect(heroExperienceForNextLevel(level)).toBe(required)
    },
  )

  it.each(['normal', 'elite', 'captain', 'boss'] as const)('同难度 %s 不额外放大经验，只给参战侠客结算', (rank) => {
    const state = createInitialStateV10()
    state.heroes.hero_player = createHeroProgress('job_1')
    state.heroes.hero_mu_nianci = createHeroProgress('job_1')
    state.formation = [{ heroId: 'hero_player', row: 1, col: 0 }]
    const reserve = structuredClone(state.heroes.hero_mu_nianci)
    settleCombatEvent(state, enemyDefeatedEvent({ rank, enemyLevel: 100 }))
    expect(state.heroes.hero_player.experience).toBe(277)
    expect(state.heroes.hero_player.careers.job_1.experience).toBe(10)
    expect(state.heroes.hero_mu_nianci).toEqual(reserve)
  })

  it('升级恰好扣除原版门槛，单次收益可连续升级并保留余量', () => {
    const state = createInitialStateV10()
    const hero = state.heroes.hero_player = createHeroProgress('job_1')
    state.formation = [{ heroId: 'hero_player', row: 1, col: 0 }]
    hero.experience = 937
    settleCombatEvent(state, enemyDefeatedEvent({ enemyLevel: 1 }))
    expect(hero).toMatchObject({ level: 1, experience: 999 })
    hero.experience = 938
    settleCombatEvent(state, enemyDefeatedEvent({ enemyLevel: 1, seed: 8 }))
    expect(hero).toMatchObject({ level: 2, experience: 0 })
    hero.level = 1
    hero.experience = 900
    settleCombatEvent(state, enemyDefeatedEvent({ enemyLevel: 500, seed: 9 }))
    expect(hero).toMatchObject({ level: 3, experience: 108 })
  })

  it('旧档加载不回退侠客等级或清空经验，后续收益按新门槛结算并可再次保存', () => {
    const state = createInitialStateV10()
    const hero = state.heroes.hero_player = createHeroProgress('job_1')
    state.formation = [{ heroId: 'hero_player', row: 1, col: 0 }]
    hero.level = 44
    hero.experience = 4399
    hero.careers.job_1 = { level: 4, experience: 2000 }
    const loaded = importSaveV10(exportSaveV10(state)).state
    expect(loaded.heroes.hero_player).toEqual(hero)
    settleCombatEvent(loaded, enemyDefeatedEvent({ enemyLevel: 100 }))
    expect(loaded.heroes.hero_player).toMatchObject({ level: 44, experience: 4676, careers: { job_1: { level: 4, experience: 2010 } } })
    expect(importSaveV10(exportSaveV10(loaded)).state.heroes.hero_player).toEqual(loaded.heroes.hero_player)
  })

  it('敌人死亡事件立即结算货币、职业经验与装备掉落，且不掉转职书', () => {
    const state = createInitialStateV10()

    const result = settleCombatEvent(state, enemyDefeatedEvent())

    expect(result.addedEquipmentUids.length).toBeGreaterThan(0)
    expect(state.inventory.map((item) => item.uid)).toEqual(result.addedEquipmentUids)
    expect(state.inventory.every((item) => item.definitionId.startsWith('wp_'))).toBe(true)
    expect(state.jobBooks).toEqual({})
    expect(result.needsSave).toBe(true)
  })

  it('装备、货币、击杀统计和遭遇记录在单个死亡事件中同时落账', () => {
    const state = createInitialStateV10()
    const before = state.worldCurrency.world_01

    settleCombatEvent(state, enemyDefeatedEvent({ rank: 'boss', enemyId: 'world_01_stage_03_boss' }))

    expect(state.worldCurrency.world_01).toBeGreaterThan(before)
    expect(state.statistics).toMatchObject({ kills: 1, bossKills: 1 })
    expect(state.encounteredEnemyIds).toContain('world_01_stage_03_boss')
  })

  it('参战侠客按原版敌人技能经验公式获得 SP', () => {
    const state = createInitialStateV10()
    state.heroes.hero_player = createHeroProgress('inner')
    state.formation = [{ heroId: 'hero_player', row: 1, col: 0 }]

    settleCombatEvent(state, enemyDefeatedEvent({ enemyLevel: 83 }))

    expect(state.heroes.hero_player.skillPoints).toBe(skillPointsForEnemyLevel(83))
  })

  it('非死亡事件不会修改长期状态', () => {
    const state = createInitialStateV10()
    const before = structuredClone(state)

    const result = settleCombatEvent(state, { type: 'combat-stopped', atMs: 1000 })

    expect(result).toEqual({ needsSave: false, addedEquipmentUids: [] })
    expect(state).toEqual(before)
  })
})
