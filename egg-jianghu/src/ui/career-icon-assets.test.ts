import { expect, it } from 'vitest'
import { CAREERS } from '../content/careers'
import { careerCategoryIconAsset, careerIconAsset } from './career-icon-assets'
import evidence from '../../../docs/evidence/original-world/career-icons-assets.json'

const images = import.meta.glob<string>('../assets/careers/original/career_*.webp', { eager: true, import: 'default' })

it('六大脉系类别保留各自独立图标', () => {
  const icons = ['剑', '刀', '拳', '暗', '医', '内家'].map(careerCategoryIconAsset)
  expect(new Set(icons).size).toBe(6)
  expect(icons.every(icon => icon.endsWith('.png'))).toBe(true)
})

it('全部41个职业映射各自原版图标，无缺失或重复类别占位图', () => {
  expect(CAREERS).toHaveLength(41)
  expect(Object.keys(images)).toHaveLength(41)
  expect(new Set(evidence.entries.map(entry => entry.sha256)).size).toBe(41)
  for (const career of CAREERS) {
    const entry = evidence.entries.find(entry => entry.id === career.zyId)
    expect(entry?.name).toBe(career.name)
    expect(careerIconAsset(career.id)).toBe(images[`../assets/careers/original/career_${career.zyId}.webp`])
  }
  expect(careerIconAsset('missing')).toBe(careerIconAsset('job_1'))
})
