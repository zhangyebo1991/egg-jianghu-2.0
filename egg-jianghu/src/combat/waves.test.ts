import { describe, expect, it } from 'vitest'
import { enemyDisplayName } from './waves'

describe('敌人显示名称', () => {
  it('将战斗内部 ID 转换为悬榜可读名称', () => {
    expect(enemyDisplayName('world_01_stage_01_normal_1')).toBe('村中泼皮')
    expect(enemyDisplayName('world_03_stage_06_elite_2')).toBe('铁掌帮众')
    expect(enemyDisplayName('world_10_stage_10_boss')).toBe('无崖子')
  })

  it('未开放卷沿用通用占位名', () => {
    expect(enemyDisplayName('world_11_stage_03_boss')).toBe('第3关首领')
  })

  it('不向玩家暴露无法识别的内部 ID', () => {
    expect(enemyDisplayName('broken_enemy_id')).toBe('未知目标')
  })
})
