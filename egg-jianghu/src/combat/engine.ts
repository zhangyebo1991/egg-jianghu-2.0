import { buffById } from '../content/buffs'
import { summonById, type CombatSkillContent } from '../content/skills'
import type { CampaignMode } from '../domain/types'
import { calculateDamage, hitChance, rollCritical } from './damage'
import { SX, ELEMENT_IDS } from './attribute-ids'
import { createRng, type Rng } from './rng'
import { selectSkill, selectSkillTargets } from './skill-ai'
import { applyBuff, dealCombatDamage, expireTurnBuffs, isControlled, tickStatuses, unitAttr } from './statuses'
import { firstEmptySlot } from './targeting'
import { advanceGaugeAndCooldowns, COMBAT_TICK_MS, readyOrder } from './timeline'
import type {
  CombatEvent,
  CombatSnapshot,
  CombatStartInput,
  CombatSummon,
  CombatUnit,
} from './types'
import { panelToAttributeMap } from './stats'
import { advanceToNextWave, createWave, isWaveCleared } from './waves'

export interface CombatEngine {
  readonly state: CombatSnapshot
  tick(count?: number): CombatEvent[]
  setMode(mode: CampaignMode): void
  stop(): CombatEvent[]
}

const ENERGY_CAP = 5
const FALLBACK_ATTACK_ID = 1

const createCombatSnapshot = (input: CombatStartInput): CombatSnapshot => ({
  seed: input.seed,
  worldId: input.worldId,
  difficulty: input.difficulty ?? 1,
  stage: input.stage,
  mode: input.mode,
  wave: 1,
  elapsedMs: 0,
  result: 'fighting',
  party: structuredClone(input.party),
  enemies: createWave(input.worldId, input.stage, 1, input.seed, input.difficulty ?? 1).enemies,
  summons: [],
})

const activeUnits = (state: CombatSnapshot): CombatUnit[] => [
  ...state.party,
  ...state.summons,
  ...state.enemies,
]

const alliesOf = (state: CombatSnapshot, actor: CombatUnit): CombatUnit[] =>
  actor.side === 'party'
    ? [...state.party, ...state.summons.filter((summon) => summon.side === 'party')]
    : [...state.enemies, ...state.summons.filter((summon) => summon.side === 'enemy')]

const opponentsOf = (state: CombatSnapshot, actor: CombatUnit): CombatUnit[] =>
  actor.side === 'party'
    ? [...state.enemies, ...state.summons.filter((summon) => summon.side === 'enemy')]
    : [...state.party, ...state.summons.filter((summon) => summon.side === 'party')]

const waveIsClear = (state: CombatSnapshot): boolean =>
  isWaveCleared(state.enemies) && !state.summons.some((summon) => summon.side === 'enemy' && summon.alive)

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
  difficulty: state.difficulty,
  seed: rng.nextInt(1, 2_147_483_647),
})

const markDefeated = (state: CombatSnapshot, unit: CombatUnit, rng: Rng, events: CombatEvent[]): void => {
  if (unit.alive || unit.hp > 0) return
  unit.alive = false
  if (unit.side === 'enemy' && !unit.id.startsWith('summon_')) events.push(emitDefeat(state, unit, rng))
}

const tickRealtime = (state: CombatSnapshot, rng: Rng): CombatEvent[] => {
  const events: CombatEvent[] = []
  for (const unit of activeUnits(state)) {
    if (!unit.alive) continue
    for (const tick of tickStatuses(unit, COMBAT_TICK_MS)) {
      if (tick.amount < 0) {
        events.push({
          type: 'healing',
          atMs: state.elapsedMs,
          sourceId: tick.sourceId,
          targetId: tick.targetId,
          amount: -tick.amount,
        })
      } else {
        events.push({
          type: 'damage',
          atMs: state.elapsedMs,
          sourceId: tick.sourceId,
          targetId: tick.targetId,
          amount: tick.amount,
          critical: false,
        })
      }
    }
    if (!unit.alive) markDefeated(state, unit, rng, events)
    if (unit.alive) advanceGaugeAndCooldowns(unit, COMBAT_TICK_MS)
  }
  for (const summon of state.summons) summon.remainingMs = Math.max(0, summon.remainingMs - COMBAT_TICK_MS)
  state.summons = state.summons.filter((summon) => summon.remainingMs > 0 && summon.alive)
  return events
}

