import { describe, expect, it } from 'vitest'
import { createRng } from '../combat/rng'
import { enemyDefinitionById } from '../content/enemy-names'
import {
  acceptQuest,
  advanceQuestBoards,
  applyKillToQuests,
  cancelQuest,
  claimQuest,
  initializeQuestBoard,
  QUEST_REFRESH_MS,
} from './quests'
import { createHeroProgress, createInitialStateV10 } from './state'
import type { AcceptedFactionQuest, FactionQuestBoardEntry, GameStateV10 } from './types'

const FACTION_ID = 'tieyi_school'

const targetState = (): GameStateV10 => {
  const state = createInitialStateV10(0)
  state.unlockedFactionIds.push(FACTION_ID)
  initializeQuestBoard(state, FACTION_ID, createRng(9), 0)
  return state
}

const boardQuest = (
  id: string,
  acceptedRecordId: number,
  taskId: 1 | 2 | 3 | 4 | 5 = 1,
  targetId = 1,
): FactionQuestBoardEntry => ({
  id,
  taskId,
  quality: 1,
  targetId,
  generatedAt: 0,
  acceptedRecordId,
})

const acceptedQuest = (
  recordId: number,
  boardSlot: number,
  taskId: 1 | 2 | 3 | 4 | 5 = 1,
  targetId = 1,
  requiredAmount = 2,
): AcceptedFactionQuest => ({
  recordId,
  factionId: FACTION_ID,
  factionSourceId: 2,
  worldIndex: 1,
  taskId,
  quality: 1,
  targetId,
  requiredAmount,
  progress: 0,
  boardSlot,
  status: 1,
})

