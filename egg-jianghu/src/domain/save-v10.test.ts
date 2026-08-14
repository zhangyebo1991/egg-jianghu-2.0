import { describe, expect, it } from 'vitest'
import { createInitialStateV10, createNewGameStateV10 } from './state'
import { clearSaveV10, hasSaveV10, hydrateStateV10, loadGameV10, SAVE_KEY_V10, saveGameV10 } from './save-v10'

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
    expect(raw.version).toBe(15)
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

  it('内容目录改版后剪枝已删除侠客的进度并清理阵型', () => {
    const storage = memoryStorage()
    const state = createNewGameStateV10('燕七', 1000)
    state.heroes.hero_shen_yanqiu = structuredClone(state.heroes.hero_player)
    state.formation = [
      { heroId: 'hero_player', row: 1, col: 0 },
      { heroId: 'hero_shen_yanqiu', row: 0, col: 1 },
    ]
    saveGameV10(storage, state, 1000)

    const loaded = loadGameV10(storage, 2000)

    expect(loaded.state.heroes.hero_shen_yanqiu).toBeUndefined()
    expect(loaded.state.heroes.hero_player).toBeDefined()
    expect(loaded.state.formation).toEqual([{ heroId: 'hero_player', row: 1, col: 0 }])
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

  it.each([
    ['职业记录不是对象', (hero: Record<string, unknown>) => { hero.careers = { sword: null } }],
    ['职业等级不是有限数字', (hero: Record<string, unknown>) => {
      hero.careers = { job_1: { level: '1', experience: 0 } }
    }],
    ['职业经验不是有限数字', (hero: Record<string, unknown>) => {
      hero.careers = { job_1: { level: 1, experience: '0' } }
    }],
    ['已学武功不是对象', (hero: Record<string, unknown>) => { hero.learnedMartials = { foo: null } }],
    ['武功等级不是有限数字', (hero: Record<string, unknown>) => {
      hero.learnedMartials = { foo: { level: '1', invested: { worldCurrency: {}, contribution: {} } } }
    }],
    ['武功投入不是对象', (hero: Record<string, unknown>) => {
      hero.learnedMartials = { foo: { level: 1, invested: null } }
    }],
    ['世界货币投入不是对象', (hero: Record<string, unknown>) => {
      hero.learnedMartials = { foo: { level: 1, invested: { worldCurrency: null, contribution: {} } } }
    }],
    ['势力贡献投入不是对象', (hero: Record<string, unknown>) => {
      hero.learnedMartials = { foo: { level: 1, invested: { worldCurrency: {}, contribution: [] } } }
    }],
    ['投入金额不是有限数字', (hero: Record<string, unknown>) => {
      hero.learnedMartials = { foo: { level: 1, invested: { worldCurrency: { world_01: '100' }, contribution: {} } } }
    }],
    ['装备槽位值不是字符串或 null', (hero: Record<string, unknown>) => { hero.equipmentBySlot = { weapon: 42 } }],
  ])('拒绝嵌套侠客字段损坏：%s', (_field, mutate) => {
    const storage = memoryStorage()
    const raw = createNewGameStateV10('燕七', 1000) as unknown as Record<string, unknown>
    const heroes = raw.heroes as Record<string, Record<string, unknown>>
    mutate(heroes.hero_player)
    const serialized = JSON.stringify(raw)
    storage.setItem(SAVE_KEY_V10, serialized)

    const loaded = loadGameV10(storage, 2000)

    expect(loaded.recoveredFromError).toBe(true)
    expect(loaded.state).toEqual(createInitialStateV10(2000))
    expect(storage.getItem(SAVE_KEY_V10)).toBe(serialized)
  })

  it('拒绝嵌套侠客字段中的无限数字', () => {
    const raw = createNewGameStateV10('燕七', 1000)
    raw.heroes.hero_player.careers.job_1.level = Number.POSITIVE_INFINITY

    expect(() => hydrateStateV10(raw, 2000)).toThrow('存档版本不受支持或格式无效')
  })

  it('读取旧七部位存档时迁到八部位三套，并改写腰佩/信物 id', () => {
    const raw = createNewGameStateV10('燕七', 1000) as unknown as Record<string, unknown>
    const heroes = raw.heroes as Record<string, Record<string, unknown>>
    delete heroes.hero_player.equipmentSets
    delete heroes.hero_player.activeEquipmentSetIndex
    heroes.hero_player.equipmentBySlot = {
      weapon: 'uid-weapon',
      waist: 'uid-waist',
      token: 'uid-token',
    }
    raw.inventory = [
      { uid: 'uid-weapon', definitionId: 'world_01_weapon', level: 4, quality: '凡品', affixes: [], locked: false },
      { uid: 'uid-waist', definitionId: 'world_01_waist', level: 3, quality: '良品', affixes: [], locked: false },
      { uid: 'uid-token', definitionId: 'world_01_token', level: 2, quality: '上品', affixes: [], locked: false },
    ]

    const loaded = hydrateStateV10(raw, 2000)
    const hero = loaded.heroes.hero_player

    expect(hero.activeEquipmentSetIndex).toBe(0)
    expect(hero.equipmentBySlot).toEqual({
      weapon: 'uid-weapon',
      necklace: 'uid-waist',
      ring: 'uid-token',
    })
    expect(hero.equipmentBySlot).toBe(hero.equipmentSets[0])
    expect(hero.equipmentSets[1]).toEqual({})
    expect(hero.equipmentSets[2]).toEqual({})
    expect(loaded.inventory.map((item) => item.definitionId)).toEqual([
      'world_01_weapon',
      'world_01_necklace',
      'world_01_ring',
    ])
  })
})
