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
  getLearnedMartialRank,
  getPrimaryMartialId,
} from './martials'
import type {
  ActionResult,
  CombatStatus,
  CombatStatusId,
  CombatHeroState,
  CombatEvent,
  CombatState,
  FormationRow,
  FormationSummary,
  GameState,
  HeroProgress,
  HeroStats,
  MartialDefinition,
  MysteryBlessingEffectType,
  MysteryBlessingId,
  MysteryEncounterDefinition,
  PartySynergy,
  RegionDefinition,
  RegionId,
  Sect,
} from './types'

const MAX_LOGS = 36
export const FRONT_ATTACK_MULTIPLIER = 0.9
export const FRONT_DAMAGE_TAKEN_MULTIPLIER = 0.8
export const BACK_ATTACK_MULTIPLIER = 1.15
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
    version: 7,
    resources: { silver: 180, experience: 90, pages: 15, reputation: 0 },
    heroes,
    unlockedMartials: startingMartials,
    formation: HEROES.filter((hero) => hero.initial).slice(0, 3).map((hero, index) => ({
      heroId: hero.id,
      row: index < 2 ? 'front' : 'back',
    })),
    selectedRegionId: REGIONS[0].id,
    defeatedBossIds: [],
    regionDefeats: {
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

  const martialId = getPrimaryMartialId(progress)
  const martial = martialId ? martialById(martialId) : undefined
  const rank = martial ? getLearnedMartialRank(progress, martial.id) : 0
  const elementMatch = martial?.element === hero.element
  const styleMatch = martial?.style === hero.style
  const martialPower = martial?.basePower ?? 1
  const rankPower = martial ? 1 + (rank - 1) * 0.12 : 1
  const affinityPower = (elementMatch ? 1.18 : 1) * (styleMatch ? 1.08 : 1)
  const level = progress.level
  const attack = Math.round((hero.baseAttack + (level - 1) * 3.2) * martialPower * rankPower * affinityPower)
  const defense = Math.round(hero.baseDefense + (level - 1) * 1.9 + (styleMatch ? 2 : 0))
  const hp = Math.round(hero.baseHp + (level - 1) * 15 + (elementMatch ? 6 : 0))

  return {
    attack,
    defense,
    hp,
    power: attack * 3 + defense * 2 + Math.round(hp / 3),
    affinityText: !martial ? '未习武学' : elementMatch && styleMatch ? '五行·刚柔皆合' : elementMatch ? '五行相合' : styleMatch ? '刚柔相合' : '相性平平',
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
  return { ...slot, hp: maxHp, maxHp, skillCooldown: 0, statuses: [] }
})

