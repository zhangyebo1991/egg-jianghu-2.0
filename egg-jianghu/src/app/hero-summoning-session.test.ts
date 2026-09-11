import { expect, it } from 'vitest'
import { GameSession, SaveConflictError } from './game-session'
import { SAVE_KEY_V10, type StorageLike } from '../domain/save-v10'

const now = 1_800_000_000_000
const setup = () => {
  const data = new Map<string, string>()
  const storage: StorageLike = { getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v) }, removeItem: k => { data.delete(k) } }
  const session = GameSession.createNew(storage, '少侠', now)
  session.state.idleVouchers.balance = 4000
  session.setSummoningTarget('world_01', 'hero_orig_9', now)
  return { storage, session }
}
it('招募与福利领取原子保存，陈旧窗口不能再次领取或扣款', () => {
  const { storage, session } = setup()
  const stale = GameSession.continue(storage, now)
  expect(session.redeemWelfareCode('花花蛋无敌', now).ok).toBe(true)
  expect(() => stale.redeemWelfareCode('花花蛋无敌', now)).toThrow(SaveConflictError)
  expect(() => stale.summonHeroes('world_01', 1, now)).toThrow(SaveConflictError)
  expect(session.summonHeroes('world_01', 10, now, () => 0).ok).toBe(true)
  const restored = GameSession.continue(storage, now)
  expect(restored.state.heroes.hero_orig_165.recruited).toBe(true)
  expect(restored.state.heroes.hero_orig_8.recruited).toBe(true)
  expect(restored.state.idleVouchers.balance).toBe(3180)
  expect(restored.state.heroSummoning.chapters.world_01.sinceTarget).toBe(10)
})
it.each(['福利', '招募', '心愿'])('%s保存失败回滚所有本轮改动，恢复后可以重试', kind => {
  const { storage, session } = setup()
  const before = structuredClone(session.state)
  const original = storage.setItem
  let writes = 0
  storage.setItem = (key, value) => {
    if (++writes === 2) throw new Error('磁盘已满')
    original(key, value)
  }
  const action = () => kind === '福利' ? session.redeemWelfareCode('花花蛋无敌', now)
    : kind === '心愿' ? session.setSummoningTarget('world_01', 'hero_orig_12', now)
    : session.summonHeroes('world_01', 10, now, () => 0)
  expect(action).toThrow('磁盘已满')
  expect(session.state).toEqual(before)
  const disk = JSON.parse(storage.getItem(SAVE_KEY_V10)!)
  expect(disk.heroSummoning).toEqual(before.heroSummoning)
  expect(disk.redeemedWelfareCodes).toEqual([])
  expect(disk.idleVouchers.balance).toBe(4000)
  storage.setItem = original
  expect(action().ok).toBe(true)
})
