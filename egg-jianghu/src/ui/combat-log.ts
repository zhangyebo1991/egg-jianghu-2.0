import type { CombatEvent } from '../combat/types'
import { skillById } from '../content/skills'

type ResultEvent = Extract<CombatEvent, { type: 'damage' | 'attack-missed' | 'healing' }>

export const formatCombatResult = (event: ResultEvent, unitName: (id: string) => string): string => {
  const source = unitName(event.sourceId)
  const target = unitName(event.targetId)
  const skill = event.skillId === undefined ? undefined : skillById(event.skillId)
  const action = skill ? `${source}使用「${skill.name}」` : source
  if (event.type === 'attack-missed') return `${action}，被${target}闪避。`
  const amount = Math.round(event.amount).toLocaleString('zh-CN')
  if (event.type === 'damage') {
    return `${action}，对${target}造成 ${amount} 点${event.skillId === undefined ? '持续' : ''}伤害${event.critical ? '（暴击）' : ''}。`
  }
  if (!skill && event.sourceId === event.targetId) return `${source}恢复 ${amount} 点气血。`
  return `${action}，为${target}恢复 ${amount} 点气血。`
}
