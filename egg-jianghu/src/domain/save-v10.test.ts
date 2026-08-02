import { describe, expect, it } from 'vitest'
import { createInitialStateV10, createNewGameStateV10 } from './state'
import { clearSaveV10, hasSaveV10, loadGameV10, SAVE_KEY_V10, saveGameV10 } from './save-v10'

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
  it('通过 version 10 专用 key 检测存档是否存在', () => {
    const storage = memoryStorage()

    expect(hasSaveV10(storage)).toBe(false)

    storage.setItem(SAVE_KEY_V10, '{}')

    expect(hasSaveV10(storage)).toBe(true)
  })

  it('清除时只移除 version 10 存档', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY_V10, '{}')
    storage.setItem('other-key', '保留')

    clearSaveV10(storage)

    expect(storage.getItem(SAVE_KEY_V10)).toBeNull()
    expect(storage.getItem('other-key')).toBe('保留')
  })

  it('新建玩家角色保存并读取后保留自定义姓名', () => {
    const storage = memoryStorage()
    saveGameV10(storage, createNewGameStateV10('燕七', 1000), 1000)

    const loaded = loadGameV10(storage, 2000)

    expect(loaded.state.heroes.hero_player?.customName).toBe('燕七')
  })

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

  it('玩家自定义姓名不是字符串时把存档标记为损坏', () => {
    const storage = memoryStorage()
    const raw = createNewGameStateV10('燕七', 1000) as unknown as Record<string, unknown>
    const heroes = raw.heroes as Record<string, Record<string, unknown>>
    heroes.hero_player.customName = 42
    storage.setItem(SAVE_KEY_V10, JSON.stringify(raw))

    const loaded = loadGameV10(storage, 2000)

    expect(loaded.recoveredFromError).toBe(true)
    expect(storage.getItem(SAVE_KEY_V10)).not.toBeNull()
  })

  it.each([
    ['progress', null],
    ['recruited', { recruited: 'yes' }],
    ['level', { level: '1' }],
    ['currentCareerId', { currentCareerId: 42 }],
    ['equippedMartialIds', { equippedMartialIds: {} }],
  ])('拒绝基础侠客字段损坏：%s', (_field, patch) => {
    const storage = memoryStorage()
    const raw = createNewGameStateV10('燕七', 1000) as unknown as Record<string, unknown>
    const heroes = raw.heroes as Record<string, Record<string, unknown> | null>
    heroes.hero_player = patch === null ? null : { ...heroes.hero_player, ...patch }
    storage.setItem(SAVE_KEY_V10, JSON.stringify(raw))

    expect(loadGameV10(storage, 2000).recoveredFromError).toBe(true)
  })
})