const spendSkill = (actor: CombatUnit, skill: CombatSkillContent): void => {
  actor.energy = Math.max(0, actor.energy - skill.energyCost)
  const cooldownScale = Math.max(0, 100 - unitAttr(actor, SX.技能冷却)) / 100
  actor.cooldowns[skill.id] = Math.round(skill.cooldownMs * cooldownScale)
}

const durationScaleFor = (actor: CombatUnit, buffId: number): number => {
  const definition = buffById(buffId)
  if (!definition) return 1
  const sxId = definition.polarity === 'buff' ? SX.增益时间 : SX.减益时间
  return 1 + unitAttr(actor, sxId) / 100
}

const tryApplySkillBuff = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  target: CombatUnit,
  rng: Rng,
  events: CombatEvent[],
): void => {
  if (!skill.appliedBuffId) return
  if (!target.alive && skill.behavior !== 'revive') return
  if (rng.nextFloat() >= (skill.appliedBuffChance ?? 1)) return
  const definition = buffById(skill.appliedBuffId)
  const attack = skill.route === 'internal' ? unitAttr(actor, SX.法攻) : unitAttr(actor, SX.物攻)
  const tickValue = definition?.kind === 'dot' || definition?.kind === 'hot'
    ? Math.max(1, Math.floor(attack * 0.1))
    : undefined
  const applied = applyBuff(target, skill.appliedBuffId, skill.appliedBuffStacks ?? 1, actor.id, {
    durationScale: durationScaleFor(actor, skill.appliedBuffId),
    tickValue,
  })
  if (applied) {
    events.push({
      type: 'status-applied',
      atMs: state.elapsedMs,
      sourceId: actor.id,
      targetId: target.id,
      buffId: applied.buffId,
      stacks: applied.stacks,
    })
  }
}

const enhanceMultiplier = (actor: CombatUnit, skill: CombatSkillContent): number => {
  if (!skill.enhanceBuffId || !skill.enhancePerStack) return 0
  const stacks = actor.statuses.find((status) => status.buffId === skill.enhanceBuffId)?.stacks ?? 0
  return stacks * skill.enhancePerStack
}

const executeAttack = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  targets: CombatUnit[],
  rng: Rng,
  events: CombatEvent[],
): void => {
  const isPhysical = skill.route !== 'internal'
  const isBase = skill.id === actor.baseAttackId
  const hits = Math.max(1, skill.hits)
  const elementIds = skill.element ? ELEMENT_IDS[skill.element] : null
  for (let hit = 0; hit < hits; hit += 1) {
    for (const target of targets) {
      if (!target.alive) continue
      if (rng.nextFloat() > hitChance(unitAttr(target, SX.闪避修正), unitAttr(actor, SX.命中修正))) continue
      const { isCritical, coefficient: criticalCoeff } = rollCritical(
        unitAttr(actor, SX.暴击几率),
        unitAttr(actor, SX.暴击伤害),
        rng.nextFloat(),
      )
      const amount = calculateDamage({
        attack: unitAttr(actor, isPhysical ? SX.物攻 : SX.法攻),
        defense: unitAttr(target, isPhysical ? SX.物防 : SX.法防),
        skillCoeff: skill.powerPercent / 100,
        factionPower: 0,
        elementPower: elementIds ? unitAttr(actor, elementIds.groupPower) : 0,
        damageType: unitAttr(actor, isPhysical ? SX.物理增伤 : SX.法术增伤),
        basicAttack: isBase ? unitAttr(actor, SX.普攻增伤) : 0,
        elementDamage: elementIds ? unitAttr(actor, elementIds.damage) : 0,
        specialization: skill.skillCategory ? unitAttr(actor, 60 + skill.skillCategory - 1) : 0,
        mastery: 0,
        typeReduction: unitAttr(target, isPhysical ? SX.物理减伤 : SX.法术减伤),
        elementResist: elementIds ? unitAttr(target, elementIds.resist) : 0,
        receivedType: unitAttr(target, isPhysical ? SX.受物理伤害 : SX.受法术伤害),
        receivedElement: elementIds ? unitAttr(target, elementIds.received) : 0,
        receivedAll: unitAttr(target, SX.受所有伤害),
        finalDamage: unitAttr(actor, SX.最终增伤),
        finalReduction: unitAttr(target, SX.最终减伤),
        critical: criticalCoeff,
        buffMultiplier: enhanceMultiplier(actor, skill),
      })
      dealCombatDamage(target, amount)
      const lifeSteal = unitAttr(actor, SX.吸血)
      if (lifeSteal > 0 && actor.alive) {
        const steal = Math.ceil((amount * lifeSteal) / 100)
        actor.hp = Math.min(actor.maxHp, actor.hp + steal)
      }
      events.push({
        type: 'damage',
        atMs: state.elapsedMs,
        sourceId: actor.id,
        targetId: target.id,
        amount,
        critical: isCritical,
      })
      if (!target.alive) markDefeated(state, target, rng, events)
    }
  }
  for (const target of targets) tryApplySkillBuff(state, actor, skill, target, rng, events)
}

