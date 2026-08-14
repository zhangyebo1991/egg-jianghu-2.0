import { describe, expect, it } from 'vitest'
import { buyJobBook, JOB_BOOK_PRICE_BY_RANK } from './shop'
import { createInitialStateV10 } from './state'

describe('坊市转职书', () => {
  it('用当前位面铜钱购买一阶转职书且可囤', () => {
    const state = createInitialStateV10()
    const before = state.worldCurrency.world_01

    expect(buyJobBook(state, 'job_5', 'world_01')).toEqual({ ok: true, message: '购得弓手转职书' })
    expect(state.jobBooks.job_5).toBe(1)
    expect(state.worldCurrency.world_01).toBe(before - JOB_BOOK_PRICE_BY_RANK[2])

    expect(buyJobBook(state, 'job_5', 'world_01').ok).toBe(true)
    expect(state.jobBooks.job_5).toBe(2)
  })

  it('白丁不出售，铜钱不足时不扣款', () => {
    const state = createInitialStateV10()
    state.worldCurrency.world_01 = 10

    expect(buyJobBook(state, 'job_1', 'world_01')).toEqual({ ok: false, message: '白丁无需转职书' })
    expect(buyJobBook(state, 'job_37', 'world_01')).toEqual({ ok: false, message: '铜钱不足' })
    expect(state.worldCurrency.world_01).toBe(10)
    expect(state.jobBooks).toEqual({})
  })
})
