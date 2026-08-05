export interface RuntimePulse {
  tickCount: number
  elapsedMs: number
  hasBacklog: boolean
}

export class RuntimeClock {
  private readonly tickMs: number
  private lastNowMs: number
  private pendingMs = 0

  constructor(tickMs: number, nowMs: number) {
    if (!Number.isFinite(tickMs) || tickMs <= 0) throw new Error('tickMs 必须为正数')
    this.tickMs = tickMs
    this.lastNowMs = nowMs
  }

  reset(nowMs: number): void {
    this.lastNowMs = nowMs
    this.pendingMs = 0
  }

  consume(nowMs: number, maxTicks: number): RuntimePulse {
    const safeNowMs = Number.isFinite(nowMs) ? nowMs : this.lastNowMs
    const elapsedSinceLastPulse = Math.max(0, safeNowMs - this.lastNowMs)
    this.lastNowMs = safeNowMs
    this.pendingMs += elapsedSinceLastPulse

    const availableTicks = Math.floor(this.pendingMs / this.tickMs)
    const safeMaxTicks = Math.max(0, Math.floor(maxTicks))
    const tickCount = Math.min(availableTicks, safeMaxTicks)
    const elapsedMs = tickCount * this.tickMs
    this.pendingMs -= elapsedMs

    return {
      tickCount,
      elapsedMs,
      hasBacklog: this.pendingMs >= this.tickMs,
    }
  }
}