const executeHeal = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  targets: CombatUnit[],
  events: CombatEvent[],
): void => {
  const power = unitAttr(actor, SX.法攻) * (skill.powerPercent / 100)
  const healBonus = 1 + unitAttr(actor, SX.治疗加成) / 100
  for (const target of targets) {
    if (!target.alive) continue
    const received = 1 + unitAttr(target, SX.受疗效果) / 100
    const amount = Math.max(1, Math.floor(power * healBonus * received * (1 + enhanceMultiplier(actor, skill) / 100)))
    const healed = Math.min(target.maxHp - target.hp, amount)
    if (healed <= 0) continue
    target.hp += healed
    events.push({ type: 'healing', atMs: state.elapsedMs, sourceId: actor.id, targetId: target.id, amount: healed })
  }
}

const executeShield = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  targets: CombatUnit[],
  events: CombatEvent[],
): void => {
  const power = unitAttr(actor, SX.法攻) * (skill.powerPercent / 100)
  const shieldBonus = 1 + unitAttr(actor, SX.护盾加成) / 100
  for (const target of targets) {
    if (!target.alive) continue
    const amount = Math.max(1, Math.floor(power * shieldBonus))
    const cap = target.maxHp * (1 + unitAttr(target, SX.护盾超限) / 100)
    const applied = Math.min(amount, Math.max(0, cap - target.shield))
    if (applied <= 0) continue
    target.shield += applied
    events.push({ type: 'shield-applied', atMs: state.elapsedMs, sourceId: actor.id, targetId: target.id, amount: applied })
  }
}

const executeStatus = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  targets: CombatUnit[],
  rng: Rng,
  events: CombatEvent[],
): void => {
  for (const target of targets) tryApplySkillBuff(state, actor, skill, target, rng, events)
}

const executeRevive = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  targets: CombatUnit[],
  events: CombatEvent[],
): void => {
  for (const target of targets) {
    if (target.alive) continue
    const restored = Math.max(1, Math.floor(target.maxHp * (skill.powerPercent / 100)))
    target.hp = Math.min(target.maxHp, restored)
    target.alive = true
    target.gauge = 0
    events.push({ type: 'unit-revived', atMs: state.elapsedMs, sourceId: actor.id, targetId: target.id })
  }
}

const executeAdvanceGauge = (
  skill: CombatSkillContent,
  targets: CombatUnit[],
): void => {
  const delta = 1000 * (skill.powerPercent / 100)
  for (const target of targets) {
    if (!target.alive) continue
    target.gauge += delta
  }
}

const executeGrantEnergy = (targets: CombatUnit[]): void => {
  for (const target of targets) {
    if (!target.alive) continue
    target.energy = Math.min(ENERGY_CAP, target.energy + 1)
  }
}

