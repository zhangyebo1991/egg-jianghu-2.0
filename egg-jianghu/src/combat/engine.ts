import { buffById } from '../content/buffs'
import { ATTRIBUTES, type AttributeMap } from '../content/attributes'
import { skillById, summonById, type CombatSkillContent } from '../content/skills'
import type { CampaignMode } from '../domain/types'
import { calculateDamage, hitChance, rollCritical } from './damage'
import { ELEMENT_IDS, skillGroupPowerAttributeId, SX, weaponMasteryAttributeId } from './attribute-ids'
import { createRng, type Rng } from './rng'
import { selectSkill, selectSkillTargets } from './skill-ai'
import {
  advanceStatusDurations,
  applyBuff,
  dealCombatDamage,
  expireTurnBuffs,
  isControlled,
  pulseStatuses,
  unitAttr,
} from './statuses'
import { firstEmptySlot } from './targeting'
import { advanceGaugeAndCooldowns } from './timeline'
import { calculateHealing, calculateModifiedSupportStat, calculateShield, supportBonusFactor } from './support'
import {
  createActionPlan,
  createCombatTimeline,
  enqueueReadyActors,
  ORIGINAL_ACCUMULATION_STEP_MS,
  ORIGINAL_INITIAL_WAVE_REFRESH_MS,
  ORIGINAL_INITIAL_WAVE_TRANSITION_MS,
  ORIGINAL_ROAM_VICTORY_END_MS,
  ORIGINAL_SETTLEMENT_END_MS,
  ORIGINAL_WAVE_REFRESH_MS,
  ORIGINAL_WAVE_TRANSITION_MS,
  takeNextReadyActor,
} from './scheduler'
import type {
  CombatEvent,
  CombatSnapshot,
  CombatStartInput,
  CombatSummon,
  CombatUnit,
} from './types'
import { advanceToNextWave, createWave, isWaveCleared, waveEnemyLevel } from './waves'

export interface CombatEngine {
  readonly state: CombatSnapshot
  tick(count?: number): CombatEvent[]
  advance(elapsedMs: number): CombatEvent[]
  setMode(mode: CampaignMode): void
  stop(): CombatEvent[]
}

const ENERGY_CAP = 5
const STATUS_PULSE_MS = 1000

const createCombatSnapshot = (input: CombatStartInput): CombatSnapshot => {
  const timeline = createCombatTimeline()
  timeline.phase = 'wave-transition'
  timeline.waveTransition = {
    kind: 'initial',
    elapsedMs: 0,
    refreshAtMs: ORIGINAL_INITIAL_WAVE_REFRESH_MS,
    durationMs: ORIGINAL_INITIAL_WAVE_TRANSITION_MS,
    refreshed: false,
  }
  return {
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
    timeline,
  }
}

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
  enemyLevel: waveEnemyLevel(state.worldId, state.stage, state.wave, state.difficulty),
  rank: enemy.rank,
  worldId: state.worldId,
  stage: state.stage,
  difficulty: state.difficulty,
  seed: rng.nextInt(1, 2_147_483_647),
})

const markDefeated = (state: CombatSnapshot, unit: CombatUnit, rng: Rng, events: CombatEvent[]): void => {
  if (!unit.alive || unit.hp > 0) return
  const summon = state.summons.some((candidate) => candidate === unit)
  if (unit.side === 'enemy' && !summon) events.push(emitDefeat(state, unit, rng))
  unit.alive = false
  unit.shield = 0
  unit.gauge = 0
  unit.cooldowns = {}
  unit.statuses = []
  state.timeline.readyQueue = state.timeline.readyQueue.filter((entry) => entry.actorId !== unit.id)
  events.push({ type: 'unit-defeated', atMs: state.elapsedMs, unitId: unit.id, side: unit.side, summon })
}

const settleDefeatedUnits = (state: CombatSnapshot, rng: Rng, events: CombatEvent[]): void => {
  for (const unit of activeUnits(state)) markDefeated(state, unit, rng, events)
  state.summons = state.summons.filter((summon) => summon.alive)
}

