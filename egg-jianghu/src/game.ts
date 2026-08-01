import {
  BONDS,
  COMBOS,
  HEROES,
  MARTIALS,
  MYSTERY_BLESSINGS,
  MYSTERY_ENCOUNTERS,
  REGIONS,
  enemyTraitById,
  heroById,
  martialById,
  mysteryBlessingById,
  nextRegionAfter,
  regionById,
} from './data'
import {
  createLearnedMartial,
  emptyEquippedMartialIds,
  formatMartialPassive,
  getLearnedMartialRank,
  getMartialRefund,
  getPassiveBonuses,
} from './martials'
import type {
  ActionResult,
  CombatStatus,
  CombatStatusId,
  CombatHeroState,
  CombatEvent,
  CombatState,
  FormationPosition,
  FormationRow,
  FormationSummary,
  GameState,
  HeroProgress,
  HeroStats,
  EquippedMartialIds,
  MartialDefinition,
  MysteryBlessingEffectType,
  MysteryBlessingId,
  MysteryEncounterDefinition,
  PartySynergy,
  RegionDefinition,
  RegionId,
  Resources,
  Sect,
} from './types'

const MAX_LOGS = 36
export const MAX_FORMATION_ROW_SIZE = 3
export const FRONT_ATTACK_MULTIPLIER = 0.9
export const FRONT_DAMAGE_TAKEN_MULTIPLIER = 0.8
export const BACK_ATTACK_MULTIPLIER = 1.15
/** 每小关需清剿的敌人数，达标后判定通关并解锁下一小关 */
export const KILLS_PER_STAGE = 10
/** 每个大区域包含的小关卡数 */
export const STAGES_PER_REGION = 10
const emptyHeroProgress = (unlocked: boolean, martialId: string | null): HeroProgress => ({
  unlocked,
  level: 1,
  learnedMartials: martialId ? { [martialId]: createLearnedMartial() } : {},
  equippedMartialIds: martialId ? [martialId, null, null, null] : emptyEquippedMartialIds(),
})

export function createInitialState(now = Date.now()): GameState {
  const startingMartials = MARTIALS.filter((martial) => martial.initial).map((martial) => martial.id)
  const heroes = Object.fromEntries(
    HEROES.map((hero, index) => [
      hero.id,
      emptyHeroProgress(hero.initial, hero.initial ? startingMartials[index % startingMartials.length] : null),
    ]),
  )

  const state: GameState = {
    version: 9,
    resources: { silver: 180, experience: 90, pages: 15, reputation: 0 },
    heroes,
    unlockedMartials: startingMartials,
    formation: HEROES.filter((hero) => hero.initial).slice(0, 3).map((hero, index) => ({
      heroId: hero.id,
      row: index < 2 ? 'front' : 'back',
      position: index < 2 ? index as FormationPosition : 0,
    })),
    selectedRegionId: REGIONS[0].id,
    defeatedBossIds: [],
    regionDefeats: {
      bluestone_path: 0,
      blackwind_fort: 0,
      frost_temple: 0,
    },
    regionCleared: {
      bluestone_path: 0,
      blackwind_fort: 0,
      frost_temple: 0,
    },
    mystery: { runsCompleted: 0, bestFloor: 0, run: null },
    combat: {} as CombatState,
    statistics: {
      idleEnemiesDefeated: 0,
      challengesWon: 0,
      silverEarned: 0,
    },
    lastTickAt: now,
    lastSavedAt: now,
  }
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', '山雨初歇，三位少侠整装待发，请先选择关卡。')
  return state
}

export function getSelectedRegion(state: GameState): RegionDefinition {
  return regionById(state.selectedRegionId) ?? REGIONS[0]
}

export function isRegionUnlocked(state: GameState, regionId: string): boolean {
  const region = regionById(regionId)
  return Boolean(region && (region.requiredBossId === null || state.defeatedBossIds.includes(region.requiredBossId)))
}

export function getHeroStats(state: GameState, heroId: string): HeroStats {
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  if (!hero || !progress) {
    return { attack: 0, defense: 0, hp: 0, power: 0, affinityText: '无' }
  }

  const passive = getPassiveBonuses(progress.learnedMartials)
  const level = progress.level
  const attack = Math.round((hero.baseAttack + (level - 1) * 3.2) * (1 + passive.attack))
  const defense = Math.round((hero.baseDefense + (level - 1) * 1.9) * (1 + passive.defense))
  const hp = Math.round((hero.baseHp + (level - 1) * 15) * (1 + passive.hp))
  const learnedCount = Object.keys(progress.learnedMartials).length

  return {
    attack,
    defense,
    hp,
    power: attack * 3 + defense * 2 + Math.round(hp / 3),
    affinityText: `已学 ${learnedCount} 门；主动武功按各自五行与刚柔相性结算`,
  }
}

export const getActiveBonds = (state: GameState) => {
  const heroIds = state.formation.map((slot) => slot.heroId)
  return BONDS.filter((bond) => bond.heroIds.every((heroId) => heroIds.includes(heroId)))
}

export const getActiveCombos = (state: GameState) => {
  const heroIds = state.formation.map((slot) => slot.heroId)
  return COMBOS.filter((combo) => combo.heroIds.every((heroId) => heroIds.includes(heroId)))
}

export function getMysteryChoices(seed: number, floor: number): MysteryBlessingId[] {
  const length = MYSTERY_BLESSINGS.length
  const firstIndex = Math.abs(Math.floor(seed + floor * 7)) % length
  let secondIndex = Math.abs(Math.floor(seed * 3 + floor * 11 + 2)) % length
  if (secondIndex === firstIndex) secondIndex = (secondIndex + 1) % length
  return [MYSTERY_BLESSINGS[firstIndex].id, MYSTERY_BLESSINGS[secondIndex].id]
}

export const getMysteryBonusValue = (state: GameState, type: MysteryBlessingEffectType): number =>
  (state.mystery.run?.blessingIds ?? [])
    .map((id) => mysteryBlessingById(id))
    .filter((blessing) => blessing?.effect.type === type)
    .reduce((total, blessing) => total + (blessing?.effect.value ?? 0), 0)

