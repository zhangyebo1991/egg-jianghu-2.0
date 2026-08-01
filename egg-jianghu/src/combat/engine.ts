import { MARTIALS_V10, martialByIdV10 } from '../content/martials'
import { calculateDamage, hitChance } from './damage'
import { createRng, type Rng } from './rng'
import { selectSkill, type CombatSkillDefinition } from './skill-ai'
import { tickStatuses } from './statuses'
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
  stop(): CombatEvent[]
}

const ACTIVE_SKILLS: Record<string, CombatSkillDefinition> = Object.fromEntries(
  MARTIALS_V10.map((martial) => [martial.id, {
    id: martial.id,
    energyCost: martial.energyCost,
    cooldownMs: martial.cooldownMs,
    semantic: martial.damageRoute === 'healing' ? 'heal' : 'damage',
    target: {
      shape: 'single',
      reach: martial.damageRoute === 'external' ? 'melee' : 'ranged',
    },
    careerIds: martial.careerIds,
  } satisfies CombatSkillDefinition]),
)

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
      })
    }
    if (wasAlive && !unit.alive && unit.side === 'enemy') events.push(emitDefeat(state, unit, rng))
    if (unit.alive) advanceGaugeAndCooldowns(unit, COMBAT_TICK_MS)
  }
  for (const summon of state.summons) summon.remainingMs = Math.max(0, summon.remainingMs - COMBAT_TICK_MS)
  state.summons = state.summons.filter((summon) => summon.remainingMs > 0 && summon.alive)
  return events
}

const baseRoute = (actor: CombatUnit): 'external' | 'internal' =>
  actor.careerId?.startsWith('doctor') || actor.careerId?.startsWith('inner') ? 'internal' : 'external'

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
      const amount = Math.max(1, Math.floor(actor.internalAttack * (martial?.power ?? 0.8)))
      target.hp = Math.min(target.maxHp, target.hp + amount)
      events.push({ type: 'healing', atMs: state.elapsedMs, sourceId: actor.id, targetId: target.id, amount })
      continue
    }

    if (rng.nextFloat() > hitChance(actor.accuracy - target.evade)) continue
    const route = martial?.damageRoute === 'internal' || (!martial && baseRoute(actor) === 'internal') ? 'internal' : 'external'
    const critical = rng.nextFloat() < actor.criticalChance ? actor.criticalMultiplier : 1
    const amount = calculateDamage({
      attack: route === 'external' ? actor.externalAttack : actor.internalAttack,
      defense: route === 'external' ? target.externalDefense : target.internalDefense,
      power: martial?.power ?? 0.8,
      additive: 0,
      critical,
      momentum: 0,
      reduction: 0,
      vulnerability: 0,
      final: 0,
    })
    target.hp = Math.max(0, target.hp - amount)
    events.push({ type: 'damage', atMs: state.elapsedMs, sourceId: actor.id, targetId: target.id, amount })
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
    stop(): CombatEvent[] {
      if (state.result !== 'fighting') return []
      state.result = 'stopped'
      return [{ type: 'combat-stopped', atMs: state.elapsedMs }]
    },
  }
}
