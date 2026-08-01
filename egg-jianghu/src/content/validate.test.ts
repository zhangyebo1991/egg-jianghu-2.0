import { describe, expect, it } from 'vitest'
import { CAREERS } from './careers'
import { FACTIONS } from './factions'
import { FACTION_MARTIALS } from './martials'
import { validateContent } from './validate'
import { WORLDS } from './worlds'

describe('首发内容目录', () => {
  it('包含 6 初级、12 中级、12 高级和 12 顶级职业', () => {
    expect(CAREERS.filter((career) => career.tier === '初级')).toHaveLength(6)
    expect(CAREERS.filter((career) => career.tier === '中级')).toHaveLength(12)
    expect(CAREERS.filter((career) => career.tier === '高级')).toHaveLength(12)
    expect(CAREERS.filter((career) => career.tier === '顶级')).toHaveLength(12)
  })

  it('10 卷各 3 势力且六大类各出现 5 次', () => {
    expect(WORLDS).toHaveLength(10)
    expect(WORLDS.every((world) => world.factionIds.length === 3)).toBe(true)
    for (const category of ['剑', '刀', '拳', '暗', '医', '内家']) {
      expect(FACTIONS.filter((faction) => faction.category === category)).toHaveLength(5)
    }
    expect(validateContent()).toEqual([])
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
})