export function getPartySynergy(state: GameState): PartySynergy {
  const sectCounts = new Map<Sect, number>()
  const heroIds = state.formation.map((slot) => slot.heroId)
  for (const heroId of heroIds) {
    const hero = heroById(heroId)
    if (hero) sectCounts.set(hero.sect, (sectCounts.get(hero.sect) ?? 0) + 1)
  }
  const strongest = [...sectCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const sectName = strongest && strongest[1] >= 2 ? strongest[0] : null
  const sectCount = sectName ? strongest[1] : 0
  const sectMultiplier = sectCount >= 3 ? 1.25 : sectCount >= 2 ? 1.12 : 1
  const activeBonds = getActiveBonds(state)
  const activeCombos = getActiveCombos(state)
  const bondValue = (type: (typeof BONDS)[number]['effect']['type']): number => activeBonds
    .filter((bond) => bond.effect.type === type)
    .reduce((total, bond) => total + bond.effect.value, 0)
  const mysteryActive = state.combat.mode === 'mystery'
  const mysteryValue = (type: MysteryBlessingEffectType): number => mysteryActive ? getMysteryBonusValue(state, type) : 0
  const attackMultiplier = sectMultiplier * (1 + bondValue('attack')) * (1 + mysteryValue('attack'))

  return {
    attackMultiplier,
    damageTakenMultiplier: Math.max(0.35, 1 - bondValue('damage_reduction') - mysteryValue('damage_reduction')),
    healingMultiplier: 1 + bondValue('healing') + mysteryValue('healing'),
    skillCooldownReduction: Math.floor(bondValue('skill_haste') + mysteryValue('skill_haste')),
    sectName,
    sectCount,
    sectText: sectName
      ? `${sectName}同门 ${sectCount} 人，门派攻势 +${Math.round((sectMultiplier - 1) * 100)}%`
      : '队伍中尚无两位同门',
    activeBondIds: activeBonds.map((bond) => bond.id),
    activeComboIds: activeCombos.map((combo) => combo.id),
  }
}

export function getFormationSummary(state: GameState): FormationSummary {
  const frontCount = state.formation.filter((slot) => slot.row === 'front').length
  const backCount = state.formation.length - frontCount
  return frontCount >= 2
    ? {
        frontCount,
        backCount,
        name: '磐石阵',
        effectText: '双前排优先承伤且各减伤 20%，后排侠客造成伤害 +15%。',
      }
    : {
        frontCount,
        backCount,
        name: '雁行阵',
        effectText: '单前排独自护阵，双后排侠客造成伤害 +15%，攻势更强但前排压力更大。',
      }
}

const attackMultiplierForRow = (row: FormationRow): number =>
  row === 'front' ? FRONT_ATTACK_MULTIPLIER : BACK_ATTACK_MULTIPLIER

export function getPartyPower(state: GameState): number {
  const synergy = getPartySynergy(state)
  return Math.round(
    state.formation.reduce((total, slot) => {
      const stats = getHeroStats(state, slot.heroId)
      const positionedPower = stats.power + Math.round(stats.attack * 3 * (attackMultiplierForRow(slot.row) - 1))
      return total + positionedPower
    }, 0) * synergy.attackMultiplier,
  )
}

const createCombatParty = (state: GameState): CombatHeroState[] => state.formation.map((slot) => {
  const maxHp = getHeroStats(state, slot.heroId).hp
  const martialCooldowns = Object.fromEntries(
    state.heroes[slot.heroId].equippedMartialIds
      .filter((id): id is string => Boolean(id))
      .map((id) => [id, 0]),
  )
  return { ...slot, hp: maxHp, maxHp, martialCooldowns, statuses: [] }
})

function createIdleCombat(state: GameState, stage: number | null = null, fighting = false, stageKills = 0): CombatState {
  const region = getSelectedRegion(state)
  const stageNumber = stage ?? 1
  const enemy = region.enemies[(stageNumber - 1) % region.enemies.length]
  const tier = stageNumber - 1
  const enemyMaxHp = Math.round(enemy.baseHp * (1 + tier * 0.08))
  return {
    mode: 'idle',
    status: fighting ? 'fighting' : 'ready',
    regionId: region.id,
    stage,
    enemyId: enemy.id,
    enemyTraitId: enemy.traitId,
    boss: false,
    enemyName: enemy.name,
    enemyHp: enemyMaxHp,
    enemyMaxHp,
    enemyAttack: enemy.baseAttack + tier * 2,
    enemyStatuses: [],
    partyMembers: createCombatParty(state),
    comboIndex: 0,
    turnIndex: 0,
    round: 0,
    stageKills,
    logs: [],
    lastEvent: null,
  }
}

function createChallengeCombat(state: GameState, region: RegionDefinition): CombatState {
  const boss = region.boss
  return {
    mode: 'challenge',
    status: 'fighting',
    regionId: region.id,
    stage: null,
    enemyId: boss.id,
    enemyTraitId: boss.traitId,
    boss: true,
    enemyName: boss.name,
    enemyHp: boss.baseHp,
    enemyMaxHp: boss.baseHp,
    enemyAttack: boss.baseAttack,
    enemyStatuses: [],
    partyMembers: createCombatParty(state),
    comboIndex: 0,
    turnIndex: 0,
    round: 0,
    stageKills: 0,
    logs: [],
    lastEvent: null,
  }
}

function createMysteryCombat(state: GameState, encounter: MysteryEncounterDefinition): CombatState {
  const hpMultiplier = 1 + getMysteryBonusValue(state, 'max_hp')
  const partyMembers = createCombatParty(state).map((member) => {
    const maxHp = Math.round(member.maxHp * hpMultiplier)
    return { ...member, hp: maxHp, maxHp }
  })
  return {
    mode: 'mystery',
    status: 'fighting',
    regionId: state.selectedRegionId,
    stage: null,
    enemyId: encounter.id,
    enemyTraitId: encounter.traitId,
    boss: encounter.boss,
    enemyName: encounter.name,
    enemyHp: encounter.baseHp,
    enemyMaxHp: encounter.baseHp,
    enemyAttack: encounter.baseAttack,
    enemyStatuses: [],
    partyMembers,
    comboIndex: 0,
    turnIndex: 0,
    round: 0,
    stageKills: 0,
    logs: [],
    lastEvent: null,
  }
}

function addLog(
  combat: CombatState,
  kind: CombatEvent['kind'],
  text: string,
  details: Pick<CombatEvent, 'actorId' | 'targetId' | 'amount' | 'abilityId'> = {},
): CombatEvent {
  const lastId = combat.logs.at(-1)?.id ?? 0
  const event: CombatEvent = { id: lastId + 1, kind, text, ...details }
  combat.logs = [...combat.logs.slice(-(MAX_LOGS - 1)), event]
  combat.lastEvent = event
  return event
}

function rewardIdleVictory(state: GameState): void {
  const region = getSelectedRegion(state)
  const stage = state.combat.stage ?? 1
  const defeated = state.regionDefeats[region.id]
  const nextDefeated = defeated + 1
  const tier = stage - 1
  const silver = Math.round((12 + tier * 2) * region.rewardMultipliers.silver)
  const experience = Math.round((9 + Math.floor(nextDefeated / 10)) * region.rewardMultipliers.experience)
  const pagesBefore = Math.floor((defeated / 4) * region.rewardMultipliers.pages)
  const pagesAfter = Math.floor((nextDefeated / 4) * region.rewardMultipliers.pages)
  const pages = pagesAfter - pagesBefore
  state.resources.silver += silver
  state.resources.experience += experience
  state.resources.pages += pages
  state.regionDefeats[region.id] = nextDefeated
  state.statistics.idleEnemiesDefeated += 1
  state.statistics.silverEarned += silver

  // 小关递进：当前关累计击杀达标后判定通关并解锁下一小关
  const nextStageKills = (state.combat.stageKills ?? 0) + 1
  const reached = nextStageKills >= KILLS_PER_STAGE
  let unlockNote = ''
  if (reached && stage > (state.regionCleared[region.id] ?? 0)) {
    state.regionCleared[region.id] = Math.min(STAGES_PER_REGION, Math.max(state.regionCleared[region.id] ?? 0, stage))
    unlockNote = stage >= STAGES_PER_REGION
      ? '全部小关已通关，可前往「战斗」页挑战守关 BOSS。'
      : `第 ${stage} 关已通关，解锁第 ${stage + 1} 关。`
  }

  const oldLogs = state.combat.logs
  const next = createIdleCombat(state, stage, true, reached ? 0 : nextStageKills)
  next.logs = oldLogs
  state.combat = next
  addLog(
    state.combat,
    'reward',
    `肃清${region.name}一路敌手，获得 ${silver} 银两、${experience} 阅历${pages ? `、${pages} 残页` : ''}。${unlockNote ? ` ${unlockNote}` : ''}`,
  )
}

function rewardChallengeVictory(state: GameState): void {
  const region = regionById(state.combat.regionId) ?? getSelectedRegion(state)
  const rewards = region.boss.rewards
  const firstClear = !state.defeatedBossIds.includes(region.boss.id)
  state.resources.silver += rewards.silver
  state.resources.experience += rewards.experience
  state.resources.pages += rewards.pages
  state.resources.reputation += rewards.reputation
  state.statistics.silverEarned += rewards.silver
  state.statistics.challengesWon += 1
  if (firstClear) state.defeatedBossIds.push(region.boss.id)
  state.combat.status = 'victory'
  const unlockedRegion = firstClear ? nextRegionAfter(region.id) : undefined
  addLog(
    state.combat,
    'victory',
    `击败${region.boss.name}！声望 +${rewards.reputation}${unlockedRegion ? `，新区域「${unlockedRegion.name}」已经解锁` : firstClear ? '，此地强敌已尽数折服' : '，再次夺得战利品'}。`,
  )
}

function rewardMysteryVictory(state: GameState): void {
  const run = state.mystery.run
  const encounter = run ? MYSTERY_ENCOUNTERS[run.floor] : undefined
  if (!run || !encounter) return
  const multiplier = 1 + getMysteryBonusValue(state, 'rewards')
  const rewards = {
    silver: Math.round(encounter.rewards.silver * multiplier),
    experience: Math.round(encounter.rewards.experience * multiplier),
    pages: Math.round(encounter.rewards.pages * multiplier),
    reputation: Math.round(encounter.rewards.reputation * multiplier),
  }
  state.resources.silver += rewards.silver
  state.resources.experience += rewards.experience
  state.resources.pages += rewards.pages
  state.resources.reputation += rewards.reputation
  state.statistics.silverEarned += rewards.silver
  run.earned.silver += rewards.silver
  run.earned.experience += rewards.experience
  run.earned.pages += rewards.pages
  run.earned.reputation += rewards.reputation
  run.floor += 1
  state.mystery.bestFloor = Math.max(state.mystery.bestFloor, run.floor)
  state.combat.status = 'victory'

  if (run.floor >= MYSTERY_ENCOUNTERS.length) {
    run.status = 'completed'
    run.choiceIds = []
    state.mystery.runsCompleted += 1
    addLog(state.combat, 'victory', `问鼎秘境！击败${encounter.name}，本轮共带回 ${run.earned.silver} 银两、${run.earned.pages} 残页与 ${run.earned.reputation} 声望。`)
    return
  }

  run.status = 'choosing'
  run.choiceIds = getMysteryChoices(run.seed, run.floor)
  addLog(state.combat, 'victory', `击败${encounter.name}，秘境第 ${run.floor} 层已经肃清，前方岔路再次显现。`)
}

function resolveCombatVictory(state: GameState): void {
  if (state.combat.mode === 'challenge') rewardChallengeVictory(state)
  else if (state.combat.mode === 'mystery') rewardMysteryVictory(state)
  else rewardIdleVictory(state)
}

function getEnemyTraitAttackMultiplier(
  combat: CombatState,
  member: CombatHeroState,
  martial?: MartialDefinition,
): number {
  if (combat.enemyTraitId === 'iron_armor') return member.row === 'back' ? 1.25 : 0.65
  if (combat.enemyTraitId === 'frost_aura') return martial?.element === '火' ? 1.55 : 0.72
  return 1
}

const describeTraitAdjustment = (multiplier: number): string =>
  multiplier > 1 ? '，克制生效' : multiplier < 1 ? '，受敌方特性压制' : ''

export const COMBAT_STATUS_NAMES: Record<CombatStatusId, string> = {
  burn: '灼伤',
  slow: '迟滞',
  sunder: '破甲',
  guard: '护体',
}

const statusById = (statuses: CombatStatus[], id: CombatStatusId): CombatStatus | undefined =>
  statuses.find((status) => status.id === id)

function applyStatus(
  statuses: CombatStatus[],
  id: CombatStatusId,
  turns: number,
  value: number,
  sourceId?: string,
): void {
  const current = statusById(statuses, id)
  if (current) {
    current.turns = Math.max(current.turns, turns)
    current.value = Math.max(current.value, value)
    current.sourceId = sourceId ?? current.sourceId
    return
  }
  statuses.push({ id, turns, value, sourceId })
}

const tickStatuses = (statuses: CombatStatus[]): void => {
  for (const status of statuses) status.turns -= 1
  for (let index = statuses.length - 1; index >= 0; index -= 1) {
    if (statuses[index].turns <= 0 || statuses[index].value <= 0) statuses.splice(index, 1)
  }
}

const getEnemyVulnerabilityMultiplier = (combat: CombatState): number =>
  1 + (statusById(combat.enemyStatuses, 'sunder')?.value ?? 0)

function getAttackBase(
  state: GameState,
  member: CombatHeroState,
  synergy: PartySynergy,
  martial?: MartialDefinition,
): { damage: number; traitMultiplier: number } {
  const stats = getHeroStats(state, member.heroId)
  const traitMultiplier = getEnemyTraitAttackMultiplier(state.combat, member, martial)
  return {
    damage: stats.attack
      * attackMultiplierForRow(member.row)
      * synergy.attackMultiplier
      * traitMultiplier
      * getEnemyVulnerabilityMultiplier(state.combat),
    traitMultiplier,
  }
}

function performMartialSkill(
  state: GameState,
  member: CombatHeroState,
  martial: MartialDefinition,
  synergy: PartySynergy,
): number {
  const combat = state.combat
  const actor = heroById(member.heroId)
  const stats = getHeroStats(state, member.heroId)
  const rank = getLearnedMartialRank(state.heroes[member.heroId], martial.id)
  const elementMatch = actor?.element === martial.element
  const styleMatch = actor?.style === martial.style
  const martialMultiplier = martial.basePower
    * (1 + (rank - 1) * 0.12)
    * (elementMatch ? 1.18 : 1)
    * (styleMatch ? 1.08 : 1)
  const { damage: attackBase, traitMultiplier } = getAttackBase(state, member, synergy, martial)
  let damage = attackBase * martialMultiplier
  let effectText = ''

  switch (martial.skill.kind) {
    case 'blazing_palm': {
      damage *= 1.6 + rank * 0.1
      const burnDamage = Math.max(1, Math.round(stats.attack * (0.2 + rank * 0.05)))
      applyStatus(combat.enemyStatuses, 'burn', 2, burnDamage, member.heroId)
      effectText = `，灼伤每回合造成 ${burnDamage} 伤害`
      break
    }
    case 'frost_flurry':
      damage *= 1.3 + rank * 0.08
      applyStatus(combat.enemyStatuses, 'slow', 2, 0.18 + rank * 0.03, member.heroId)
      effectText = '，寒气使敌人迟滞 2 回合'
      break
    case 'taiji_restore': {
      damage *= 0.8 + rank * 0.04
      const target = combat.partyMembers
        .filter((candidate) => candidate.hp > 0)
        .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0]
      const healing = target ? Math.min(
        target.maxHp - target.hp,
        Math.round(stats.attack * (0.55 + rank * 0.12) * synergy.healingMultiplier),
      ) : 0
      if (target) {
        target.hp += healing
        applyStatus(target.statuses, 'guard', 2, Math.round(stats.attack * (0.28 + rank * 0.06)), member.heroId)
      }
      effectText = target ? `，为${heroById(target.heroId)?.name ?? '同伴'}回复 ${healing} 气血并护体` : ''
      break
    }
    case 'vajra_sunder':
      damage *= 1.35 + rank * 0.08
      applyStatus(combat.enemyStatuses, 'sunder', 2, 0.16 + rank * 0.03, member.heroId)
      effectText = `，震裂护体使后续伤害 +${Math.round((0.16 + rank * 0.03) * 100)}%`
      break
    case 'earth_guard': {
      damage *= 0.72 + rank * 0.04
      const guardValue = Math.round(stats.attack * (0.38 + rank * 0.08))
      for (const ally of combat.partyMembers.filter((candidate) => candidate.hp > 0)) {
        applyStatus(ally.statuses, 'guard', 2, guardValue, member.heroId)
      }
      effectText = `，全队获得可化解 ${guardValue} 伤害的护体真气`
      break
    }
  }

  const roundedDamage = Math.max(1, Math.round(damage))
  combat.enemyHp = Math.max(0, combat.enemyHp - roundedDamage)
  member.martialCooldowns[martial.id] = Math.max(1, martial.skill.cooldown - synergy.skillCooldownReduction)
  addLog(
    combat,
    'skill',
    `${actor?.name ?? '侠客'}施展「${martial.skill.name}」，造成 ${roundedDamage} 伤害${describeTraitAdjustment(traitMultiplier)}${effectText}。`,
    { actorId: member.heroId, amount: roundedDamage, abilityId: martial.id },
  )
  return roundedDamage
}

