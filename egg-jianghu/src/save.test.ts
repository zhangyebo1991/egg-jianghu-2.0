import { describe, expect, it } from 'vitest'
import { OFFLINE_CAP_SECONDS, createInitialState } from './game'
import { SAVE_KEY, exportSave, hydrateState, importSave, loadGame, saveGame, type StorageLike } from './save'

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

describe('本地存档与离线结算', () => {
  it('能够保存并恢复进度', () => {
    const storage = new MemoryStorage()
    const state = createInitialState(10_000)
    state.resources.silver = 888
    state.clearedStage = 3
    saveGame(storage, state, 20_000)

    const loaded = loadGame(storage, 20_000)
    expect(loaded.recoveredFromError).toBe(false)
    expect(loaded.state.resources.silver).toBe(888)
    expect(loaded.state.clearedStage).toBe(3)
    expect(loaded.state.party).toHaveLength(3)
  })

  it('离线后正确结算收益并显示败敌数量', () => {
    const storage = new MemoryStorage()
    const now = 10_000_000
    const state = createInitialState(now - 3_600_000)
    storage.setItem(SAVE_KEY, JSON.stringify(state))
    const loaded = loadGame(storage, now)

    expect(loaded.settlement?.seconds).toBe(3_600)
    expect(loaded.settlement?.silver).toBe(Math.floor(3_600 * 1.35))
    expect(loaded.settlement?.experience).toBe(Math.floor(3_600 * 0.82))
    expect(loaded.settlement?.pages).toBe(20)
    expect(loaded.settlement?.enemies).toBe(300)
  })

  it('离线结算最多累计十二小时', () => {
    const storage = new MemoryStorage()
    const now = 100_000_000
    const state = createInitialState(now - 48 * 60 * 60 * 1000)
    storage.setItem(SAVE_KEY, JSON.stringify(state))
    const loaded = loadGame(storage, now)
    expect(loaded.settlement?.seconds).toBe(OFFLINE_CAP_SECONDS)
    expect(loaded.settlement?.capped).toBe(true)
  })

  it('JSON 导出后可重新导入且会校验结构', () => {
    const state = createInitialState()
    state.resources.reputation = 42
    const imported = importSave(exportSave(state))
    expect(imported.state.resources.reputation).toBe(42)
    expect(() => hydrateState({ version: 2 })).toThrow(/版本/)
  })

  it('损坏的 localStorage 存档不会阻断游戏启动', () => {
    const storage = new MemoryStorage()
    storage.setItem(SAVE_KEY, '{bad json')
    const loaded = loadGame(storage)
    expect(loaded.recoveredFromError).toBe(true)
    expect(loaded.state.party).toHaveLength(3)
  })
})