const tickRealtime = (state: CombatSnapshot, rng: Rng, elapsedMs: number): CombatEvent[] => {
  const events: CombatEvent[] = []
  const units = activeUnits(state)
  for (const unit of units) {
    advanceStatusDurations(unit, elapsedMs)
    if (unit.alive) advanceGaugeAndCooldowns(unit, elapsedMs)
  }

  state.timeline.statusPulseCarryMs += elapsedMs
  while (state.timeline.statusPulseCarryMs >= STATUS_PULSE_MS) {
    state.timeline.statusPulseCarryMs -= STATUS_PULSE_MS

    // 原版先遍历全部阵位结算生命恢复，再按阵位和状态槽结算 DoT/HoT。
    for (const unit of units) {
      if (!unit.alive || unit.hp >= unit.maxHp) continue
      const healed = Math.min(unit.maxHp - unit.hp, Math.max(0, Math.floor(unitAttr(unit, SX.生命恢复))))
      if (healed <= 0) continue
      unit.hp += healed
      events.push({ type: 'healing', atMs: state.elapsedMs, sourceId: unit.id, targetId: unit.id, amount: healed })
    }

    for (const unit of units) {
      if (!unit.alive) continue
      for (const tick of pulseStatuses(unit)) {
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
    }
    settleDefeatedUnits(state, rng, events)
  }
  for (const summon of state.summons) summon.remainingMs = Math.max(0, summon.remainingMs - elapsedMs)
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
  if (!definition || definition.unit === 'turn') return 1
  const sxId = definition.polarity === 'buff' ? SX.增益时间 : SX.减益时间
  const durationBonus = unitAttr(actor, sxId)
  return durationBonus > 0 ? 1 + durationBonus / 100 : 1
}

const skillDamageAmount = (
  actor: CombatUnit,
  target: CombatUnit,
  skill: CombatSkillContent,
  critical: number,
  isBaseAttack: boolean,
): number => {
  const isPhysical = skill.route !== 'internal'
  const elementIds = skill.element ? ELEMENT_IDS[skill.element] : null
  return calculateDamage({
    attack: modifiedCombatStat(
      actor,
      isPhysical ? SX.物攻 : SX.法攻,
      isPhysical ? SX.物攻修正 : SX.法攻修正,
      isPhysical ? 'physicalAttack' : 'magicAttack',
    ),
    defense: modifiedCombatStat(
      target,
      isPhysical ? SX.物防 : SX.法防,
      isPhysical ? SX.物防修正 : SX.法防修正,
      isPhysical ? 'physicalDefense' : 'magicDefense',
    ),
    skillCoeff: skill.powerPercent / 100,
    factionPower: skillGroupPower(actor, skill),
    elementPower: elementIds ? unitAttr(actor, elementIds.groupPower) : 0,
    damageType: unitAttr(actor, isPhysical ? SX.物理增伤 : SX.法术增伤),
    basicAttack: isBaseAttack ? unitAttr(actor, SX.普攻增伤) : 0,
    elementDamage: elementIds ? unitAttr(actor, elementIds.damage) : 0,
    specialization: skill.skillCategory ? unitAttr(actor, 60 + skill.skillCategory - 1) : 0,
    mastery: weaponMastery(actor),
    typeReduction: unitAttr(target, isPhysical ? SX.物理减伤 : SX.法术减伤),
    elementResist: elementIds ? unitAttr(target, elementIds.resist) : 0,
    receivedType: unitAttr(target, isPhysical ? SX.受物理伤害 : SX.受法术伤害),
    receivedElement: elementIds ? unitAttr(target, elementIds.received) : 0,
    receivedAll: unitAttr(target, SX.受所有伤害),
    finalDamage: unitAttr(actor, SX.最终增伤),
    finalReduction: unitAttr(target, SX.最终减伤),
    critical,
    buffMultiplier: enhanceMultiplier(actor, target, skill),
  })
}

const skillHealingAmount = (
  actor: CombatUnit,
  target: CombatUnit,
  skill: CombatSkillContent,
): number => {
  const elementIds = skill.element ? ELEMENT_IDS[skill.element] : null
  return calculateHealing({
    attack: modifiedCombatStat(actor, SX.生命, SX.生命上限修正, 'heal'),
    skillCoeff: skill.powerPercent / 100,
    factionPower: skillGroupPower(actor, skill),
    elementPower: elementIds ? unitAttr(actor, elementIds.groupPower) : 0,
    healingBonus: unitAttr(actor, SX.治疗加成),
    elementDamage: elementIds ? unitAttr(actor, elementIds.damage) : 0,
    specialization: skill.skillCategory ? unitAttr(actor, 60 + skill.skillCategory - 1) : 0,
    mastery: weaponMastery(actor),
    receivedHealing: unitAttr(target, SX.受疗效果),
    healingReduction: unitAttr(target, SX.受治疗效果),
    buffMultiplier: enhanceMultiplier(actor, target, skill),
  })
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
  const baseDurationSeconds = Math.max(1, (definition?.durationMs ?? 1000) / 1000)
  const tickValue = definition?.tickKind === 'dot'
    ? Math.ceil(0.2 / baseDurationSeconds * skillDamageAmount(actor, target, skill, 1, false))
    : definition?.tickKind === 'hot'
      ? Math.ceil(0.2 / baseDurationSeconds * skillHealingAmount(actor, target, skill))
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

const applySkillSelfBuff = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  events: CombatEvent[],
): void => {
  if (!skill.selfBuffId) return
  const applied = applyBuff(actor, skill.selfBuffId, skill.selfBuffStacks ?? 1, actor.id, {
    durationScale: durationScaleFor(actor, skill.selfBuffId),
  })
  if (!applied) return
  events.push({
    type: 'status-applied',
    atMs: state.elapsedMs,
    sourceId: actor.id,
    targetId: actor.id,
    buffId: applied.buffId,
    stacks: applied.stacks,
  })
}

const enhanceMultiplier = (actor: CombatUnit, target: CombatUnit, skill: CombatSkillContent): number => {
  if (!skill.enhanceBuffId || !skill.enhancePerStack) return 0
  const holder = skill.enhanceTarget === 'target' ? target : actor
  const stacks = holder.statuses.find((status) => status.buffId === skill.enhanceBuffId)?.stacks ?? 0
  return stacks * skill.enhancePerStack
}

const consumeSkillEnhancement = (
  actor: CombatUnit,
  targets: CombatUnit[],
  skill: CombatSkillContent,
): void => {
  if (!skill.enhanceBuffId || !skill.enhanceConsumeStacks) return
  const holders = skill.enhanceTarget === 'target' ? targets : [actor]
  const seen = new Set<string>()
  for (const holder of holders) {
    if (seen.has(holder.id)) continue
    seen.add(holder.id)
    const status = holder.statuses.find((item) => item.buffId === skill.enhanceBuffId)
    if (!status) continue
    if (skill.enhanceConsumeStacks >= 99 || status.stacks <= skill.enhanceConsumeStacks) {
      holder.statuses = holder.statuses.filter((item) => item !== status)
    } else {
      status.stacks -= skill.enhanceConsumeStacks
    }
  }
}

const settleSkillStatuses = (
  state: CombatSnapshot,
  actor: CombatUnit,
  targets: CombatUnit[],
  skill: CombatSkillContent,
  events: CombatEvent[],
): void => {
  applySkillSelfBuff(state, actor, skill, events)
  consumeSkillEnhancement(actor, targets, skill)
}

const careerCoefficient = (
  unit: CombatUnit,
  field: keyof NonNullable<CombatUnit['careerCoefficients']>,
): number => unit.careerCoefficients?.[field] ?? 1

const modifiedCombatStat = (
  unit: CombatUnit,
  statId: number,
  modifierId: number,
  careerField: keyof NonNullable<CombatUnit['careerCoefficients']>,
): number => calculateModifiedSupportStat(
  unitAttr(unit, statId),
  unitAttr(unit, modifierId),
  careerCoefficient(unit, careerField),
)

const skillGroupPower = (actor: CombatUnit, skill: CombatSkillContent): number =>
  skill.skillGroupId > 0 ? unitAttr(actor, skillGroupPowerAttributeId(skill.skillGroupId)) : 0

const weaponMastery = (actor: CombatUnit): number =>
  actor.mainhandWeaponType ? unitAttr(actor, weaponMasteryAttributeId(actor.mainhandWeaponType)) : 0

const executeAttack = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  targets: CombatUnit[],
  rng: Rng,
  events: CombatEvent[],
): void => {
  const isBase = skill.id === actor.baseAttackId
  for (const target of targets) {
    if (!target.alive) continue
    if (rng.nextFloat() > hitChance(unitAttr(target, SX.闪避修正), unitAttr(actor, SX.命中修正))) continue
    const { isCritical, coefficient: criticalCoeff } = rollCritical(
      unitAttr(actor, SX.暴击几率),
      unitAttr(actor, SX.暴击伤害),
      rng.nextFloat(),
    )
    const amount = skillDamageAmount(actor, target, skill, criticalCoeff, isBase)
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
  }
  for (const target of targets) tryApplySkillBuff(state, actor, skill, target, rng, events)
}