const createSummonUnit = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
): CombatSummon | null => {
  if (!skill.summonId) return null
  const definition = summonById(skill.summonId)
  if (!definition) return null
  const allies = alliesOf(state, actor)
  const slot = firstEmptySlot(allies)
  if (!slot) return null
  const strength = 1 + unitAttr(actor, SX.召唤强度) / 100
  const maxHp = Math.max(1, Math.floor(actor.maxHp * definition.coeffs[0] / 100 * strength))
  const externalAttack = Math.max(1, Math.floor(actor.externalAttack * definition.coeffs[1] / 100 * strength))
  const externalDefense = Math.max(1, Math.floor(actor.externalDefense * definition.coeffs[2] / 100 * strength))
  const internalDefense = Math.max(1, Math.floor(actor.internalDefense * definition.coeffs[3] / 100 * strength))
  const internalAttack = Math.max(1, Math.floor(actor.internalAttack * definition.coeffs[4] / 100 * strength))
  const effectiveAgility = Math.max(1, Math.floor(actor.effectiveAgility * definition.coeffs[5] / 100 * strength))
  const durationMs = Math.round(definition.durationMs * (1 + unitAttr(actor, SX.召唤时间) / 100))
  const id = `summon_${definition.id}_${state.elapsedMs}_${state.summons.length}`
  const summon: CombatSummon = {
    id,
    name: definition.name,
    side: actor.side,
    row: slot.row,
    col: slot.col,
    formationOrder: (actor.side === 'party' ? 100 : 200) + slot.row * 5 + slot.col,
    rank: 'normal',
    alive: true,
    hp: maxHp,
    maxHp,
    shield: 0,
    energy: 0,
    maxEnergy: ENERGY_CAP,
    gauge: 0,
    effectiveAgility,
    externalAttack,
    internalAttack,
    externalDefense,
    internalDefense,
    accuracy: actor.accuracy,
    evade: actor.evade,
    criticalChance: actor.criticalChance,
    criticalMultiplier: actor.criticalMultiplier,
    controlResistance: 0,
    cooldowns: {},
    statuses: [],
    skillIds: [],
    baseAttackId: definition.route === 'internal' ? 4 : FALLBACK_ATTACK_ID,
    remainingMs: durationMs,
    attributes: panelToAttributeMap({
      maxHp,
      effectiveAgility,
      externalAttack,
      externalDefense,
      internalAttack,
      internalDefense,
      accuracy: actor.accuracy,
      evade: actor.evade,
      criticalChance: actor.criticalChance,
      criticalMultiplier: actor.criticalMultiplier,
      controlResistance: 0,
      initialEnergy: 0,
      energyRecovery: 1,
      cooldownRate: 0,
      lifeSteal: 0,
    }),
  }
  return summon
}

const executeAction = (state: CombatSnapshot, actor: CombatUnit, rng: Rng): CombatEvent[] => {
  const events: CombatEvent[] = []
  actor.gauge = 0
  actor.energy = Math.min(ENERGY_CAP, actor.maxEnergy, actor.energy + Math.max(0, unitAttr(actor, SX.能量回复)))
  const allies = alliesOf(state, actor)
  const opponents = opponentsOf(state, actor)
  const { skill } = selectSkill(actor, allies, opponents, rng)
  const targets = selectSkillTargets(actor, skill, allies, opponents)
  spendSkill(actor, skill)
  if (skill.behavior === 'summon') {
    const summon = createSummonUnit(state, actor, skill)
    events.push({
      type: 'skill-used',
      atMs: state.elapsedMs,
      sourceId: actor.id,
      skillId: skill.id,
      targetIds: summon ? [summon.id] : [],
    })
    if (summon) {
      state.summons.push(summon)
      events.push({
        type: 'summoned',
        atMs: state.elapsedMs,
        sourceId: actor.id,
        summonId: summon.id,
        summonName: summon.name,
      })
    }
    expireTurnBuffs(actor)
    return events
  }
  events.push({
    type: 'skill-used',
    atMs: state.elapsedMs,
    sourceId: actor.id,
    skillId: skill.id,
    targetIds: targets.map((target) => target.id),
  })
  if (targets.length === 0) {
    expireTurnBuffs(actor)
    return events
  }
  if (skill.behavior === 'attack') executeAttack(state, actor, skill, targets, rng, events)
  else if (skill.behavior === 'heal') executeHeal(state, actor, skill, targets, events)
  else if (skill.behavior === 'shield') executeShield(state, actor, skill, targets, events)
  else if (skill.behavior === 'status') executeStatus(state, actor, skill, targets, rng, events)
  else if (skill.behavior === 'revive') executeRevive(state, actor, skill, targets, events)
  else if (skill.behavior === 'advance-gauge') executeAdvanceGauge(skill, targets)
  else if (skill.behavior === 'grant-energy') executeGrantEnergy(targets)
  expireTurnBuffs(actor)
  return events
}

const tickOnce = (state: CombatSnapshot, rng: Rng): CombatEvent[] => {
  state.elapsedMs += COMBAT_TICK_MS
  const events = tickRealtime(state, rng)

  for (const actor of readyOrder(activeUnits(state))) {
    if (!actor.alive || state.result !== 'fighting') continue
    if (isControlled(actor)) continue
    events.push(...executeAction(state, actor, rng))
    if (waveIsClear(state)) break
  }

  if (!state.party.some((unit) => unit.alive)) {
    state.result = 'defeat'
    events.push({ type: 'party-defeated', atMs: state.elapsedMs })
    return events
  }

  if (waveIsClear(state)) {
    if (state.wave === 10) {
      state.result = 'victory'
      events.push({ type: 'stage-cleared', atMs: state.elapsedMs })
    } else {
      state.summons = state.summons.filter((summon) => summon.side === 'party')
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
