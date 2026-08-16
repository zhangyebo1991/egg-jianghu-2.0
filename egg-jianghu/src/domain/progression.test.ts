import { describe, expect, it } from 'vitest'
import {
  clearedStageOf,
  difficultyLabel,
  isDifficultyUnlocked,
  progressKey,
  resolveDefeat,
  resolveVictory,
  syncFactionUnlocks,
  worldBattleProgress,
} from './progression'
import { createInitialStateV10 } from './state'

describe('驻守与闯荡推进', () => {
  it('闯荡失败切驻守并按规则回退', () => {
    expect(resolveDefeat({ worldId: 'world_01', difficulty: 1, stage: 6, mode: 'roam' })).toEqual({
      worldId: 'world_01', difficulty: 1, stage: 5, mode: 'guard',
    })
    expect(resolveDefeat({ worldId: 'world_01', difficulty: 2, stage: 1, mode: 'roam' })).toEqual({
      worldId: 'world_01', difficulty: 2, stage: 1, mode: 'guard',
    })
  })

  it('驻守通关重开本关，闯荡通关推进下一关', () => {
    expect(resolveVictory({ worldId: 'world_01', difficulty: 1, stage: 4, mode: 'guard' })).toEqual({
      worldId: 'world_01', difficulty: 1, stage: 4, mode: 'guard',
    })
    expect(resolveVictory({ worldId: 'world_01', difficulty: 1, stage: 4, mode: 'roam' })).toEqual({
      worldId: 'world_01', difficulty: 1, stage: 5, mode: 'roam',
    })
  })

  it('第十关闯荡通关停在本难度，不进入下一难度或下一位面', () => {
    expect(resolveVictory({ worldId: 'world_01', difficulty: 1, stage: 10, mode: 'roam' })).toEqual({
      worldId: 'world_01', difficulty: 1, stage: 10, mode: 'guard',
    })
    expect(resolveVictory({ worldId: 'world_10', difficulty: 3, stage: 10, mode: 'roam' })).toEqual({
      worldId: 'world_10', difficulty: 3, stage: 10, mode: 'guard',
    })
  })
})

describe('位面难度解锁', () => {
  it('开局只有第一面基础难度，打通基础后解锁下一面和本面难度2', () => {
    const unlocked = ['world_01']
    const progress = { [progressKey('world_01', 1)]: 10 }

    expect(isDifficultyUnlocked(unlocked, progress, 'world_01', 1)).toBe(true)
    expect(isDifficultyUnlocked(unlocked, progress, 'world_01', 2)).toBe(true)
    expect(isDifficultyUnlocked(unlocked, progress, 'world_02', 1)).toBe(false)
    expect(clearedStageOf(progress, 'world_01', 1)).toBe(10)
    expect(difficultyLabel(1)).toBe('基础')
    expect(difficultyLabel(2)).toBe('难度2')
  })

  it('按连续战斗进度 31、51、71 解锁第一位面的三个正式势力', () => {
    const state = createInitialStateV10(0)
    expect(state.unlockedFactionIds).toEqual(['qingfeng_hall'])
    for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
      state.clearedStageByWorldDifficulty[progressKey('world_01', difficulty)] = 10
    }
    expect(worldBattleProgress(state.clearedStageByWorldDifficulty, 'world_01')).toBe(30)
    expect(syncFactionUnlocks(state, 'world_01')).toEqual([])

    state.clearedStageByWorldDifficulty[progressKey('world_01', 4)] = 1
    expect(syncFactionUnlocks(state, 'world_01')).toEqual(['tieyi_school'])
    state.clearedStageByWorldDifficulty[progressKey('world_01', 4)] = 10
    state.clearedStageByWorldDifficulty[progressKey('world_01', 5)] = 10
    state.clearedStageByWorldDifficulty[progressKey('world_01', 6)] = 1
    expect(syncFactionUnlocks(state, 'world_01')).toEqual(['renxin_hall'])
    state.clearedStageByWorldDifficulty[progressKey('world_01', 6)] = 10
    state.clearedStageByWorldDifficulty[progressKey('world_01', 7)] = 10
    state.clearedStageByWorldDifficulty[progressKey('world_01', 8)] = 1
    expect(syncFactionUnlocks(state, 'world_01')).toEqual(['original_faction_04'])
  })
})
