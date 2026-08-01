import type { Rng } from './rng'
import type { CombatStatus, CombatUnit } from './types'

const cloneStatus = (status: CombatStatus): CombatStatus => ({ ...status })

export const applyStatus = (unit: CombatUnit, incoming: CombatStatus): void => {
  if (incoming.mode === 'independent') {
    unit.statuses.push(cloneStatus(incoming))
    return
  }

  const current = unit.statuses.find((status) => status.id === incoming.id)
  if (!current) {
    unit.statuses.push(cloneStatus(incoming))
    return
  }

  if (incoming.mode === 'refresh') {
    Object.assign(current, cloneStatus(incoming))
    return
  }

  if (incoming.mode === 'strongest') {
    current.remainingMs = Math.max(current.remainingMs, incoming.remainingMs)
    current.value = Math.max(current.value, incoming.value)
    current.stacks = Math.max(current.stacks, incoming.stacks)
    return
  }

  current.stacks += incoming.stacks
  current.value = Math.max(current.value, incoming.value)
  current.remainingMs = Math.max(current.remainingMs, incoming.remainingMs)
}

export interface StatusTick {
  statusId: string
  sourceId: string
  targetId: string
  amount: number
}

export const tickStatuses = (unit: CombatUnit, elapsedMs: number, rng: Rng): StatusTick[] => {
  void rng
  const safeElapsed = Math.max(0, elapsedMs)
  const events: StatusTick[] = []

  for (const status of unit.statuses) {
    const activeElapsed = Math.min(safeElapsed, status.remainingMs)
    const interval = status.tickIntervalMs
    if (interval && interval > 0) {
      let nextTick = status.nextTickMs ?? interval
      while (nextTick <= activeElapsed) {
        const amount = Math.max(0, Math.floor(status.value * status.stacks))
        unit.hp = Math.max(0, unit.hp - amount)
        events.push({
          statusId: status.id,
          sourceId: status.sourceId ?? unit.id,
          targetId: unit.id,
          amount,
        })
        nextTick += interval
      }
      status.nextTickMs = nextTick - activeElapsed
    }
    status.remainingMs = Math.max(0, status.remainingMs - safeElapsed)
  }

  unit.alive = unit.hp > 0
  unit.statuses = unit.statuses.filter((status) => status.remainingMs > 0)
  return events
}

export const resolveControlDuration = (
  baseDurationMs: number,
  controlResistance: number,
  repeatedControlCount: number,
): number => {
  const resisted = Math.max(0.05, 1 - Math.max(0, Math.min(0.95, controlResistance)))
  const diminishing = Math.pow(0.75, Math.max(0, Math.floor(repeatedControlCount)))
  return Math.max(100, Math.floor(Math.max(0, baseDurationMs) * resisted * diminishing))
}
