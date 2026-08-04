import { describe, expect, it } from 'vitest'
import { EQUIPMENT_SLOTS } from '../content/equipment'
import { equipmentIconAsset } from './equipment-icon-assets'

describe('装备图标资源', () => {
  it('七个部位各有独立通用图标，未知专属图标时按部位回退', () => {
    const icons = EQUIPMENT_SLOTS.map((slot) => equipmentIconAsset(slot, `unknown_${slot}`))

    expect(new Set(icons.map((icon) => icon.url)).size).toBe(EQUIPMENT_SLOTS.length)
    expect(icons.every((icon) => icon.source === 'slot')).toBe(true)
    expect(icons.every((icon) => icon.url.endsWith('.png'))).toBe(true)
  })
})
