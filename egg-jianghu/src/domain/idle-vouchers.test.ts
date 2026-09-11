import { describe, expect, it } from 'vitest'
import { createNewGameStateV10 } from './state'
import { createIdleVouchers, isIdleVouchers, settleIdleVouchers, setVoucherActivity } from './idle-vouchers'
import { exportSaveV10, hydrateStateV10 } from './save-v10'

const start = Date.parse('2026-09-11T08:00:00+08:00')
const minute = 60_000
const hour = 60 * minute
const day = 24 * hour
const activeState = (now = start) => {
  const state = createNewGameStateV10('少侠', now)
  setVoucherActivity(state, 'guard', now)
  return state
}

describe('挂机蛋蛋', () => {
  it('六分钟十点、七小时封顶，重复结算不再发放', () => {
    const state = activeState()
    expect(settleIdleVouchers(state, start + 6 * minute - 1)).toBe(0)
    expect(settleIdleVouchers(state, start + 6 * minute)).toBe(10)
    expect(settleIdleVouchers(state, start + 7 * hour)).toBe(690)
    expect(settleIdleVouchers(state, start + 10 * hour)).toBe(0)
    expect(settleIdleVouchers(state, start + 10 * hour)).toBe(0)
    expect(state.idleVouchers.balance).toBe(700)
  })

  it('暂停不积累，分段余量和切换模式均保留', () => {
    const state = activeState()
    setVoucherActivity(state, null, start + 3 * minute)
    expect(settleIdleVouchers(state, start + hour)).toBe(0)
    setVoucherActivity(state, 'roam', start + hour)
    expect(settleIdleVouchers(state, start + hour + 3 * minute)).toBe(10)
  })

  it('跨北京时间零点拆分并发旧日整数尾款', () => {
    const night = Date.parse('2026-09-11T23:58:00+08:00')
    const state = activeState(night)
    expect(settleIdleVouchers(state, night + 8 * minute)).toBe(13)
    expect(state.idleVouchers.creditedToday).toBe(10)
    expect(isIdleVouchers(state.idleVouchers)).toBe(true)
  })

  it('跨多天按日封顶，只有蛋蛋变化且可快速处理多年离线', () => {
    const state = activeState()
    const before = structuredClone(state)
    expect(settleIdleVouchers(state, start + 3 * day)).toBe(2800)
    expect(state.idleVouchers.creditedToday).toBe(700)
    expect({ ...state, idleVouchers: before.idleVouchers }).toEqual(before)
    const long = activeState()
    expect(settleIdleVouchers(long, start + 3650 * day)).toBe(3651 * 700)
  })

  it('回拨时间不重发、不重置日期，封顶多余时长不带入次日', () => {
    const state = activeState()
    settleIdleVouchers(state, start + 8 * hour)
    const snapshot = structuredClone(state.idleVouchers)
    expect(settleIdleVouchers(state, start)).toBe(0)
    expect(state.idleVouchers).toEqual(snapshot)
    setVoucherActivity(state, null, start + 8 * hour)
    settleIdleVouchers(state, start + day)
    expect(state.idleVouchers.balance).toBe(700)
    expect(state.idleVouchers.elapsedMs).toBe(0)
  })

  it('旧 v19 从零初始化不追溯，新增字段往返保留且拒绝异常进度', () => {
    const state = activeState()
    settleIdleVouchers(state, start + 9 * minute)
    const raw = JSON.parse(exportSaveV10(state, start + 9 * minute))
    expect(hydrateStateV10(raw, start + hour).idleVouchers).toEqual(state.idleVouchers)
    const legacy = structuredClone(raw)
    delete legacy.idleVouchers
    expect(hydrateStateV10(legacy, start + hour).idleVouchers).toEqual(createIdleVouchers(start + hour))
    for (const invalid of [{ balance: -1 }, { activeMode: 'invalid' }, { elapsedMs: 999999999 }, { creditedToday: 700 }, { day: 0 }, { lastSettledAt: Infinity }]) {
      expect(() => hydrateStateV10({ ...raw, idleVouchers: { ...raw.idleVouchers, ...invalid } }, start + hour)).toThrow()
    }
  })
})