function processEnemyStatuses(state: GameState): boolean {
  const combat = state.combat
  const burn = statusById(combat.enemyStatuses, 'burn')
  if (burn) {
    const damage = Math.max(1, Math.round(burn.value))
    combat.enemyHp = Math.max(0, combat.enemyHp - damage)
    addLog(combat, 'status', `${combat.enemyName}受灼伤侵蚀，损失 ${damage} 气血。`, { amount: damage })
  }
  if (combat.enemyHp > 0) return false
  resolveCombatVictory(state)
  return true
}

export function stepCombat(state: GameState): void {
  const combat = state.combat
  if (combat.status !== 'fighting' || combat.partyMembers.length === 0) return

  const livingIndices = combat.partyMembers
    .map((member, index) => member.hp > 0 ? index : -1)
    .filter((index) => index >= 0)
  if (livingIndices.length === 0) return

  const synergy = getPartySynergy(state)
  const actorIndex = livingIndices.find((index) => index >= combat.turnIndex) ?? livingIndices[0]
  const actorMember = combat.partyMembers[actorIndex]
  const actorId = actorMember.heroId
  const actor = heroById(actorId)
  const livingHeroIds = combat.partyMembers.filter((member) => member.hp > 0).map((member) => member.heroId)
  const activeCombos = getActiveCombos(state).filter((combo) => combo.heroIds.every((heroId) => livingHeroIds.includes(heroId)))
  const comboTurn = activeCombos.length > 0
    && actorIndex === livingIndices[0]
    && combat.round > 0
    && combat.round % 3 === 0

  if (comboTurn) {
    const combo = activeCombos[combat.comboIndex % activeCombos.length]
    const combinedAttack = combo.heroIds.reduce((sum, heroId) => {
      const member = combat.partyMembers.find((candidate) => candidate.heroId === heroId)
      if (!member) return sum
      return sum + getHeroStats(state, heroId).attack
        * attackMultiplierForRow(member.row)
        * getEnemyTraitAttackMultiplier(combat, member)
    }, 0)
    const damage = Math.round(combinedAttack * combo.multiplier * synergy.attackMultiplier * getEnemyVulnerabilityMultiplier(combat))
    combat.enemyHp = Math.max(0, combat.enemyHp - damage)
    let effectText = ''
    if (combo.effect === 'restore') {
      const healing = Math.max(1, Math.round(combinedAttack * combo.effectValue * synergy.healingMultiplier))
      let restored = 0
      for (const member of combat.partyMembers.filter((candidate) => candidate.hp > 0)) {
        const recovered = Math.min(member.maxHp - member.hp, healing)
        member.hp += recovered
        restored += recovered
      }
      effectText = `，并为全队回复 ${restored} 气血`
    } else if (combo.effect === 'guard') {
      const guardValue = Math.max(1, Math.round(combinedAttack * combo.effectValue))
      for (const member of combat.partyMembers.filter((candidate) => candidate.hp > 0)) {
        applyStatus(member.statuses, 'guard', 2, guardValue)
      }
      effectText = `，全队获得 ${guardValue} 点护体`
    } else if (combo.effect === 'sunder') {
      applyStatus(combat.enemyStatuses, 'sunder', 2, combo.effectValue)
      effectText = `，使敌人破甲 ${Math.round(combo.effectValue * 100)}%`
    }
    combat.comboIndex += 1
    addLog(combat, 'combo', `合击「${combo.name}」贯穿敌阵，造成 ${damage} 伤害${effectText}！`, {
      amount: damage,
      abilityId: combo.id,
    })
  } else {
    const progress = state.heroes[actorId]
    const equippedIds = progress.equippedMartialIds.filter((id): id is string => Boolean(id))
    for (const martialId of equippedIds) {
      const current = actorMember.martialCooldowns[martialId] ?? 0
      if (current > 0) actorMember.martialCooldowns[martialId] = current - 1
    }
    const readyMartialId = equippedIds.find((martialId) => (actorMember.martialCooldowns[martialId] ?? 0) <= 0)
    const readyMartial = readyMartialId ? martialById(readyMartialId) : undefined
    if (readyMartial) {
      performMartialSkill(state, actorMember, readyMartial, synergy)
    } else {
      const { damage: attackBase, traitMultiplier } = getAttackBase(state, actorMember, synergy)
      const damage = Math.max(1, Math.round(attackBase))
      combat.enemyHp = Math.max(0, combat.enemyHp - damage)
      addLog(combat, 'attack', `${actor?.name ?? '侠客'}施展拳脚，造成 ${damage} 伤害${describeTraitAdjustment(traitMultiplier)}。`, {
        actorId,
        amount: damage,
      })
    }
  }

  if (combat.enemyHp <= 0) {
    resolveCombatVictory(state)
    return
  }

  const nextActorIndex = livingIndices.find((index) => index > actorIndex)
  if (nextActorIndex !== undefined) {
    combat.turnIndex = nextActorIndex
    return
  }

  combat.turnIndex = livingIndices[0]
  combat.round += 1
  if (processEnemyStatuses(state)) return
  const livingMembers = combat.partyMembers.filter((member) => member.hp > 0)
  const frontTargets = livingMembers.filter((member) => member.row === 'front')
  const targets = frontTargets.length > 0 ? frontTargets : livingMembers
  const target = targets[combat.round % targets.length]
  const targetStats = getHeroStats(state, target.heroId)
  const positionReduction = target.row === 'front' ? FRONT_DAMAGE_TAKEN_MULTIPLIER : 1
  const frontCount = livingMembers.filter((member) => member.row === 'front').length
  const formationBreakerMultiplier = combat.enemyTraitId === 'formation_breaker'
    ? frontCount >= 2 ? 0.8 : 1.45
    : 1
  const slowMultiplier = 1 - (statusById(combat.enemyStatuses, 'slow')?.value ?? 0)
  const rawEnemyDamage = Math.max(5, Math.round(
    (combat.enemyAttack - targetStats.defense * 0.45)
      * positionReduction
      * formationBreakerMultiplier
      * slowMultiplier
      * synergy.damageTakenMultiplier,
  ))
  const guard = statusById(target.statuses, 'guard')
  const absorbed = guard ? Math.min(rawEnemyDamage, Math.round(guard.value)) : 0
  if (guard) guard.value -= absorbed
  const enemyDamage = rawEnemyDamage - absorbed
  target.hp = Math.max(0, target.hp - enemyDamage)
  const targetName = heroById(target.heroId)?.name ?? '侠客'
  addLog(
    combat,
    'enemy',
    `${combat.enemyName}反击${target.row === 'front' ? '前排' : '后排'}${targetName}，造成 ${enemyDamage} 伤害${absorbed ? `（护体化解 ${absorbed}）` : ''}${slowMultiplier < 1 ? '（迟滞削弱攻势）' : ''}${combat.enemyTraitId === 'formation_breaker' ? frontCount >= 2 ? '（双前排化解破阵）' : '（单前排遭受重击）' : ''}${target.hp === 0 ? '，其已无力再战' : ''}。`,
    { targetId: target.heroId, amount: enemyDamage },
  )
  tickStatuses(combat.enemyStatuses)
  for (const member of combat.partyMembers) tickStatuses(member.statuses)

  if (combat.partyMembers.some((member) => member.hp > 0)) return
  if (combat.mode === 'challenge' || combat.mode === 'mystery') {
    combat.status = 'defeat'
    if (combat.mode === 'mystery' && state.mystery.run) state.mystery.run.status = 'failed'
    addLog(combat, 'defeat', `${combat.mode === 'mystery' ? '秘境探索止步于此。' : '此战落败。'}破局建议：${enemyTraitById(combat.enemyTraitId).counterHint}`)
    return
  }

  const oldLogs = combat.logs
  const next = createIdleCombat(state, combat.stage ?? 1, true, combat.stageKills ?? 0)
  next.logs = oldLogs
  state.combat = next
  addLog(state.combat, 'system', '众人暂退古亭调息，片刻后重新上路。')
}

