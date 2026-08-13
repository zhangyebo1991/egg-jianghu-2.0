import { describe, expect, it } from 'vitest'
import {
  FACTION_HEROES,
  HEROES_V10,
  PLAYER_HERO_ID,
  PLAYER_HERO_V10,
  TAVERN_HEROES,
} from '../content/heroes'
import { createInitialStateV10, createNewGameStateV10, normalizePlayerName } from './state'

describe('新建玩家角色', () => {
  it('规范化玩家姓名并拒绝空白或超过八个字符的姓名', () => {
    expect(normalizePlayerName('  江湖少侠  ')).toBe('江湖少侠')
    expect(() => normalizePlayerName('   ')).toThrow('请输入玩家姓名')
    expect(() => normalizePlayerName('一二三四五六七八九')).toThrow('玩家姓名最多 8 个字符')
    expect(normalizePlayerName('😀😀😀😀😀😀😀😀')).toBe('😀😀😀😀😀😀😀😀')
    expect(() => normalizePlayerName('😀😀😀😀😀😀😀😀😀')).toThrow('玩家姓名最多 8 个字符')
  })

  it('使用规范化姓名创建已入队的基础玩家角色', () => {
    const state = createNewGameStateV10('  江湖少侠  ', 12_345)

    expect(state).toEqual({
      ...createInitialStateV10(12_345),
      heroes: {
        [PLAYER_HERO_ID]: {
          recruited: true,
          level: 1,
          experience: 0,
          careers: { job_1: { level: 1, experience: 0 } },
          currentCareerId: 'job_1',
          learnedMartials: {},
          equippedMartialIds: [null, null, null, null],
          heartMethodId: null,
          equipmentSets: [{}, {}, {}],
          activeEquipmentSetIndex: 0,
          equipmentBySlot: {},
          customName: '江湖少侠',
        },
      },
      formation: [{ heroId: PLAYER_HERO_ID, row: 1, col: 0 }],
    })
  })

  it('定义丙品剑客作为基础玩家角色', () => {
    expect(PLAYER_HERO_V10).toEqual({
      id: 'hero_player',
      name: '无名少侠',
      grade: '丙',
      baseCareerId: 'job_1',
      worldId: 'world_01',
      source: 'starter',
      cost: 0,
      factionId: null,
      aptitudes: { strength: 10, insight: 10, constitution: 10, agility: 10, resolve: 10 },
    })
    expect(HEROES_V10[0]).toBe(PLAYER_HERO_V10)
    expect(HEROES_V10).toEqual([PLAYER_HERO_V10, ...TAVERN_HEROES, ...FACTION_HEROES])
    expect(TAVERN_HEROES.map((hero) => hero.id)).not.toContain(PLAYER_HERO_ID)
    expect(FACTION_HEROES.map((hero) => hero.id)).not.toContain(PLAYER_HERO_ID)
  })
})