const executeHeal = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  targets: CombatUnit[],
  rng: Rng,
  events: CombatEvent[],
): void => {
  for (const target of targets) {
    if (!target.alive) continue
    const amount = skillHealingAmount(actor, target, skill)
    const healed = Math.min(target.maxHp - target.hp, amount)
    if (healed <= 0) continue
    target.hp += healed
    events.push({ type: 'healing', atMs: state.elapsedMs, sourceId: actor.id, targetId: target.id, amount: healed })
  }
  for (const target of targets) tryApplySkillBuff(state, actor, skill, target, rng, events)
}

const executeShield = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  targets: CombatUnit[],
  events: CombatEvent[],
): void => {
  const elementIds = skill.element ? ELEMENT_IDS[skill.element] : null
  const attack = modifiedCombatStat(actor, SX.法攻, SX.法攻修正, 'heal')
  for (const target of targets) {
    if (!target.alive) continue
    const amount = calculateShield({
      attack,
      skillCoeff: skill.powerPercent / 100,
      factionPower: skillGroupPower(actor, skill),
      elementPower: elementIds ? unitAttr(actor, elementIds.groupPower) : 0,
      shieldBonus: unitAttr(actor, SX.护盾加成),
      elementDamage: elementIds ? unitAttr(actor, elementIds.damage) : 0,
      specialization: skill.skillCategory ? unitAttr(actor, 60 + skill.skillCategory - 1) : 0,
      mastery: weaponMastery(actor),
      shieldReduction: unitAttr(target, SX.受护盾效果),
      buffMultiplier: enhanceMultiplier(actor, target, skill),
    })
    const cap = target.maxHp * supportBonusFactor(unitAttr(target, SX.护盾超限))
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
    const restored = Math.max(1, Math.min(target.maxHp, Math.round(target.maxHp * (skill.reviveHpPercent ?? 0) / 100)))
    target.hp = Math.min(target.maxHp, restored)
    target.alive = true
    target.shield = 0
    target.energy = Math.min(ENERGY_CAP, target.maxEnergy, Math.max(0, target.attributes[SX.初始能量] ?? 0))
    target.gauge = 0
    target.cooldowns = {}
    target.statuses = []
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
  const coefficient = (index: number, strengthened: boolean): number => Math.round(
    definition.coeffs[index] / 100 * (strengthened ? strength : 1) * 100,
  ) / 100
  const summonStat = (attributeId: number, index: number, strengthened: boolean): number => Math.max(
    1,
    Math.round(unitAttr(actor, attributeId) * coefficient(index, strengthened)),
  )
  const maxHp = summonStat(SX.生命, 0, true)
  const externalAttack = summonStat(SX.物攻, 1, true)
  const externalDefense = summonStat(SX.物防, 2, false)
  const internalDefense = summonStat(SX.法防, 3, false)
  const internalAttack = summonStat(SX.法攻, 4, true)
  const effectiveAgility = summonStat(SX.速度, 5, false)
  const durationMs = Math.round(definition.durationMs * (1 + unitAttr(actor, SX.召唤时间) / 100))
  const attributes: AttributeMap = Object.fromEntries(
    ATTRIBUTES
      .filter((attribute) => attribute.combatFlag)
      .map((attribute) => [attribute.id, unitAttr(actor, attribute.id)]),
  )
  attributes[SX.生命] = maxHp
  attributes[SX.速度] = effectiveAgility
  attributes[SX.物攻] = externalAttack
  attributes[SX.物防] = externalDefense
  attributes[SX.法攻] = internalAttack
  attributes[SX.法防] = internalDefense
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
    energy: Math.min(ENERGY_CAP, Math.max(0, unitAttr(actor, SX.初始能量))),
    maxEnergy: ENERGY_CAP,
    gauge: 0,
    effectiveAgility,
    externalAttack,
    internalAttack,
    externalDefense,
    internalDefense,
    accuracy: unitAttr(actor, SX.命中修正) / 100,
    evade: unitAttr(actor, SX.闪避修正) / 100,
    criticalChance: unitAttr(actor, SX.暴击几率) / 100,
    criticalMultiplier: unitAttr(actor, SX.暴击伤害) / 100,
    controlResistance: actor.controlResistance,
    cooldowns: {},
    statuses: [],
    skillIds: [],
    baseAttackId: definition.baseAttackId,
    summonerId: actor.id,
    remainingMs: durationMs,
    attributes,
  }
  return summon
}