export function startMystery(state: GameState, seed = Date.now()): ActionResult {
  if (state.mystery.run) return { ok: false, message: '已有一轮秘境探索尚未结算' }
  if (state.combat.mode === 'challenge' && state.combat.status === 'fighting') {
    return { ok: false, message: '请先结束当前区域 BOSS 挑战' }
  }
  returnToIdle(state)
  const normalizedSeed = Math.abs(Math.floor(seed)) || 1
  state.mystery.run = {
    seed: normalizedSeed,
    floor: 0,
    status: 'choosing',
    blessingIds: [],
    choiceIds: getMysteryChoices(normalizedSeed, 0),
    earned: { silver: 0, experience: 0, pages: 0, reputation: 0 },
  }
  return { ok: true, message: '秘境入口已经开启，请选择第一条岔路' }
}

export function chooseMysteryBlessing(state: GameState, blessingId: MysteryBlessingId): ActionResult {
  const run = state.mystery.run
  const blessing = mysteryBlessingById(blessingId)
  const encounter = run ? MYSTERY_ENCOUNTERS[run.floor] : undefined
  if (!run || run.status !== 'choosing' || !blessing || !run.choiceIds.includes(blessingId) || !encounter) {
    return { ok: false, message: '这条秘境岔路当前不可选择' }
  }
  run.blessingIds.push(blessingId)
  run.choiceIds = []
  run.status = 'fighting'
  state.combat = createMysteryCombat(state, encounter)
  addLog(state.combat, 'system', `获得秘境祝福「${blessing.name}」，遭遇${encounter.name}。`)
  return { ok: true, message: `选择「${blessing.name}」，进入秘境第 ${run.floor + 1} 层` }
}

