import { martialByIdV10 } from '../content/martials'
import { factionById } from '../content/factions'
import { careerById } from '../content/careers'
import type { CampaignMode } from '../domain/types'
import { calculateDamage, hitChance, rollCritical } from './damage'
import { SX, attr, ELEMENT_IDS } from './attribute-ids'
import { createRng, type Rng } from './rng'
import { selectSkill, type CombatSkillDefinition } from './skill-ai'
import { applyStatus, tickStatuses } from './statuses'
import { selectTargets } from './targeting'
import { advanceGaugeAndCooldowns, COMBAT_TICK_MS, readyOrder } from './timeline'
import type {
  CombatEvent,
  CombatSnapshot,
  CombatStartInput,
  CombatUnit,
} from './types'
import { advanceToNextWave, createWave, isWaveCleared } from './waves'

export interface CombatEngine {
  readonly state: CombatSnapshot
  tick(count?: number): CombatEvent[]
  setMode(mode: CampaignMode): void
  stop(): CombatEvent[]
}

const ACTIVE_SKILLS: Record<string, CombatSkillDefinition> = {}

const createCombatSnapshot = (input: CombatStartInput): CombatSnapshot => ({
  seed: input.seed,
  worldId: input.worldId,
  stage: input.stage,
  mode: input.mode,
  wave: 1,
  elapsedMs: 0,
  result: 'fighting',
  party: structuredClone(input.party),
  enemies: createWave(input.worldId, input.stage, 1, input.seed).enemies,
  summons: [],
})

const activeUnits = (state: CombatSnapshot): CombatUnit[] => [
  ...state.party,
  ...state.summons,
  ...state.enemies,
]

const alliesOf = (state: CombatSnapshot, actor: CombatUnit): CombatUnit[] =>
  actor.side === 'party' ? [...state.party, ...state.summons] : state.enemies

const opponentsOf = (state: CombatSnapshot, actor: CombatUnit): CombatUnit[] =>
  actor.side === 'party' ? state.enemies : [...state.party, ...state.summons]

const emitDefeat = (
  state: CombatSnapshot,
  enemy: CombatUnit,
  rng: Rng,
): CombatEvent => ({
  type: 'enemy-defeated',
  atMs: state.elapsedMs,
  enemyId: enemy.id,
  rank: enemy.rank,
  worldId: state.worldId,
  stage: state.stage,
  seed: rng.nextInt(1, 2_147_483_647),
})

const tickRealtime = (state: CombatSnapshot, rng: Rng): CombatEvent[] => {
  const events: CombatEvent[] = []
  for (const unit of activeUnits(state)) {
    if (!unit.alive) continue
    const wasAlive = unit.alive
    for (const tick of tickStatuses(unit, COMBAT_TICK_MS, rng)) {
      events.push({
        type: 'damage',
        atMs: state.elapsedMs,
        sourceId: tick.sourceId,
        targetId: tick.targetId,
        amount: tick.amount,
        critical: false,
      })
    }
    if (wasAlive && !unit.alive && unit.side === 'enemy') events.push(emitDefeat(state, unit, rng))
    if (unit.alive) advanceGaugeAndCooldowns(unit, COMBAT_TICK_MS)
  }
  for (const summon of state.summons) summon.remainingMs = Math.max(0, summon.remainingMs - COMBAT_TICK_MS)
  state.summons = state.summons.filter((summon) => summon.remainingMs > 0 && summon.alive)
  return events
}

const baseRoute = (actor: CombatUnit): 'external' | 'internal' => {
  const career = careerById(actor.careerId ?? '')
  if (!career) return 'external'
  return career.growth.magicAttack > career.growth.physicalAttack ? 'internal' : 'external'
}

