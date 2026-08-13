import { describe, expect, it } from 'vitest'
import { CAREERS, STARTER_CAREER_ID } from '../content/careers'
import { careerCategoryIconAsset, careerIconAsset } from './career-icon-assets'

describe('职业图标资源', () => {
  it('六大脉系类别各有独立图标', () => {
    const icons = ['剑', '刀', '拳', '暗', '医', '内家'].map(careerCategoryIconAsset)
    expect(new Set(icons).size).toBe(6)
    expect(icons.every((icon) => icon.endsWith('.png'))).toBe(true)
  })

  it('全部诸天职业都能解析到图标', () => {
    for (const career of CAREERS) {
      expect(careerIconAsset(career.id).endsWith('.png')).toBe(true)
    }
    expect(careerIconAsset(STARTER_CAREER_ID)).toBe(careerIconAsset('job_1'))
  })
})
