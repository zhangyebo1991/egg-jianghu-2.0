import { SX } from './attribute-ids'
import { buffAttributeBonus } from './statuses'
import type { CombatUnit } from './types'

export const COMBAT_TICK_MS = 100

export const actionIntervalMs = (agility: number): number =>
  Math.round(50_000 / Math.sqrt(Math.max(1, agility)))

/** 有效速度 = 面板速度 × (1 + 速度修正%/100)；控制类 buff 把速度修正压到 −100 即停条 */
export const effectiveSpeed = (unit: CombatUnit): number => {
  const modifier = buffAttributeBonus(unit, SX.速度修正)
  return unit.effectiveAgility * Math.max(0, 1 + modifier / 100)
}

export const advanceGaugeAndCooldowns = (unit: CombatUnit, elapsedMs = COMBAT_TICK_MS): void => {
  const safeElapsed = Math.max(0, elapsedMs)
  const speed = effectiveSpeed(unit)
  if (speed > 0) {
    unit.gauge += safeElapsed / actionIntervalMs(speed) * 1000
  }
  for (const id of Object.keys(unit.cooldowns)) {
    const key = Number(id)
    unit.cooldowns[key] = Math.max(0, unit.cooldowns[key] - safeElapsed)
  }
}
