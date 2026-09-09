import { FACTIONS } from '../content/factions'
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

  it('进度编码按下一层计算，每小关十层、每难度一百层', () => {
    expect(worldBattleProgress({}, 'world_01')).toBe(1)
    expect(worldBattleProgress({ 'world_01:1': 3 }, 'world_01')).toBe(31)
    expect(worldBattleProgress({ 'world_01:1': 10 }, 'world_01')).toBe(101)
    expect(worldBattleProgress({ 'world_01:1': 10, 'world_01:2': 2 }, 'world_01')).toBe(121)
  })

  it.each(Array.from({ length: 13 }, (_, index) => index + 1))('第 %i 大关全部势力在基础难度内解锁', (worldNumber) => {
    const worldId = `world_${String(worldNumber).padStart(2, '0')}`
    const state = createInitialStateV10(0)
    state.unlockedWorldIds = [worldId]
    state.unlockedFactionIds = []
    const factions = FACTIONS.filter((faction) => faction.worldId === worldId)
    const requiredClears = worldNumber <= 3 ? [0, 3, 5, 7] : [0, 3, 6]
    expect(factions).toHaveLength(requiredClears.length)
    for (let cleared = 0; cleared <= 10; cleared += 1) {
      state.clearedStageByWorldDifficulty[progressKey(worldId, 1)] = cleared
      syncFactionUnlocks(state, worldId)
      expect(state.unlockedFactionIds).toEqual(factions
        .filter((_, index) => cleared >= requiredClears[index])
        .map((faction) => faction.id))
      expect(syncFactionUnlocks(state, worldId)).toEqual([])
    }
  })

  it('未开放世界不能因残留进度解锁势力', () => {
    const state = createInitialStateV10(0)
    state.clearedStageByWorldDifficulty['world_02:1'] = 10
    expect(syncFactionUnlocks(state, 'world_02')).toEqual([])
  })
})
