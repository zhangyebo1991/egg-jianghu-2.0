import { describe, expect, it } from 'vitest'
import { addCareerExperience, changeCareer, perfectCareer } from './careers'
import { createHeroProgress } from './state'

describe('职业修习', () => {
  it('职业等级不修改侠客等级且只有当前职业获得经验', () => {
    const hero = createHeroProgress('sword')

    addCareerExperience(hero, 1900)

    expect(hero.level).toBe(1)
    expect(hero.careers.sword.level).toBeGreaterThan(1)
    expect(Object.keys(hero.careers)).toEqual(['sword'])
  })

  it('Lv.10 可转职，Lv.20 可领取一次圆满心得', () => {
    const hero = createHeroProgress('sword')
    hero.careers.sword.level = 10
    const tokens = ['token_sword_swift_mid']

    expect(changeCareer(hero, 'sword_swift_mid', tokens).ok).toBe(true)
    expect(tokens).toEqual([])
    expect(hero.careers.sword_swift_mid.level).toBe(1)

    hero.currentCareerId = 'sword'
    hero.careers.sword.level = 20
    expect(perfectCareer(hero, 'sword').ok).toBe(true)
    expect(perfectCareer(hero, 'sword').ok).toBe(false)
  })

  it('切回已解锁职业时保留原等级且不重复消耗信物', () => {
    const hero = createHeroProgress('sword')
    hero.careers.sword.level = 10
    const tokens = ['token_sword_swift_mid']
    changeCareer(hero, 'sword_swift_mid', tokens)
    hero.careers.sword_swift_mid.level = 7

    expect(changeCareer(hero, 'sword', tokens).ok).toBe(true)
    expect(changeCareer(hero, 'sword_swift_mid', tokens).ok).toBe(true)
    expect(hero.careers.sword_swift_mid.level).toBe(7)
    expect(tokens).toEqual([])
  })
})
