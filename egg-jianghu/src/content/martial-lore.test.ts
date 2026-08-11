import { describe, expect, it } from 'vitest'
import { MARTIAL_LORE } from './martial-lore'

describe('MARTIAL_LORE 生成数据', () => {
  it('覆盖全部势力/通用/心法 id', () => {
    const ids = Object.keys(MARTIAL_LORE)
    expect(ids.filter((id) => /_[abcd][12]$/.test(id))).toHaveLength(240)
    expect(ids.filter((id) => id.includes('_common_'))).toHaveLength(60)
    expect(ids.filter((id) => id.includes('_heart_'))).toHaveLength(40)
  })

  it('全真剑法解析为玩家向 lore', () => {
    const lore = MARTIAL_LORE['qingfeng_hall_a1']
    expect(lore).toBeDefined()
    expect(lore.description).toContain('两段连击')
    expect(lore.origin).toBe('《射雕英雄传》')
    expect(lore.stageName).toBe('初传')
    expect(lore.powerNote).toBe('1.15 ×2段(总1.27)')
    expect(lore.tags).toEqual(['单体', '连击'])
  })

  it('铁布衫防御向：无威力、护体与金钟标签', () => {
    const lore = MARTIAL_LORE['world_01_common_inner_01']
    expect(lore.powerNote).toBe('')
    expect(lore.tags).toEqual(['护体', '金钟'])
  })

  it('所有 tag 已去掉【...】状态标与英文目标脚手架', () => {
    for (const lore of Object.values(MARTIAL_LORE)) {
      for (const tag of lore.tags) {
        // 任何【...】方括号状态标（【现有】【扩展】【现有近似】【拟】...）都属脚手架残留
        expect(tag).not.toMatch(/【[^】]*】/)
        // 任何以英文动词（含裸动词与未规范分隔符形态）开头的 tag 都属脚手架残留
        expect(tag).not.toMatch(/^(damage|heal|guard|revive|cleanse|dispel)/)
      }
    }
  })
})
