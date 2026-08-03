import { describe, expect, it } from 'vitest'
import { createInitialStateV10 } from '../domain/state'
import { CAREERS } from './careers'
import { ENEMY_NAMES_BY_WORLD } from './enemy-names'
import { FACTIONS } from './factions'
import { FACTION_MARTIALS } from './martials'
import { validateContent } from './validate'
import { WORLDS } from './worlds'

describe('首发内容目录', () => {
  it('最终内容满足首发规模且不含明确排除资源', () => {
    expect(WORLDS).toHaveLength(30)
    expect(FACTIONS).toHaveLength(30)
    expect(FACTION_MARTIALS).toHaveLength(240)
    expect(CAREERS).toHaveLength(42)
    expect(JSON.stringify(createInitialStateV10())).not.toMatch(/pages|秘籍残页|offline|combat/)
  })

  it('所有内容 id 和交叉引用唯一有效', () => {
    expect(validateContent()).toEqual([])
  })

  it('包含 6 初级、12 中级、12 高级和 12 顶级职业', () => {
    expect(CAREERS.filter((career) => career.tier === '初级')).toHaveLength(6)
    expect(CAREERS.filter((career) => career.tier === '中级')).toHaveLength(12)
    expect(CAREERS.filter((career) => career.tier === '高级')).toHaveLength(12)
    expect(CAREERS.filter((career) => career.tier === '顶级')).toHaveLength(12)
  })

  it('已开放 10 卷各 3 势力且未开放卷无势力', () => {
    const released = WORLDS.filter((world) => world.released)
    const unreleased = WORLDS.filter((world) => !world.released)
    expect(WORLDS).toHaveLength(30)
    expect(released).toHaveLength(10)
    expect(unreleased).toHaveLength(20)
    expect(released.every((world) => world.factionIds.length === 3)).toBe(true)
    expect(unreleased.every((world) => world.factionIds.length === 0)).toBe(true)
    for (const category of ['剑', '刀', '拳', '暗', '医', '内家']) {
      expect(FACTIONS.filter((faction) => faction.category === category)).toHaveLength(5)
    }
    expect(validateContent()).toEqual([])
  })

  it('30 卷名称使用金庸地名且前 10 卷开放', () => {
    expect(WORLDS[0]).toMatchObject({ id: 'world_01', name: '牛家村', released: true })
    expect(WORLDS[9]).toMatchObject({ id: 'world_10', name: '擂鼓山', released: true })
    expect(WORLDS[10]).toMatchObject({ id: 'world_11', name: '恒山', released: false })
    expect(WORLDS[29]).toMatchObject({ id: 'world_30', name: '侠客岛', released: false })
    expect(WORLDS[0].stageIds).toHaveLength(10)
    expect(WORLDS[9].factionIds).toHaveLength(3)
    expect(WORLDS[10].stageIds).toEqual([])
    expect(WORLDS[10].factionIds).toEqual([])
  })

  it('每个势力恰好提供两线各四门主动武功', () => {
    expect(FACTION_MARTIALS).toHaveLength(240)
    for (const faction of FACTIONS) {
      const ids = FACTION_MARTIALS.filter((martial) => martial.factionId === faction.id).map((martial) => martial.id)
      expect(ids).toEqual([
        `${faction.id}_a1`, `${faction.id}_b1`, `${faction.id}_c1`, `${faction.id}_d1`,
        `${faction.id}_a2`, `${faction.id}_b2`, `${faction.id}_c2`, `${faction.id}_d2`,
      ])
    }
  })

  it('每个已开放卷具备完整敌人命名表且 Boss 不重名', () => {
    for (const world of WORLDS) {
      if (!world.released) continue
      const names = ENEMY_NAMES_BY_WORLD[world.id]
      expect(names).toBeDefined()
      expect(names!.bosses).toHaveLength(10)
      expect(names!.normal.length).toBeGreaterThanOrEqual(6)
      expect(names!.elite.length).toBeGreaterThanOrEqual(3)
    }
    expect(validateContent()).toEqual([])
  })
})