const unitById = (state: CombatSnapshot, id: string): CombatUnit | undefined =>
  activeUnits(state).find((unit) => unit.id === id)

const prepareAction = (state: CombatSnapshot, actor: CombatUnit): CombatEvent[] => {
  const events: CombatEvent[] = []
  actor.gauge = 0
  expireTurnBuffs(actor)
  actor.energy = Math.min(ENERGY_CAP, actor.maxEnergy, actor.energy + Math.max(0, unitAttr(actor, SX.能量回复)))
  const allies = alliesOf(state, actor)
  const opponents = opponentsOf(state, actor)
  const { skill } = selectSkill(actor, allies, opponents)
  const targets = selectSkillTargets(actor, skill, allies, opponents)
  spendSkill(actor, skill)
  state.timeline.activeAction = createActionPlan(actor.id, skill.id, targets.map((target) => target.id))
  state.timeline.phase = 'acting'
  events.push({
    type: 'skill-used',
    atMs: state.elapsedMs,
    sourceId: actor.id,
    skillId: skill.id,
    targetIds: targets.map((target) => target.id),
  })
  return events
}

const resolveActionHit = (state: CombatSnapshot, rng: Rng): CombatEvent[] => {
  const action = state.timeline.activeAction
  if (!action) return []
  const actor = unitById(state, action.actorId)
  const skill = skillById(action.skillId)
  if (!actor || !actor.alive || !skill) return []
  const events: CombatEvent[] = []
  if (skill.behavior === 'summon') {
    const summon = createSummonUnit(state, actor, skill)
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
    settleSkillStatuses(state, actor, [], skill, events)
    return events
  }
  const targets = action.targetIds
    .map((targetId) => unitById(state, targetId))
    .filter((target): target is CombatUnit => target !== undefined)
  if (targets.length > 0) {
    if (skill.behavior === 'attack') executeAttack(state, actor, skill, targets, rng, events)
    else if (skill.behavior === 'heal') executeHeal(state, actor, skill, targets, rng, events)
    else if (skill.behavior === 'shield') executeShield(state, actor, skill, targets, events)
    else if (skill.behavior === 'status') executeStatus(state, actor, skill, targets, rng, events)
    else if (skill.behavior === 'revive') executeRevive(state, actor, skill, targets, events)
    else if (skill.behavior === 'advance-gauge') executeAdvanceGauge(skill, targets)
    else if (skill.behavior === 'grant-energy') executeGrantEnergy(targets)
  }
  settleSkillStatuses(state, actor, targets, skill, events)
  settleDefeatedUnits(state, rng, events)
  settleBattleState(state, events)
  return events
}

