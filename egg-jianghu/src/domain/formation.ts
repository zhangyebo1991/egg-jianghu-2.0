import type { ActionResult, FormationColumn, FormationRow, GameStateV10 } from './types'

/** 阵位网格：3 路 × 5 列，参照《诸天刷宝录》 */
export const FORMATION_ROW_COUNT = 3
export const FORMATION_COL_COUNT = 5
/** 上阵人数上限：15 格中至多 6 人 */
export const FORMATION_CAPACITY = 6

export const FORMATION_ROWS: readonly FormationRow[] = [0, 1, 2]
export const FORMATION_COLS: readonly FormationColumn[] = [0, 1, 2, 3, 4]

export const placeFormation = (
  state: GameStateV10,
  heroId: string,
  row: FormationRow,
  col: FormationColumn,
): ActionResult => {
  if (!state.heroes[heroId]?.recruited) return { ok: false, message: '请先选择已加入的侠客' }
  const current = state.formation.find((slot) => slot.heroId === heroId)
  if (current?.row === row && current?.col === col) return { ok: false, message: '侠客已在该位' }
  const target = state.formation.find((slot) => slot.row === row && slot.col === col)
  if (!current && !target && state.formation.length >= FORMATION_CAPACITY) {
    return { ok: false, message: '至多六人成阵 · 请先遣人下阵' }
  }
  const next = state.formation.filter((slot) => slot.heroId !== heroId && !(slot.row === row && slot.col === col))
  if (target && current) next.push({ heroId: target.heroId, row: current.row, col: current.col })
  next.push({ heroId, row, col })
  state.formation = next
  return { ok: true, message: '侠客已入阵' }
}

export const removeFormation = (state: GameStateV10, heroId: string): ActionResult => {
  const before = state.formation.length
  state.formation = state.formation.filter((slot) => slot.heroId !== heroId)
  return state.formation.length < before ? { ok: true, message: '侠客已下阵' } : { ok: false, message: '侠客不在阵中' }
}
