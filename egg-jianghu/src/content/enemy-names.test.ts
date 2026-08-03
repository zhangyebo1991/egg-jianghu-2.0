import { describe, expect, it } from 'vitest'
import { WORLDS } from './worlds'
import { ENEMY_NAMES_BY_WORLD, enemyDisplayName, enemyName } from './enemy-names'

describe('敌人命名表', () => {
  it('已开放 10 卷各有 10 个 Boss、普通名 ≥6、精英名 ≥3', () => {
    for (const world of WORLDS) {
      if (!world.released) continue
      const names = ENEMY_NAMES_BY_WORLD[world.id]
      expect(names, `${world.id} 缺少命名表`).toBeDefined()
      expect(names!.bosses).toHaveLength(10)
      expect(names!.normal.length).toBeGreaterThanOrEqual(6)
      expect(names!.elite.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('跨大关 Boss 不重名', () => {
    const seen = new Set<string>()
    for (const world of WORLDS) {
      if (!world.released) continue
      for (const boss of ENEMY_NAMES_BY_WORLD[world.id].bosses) {
        expect(seen.has(boss)).toBe(false)
        seen.add(boss)
      }
    }
  })

  it('Boss 名随小关号取值', () => {
    expect(enemyName('world_01', 'boss', 1, 1)).toBe('段天德')
    expect(enemyName('world_10', 'boss', 10, 1)).toBe('无崖子')
    expect(enemyDisplayName('world_10_stage_10_boss')).toBe('无崖子')
  })

  it('普通名在名池内循环且同波次 5 个不重名', () => {
    const names = Array.from({ length: 5 }, (_, i) => enemyName('world_03', 'normal', 3, i + 1))
    expect(new Set(names).size).toBe(5)
  })

  it('未开放卷沿用通用占位名，坏 ID 返回未知目标', () => {
    expect(enemyDisplayName('world_11_stage_03_boss')).toBe('第3关首领')
    expect(enemyDisplayName('world_20_stage_05_elite_1')).toBe('第5关精英')
    expect(enemyDisplayName('broken_enemy_id')).toBe('未知目标')
  })
})
