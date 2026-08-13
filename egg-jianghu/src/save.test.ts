import { describe, expect, it } from 'vitest'
import { createInitialStateV10 } from './domain/state'
import type { QuestProgress } from './domain/types'
import { clearSave, exportSave, importSave, loadGame, SAVE_KEY, saveGame, type StorageLike } from './save'

const memoryStorage = (): StorageLike & { values: Map<string, string> } => {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
    values,
  }
}

const quest = (): QuestProgress => ({
  id: 'quest_qingfeng_0',
  type: 'normal',
  grade: '乙',
  targetId: 'world_01_stage_01_normal_1',
  targetCount: 20,
  rewardContribution: 50,
  generatedAt: 100,
  accepted: true,
  completed: false,
  claimed: false,
  progress: 3,
})

describe('version 10 公开存档入口', () => {
  it('保存并恢复全部长期状态', () => {
    const storage = memoryStorage()
    const state = createInitialStateV10(100)
    state.worldCurrency.world_01 = 4321
    state.inventory.push({ uid: 'equipment_1', definitionId: 'world_01_weapon', level: 1, quality: '凡品', affixes: [], locked: true })
    saveGame(storage, state, 200)

    const loaded = loadGame(storage, 300)
    expect(loaded.recoveredFromError).toBe(false)
    expect(loaded.state.worldCurrency.world_01).toBe(4321)
    expect(loaded.state.inventory).toEqual(state.inventory)
    expect(loaded.state.lastSavedAt).toBe(200)
    clearSave(storage)
    expect(storage.getItem(SAVE_KEY)).toBeNull()
  })

  it('损坏存档恢复为干净新档', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY, '{broken')
    const loaded = loadGame(storage, 500)
    expect(loaded.recoveredFromError).toBe(true)
    expect(loaded.state).toEqual(createInitialStateV10(500))
  })

  it('导出与导入只接受 version 11', () => {
    const state = createInitialStateV10(100)
    state.worldCurrency.world_01 = 987
    const serialized = exportSave(state, 200)
    expect(JSON.parse(serialized).version).toBe(11)
    expect(importSave(serialized, 300).state.worldCurrency.world_01).toBe(987)
    expect(() => importSave(JSON.stringify({ version: 9 }), 300)).toThrow('存档版本不受支持')
  })

  it('忽略 version 1 至 9 的旧 key', () => {
    const storage = memoryStorage()
    storage.setItem('egg-jianghu-2-save-v9', JSON.stringify({ version: 9, resources: { silver: 999999 } }))
    expect(loadGame(storage, 700).state).toEqual(createInitialStateV10(700))
    expect(storage.getItem(SAVE_KEY)).toBeNull()
  })

  it('导入与保存都会丢弃临时 combat 字段', () => {
    const storage = memoryStorage()
    const state = createInitialStateV10(100)
    const imported = importSave(JSON.stringify({ ...state, combat: { wave: 9 } }), 200).state
    expect('combat' in imported).toBe(false)
    saveGame(storage, imported, 300)
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).combat).toBeUndefined()
    expect(JSON.parse(exportSave(imported, 400)).combat).toBeUndefined()
  })

  it('关闭期间不按 lastSavedAt 推进势力悬榜', () => {
    const storage = memoryStorage()
    const state = createInitialStateV10(100)
    state.factionBoards.qingfeng_hall = { refreshRemainingMs: 123_456, slots: [quest(), null, null, null, null, null] }
    saveGame(storage, state, 100)
    const loaded = loadGame(storage, 10_000_000)
    expect(loaded.state.factionBoards.qingfeng_hall.refreshRemainingMs).toBe(123_456)
    expect(loaded.state.factionBoards.qingfeng_hall.slots[0]?.progress).toBe(3)
  })
})
