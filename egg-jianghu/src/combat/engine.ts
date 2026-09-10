import { buffById } from '../content/buffs'
import { ATTRIBUTES, type AttributeMap } from '../content/attributes'
import { skillById, summonById, type CombatSkillContent, type SummonUnitContent } from '../content/skills'
import type { CampaignMode } from '../domain/types'
import { calculateDamage, hitChance, rollCritical } from './damage'
import { ELEMENT_IDS, skillGroupPowerAttributeId, SX, weaponMasteryAttributeId } from './attribute-ids'
import { createRng, type Rng } from './rng'
import { selectSkill, summonLimit, selectSkillTargets, unitSkillById } from './skill-ai'
import {
  advanceStatusDurations,
  applyBuff,
  dealCombatDamage,
  expireTurnBuffs,
  pulseStatuses,
  unitAttr,
} from './statuses'
import { firstEmptySlot, formationSlot } from './targeting'
import { projectileFlightMs } from './projectiles'
import { advanceGaugeAndCooldowns, effectiveSpeed, COMBAT_TICK_MS } from './timeline'
import { calculateHealing, calculateModifiedSupportStat, calculateShield, supportBonusFactor } from './support'
import {
  createActionPlan,
  createCombatTimeline,
  consumeStatusPulse,
  enqueueReadyActors,
  ORIGINAL_PARTY_PREPARATION_MS,
  ORIGINAL_INITIAL_WAVE_REFRESH_MS,
  ORIGINAL_INITIAL_WAVE_TRANSITION_MS,
  ORIGINAL_ROAM_VICTORY_END_MS,
  ORIGINAL_SETTLEMENT_END_MS,
  ORIGINAL_WAVE_REFRESH_MS,
  ORIGINAL_WAVE_TRANSITION_MS,
  takeNextReadyActor,
} from './scheduler'
import type {
  CombatActionPlan,
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
type RefreshPartyUnit = (unit: CombatUnit) => CombatUnit | undefined

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
  if (unit.side === 'party' && !summon) {
    unit.defeatedAttributes = Object.fromEntries(ATTRIBUTES.filter(attribute => attribute.combatFlag)
      .map(attribute => [attribute.id, unitAttr(unit, attribute.id)]))
  }
  unit.alive = false
  unit.shield = 0
  unit.gauge = 0
  unit.cooldowns = {}
  unit.statuses = []
  state.timeline.readyQueue = state.timeline.readyQueue.filter((entry) => entry.actorId !== unit.id)
  events.push({ type: 'unit-defeated', atMs: state.elapsedMs, unitId: unit.id, side: unit.side, summon })
}

const settleDefeatedUnits = (state: CombatSnapshot, rng: Rng, events: CombatEvent[]): void => {
  // 原版核心阵亡按数据阵位1..30扫描；敌人数组顺序不能决定收益随机数的分配。
  const dataSlot = (unit: CombatUnit): number => formationSlot(unit) + (unit.side === 'enemy' ? 15 : 0)
  for (const unit of activeUnits(state).sort((left, right) => dataSlot(left) - dataSlot(right))) {
    markDefeated(state, unit, rng, events)
  }
  state.summons = state.summons.filter((summon) => summon.alive)
}

const advanceBattleTimers = (state: CombatSnapshot, elapsedMs: number): void => {
  const dataSlot = (unit: CombatUnit): number => formationSlot(unit) + (unit.side === 'enemy' ? 15 : 0)
  const units = activeUnits(state).sort((left, right) => dataSlot(left) - dataSlot(right))
  // 原版先让各核心按本帧开始时的状态积攒，再调用全场状态倒计时。
  for (const unit of units) if (unit.alive) {
    const queued = state.timeline.readyQueue.some(entry => entry.actorId === unit.id)
    const gauge = unit.gauge
    advanceGaugeAndCooldowns(unit, elapsedMs)
    if (queued) unit.gauge = gauge
  }
  for (const unit of units) {
    const statusCount = unit.statuses.length
    advanceStatusDurations(unit, elapsedMs)
    if (unit.statuses.length !== statusCount) refreshSummonAfterStatus(state, unit)
  }

  for (const summon of state.summons) summon.remainingMs = Math.max(0, summon.remainingMs - elapsedMs)
  state.summons = state.summons.filter((summon) => summon.remainingMs > 0 && summon.alive)
}