describe('原版势力五格悬榜', () => {
  it('正式势力初始化五个任务刷新位且任务 6 不进入随机池', () => {
    const state = targetState()
    const board = state.factionBoards[FACTION_ID]

    expect(board.slots).toHaveLength(5)
    expect(board.slots.every(Boolean)).toBe(true)
    expect(board.slots.every((quest) => quest!.taskId >= 1 && quest!.taskId <= 5)).toBe(true)
    expect(board.refreshRemainingMs).toBe(QUEST_REFRESH_MS)
  })

  it('接受记录独立于悬榜，运行一小时只刷新未接受格', () => {
    const state = targetState()
    const board = state.factionBoards[FACTION_ID]
    const acceptedBoardId = board.slots[0]!.id
    const oldIds = board.slots.map((slot) => slot!.id)

    expect(acceptQuest(state, FACTION_ID, 0).ok).toBe(true)
    const acceptedRecordId = board.slots[0]!.acceptedRecordId
    expect(acceptedRecordId).toBeGreaterThan(0)
    expect(state.acceptedFactionQuests[String(acceptedRecordId)]).toMatchObject({
      factionId: FACTION_ID,
      boardSlot: 0,
      status: 1,
    })

    advanceQuestBoards(state, QUEST_REFRESH_MS, createRng(19))

    expect(board.slots[0]!.id).toBe(acceptedBoardId)
    expect(board.slots.slice(1).every((slot) => slot!.generatedAt === QUEST_REFRESH_MS)).toBe(true)
    expect(board.slots.slice(1).some((slot, index) => slot!.id !== oldIds[index + 1])).toBe(true)
  })

  it('五格都已接受时换榜不覆盖悬榜或接受记录', () => {
    const state = targetState()
    const board = state.factionBoards[FACTION_ID]
    for (let slot = 0; slot < 5; slot += 1) expect(acceptQuest(state, FACTION_ID, slot).ok).toBe(true)
    const boardSnapshot = structuredClone(board.slots)
    const acceptedSnapshot = structuredClone(state.acceptedFactionQuests)

    advanceQuestBoards(state, QUEST_REFRESH_MS * 2, createRng(29))

    expect(board.slots).toEqual(boardSnapshot)
    expect(state.acceptedFactionQuests).toEqual(acceptedSnapshot)
  })

  it('同一击杀可推进多个匹配的独立接受记录', () => {
    const state = createInitialStateV10(0)
    const enemyId = 'world_01_stage_01_mob_1'
    const drId = enemyDefinitionById(enemyId)!.drId
    state.acceptedFactionQuests = {
      1: acceptedQuest(1, 0, 1, drId),
      2: acceptedQuest(2, 1, 1, drId),
    }

    applyKillToQuests(state, { enemyId, rank: 'normal', bossId: null })

    expect([state.acceptedFactionQuests['1'].progress, state.acceptedFactionQuests['2'].progress]).toEqual([1, 1])
  })

  it('领取奖励把悬榜写为已完成并清除接受记录，放弃则保留原任务可重接', () => {
    const state = createInitialStateV10(0)
    state.factionBoards[FACTION_ID] = {
      refreshRemainingMs: QUEST_REFRESH_MS,
      slots: [boardQuest('claim', 1), boardQuest('cancel', 2), null, null, null],
    }
    state.acceptedFactionQuests = {
      1: { ...acceptedQuest(1, 0), progress: 2 },
      2: { ...acceptedQuest(2, 1), progress: 1 },
    }

    expect(claimQuest(state, FACTION_ID, 0).ok).toBe(true)
    expect(state.contribution[FACTION_ID]).toBeGreaterThan(0)
    expect(state.worldReputation.world_01).toBeGreaterThan(0)
    expect(state.factionBoards[FACTION_ID].slots[0]!.acceptedRecordId).toBe(-1)
    expect(state.acceptedFactionQuests['1']).toBeUndefined()

    expect(cancelQuest(state, FACTION_ID, 1)).toEqual({
      ok: true,
      message: '已放弃任务，悬榜任务可重新接受',
    })
    expect(state.factionBoards[FACTION_ID].slots[1]).toMatchObject({ id: 'cancel', acceptedRecordId: 0 })
    expect(state.acceptedFactionQuests['2']).toBeUndefined()
  })

  it('领取时按位面代理人计略乘贡献与声望，货币不乘', () => {
    const base = createInitialStateV10(0)
    base.factionBoards[FACTION_ID] = {
      refreshRemainingMs: QUEST_REFRESH_MS,
      slots: [boardQuest('claim', 1), null, null, null, null],
    }
    base.acceptedFactionQuests = { 1: { ...acceptedQuest(1, 0), progress: 2 } }
    expect(claimQuest(base, FACTION_ID, 0).ok).toBe(true)

    const trained = createInitialStateV10(0)
    trained.heroes.hero_guo_jing = createHeroProgress('job_1')
    trained.heroes.hero_guo_jing.abilityTraining = { 9: 4 }
    trained.factionAgents.world_01 = { heroId: 'hero_guo_jing', enabled: true }
    trained.factionBoards[FACTION_ID] = {
      refreshRemainingMs: QUEST_REFRESH_MS,
      slots: [boardQuest('claim', 1), null, null, null, null],
    }
    trained.acceptedFactionQuests = { 1: { ...acceptedQuest(1, 0), progress: 2 } }
    expect(claimQuest(trained, FACTION_ID, 0).ok).toBe(true)
    expect(trained.contribution[FACTION_ID]).toBe(Math.round((base.contribution[FACTION_ID] ?? 0) * 1.2))
    expect(trained.worldReputation.world_01).toBe(Math.round((base.worldReputation.world_01 ?? 0) * 1.08))
    expect(trained.worldCurrency.world_01).toBe(base.worldCurrency.world_01)
  })

  it('筹措、收集与寻宝任务领取时原子扣除对应资源', () => {
    const state = createInitialStateV10(0)
    state.worldCurrency.world_01 = 1000
    state.materials['11'] = 8
    state.inventory.push({
      uid: 'quality-1',
      definitionId: 'wp_101',
      level: 1,
      quality: 1,
      coreStats: [],
      affixes: [],
      locked: false,
    })
    state.factionBoards[FACTION_ID] = {
      refreshRemainingMs: QUEST_REFRESH_MS,
      slots: [
        boardQuest('currency', 1, 2, 2),
        boardQuest('material', 2, 3, 11),
        boardQuest('equipment', 3, 5, 1),
        null,
        null,
      ],
    }
    state.acceptedFactionQuests = {
      1: acceptedQuest(1, 0, 2, 2, 500),
      2: acceptedQuest(2, 1, 3, 11, 8),
      3: acceptedQuest(3, 2, 5, 1, 1),
    }

    expect(claimQuest(state, FACTION_ID, 0).ok).toBe(true)
    expect(state.worldCurrency.world_01).toBe(500)
    expect(claimQuest(state, FACTION_ID, 1).ok).toBe(true)
    expect(state.materials['11']).toBe(0)
    expect(claimQuest(state, FACTION_ID, 2).ok).toBe(true)
    expect(state.inventory).toHaveLength(0)
  })

  it('上缴装备排除上锁与至宝，并优先交出等级最低的一件', () => {
    const state = createInitialStateV10(0)
    const equipment = (uid: string, definitionId: string, level: number, locked: boolean) => ({
      uid,
      definitionId,
      level,
      quality: 8 as const,
      coreStats: [],
      affixes: [],
      locked,
    })
    // 同为品质 8：一件上锁、一件至宝（孙子兵法 wp_215）、两件普通装备等级 5 与 3。
    state.inventory.push(
      equipment('locked', 'wp_101', 1, true),
      equipment('treasure', 'wp_215', 1, false),
      equipment('normal-high', 'wp_101', 5, false),
      equipment('normal-low', 'wp_101', 3, false),
    )
    state.factionBoards[FACTION_ID] = {
      refreshRemainingMs: QUEST_REFRESH_MS,
      slots: [boardQuest('equipment', 1, 5, 8), null, null, null, null],
    }
    state.acceptedFactionQuests = { 1: acceptedQuest(1, 0, 5, 8, 1) }

    expect(claimQuest(state, FACTION_ID, 0).ok).toBe(true)

    // 只交出等级最低的普通装备，上锁件与至宝都必须留下。
    expect(state.inventory.map((item) => item.uid).sort())
      .toEqual(['locked', 'normal-high', 'treasure'])
  })

  it('可上缴装备不足时拒绝领取且不扣除任何装备', () => {
    const state = createInitialStateV10(0)
    // 唯一一件品质 8 装备已上锁，不计入可上缴数量。
    state.inventory.push({
      uid: 'locked-only',
      definitionId: 'wp_101',
      level: 1,
      quality: 8,
      coreStats: [],
      affixes: [],
      locked: true,
    })
    state.factionBoards[FACTION_ID] = {
      refreshRemainingMs: QUEST_REFRESH_MS,
      slots: [boardQuest('equipment', 1, 5, 8), null, null, null, null],
    }
    state.acceptedFactionQuests = { 1: acceptedQuest(1, 0, 5, 8, 1) }

    expect(claimQuest(state, FACTION_ID, 0).ok).toBe(false)
    expect(state.inventory).toHaveLength(1)
    expect(state.acceptedFactionQuests['1']).toBeDefined()
  })
})
