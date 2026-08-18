import { describe, expect, it } from 'vitest'
import { equipmentDefinitionById, equipmentIdBySlot } from './content/equipment'
import { createInitialStateV10 } from './domain/state'
import type { FactionQuestBoardEntry } from './domain/types'
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

const quest = (): FactionQuestBoardEntry => ({
  id: 'quest_qingfeng_0',
  taskId: 1,
  quality: 2,
  targetId: 1,
  generatedAt: 100,
  acceptedRecordId: 1,
})

describe('version 18 公开存档入口', () => {
  it('保存并恢复全部长期状态', () => {
    const storage = memoryStorage()
    const state = createInitialStateV10(100)
    state.worldCurrency.world_01 = 4321
    const definitionId = equipmentIdBySlot('weapon')
    const definition = equipmentDefinitionById(definitionId)!
    state.inventory.push({
      uid: 'equipment_1',
      definitionId,
      level: 1,
      quality: 0,
      coreStats: definition.coreStats.map((core) => ({
        attributeId: core.attributeId,
        coefficient: core.baseCoefficient,
      })),
      affixes: [],
      locked: true,
    })
    saveGame(storage, state, 200)

    const loaded = loadGame(storage, 300)
    expect(loaded.recoveredFromError).toBe(false)
    expect(loaded.state.worldCurrency.world_01).toBe(4321)
    // 旧存档没有穿戴等级字段，加载时按物品等级与品质补齐：1-(0-1)*2 = 3
    expect(loaded.state.inventory).toEqual([{ ...state.inventory[0], equipmentLevel: 3 }])
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

  it('导出与导入只接受 version 18', () => {
    const state = createInitialStateV10(100)
    state.worldCurrency.world_01 = 987
    const serialized = exportSave(state, 200)
    expect(JSON.parse(serialized).version).toBe(18)
    expect(importSave(serialized, 300).state.worldCurrency.world_01).toBe(987)
    expect(() => importSave(JSON.stringify({ version: 15 }), 300)).toThrow('存档版本不受支持')
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
    state.factionBoards.tieyi_school = { refreshRemainingMs: 123_456, slots: [quest(), null, null, null, null] }
    state.acceptedFactionQuests['1'] = {
      recordId: 1,
      factionId: 'tieyi_school',
      factionSourceId: 2,
      worldIndex: 1,
      taskId: 1,
      quality: 2,
      targetId: 1,
      requiredAmount: 10,
      progress: 3,
      boardSlot: 0,
      status: 1,
    }
    saveGame(storage, state, 100)
    const loaded = loadGame(storage, 10_000_000)
    expect(loaded.state.factionBoards.tieyi_school.refreshRemainingMs).toBe(123_456)
    expect(loaded.state.acceptedFactionQuests['1']?.progress).toBe(3)
  })
})
