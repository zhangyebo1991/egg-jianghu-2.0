import { skillById, type CombatSkillContent } from '../content/skills'
import { buffById } from '../content/buffs'
import { skillRangeById } from '../content/skill-ranges'
import { SX } from './attribute-ids'
import { unitAttr } from './statuses'
import {
  firstEmptySlot,
  formationSlot,
  selectAttackPrimary,
  selectFirstFallenPrimary,
  selectHighestAttackPrimary,
  selectLowestHealthPrimary,
  selectSkillRangeTargets,
} from './targeting'
import type { CombatSummon, CombatUnit } from './types'

export interface SkillSelection {
  skill: CombatSkillContent
}

const isSummon = (unit: CombatUnit): unit is CombatSummon => 'summonerId' in unit

const livingSummons = (actor: CombatUnit, allies: CombatUnit[]): CombatSummon[] =>
  allies.filter((unit): unit is CombatSummon =>
    unit.alive && isSummon(unit) && unit.summonerId === actor.id)

const unconditionalLifeHeal = (skill: CombatSkillContent): boolean =>
  skill.originalBehavior === '生命治疗' && (skill.id === 338 || skill.id === 341)

const candidatePool = (skill: CombatSkillContent, allies: CombatUnit[], enemies: CombatUnit[]): CombatUnit[] => {
  const pool = skill.targetSide === 'ally' ? allies : enemies
  if (skill.originalBehavior === '生命治疗' && !unconditionalLifeHeal(skill)) {
    return pool.filter((unit) => unit.alive && unit.hp < unit.maxHp)
  }
  if (skill.behavior === 'revive') return pool.filter((unit) => !unit.alive)
  return pool.filter((unit) => unit.alive)
}

const attackValue = (unit: CombatUnit): number => {
  const baseAttack = skillById(unit.baseAttackId)
  return baseAttack?.route === 'internal' ? unit.internalAttack : unit.externalAttack
}

const primaryTarget = (
  actor: CombatUnit,
  skill: CombatSkillContent,
  pool: CombatUnit[],
): CombatUnit | undefined => {
  if (skill.behavior === 'revive') return selectFirstFallenPrimary(pool)
  if (skill.originalBehavior === '生命治疗') return selectLowestHealthPrimary(pool)
  if (skill.originalBehavior.startsWith('自身') || skill.originalBehavior === '我方状态') return actor
  if (skill.behavior === 'grant-energy' || skill.behavior === 'advance-gauge') {
    return selectHighestAttackPrimary(pool, attackValue)
  }
  if (skill.behavior === 'attack') return selectAttackPrimary(actor, pool)
  return actor
}

export const selectSkillTargets = (
  actor: CombatUnit,
  skill: CombatSkillContent,
  allies: CombatUnit[],
  enemies: CombatUnit[],
): CombatUnit[] => {
  if (skill.behavior === 'summon') return [actor]
  const pool = candidatePool(skill, allies, enemies)
  const primary = primaryTarget(actor, skill, pool)
  if (!primary) return []
  const range = skillRangeById(skill.rangeId)
  if (!range) throw new Error(`缺少技能范围 ${skill.rangeId}`)
  return selectSkillRangeTargets(pool, range, formationSlot(primary))
}

const unavailableReason = (
  actor: CombatUnit,
  skill: CombatSkillContent,
  allies: CombatUnit[],
  enemies: CombatUnit[],
): string | null => {
  if (skill.behavior === 'passive') return '被动技能不可主动释放'
  if (actor.energy < skill.energyCost) return '能量不足'
  if ((actor.cooldowns[skill.id] ?? 0) > 0) return '技能冷却中'
  if (skill.originalBehavior === '自身增加能量' && actor.energy >= 5) return '能量已满'
  if (skill.behavior === 'summon') {
    if (!firstEmptySlot(allies)) return '没有空余站位'
    const cap = 1 + unitAttr(actor, SX.召唤数量)
    if (livingSummons(actor, allies).length >= cap) return '召唤已满'
    return null
  }
  if (skill.originalBehavior === '自身状态' && skill.appliedBuffId) {
    const definition = buffById(skill.appliedBuffId)
    const current = actor.statuses.find((status) => status.buffId === skill.appliedBuffId)
    if (definition && current && current.stacks >= definition.maxStacks && current.remainingMs > 3500) {
      return '状态仍在满层持续'
    }
  }
  if (selectSkillTargets(actor, skill, allies, enemies).length > 0) return null
  if (skill.behavior === 'heal') return '没有受伤目标'
  if (skill.behavior === 'revive') return '没有阵亡目标'
  return '没有合法目标'
}

/** 原版自动战斗：按技能栏从左到右选择首个可用技能；全部不可用时回退职业普攻。 */
export const selectSkill = (
  actor: CombatUnit,
  allies: CombatUnit[],
  enemies: CombatUnit[],
): SkillSelection => {
  for (const skillId of actor.skillIds) {
    const skill = skillById(skillId)
    if (!skill) continue
    if (unavailableReason(actor, skill, allies, enemies)) continue
    return { skill }
  }
  const fallback = skillById(actor.baseAttackId)
  if (fallback) return { skill: fallback }
  const punch = skillById(1)
  if (!punch) throw new Error('缺少普攻技能 1')
  return { skill: punch }
}

export const applyPassiveAttributes = (unit: CombatUnit): void => {
  for (const skillId of unit.skillIds) {
    const skill = skillById(skillId)
    if (skill?.behavior !== 'passive') continue
    for (const modifier of skill.passiveAttributes ?? []) {
      unit.attributes[modifier.sxId] = (unit.attributes[modifier.sxId] ?? 0) + modifier.value
    }
  }
}
