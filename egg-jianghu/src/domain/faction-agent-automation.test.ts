import { describe, expect, it } from 'vitest'
import { createRng } from '../combat/rng'
import { ORIGINAL_FACTION_RULES } from '../content/original-faction-rules.generated'
import {
  AGENT_CONCURRENT_TASK_LIMIT,
  factionAgentFilterKey,
  isFactionAgentColumnExcluded,
  runFactionAgentAutomation,
  toggleFactionAgentFilterColumn,
} from './faction-agent-automation'
import { initializeQuestBoard } from './quests'
import { createHeroProgress, createInitialStateV10 } from './state'
import type { AcceptedFactionQuest, FactionQuestBoardEntry, GameStateV10 } from './types'

const FACTION_ID = 'tieyi_school'
const WORLD_ID = 'world_01'
const FILTER = ORIGINAL_FACTION_RULES.stateLayout.agentFilter

const boardQuest = (
  id: string,
  taskId: 1 | 2 | 3 | 4 | 5 = 1,
  quality: 1 | 2 | 3 | 4 | 5 | 6 = 1,
  targetId = 1,
): FactionQuestBoardEntry => ({ id, taskId, quality, targetId, generatedAt: 0, acceptedRecordId: 0 })

/** 已任命且开关开启，悬榜只放一个「消灭」任务在 0 号槽。 */
const agentState = (): GameStateV10 => {
  const state = createInitialStateV10(0)
  state.unlockedFactionIds.push(FACTION_ID)
  initializeQuestBoard(state, FACTION_ID, createRng(9), 0)
  state.heroes.hero_guo_jing = createHeroProgress('job_1')
  state.factionAgents[WORLD_ID] = { heroId: 'hero_guo_jing', enabled: true }
  state.factionBoards[FACTION_ID] = {
    refreshRemainingMs: 3_600_000,
    slots: [boardQuest('q0'), null, null, null, null],
  }
  return state
}

const acceptedKillQuest = (recordId: number, boardSlot: number, requiredAmount = 2): AcceptedFactionQuest => ({
  recordId,
  factionId: FACTION_ID,
  factionSourceId: 2,
  worldIndex: 1,
  taskId: 1,
  quality: 1,
  targetId: 1,
  requiredAmount,
  progress: 0,
  boardSlot,
  status: 1,
})

describe('位面代理人任务自动化', () => {
  it('未任命或开关关闭时不接受也不交付', () => {
    const idle = agentState()
    idle.factionAgents[WORLD_ID].enabled = false
    expect(runFactionAgentAutomation(idle, WORLD_ID)).toEqual({ accepted: 0, completed: 0 })
    expect(idle.factionBoards[FACTION_ID].slots[0]?.acceptedRecordId).toBe(0)

    const noAgent = agentState()
    noAgent.factionAgents[WORLD_ID] = { heroId: null, enabled: true }
    expect(runFactionAgentAutomation(noAgent, WORLD_ID)).toEqual({ accepted: 0, completed: 0 })
  })

  it('开关开启后自动接受悬榜任务', () => {
    const state = agentState()

    expect(runFactionAgentAutomation(state, WORLD_ID)).toEqual({ accepted: 1, completed: 0 })
    expect(state.factionBoards[FACTION_ID].slots[0]?.acceptedRecordId).toBe(1)
    expect(Object.keys(state.acceptedFactionQuests)).toEqual(['1'])

    // 已接过的槽位不会重复接受。
    expect(runFactionAgentAutomation(state, WORLD_ID).accepted).toBe(0)
  })

  it('玩家不在任何位面时只交付、不接受', () => {
    const state = agentState()
    state.acceptedFactionQuests = { 1: { ...acceptedKillQuest(1, 1), progress: 2 } }
    state.factionBoards[FACTION_ID].slots[1] = { ...boardQuest('q1'), acceptedRecordId: 1 }

    const result = runFactionAgentAutomation(state, null)

    expect(result).toEqual({ accepted: 0, completed: 1 })
    expect(state.factionBoards[FACTION_ID].slots[0]?.acceptedRecordId).toBe(0)
  })

  it('进度达标即自动交付，并在同一 tick 内补接一轮', () => {
    const state = agentState()
    state.acceptedFactionQuests = { 1: { ...acceptedKillQuest(1, 1), progress: 2 } }
    state.factionBoards[FACTION_ID].slots[1] = { ...boardQuest('q1'), acceptedRecordId: 1 }
    const contributionBefore = state.contribution[FACTION_ID] ?? 0

    // 交付第 1 号记录后，Event 11711 会再跑一轮接受，把 0 号槽接下来。
    const result = runFactionAgentAutomation(state, WORLD_ID)

    expect(result.completed).toBe(1)
    expect(result.accepted).toBeGreaterThanOrEqual(1)
    expect(state.contribution[FACTION_ID]).toBeGreaterThan(contributionBefore)
    expect(state.factionBoards[FACTION_ID].slots[1]?.acceptedRecordId).toBe(-1)
  })

  it('进度未达标不交付', () => {
    const state = agentState()
    state.acceptedFactionQuests = { 1: { ...acceptedKillQuest(1, 1), progress: 1 } }
    state.factionBoards[FACTION_ID].slots[1] = { ...boardQuest('q1'), acceptedRecordId: 1 }

    expect(runFactionAgentAutomation(state, WORLD_ID).completed).toBe(0)
    expect(state.acceptedFactionQuests['1']).toBeDefined()
  })

  it('并发已接任务达到原版上限 12 后停止接受', () => {
    const state = agentState()
    state.factionBoards[FACTION_ID].slots = [
      boardQuest('q0'),
      boardQuest('q1'),
      boardQuest('q2'),
      boardQuest('q3'),
      boardQuest('q4'),
    ]
    // 预置 12 条已接记录占满上限（不占用悬榜槽，boardSlot 指向已交付格）。
    for (let recordId = 1; recordId <= AGENT_CONCURRENT_TASK_LIMIT; recordId += 1) {
      state.acceptedFactionQuests[String(recordId)] = acceptedKillQuest(recordId, 0)
    }

    expect(AGENT_CONCURRENT_TASK_LIMIT).toBe(12)
    expect(runFactionAgentAutomation(state, WORLD_ID).accepted).toBe(0)
    expect(state.factionBoards[FACTION_ID].slots.every((slot) => slot?.acceptedRecordId === 0)).toBe(true)
  })
})

