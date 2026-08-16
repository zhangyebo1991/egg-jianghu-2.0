import { buffById } from '../content/buffs'
import { SX, attr } from './attribute-ids'
import type { CombatStatus, CombatUnit } from './types'

const EXCLUSIVE_STANCE_BUFF_IDS = new Set([40, 41, 49, 50])

/**
 * 施加 buff（对齐诸天：同 id 叠层至上限，并把持续时间刷新为本次施加值）。
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
  if (EXCLUSIVE_STANCE_BUFF_IDS.has(buffId)) {
    target.statuses = target.statuses.filter((status) => status.buffId === buffId || !EXCLUSIVE_STANCE_BUFF_IDS.has(status.buffId))
  }
  const durationMs = definition.unit === 'time'
    ? Math.max(100, Math.round(definition.durationMs / 1000 * (options.durationScale ?? 1) * 10) / 10 * 1000)
    : definition.durationMs
  const addedStacks = Math.max(1, Math.floor(stacks))
  const current = target.statuses.find((status) => status.buffId === buffId)
  if (current) {
    current.stacks = Math.min(definition.maxStacks, current.stacks + addedStacks)
    current.remainingMs = definition.unit === 'turn' ? Number.MAX_SAFE_INTEGER : durationMs
    if (definition.unit === 'turn') {
      current.remainingTurns = Math.max(1, Math.round(definition.durationMs / 1000))
    }
    if (options.tickValue !== undefined) current.tickValue = Math.max(current.tickValue ?? 0, options.tickValue)
    current.sourceId = sourceId
    return current
  }
  const status: CombatStatus = {
    buffId,
    stacks: Math.min(definition.maxStacks, addedStacks),
    remainingMs: definition.unit === 'turn' ? Number.MAX_SAFE_INTEGER : durationMs,
    remainingTurns: definition.unit === 'turn' ? Math.max(1, Math.round(definition.durationMs / 1000)) : undefined,
    sourceId,
    tickValue: options.tickValue,
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
  return { hpLost, shieldLost }
}

export interface StatusTick {
  buffId: number
  sourceId: string
  targetId: string
  /** 正数伤害（dot），负数治疗（hot） */
  amount: number
}

/** 原版先在“冷却及状态时间计算”中扣除 time 型持续时间，并立即清除归零状态。 */
export const advanceStatusDurations = (unit: CombatUnit, elapsedMs: number): void => {
  const safeElapsed = Math.max(0, elapsedMs)
  for (const status of unit.statuses) {
    const definition = buffById(status.buffId)
    if (definition?.unit === 'time') {
      status.remainingMs = Math.max(0, status.remainingMs - safeElapsed)
    }
  }
  unit.statuses = unit.statuses.filter((status) => status.remainingMs > 0 && (status.remainingTurns === undefined || status.remainingTurns > 0))
}

/** 原版 buff伤害计算由战斗级 Every(1) 统一调用；每次脉冲每个状态只结算一次。 */
export const pulseStatuses = (unit: CombatUnit): StatusTick[] => {
  const events: StatusTick[] = []
  for (const status of unit.statuses) {
    const definition = buffById(status.buffId)
    if (!definition?.tickKind) continue
    const magnitude = Math.max(0, Math.floor((status.tickValue ?? 0) * status.stacks))
    if (magnitude <= 0) continue
    if (definition.tickKind === 'dot') {
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
  return events
}

/** 回合型 buff：原版在单位取得行动权、开始本次行动前递减。 */
export const expireTurnBuffs = (unit: CombatUnit): void => {
  for (const status of unit.statuses) {
    if (status.remainingTurns !== undefined) status.remainingTurns -= 1
  }
  unit.statuses = unit.statuses.filter((status) => status.remainingTurns === undefined || status.remainingTurns > 0)
}
