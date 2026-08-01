export interface DamageInput {
  attack: number
  defense: number
  power: number
  additive: number
  critical: number
  momentum: number
  reduction: number
  vulnerability: number
  final: number
}

export const calculateDamage = (input: DamageInput): number => {
  const attack = Math.max(1, input.attack)
  const defense = Math.max(0, input.defense)
  const core = attack * attack / (attack + defense)
  const reduction = Math.min(0.95, Math.max(0, input.reduction))
  return Math.max(1, Math.floor(
    core
    * Math.max(0, input.power)
    * Math.max(0, 1 + input.additive)
    * Math.max(1, input.critical)
    * Math.max(0, 1 + input.momentum)
    * (1 - reduction)
    * Math.max(0, 1 + input.vulnerability)
    * Math.max(0, 1 + input.final),
  ))
}

export const hitChance = (accuracyDelta: number): number =>
  Math.min(1, Math.max(0.3, 0.97 + accuracyDelta))

export const evadeChance = (evade: number): number =>
  Math.min(0.7, Math.max(0, evade))