const emitActionEffect = (state: CombatSnapshot): CombatEvent[] => {
  const action = state.timeline.activeAction
  if (!action) return []
  return [{
    type: 'skill-effect',
    atMs: state.elapsedMs,
    sourceId: action.actorId,
    skillId: action.skillId,
    targetIds: [...action.targetIds],
  }]
}

const settleBattleState = (state: CombatSnapshot, _events: CombatEvent[]): void => {
  if (state.timeline.endingTransition) return
  if (!state.party.some((unit) => unit.alive)) {
    state.timeline.phase = 'ending'
    state.timeline.readyQueue = []
    state.timeline.waveTransition = null
    state.timeline.endingTransition = {
      outcome: 'defeat',
      elapsedMs: 0,
      durationMs: ORIGINAL_SETTLEMENT_END_MS,
    }
    return
  }
  if (waveIsClear(state) && !state.timeline.waveTransition) {
    if (state.wave === 10) {
      state.timeline.phase = 'ending'
      state.timeline.readyQueue = []
      state.timeline.waveTransition = null
      state.timeline.endingTransition = {
        outcome: 'victory',
        elapsedMs: 0,
        durationMs: state.mode === 'roam' ? ORIGINAL_ROAM_VICTORY_END_MS : ORIGINAL_SETTLEMENT_END_MS,
      }
    } else {
      state.timeline.phase = 'wave-transition'
      state.timeline.waveTransition = {
        kind: 'next',
        elapsedMs: 0,
        refreshAtMs: ORIGINAL_WAVE_REFRESH_MS,
        durationMs: ORIGINAL_WAVE_TRANSITION_MS,
        refreshed: false,
      }
    }
  }
}

