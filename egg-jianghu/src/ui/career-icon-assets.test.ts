import { describe, expect, it } from 'vitest'
import { CAREERS } from '../content/careers'
import { CITY_HEART_METHODS, CITY_MARTIALS, FACTION_HEART_METHODS, FACTION_MARTIALS } from '../content/martials'
import { careerCategoryIconAsset, careerIconAsset, heartMethodIconAsset, martialIconAsset } from './career-icon-assets'

describe('职业与武功图标资源', () => {
  it('六大脉系类别各有独立图标', () => {
    const icons = ['剑', '刀', '拳', '暗', '医', '内家'].map(careerCategoryIconAsset)
    expect(new Set(icons).size).toBe(6)
    expect(icons.every((icon) => icon.endsWith('.png'))).toBe(true)
  })

  it('初级职业用类别图标，分支职业用分支图标', () => {
    expect(careerIconAsset('sword')).toBe(careerCategoryIconAsset('剑'))
    expect(careerIconAsset('blade')).toBe(careerCategoryIconAsset('刀'))
    const swift = careerIconAsset('sword_swift_mid')
    expect(swift).toBe(careerIconAsset('sword_swift_top'))
    expect(swift).not.toBe(careerIconAsset('sword'))
    expect(swift).not.toBe(careerIconAsset('sword_heavy_mid'))
  })

  it('全部职业都能解析到图标', () => {
    for (const career of CAREERS) {
      expect(careerIconAsset(career.id).endsWith('.png')).toBe(true)
    }
  })

  it('城市武功按类别取图，势力武功同分支同图、跨分支异图', () => {
    const citySword = CITY_MARTIALS.find((martial) => martial.category === '剑')
    expect(citySword).toBeDefined()
    expect(martialIconAsset(citySword!.id)).toBe(careerCategoryIconAsset('剑'))

    const qingfeng = FACTION_MARTIALS.filter((martial) => martial.factionId === 'qingfeng_hall')
    const swift = qingfeng.filter((martial) => martial.branchIndex === 1)
    const heavy = qingfeng.filter((martial) => martial.branchIndex === 2)
    expect(swift.length).toBe(4)
    expect(heavy.length).toBe(4)
    expect(new Set(swift.map((martial) => martialIconAsset(martial.id))).size).toBe(1)
    expect(new Set(heavy.map((martial) => martialIconAsset(martial.id))).size).toBe(1)
    expect(martialIconAsset(swift[0].id)).not.toBe(martialIconAsset(heavy[0].id))
    expect(martialIconAsset(swift[0].id)).toBe(careerIconAsset('sword_swift_mid'))
  })

  it('势力心法按脉系取图，城市通用心法归内家', () => {
    const factionHeart = FACTION_HEART_METHODS.find((method) => method.factionId === 'qingfeng_hall')
    expect(factionHeart).toBeDefined()
    expect(heartMethodIconAsset(factionHeart!.id)).toBe(careerCategoryIconAsset('剑'))
    expect(heartMethodIconAsset(CITY_HEART_METHODS[0].id)).toBe(careerCategoryIconAsset('内家'))
    expect(heartMethodIconAsset('unknown_heart')).toBe(careerCategoryIconAsset('内家'))
  })
})
