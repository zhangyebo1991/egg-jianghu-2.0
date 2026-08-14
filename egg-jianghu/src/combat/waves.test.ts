import { describe, expect, it } from 'vitest'
import { STAGE_ENEMIES } from '../content/enemies'
import { createWave, enemyDisplayName } from './waves'

describe('敌人显示名称', () => {
  it('将战斗内部 ID 转换为悬榜可读名称', () => {
    expect(enemyDisplayName('world_01_stage_01_mob_1')).toBe('黄巾战士')
    expect(enemyDisplayName('world_01_stage_01_boss')).toBe('张角')
  })

  it('不向玩家暴露无法识别的内部 ID', () => {
    expect(enemyDisplayName('broken_enemy_id')).toBe('未知目标')
    expect(enemyDisplayName('world_01_stage_01_normal_1')).toBe('未知目标')
  })
})

describe('查表出怪', () => {
  const group = STAGE_ENEMIES['world_01:1']!
  const mobNames = group.mobs.map((mob) => mob.name)

  it('普通波敌人全部来自本关小怪名单且同波不重复', () => {
    for (const wave of [1, 2, 4, 5, 7, 8]) {
      const { enemies } = createWave('world_01', 1, wave, 42)
      expect(enemies.length).toBeGreaterThanOrEqual(2)
      for (const enemy of enemies) {
        expect(enemy.rank).not.toBe('boss')
        expect(mobNames).toContain(enemy.name)
      }
      expect(new Set(enemies.map((enemy) => enemy.id)).size).toBe(enemies.length)
    }
  })

  it('3/6/9 波末位是精英且精英沿用小怪名与 mob id', () => {
    for (const wave of [3, 6, 9]) {
      const { enemies } = createWave('world_01', 1, wave, 42)
      const elite = enemies[enemies.length - 1]
      expect(elite.rank).toBe('elite')
      expect(mobNames).toContain(elite.name)
      expect(elite.id).toMatch(/_mob_[1-5]$/)
    }
  })

  it('第 10 波是本关首领带两只小怪', () => {
    const { enemies } = createWave('world_01', 1, 10, 42)
    expect(enemies.map((enemy) => enemy.rank)).toEqual(['boss', 'elite', 'normal'])
    expect(enemies[0].name).toBe('张角')
    expect(enemies[0].id).toBe('world_01_stage_01_boss')
    expect(enemies[0].skillIds).toEqual([32, 74, 10, 47])
    expect(enemies[0].baseAttackId).toBe(4)
    expect(enemies[0].maxEnergy).toBe(5)
    expect(mobNames).toContain(enemies[1].name)
    expect(mobNames).toContain(enemies[2].name)
  })

  it('六维成长系数造成同关怪物数值差异', () => {
    const { enemies } = createWave('world_01', 1, 10, 42)
    const byName = new Map(enemies.map((enemy) => [enemy.name, enemy]))
    // 波内两只小怪工种不同 → growth 不同 → 面板必然有差异
    const [first, second] = [enemies[1], enemies[2]]
    expect(
      first.externalAttack !== second.externalAttack
      || first.internalAttack !== second.internalAttack
      || first.externalDefense !== second.externalDefense,
    ).toBe(true)
    expect(byName.size).toBe(enemies.length)
  })

  it('缺少怪物表的位面直接抛错', () => {
    expect(() => createWave('world_99', 1, 1, 42)).toThrow('缺少怪物表')
  })
})