const startNextAction = (state: CombatSnapshot): CombatEvent[] => {
  if (state.result !== 'fighting' || state.timeline.phase !== 'accumulating') return []
  const actor = takeNextReadyActor(
    state.timeline,
    activeUnits(state),
    (unit) => unit.alive && !isControlled(unit),
  )
  return actor ? prepareAction(state, actor) : []
}

const finishActiveAction = (state: CombatSnapshot): CombatEvent[] => {
  const action = state.timeline.activeAction
  if (!action) return []
  state.timeline.activeAction = null
  state.timeline.phase = 'accumulating'
  const events: CombatEvent[] = []
  settleBattleState(state, events)
  if (state.result === 'fighting') events.push(...startNextAction(state))
  return events
}

const advanceWaveTransition = (state: CombatSnapshot, elapsedMs: number): CombatEvent[] => {
  const transition = state.timeline.waveTransition
  if (!transition) {
    state.timeline.phase = state.timeline.activeAction ? 'acting' : 'accumulating'
    return []
  }
  const events: CombatEvent[] = []
  let remainingMs = Math.max(0, elapsedMs)

  while (remainingMs > 0 && state.timeline.waveTransition) {
    const action = state.timeline.activeAction
    const transitionBoundary = transition.refreshed ? transition.durationMs : transition.refreshAtMs
    const transitionRemaining = Math.max(0, transitionBoundary - transition.elapsedMs)
    const actionRemaining = action ? Math.max(0, action.durationMs - action.elapsedMs) : Number.POSITIVE_INFINITY
    const stepMs = Math.min(remainingMs, transitionRemaining, actionRemaining)
    transition.elapsedMs += stepMs
    if (action) action.elapsedMs += stepMs
    state.elapsedMs += stepMs
    remainingMs -= stepMs

    if (action && action.elapsedMs >= action.durationMs) state.timeline.activeAction = null

    if (!transition.refreshed && transition.elapsedMs >= transition.refreshAtMs) {
      if (transition.kind === 'next') {
        state.summons = state.summons.filter((summon) => summon.side === 'party')
        advanceToNextWave(state)
      }
      transition.refreshed = true
      const activeIds = new Set(activeUnits(state).map((unit) => unit.id))
      state.timeline.readyQueue = state.timeline.readyQueue.filter((entry) => activeIds.has(entry.actorId))
      events.push({ type: 'wave-started', atMs: state.elapsedMs, wave: state.wave })
      continue
    }

    if (transition.elapsedMs >= transition.durationMs) {
      state.timeline.waveTransition = null
      state.timeline.phase = state.timeline.activeAction ? 'acting' : 'accumulating'
      if (!state.timeline.activeAction) events.push(...startNextAction(state))
      continue
    }
    if (stepMs === 0) break
  }
  return events
}

const advanceEndingTransition = (state: CombatSnapshot, elapsedMs: number): CombatEvent[] => {
  const transition = state.timeline.endingTransition
  if (!transition) return []
  const events: CombatEvent[] = []
  let remainingMs = Math.max(0, elapsedMs)

  while (remainingMs > 0 && state.timeline.endingTransition) {
    const action = state.timeline.activeAction
    const transitionRemaining = Math.max(0, transition.durationMs - transition.elapsedMs)
    const actionRemaining = action ? Math.max(0, action.durationMs - action.elapsedMs) : Number.POSITIVE_INFINITY
    const stepMs = Math.min(remainingMs, transitionRemaining, actionRemaining)
    transition.elapsedMs += stepMs
    if (action) action.elapsedMs += stepMs
    state.elapsedMs += stepMs
    remainingMs -= stepMs

    if (action && action.elapsedMs >= action.durationMs) state.timeline.activeAction = null
    if (transition.elapsedMs >= transition.durationMs) {
      state.result = transition.outcome
      state.timeline.activeAction = null
      state.timeline.readyQueue = []
      state.timeline.waveTransition = null
      state.timeline.endingTransition = null
      events.push({
        type: transition.outcome === 'victory' ? 'stage-cleared' : 'party-defeated',
        atMs: state.elapsedMs,
      })
      continue
    }
    if (stepMs === 0) break
  }
  return events
}

