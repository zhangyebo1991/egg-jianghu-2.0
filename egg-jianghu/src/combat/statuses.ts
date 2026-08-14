import { buffById } from '../content/buffs'
import { SX, attr } from './attribute-ids'
import type { CombatStatus, CombatUnit } from './types'

const DOT_TICK_MS = 1000

/**
 * 施加 buff（对齐诸天：同 id 叠层至上限、持续取较大值）。
 * durationScale 由施加方 sx34/35 增益/减益时间换算，1 为不变。
 */
export const applyBuff = (
  target: CombatUnit,
  buffId: number,
  stacks: number,
  sourceId: string,
  options: { durationScale?: number; tickValue?: number } = {},
): CombatStatus | null => {
  const definition = buffById(buffId)
  if (!definition) return null
  const durationMs = Math.max(500, Math.round(definition.durationMs * (options.durationScale ?? 1)))
  const addedStacks = Math.max(1, Math.floor(stacks))
  const current = target.statuses.find((status) => status.buffId === buffId)
  if (current) {
    current.stacks = Math.min(definition.maxStacks, current.stacks + addedStacks)
    current.remainingMs = Math.max(current.remainingMs, durationMs)
    if (definition.unit === 'turn') {
      current.remainingTurns = Math.max(current.remainingTurns ?? 0, Math.max(1, Math.round(definition.durationMs / 1000)))
    }
    if (options.tickValue !== undefined) current.tickValue = Math.max(current.tickValue ?? 0, options.tickValue)
    return current
  }
  const status: CombatStatus = {
    buffId,
    stacks: Math.min(definition.maxStacks, addedStacks),
    remainingMs: definition.unit === 'turn' ? Number.MAX_SAFE_INTEGER : durationMs,
    remainingTurns: definition.unit === 'turn' ? Math.max(1, Math.round(definition.durationMs / 1000)) : undefined,
    sourceId,
    tickValue: options.tickValue,
    nextTickMs: definition.kind === 'dot' || definition.kind === 'hot' ? DOT_TICK_MS : undefined,
  }
  target.statuses.push(status)
  return status
}

/** 聚合单位身上所有 buff 对某属性的修正值（值 × 层数） */
export const buffAttributeBonus = (unit: CombatUnit, sxId: number): number => {
  let total = 0
  for (const status of unit.statuses) {
    const definition = buffById(status.buffId)
    if (!definition) continue
    for (const modifier of definition.attributes) {
      if (modifier.sxId === sxId) total += modifier.value * status.stacks
    }
  }
  return total
}

/** 面板值 + buff 修正后的有效属性 */
export const unitAttr = (unit: CombatUnit, sxId: number): number =>
  attr(unit.attributes, sxId) + buffAttributeBonus(unit, sxId)

/** 控制判定（诸天：眩晕/麻痹/冰冻/静止 = 速度修正 −100，行动条停涨） */
export const isControlled = (unit: CombatUnit): boolean =>
  buffAttributeBonus(unit, SX.速度修正) <= -100

/** 伤害先扣护盾再扣气血 */
export const dealCombatDamage = (unit: CombatUnit, amount: number): { hpLost: number; shieldLost: number } => {
  const incoming = Math.max(0, Math.floor(amount))
  const shieldLost = Math.min(unit.shield, incoming)
  unit.shield -= shieldLost
  const hpLost = Math.min(unit.hp, incoming - shieldLost)
  unit.hp -= hpLost
  unit.alive = unit.hp > 0
  return { hpLost, shieldLost }
}

export interface StatusTick {
  buffId: number
  sourceId: string
  targetId: string
  /** 正数伤害（dot），负数治疗（hot） */
  amount: number
}

export const tickStatuses = (unit: CombatUnit, elapsedMs: number): StatusTick[] => {
  const safeElapsed = Math.max(0, elapsedMs)
  const events: StatusTick[] = []

  for (const status of unit.statuses) {
    const definition = buffById(status.buffId)
    if (!definition || (definition.kind !== 'dot' && definition.kind !== 'hot')) {
      status.remainingMs = Math.max(0, status.remainingMs - safeElapsed)
      continue
    }
    const activeElapsed = Math.min(safeElapsed, status.remainingMs)
    let nextTick = status.nextTickMs ?? DOT_TICK_MS
    while (nextTick <= activeElapsed) {
      const magnitude = Math.max(0, Math.floor((status.tickValue ?? 0) * status.stacks))
      if (magnitude > 0) {
        if (definition.kind === 'dot') {
          const { hpLost, shieldLost } = dealCombatDamage(unit, magnitude)
          if (hpLost + shieldLost > 0) {
            events.push({ buffId: status.buffId, sourceId: status.sourceId ?? unit.id, targetId: unit.id, amount: hpLost + shieldLost })
          }
        } else {
          const healed = Math.min(unit.maxHp - unit.hp, magnitude)
          if (healed > 0) {
            unit.hp += healed
            events.push({ buffId: status.buffId, sourceId: status.sourceId ?? unit.id, targetId: unit.id, amount: -healed })
          }
        }
      }
      nextTick += DOT_TICK_MS
    }
    status.nextTickMs = nextTick - activeElapsed
    status.remainingMs = Math.max(0, status.remainingMs - safeElapsed)
  }

  unit.alive = unit.hp > 0
  unit.statuses = unit.statuses.filter((status) => status.remainingMs > 0 && (status.remainingTurns === undefined || status.remainingTurns > 0))
  return events
}

/** 回合型 buff：单位行动结束后递减 */
export const expireTurnBuffs = (unit: CombatUnit): void => {
  for (const status of unit.statuses) {
    if (status.remainingTurns !== undefined) status.remainingTurns -= 1
  }
  unit.statuses = unit.statuses.filter((status) => status.remainingTurns === undefined || status.remainingTurns > 0)
}