const executeAction = (state: CombatSnapshot, actor: CombatUnit, rng: Rng): CombatEvent[] => {
  const events: CombatEvent[] = []
  actor.gauge = 0
  actor.energy = Math.min(actor.maxEnergy, actor.energy + 5)
  const allies = alliesOf(state, actor)
  const opponents = opponentsOf(state, actor)
  const selection = selectSkill(actor, allies, opponents, ACTIVE_SKILLS)
  for (const skipped of selection.skipped) {
    events.push({ type: 'skill-skipped', atMs: state.elapsedMs, sourceId: actor.id, ...skipped })
  }

  const martial = martialByIdV10(selection.skillId)
  const isBase = !martial
  const semantic = martial?.damageRoute === 'healing' ? 'heal' : 'damage'
  const targets = semantic === 'heal'
    ? selectTargets(allies.filter((unit) => unit.alive && unit.hp < unit.maxHp), { shape: 'single', reach: 'ranged' })
    : selectTargets(opponents, { shape: 'single', reach: martial?.damageRoute === 'external' || isBase ? 'melee' : 'ranged' })
  if (targets.length === 0) return events

  if (martial) {
    actor.energy = Math.max(0, actor.energy - martial.energyCost)
    actor.cooldowns[martial.id] = martial.cooldownMs
  } else {
    actor.energy = Math.min(actor.maxEnergy, actor.energy + 10)
  }
  events.push({ type: 'skill-used', atMs: state.elapsedMs, sourceId: actor.id, skillId: selection.skillId, targetIds: targets.map((target) => target.id) })

  for (const target of targets) {
    if (semantic === 'heal') {
      const healBonus = attr(actor.attributes, SX.治疗加成)
      const amount = Math.max(1, Math.floor(attr(actor.attributes, SX.法攻) * (martial?.power ?? 1.0) * (1 + healBonus / 100)))
      target.hp = Math.min(target.maxHp, target.hp + amount)
      events.push({ type: 'healing', atMs: state.elapsedMs, sourceId: actor.id, targetId: target.id, amount })
      continue
    }

    const route = martial?.damageRoute === 'internal' || (!martial && baseRoute(actor) === 'internal') ? 'internal' : 'external'
    if (rng.nextFloat() > hitChance(attr(target.attributes, SX.闪避修正), attr(actor.attributes, SX.命中修正))) continue
    const isPhysical = route === 'external'
    const skillCategory = martial?.skillCategory ?? 0
    const weaponType = martial?.weaponType ?? 0
    const element = martial?.element ?? 0
    const elementIds = element ? ELEMENT_IDS[element] : null
    const faction = martial?.factionId ? factionById(martial.factionId) : undefined
    const { isCritical, coefficient: criticalCoeff } = rollCritical(
      attr(actor.attributes, SX.暴击几率),
      attr(actor.attributes, SX.暴击伤害),
      rng.nextFloat(),
    )
    const amount = calculateDamage({
      attack: attr(actor.attributes, isPhysical ? SX.物攻 : SX.法攻),
      defense: attr(target.attributes, isPhysical ? SX.物防 : SX.法防),
      skillCoeff: martial?.power ?? 1.0,
      factionPower: faction ? attr(actor.attributes, faction.factionPowerSxId) : 0,
      elementPower: elementIds ? attr(actor.attributes, elementIds.groupPower) : 0,
      damageType: attr(actor.attributes, isPhysical ? SX.物理增伤 : SX.法术增伤),
      basicAttack: isBase ? attr(actor.attributes, SX.普攻增伤) : 0,
      elementDamage: elementIds ? attr(actor.attributes, elementIds.damage) : 0,
      specialization: skillCategory ? attr(actor.attributes, 60 + skillCategory - 1) : 0,
      mastery: weaponType ? attr(actor.attributes, 92 + weaponType - 1) : 0,
      typeReduction: attr(target.attributes, isPhysical ? SX.物理减伤 : SX.法术减伤),
      elementResist: elementIds ? attr(target.attributes, elementIds.resist) : 0,
      receivedType: attr(target.attributes, isPhysical ? SX.受物理伤害 : SX.受法术伤害),
      receivedElement: elementIds ? attr(target.attributes, elementIds.received) : 0,
      receivedAll: attr(target.attributes, SX.受所有伤害),
      finalDamage: attr(actor.attributes, SX.最终增伤),
      finalReduction: attr(target.attributes, SX.最终减伤),
      critical: criticalCoeff,
      buffMultiplier: 0,
    })
    target.hp = Math.max(0, target.hp - amount)
    // 吸血（c3runtime 56015，证据 A）：吸血回复 = ceil(伤害 × sx14/100)，回复给攻击方
    const lifeSteal = attr(actor.attributes, SX.吸血)
    if (lifeSteal > 0 && actor.alive) {
      const steal = Math.ceil((amount * lifeSteal) / 100)
      actor.hp = Math.min(actor.maxHp, actor.hp + steal)
    }
    events.push({ type: 'damage', atMs: state.elapsedMs, sourceId: actor.id, targetId: target.id, amount, critical: isCritical })
    if (martial?.statusTrigger && target.alive && rng.nextFloat() < martial.statusTrigger.chance) {
      const trigger = martial.statusTrigger
      const isDot = trigger.category === 'damage-over-time'
      const baseAtk = isPhysical ? attr(actor.attributes, SX.物攻) : attr(actor.attributes, SX.法攻)
      applyStatus(target, {
        id: trigger.id,
        remainingMs: trigger.durationMs,
        mode: trigger.mode,
        stacks: 1,
        value: isDot ? Math.max(1, Math.floor(baseAtk * (trigger.valueRatio ?? 0))) : 0,
        tickIntervalMs: trigger.tickIntervalMs,
        sourceId: actor.id,
        category: trigger.category,
      })
    }
    if (target.hp === 0 && target.alive) {
      target.alive = false
      if (target.side === 'enemy') events.push(emitDefeat(state, target, rng))
    }
  }
  return events
}

const tickOnce = (state: CombatSnapshot, rng: Rng): CombatEvent[] => {
  state.elapsedMs += COMBAT_TICK_MS
  const events = tickRealtime(state, rng)

  for (const actor of readyOrder(activeUnits(state))) {
    if (!actor.alive || state.result !== 'fighting') continue
    if (actor.statuses.some((status) => status.category === 'control' && status.remainingMs > 0)) continue
    events.push(...executeAction(state, actor, rng))
    if (isWaveCleared(state.enemies)) break
  }

  if (!state.party.some((unit) => unit.alive)) {
    state.result = 'defeat'
    events.push({ type: 'party-defeated', atMs: state.elapsedMs })
    return events
  }

  if (isWaveCleared(state.enemies)) {
    if (state.wave === 10) {
      state.result = 'victory'
      events.push({ type: 'stage-cleared', atMs: state.elapsedMs })
    } else {
      advanceToNextWave(state)
      events.push({ type: 'wave-started', atMs: state.elapsedMs, wave: state.wave })
    }
  }
  return events
}

export const createCombatEngine = (input: CombatStartInput): CombatEngine => {
  const state = createCombatSnapshot(input)
  const rng = createRng(input.seed)
  return {
    state,
    tick(count = 1): CombatEvent[] {
      const events: CombatEvent[] = []
      const safeCount = Math.max(0, Math.floor(count))
      for (let index = 0; index < safeCount && state.result === 'fighting'; index += 1) {
        events.push(...tickOnce(state, rng))
      }
      return events
    },
    setMode(mode): void {
      state.mode = mode
    },
    stop(): CombatEvent[] {
      if (state.result !== 'fighting') return []
      state.result = 'stopped'
      return [{ type: 'combat-stopped', atMs: state.elapsedMs }]
    },
  }
}
