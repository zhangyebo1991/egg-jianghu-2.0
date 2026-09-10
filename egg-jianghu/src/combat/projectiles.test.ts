import { describe, expect, it } from 'vitest'
import { projectileFlightMs } from './projectiles'
import type { CombatUnit } from './types'

describe('原版弹体几何', () => {
  it('全部阵位组合双向对称，并在1200ms行动结束之前碰撞', () => {
    const grid = (side: CombatUnit['side']) => Array.from({ length: 15 }, (_, slot) => ({
      side, row: Math.floor(slot / 5) as CombatUnit['row'], col: slot % 5 as CombatUnit['col'],
    }))
    const times: number[] = []
    for (const party of grid('party')) for (const enemy of grid('enemy')) {
      const flightMs = projectileFlightMs(party, enemy)
      expect(projectileFlightMs(enemy, party)).toBeCloseTo(flightMs, 10)
      expect(flightMs + 300).toBeLessThan(1200)
      times.push(flightMs)
    }
    // 最前排同排中心距离280；最远后排同排中心距离1800，均扣除125碰撞半径。
    expect(Math.min(...times)).toBe(77.5)
    expect(Math.max(...times)).toBe(837.5)
  })
})
