import {
  COMBO,
  HEROES,
  MARTIALS,
  REGIONS,
  enemyTraitById,
  heroById,
  martialById,
  nextRegionAfter,
  regionById,
} from './data'
import type {
  ActionResult,
  CombatHeroState,
  CombatEvent,
  CombatState,
  FormationRow,
  FormationSummary,
  GameState,
  HeroProgress,
  HeroStats,
  OfflineSettlement,
  PartySynergy,
  RegionDefinition,
  RegionId,
  Sect,
} from './types'

const MAX_LOGS = 36
export const OFFLINE_CAP_SECONDS = 12 * 60 * 60
export const FRONT_ATTACK_MULTIPLIER = 0.9
export const FRONT_DAMAGE_TAKEN_MULTIPLIER = 0.8
export const BACK_ATTACK_MULTIPLIER = 1.15
const BASE_IDLE_SILVER_PER_SECOND = 1.35
const BASE_IDLE_EXPERIENCE_PER_SECOND = 0.82
const BASE_IDLE_PAGES_PER_SECOND = 1 / 180

const emptyHeroProgress = (unlocked: boolean, equippedMartialId: string | null): HeroProgress => ({
  unlocked,
  level: 1,
  equippedMartialId,
  martialRanks: equippedMartialId ? { [equippedMartialId]: 1 } : {},
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
    version: 3,
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
    combat: {} as CombatState,
    statistics: {
      idleEnemiesDefeated: 0,
      challengesWon: 0,
      silverEarned: 0,
      offlineSeconds: 0,
    },
    lastTickAt: now,
    lastSavedAt: now,
  }
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', '山雨初歇，三位少侠踏上青石古道。')
  return state
}

export function getSelectedRegion(state: GameState): RegionDefinition {
  return regionById(state.selectedRegionId) ?? REGIONS[0]
}

export function isRegionUnlocked(state: GameState, regionId: string): boolean {
  const region = regionById(regionId)
  return Boolean(region && (region.requiredBossId === null || state.defeatedBossIds.includes(region.requiredBossId)))
}

export function getIdleRewardRates(state: GameState): { silver: number; experience: number; pages: number } {
  const multipliers = getSelectedRegion(state).rewardMultipliers
  return {
    silver: BASE_IDLE_SILVER_PER_SECOND * multipliers.silver,
    experience: BASE_IDLE_EXPERIENCE_PER_SECOND * multipliers.experience,
    pages: BASE_IDLE_PAGES_PER_SECOND * multipliers.pages,
  }
}

export function getHeroStats(state: GameState, heroId: string): HeroStats {
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  if (!hero || !progress) {
    return { attack: 0, defense: 0, hp: 0, power: 0, affinityText: '无' }
  }

  const martial = progress.equippedMartialId ? martialById(progress.equippedMartialId) : undefined
  const rank = martial ? Math.max(1, progress.martialRanks[martial.id] ?? 1) : 0
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
  const attackMultiplier = sectCount >= 3 ? 1.25 : sectCount >= 2 ? 1.12 : 1
  const comboActive = COMBO.heroIds.every((heroId) => heroIds.includes(heroId))

  return {
    attackMultiplier,
    sectName,
    sectCount,
    sectText: sectName
      ? `${sectName}同门 ${sectCount} 人，全队攻势 +${Math.round((attackMultiplier - 1) * 100)}%`
      : '队伍中尚无两位同门',
    comboActive,
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
  return { ...slot, hp: maxHp, maxHp }
})

