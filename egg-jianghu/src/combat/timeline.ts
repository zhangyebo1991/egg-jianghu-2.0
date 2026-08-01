import type { CombatUnit } from './types'

export const COMBAT_TICK_MS = 100

export const actionIntervalMs = (agility: number): number =>
  Math.round(50_000 / Math.sqrt(Math.max(1, agility)))

export const advanceUnitTime = (unit: CombatUnit, elapsedMs = COMBAT_TICK_MS): void => {
  const safeElapsed = Math.max(0, elapsedMs)
  unit.gauge += safeElapsed / actionIntervalMs(unit.effectiveAgility) * 1000
  for (const id of Object.keys(unit.cooldowns)) {
    unit.cooldowns[id] = Math.max(0, unit.cooldowns[id] - safeElapsed)
  }
  for (const status of unit.statuses) {
    status.remainingMs = Math.max(0, status.remainingMs - safeElapsed)
    if (status.nextTickMs !== undefined) status.nextTickMs = Math.max(0, status.nextTickMs - safeElapsed)
  }
  unit.statuses = unit.statuses.filter((status) => status.remainingMs > 0)
}

export const readyOrder = (units: CombatUnit[]): CombatUnit[] => units
  .filter((unit) => unit.alive && unit.gauge >= 1000)
  .sort((left, right) =>
    (right.gauge - left.gauge)
    || (right.effectiveAgility - left.effectiveAgility)
    || (left.formationOrder - right.formationOrder),
  )

export const advanceCombatTime = (units: CombatUnit[], tickCount = 1): CombatUnit[] => {
  const count = Math.max(0, Math.floor(tickCount))
  for (let tick = 0; tick < count; tick += 1) {
    for (const unit of units) {
      if (unit.alive) advanceUnitTime(unit, COMBAT_TICK_MS)
    }
  }
  return readyOrder(units)
}
