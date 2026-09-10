import { SX } from './attribute-ids'
import { unitAttr } from './statuses'
import type { CombatUnit } from './types'

export const COMBAT_TICK_MS = 100

export const actionIntervalMs = (agility: number): number =>
  50_000 / Math.sqrt(Math.max(0, agility))

/** 有效速度 = 面板速度 × (1 + 速度修正%/100)；控制类 buff 把速度修正压到 −100 即停条 */
export const effectiveSpeed = (unit: CombatUnit): number => {
  const modifier = unitAttr(unit, SX.速度修正)
  return unit.effectiveAgility * Math.max(0, 1 + modifier / 100)
}

export const advanceGaugeAndCooldowns = (unit: CombatUnit, elapsedMs = COMBAT_TICK_MS): void => {
  const safeElapsed = Math.max(0, elapsedMs)
  const speed = effectiveSpeed(unit)
  if (speed > 0) {
    // 原版dt秒×sqrt(有效速度)×2，行动条100对应本作1000；不先取整行动间隔。
    unit.gauge += safeElapsed * Math.sqrt(speed) / 50
  }
  for (const id of Object.keys(unit.cooldowns)) {
    const key = Number(id)
    unit.cooldowns[key] = Math.max(0, unit.cooldowns[key] - safeElapsed)
  }
}
