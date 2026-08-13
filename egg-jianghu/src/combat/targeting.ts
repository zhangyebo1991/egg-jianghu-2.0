import type { Rng } from './rng'
import type { FormationColumn, FormationRow } from '../domain/types'
import type { CombatUnit } from './types'

export type TargetShape = 'single' | 'front-row' | 'back-row' | 'row' | 'column' | 'random-multiple' | 'all'
/** 近战/远程只影响演出，不再限制可选目标（与诸天原版一致） */
export type TargetReach = 'melee' | 'ranged'

export interface TargetRule {
  shape: TargetShape
  reach: TargetReach
  /** 出手者所在路：single 索敌按「同路最前 → 它路最前」 */
  sourceRow?: FormationRow
  row?: FormationRow
  column?: FormationColumn
  count?: number
}

// 稳定序：前列（col 小）优先，同列上路先，再按入阵次序
const stableOrder = (left: CombatUnit, right: CombatUnit): number =>
  (left.col - right.col)
  || (left.row - right.row)
  || (left.formationOrder - right.formationOrder)

// 诸天索敌：优先同路最前排目标；同路没有目标后，攻击它路最前排目标（路距近者先）
const primaryTarget = (eligible: CombatUnit[], sourceRow?: FormationRow): CombatUnit | undefined => {
  if (sourceRow !== undefined) {
    const sameLane = eligible.filter((unit) => unit.row === sourceRow)
    if (sameLane.length) return [...sameLane].sort(stableOrder)[0]
    return [...eligible].sort((left, right) =>
      (left.col - right.col)
      || (Math.abs(left.row - sourceRow) - Math.abs(right.row - sourceRow))
      || (left.formationOrder - right.formationOrder))[0]
  }
  return [...eligible].sort(stableOrder)[0]
}

// 各路最前（edge = front）或最后（edge = back）的存活单位，至多 3 个
const laneEdges = (eligible: CombatUnit[], edge: 'front' | 'back'): CombatUnit[] => {
  const byLane = new Map<FormationRow, CombatUnit>()
  for (const unit of eligible) {
    const held = byLane.get(unit.row)
    if (!held || (edge === 'front' ? unit.col < held.col : unit.col > held.col)) byLane.set(unit.row, unit)
  }
  return [...byLane.values()].sort(stableOrder)
}

export const selectTargets = (
  candidates: CombatUnit[],
  rule: TargetRule,
  rng?: Rng,
): CombatUnit[] => {
  const eligible = candidates.filter((unit) => unit.alive).sort(stableOrder)
  if (!eligible.length) return []

  if (rule.shape === 'front-row') return laneEdges(eligible, 'front')
  if (rule.shape === 'back-row') return laneEdges(eligible, 'back')
  if (rule.shape === 'row') {
    const row = rule.row ?? primaryTarget(eligible, rule.sourceRow)?.row
    return eligible.filter((unit) => unit.row === row)
  }
  if (rule.shape === 'column') {
    const column = rule.column ?? primaryTarget(eligible, rule.sourceRow)?.col
    return eligible.filter((unit) => unit.col === column)
  }
  if (rule.shape === 'all') return eligible
  if (rule.shape === 'random-multiple') {
    const pool = [...eligible]
    const selected: CombatUnit[] = []
    const count = Math.min(pool.length, Math.max(1, Math.floor(rule.count ?? 2)))
    while (selected.length < count) {
      const index = rng ? rng.nextInt(0, pool.length) : 0
      selected.push(pool.splice(index, 1)[0])
    }
    return selected
  }
  const primary = primaryTarget(eligible, rule.sourceRow)
  return primary ? [primary] : []
}
