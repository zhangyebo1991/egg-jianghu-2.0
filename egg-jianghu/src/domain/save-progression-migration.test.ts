import { describe, expect, it } from 'vitest'
import { GameSession, SaveConflictError } from '../app/game-session'
import { equipmentIdBySlot } from '../content/equipment'
import { validateSave } from '../cloud/validator'
import { backpackEquipment } from './inventory'
import { createNewGameStateV10 } from './state'
import { exportSaveV10, hydrateStateV10, PRE_V20_SAVE_BACKUP_KEY, SAVE_KEY_V10 } from './save-v10'
import type { EquipmentInstance } from './types'

const legacy = () => {
  const state = createNewGameStateV10('迁移少侠', 1000)
  state.heroes.hero_player.level = 99
  state.heroes.hero_player.experience = 25522
  state.heroes.hero_player.skillPoints = 567358
  state.heroes.hero_player.careers.job_1 = { level: 4, experience: 486857 }
  state.worldCurrency.world_01 = 123456
  state.statistics.kills = 51578
  state.idleVouchers.balance = 1363
  return { ...state, version: 19 }
}

const storageFor = (raw = legacy()) => {
  const original = JSON.stringify(raw)
  const values = new Map([[SAVE_KEY_V10, original]])
  return {
    original, values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

describe('v19 → v20 一次性进度换算', () => {
  it('复现 99 级存档，经验守恒、职业补升，其他长期进度和输入不变', () => {
    const raw = legacy()
    const before = structuredClone(raw)
    const loaded = hydrateStateV10(raw, 1000)
    expect(loaded.heroes.hero_player).toMatchObject({ level: 19, experience: 61645,
      careers: { job_1: { level: 10, experience: 0 } } })
    const expected = { ...structuredClone(before), version: 20 }
    expected.heroes.hero_player.level = 19
    expected.heroes.hero_player.experience = 61645
    expected.heroes.hero_player.careers.job_1 = { level: 10, experience: 0 }
    expect(loaded).toEqual(expected)
    expect(raw).toEqual(before)
    expect(hydrateStateV10(JSON.parse(exportSaveV10(loaded, 1000)), 1000)).toEqual(loaded)
  })

  it('经验恰好到门槛时升级，未到门槛不升级，并结算非当前职业', () => {
    const raw = legacy()
    raw.heroes.hero_player.level = 5
    raw.heroes.hero_player.experience = 0
    raw.heroes.hero_player.careers.job_1 = { level: 4, experience: 2777 }
    raw.heroes.hero_player.careers.job_2 = { level: 1, experience: 100000 }
    const loaded = hydrateStateV10(raw, 1000)
    expect(loaded.heroes.hero_player).toMatchObject({ level: 2, experience: 0, currentCareerId: 'job_1',
      careers: { job_1: { level: 4, experience: 2777 } } })
    expect(loaded.heroes.hero_player.careers.job_2.level).toBeGreaterThan(1)
    raw.heroes.hero_player.careers.job_1.experience = 2778
    expect(hydrateStateV10(raw, 1000).heroes.hero_player.careers.job_1).toEqual({ level: 5, experience: 0 })
  })

  it('满背包仍卸下全部方案中超等级装备，实例、锁定和合格装备完整保留', () => {
    const raw = legacy()
    const item = (uid: string, equipmentLevel: number): EquipmentInstance => ({ uid,
      definitionId: equipmentIdBySlot('weapon'), level: 40, equipmentLevel,
      quality: 0, coreStats: [{ attributeId: 8, coefficient: 100 }], affixes: [], locked: true })
    raw.inventory = Array.from({ length: 300 }, (_, i) => item(`pack-${i}`, 40))
    raw.inventory.push(item('high', 20), item('fit', 19), item('reserve', 30))
    const hero = raw.heroes.hero_player
    hero.equipmentSets = [{ weapon: 'high' }, { weapon: 'fit' }, { weapon: 'reserve' }]
    hero.equipmentBySlot = hero.equipmentSets[0]
    const loaded = hydrateStateV10(raw, 1000)
    expect(loaded.heroes.hero_player.equipmentSets).toEqual([{ weapon: null }, { weapon: 'fit' }, { weapon: null }])
    expect(loaded.heroes.hero_player.equipmentBySlot).toBe(loaded.heroes.hero_player.equipmentSets[0])
    expect(loaded.inventory).toEqual(raw.inventory)
    expect(backpackEquipment(loaded)).toHaveLength(302)
    expect(loaded.statistics).toEqual(raw.statistics)
  })

  it('继续游戏先备份再保存 v20，重载不再换算，并阻止陈旧会话覆盖', () => {
    const store = storageFor()
    const current = GameSession.continue(store, 1000)
    expect(store.getItem(PRE_V20_SAVE_BACKUP_KEY)).toBe(store.original)
    expect(JSON.parse(store.getItem(SAVE_KEY_V10)!).version).toBe(20)
    expect(GameSession.continue(store, 1000).state.heroes.hero_player.level).toBe(19)
    store.setItem(SAVE_KEY_V10, 'newer-snapshot')
    expect(() => current.save(1000)).toThrow(SaveConflictError)
    expect(store.getItem(PRE_V20_SAVE_BACKUP_KEY)).toBe(store.original)
  })

  it('备份失败不覆盖原档，写入新档失败仍可安全重试', () => {
    for (const failingKey of [PRE_V20_SAVE_BACKUP_KEY, SAVE_KEY_V10]) {
      const store = storageFor()
      const setItem = store.setItem
      store.setItem = (key, value) => { if (key === failingKey) throw new Error('空间不足'); setItem(key, value) }
      expect(() => GameSession.continue(store, 1000)).toThrow('空间不足')
      expect(store.getItem(SAVE_KEY_V10)).toBe(store.original)
      store.setItem = setItem
      expect(GameSession.continue(store, 1000).state.heroes.hero_player.level).toBe(19)
      expect(store.getItem(PRE_V20_SAVE_BACKUP_KEY)).toBe(store.original)
    }
  })

  it('云校验迁移旧档并输出 v20，重复上传不再换算；新 v20 的高等级不变', () => {
    const first = validateSave(legacy())
    expect(first.summary).toMatchObject({ version: 20, level: 19 })
    expect(validateSave(JSON.parse(first.json)).json).toBe(first.json)
    const current = { ...legacy(), version: 20 }
    expect(hydrateStateV10(current, 1000).heroes.hero_player.level).toBe(99)
  })

  it('拒绝非法旧经验和未知版本，避免死循环或误降级', () => {
    for (const experience of [-1, Infinity, Number.MAX_SAFE_INTEGER]) {
      const raw = legacy()
      raw.heroes.hero_player.experience = experience
      expect(() => hydrateStateV10(raw, 1000)).toThrow()
    }
    expect(() => hydrateStateV10({ ...legacy(), version: 21 }, 1000)).toThrow()
  })
})
