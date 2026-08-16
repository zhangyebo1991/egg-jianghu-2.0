import { describe, expect, it } from 'vitest'
import { createInitialStateV10, createNewGameStateV10 } from './state'
import { clearSaveV10, hasLegacySaveV17, hasSaveV10, hydrateStateV10, LEGACY_SAVE_KEY_V17, loadGameV10, SAVE_KEY_V10, saveGameV10 } from './save-v10'

const memoryStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    values,
  }
}

describe('version 18 存档', () => {
  it('通过 version 18 专用 key 检测存档是否存在', () => {
    const storage = memoryStorage()

    expect(hasSaveV10(storage)).toBe(false)

    storage.setItem(SAVE_KEY_V10, '{}')

    expect(hasSaveV10(storage)).toBe(true)
    expect(SAVE_KEY_V10).toBe('egg-jianghu-2-save-v18')
  })

  it('清除时只移除 version 18 存档并保留 version 17 旧档', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY_V10, '{}')
    storage.setItem(LEGACY_SAVE_KEY_V17, '旧档')
    storage.setItem('other-key', '保留')

    clearSaveV10(storage)

    expect(storage.getItem(SAVE_KEY_V10)).toBeNull()
    expect(storage.getItem(LEGACY_SAVE_KEY_V17)).toBe('旧档')
    expect(hasLegacySaveV17(storage)).toBe(true)
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
    expect(raw.version).toBe(18)
    expect(raw.combat).toBeUndefined()
    expect(raw.lastSavedAt).toBe(2000)
  })

  it('关闭期间不根据 lastSavedAt 推进悬榜倒计时', () => {
    const storage = memoryStorage()
    const state = createInitialStateV10(1000)
    state.factionBoards.tieyi_school = { refreshRemainingMs: 1234, slots: [null, null, null, null, null] }
    saveGameV10(storage, state, 1000)

    const loaded = loadGameV10(storage, 99_999)

    expect(loaded.state.factionBoards.tieyi_school.refreshRemainingMs).toBe(1234)
  })

  it('保存并恢复独立的声望、代理人、幻型、五格悬榜与接受记录', () => {
    const storage = memoryStorage()
    const state = createInitialStateV10(1000)
    state.worldReputation.world_01 = 321
    state.factionAgents.world_01 = { heroId: 'hero_player', enabled: true }
    state.unlockedSkinIds = [7, 11]
    state.factionBoards.tieyi_school = {
      refreshRemainingMs: 1234,
      slots: [{ id: 'q1', taskId: 1, quality: 2, targetId: 1, generatedAt: 1000, acceptedRecordId: 1 }, null, null, null, null],
    }
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
    saveGameV10(storage, state, 1000)

    const loaded = loadGameV10(storage, 2000)

    expect(loaded.recoveredFromError).toBe(false)
    expect(loaded.state.worldReputation.world_01).toBe(321)
    expect(loaded.state.factionAgents.world_01).toEqual({ heroId: 'hero_player', enabled: true })
    expect(loaded.state.unlockedSkinIds).toEqual([7, 11])
    expect(loaded.state.factionBoards.tieyi_school.slots).toHaveLength(5)
    expect(loaded.state.acceptedFactionQuests['1'].progress).toBe(3)
  })

  it('保存并恢复原版城市地块、公司现金与财务状态', () => {
    const storage = memoryStorage()
    const state = createInitialStateV10(1000)
    state.city.company.cash = 200_000
    state.city.company.name = '试剑商会'
    state.city.company.currentFinance.其他支出 = 100_000
    state.city.company.appointments['1'] = 'hero_player'
    state.city.tiles[171].owned = true
    saveGameV10(storage, state, 1000)

    const loaded = loadGameV10(storage, 2000)

    expect(loaded.recoveredFromError).toBe(false)
    expect(loaded.state.city.company).toEqual(state.city.company)
    expect(loaded.state.city.tiles).toHaveLength(324)
    expect(loaded.state.city.tiles[171]).toEqual(state.city.tiles[171])
  })

  it.each([
    ['缺少位面声望', (raw: Record<string, unknown>) => { delete raw.worldReputation }],
    ['代理人字段损坏', (raw: Record<string, unknown>) => { raw.factionAgents = { world_01: { heroId: 7, enabled: true } } }],
    ['悬榜不是五格', (raw: Record<string, unknown>) => {
      raw.factionBoards = { tieyi_school: { refreshRemainingMs: 1, slots: [null, null, null, null, null, null] } }
    }],
    ['接受记录键不匹配', (raw: Record<string, unknown>) => {
      raw.acceptedFactionQuests = {
        2: { recordId: 1, factionId: 'tieyi_school', factionSourceId: 2, worldIndex: 1, taskId: 1, quality: 1, targetId: 1, requiredAmount: 1, progress: 0, boardSlot: 0, status: 1 },
      }
    }],
    ['接受记录没有对应悬榜关联', (raw: Record<string, unknown>) => {
      raw.acceptedFactionQuests = {
        1: { recordId: 1, factionId: 'tieyi_school', factionSourceId: 2, worldIndex: 1, taskId: 1, quality: 1, targetId: 1, requiredAmount: 1, progress: 0, boardSlot: 0, status: 1 },
      }
    }],
    ['幻型 ID 非整数', (raw: Record<string, unknown>) => { raw.unlockedSkinIds = [1.5] }],
    ['城市地块数量损坏', (raw: Record<string, unknown>) => {
      const city = raw.city as { tiles: unknown[] }
      city.tiles.pop()
    }],
    ['城市地块坐标重复', (raw: Record<string, unknown>) => {
      const city = raw.city as { tiles: Array<Record<string, unknown>> }
      city.tiles[1].gridX = city.tiles[0].gridX
      city.tiles[1].gridY = city.tiles[0].gridY
    }],
    ['公司现金损坏', (raw: Record<string, unknown>) => {
      const city = raw.city as { company: Record<string, unknown> }
      city.company.cash = -1
    }],
  ])('拒绝 v18 关键状态损坏：%s', (_name, mutate) => {
    const raw = createNewGameStateV10('燕七', 1000) as unknown as Record<string, unknown>
    mutate(raw)
    expect(() => hydrateStateV10(raw, 2000)).toThrow('存档版本不受支持或格式无效')
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

  it('拒绝 version 15 的旧七部位装备存档', () => {
    const raw = createNewGameStateV10('燕七', 1000) as unknown as Record<string, unknown>
    raw.version = 15
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

    expect(() => hydrateStateV10(raw, 2000)).toThrow('存档版本不受支持或格式无效')
  })
})
