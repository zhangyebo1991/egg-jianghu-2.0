import { describe, expect, it } from 'vitest'
import { chooseMysteryBlessing, createInitialState, startMystery } from './game'
import { SAVE_KEY, exportSave, hydrateState, importSave, loadGame, saveGame, type StorageLike } from './save'

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

describe('本地存档', () => {
  it('能够保存并恢复进度', () => {
    const storage = new MemoryStorage()
    const state = createInitialState(10_000)
    state.resources.silver = 888
    state.defeatedBossIds.push('boss_stonebreaker', 'boss_blackwind_chief')
    state.selectedRegionId = 'frost_temple'
    state.regionDefeats.frost_temple = 27
    state.formation[0].row = 'back'
    state.formation[2].row = 'front'
    saveGame(storage, state, 20_000)

    const loaded = loadGame(storage, 20_000)
    expect(loaded.recoveredFromError).toBe(false)
    expect(loaded.state.resources.silver).toBe(888)
    expect(loaded.state.defeatedBossIds).toEqual(['boss_stonebreaker', 'boss_blackwind_chief'])
    expect(loaded.state.selectedRegionId).toBe('frost_temple')
    expect(loaded.state.regionDefeats.frost_temple).toBe(27)
    expect(loaded.state.formation).toHaveLength(3)
    expect(loaded.state.formation.map((slot) => slot.row)).toEqual(['back', 'front', 'front'])
  })

  it('离线后不会结算收益或自动开始挂机', () => {
    const storage = new MemoryStorage()
    const now = 10_000_000
    const state = createInitialState(now - 3_600_000)
    state.resources.silver = 321
    storage.setItem(SAVE_KEY, JSON.stringify(state))
    const loaded = loadGame(storage, now)

    expect(loaded.state.resources.silver).toBe(321)
    expect(loaded.state.regionDefeats.bluestone_path).toBe(0)
    expect(loaded.state.combat.status).toBe('ready')
  })

  it('JSON 导出后可重新导入且会校验结构', () => {
    const state = createInitialState()
    state.resources.reputation = 42
    const imported = importSave(exportSave(state))
    expect(imported.state.resources.reputation).toBe(42)
    expect(() => hydrateState({ version: 9 })).toThrow(/版本/)
  })

  it('把 version 6 单武功字段迁移为 version 7 学习账本和四槽', () => {
    const current = createInitialState(10_000)
    const heroId = current.formation[0].heroId
    const legacy = structuredClone(current) as unknown as Record<string, unknown>
    legacy.version = 6
    const heroes = legacy.heroes as Record<string, Record<string, unknown>>
    heroes[heroId] = {
      unlocked: true,
      level: 9,
      equippedMartialId: 'dragon_palm',
      martialRanks: { dragon_palm: 3, frost_sword: 2 },
    }

    const migrated = hydrateState(legacy, 10_000)
    expect(migrated.version).toBe(8)
    expect(migrated.heroes[heroId].equippedMartialIds).toEqual(['dragon_palm', null, null, null])
    expect(migrated.heroes[heroId].learnedMartials.dragon_palm.invested)
      .toEqual({ silver: 165, experience: 0, pages: 36, reputation: 0 })
    expect(migrated.heroes[heroId].learnedMartials.frost_sword.rank).toBe(2)
  })

  it('旧存档只迁移一次并立即写回 version 7', () => {
    const storage = new MemoryStorage()
    const raw = structuredClone(createInitialState(10_000)) as unknown as Record<string, unknown>
    raw.version = 6
    const heroId = createInitialState(10_000).formation[0].heroId
    const heroes = raw.heroes as Record<string, Record<string, unknown>>
    heroes[heroId] = {
      unlocked: true,
      level: 1,
      equippedMartialId: 'dragon_palm',
      martialRanks: { dragon_palm: 3 },
    }
    storage.setItem(SAVE_KEY, JSON.stringify(raw))

    const first = loadGame(storage, 10_000).state
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(8)
    const second = loadGame(storage, 10_000).state
    expect(second.heroes[heroId].learnedMartials).toEqual(first.heroes[heroId].learnedMartials)
  })

  it('清洗 version 7 的负数账本、无效武功、重复槽位和超长槽位', () => {
    const raw = structuredClone(createInitialState(10_000))
    const heroId = raw.formation[0].heroId
    raw.heroes[heroId].learnedMartials = {
      dragon_palm: {
        rank: 99,
        invested: { silver: -50, experience: Number.NaN, pages: 12, reputation: 3 },
      },
    }
    raw.heroes[heroId].equippedMartialIds = ['dragon_palm', 'dragon_palm', 'missing', null]

    const hydrated = hydrateState(raw, 10_000)
    expect(hydrated.heroes[heroId].learnedMartials.dragon_palm).toEqual({
      rank: 3,
      invested: { silver: 0, experience: 0, pages: 12, reputation: 3 },
    })
    expect(hydrated.heroes[heroId].equippedMartialIds).toEqual(['dragon_palm', null, null, null])
  })

  it('能够把 version 1 的队伍和关卡进度迁移为 version 7 区域进度', () => {
    const current = createInitialState(10_000)
    const { formation, selectedRegionId, defeatedBossIds, regionDefeats, ...legacyBase } = current
    void selectedRegionId
    void defeatedBossIds
    void regionDefeats
    const legacy = {
      ...legacyBase,
      version: 1,
      party: formation.map((slot) => slot.heroId),
      clearedStage: 2,
    }

    const migrated = hydrateState(legacy, 10_000)
    expect(migrated.version).toBe(8)
    expect(migrated.formation.map((slot) => slot.heroId)).toEqual(formation.map((slot) => slot.heroId))
    expect(migrated.formation.map((slot) => slot.row)).toEqual(['front', 'front', 'back'])
    expect(migrated.defeatedBossIds).toEqual(['boss_stonebreaker', 'boss_blackwind_chief'])
    expect(migrated.selectedRegionId).toBe('bluestone_path')
  })

  it('version 2 阵型存档会保留站位并迁移已破关 BOSS', () => {
    const current = createInitialState(10_000)
    const { selectedRegionId, defeatedBossIds, regionDefeats, ...legacyBase } = current
    void selectedRegionId
    void defeatedBossIds
    void regionDefeats
    legacyBase.formation[0].row = 'back'
    legacyBase.formation[2].row = 'front'
    const migrated = hydrateState({ ...legacyBase, version: 2, clearedStage: 1 }, 10_000)

    expect(migrated.version).toBe(8)
    expect(migrated.formation.map((slot) => slot.row)).toEqual(['back', 'front', 'front'])
    expect(migrated.defeatedBossIds).toEqual(['boss_stonebreaker'])
  })

  it('version 7 旧档会按排内顺序补齐 position 并升级为 version 8', () => {
    const current = createInitialState(10_000)
    const legacy = structuredClone(current) as unknown as Record<string, unknown>
    legacy.version = 7
    const formation = legacy.formation as Array<Record<string, unknown>>
    for (const slot of formation) delete slot.position
    const migrated = hydrateState(legacy, 10_000)
    expect(migrated.version).toBe(8)
    expect(migrated.formation.map((slot) => slot.position)).toEqual([0, 1, 0])
  })

  it('version 8 存档会保留空洞站位', () => {
    const current = createInitialState(10_000)
    current.formation[0].position = 2   // 前排侠客放到 3 号位，1、2 号位空
    const migrated = hydrateState(structuredClone(current), 10_000)
    expect(migrated.version).toBe(8)
    expect(migrated.formation.find((slot) => slot.heroId === current.formation[0].heroId)?.position).toBe(2)
  })

  it('秘境路线、祝福和进行中的层战斗可以随存档恢复', () => {
    const storage = new MemoryStorage()
    const state = createInitialState(10_000)
    expect(startMystery(state, 4).ok).toBe(true)
    const choices = [...state.mystery.run!.choiceIds]
    saveGame(storage, state, 10_000)

    const choosing = loadGame(storage, 10_000).state
    expect(choosing.mystery.run?.status).toBe('choosing')
    expect(choosing.mystery.run?.choiceIds).toEqual(choices)
    expect(chooseMysteryBlessing(choosing, choices[0]).ok).toBe(true)
    saveGame(storage, choosing, 10_000)

    const fighting = loadGame(storage, 10_000).state
    expect(fighting.mystery.run?.status).toBe('fighting')
    expect(fighting.mystery.run?.blessingIds).toEqual([choices[0]])
    expect(fighting.combat.mode).toBe('mystery')
    expect(fighting.combat.enemyId).toBe('mist_wolf_pack')
  })

  it('损坏的 localStorage 存档不会阻断游戏启动', () => {
    const storage = new MemoryStorage()
    storage.setItem(SAVE_KEY, '{bad json')
    const loaded = loadGame(storage)
    expect(loaded.recoveredFromError).toBe(true)
    expect(loaded.state.formation).toHaveLength(3)
  })
})
