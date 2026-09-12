import { expect, it } from 'vitest'
import { GameSession, SaveConflictError } from './game-session'
import type { StorageLike } from '../domain/save-v10'

const now = 1_800_000_000_000
const setup = () => {
  const data = new Map<string, string>()
  const storage: StorageLike = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: key => { data.delete(key) } }
  const session = GameSession.createNew(storage, '少侠', now)
  session.state.idleVouchers.balance = 2000
  session.save(now)
  return { storage, session }
}
it('普通池消费、角色、保底一起持久化，陈旧窗口不能再次抽取', () => {
  const { storage, session } = setup()
  const stale = GameSession.continue(storage, now)
  expect(session.drawOrdinaryPool(1, now, () => 0.5).ok).toBe(true)
  expect(() => stale.drawOrdinaryPool(1, now, () => 0)).toThrow(SaveConflictError)
  const loaded = GameSession.continue(storage, now)
  expect(loaded.state.ordinaryPoolMisses).toBe(1)
  expect(loaded.state.idleVouchers.balance).toBe(1900)
  expect(loaded.drawOrdinaryPool(1, now, () => 0).ok).toBe(true)
  const reloaded = GameSession.continue(storage, now)
  expect(reloaded.state.heroes.hero_orig_11.recruited).toBe(true)
  expect(reloaded.state.ordinaryPoolMisses).toBe(0)
  expect(reloaded.state.idleVouchers.balance).toBe(1800)
})
it('发奖保存失败时回滚角色、材料、蛋蛋和保底，页面不得展示成功结果', () => {
  for (const chance of [0, 0.5]) {
    const { storage, session } = setup()
    const before = structuredClone(session.state)
    const original = storage.setItem
    let writes = 0
    storage.setItem = (key, value) => {
      if (++writes === 2) throw new Error('磁盘已满')
      original(key, value)
    }
    expect(() => session.drawOrdinaryPool(10, now, () => chance)).toThrow('磁盘已满')
    expect(session.state).toEqual(before)
    expect(GameSession.continue(storage, now).state).toEqual(before)
    storage.setItem = original
    expect(session.drawOrdinaryPool(10, now, () => chance).ok).toBe(true)
  }
})
