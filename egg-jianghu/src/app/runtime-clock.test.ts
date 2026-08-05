import { describe, expect, it } from 'vitest'
import { RuntimeClock } from './runtime-clock'

describe('RuntimeClock', () => {
  it('按真实经过时间计算后台节流期间应补的帧数', () => {
    const clock = new RuntimeClock(100, 1_000)

    expect(clock.consume(61_000, 1_000)).toEqual({
      tickCount: 600,
      elapsedMs: 60_000,
      hasBacklog: false,
    })
  })

  it('限制单次补帧量并在后续 pulse 继续消化积压', () => {
    const clock = new RuntimeClock(100, 0)

    expect(clock.consume(180_000, 600)).toEqual({
      tickCount: 600,
      elapsedMs: 60_000,
      hasBacklog: true,
    })
    expect(clock.consume(180_000, 600)).toEqual({
      tickCount: 600,
      elapsedMs: 60_000,
      hasBacklog: true,
    })
    expect(clock.consume(180_000, 600)).toEqual({
      tickCount: 600,
      elapsedMs: 60_000,
      hasBacklog: false,
    })
  })

  it('保留不足一帧的时间并允许重置会话时钟', () => {
    const clock = new RuntimeClock(100, 0)

    expect(clock.consume(90, 600).tickCount).toBe(0)
    expect(clock.consume(110, 600)).toMatchObject({ tickCount: 1, elapsedMs: 100 })

    clock.reset(10_000)
    expect(clock.consume(10_099, 600).tickCount).toBe(0)
    expect(clock.consume(10_100, 600).tickCount).toBe(1)
  })
})
