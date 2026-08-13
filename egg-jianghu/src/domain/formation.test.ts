import { describe, expect, it } from 'vitest'
import { PLAYER_HERO_ID } from '../content/heroes'
import { createHeroProgress, createNewGameStateV10 } from './state'
import { recruitFromTavern } from './recruitment'
import { placeFormation, removeFormation } from './formation'

const freshState = () => {
  const state = createNewGameStateV10('燕七', 1000)
  recruitFromTavern(state, 'hero_guo_jing')
  recruitFromTavern(state, 'hero_yang_tiexin')
  return state
}

describe('阵容领域逻辑（3 路 × 5 列）', () => {
  it('未招募侠客不能入阵', () => {
    const state = freshState()
    expect(placeFormation(state, 'hero_none', 1, 0)).toEqual({ ok: false, message: '请先选择已加入的侠客' })
    expect(state.formation).toEqual([{ heroId: PLAYER_HERO_ID, row: 1, col: 0 }])
  })

  it('已上阵侠客移动到空格', () => {
    const state = freshState()
    expect(placeFormation(state, PLAYER_HERO_ID, 0, 3)).toEqual({ ok: true, message: '侠客已入阵' })
    expect(state.formation).toEqual([{ heroId: PLAYER_HERO_ID, row: 0, col: 3 }])
  })

  it('未上阵侠客入阵到空格', () => {
    const state = freshState()
    expect(placeFormation(state, 'hero_guo_jing', 2, 4)).toEqual({ ok: true, message: '侠客已入阵' })
    expect(state.formation).toEqual([
      { heroId: PLAYER_HERO_ID, row: 1, col: 0 },
      { heroId: 'hero_guo_jing', row: 2, col: 4 },
    ])
  })

  it('两个已上阵侠客交换位置', () => {
    const state = freshState()
    state.formation.push({ heroId: 'hero_guo_jing', row: 1, col: 1 })
    placeFormation(state, PLAYER_HERO_ID, 1, 1)
    expect(state.formation).toEqual([
      { heroId: 'hero_guo_jing', row: 1, col: 0 },
      { heroId: PLAYER_HERO_ID, row: 1, col: 1 },
    ])
  })

  it('未上阵侠客拖到已占格时顶替原侠客', () => {
    const state = freshState()
    placeFormation(state, 'hero_guo_jing', 1, 0)
    expect(state.formation).toEqual([{ heroId: 'hero_guo_jing', row: 1, col: 0 }])
  })

  it('侠客拖回自己原位不产生变化', () => {
    const state = freshState()
    expect(placeFormation(state, PLAYER_HERO_ID, 1, 0)).toEqual({ ok: false, message: '侠客已在该位' })
    expect(state.formation).toEqual([{ heroId: PLAYER_HERO_ID, row: 1, col: 0 }])
  })

  it('满六人后新侠客不能再入空格，但可顶替在阵者', () => {
    const state = freshState()
    for (const heroId of ['hero_extra_1', 'hero_extra_2', 'hero_extra_3', 'hero_extra_4']) {
      state.heroes[heroId] = createHeroProgress('sword')
    }
    state.formation = [
      { heroId: PLAYER_HERO_ID, row: 1, col: 0 },
      { heroId: 'hero_guo_jing', row: 0, col: 0 },
      { heroId: 'hero_yang_tiexin', row: 2, col: 0 },
      { heroId: 'hero_extra_1', row: 1, col: 1 },
      { heroId: 'hero_extra_2', row: 0, col: 1 },
      { heroId: 'hero_extra_3', row: 2, col: 1 },
    ]

    expect(placeFormation(state, 'hero_extra_4', 1, 2)).toEqual({ ok: false, message: '至多六人成阵 · 请先遣人下阵' })
    expect(state.formation).toHaveLength(6)

    expect(placeFormation(state, 'hero_extra_4', 1, 0)).toEqual({ ok: true, message: '侠客已入阵' })
    expect(state.formation).toHaveLength(6)
    expect(state.formation.some((slot) => slot.heroId === PLAYER_HERO_ID)).toBe(false)
    expect(state.formation).toContainEqual({ heroId: 'hero_extra_4', row: 1, col: 0 })
  })

  it('removeFormation 移除侠客并支持空操作提示', () => {
    const state = freshState()
    expect(removeFormation(state, PLAYER_HERO_ID)).toEqual({ ok: true, message: '侠客已下阵' })
    expect(state.formation).toEqual([])
    expect(removeFormation(state, PLAYER_HERO_ID)).toEqual({ ok: false, message: '侠客不在阵中' })
  })
})
