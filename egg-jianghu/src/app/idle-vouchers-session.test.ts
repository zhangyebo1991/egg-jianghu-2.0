import { afterEach, expect, it, vi } from 'vitest'
import { GameSession, SaveConflictError } from './game-session'
import { SAVE_KEY_V10, type StorageLike } from '../domain/save-v10'

const start = Date.parse('2026-09-11T08:00:00+08:00')
const hour = 3_600_000
const storage = (): StorageLike => {
  const values = new Map<string, string>()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: key => { values.delete(key) } }
}
afterEach(() => vi.useRealTimers())

it.each(['guard', 'roam'] as const)('%s 离线只补蛋蛋，进入后立即保存防重领，未重新挂机不继续赚', mode => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(start)
  const store = storage()
  const session = GameSession.createNew(store, '少侠')
  expect(session.startStage({ worldId: 'world_01', stage: 1, mode, seed: 1 }).ok).toBe(true)
  session.save()
  const before = structuredClone(session.state)
  vi.setSystemTime(start + 8 * hour)
  const resumed = GameSession.continue(store)
  expect(resumed.offlineVoucherReward).toBe(700)
  expect(resumed.combat).toBeNull()
  expect(resumed.state.idleVouchers.activeMode).toBeNull()
  expect({ ...resumed.state, idleVouchers: before.idleVouchers, lastSavedAt: before.lastSavedAt }).toEqual(before)
  expect(JSON.parse(store.getItem(SAVE_KEY_V10)!).idleVouchers.balance).toBe(700)
  vi.setSystemTime(start + 32 * hour)
  expect(GameSession.continue(store).state.idleVouchers.balance).toBe(700)
})

it('在线获得后离线共用日上限，停止后不再离线积累', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(start)
  const store = storage()
  const session = GameSession.createNew(store, '少侠')
  session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 1 })
  vi.setSystemTime(start + hour)
  expect(session.settleVoucherTime()).toBe(100)
  vi.setSystemTime(start + 8 * hour)
  const resumed = GameSession.continue(store)
  expect(resumed.offlineVoucherReward).toBe(600)
  resumed.startStage({ worldId: 'world_01', stage: 1, mode: 'roam', seed: 2 })
  resumed.stopCombat()
  resumed.save()
  vi.setSystemTime(start + 32 * hour)
  expect(GameSession.continue(store).state.idleVouchers.balance).toBe(700)
})

it('陈旧窗口不能将自己的蛋蛋结算覆盖最新存档', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(start)
  const store = storage()
  const stale = GameSession.createNew(store, '少侠')
  const current = GameSession.continue(store)
  current.state.worldCurrency.world_01 = 9999
  current.save()
  const snapshot = store.getItem(SAVE_KEY_V10)
  vi.setSystemTime(start + hour)
  expect(() => stale.settleVoucherTime()).toThrow(SaveConflictError)
  expect(store.getItem(SAVE_KEY_V10)).toBe(snapshot)
})