function createIdleCombat(state: GameState, stage: number | null = null, fighting = false): CombatState {
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

  const oldLogs = state.combat.logs
  const next = createIdleCombat(state, stage, true)
  next.logs = oldLogs
  state.combat = next
  addLog(
    state.combat,
    'reward',
    `肃清${region.name}一路敌手，获得 ${silver} 银两、${experience} 阅历${pages ? `、${pages} 残页` : ''}。`,
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

function getEnemyTraitAttackMultiplier(state: GameState, combat: CombatState, member: CombatHeroState): number {
  if (combat.enemyTraitId === 'iron_armor') return member.row === 'back' ? 1.25 : 0.65
  if (combat.enemyTraitId === 'frost_aura') {
    const progress = state.heroes[member.heroId]
    const martialId = progress ? getPrimaryMartialId(progress) : null
    return martialById(martialId ?? '')?.element === '火' ? 1.55 : 0.72
  }
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
): { damage: number; traitMultiplier: number } {
  const stats = getHeroStats(state, member.heroId)
  const traitMultiplier = getEnemyTraitAttackMultiplier(state, state.combat, member)
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
  const { damage: attackBase, traitMultiplier } = getAttackBase(state, member, synergy)
  let damage = attackBase
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
  member.skillCooldown = Math.max(1, martial.skill.cooldown - synergy.skillCooldownReduction)
  addLog(
    combat,
    'skill',
    `${actor?.name ?? '侠客'}施展「${martial.skill.name}」，造成 ${roundedDamage} 伤害${describeTraitAdjustment(traitMultiplier)}${effectText}。`,
    { actorId: member.heroId, amount: roundedDamage },
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
        * getEnemyTraitAttackMultiplier(state, combat, member)
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
    const martialId = progress ? getPrimaryMartialId(progress) : null
    const martial = martialId ? martialById(martialId) : undefined
    if (martial && actorMember.skillCooldown <= 0) {
      performMartialSkill(state, actorMember, martial, synergy)
    } else {
      if (actorMember.skillCooldown > 0) actorMember.skillCooldown -= 1
      const { damage: attackBase, traitMultiplier } = getAttackBase(state, actorMember, synergy)
      const damage = Math.max(1, Math.round(attackBase))
      combat.enemyHp = Math.max(0, combat.enemyHp - damage)
      addLog(combat, 'attack', `${actor?.name ?? '侠客'}施展${martial ? `「${martial.name}」` : '拳脚'}，造成 ${damage} 伤害${describeTraitAdjustment(traitMultiplier)}。`, {
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
  const next = createIdleCombat(state, combat.stage ?? 1, true)
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
  const combatMember = state.combat.partyMembers.find((member) => member.heroId === heroId)
  if (combatMember && state.combat.mode === 'idle') {
    const nextMaxHp = getHeroStats(state, heroId).hp
    combatMember.maxHp = nextMaxHp
    combatMember.hp = Math.min(nextMaxHp, combatMember.hp + nextMaxHp - oldMaxHp)
  }
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

export function equipMartial(state: GameState, heroId: string, martialId: string): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可更换武学' }
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  const martial = martialById(martialId)
  if (!hero || !progress?.unlocked || !martial || !state.unlockedMartials.includes(martialId)) {
    return { ok: false, message: '无法装备这门武学' }
  }
  progress.learnedMartials[martialId] ??= createLearnedMartial()
  progress.equippedMartialIds[0] = martialId
  return { ok: true, message: `${hero.name}改习「${martial.name}」` }
}

export function trainMartial(state: GameState, heroId: string): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可调整养成' }
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  const martialId = progress ? getPrimaryMartialId(progress) : null
  const martial = martialId ? martialById(martialId) : undefined
  if (!hero || !progress?.unlocked || !martial) return { ok: false, message: '请先为侠客配置武学' }
  const learned = progress.learnedMartials[martial.id]
  const rank = Math.max(1, learned?.rank ?? 1)
  if (rank >= 3) return { ok: false, message: '这门武学已修至圆满' }
  const silver = rank * 55
  const pages = rank * 12
  if (state.resources.silver < silver || state.resources.pages < pages) {
    return { ok: false, message: `进阶需要 ${silver} 银两与 ${pages} 残页` }
  }
  state.resources.silver -= silver
  state.resources.pages -= pages
  progress.learnedMartials[martial.id] ??= createLearnedMartial(rank)
  progress.learnedMartials[martial.id].rank = rank + 1
  return { ok: true, message: `${hero.name}的「${martial.name}」进阶至${martial.rankNames[rank]}` }
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

export function setFormationRow(state: GameState, slot: number, row: FormationRow): ActionResult {
  const formationSlot = state.formation[slot]
  if (!formationSlot || (row !== 'front' && row !== 'back')) return { ok: false, message: '无法调整这个阵位' }
  if (isBuildLocked(state)) return { ok: false, message: state.mystery.run ? '秘境探索期间不可换位' : '挑战中不可换位，请先完成或退出本场战斗' }
  if (formationSlot.row === row) return { ok: false, message: '侠客已在这一排' }

  const nextRows = state.formation.map((candidate, index) => index === slot ? row : candidate.row)
  if (!nextRows.includes('front') || !nextRows.includes('back')) {
    return { ok: false, message: '前后排都至少需要一位侠客' }
  }

  formationSlot.row = row
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', `阵型切换为「${getFormationSummary(state).name}」，众人重新列阵。`)
  return { ok: true, message: `${heroById(formationSlot.heroId)?.name ?? '侠客'}已调至${row === 'front' ? '前排' : '后排'}` }
}
