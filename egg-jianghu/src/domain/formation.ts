import type { ActionResult, FormationPosition, FormationRow, GameStateV10 } from './types'

export const placeFormation = (
  state: GameStateV10,
  heroId: string,
  row: FormationRow,
  position: FormationPosition,
): ActionResult => {
  if (!state.heroes[heroId]?.recruited) return { ok: false, message: '请先选择已加入的侠客' }
  const current = state.formation.find((slot) => slot.heroId === heroId)
  if (current?.row === row && current?.position === position) return { ok: false, message: '侠客已在该位' }
  const target = state.formation.find((slot) => slot.row === row && slot.position === position)
  const next = state.formation.filter((slot) => slot.heroId !== heroId && !(slot.row === row && slot.position === position))
  if (target && current) next.push({ heroId: target.heroId, row: current.row, position: current.position })
  next.push({ heroId, row, position })
  state.formation = next
  return { ok: true, message: '侠客已入阵' }
}

export const removeFormation = (state: GameStateV10, heroId: string): ActionResult => {
  const before = state.formation.length
  state.formation = state.formation.filter((slot) => slot.heroId !== heroId)
  return state.formation.length < before ? { ok: true, message: '侠客已下阵' } : { ok: false, message: '侠客不在阵中' }
}
