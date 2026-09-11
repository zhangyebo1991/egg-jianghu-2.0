import type { CampaignMode, GameStateV10 } from './types'

export const VOUCHER_DAILY_LIMIT = 700
export const VOUCHER_BATCH_MS = 6 * 60_000
export const VOUCHER_BATCH_AMOUNT = 10
export const VOUCHER_DAILY_MS = 7 * 3_600_000
const DAY_MS = 86_400_000
const SHANGHAI_OFFSET_MS = 8 * 3_600_000
const POINT_MS = VOUCHER_BATCH_MS / VOUCHER_BATCH_AMOUNT
export const voucherDay = (timestamp: number): number => Math.floor((timestamp + SHANGHAI_OFFSET_MS) / DAY_MS)

export interface IdleVouchers {
  balance: number
  day: number
  elapsedMs: number
  creditedToday: number
  lastSettledAt: number
  activeMode: CampaignMode | null
}

export const createIdleVouchers = (now: number): IdleVouchers => ({
  balance: 0, day: voucherDay(now), elapsedMs: 0, creditedToday: 0,
  lastSettledAt: now, activeMode: null,
})

/** 只结算蛋蛋。自然日按北京时间拆分，在线、后台和离线共用同一游标。 */
export const settleIdleVouchers = (state: GameStateV10, now: number): number => {
  const ledger = state.idleVouchers
  if (!Number.isSafeInteger(now) || now < 0 || now > 8.64e15 || now <= ledger.lastSettledAt) return 0
  let cursor = ledger.lastSettledAt
  let gained = 0
  const active = ledger.activeMode !== null
  while (cursor < now) {
    const boundary = (ledger.day + 1) * DAY_MS - SHANGHAI_OFFSET_MS
    const end = Math.min(now, boundary)
    if (active) ledger.elapsedMs = Math.min(VOUCHER_DAILY_MS, ledger.elapsedMs + end - cursor)
    const due = end === boundary
      ? Math.floor(ledger.elapsedMs / POINT_MS)
      : Math.floor(ledger.elapsedMs / VOUCHER_BATCH_MS) * VOUCHER_BATCH_AMOUNT
    gained += due - ledger.creditedToday
    ledger.creditedToday = due
    cursor = end
    if (end === boundary) {
      ledger.day += 1
      ledger.elapsedMs = 0
      ledger.creditedToday = 0
      // 中间完整自然日直接结算，长期离线无需逐帧或逐日重放战斗。
      const fullDays = Math.floor((now - cursor) / DAY_MS)
      gained += active ? fullDays * VOUCHER_DAILY_LIMIT : 0
      ledger.day += fullDays
      cursor += fullDays * DAY_MS
    }
  }
  ledger.lastSettledAt = now
  ledger.balance += gained
  return gained
}

export const setVoucherActivity = (state: GameStateV10, mode: CampaignMode | null, now: number): number => {
  const gained = settleIdleVouchers(state, now)
  state.idleVouchers.activeMode = mode
  return gained
}

export const isIdleVouchers = (raw: unknown): raw is IdleVouchers => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false
  const value = raw as Record<string, unknown>
  const integer = (n: unknown, max: number): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max
  return integer(value.balance, Number.MAX_SAFE_INTEGER - 100_000_000_000)
    && integer(value.lastSettledAt, 8.64e15)
    && value.day === voucherDay(value.lastSettledAt)
    && integer(value.elapsedMs, VOUCHER_DAILY_MS)
    && value.creditedToday === Math.floor(value.elapsedMs / VOUCHER_BATCH_MS) * VOUCHER_BATCH_AMOUNT
    && (value.activeMode === null || value.activeMode === 'guard' || value.activeMode === 'roam')
}