export function resumeMysteryCombat(state: GameState): ActionResult {
  const run = state.mystery.run
  const encounter = run ? MYSTERY_ENCOUNTERS[run.floor] : undefined
  if (!run || run.status !== 'fighting' || !encounter) return { ok: false, message: '没有需要恢复的秘境战斗' }
  state.combat = createMysteryCombat(state, encounter)
  addLog(state.combat, 'system', `从存档恢复秘境第 ${run.floor + 1} 层，对阵${encounter.name}。`)
  return { ok: true, message: '秘境战斗已恢复' }
}

export function abandonMystery(state: GameState): ActionResult {
  if (!state.mystery.run) return { ok: false, message: '当前没有进行中的秘境探索' }
  state.mystery.run = null
  returnToIdle(state)
  return { ok: true, message: '已离开秘境，本轮已获得的战利品仍会保留' }
}

export function finishMystery(state: GameState): ActionResult {
  const run = state.mystery.run
  if (!run || (run.status !== 'completed' && run.status !== 'failed')) {
    return { ok: false, message: '秘境探索尚未结束' }
  }
  const completed = run.status === 'completed'
  state.mystery.run = null
  returnToIdle(state)
  return { ok: true, message: completed ? '秘境战利品已经清点完毕' : '本轮秘境探索已经结算' }
}

