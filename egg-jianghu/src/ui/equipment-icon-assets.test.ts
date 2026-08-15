import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_DEFINITIONS,
  EQUIPMENT_SLOTS,
} from '../content/equipment'
import { equipmentIconAsset } from './equipment-icon-assets'

describe('装备图标资源', () => {
  it('普通装备使用从原版提取的专属图标', () => {
    const icon = equipmentIconAsset('weapon', 'wp_101')

    expect(icon.source).toBe('unique')
    expect(icon.url).toContain('zt_eq_101')
    expect(icon.url).toContain('.webp')
  })

  it('共用同一原版动画的普通装备和套装装备复用同一 URL', () => {
    expect(equipmentIconAsset('necklace', 'wp_123')).toEqual(equipmentIconAsset('necklace', 'wp_394'))
  })

  it('446 件装备全部映射到 186 个原版图标', () => {
    const definitions = EQUIPMENT_DEFINITIONS.filter((definition) =>
      definition.setName || (definition.equipmentKind === 'standard' && definition.rarity === '普通'))
    const icons = definitions.map((definition) => equipmentIconAsset(definition.slot, definition.id))

    expect(definitions).toHaveLength(446)
    expect(new Set(definitions.map((definition) => definition.iconKey)).size).toBe(186)
    expect(icons.every((icon) => icon.source === 'unique')).toBe(true)
  })

  it('八个战斗部位有独立通用图标，至宝暂复用戒指回退图标', () => {
    const icons = EQUIPMENT_SLOTS.map((slot) => equipmentIconAsset(slot, `unknown_${slot}`))

    expect(new Set(icons.map((icon) => icon.url)).size).toBe(EQUIPMENT_SLOTS.length - 1)
    expect(equipmentIconAsset('treasure').url).toBe(equipmentIconAsset('ring').url)
    expect(icons.every((icon) => icon.source === 'slot')).toBe(true)
    expect(icons.every((icon) => icon.url.endsWith('.png'))).toBe(true)
  })
})
