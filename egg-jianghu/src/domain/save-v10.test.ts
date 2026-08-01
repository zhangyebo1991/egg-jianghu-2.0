import { describe, expect, it } from 'vitest'
import { createInitialStateV10 } from './state'
import { loadGameV10, SAVE_KEY_V10, saveGameV10 } from './save-v10'

const memoryStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    values,
  }
}

describe('version 10 存档', () => {
  it('忽略 version 1～9 的旧 key 并从零开始', () => {
    const storage = memoryStorage()
    storage.setItem('egg-jianghu-2-save-v1', JSON.stringify({ version: 9, resources: { silver: 999999 } }))

    const loaded = loadGameV10(storage, 1000)

    expect(loaded.state).toEqual(createInitialStateV10(1000))
    expect(storage.getItem(SAVE_KEY_V10)).toBeNull()
  })

  it('只保存长期状态且不存在 combat 字段', () => {
    const storage = memoryStorage()
    const state = createInitialStateV10(1000)

    saveGameV10(storage, state, 2000)

    const raw = JSON.parse(storage.getItem(SAVE_KEY_V10)!)
    expect(raw.version).toBe(10)
    expect(raw.combat).toBeUndefined()
    expect(raw.lastSavedAt).toBe(2000)
  })

  it('关闭期间不根据 lastSavedAt 推进悬榜倒计时', () => {
    const storage = memoryStorage()
    const state = createInitialStateV10(1000)
    state.factionBoards.qingfeng_hall = { refreshRemainingMs: 1234, slots: [null, null, null, null, null, null] }
    saveGameV10(storage, state, 1000)

    const loaded = loadGameV10(storage, 99_999)

    expect(loaded.state.factionBoards.qingfeng_hall.refreshRemainingMs).toBe(1234)
  })
})