const isBuildLocked = (state: GameState): boolean => Boolean(state.mystery.run)
  || (state.combat.mode === 'challenge' && state.combat.status === 'fighting')

export function startChallenge(state: GameState): ActionResult {
  if (state.mystery.run) return { ok: false, message: '请先完成或离开当前秘境探索' }
  if (state.combat.mode === 'challenge' && state.combat.status === 'fighting') {
    return { ok: false, message: '挑战正在进行中' }
  }
  const region = getSelectedRegion(state)
  const trait = enemyTraitById(region.boss.traitId)
  state.combat = createChallengeCombat(state, region)
  addLog(state.combat, 'system', `${region.boss.name}出阵，特性「${trait.name}」已经生效。`)
  return { ok: true, message: `开始挑战${region.boss.name}` }
}

export function returnToIdle(state: GameState): ActionResult {
  const region = getSelectedRegion(state)
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', `队伍回到${region.name}整备，等待选择关卡。`)
  return { ok: true, message: '已停止战斗并返回关卡选择' }
}

export function startIdleStage(state: GameState, regionId: RegionId, stage: number): ActionResult {
  const region = regionById(regionId)
  if (!region) return { ok: false, message: '江湖区域不存在' }
  if (!Number.isInteger(stage) || stage < 1 || stage > 10) return { ok: false, message: '小关卡不存在' }
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可开始挂机战斗' }
  if (!isRegionUnlocked(state, region.id)) return { ok: false, message: '尚未击败前一区域 BOSS' }
  if (stage > (state.regionCleared[region.id] ?? 0) + 1) return { ok: false, message: '需先通关前一关才能开始本关挂机' }

  state.selectedRegionId = region.id
  state.combat = createIdleCombat(state, stage, true)
  addLog(state.combat, 'system', `进入${region.name}第 ${stage} 关，队伍开始挂机战斗。`)
  return { ok: true, message: `已开始${region.name}第 ${stage} 关挂机战斗` }
}

export function selectRegion(state: GameState, regionId: RegionId): ActionResult {
  const region = regionById(regionId)
  if (!region) return { ok: false, message: '江湖区域不存在' }
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可更换历练区域' }
  if (!isRegionUnlocked(state, region.id)) return { ok: false, message: '尚未击败前一区域 BOSS' }
  if (state.selectedRegionId === region.id) return { ok: false, message: `队伍已在${region.name}历练` }

  state.selectedRegionId = region.id
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', `众人转赴${region.name}，等待选择小关卡。`)
  return { ok: true, message: `已前往${region.name}` }
}

export function getUpgradeCost(level: number): { silver: number; experience: number } {
  return { silver: level * 45, experience: level * 70 }
}

const refreshIdleMemberHp = (state: GameState, heroId: string, oldMaxHp: number): void => {
  if (state.combat.mode !== 'idle') return
  const member = state.combat.partyMembers.find((candidate) => candidate.heroId === heroId)
  if (!member) return
  const nextMaxHp = getHeroStats(state, heroId).hp
  member.maxHp = nextMaxHp
  member.hp = Math.max(1, Math.min(nextMaxHp, member.hp + nextMaxHp - oldMaxHp))
}

export function upgradeHero(state: GameState, heroId: string): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可调整养成' }
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  if (!hero || !progress?.unlocked) return { ok: false, message: '尚未结识这位侠客' }
  const cost = getUpgradeCost(progress.level)
  if (state.resources.silver < cost.silver || state.resources.experience < cost.experience) {
    return { ok: false, message: `需要 ${cost.silver} 银两与 ${cost.experience} 阅历` }
  }
  state.resources.silver -= cost.silver
  state.resources.experience -= cost.experience
  const oldMaxHp = getHeroStats(state, heroId).hp
  progress.level += 1
  refreshIdleMemberHp(state, heroId, oldMaxHp)
  return { ok: true, message: `${hero.name}提升至 ${progress.level} 级` }
}

