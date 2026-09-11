import { expect, it } from 'vitest'
import { GameSession, SaveConflictError } from './game-session'
import { SAVE_KEY_V10, type StorageLike } from '../domain/save-v10'

const now = 1_800_000_000_000
const setup = () => {
  const data = new Map<string, string>()
  const storage: StorageLike = { getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v) }, removeItem: k => { data.delete(k) } }
  const session = GameSession.createNew(storage, '少侠', now)
  session.state.idleVouchers.balance = 4000
  session.save(now)
  return { storage, session }
}
it('购买原子持久化，陈旧窗口不能重复花费余额', () => {
  const { storage, session } = setup()
  const stale = GameSession.continue(storage, now)
  expect(session.buyPremiumCard('monthly', now).ok).toBe(true)
  expect(() => stale.buyPremiumCard('monthly', now)).toThrow(SaveConflictError)
  const resumed = GameSession.continue(storage, now)
  expect(resumed.state.idleVouchers.balance).toBe(1000)
  expect(resumed.state.premiumCards.expiresAt.monthly).toBe(now + 30 * 86_400_000)
})
it('扣款后的持久化失败时恢复余额与权益', () => {
  const { storage, session } = setup()
  const original = storage.setItem
  let writes = 0
  storage.setItem = (key, value) => {
    if (++writes === 2) throw new Error('磁盘已满')
    original(key, value)
  }
  expect(() => session.buyPremiumCard('monthly', now)).toThrow('磁盘已满')
  expect(session.state.idleVouchers.balance).toBe(4000)
  expect(session.state.premiumCards.expiresAt.monthly).toBe(0)
  expect(JSON.parse(storage.getItem(SAVE_KEY_V10)!).idleVouchers.balance).toBe(4000)
})
