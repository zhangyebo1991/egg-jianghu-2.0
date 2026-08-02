import { describe, expect, it } from 'vitest'
import { createNewGameStateV10 } from '../domain/state'
import { PLAYER_HERO_V10, TAVERN_HEROES, heroDisplayNameV10 } from './heroes'

describe('heroDisplayNameV10', () => {
  it('优先显示玩家进度中的自定义姓名', () => {
    const progress = createNewGameStateV10('燕七', 1000).heroes[PLAYER_HERO_V10.id]

    expect(heroDisplayNameV10(PLAYER_HERO_V10, progress)).toBe('燕七')
  })

  it('普通酒馆侠客没有自定义姓名时显示内容定义名', () => {
    expect(heroDisplayNameV10(TAVERN_HEROES[0])).toBe(TAVERN_HEROES[0].name)
  })

  it('空白自定义姓名回退到内容定义名', () => {
    const progress = createNewGameStateV10('燕七', 1000).heroes[PLAYER_HERO_V10.id]
    progress.customName = '  '

    expect(heroDisplayNameV10(PLAYER_HERO_V10, progress)).toBe(PLAYER_HERO_V10.name)
  })

  it('非字符串自定义姓名不会抛错并回退到内容定义名', () => {
    const progress = createNewGameStateV10('燕七', 1000).heroes[PLAYER_HERO_V10.id]
    ;(progress as unknown as { customName: unknown }).customName = 42

    expect(heroDisplayNameV10(PLAYER_HERO_V10, progress)).toBe(PLAYER_HERO_V10.name)
  })
})
