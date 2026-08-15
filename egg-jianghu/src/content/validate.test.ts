import { describe, expect, it } from 'vitest'
import { createInitialStateV10 } from '../domain/state'
import { CAREERS } from './careers'
import { STAGE_ENEMIES } from './enemies'
import { FACTIONS } from './factions'
import { HEROES_V10 } from './heroes'
import { FACTION_MARTIALS } from './martials'
import { validateContent } from './validate'
import { WORLDS } from './worlds'

describe('首发内容目录', () => {
  it('最终内容满足首发规模且不含明确排除资源', () => {
    expect(WORLDS).toHaveLength(13)
    expect(FACTIONS).toHaveLength(42)
    expect(FACTION_MARTIALS).toHaveLength(252)
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

  it('13 个位面全部开放并挂载原版 42 个势力', () => {
    expect(WORLDS).toHaveLength(13)
    expect(WORLDS.every((world) => world.released && world.stageIds.length === 10)).toBe(true)
    expect(WORLDS[0]).toMatchObject({ id: 'world_01', name: '东汉三国' })
    expect(WORLDS[1]).toMatchObject({ id: 'world_02', name: '武侠江湖' })
    expect(WORLDS[12]).toMatchObject({ id: 'world_13', name: '西行之路' })
    expect(WORLDS.slice(0, 3).every((world) => world.factionIds.length === 4)).toBe(true)
    expect(WORLDS.slice(3).every((world) => world.factionIds.length === 3)).toBe(true)
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
    expect([...factionHeroCounts.values()].every((count) => count === 3)).toBe(true)
    expect(factionHeroCounts.size).toBe(30)
    expect(FACTIONS.filter((faction) => !factionHeroCounts.has(faction.id))).toHaveLength(12)
    expect(validateContent()).toEqual([])
  })

  it('每个势力恰好提供两线各三门原版技能', () => {
    expect(FACTION_MARTIALS).toHaveLength(252)
    for (const faction of FACTIONS) {
      const martials = FACTION_MARTIALS.filter((martial) => martial.factionId === faction.id)
      const ordered = [...martials].sort(
        (a, b) => a.stage - b.stage || a.branchIndex - b.branchIndex,
      )
      expect(ordered.map((martial) => martial.originalSkillId)).toEqual(faction.skillIds)
      expect(martials.filter((martial) => martial.branchIndex === 1).map((martial) => martial.stage).sort()).toEqual([1, 2, 3])
      expect(martials.filter((martial) => martial.branchIndex === 2).map((martial) => martial.stage).sort()).toEqual([1, 2, 3])
    }
  })

  it('全部位面具备完整原版怪物表且校验通过', () => {
    for (const world of WORLDS) {
      for (let stage = 1; stage <= 10; stage += 1) {
        expect(STAGE_ENEMIES[`${world.id}:${stage}`], `${world.id} 第 ${stage} 关缺少怪物表`).toBeDefined()
      }
    }
    expect(validateContent()).toEqual([])
  })
})