describe('位面代理人筛选矩阵', () => {
  it('黑名单语义：缺省全放行，切换后按列排除', () => {
    const state = agentState()
    const key = factionAgentFilterKey(WORLD_ID, 1)

    expect(state.factionAgentFilters[key]).toBeUndefined()
    expect(isFactionAgentColumnExcluded(state, WORLD_ID, 1, FILTER.taskEnabledColumn)).toBe(false)

    expect(toggleFactionAgentFilterColumn(state, WORLD_ID, 1, FILTER.taskEnabledColumn)).toBe(true)
    expect(state.factionAgentFilters[key]).toEqual([FILTER.taskEnabledColumn])
    expect(isFactionAgentColumnExcluded(state, WORLD_ID, 1, FILTER.taskEnabledColumn)).toBe(true)

    // 再次切换恢复放行，并清掉空数组避免存档里留垃圾键。
    expect(toggleFactionAgentFilterColumn(state, WORLD_ID, 1, FILTER.taskEnabledColumn)).toBe(false)
    expect(state.factionAgentFilters[key]).toBeUndefined()

    // 列号为 null（如 taskId 2 无子类列）恒不排除。
    expect(isFactionAgentColumnExcluded(state, WORLD_ID, 2, null)).toBe(false)
  })

  it('排除任务类型后该类型不再被自动接受', () => {
    const state = agentState()
    toggleFactionAgentFilterColumn(state, WORLD_ID, 1, FILTER.taskEnabledColumn)

    expect(runFactionAgentAutomation(state, WORLD_ID).accepted).toBe(0)
    expect(state.factionBoards[FACTION_ID].slots[0]?.acceptedRecordId).toBe(0)
  })

  it('排除品质列后该品质不再被自动接受，其他品质仍放行', () => {
    const state = agentState()
    // 品质 1 的列号 = quality + 4 = 5。
    toggleFactionAgentFilterColumn(state, WORLD_ID, 1, 5)

    expect(runFactionAgentAutomation(state, WORLD_ID).accepted).toBe(0)

    // 换成品质 2（列 6，未被排除）即可接受。
    state.factionBoards[FACTION_ID].slots[0] = boardQuest('q0', 1, 2)
    expect(runFactionAgentAutomation(state, WORLD_ID).accepted).toBe(1)
  })

  it('矩阵按位面与任务类型分行，互不干扰', () => {
    const state = agentState()
    // 只排除 world_01 的任务类型 3，任务类型 1 不受影响。
    toggleFactionAgentFilterColumn(state, WORLD_ID, 3, FILTER.taskEnabledColumn)

    expect(isFactionAgentColumnExcluded(state, WORLD_ID, 3, FILTER.taskEnabledColumn)).toBe(true)
    expect(isFactionAgentColumnExcluded(state, WORLD_ID, 1, FILTER.taskEnabledColumn)).toBe(false)
    expect(isFactionAgentColumnExcluded(state, 'world_02', 3, FILTER.taskEnabledColumn)).toBe(false)
    expect(runFactionAgentAutomation(state, WORLD_ID).accepted).toBe(1)
  })
})
