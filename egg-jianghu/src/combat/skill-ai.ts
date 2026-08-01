import { selectTargets, type TargetRule } from './targeting'
import type { CombatUnit } from './types'

export type SkillSemantic = 'damage' | 'heal' | 'revive' | 'cleanse' | 'guard' | 'dispel'

export interface CombatSkillDefinition {
  id: string
  energyCost: number
  cooldownMs: number
  semantic: SkillSemantic
  target: TargetRule
  careerIds?: string[]
  requiredMomentum?: Record<string, number>
}

export interface SkippedSkill {
  skillId: string
  reason: string
}

export interface SkillSelection {
  skillId: string
  skipped: SkippedSkill[]
}

const semanticTargets = (
  skill: CombatSkillDefinition,
  allies: CombatUnit[],
  enemies: CombatUnit[],
): CombatUnit[] => {
  if (skill.semantic === 'heal') {
    return selectTargets(allies.filter((unit) => unit.alive && unit.hp < unit.maxHp), skill.target)
  }
  if (skill.semantic === 'revive') {
    return allies.filter((unit) => !unit.alive).sort((left, right) => left.formationOrder - right.formationOrder).slice(0, 1)
  }
  if (skill.semantic === 'cleanse') {
    return selectTargets(allies.filter((unit) => unit.statuses.some((status) => status.category && status.category !== 'buff')), skill.target)
  }
  if (skill.semantic === 'dispel') {
    return selectTargets(enemies.filter((unit) => unit.statuses.some((status) => status.category === 'buff')), skill.target)
  }
  if (skill.semantic === 'guard') return allies.filter((unit) => unit.alive).slice(0, 1)
  return selectTargets(enemies, skill.target)
}

const unavailableReason = (
  actor: CombatUnit,
  skill: CombatSkillDefinition,
  allies: CombatUnit[],
  enemies: CombatUnit[],
): string | null => {
  if (skill.careerIds && (!actor.careerId || !skill.careerIds.includes(actor.careerId))) return '当前职业不符'
  if (actor.energy < skill.energyCost) return '真气不足'
  if ((actor.cooldowns[skill.id] ?? 0) > 0) return '武功尚在回气'
  for (const [id, required] of Object.entries(skill.requiredMomentum ?? {})) {
    if ((actor.momentum[id] ?? 0) < required) return `缺少${id}`
  }
  if (semanticTargets(skill, allies, enemies).length > 0) return null
  if (skill.semantic === 'heal') return '没有受伤目标'
  if (skill.semantic === 'revive') return '没有阵亡目标'
  if (skill.semantic === 'cleanse') return '没有可驱散的负面状态'
  if (skill.semantic === 'dispel') return '敌人没有可驱散的增益'
  return '没有合法目标'
}

export const selectSkill = (
  actor: CombatUnit,
  allies: CombatUnit[],
  enemies: CombatUnit[],
  definitions: Record<string, CombatSkillDefinition>,
): SkillSelection => {
  const skipped: SkippedSkill[] = []
  for (const skillId of actor.skillIds) {
    if (!skillId) continue
    const skill = definitions[skillId]
    if (!skill) {
      skipped.push({ skillId, reason: '武功定义不存在' })
      continue
    }
    const reason = unavailableReason(actor, skill, allies, enemies)
    if (reason) {
      skipped.push({ skillId, reason })
      continue
    }
    return { skillId, skipped }
  }
  return { skillId: actor.baseSkillId, skipped }
}