const pulseRealtime = (state: CombatSnapshot, rng: Rng): CombatEvent[] => {
  const events: CombatEvent[] = []
  if (consumeStatusPulse(state.timeline, state.elapsedMs)) {
    const dataSlot = (unit: CombatUnit): number => formationSlot(unit) + (unit.side === 'enemy' ? 15 : 0)
    const units = activeUnits(state).sort((left, right) => dataSlot(left) - dataSlot(right))

    // 原版按数据阵位逐个生成生命恢复弹体，再按槽位顺序生成该阵位所有持续效果弹体。
    for (const unit of units) {
      if (!unit.alive) continue
      const healed = Math.min(unit.maxHp - unit.hp, Math.max(0, Math.floor(unitAttr(unit, SX.生命恢复))))
      if (healed > 0) {
        unit.hp += healed
        events.push({ type: 'healing', atMs: state.elapsedMs, sourceId: unit.id, targetId: unit.id, amount: healed })
      }
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
  return events
}

const spendSkill = (actor: CombatUnit, skill: CombatSkillContent): void => {
  if (actor.side === 'party' && !('summonerId' in actor) && actor.offhandSoulId === 129) return
  actor.energy = Math.round(Math.min(ENERGY_CAP, Math.max(0, actor.energy - skill.energyCost)))
}

/** 原版角色行动 Wait 1.2 秒后写冷却，缩减倍率限制为5%～100%，按0.1秒取整。 */
const completeActionCooldown = (state: CombatSnapshot): void => {
  const action = state.timeline.activeAction
  if (!action) return
  const actor = unitById(state, action.actorId)
  const skill = actor ? unitSkillById(actor, action.skillId) : undefined
  if (!actor?.alive || !skill) return
  // 梵行无终只作用于我方装备者及其召唤，不跨阵营按角色编号继承。
  const equipmentOwner = 'summonerId' in actor ? unitById(state, String(actor.summonerId)) : actor
  if (actor.side === 'party' && equipmentOwner?.side === 'party' && equipmentOwner.offhandSoulId === 123) {
    actor.cooldowns[skill.id] = 0
    return
  }
  const scale = Math.min(100, Math.max(5, 100 - unitAttr(actor, SX.技能冷却))) / 100
  actor.cooldowns[skill.id] = Math.round(skill.cooldownMs * scale / 100) * 100
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
    healingStat: skill.healingStat,
    attack: skill.healingStat === 'health'
      ? modifiedCombatStat(actor, SX.生命, SX.生命上限修正, 'heal')
      : modifiedCombatStat(actor, SX.法攻, SX.法攻修正, 'heal'),
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
    refreshSummonAfterStatus(state, target)
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
  const definition = buffById(skill.selfBuffId)
  const baseDurationSeconds = Math.max(1, (definition?.durationMs ?? 1000) / 1000)
  // 自附状态同样经过原版“获得buff”的首次快照计算，例如不屈的持续恢复。
  const tickValue = definition?.tickKind === 'hot'
    ? Math.ceil(0.2 / baseDurationSeconds * skillHealingAmount(actor, actor, skill))
    : definition?.tickKind === 'dot'
      ? Math.ceil(0.2 / baseDurationSeconds * skillDamageAmount(actor, actor, skill, 1, false))
      : undefined
  const applied = applyBuff(actor, skill.selfBuffId, skill.selfBuffStacks ?? 1, actor.id, {
    // 原版自附分支无“修正>0”条件，统一读取增益时间并保留10%的时长。
    durationScale: Math.max(10, 100 + unitAttr(actor, SX.增益时间)) / 100,
    tickValue,
  })
  if (!applied) return
  refreshSummonAfterStatus(state, actor)
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
  state: CombatSnapshot,
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
      refreshSummonAfterStatus(state, holder)
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
  consumeSkillEnhancement(state, actor, targets, skill)
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
  outcomes: NonNullable<CombatActionPlan['projectileHits']>,
  events: CombatEvent[],
): void => {
  for (const target of targets) {
    if (!target.alive) continue
    const outcome = outcomes.find(hit => hit.targetId === target.id)
    if (!outcome) continue
    if (outcome.evaded) {
      events.push({ type: 'attack-missed', atMs: state.elapsedMs, sourceId: actor.id, targetId: target.id, skillId: skill.id })
      continue
    }
    const isCritical = outcome.critical
    const criticalCoeff = isCritical ? Math.max(0, unitAttr(actor, SX.暴击伤害) / 100) : 1
    const amount = skillDamageAmount(actor, target, skill, criticalCoeff, !skill.nonBasicAttack)
    const { settledAmount } = dealCombatDamage(target, amount)
    // 原版普通伤害碰撞在扣盾/扣血之后清除存活目标的全部剑势；DoT无此分支。
    if (target.hp > 0 && target.statuses.some(status => status.buffId === 21)) {
      target.statuses = target.statuses.filter(status => status.buffId !== 21)
      refreshSummonAfterStatus(state, target)
    }
    const lifeSteal = unitAttr(actor, SX.吸血)
    if (lifeSteal > 0 && actor.alive) {
      const steal = Math.ceil((settledAmount * lifeSteal) / 100)
      actor.hp = Math.min(actor.maxHp, actor.hp + steal)
    }
    events.push({
      type: 'damage',
      atMs: state.elapsedMs,
      sourceId: actor.id,
      targetId: target.id,
      amount: settledAmount,
      critical: isCritical,
      skillId: skill.id,
    })
  }
}

const executeHeal = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  targets: CombatUnit[],
  events: CombatEvent[],
): void => {
  for (const target of targets) {
    if (!target.alive) continue
    const amount = skillHealingAmount(actor, target, skill)
    const healed = Math.max(0, Math.min(target.maxHp - target.hp, amount))
    target.hp += healed
    events.push({ type: 'healing', atMs: state.elapsedMs, sourceId: actor.id, targetId: target.id, amount: healed, skillId: skill.id })
  }
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
    const cap = target.maxHp * supportBonusFactor(unitAttr(actor, SX.护盾超限))
    const nextShield = Math.floor(Math.max(0, Math.min(cap, target.shield + amount)))
    const applied = nextShield - target.shield
    target.shield = nextShield
    if (applied <= 0) continue
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

const resolveActionBuffs = (state: CombatSnapshot, rng: Rng): CombatEvent[] => {
  const action = state.timeline.activeAction
  if (!action || action.buffsResolved || action.elapsedMs < action.buffsAtMs) return []
  action.buffsResolved = true
  const actor = unitById(state, action.actorId)
  const skill = actor ? unitSkillById(actor, action.skillId) : undefined
  if (!actor || !skill) return []
  const targets = action.targetIds.map(id => unitById(state, id)).filter((unit): unit is CombatUnit => !!unit)
  const events: CombatEvent[] = []
  executeStatus(state, actor, skill, targets, rng, events)
  settleSkillStatuses(state, actor, targets, skill, events)
  return events
}

const executeRevive = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  targets: CombatUnit[],
  events: CombatEvent[],
  refreshPartyUnit?: RefreshPartyUnit,
): void => {
  for (const target of targets) {
    if (target.alive) continue
    const refreshed = target.side === 'party' ? refreshPartyUnit?.(target) : undefined
    if (refreshed) Object.assign(target, refreshed)
    const restored = Math.max(1, Math.min(target.maxHp, Math.round(target.maxHp * (skill.reviveHpPercent ?? 0) / 100)))
    target.hp = Math.min(target.maxHp, restored)
    target.instanceOrder = nextInstanceOrder(state, target.side)
    target.alive = true
    target.defeatedAttributes = undefined
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

const executeGrantEnergy = (skill: CombatSkillContent, targets: CombatUnit[]): void => {
  for (const target of targets) {
    if (!target.alive) continue
    target.energy = Math.round(Math.min(ENERGY_CAP, Math.max(0, target.energy + (skill.energyGain ?? 0))))
  }
}

const nextInstanceOrder = (state: CombatSnapshot, side: CombatUnit['side']): number =>
  1 + Math.max(0, ...activeUnits(state)
    .filter(unit => unit.side === side)
    .map(unit => unit.instanceOrder ?? unit.formationOrder))

const summonCombatAttributes = (actor: CombatUnit, definition: SummonUnitContent): AttributeMap => {
  const ownerAttribute = (id: number): number => !actor.alive && actor.defeatedAttributes
    ? actor.defeatedAttributes[id] ?? 0 : unitAttr(actor, id)
  const strength = 1 + ownerAttribute(SX.召唤强度) / 100
  const scaled = (attributeId: number, index: number, strengthened = false): number =>
    ownerAttribute(attributeId) * (strengthened
      ? Math.round(definition.coeffs[index] / 100 * strength * 100) / 100
      : definition.coeffs[index] / 100)
  return {
    ...Object.fromEntries(ATTRIBUTES.filter(attribute => attribute.combatFlag)
      .map(attribute => [attribute.id, ownerAttribute(attribute.id)])),
    [SX.生命]: scaled(SX.生命, 0, true),
    [SX.物攻]: scaled(SX.法攻, 4, true),
    [SX.法攻]: scaled(SX.法攻, 4, true),
    [SX.物防]: scaled(SX.物防, 2),
    [SX.法防]: scaled(SX.法防, 3),
    [SX.速度]: scaled(SX.速度, 5),
  }
}

/** 原版状态刷新只更新目标核心，召唤物此时才重新读取主人本场属性。 */
const refreshSummonAfterStatus = (state: CombatSnapshot, target: CombatUnit): void => {
  if (!('summonerId' in target) || !target.alive) return
  const summon = target as CombatSummon
  const skill = summon.summonSkillId === undefined ? undefined : skillById(summon.summonSkillId)
  const definition = skill?.summonId ? summonById(skill.summonId) : undefined
  const owner = state.party.find(unit => unit.id === summon.summonerId)
  if (!definition || !owner) return
  summon.attributes = summonCombatAttributes(owner, definition)
  // 自身buff由unitAttr聚合一次，原版刷新模式不再对生命取整。
  summon.maxHp = unitAttr(summon, SX.生命)
  summon.hp = Math.min(summon.hp, summon.maxHp)
  summon.externalAttack = unitAttr(summon, SX.物攻)
  summon.internalAttack = unitAttr(summon, SX.法攻)
  summon.externalDefense = unitAttr(summon, SX.物防)
  summon.internalDefense = unitAttr(summon, SX.法防)
  summon.effectiveAgility = unitAttr(summon, SX.速度)
}

const createSummonUnit = (
  state: CombatSnapshot,
  actor: CombatUnit,
  skill: CombatSkillContent,
  refreshPartyUnit?: RefreshPartyUnit,
): CombatSummon | null => {
  if (!skill.summonId) return null
  const definition = summonById(skill.summonId)
  if (!definition) return null
  const allies = alliesOf(state, actor)
  const ownedSummons = state.summons.filter(summon => summon.alive && summon.summonerId === actor.id)
  // 自动目标满额时指向存活召唤物；特殊机制先检查目标格无角色且未存活，故该次不生成。
  // 原版另有手动选择空格后替换最短寿命召唤物的分支，当前没有手动施法入口。
  if (actor.side === 'party' && ownedSummons.length >= summonLimit(actor)) return null
  const slot = firstEmptySlot(allies)
  if (!slot) return null
  // 原版核心生命/持续时间读取主人当前永久属性；战斗数组则读取主人本场zdls。
  const permanent = refreshPartyUnit?.(actor)?.attributes ?? actor.attributes
  const permanentHealthCoefficient = Math.round(definition.coeffs[0] / 100
    * (1 + (permanent[SX.召唤强度] ?? 0) / 100) * 100) / 100
  const maxHp = Math.round((permanent[SX.生命] ?? actor.maxHp) * permanentHealthCoefficient)
  const durationMs = Math.round(definition.durationMs / 1000 * (1 + (permanent[SX.召唤时间] ?? 0) / 100)) * 1000
  const attributes = summonCombatAttributes(actor, definition)
  const id = `summon_${definition.id}_${state.elapsedMs}_${state.summons.length}`
  const summon: CombatSummon = {
    id,
    name: definition.name,
    side: actor.side,
    row: slot.row,
    col: slot.col,
    formationOrder: (actor.side === 'party' ? 100 : 200) + slot.row * 5 + slot.col,
    instanceOrder: nextInstanceOrder(state, actor.side),
    rank: 'normal',
    alive: true,
    hp: maxHp,
    maxHp,
    shield: 0,
    energy: 0,
    maxEnergy: ENERGY_CAP,
    gauge: 0,
    effectiveAgility: attributes[SX.速度],
    externalAttack: attributes[SX.物攻],
    internalAttack: attributes[SX.法攻],
    externalDefense: attributes[SX.物防],
    internalDefense: attributes[SX.法防],
    accuracy: unitAttr(actor, SX.命中修正) / 100,
    evade: unitAttr(actor, SX.闪避修正) / 100,
    criticalChance: unitAttr(actor, SX.暴击几率) / 100,
    criticalMultiplier: unitAttr(actor, SX.暴击伤害) / 100,
    controlResistance: actor.controlResistance,
    cooldowns: {},
    statuses: [],
    skillIds: [],
    baseAttackId: definition.baseAttackId,
    skillLevels: { [definition.baseAttackId]: skill.effectiveLevel ?? 1 },
    summonerId: actor.id,
    summonSkillId: skill.id,
    // 原版召唤数据行0保留主人角色编号，职业系数和主手熟练仍查主人的存档。
    careerCoefficients: actor.careerCoefficients,
    mainhandWeaponType: actor.mainhandWeaponType,
    remainingMs: durationMs,
    attributes,
  }
  return summon
}

const unitById = (state: CombatSnapshot, id: string): CombatUnit | undefined =>
  activeUnits(state).find((unit) => unit.id === id)

const prepareAction = (state: CombatSnapshot, actor: CombatUnit, rng: Rng, refreshPartyUnit?: RefreshPartyUnit): CombatEvent[] => {
  const events: CombatEvent[] = []
  actor.gauge = 0
  const statusCount = actor.statuses.length
  expireTurnBuffs(actor)
  if (actor.statuses.length !== statusCount) refreshSummonAfterStatus(state, actor)
  actor.energy = Math.round(Math.min(ENERGY_CAP, Math.max(0, actor.energy + unitAttr(actor, SX.能量回复))))
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
  // 技能释放核心直接调用回能/推进度；256同时回能，257/258另有延迟治疗弹体。
  if (skill.behavior === 'grant-energy' || skill.id === 256) executeGrantEnergy(skill, targets)
  if (skill.behavior === 'advance-gauge') executeAdvanceGauge(skill, targets)
  // 特殊技能机制由角色行动直接调用，没有常规弹体分支的Wait 0.3。
  if (skill.specialMechanic) {
    state.timeline.activeAction.hitAtMs = 0
    events.push(...resolveActionHit(state, rng, refreshPartyUnit))
  }
  return events
}

const resolveActionHit = (state: CombatSnapshot, rng: Rng, refreshPartyUnit?: RefreshPartyUnit): CombatEvent[] => {
  const action = state.timeline.activeAction
  if (!action) return []
  action.hitResolved = true
  const actor = unitById(state, action.actorId)
  const skill = actor ? unitSkillById(actor, action.skillId) : undefined
  if (!actor || !actor.alive || !skill) return []
  const events: CombatEvent[] = []
  if (skill.behavior === 'summon') {
    const summon = createSummonUnit(state, actor, skill, refreshPartyUnit)
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
    return events
  }
  const targets = action.targetIds
    .map((targetId) => unitById(state, targetId))
    .filter((target): target is CombatUnit => target !== undefined)
  if (targets.length > 0) {
    if (skill.behavior === 'attack') {
      if (!action.projectileHits) {
        action.projectileHits = targets.filter(target => target.alive).map(target => ({
          targetId: target.id,
          atMs: 300 + (skill.originalBehavior === '远程攻击' ? projectileFlightMs(actor, target) : 0),
          critical: rollCritical(unitAttr(actor, SX.暴击几率), unitAttr(actor, SX.暴击伤害), rng.nextFloat()).isCritical,
          evaded: rng.nextFloat() > hitChance(unitAttr(target, SX.闪避修正), unitAttr(actor, SX.命中修正)),
        }))
      }
      const due = action.projectileHits.filter(hit => hit.atMs <= action.elapsedMs)
      executeAttack(state, actor, skill, targets.filter(target => due.some(hit => hit.targetId === target.id)), due, events)
      action.projectileHits = action.projectileHits.filter(hit => hit.atMs > action.elapsedMs)
      action.hitResolved = action.projectileHits.length === 0
      if (!action.hitResolved) action.hitAtMs = Math.min(...action.projectileHits.map(hit => hit.atMs))
    }
    else if (skill.behavior === 'heal' || skill.id === 257 || skill.id === 258) executeHeal(state, actor, skill, targets, events)
    else if (skill.behavior === 'shield') executeShield(state, actor, skill, targets, events)
    else if (skill.behavior === 'revive') executeRevive(state, actor, skill, targets, events, refreshPartyUnit)
    if (skill.specialMechanic === 1) {
      // 原版清心按“数据阵位号”（施法者）抽取一种减益并清除全部层数。
      for (const target of targets) {
        if (!target.alive) continue
        const candidates = actor.statuses.filter(status => buffById(status.buffId)?.polarity === 'debuff')
        if (!candidates.length) break
        const chosen = candidates[rng.nextInt(0, candidates.length)]
        actor.statuses = actor.statuses.filter(status => status !== chosen)
        refreshSummonAfterStatus(state, actor)
      }
    }
  }
  // 原版核心阵亡唯一调用受 !角色行动 限制；命中归零后仍保留核心，直到行动结束。
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

const startNextAction = (state: CombatSnapshot, rng: Rng, refreshPartyUnit?: RefreshPartyUnit): CombatEvent[] => {
  if (state.result !== 'fighting' || state.timeline.phase !== 'accumulating') return []
  if (state.elapsedMs < (state.timeline.resumeAtMs ?? 0)) return []
  const actor = takeNextReadyActor(
    state.timeline,
    activeUnits(state),
    // 原版控制只影响速度积攒，已获得的行动权重不另做控制状态拦截。
    (unit) => unit.alive,
  )
  if (!actor) return []
  if (actor.side === 'party') {
    state.timeline.pendingAction = { actorId: actor.id, remainingMs: ORIGINAL_PARTY_PREPARATION_MS }
    state.timeline.phase = 'preparing'
    return []
  }
  return prepareAction(state, actor, rng, refreshPartyUnit)
}

const finishActiveAction = (state: CombatSnapshot, rng: Rng, refreshPartyUnit?: RefreshPartyUnit): CombatEvent[] => {
  const action = state.timeline.activeAction
  if (!action) return []
  completeActionCooldown(state)
  state.timeline.activeAction = null
  state.timeline.resumeAtMs = state.elapsedMs + 500
  state.timeline.phase = 'accumulating'
  const events: CombatEvent[] = []
  settleDefeatedUnits(state, rng, events)
  settleBattleState(state, events)
  if (state.result === 'fighting') events.push(...startNextAction(state, rng, refreshPartyUnit))
  return events
}

const advanceWaveTransition = (state: CombatSnapshot, rng: Rng, elapsedMs: number, refreshPartyUnit?: RefreshPartyUnit): CombatEvent[] => {
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
    const actionRemaining = action ? Math.max(0, (action.buffsResolved ? action.durationMs : action.buffsAtMs) - action.elapsedMs) : Number.POSITIVE_INFINITY
    const stepMs = Math.min(remainingMs, transitionRemaining, actionRemaining)
    transition.elapsedMs += stepMs
    if (action) action.elapsedMs += stepMs
    state.elapsedMs += stepMs
    remainingMs -= stepMs

    events.push(...resolveActionBuffs(state, rng))
    if (action && action.elapsedMs >= action.durationMs) {
      completeActionCooldown(state)
      state.timeline.activeAction = null
    }

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
      if (!state.timeline.activeAction) events.push(...startNextAction(state, rng, refreshPartyUnit))
      continue
    }
    if (stepMs === 0) break
  }
  return events
}

const advanceEndingTransition = (state: CombatSnapshot, rng: Rng, elapsedMs: number): CombatEvent[] => {
  const transition = state.timeline.endingTransition
  if (!transition) return []
  const events: CombatEvent[] = []
  let remainingMs = Math.max(0, elapsedMs)

  while (remainingMs > 0 && state.timeline.endingTransition) {
    const action = state.timeline.activeAction
    const transitionRemaining = Math.max(0, transition.durationMs - transition.elapsedMs)
    const actionRemaining = action ? Math.max(0, (action.buffsResolved ? action.durationMs : action.buffsAtMs) - action.elapsedMs) : Number.POSITIVE_INFINITY
    const stepMs = Math.min(remainingMs, transitionRemaining, actionRemaining)
    transition.elapsedMs += stepMs
    if (action) action.elapsedMs += stepMs
    state.elapsedMs += stepMs
    remainingMs -= stepMs

    events.push(...resolveActionBuffs(state, rng))
    if (action && action.elapsedMs >= action.durationMs) {
      completeActionCooldown(state)
      state.timeline.activeAction = null
    }
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

const advanceAccumulationStep = (state: CombatSnapshot, rng: Rng, elapsedMs: number, refreshPartyUnit?: RefreshPartyUnit): CombatEvent[] => {
  state.elapsedMs += elapsedMs
  const events: CombatEvent[] = []
  advanceBattleTimers(state, elapsedMs)
  settleBattleState(state, events)
  if (state.result !== 'fighting') return events
  enqueueReadyActors(
    state.timeline,
    activeUnits(state),
    (unit) => unit.alive,
  )
  events.push(...startNextAction(state, rng, refreshPartyUnit))
  // 原版事件表先行动积攒，再Every持续效果；已经起手时后者受战斗暂停拦截。
  if (state.timeline.phase === 'accumulating' && !state.timeline.activeAction) {
    events.push(...pulseRealtime(state, rng))
    settleBattleState(state, events)
  }
  return events
}

const nextAccumulationBoundary = (state: CombatSnapshot, remainingMs: number): number => {
  let stepMs = remainingMs
  const queued = new Set(state.timeline.readyQueue.map(entry => entry.actorId))
  for (const unit of activeUnits(state)) {
    if (!unit.alive) continue
    const speed = effectiveSpeed(unit)
    if (!queued.has(unit.id) && speed > 0) stepMs = Math.min(stepMs, Math.max(0, (1000 - unit.gauge) * 50 / Math.sqrt(speed)))
    unit.statuses.forEach((status) => {
      if (buffById(status.buffId)?.unit === 'time' && status.remainingMs > 0) stepMs = Math.min(stepMs, status.remainingMs)
    })
  }
  for (const summon of state.summons) if (summon.remainingMs > 0) stepMs = Math.min(stepMs, summon.remainingMs)
  const untilPulse = state.timeline.lastStatusPulseAtMs + 1000 - state.elapsedMs
  if (untilPulse > 0) stepMs = Math.min(stepMs, untilPulse)
  return stepMs
}

const advanceCombat = (state: CombatSnapshot, rng: Rng, elapsedMs: number, refreshPartyUnit?: RefreshPartyUnit): CombatEvent[] => {
  const events: CombatEvent[] = []
  let remainingMs = Math.max(0, elapsedMs)

  while (remainingMs > 0 && state.result === 'fighting') {
    if (state.timeline.phase === 'preparing') {
      const pending = state.timeline.pendingAction
      if (!pending) { state.timeline.phase = 'accumulating'; continue }
      const stepMs = Math.min(remainingMs, pending.remainingMs)
      pending.remainingMs -= stepMs
      state.elapsedMs += stepMs
      remainingMs -= stepMs
      if (pending.remainingMs <= 1e-8) {
        state.timeline.pendingAction = null
        state.timeline.phase = 'accumulating'
        const actor = unitById(state, pending.actorId)
        if (actor?.alive) events.push(...prepareAction(state, actor, rng, refreshPartyUnit))
      }
      continue
    }
    if (state.timeline.phase === 'ending') {
      const beforeMs = state.elapsedMs
      events.push(...advanceEndingTransition(state, rng, remainingMs))
      remainingMs -= state.elapsedMs - beforeMs
      if (state.elapsedMs === beforeMs) break
      continue
    }
    if (state.timeline.phase === 'wave-transition') {
      const beforeMs = state.elapsedMs
      events.push(...advanceWaveTransition(state, rng, remainingMs, refreshPartyUnit))
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
      const boundaryMs = Math.min(
        action.effectEmitted ? Infinity : action.effectAtMs,
        action.hitResolved ? Infinity : action.hitAtMs,
        action.buffsResolved ? Infinity : action.buffsAtMs,
        action.durationMs,
      )
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
        events.push(...resolveActionHit(state, rng, refreshPartyUnit))
        continue
      }
      if (!action.buffsResolved && action.elapsedMs >= action.buffsAtMs) {
        events.push(...resolveActionBuffs(state, rng))
        continue
      }
      if (action.elapsedMs >= action.durationMs) {
        events.push(...finishActiveAction(state, rng, refreshPartyUnit))
        continue
      }
      if (stepMs === 0) break
      continue
    }

    if (state.timeline.phase !== 'accumulating') break
    const pauseRemainingMs = (state.timeline.resumeAtMs ?? 0) - state.elapsedMs
    if (pauseRemainingMs > 0) {
      const stepMs = Math.min(remainingMs, pauseRemainingMs)
      state.elapsedMs += stepMs
      remainingMs -= stepMs
      if (state.elapsedMs >= state.timeline.resumeAtMs!) events.push(...startNextAction(state, rng, refreshPartyUnit))
      continue
    }
    enqueueReadyActors(state.timeline, activeUnits(state), unit => unit.alive)
    events.push(...startNextAction(state, rng, refreshPartyUnit))
    if (state.timeline.phase !== 'accumulating') continue
    if (state.elapsedMs >= state.timeline.lastStatusPulseAtMs + 1000) {
      events.push(...pulseRealtime(state, rng))
      settleBattleState(state, events)
      if (state.timeline.phase !== 'accumulating') continue
    }
    const stepMs = nextAccumulationBoundary(state, remainingMs)
    if (stepMs <= 0) break
    remainingMs -= stepMs
    events.push(...advanceAccumulationStep(state, rng, stepMs, refreshPartyUnit))
  }
  return events
}

export const createCombatEngine = (input: CombatStartInput, refreshPartyUnit?: RefreshPartyUnit): CombatEngine => {
  const state = createCombatSnapshot(input)
  const rng = createRng(input.seed)
  return {
    state,
    tick(count = 1): CombatEvent[] {
      const safeCount = Math.max(0, Math.floor(count))
      return advanceCombat(state, rng, safeCount * COMBAT_TICK_MS, refreshPartyUnit)
    },
    advance(elapsedMs): CombatEvent[] {
      return advanceCombat(state, rng, elapsedMs, refreshPartyUnit)
    },
    setMode(mode): void {
      state.mode = mode
    },
    stop(): CombatEvent[] {
      if (state.result !== 'fighting') return []
      state.result = 'stopped'
      state.timeline.phase = 'ending'
      state.timeline.activeAction = null
      state.timeline.pendingAction = null
      state.timeline.readyQueue = []
      state.timeline.waveTransition = null
      state.timeline.endingTransition = null
      return [{ type: 'combat-stopped', atMs: state.elapsedMs }]
    },
  }
}
