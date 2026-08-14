import { describe, expect, it } from 'vitest'
import type { CombatEvent } from '../combat/types'
import { settleCombatEvent } from './rewards'
import { createInitialStateV10 } from './state'

const enemyDefeatedEvent = (overrides: Partial<Extract<CombatEvent, { type: 'enemy-defeated' }>> = {}): Extract<CombatEvent, { type: 'enemy-defeated' }> => ({
  type: 'enemy-defeated',
  atMs: 1000,
  enemyId: 'world_01_stage_03_mob_2',
  rank: 'elite',
  worldId: 'world_01',
  stage: 3,
  difficulty: 1,
  seed: 7,
  ...overrides,
})

describe('击杀即时结算', () => {
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

  it('非死亡事件不会修改长期状态', () => {
    const state = createInitialStateV10()
    const before = structuredClone(state)

    const result = settleCombatEvent(state, { type: 'combat-stopped', atMs: 1000 })

    expect(result).toEqual({ needsSave: false, addedEquipmentUids: [] })
    expect(state).toEqual(before)
  })
})
