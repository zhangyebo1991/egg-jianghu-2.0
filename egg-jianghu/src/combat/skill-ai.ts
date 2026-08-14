import { skillById, type CombatSkillContent } from '../content/skills'
import { SX } from './attribute-ids'
import type { Rng } from './rng'
import { unitAttr } from './statuses'
import { firstEmptySlot, selectTargets, type TargetRule } from './targeting'
import type { CombatUnit } from './types'

export interface SkillSelection {
  skill: CombatSkillContent
}

const shapeOf = (skill: CombatSkillContent): TargetRule['shape'] => {
  if (skill.rangeKind === 'all') return 'all'
  if (skill.rangeKind === 'spread') return 'spread'
  return 'single'
}

export const skillTargetRule = (actor: CombatUnit, skill: CombatSkillContent): TargetRule => ({
  shape: shapeOf(skill),
  reach: skill.reach,
  sourceRow: actor.row,
  count: skill.rangeCount,
})

const livingSummons = (allies: CombatUnit[]): CombatUnit[] =>
  allies.filter((unit) => unit.alive && unit.id.startsWith('summon_'))

const candidatePool = (skill: CombatSkillContent, allies: CombatUnit[], enemies: CombatUnit[]): CombatUnit[] => {
  const pool = skill.targetSide === 'ally' ? allies : enemies
  if (skill.behavior === 'heal') return pool.filter((unit) => unit.alive && unit.hp < unit.maxHp)
  if (skill.behavior === 'revive') return pool.filter((unit) => !unit.alive)
  if (skill.rangeKind === 'self') return pool.filter((unit) => unit.alive)
  return pool.filter((unit) => unit.alive)
}

export const selectSkillTargets = (
  actor: CombatUnit,
  skill: CombatSkillContent,
  allies: CombatUnit[],
  enemies: CombatUnit[],
): CombatUnit[] => {
  if (skill.rangeKind === 'self' || skill.behavior === 'summon') return [actor]
  const pool = candidatePool(skill, allies, enemies)
  if (skill.behavior === 'revive') {
    return pool.sort((left, right) => left.formationOrder - right.formationOrder).slice(0, skill.rangeCount)
  }
  if (skill.behavior === 'heal' && skill.rangeKind === 'single') {
    return [...pool].sort((left, right) =>
      (left.hp / left.maxHp - right.hp / right.maxHp)
      || (left.formationOrder - right.formationOrder),
    ).slice(0, 1)
  }
  return selectTargets(pool, skillTargetRule(actor, skill))
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
  if (skill.behavior === 'summon') {
    if (!firstEmptySlot(allies)) return '没有空余站位'
    const cap = 1 + unitAttr(actor, SX.召唤数量)
    if (livingSummons(allies).length >= cap) return '召唤已满'
    return null
  }
  if (selectSkillTargets(actor, skill, allies, enemies).length > 0) return null
  if (skill.behavior === 'heal') return '没有受伤目标'
  if (skill.behavior === 'revive') return '没有阵亡目标'
  return '没有合法目标'
}

const isPrioritySkill = (skill: CombatSkillContent): boolean =>
  skill.energyCost > 0 || skill.behavior !== 'attack'

/** 四槽：有耗能或非攻击技能时从左到右释放；否则在 0 耗普攻间抽取；再回退职业普攻 */
export const selectSkill = (
  actor: CombatUnit,
  allies: CombatUnit[],
  enemies: CombatUnit[],
  rng?: Rng,
): SkillSelection => {
  const available: CombatSkillContent[] = []
  for (const skillId of actor.skillIds) {
    const skill = skillById(skillId)
    if (!skill) continue
    if (unavailableReason(actor, skill, allies, enemies)) continue
    available.push(skill)
  }
  const prioritized = available.filter(isPrioritySkill)
  if (prioritized.length > 0) return { skill: prioritized[0] }
  const freeAttacks = available.filter((skill) => skill.behavior === 'attack')
  if (freeAttacks.length > 0) {
    const index = rng ? rng.nextInt(0, freeAttacks.length) : 0
    return { skill: freeAttacks[index] }
  }
  const fallback = skillById(actor.baseAttackId)
  if (fallback && !unavailableReason(actor, fallback, allies, enemies)) return { skill: fallback }
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