export function recruitHero(state: GameState, heroId: string): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可调整养成' }
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  if (!hero || !progress) return { ok: false, message: '侠客资料不存在' }
  if (progress.unlocked) return { ok: false, message: `${hero.name}已在名册中` }
  if (state.resources.silver < hero.recruitCost) return { ok: false, message: `还需 ${hero.recruitCost} 银两才能结识` }
  state.resources.silver -= hero.recruitCost
  progress.unlocked = true
  const martialId = state.unlockedMartials[0] ?? null
  progress.learnedMartials = martialId ? { [martialId]: createLearnedMartial() } : {}
  progress.equippedMartialIds = martialId ? [martialId, null, null, null] : emptyEquippedMartialIds()
  return { ok: true, message: `${hero.name}应邀加入江湖名册` }
}

export function unlockMartial(state: GameState, martialId: string): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可调整养成' }
  const martial = martialById(martialId)
  if (!martial) return { ok: false, message: '武学资料不存在' }
  if (state.unlockedMartials.includes(martialId)) return { ok: false, message: '这门武学已参悟' }
  if (state.resources.pages < martial.unlockCost) return { ok: false, message: `需要 ${martial.unlockCost} 秘籍残页` }
  state.resources.pages -= martial.unlockCost
  state.unlockedMartials.push(martialId)
  return { ok: true, message: `成功参悟「${martial.name}」` }
}

const primeNewIdleMartialCooldown = (state: GameState, heroId: string, martialId: string): void => {
  if (state.combat.mode !== 'idle' || state.combat.status !== 'fighting') return
  const member = state.combat.partyMembers.find((candidate) => candidate.heroId === heroId)
  const martial = martialById(martialId)
  if (member && martial && member.martialCooldowns[martialId] === undefined) {
    member.martialCooldowns[martialId] = martial.skill.cooldown
  }
}

const clearMartialCooldown = (state: GameState, heroId: string, martialId: string): void => {
  const member = state.combat.partyMembers.find((candidate) => candidate.heroId === heroId)
  if (member) delete member.martialCooldowns[martialId]
}

export function equipMartial(state: GameState, heroId: string, martialId: string): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可更换武功' }
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  if (!hero || !progress?.unlocked || !martialById(martialId) || !progress.learnedMartials[martialId]) {
    return { ok: false, message: '只能装备这位侠客已经学会的武功' }
  }
  if (progress.equippedMartialIds.includes(martialId)) return { ok: false, message: '这门武功已经装备' }
  const slot = progress.equippedMartialIds.indexOf(null)
  if (slot < 0) return { ok: false, message: '出战武功已满，请先卸下一门' }
  progress.equippedMartialIds[slot] = martialId
  primeNewIdleMartialCooldown(state, heroId, martialId)
  return { ok: true, message: `${hero.name}已将「${martialById(martialId)!.name}」设为优先级 ${slot + 1}` }
}

export function unequipMartial(state: GameState, heroId: string, slot: number): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可更换武功' }
  const progress = state.heroes[heroId]
  if (!progress?.unlocked || slot < 0 || slot >= 4 || !progress.equippedMartialIds[slot]) {
    return { ok: false, message: '这个槽位没有可卸下的武功' }
  }
  progress.equippedMartialIds[slot] = null
  return { ok: true, message: '武功已卸下' }
}

export function moveMartial(state: GameState, heroId: string, slot: number, direction: -1 | 1): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可调整优先级' }
  const progress = state.heroes[heroId]
  const target = slot + direction
  if (!progress?.unlocked || slot < 0 || slot >= 4 || target < 0 || target >= 4 || !progress.equippedMartialIds[slot]) {
    return { ok: false, message: '无法调整这个武功槽位' }
  }
  ;[progress.equippedMartialIds[slot], progress.equippedMartialIds[target]] = [
    progress.equippedMartialIds[target],
    progress.equippedMartialIds[slot],
  ]
  return { ok: true, message: `出招优先级已调整为 ${target + 1}` }
}

export function trainMartial(state: GameState, heroId: string, martialId: string): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可调整养成' }
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  const martial = martialById(martialId)
  const learned = progress?.learnedMartials[martialId]
  if (!hero || !progress?.unlocked || !martial || !learned) return { ok: false, message: '这位侠客尚未学会该武功' }
  if (learned.rank >= 3) return { ok: false, message: '这门武功已修至圆满' }
  const silver = learned.rank * 55
  const pages = learned.rank * 12
  if (state.resources.silver < silver || state.resources.pages < pages) {
    return { ok: false, message: `进阶需要 ${silver} 银两与 ${pages} 残页` }
  }
  state.resources.silver -= silver
  state.resources.pages -= pages
  learned.invested.silver += silver
  learned.invested.pages += pages
  learned.rank += 1
  return { ok: true, message: `${hero.name}的「${martial.name}」进阶至${martial.rankNames[learned.rank - 1]}` }
}

export const getMartialForgetPreview = (state: GameState, heroId: string, martialId: string) => {
  const learned = state.heroes[heroId]?.learnedMartials[martialId]
  const martial = martialById(martialId)
  if (!learned || !martial) return null
  return {
    martial,
    rank: learned.rank,
    passiveText: formatMartialPassive(martialId, learned.rank),
    refund: getMartialRefund(learned.invested),
  }
}

export function forgetMartial(state: GameState, heroId: string, martialId: string): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可遗忘武功' }
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  const preview = getMartialForgetPreview(state, heroId, martialId)
  if (!hero || !progress?.unlocked || !preview) return { ok: false, message: '没有可遗忘的武功' }
  const oldMaxHp = getHeroStats(state, heroId).hp
  for (const key of Object.keys(preview.refund) as Array<keyof Resources>) {
    state.resources[key] += preview.refund[key]
  }
  delete progress.learnedMartials[martialId]
  progress.equippedMartialIds = progress.equippedMartialIds
    .map((id) => id === martialId ? null : id) as EquippedMartialIds
  clearMartialCooldown(state, heroId, martialId)
  refreshIdleMemberHp(state, heroId, oldMaxHp)
  return { ok: true, message: `${hero.name}已遗忘「${preview.martial.name}」，返还 80% 培养资源` }
}

export function setPartySlot(state: GameState, slot: number, heroId: string): ActionResult {
  const hero = heroById(heroId)
  if (!hero || !state.heroes[heroId]?.unlocked || slot < 0 || slot >= state.formation.length) {
    return { ok: false, message: '无法调整这个队伍位置' }
  }
  if (isBuildLocked(state)) return { ok: false, message: state.mystery.run ? '秘境探索期间不可换阵' : '挑战中不可换阵，请先完成或退出本场战斗' }
  const oldHero = state.formation[slot].heroId
  const existingSlot = state.formation.findIndex((candidate) => candidate.heroId === heroId)
  state.formation[slot].heroId = heroId
  if (existingSlot >= 0 && existingSlot !== slot && oldHero) state.formation[existingSlot].heroId = oldHero
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', '阵容已调整，众人重新列阵。')
  return { ok: true, message: `${hero.name}已进入第 ${slot + 1} 位` }
}

