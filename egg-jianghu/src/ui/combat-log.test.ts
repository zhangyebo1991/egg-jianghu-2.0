import { describe, expect, it } from 'vitest'
import { skillById } from '../content/skills'
import { formatCombatResult } from './combat-log'

const names = (id: string) => id === 'hero' ? '少侠' : '随军校尉'
const base = { atMs: 300, sourceId: 'hero', targetId: 'enemy' }

describe('战斗札记结果', () => {
  it('伤口包扎在满血时也记录零治疗量', () => {
    expect(formatCombatResult({ ...base, type: 'healing', skillId: 44, amount: 0 }, names))
      .toBe('少侠使用「伤口包扎」，为随军校尉恢复 0 点气血。')
  })
  it('显示技能、具体目标、结算伤害和暴击', () => {
    expect(formatCombatResult({ ...base, type: 'damage', skillId: 1, amount: 12345, critical: true }, names))
      .toBe(`少侠使用「${skillById(1)!.name}」，对随军校尉造成 12,345 点伤害（暴击）。`)
  })
  it('持续伤害不冒用之前的技能名称，闪避单独说明', () => {
    expect(formatCombatResult({ ...base, type: 'damage', amount: 32, critical: false }, names))
      .toBe('少侠，对随军校尉造成 32 点持续伤害。')
    expect(formatCombatResult({ ...base, type: 'attack-missed', skillId: 1 }, names))
      .toBe(`少侠使用「${skillById(1)!.name}」，被随军校尉闪避。`)
  })
  it('治疗带技能来源，自然恢复省略重复人名并消除浮点尾数', () => {
    expect(formatCombatResult({ ...base, type: 'healing', skillId: 1, amount: 185.21000000000004 }, names))
      .toBe(`少侠使用「${skillById(1)!.name}」，为随军校尉恢复 185 点气血。`)
    expect(formatCombatResult({ ...base, targetId: 'hero', type: 'healing', amount: 185.21000000000004 }, names))
      .toBe('少侠恢复 185 点气血。')
  })
})
