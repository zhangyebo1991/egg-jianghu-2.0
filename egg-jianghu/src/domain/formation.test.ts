import { describe, expect, it } from 'vitest'
import { PLAYER_HERO_ID } from '../content/heroes'
import { createNewGameStateV10 } from './state'
import { recruitFromTavern } from './recruitment'
import { placeFormation, removeFormation } from './formation'

const freshState = () => {
  const state = createNewGameStateV10('燕七', 1000)
  recruitFromTavern(state, 'hero_shen_yanqiu')
  recruitFromTavern(state, 'hero_huo_chuan')
  return state
}

describe('阵容领域逻辑', () => {
  it('未招募侠客不能入阵', () => {
    const state = freshState()
    expect(placeFormation(state, 'hero_none', 'front', 0)).toEqual({ ok: false, message: '请先选择已加入的侠客' })
    expect(state.formation).toEqual([{ heroId: PLAYER_HERO_ID, row: 'front', position: 0 }])
  })

  it('已上阵侠客移动到空格', () => {
    const state = freshState()
    placeFormation(state, PLAYER_HERO_ID, 'back', 1)
    expect(state.formation).toEqual([{ heroId: PLAYER_HERO_ID, row: 'back', position: 1 }])
  })

  it('两个已上阵侠客交换位置', () => {
    const state = freshState()
    state.formation.push({ heroId: 'hero_shen_yanqiu', row: 'front', position: 1 })
    placeFormation(state, PLAYER_HERO_ID, 'front', 1)
    expect(state.formation).toEqual([
      { heroId: 'hero_shen_yanqiu', row: 'front', position: 0 },
      { heroId: PLAYER_HERO_ID, row: 'front', position: 1 },
    ])
  })

  it('未上阵侠客拖到已占格时顶替原侠客', () => {
    const state = freshState()
    placeFormation(state, 'hero_shen_yanqiu', 'front', 0)
    expect(state.formation).toEqual([{ heroId: 'hero_shen_yanqiu', row: 'front', position: 0 }])
  })

  it('侠客拖回自己原位不产生变化', () => {
    const state = freshState()
    expect(placeFormation(state, PLAYER_HERO_ID, 'front', 0)).toEqual({ ok: false, message: '侠客已在该位' })
    expect(state.formation).toEqual([{ heroId: PLAYER_HERO_ID, row: 'front', position: 0 }])
  })

  it('removeFormation 移除侠客并支持空操作提示', () => {
    const state = freshState()
    expect(removeFormation(state, PLAYER_HERO_ID)).toEqual({ ok: true, message: '侠客已下阵' })
    expect(state.formation).toEqual([])
    expect(removeFormation(state, PLAYER_HERO_ID)).toEqual({ ok: false, message: '侠客不在阵中' })
  })
})
