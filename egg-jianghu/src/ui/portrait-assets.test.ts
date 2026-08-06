import { describe, expect, it } from 'vitest'
import { TAVERN_HEROES } from '../content/heroes'
import { enemyPortraitAsset, heroPortraitAsset } from './portrait-assets'

describe('侠客与敌人头像资源', () => {
  it('全部酒馆侠客与主角均有专属头像', () => {
    for (const hero of [...TAVERN_HEROES.map((item) => item.id), 'hero_player']) {
      const portrait = heroPortraitAsset(hero)
      expect(portrait.source).toBe('unique')
      expect(portrait.url.endsWith('.png')).toBe(true)
    }
  })

  it('未知侠客按职业脉系回退到通用头像，六脉各不相同', () => {
    const categories = ['剑', '刀', '拳', '暗', '医', '内家']
    const portraits = categories.map((category) => heroPortraitAsset('hero_unknown', category))
    expect(portraits.every((portrait) => portrait.source === 'generic')).toBe(true)
    expect(new Set(portraits.map((portrait) => portrait.url)).size).toBe(categories.length)
  })

  it('敌人按档次取图，同档不同单位 id 稳定分配且覆盖全部形象', () => {
    const normal = [0, 1, 2, 3, 4, 5].map((index) => enemyPortraitAsset('normal', `unit_${index}`).url)
    expect(new Set(normal).size).toBeGreaterThan(1)
    expect(enemyPortraitAsset('normal', 'unit_0').url).toBe(enemyPortraitAsset('normal', 'unit_0').url)
    expect(enemyPortraitAsset('boss', 'unit_0').url.endsWith('.png')).toBe(true)
    expect(new Set([0, 1, 2, 3].map((index) => enemyPortraitAsset('boss', `unit_${index}`).url)).size).toBe(2)
  })
})