const advanceAccumulationStep = (state: CombatSnapshot, rng: Rng): CombatEvent[] => {
  state.elapsedMs += ORIGINAL_ACCUMULATION_STEP_MS
  const events = tickRealtime(state, rng, ORIGINAL_ACCUMULATION_STEP_MS)
  settleBattleState(state, events)
  if (state.result !== 'fighting') return events
  enqueueReadyActors(
    state.timeline,
    activeUnits(state),
    (unit) => unit.alive && !isControlled(unit),
  )
  events.push(...startNextAction(state))
  return events
}

const advanceCombat = (state: CombatSnapshot, rng: Rng, elapsedMs: number): CombatEvent[] => {
  const events: CombatEvent[] = []
  let remainingMs = Math.max(0, elapsedMs)

  while (remainingMs > 0 && state.result === 'fighting') {
    if (state.timeline.phase === 'ending') {
      const beforeMs = state.elapsedMs
      events.push(...advanceEndingTransition(state, remainingMs))
      remainingMs -= state.elapsedMs - beforeMs
      if (state.elapsedMs === beforeMs) break
      continue
    }
    if (state.timeline.phase === 'wave-transition') {
      const beforeMs = state.elapsedMs
      events.push(...advanceWaveTransition(state, remainingMs))
      remainingMs -= state.elapsedMs - beforeMs
      if (state.elapsedMs === beforeMs) break
      continue
    }
    if (state.timeline.phase === 'acting') {
      const action = state.timeline.activeAction
      if (!action) {
        state.timeline.phase = 'accumulating'
        continue
      }
      const boundaryMs = !action.effectEmitted
        ? action.effectAtMs
        : action.hitResolved
          ? action.durationMs
          : action.hitAtMs
      const stepMs = Math.min(remainingMs, Math.max(0, boundaryMs - action.elapsedMs))
      action.elapsedMs += stepMs
      state.elapsedMs += stepMs
      remainingMs -= stepMs

      if (!action.effectEmitted && action.elapsedMs >= action.effectAtMs) {
        action.effectEmitted = true
        events.push(...emitActionEffect(state))
        continue
      }
      if (!action.hitResolved && action.elapsedMs >= action.hitAtMs) {
        action.hitResolved = true
        events.push(...resolveActionHit(state, rng))
        continue
      }
      if (action.elapsedMs >= action.durationMs) {
        events.push(...finishActiveAction(state))
        continue
      }
      if (stepMs === 0) break
      continue
    }

    if (state.timeline.phase !== 'accumulating') break
    const neededMs = ORIGINAL_ACCUMULATION_STEP_MS - state.timeline.accumulationCarryMs
    const stepMs = Math.min(remainingMs, neededMs)
    state.timeline.accumulationCarryMs += stepMs
    remainingMs -= stepMs
    if (state.timeline.accumulationCarryMs >= ORIGINAL_ACCUMULATION_STEP_MS) {
      state.timeline.accumulationCarryMs = 0
      events.push(...advanceAccumulationStep(state, rng))
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
      const safeCount = Math.max(0, Math.floor(count))
      return advanceCombat(state, rng, safeCount * ORIGINAL_ACCUMULATION_STEP_MS)
    },
    advance(elapsedMs): CombatEvent[] {
      return advanceCombat(state, rng, elapsedMs)
    },
    setMode(mode): void {
      state.mode = mode
    },
    stop(): CombatEvent[] {
      if (state.result !== 'fighting') return []
      state.result = 'stopped'
      state.timeline.phase = 'ending'
      state.timeline.activeAction = null
      state.timeline.readyQueue = []
      state.timeline.waveTransition = null
      state.timeline.endingTransition = null
      return [{ type: 'combat-stopped', atMs: state.elapsedMs }]
    },
  }
}
