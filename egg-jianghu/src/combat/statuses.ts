import { buffById } from '../content/buffs'
import { ATTRIBUTE_BY_ID } from '../content/attributes'
import { SX, attr } from './attribute-ids'
import type { CombatStatus, CombatUnit } from './types'

const ORIGINAL_STATUS_SLOT_COUNT = 202

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
  // 原版布局全局实例zdls宽203，槽0保留。为尚未分配槽位的初始状态按顺序分配。
  const occupied = new Set(target.statuses.flatMap(status => status.slot === undefined ? [] : [status.slot]))
  let nextSlot = 1
  for (const status of target.statuses) {
    if (status.slot !== undefined) continue
    while (occupied.has(nextSlot)) nextSlot++
    status.slot = nextSlot
    occupied.add(nextSlot)
  }
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
    // 原版叠层分支只更新3/4/5/65与6的伤害快照；47保留首次施加快照。
    if (options.tickValue !== undefined && buffId !== 47) current.tickValue = Math.max(current.tickValue ?? 0, options.tickValue)
    current.sourceId = sourceId
    return current
  }
  const usedSlots = new Set(target.statuses.map(status => status.slot))
  let slot = 1
  while (usedSlots.has(slot)) slot++
  if (slot > ORIGINAL_STATUS_SLOT_COUNT) return null
  const status: CombatStatus = {
    slot,
    buffId,
    stacks: Math.min(definition.maxStacks, addedStacks),
    remainingMs: definition.unit === 'turn' ? Number.MAX_SAFE_INTEGER : durationMs,
    remainingTurns: definition.unit === 'turn' ? Math.max(1, Math.round(definition.durationMs / 1000)) : undefined,
    sourceId,
    tickValue: options.tickValue,
  }
  target.statuses.push(status)
  target.statuses.sort((left, right) => left.slot! - right.slot!)
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
export const unitAttr = (unit: CombatUnit, sxId: number): number => {
  const value = attr(unit.attributes, sxId) + buffAttributeBonus(unit, sxId)
  const limit = ATTRIBUTE_BY_ID[sxId]?.capMin ?? 0 // 原始sx[8]战斗限制值。
  if (unit.side !== 'party' || 'summonerId' in unit || limit <= 0) return value
  const negativeLimit = sxId === 118 || sxId === 119 || sxId === 120 || (sxId >= 123 && sxId <= 130)
  return negativeLimit ? Math.max(-limit, value) : Math.min(limit, value)
}

/** 控制判定（诸天：眩晕/麻痹/冰冻/静止 = 速度修正 −100，行动条停涨） */
export const isControlled = (unit: CombatUnit): boolean =>
  buffAttributeBonus(unit, SX.速度修正) <= -100

/** 伤害先扣护盾再扣气血 */
export const dealCombatDamage = (unit: CombatUnit, amount: number): { hpLost: number; shieldLost: number; settledAmount: number } => {
  const incoming = Math.max(0, Math.floor(amount))
  const settledAmount = unit.shield >= incoming ? incoming : Math.ceil(Math.max(1, incoming - unit.shield))
  const shieldLost = Math.min(unit.shield, incoming)
  unit.shield -= shieldLost
  const previousHp = unit.hp
  if (shieldLost < incoming) unit.hp = Math.max(0, Math.round(unit.hp - settledAmount))
  return { hpLost: previousHp - unit.hp, shieldLost, settledAmount }
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
    // 所有已接纳的时间型状态都倒计时，槽位仅决定存储和结算顺序。
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
