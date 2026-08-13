import { describe, expect, it } from 'vitest'
import { createInitialStateV10 } from '../domain/state'
import { CAREERS } from './careers'
import { ENEMY_NAMES_BY_WORLD } from './enemy-names'
import { FACTIONS } from './factions'
import { HEROES_V10 } from './heroes'
import { FACTION_MARTIALS } from './martials'
import { validateContent } from './validate'
import { WORLDS } from './worlds'

describe('首发内容目录', () => {
  it('最终内容满足首发规模且不含明确排除资源', () => {
    expect(WORLDS).toHaveLength(13)
    expect(FACTIONS).toHaveLength(30)
    expect(FACTION_MARTIALS).toHaveLength(240)
    expect(CAREERS).toHaveLength(41)
    expect(JSON.stringify(createInitialStateV10())).not.toMatch(/pages|秘籍残页|offline|combat/)
  })

  it('所有内容 id 和交叉引用唯一有效', () => {
    expect(validateContent()).toEqual([])
  })

  it('包含诸天 1 初级、5 一阶、10 二阶、10 三阶、10 四阶和 5 五阶职业', () => {
    expect(CAREERS.filter((career) => career.tier === '初级')).toHaveLength(1)
    expect(CAREERS.filter((career) => career.tier === '一阶')).toHaveLength(5)
    expect(CAREERS.filter((career) => career.tier === '二阶')).toHaveLength(10)
    expect(CAREERS.filter((career) => career.tier === '三阶')).toHaveLength(10)
    expect(CAREERS.filter((career) => career.tier === '四阶')).toHaveLength(10)
    expect(CAREERS.filter((career) => career.tier === '五阶')).toHaveLength(5)
  })

  it('13 个位面全部作为内容开放，势力仍挂在前十个 id 上', () => {
    expect(WORLDS).toHaveLength(13)
    expect(WORLDS.every((world) => world.released && world.stageIds.length === 10)).toBe(true)
    expect(WORLDS[0]).toMatchObject({ id: 'world_01', name: '东汉三国' })
    expect(WORLDS[1]).toMatchObject({ id: 'world_02', name: '武侠江湖' })
    expect(WORLDS[12]).toMatchObject({ id: 'world_13', name: '西行之路' })
    expect(WORLDS.slice(0, 10).every((world) => world.factionIds.length === 3)).toBe(true)
    expect(WORLDS.slice(10).every((world) => world.factionIds.length === 0)).toBe(true)
    for (const category of ['剑', '刀', '拳', '暗', '医', '内家']) {
      expect(FACTIONS.filter((faction) => faction.category === category)).toHaveLength(5)
    }
    expect(validateContent()).toEqual([])
  })

  it('13 位面使用诸天地名与十个战斗地点', () => {
    expect(WORLDS[0].stageNames).toEqual([
      '黄巾起义', '联军讨董', '濮阳之战', '新野之战', '会师江夏',
      '刮骨疗毒', '败走麦城', '夷陵之战', '濡须口战', '六出祁山',
    ])
    expect(WORLDS[0].stageIds).toHaveLength(10)
    expect(WORLDS[9].factionIds).toHaveLength(3)
    expect(WORLDS[12].stageNames[9]).toBe('小雷音寺')
  })

  it('酒馆侠客仍按前十个位面 id 各 3 名，后三面暂无酒馆', () => {
    expect(HEROES_V10).toHaveLength(121)
    const tavernByWorld = new Map<string, number>()
    const factionHeroCounts = new Map<string, number>()
    for (const hero of HEROES_V10) {
      if (hero.source === 'tavern') tavernByWorld.set(hero.worldId, (tavernByWorld.get(hero.worldId) ?? 0) + 1)
      if (hero.source === 'faction') factionHeroCounts.set(hero.factionId ?? '', (factionHeroCounts.get(hero.factionId ?? '') ?? 0) + 1)
    }
    for (const world of WORLDS.slice(0, 10)) expect(tavernByWorld.get(world.id)).toBe(3)
    for (const world of WORLDS.slice(10)) expect(tavernByWorld.get(world.id) ?? 0).toBe(0)
    for (const faction of FACTIONS) expect(factionHeroCounts.get(faction.id)).toBe(3)
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

  it('前十个位面具备完整敌人命名表且 Boss 不重名', () => {
    for (const world of WORLDS.slice(0, 10)) {
      const names = ENEMY_NAMES_BY_WORLD[world.id]
      expect(names).toBeDefined()
      expect(names!.bosses).toHaveLength(10)
      expect(names!.normal.length).toBeGreaterThanOrEqual(6)
      expect(names!.elite.length).toBeGreaterThanOrEqual(3)
    }
    expect(validateContent()).toEqual([])
  })
})
