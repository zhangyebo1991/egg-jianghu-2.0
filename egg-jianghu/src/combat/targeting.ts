import type { Rng } from './rng'
import type { CombatUnit } from './types'

export type TargetShape = 'single' | 'front-row' | 'back-row' | 'row' | 'column' | 'random-multiple' | 'all'
export type TargetReach = 'melee' | 'ranged' | 'bypass-front'

export interface TargetRule {
  shape: TargetShape
  reach: TargetReach
  row?: 'front' | 'back'
  column?: 0 | 1 | 2
  count?: number
}

const stableOrder = (left: CombatUnit, right: CombatUnit): number =>
  (left.row === right.row ? 0 : left.row === 'front' ? -1 : 1)
  || (left.position - right.position)
  || (left.formationOrder - right.formationOrder)

export const selectTargets = (
  candidates: CombatUnit[],
  rule: TargetRule,
  rng?: Rng,
): CombatUnit[] => {
  let eligible = candidates.filter((unit) => unit.alive).sort(stableOrder)
  if (rule.reach === 'melee' && eligible.some((unit) => unit.row === 'front')) {
    eligible = eligible.filter((unit) => unit.row === 'front')
  }

  if (rule.shape === 'front-row') return eligible.filter((unit) => unit.row === 'front')
  if (rule.shape === 'back-row') return eligible.filter((unit) => unit.row === 'back')
  if (rule.shape === 'row') {
    const row = rule.row ?? eligible[0]?.row
    return eligible.filter((unit) => unit.row === row)
  }
  if (rule.shape === 'column') {
    const column = rule.column ?? eligible[0]?.position
    return eligible.filter((unit) => unit.position === column)
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
  return eligible.slice(0, 1)
}
