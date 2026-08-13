import { describe, expect, it } from 'vitest'
import { EQUIPMENT_DEFINITIONS, EQUIPMENT_SLOTS } from './equipment'
import { EQUIPMENT_NAMES_BY_WORLD, equipmentName } from './equipment-names'
import { WORLDS } from './worlds'

describe('装备命名表', () => {
  it('前 10 个位面各有 8 个槽位装备名且非空', () => {
    for (const world of WORLDS.slice(0, 10)) {
      const names = EQUIPMENT_NAMES_BY_WORLD[world.id]
      expect(names, `${world.id} 缺少命名表`).toBeDefined()
      for (const slot of EQUIPMENT_SLOTS) {
        expect(names![slot]?.trim().length, `${world.id} ${slot} 名为空`).toBeGreaterThan(0)
      }
    }
  })

  it('跨大关、跨槽位 80 个装备名全局不重名', () => {
    const seen = new Set<string>()
    for (const world of WORLDS.slice(0, 10)) {
      for (const slot of EQUIPMENT_SLOTS) {
        const name = EQUIPMENT_NAMES_BY_WORLD[world.id][slot]
        expect(seen.has(name), `装备名重复：${name}`).toBe(false)
        seen.add(name)
      }
    }
    expect(seen.size).toBe(80)
  })

  it('装备名按 (worldId, slot) 取值', () => {
    expect(equipmentName('world_01', 'weapon')).toBe('柴刀')
    expect(equipmentName('world_10', 'ring')).toBe('棋局玉戒')
  })

  it('缺表世界返回 undefined 由调用方兜底', () => {
    expect(equipmentName('world_11', 'weapon')).toBeUndefined()
    expect(equipmentName('broken', 'weapon')).toBeUndefined()
  })

  it('EQUIPMENT_DEFINITIONS 前 10 卷装备名与命名表一致且无占位名残留', () => {
    for (const definition of EQUIPMENT_DEFINITIONS) {
      expect(definition.name, `${definition.id} 名字未接命名表`).toBe(equipmentName(definition.worldId, definition.slot))
      expect(definition.name).not.toMatch(/^第\d+卷/)
    }
  })
})
