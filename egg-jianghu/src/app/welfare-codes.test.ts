import { expect, it } from 'vitest'
import { GameSession, SaveConflictError } from './game-session'
import { createInitialStateV10 } from '../domain/state'
import { redeemWelfareCode } from '../domain/welfare-codes'
import { exportSaveV10, hydrateStateV10, importSaveV10, type StorageLike } from '../domain/save-v10'

const now = 1_800_000_000_000
const setup = () => {
  const data = new Map<string, string>()
  const storage: StorageLike = { getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v) }, removeItem: k => { data.delete(k) } }
  return { storage, session: GameSession.createNew(storage, '少侠', now) }
}
it('有效码仅发赵云，无效和重复领取不改变存档、不覆盖培养', () => {
  const state = createInitialStateV10(now)
  const before = structuredClone(state)
  expect(redeemWelfareCode(state, '花花蛋无敌呀').ok).toBe(false)
  expect(state).toEqual(before)
  expect(redeemWelfareCode(state, ' 花花蛋无敌 ')).toMatchObject({ ok: true, rewards: [{ id: 'hero_orig_165', name: '赵云', amount: 1 }] })
  state.heroes.hero_orig_165.level = 30
  expect(redeemWelfareCode(state, '花花蛋无敌').ok).toBe(false)
  state.redeemedWelfareCodes = []
  expect(redeemWelfareCode(state, '花花蛋无敌').ok).toBe(false)
  expect(state.heroes.hero_orig_165.level).toBe(30)
  expect(state.materials).toEqual(before.materials)
  expect(state.idleVouchers).toEqual(before.idleVouchers)
})
it('旧v19档补齐领取字段，领取后的导入导出保留赵云、主角、阵容和标记', () => {
  const { session } = setup()
  const raw = JSON.parse(exportSaveV10(session.state))
  delete raw.redeemedWelfareCodes
  const restored = hydrateStateV10(raw, now)
  expect(restored.heroes).toEqual(session.state.heroes)
  expect(restored.formation).toEqual(session.state.formation)
  expect(restored.redeemedWelfareCodes).toEqual([])
  redeemWelfareCode(restored, '花花蛋无敌')
  const roundtrip = importSaveV10(exportSaveV10(restored)).state
  expect(roundtrip.heroes.hero_orig_165.recruited).toBe(true)
  expect(roundtrip.redeemedWelfareCodes).toEqual(['zhao-yun-welcome'])
  expect(redeemWelfareCode(roundtrip, '花花蛋无敌').ok).toBe(false)
})
it('领取记录损坏或重复时拒绝导入', () => {
  for (const codes of [null, {}, [5], ['zhao-yun-welcome', 'zhao-yun-welcome']]) {
    expect(() => hydrateStateV10({ ...createInitialStateV10(now), redeemedWelfareCodes: codes })).toThrow()
  }
})
it('会话领取持久化，陈旧窗口不能重复领取', () => {
  const { storage, session } = setup()
  const stale = GameSession.continue(storage, now)
  expect(session.redeemWelfareCode('花花蛋无敌', now).ok).toBe(true)
  expect(() => stale.redeemWelfareCode('花花蛋无敌', now)).toThrow(SaveConflictError)
  const resumed = GameSession.continue(storage, now)
  expect(resumed.state.heroes.hero_orig_165.recruited).toBe(true)
  expect(resumed.redeemWelfareCode('花花蛋无敌', now).ok).toBe(false)
})
it('发奖保存失败恢复角色与领取记录，重试可以领取', () => {
  const { storage, session } = setup()
  const before = structuredClone(session.state)
  const original = storage.setItem
  let writes = 0
  storage.setItem = (key, value) => {
    if (++writes === 2) throw new Error('磁盘已满')
    original(key, value)
  }
  expect(() => session.redeemWelfareCode('花花蛋无敌', now)).toThrow('磁盘已满')
  expect(session.state).toEqual(before)
  storage.setItem = original
  expect(session.redeemWelfareCode('花花蛋无敌', now).ok).toBe(true)
})
