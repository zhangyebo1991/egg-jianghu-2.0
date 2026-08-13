import { describe, expect, it } from 'vitest'
import { createRng } from '../combat/rng'
import {
  acceptQuest,
  advanceQuestBoards,
  applyKillToQuests,
  cancelQuest,
  claimQuest,
  initializeQuestBoard,
  MAX_ACCEPTED_QUESTS,
  QUEST_REFRESH_MS,
} from './quests'
import { createInitialStateV10 } from './state'
import type { GameStateV10, QuestProgress } from './types'

const targetState = (): GameStateV10 => {
  const state = createInitialStateV10(0)
  state.encounteredEnemyIds = ['world_01_stage_01_mob_1', 'world_01_stage_01_boss']
  initializeQuestBoard(state, 'qingfeng_hall', createRng(9), 0)
  return state
}

const quest = (id: string, targetId = 'world_01_stage_01_mob_1'): QuestProgress => ({
  id,
  type: targetId.endsWith('_boss') ? 'boss' : 'normal',
  grade: '丙',
  targetId,
  targetCount: 5,
  rewardContribution: 20,
  generatedAt: 0,
  accepted: true,
  completed: false,
  claimed: false,
  progress: 0,
})

describe('势力六格悬榜', () => {
  it('每个势力初始化六个任务刷新位', () => {
    const state = targetState()

    expect(state.factionBoards.qingfeng_hall.slots).toHaveLength(6)
    expect(state.factionBoards.qingfeng_hall.slots.every(Boolean)).toBe(true)
    expect(state.factionBoards.qingfeng_hall.refreshRemainingMs).toBe(QUEST_REFRESH_MS)
  })

  it('未接受任务在 60 分钟运行时间后刷新，已接任务锁位', () => {
    const state = targetState()
    const board = state.factionBoards.qingfeng_hall
    board.slots[0]!.accepted = true
    const acceptedId = board.slots[0]!.id
    const oldIds = board.slots.map((slot) => slot!.id)

    advanceQuestBoards(state, QUEST_REFRESH_MS, createRng(9))

    expect(board.slots[0]!.id).toBe(acceptedId)
    expect(board.slots.slice(1).every((slot) => slot!.generatedAt === QUEST_REFRESH_MS)).toBe(true)
    expect(board.slots.slice(1).some((slot, index) => slot!.id !== oldIds[index + 1])).toBe(true)
  })

  it('同一势力六格都已接时刷新不产生新任务', () => {
    const state = targetState()
    const board = state.factionBoards.qingfeng_hall
    for (const slot of board.slots) slot!.accepted = true
    const ids = board.slots.map((slot) => slot!.id)

    advanceQuestBoards(state, QUEST_REFRESH_MS * 2, createRng(9))

    expect(board.slots.map((slot) => slot!.id)).toEqual(ids)
  })

  it('全局最多接受十个任务且同一击杀可推进多个匹配任务', () => {
    const state = createInitialStateV10(0)
    for (let index = 0; index < MAX_ACCEPTED_QUESTS; index += 1) {
      state.factionBoards[`faction_${index}`] = {
        refreshRemainingMs: QUEST_REFRESH_MS,
        slots: [quest(`accepted_${index}`), null, null, null, null, null],
      }
    }
    state.factionBoards.extra = {
      refreshRemainingMs: QUEST_REFRESH_MS,
      slots: [{ ...quest('extra'), accepted: false }, null, null, null, null, null],
    }
    expect(acceptQuest(state, 'extra', 0).ok).toBe(false)

    const matching = createInitialStateV10(0)
    matching.factionBoards.a = { refreshRemainingMs: QUEST_REFRESH_MS, slots: [quest('a'), null, null, null, null, null] }
    matching.factionBoards.b = { refreshRemainingMs: QUEST_REFRESH_MS, slots: [quest('b'), null, null, null, null, null] }
    applyKillToQuests(matching, { enemyId: 'world_01_stage_01_mob_1', rank: 'normal', bossId: null })
    expect([matching.factionBoards.a.slots[0]!.progress, matching.factionBoards.b.slots[0]!.progress]).toEqual([1, 1])
  })

  it('完成后领取贡献释放槽位，取消任务清空进度并等待刷新', () => {
    const state = targetState()
    const board = state.factionBoards.qingfeng_hall
    board.slots[0] = { ...quest('claim'), progress: 5, completed: true, rewardContribution: 20 }
    board.slots[1] = { ...quest('cancel'), progress: 3 }

    expect(claimQuest(state, 'qingfeng_hall', 0).ok).toBe(true)
    expect(state.contribution.qingfeng_hall).toBe(20)
    expect(board.slots[0]).toBeNull()
    expect(cancelQuest(state, 'qingfeng_hall', 1).ok).toBe(true)
    expect(board.slots[1]).toBeNull()
  })
})