function createIdleCombat(state: GameState): CombatState {
  const region = getSelectedRegion(state)
  const defeated = state.regionDefeats[region.id]
  const enemy = region.enemies[defeated % region.enemies.length]
  const tier = Math.floor(defeated / 8)
  const enemyMaxHp = Math.round(enemy.baseHp * (1 + tier * 0.08))
  return {
    mode: 'idle',
    status: 'fighting',
    regionId: region.id,
    enemyId: enemy.id,
    enemyTraitId: enemy.traitId,
    boss: false,
    enemyName: enemy.name,
    enemyHp: enemyMaxHp,
    enemyMaxHp,
    enemyAttack: enemy.baseAttack + tier * 2,
    partyMembers: createCombatParty(state),
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
    enemyId: boss.id,
    enemyTraitId: boss.traitId,
    boss: true,
    enemyName: boss.name,
    enemyHp: boss.baseHp,
    enemyMaxHp: boss.baseHp,
    enemyAttack: boss.baseAttack,
    partyMembers: createCombatParty(state),
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
  details: Pick<CombatEvent, 'actorId' | 'targetId' | 'amount'> = {},
): CombatEvent {
  const lastId = combat.logs.at(-1)?.id ?? 0
  const event: CombatEvent = { id: lastId + 1, kind, text, ...details }
  combat.logs = [...combat.logs.slice(-(MAX_LOGS - 1)), event]
  combat.lastEvent = event
  return event
}

function rewardIdleVictory(state: GameState): void {
  const region = getSelectedRegion(state)
  const defeated = state.regionDefeats[region.id]
  const nextDefeated = defeated + 1
  const tier = Math.floor(nextDefeated / 8)
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
  const next = createIdleCombat(state)
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

function getEnemyTraitAttackMultiplier(state: GameState, combat: CombatState, member: CombatHeroState): number {
  if (combat.enemyTraitId === 'iron_armor') return member.row === 'back' ? 1.25 : 0.65
  if (combat.enemyTraitId === 'frost_aura') {
    const martialId = state.heroes[member.heroId]?.equippedMartialId
    return martialById(martialId ?? '')?.element === '火' ? 1.55 : 0.72
  }
  return 1
}

const describeTraitAdjustment = (multiplier: number): string =>
  multiplier > 1 ? '，克制生效' : multiplier < 1 ? '，受敌方特性压制' : ''

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
  const stats = getHeroStats(state, actorId)
  const livingHeroIds = combat.partyMembers.filter((member) => member.hp > 0).map((member) => member.heroId)
  const comboTurn = synergy.comboActive
    && COMBO.heroIds.every((heroId) => livingHeroIds.includes(heroId))
    && actorIndex === livingIndices[0]
    && combat.round > 0
    && combat.round % 3 === 0

  if (comboTurn) {
    const combinedAttack = COMBO.heroIds.reduce((sum, heroId) => {
      const member = combat.partyMembers.find((candidate) => candidate.heroId === heroId)
      if (!member) return sum
      return sum + getHeroStats(state, heroId).attack
        * attackMultiplierForRow(member.row)
        * getEnemyTraitAttackMultiplier(state, combat, member)
    }, 0)
    const damage = Math.round(combinedAttack * COMBO.multiplier * synergy.attackMultiplier)
    combat.enemyHp = Math.max(0, combat.enemyHp - damage)
    addLog(combat, 'combo', `合击「${COMBO.name}」贯穿敌阵，造成 ${damage} 伤害！`, { amount: damage })
  } else {
    const martial = state.heroes[actorId]?.equippedMartialId
    const martialName = martial ? martialById(martial)?.name : undefined
    const traitMultiplier = getEnemyTraitAttackMultiplier(state, combat, actorMember)
    const damage = Math.max(1, Math.round(stats.attack * attackMultiplierForRow(actorMember.row) * synergy.attackMultiplier * traitMultiplier))
    combat.enemyHp = Math.max(0, combat.enemyHp - damage)
    addLog(combat, 'attack', `${actor?.name ?? '侠客'}施展${martialName ? `「${martialName}」` : '拳脚'}，造成 ${damage} 伤害${describeTraitAdjustment(traitMultiplier)}。`, {
      actorId,
      amount: damage,
    })
  }

  if (combat.enemyHp <= 0) {
    if (combat.mode === 'challenge') rewardChallengeVictory(state)
    else rewardIdleVictory(state)
    return
  }

  const nextActorIndex = livingIndices.find((index) => index > actorIndex)
  if (nextActorIndex !== undefined) {
    combat.turnIndex = nextActorIndex
    return
  }

  combat.turnIndex = livingIndices[0]
  combat.round += 1
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
  const enemyDamage = Math.max(5, Math.round(
    (combat.enemyAttack - targetStats.defense * 0.45) * positionReduction * formationBreakerMultiplier,
  ))
  target.hp = Math.max(0, target.hp - enemyDamage)
  const targetName = heroById(target.heroId)?.name ?? '侠客'
  addLog(
    combat,
    'enemy',
    `${combat.enemyName}反击${target.row === 'front' ? '前排' : '后排'}${targetName}，造成 ${enemyDamage} 伤害${combat.enemyTraitId === 'formation_breaker' ? frontCount >= 2 ? '（双前排化解破阵）' : '（单前排遭受重击）' : ''}${target.hp === 0 ? '，其已无力再战' : ''}。`,
    { targetId: target.heroId, amount: enemyDamage },
  )

  if (combat.partyMembers.some((member) => member.hp > 0)) return
  if (combat.mode === 'challenge') {
    combat.status = 'defeat'
    addLog(combat, 'defeat', `此战落败。破局建议：${enemyTraitById(combat.enemyTraitId).counterHint}`)
    return
  }

  const oldLogs = combat.logs
  const next = createIdleCombat(state)
  next.logs = oldLogs
  state.combat = next
  addLog(state.combat, 'system', '众人暂退古亭调息，片刻后重新上路。')
}

export function startChallenge(state: GameState): ActionResult {
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
  addLog(state.combat, 'system', `队伍回到${region.name}继续历练。`)
  return { ok: true, message: `已返回${region.name}挂机历练` }
}

export function selectRegion(state: GameState, regionId: RegionId): ActionResult {
  const region = regionById(regionId)
  if (!region) return { ok: false, message: '江湖区域不存在' }
  if (state.combat.mode === 'challenge' && state.combat.status === 'fighting') {
    return { ok: false, message: '挑战中不可更换历练区域' }
  }
  if (!isRegionUnlocked(state, region.id)) return { ok: false, message: '尚未击败前一区域 BOSS' }
  if (state.selectedRegionId === region.id) return { ok: false, message: `队伍已在${region.name}历练` }

  state.selectedRegionId = region.id
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', `众人转赴${region.name}，新的敌情已经出现。`)
  return { ok: true, message: `已前往${region.name}` }
}

export function getUpgradeCost(level: number): { silver: number; experience: number } {
  return { silver: level * 45, experience: level * 70 }
}

export function upgradeHero(state: GameState, heroId: string): ActionResult {
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
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  if (!hero || !progress) return { ok: false, message: '侠客资料不存在' }
  if (progress.unlocked) return { ok: false, message: `${hero.name}已在名册中` }
  if (state.resources.silver < hero.recruitCost) return { ok: false, message: `还需 ${hero.recruitCost} 银两才能结识` }
  state.resources.silver -= hero.recruitCost
  progress.unlocked = true
  progress.equippedMartialId = state.unlockedMartials[0] ?? null
  if (progress.equippedMartialId) progress.martialRanks[progress.equippedMartialId] = 1
  return { ok: true, message: `${hero.name}应邀加入江湖名册` }
}

export function unlockMartial(state: GameState, martialId: string): ActionResult {
  const martial = martialById(martialId)
  if (!martial) return { ok: false, message: '武学资料不存在' }
  if (state.unlockedMartials.includes(martialId)) return { ok: false, message: '这门武学已参悟' }
  if (state.resources.pages < martial.unlockCost) return { ok: false, message: `需要 ${martial.unlockCost} 秘籍残页` }
  state.resources.pages -= martial.unlockCost
  state.unlockedMartials.push(martialId)
  return { ok: true, message: `成功参悟「${martial.name}」` }
}

export function equipMartial(state: GameState, heroId: string, martialId: string): ActionResult {
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  const martial = martialById(martialId)
  if (!hero || !progress?.unlocked || !martial || !state.unlockedMartials.includes(martialId)) {
    return { ok: false, message: '无法装备这门武学' }
  }
  progress.equippedMartialId = martialId
  progress.martialRanks[martialId] ??= 1
  return { ok: true, message: `${hero.name}改习「${martial.name}」` }
}

export function trainMartial(state: GameState, heroId: string): ActionResult {
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  const martial = progress?.equippedMartialId ? martialById(progress.equippedMartialId) : undefined
  if (!hero || !progress?.unlocked || !martial) return { ok: false, message: '请先为侠客配置武学' }
  const rank = Math.max(1, progress.martialRanks[martial.id] ?? 1)
  if (rank >= 3) return { ok: false, message: '这门武学已修至圆满' }
  const silver = rank * 55
  const pages = rank * 12
  if (state.resources.silver < silver || state.resources.pages < pages) {
    return { ok: false, message: `进阶需要 ${silver} 银两与 ${pages} 残页` }
  }
  state.resources.silver -= silver
  state.resources.pages -= pages
  progress.martialRanks[martial.id] = rank + 1
  return { ok: true, message: `${hero.name}的「${martial.name}」进阶至${martial.rankNames[rank]}` }
}

export function setPartySlot(state: GameState, slot: number, heroId: string): ActionResult {
  const hero = heroById(heroId)
  if (!hero || !state.heroes[heroId]?.unlocked || slot < 0 || slot >= state.formation.length) {
    return { ok: false, message: '无法调整这个队伍位置' }
  }
  if (state.combat.mode === 'challenge' && state.combat.status === 'fighting') {
    return { ok: false, message: '挑战中不可换阵，请先完成或退出本场战斗' }
  }
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
  if (state.combat.mode === 'challenge' && state.combat.status === 'fighting') {
    return { ok: false, message: '挑战中不可换位，请先完成或退出本场战斗' }
  }
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

export function applyOfflineProgress(state: GameState, now = Date.now()): OfflineSettlement {
  const rawSeconds = Math.max(0, Math.floor((now - state.lastTickAt) / 1000))
  const seconds = Math.min(rawSeconds, OFFLINE_CAP_SECONDS)
  const region = getSelectedRegion(state)
  const rates = getIdleRewardRates(state)
  const settlement: OfflineSettlement = {
    regionId: region.id,
    seconds,
    silver: Math.floor(seconds * rates.silver),
    experience: Math.floor(seconds * rates.experience),
    pages: Math.floor(seconds * rates.pages),
    enemies: Math.floor(seconds / 12),
    capped: rawSeconds > OFFLINE_CAP_SECONDS,
  }
  state.resources.silver += settlement.silver
  state.resources.experience += settlement.experience
  state.resources.pages += settlement.pages
  state.regionDefeats[region.id] += settlement.enemies
  state.statistics.idleEnemiesDefeated += settlement.enemies
  state.statistics.silverEarned += settlement.silver
  state.statistics.offlineSeconds += seconds
  state.lastTickAt = now
  return settlement
}

export function addIdleTimeRewards(state: GameState, seconds: number): OfflineSettlement {
  state.lastTickAt -= Math.max(0, seconds) * 1000
  return applyOfflineProgress(state, state.lastTickAt + Math.max(0, seconds) * 1000)
}
