import { describe, expect, it } from 'vitest'
import { WORLDS } from './worlds'
import { STAGE_ENEMIES } from './enemies'
import { enemyDefinitionById, enemyDisplayName, parseEnemyId } from './enemy-names'

describe('诸天原版怪物表', () => {
  it('13 个位面 × 10 关都有 5 小怪 + 1 首领', () => {
    for (const world of WORLDS) {
      for (let stage = 1; stage <= 10; stage += 1) {
        const group = STAGE_ENEMIES[`${world.id}:${stage}`]
        expect(group, `${world.id} 第 ${stage} 关缺少怪物表`).toBeDefined()
        expect(group!.mobs).toHaveLength(5)
        expect(group!.mobs.every((mob) => mob.name.trim().length > 0)).toBe(true)
        expect(group!.boss.name.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('跨位面首领不重名', () => {
    const seen = new Set<string>()
    for (const world of WORLDS) {
      for (let stage = 1; stage <= 10; stage += 1) {
        const boss = STAGE_ENEMIES[`${world.id}:${stage}`]!.boss.name
        expect(seen.has(boss), `首领重名：${boss}`).toBe(false)
        seen.add(boss)
      }
    }
  })

  it('解析身份 id：mob 与 boss', () => {
    expect(parseEnemyId('world_01_stage_01_mob_3')).toEqual({ worldId: 'world_01', stage: 1, kind: 'mob', mobIndex: 2 })
    expect(parseEnemyId('world_13_stage_10_boss')).toEqual({ worldId: 'world_13', stage: 10, kind: 'boss', mobIndex: -1 })
    expect(parseEnemyId('world_01_stage_01_normal_1')).toBeNull()
    expect(parseEnemyId('broken_enemy_id')).toBeNull()
  })

  it('按身份 id 取原版怪物名', () => {
    expect(enemyDisplayName('world_01_stage_01_mob_1')).toBe('黄巾战士')
    expect(enemyDisplayName('world_01_stage_01_boss')).toBe('张角')
    expect(enemyDisplayName('world_01_stage_02_boss')).toBe('貂蝉')
    expect(enemyDefinitionById('world_01_stage_01_mob_1')?.drId).toBe(1)
  })

  it('坏 id 或超界 id 返回未知目标', () => {
    expect(enemyDisplayName('broken_enemy_id')).toBe('未知目标')
    expect(enemyDisplayName('world_20_stage_05_mob_1')).toBe('未知目标')
    expect(enemyDisplayName('world_01_stage_99_boss')).toBe('未知目标')
  })
})
