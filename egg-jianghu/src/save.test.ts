import { describe, expect, it } from 'vitest'
import { OFFLINE_CAP_SECONDS, chooseMysteryBlessing, createInitialState, startMystery } from './game'
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

  it('离线后正确结算收益并显示败敌数量', () => {
    const storage = new MemoryStorage()
    const now = 10_000_000
    const state = createInitialState(now - 3_600_000)
    storage.setItem(SAVE_KEY, JSON.stringify(state))
    const loaded = loadGame(storage, now)

    expect(loaded.settlement?.seconds).toBe(3_600)
    expect(loaded.settlement?.regionId).toBe('bluestone_path')
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

  it('离线结算使用离开时所选区域的收益倍率', () => {
    const storage = new MemoryStorage()
    const now = 10_000_000
    const state = createInitialState(now - 3_600_000)
    state.defeatedBossIds.push('boss_stonebreaker')
    state.selectedRegionId = 'blackwind_fort'
    storage.setItem(SAVE_KEY, JSON.stringify(state))

    const loaded = loadGame(storage, now)
    expect(loaded.settlement?.regionId).toBe('blackwind_fort')
    expect(loaded.settlement?.silver).toBe(Math.floor(3_600 * 1.35 * 0.8))
    expect(loaded.settlement?.experience).toBe(Math.floor(3_600 * 0.82 * 1.55))
    expect(loaded.settlement?.pages).toBe(24)
    expect(loaded.state.regionDefeats.blackwind_fort).toBe(300)
  })

  it('JSON 导出后可重新导入且会校验结构', () => {
    const state = createInitialState()
    state.resources.reputation = 42
    const imported = importSave(exportSave(state))
    expect(imported.state.resources.reputation).toBe(42)
    expect(() => hydrateState({ version: 7 })).toThrow(/版本/)
  })

  it('能够把 version 1 的队伍和关卡进度迁移为 version 6 区域进度', () => {
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
    expect(migrated.version).toBe(6)
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

    expect(migrated.version).toBe(6)
    expect(migrated.formation.map((slot) => slot.row)).toEqual(['back', 'front', 'front'])
    expect(migrated.defeatedBossIds).toEqual(['boss_stonebreaker'])
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
