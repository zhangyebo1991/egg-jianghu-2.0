import type { SkillRangeContent } from '../content/skill-ranges'
import type { FormationColumn, FormationRow } from '../domain/types'
import type { CombatUnit } from './types'

const ATTACK_TARGET_PRIORITIES: Readonly<Record<FormationRow, readonly number[]>> = {
  0: [11, 12, 13, 14, 15, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5],
  1: [11, 12, 13, 14, 15, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  2: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
}

/** 原版“召唤空地阵位号”的固定扫描顺序。 */
export const SUMMON_EMPTY_SLOT_PRIORITY = [1, 11, 6, 2, 12, 7, 3, 13, 8, 4, 14, 9, 5, 15, 10] as const

/** 战场单边 3×5 阵中的本地阵位号（1..15）。 */
export const formationSlot = (unit: Pick<CombatUnit, 'row' | 'col'>): number => unit.row * 5 + unit.col + 1

const slotCoordinates = (slot: number): { row: FormationRow; col: FormationColumn } => ({
  row: Math.floor((slot - 1) / 5) as FormationRow,
  col: ((slot - 1) % 5) as FormationColumn,
})

const byFormationSlot = (left: CombatUnit, right: CombatUnit): number =>
  (formationSlot(left) - formationSlot(right))
  || (left.formationOrder - right.formationOrder)
  || left.id.localeCompare(right.id)

export const attackTargetPriority = (sourceRow: FormationRow): readonly number[] => ATTACK_TARGET_PRIORITIES[sourceRow]

/** 原版攻击主目标：按发起排的固定阵位序扫描；我方在小兵仍存活时不会以首领为核心目标。 */
export const selectAttackPrimary = (actor: CombatUnit, candidates: CombatUnit[]): CombatUnit | undefined => {
  const living = candidates.filter((unit) => unit.alive)
  const eligible = actor.side === 'party' && living.some((unit) => unit.rank !== 'boss')
    ? living.filter((unit) => unit.rank !== 'boss')
    : living
  for (const slot of attackTargetPriority(actor.row)) {
    const target = eligible.filter((unit) => formationSlot(unit) === slot).sort(byFormationSlot)[0]
    if (target) return target
  }
  return undefined
}

/** 原版治疗主目标：生命比例最低者优先，同值按阵位号稳定选择。 */
export const selectLowestHealthPrimary = (candidates: CombatUnit[]): CombatUnit | undefined =>
  candidates
    .filter((unit) => unit.alive)
    .sort((left, right) =>
      (left.hp / left.maxHp - right.hp / right.maxHp)
      || byFormationSlot(left, right))[0]

/** 原版加能量/推进度主目标：排除召唤物后按“攻击”降序，同值按阵位号稳定选择。 */
export const selectHighestAttackPrimary = (
  candidates: CombatUnit[],
  attackValue: (unit: CombatUnit) => number,
): CombatUnit | undefined => candidates
  .filter((unit) => unit.alive && !unit.id.startsWith('summon_'))
  .sort((left, right) =>
    (attackValue(right) - attackValue(left))
    || byFormationSlot(left, right))[0]

/** 原版复活目标：阵位号最小的阵亡单位。 */
export const selectFirstFallenPrimary = (candidates: CombatUnit[]): CombatUnit | undefined =>
  candidates.filter((unit) => !unit.alive).sort(byFormationSlot)[0]

/**
 * 原版范围查询：fw[尝试阵位 + 15 × (范围类型 - 1), 核心阵位]。
 * 生成数据已按范围类型切成 matrix[尝试阵位 - 1][核心阵位 - 1]。
 */
export const selectSkillRangeTargets = (
  candidates: CombatUnit[],
  range: SkillRangeContent,
  coreSlot: number,
): CombatUnit[] => {
  if (coreSlot < 1 || coreSlot > 15) return []
  return [...candidates]
    .filter((unit) => {
      const attemptSlot = formationSlot(unit)
      return range.matrix[attemptSlot - 1]?.[coreSlot - 1] === 1
        || (range.targetMode === '目标' && attemptSlot === coreSlot)
    })
    .sort(byFormationSlot)
}

/** 原版固定优先序中的第一个空阵位；满员返回 null。 */
export const firstEmptySlot = (units: CombatUnit[]): { row: FormationRow; col: FormationColumn } | null => {
  const occupied = new Set(units.filter((unit) => unit.alive).map(formationSlot))
  const slot = SUMMON_EMPTY_SLOT_PRIORITY.find((candidate) => !occupied.has(candidate))
  return slot === undefined ? null : slotCoordinates(slot)
}