const isFormationPosition = (value: number): value is FormationPosition =>
  value === 0 || value === 1 || value === 2

function findFreePosition(state: GameState, row: FormationRow, excludeHeroId?: string): FormationPosition | null {
  const occupied = new Set(
    state.formation
      .filter((slot) => slot.row === row && slot.heroId !== excludeHeroId)
      .map((slot) => slot.position),
  )
  for (const position of [0, 1, 2] as const) {
    if (!occupied.has(position)) return position
  }
  return null
}

export function setFormationRow(state: GameState, slot: number, row: FormationRow): ActionResult {
  const formationSlot = state.formation[slot]
  if (!formationSlot || (row !== 'front' && row !== 'back')) return { ok: false, message: '无法调整这个阵位' }
  if (isBuildLocked(state)) return { ok: false, message: state.mystery.run ? '秘境探索期间不可换位' : '挑战中不可换位，请先完成或退出本场战斗' }
  if (formationSlot.row === row) return { ok: false, message: '侠客已在这一排' }

  const position = findFreePosition(state, row, formationSlot.heroId)
  if (position === null) return { ok: false, message: `${row === 'front' ? '前排' : '后排'}最多 ${MAX_FORMATION_ROW_SIZE} 位侠客` }

  formationSlot.row = row
  formationSlot.position = position
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', `阵型切换为「${getFormationSummary(state).name}」，众人重新列阵。`)
  return { ok: true, message: `${heroById(formationSlot.heroId)?.name ?? '侠客'}已调至${row === 'front' ? '前排' : '后排'}` }
}

export function addToFormation(state: GameState, heroId: string, row: FormationRow, position?: FormationPosition): ActionResult {
  const hero = heroById(heroId)
  if (!hero || !state.heroes[heroId]?.unlocked) return { ok: false, message: '无法让这位侠客上阵' }
  if (row !== 'front' && row !== 'back' || (position !== undefined && !isFormationPosition(position))) {
    return { ok: false, message: '无法调整这个阵位' }
  }
  if (isBuildLocked(state)) return { ok: false, message: state.mystery.run ? '秘境探索期间不可换阵' : '挑战中不可换阵，请先完成或退出本场战斗' }
  if (state.formation.some((slot) => slot.heroId === heroId)) return { ok: false, message: `${hero.name}已在阵容中` }
  const targetPosition = position !== undefined && !state.formation.some((slot) => slot.row === row && slot.position === position)
    ? position
    : findFreePosition(state, row)
  if (targetPosition === null) return { ok: false, message: `${row === 'front' ? '前排' : '后排'}最多上阵 ${MAX_FORMATION_ROW_SIZE} 位侠客` }
  state.formation.push({ heroId, row, position: targetPosition })
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', `${hero.name}入列${row === 'front' ? '前排' : '后排'}，众人重新列阵。`)
  return { ok: true, message: `${hero.name}已上阵，位于${row === 'front' ? '前排' : '后排'}` }
}

export function removeFromFormation(state: GameState, heroId: string): ActionResult {
  const index = state.formation.findIndex((slot) => slot.heroId === heroId)
  const hero = heroById(heroId)
  if (index < 0 || !hero) return { ok: false, message: '这位侠客不在阵容中' }
  if (isBuildLocked(state)) return { ok: false, message: state.mystery.run ? '秘境探索期间不可换阵' : '挑战中不可换阵，请先完成或退出本场战斗' }
  const remaining = state.formation.filter((_, candidate) => candidate !== index)
  if (remaining.length === 0) return { ok: false, message: '至少保留一位侠客出战' }
  state.formation.splice(index, 1)
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', `${hero.name}下阵休整，众人重新列阵。`)
  return { ok: true, message: `${hero.name}已下阵` }
}

export function moveFormationSlot(state: GameState, heroId: string, targetRow: FormationRow, targetPosition?: FormationPosition): ActionResult {
  const slot = state.formation.find((candidate) => candidate.heroId === heroId)
  if (!slot || (targetRow !== 'front' && targetRow !== 'back')) return { ok: false, message: '无法调整这个阵位' }
  if (isBuildLocked(state)) return { ok: false, message: state.mystery.run ? '秘境探索期间不可换阵' : '挑战中不可换阵，请先完成或退出本场战斗' }
  if (slot.row === targetRow && slot.position === targetPosition) return { ok: true, message: '侠客已在此阵位' }
  const position = targetPosition !== undefined && !state.formation.some((candidate) => candidate.row === targetRow && candidate.position === targetPosition && candidate.heroId !== heroId)
    ? targetPosition
    : findFreePosition(state, targetRow, heroId)
  if (position === null) return { ok: false, message: `${targetRow === 'front' ? '前排' : '后排'}最多 ${MAX_FORMATION_ROW_SIZE} 位侠客` }
  slot.row = targetRow
  slot.position = position
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', `${heroById(heroId)?.name ?? '侠客'}调整阵位，众人重新列阵。`)
  return { ok: true, message: `${heroById(heroId)?.name ?? '侠客'}已移至${targetRow === 'front' ? '前排' : '后排'}${position + 1}号位` }
}

export function swapFormationSlots(state: GameState, heroIdA: string, heroIdB: string): ActionResult {
  const slotA = state.formation.find((slot) => slot.heroId === heroIdA)
  const slotB = state.formation.find((slot) => slot.heroId === heroIdB)
  if (!slotA || !slotB || slotA === slotB) return { ok: false, message: '无法交换这两个阵位' }
  if (isBuildLocked(state)) return { ok: false, message: state.mystery.run ? '秘境探索期间不可换阵' : '挑战中不可换阵，请先完成或退出本场战斗' }
  ;[slotA.row, slotB.row] = [slotB.row, slotA.row]
  ;[slotA.position, slotB.position] = [slotB.position, slotA.position]
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', `${heroById(heroIdA)?.name ?? '侠客'}与${heroById(heroIdB)?.name ?? '侠客'}互换阵位。`)
  return { ok: true, message: `${heroById(heroIdA)?.name ?? '侠客'}与${heroById(heroIdB)?.name ?? '侠客'}已互换阵位` }
}
