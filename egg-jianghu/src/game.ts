import { COMBO, ENEMY_NAMES, HEROES, MARTIALS, heroById, martialById } from './data'
import type {
  ActionResult,
  CombatEvent,
  CombatState,
  GameState,
  HeroProgress,
  HeroStats,
  OfflineSettlement,
  PartySynergy,
  Sect,
} from './types'

const MAX_LOGS = 36
export const OFFLINE_CAP_SECONDS = 12 * 60 * 60

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
    version: 1,
    resources: { silver: 180, experience: 90, pages: 15, reputation: 0 },
    heroes,
    unlockedMartials: startingMartials,
    party: HEROES.filter((hero) => hero.initial).slice(0, 3).map((hero) => hero.id),
    clearedStage: 0,
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
  for (const heroId of state.party) {
    const hero = heroById(heroId)
    if (hero) sectCounts.set(hero.sect, (sectCounts.get(hero.sect) ?? 0) + 1)
  }
  const strongest = [...sectCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const sectName = strongest && strongest[1] >= 2 ? strongest[0] : null
  const sectCount = sectName ? strongest[1] : 0
  const attackMultiplier = sectCount >= 3 ? 1.25 : sectCount >= 2 ? 1.12 : 1
  const comboActive = COMBO.heroIds.every((heroId) => state.party.includes(heroId))

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

export function getPartyPower(state: GameState): number {
  const synergy = getPartySynergy(state)
  return Math.round(
    state.party.reduce((total, heroId) => total + getHeroStats(state, heroId).power, 0) * synergy.attackMultiplier,
  )
}

function partyMaxHp(state: GameState): number {
  return state.party.reduce((total, heroId) => total + getHeroStats(state, heroId).hp, 0)
}

function createIdleCombat(state: GameState): CombatState {
  const defeated = state.statistics.idleEnemiesDefeated
  const tier = Math.floor(defeated / 6)
  const enemyMaxHp = 72 + tier * 9
  const maxHp = partyMaxHp(state)
  return {
    mode: 'idle',
    status: 'fighting',
    enemyName: ENEMY_NAMES[defeated % ENEMY_NAMES.length],
    enemyHp: enemyMaxHp,
    enemyMaxHp,
    enemyAttack: 13 + tier * 2,
    partyHp: maxHp,
    partyMaxHp: maxHp,
    turnIndex: 0,
    round: 0,
    stage: 0,
    logs: [],
    lastEvent: null,
  }
}

function createChallengeCombat(state: GameState, stage: number): CombatState {
  const enemyMaxHp = Math.round(420 * stage ** 1.18)
  const maxHp = partyMaxHp(state)
  const titles = ['铁算盘', '断碑手', '黑风寨主', '无面剑客', '赤衣判官']
  return {
    mode: 'challenge',
    status: 'fighting',
    enemyName: `${titles[(stage - 1) % titles.length]} · 第${stage}关`,
    enemyHp: enemyMaxHp,
    enemyMaxHp,
    enemyAttack: Math.round(32 + (stage - 1) * 10.5),
    partyHp: maxHp,
    partyMaxHp: maxHp,
    turnIndex: 0,
    round: 0,
    stage,
    logs: [],
    lastEvent: null,
  }
}

function addLog(
  combat: CombatState,
  kind: CombatEvent['kind'],
  text: string,
  details: Pick<CombatEvent, 'actorId' | 'amount'> = {},
): CombatEvent {
  const lastId = combat.logs.at(-1)?.id ?? 0
  const event: CombatEvent = { id: lastId + 1, kind, text, ...details }
  combat.logs = [...combat.logs.slice(-(MAX_LOGS - 1)), event]
  combat.lastEvent = event
  return event
}

function rewardIdleVictory(state: GameState): void {
  const nextDefeated = state.statistics.idleEnemiesDefeated + 1
  const silver = 12 + Math.floor(nextDefeated / 8) * 2
  const experience = 9 + Math.floor(nextDefeated / 10)
  const pages = nextDefeated % 4 === 0 ? 1 : 0
  state.resources.silver += silver
  state.resources.experience += experience
  state.resources.pages += pages
  state.statistics.idleEnemiesDefeated = nextDefeated
  state.statistics.silverEarned += silver

  const oldLogs = state.combat.logs
  const next = createIdleCombat(state)
  next.logs = oldLogs
  state.combat = next
  addLog(
    state.combat,
    'reward',
    `肃清一路宵小，获得 ${silver} 银两、${experience} 阅历${pages ? '、1 残页' : ''}。`,
  )
}

function rewardChallengeVictory(state: GameState): void {
  const stage = state.combat.stage
  const silver = 90 * stage
  const experience = 70 * stage
  const pages = 4 + stage * 2
  state.resources.silver += silver
  state.resources.experience += experience
  state.resources.pages += pages
  state.resources.reputation += 8 * stage
  state.statistics.silverEarned += silver
  state.statistics.challengesWon += 1
  state.clearedStage = Math.max(state.clearedStage, stage)
  state.combat.status = 'victory'
  addLog(state.combat, 'victory', `破关！江湖声望 +${8 * stage}，并获得丰厚战利品。`)
}

export function stepCombat(state: GameState): void {
  const combat = state.combat
  if (combat.status !== 'fighting' || state.party.length === 0) return

  const synergy = getPartySynergy(state)
  const actorIndex = combat.turnIndex % state.party.length
  const actorId = state.party[actorIndex]
  const actor = heroById(actorId)
  const stats = getHeroStats(state, actorId)
  const comboTurn = synergy.comboActive && actorIndex === 0 && combat.round > 0 && combat.round % 3 === 0

  if (comboTurn) {
    const combinedAttack = COMBO.heroIds.reduce((sum, heroId) => sum + getHeroStats(state, heroId).attack, 0)
    const damage = Math.round(combinedAttack * COMBO.multiplier * synergy.attackMultiplier)
    combat.enemyHp = Math.max(0, combat.enemyHp - damage)
    addLog(combat, 'combo', `合击「${COMBO.name}」贯穿敌阵，造成 ${damage} 伤害！`, { amount: damage })
  } else {
    const martial = state.heroes[actorId]?.equippedMartialId
    const martialName = martial ? martialById(martial)?.name : undefined
    const damage = Math.max(1, Math.round(stats.attack * synergy.attackMultiplier))
    combat.enemyHp = Math.max(0, combat.enemyHp - damage)
    addLog(combat, 'attack', `${actor?.name ?? '侠客'}施展${martialName ? `「${martialName}」` : '拳脚'}，造成 ${damage} 伤害。`, {
      actorId,
      amount: damage,
    })
  }

  if (combat.enemyHp <= 0) {
    if (combat.mode === 'challenge') rewardChallengeVictory(state)
    else rewardIdleVictory(state)
    return
  }

  const wasLastHero = actorIndex === state.party.length - 1
  combat.turnIndex = (combat.turnIndex + 1) % state.party.length
  if (!wasLastHero) return

  combat.round += 1
  const averageDefense = state.party.reduce((sum, heroId) => sum + getHeroStats(state, heroId).defense, 0) / state.party.length
  const enemyDamage = Math.max(5, Math.round(combat.enemyAttack - averageDefense * 0.45))
  combat.partyHp = Math.max(0, combat.partyHp - enemyDamage)
  addLog(combat, 'enemy', `${combat.enemyName}反击，队伍气血损失 ${enemyDamage}。`, { amount: enemyDamage })

  if (combat.partyHp > 0) return
  if (combat.mode === 'challenge') {
    combat.status = 'defeat'
    addLog(combat, 'defeat', '此战落败。提升侠客、调整同门羁绊或尝试合击后再来。')
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
  const stage = state.clearedStage + 1
  state.combat = createChallengeCombat(state, stage)
  addLog(state.combat, 'system', `第 ${stage} 关开始，对手已在古道尽头候战。`)
  return { ok: true, message: `开始挑战第 ${stage} 关` }
}

export function returnToIdle(state: GameState): ActionResult {
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', '队伍回到青石古道继续历练。')
  return { ok: true, message: '已返回挂机历练' }
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
  progress.level += 1
  if (state.combat.mode === 'idle') state.combat.partyMaxHp = partyMaxHp(state)
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
  if (!hero || !state.heroes[heroId]?.unlocked || slot < 0 || slot >= 3) {
    return { ok: false, message: '无法调整这个队伍位置' }
  }
  if (state.combat.mode === 'challenge' && state.combat.status === 'fighting') {
    return { ok: false, message: '挑战中不可换阵，请先完成或退出本场战斗' }
  }
  const oldHero = state.party[slot]
  const existingSlot = state.party.indexOf(heroId)
  state.party[slot] = heroId
  if (existingSlot >= 0 && existingSlot !== slot && oldHero) state.party[existingSlot] = oldHero
  state.combat = createIdleCombat(state)
  addLog(state.combat, 'system', '阵容已调整，众人重新列阵。')
  return { ok: true, message: `${hero.name}已进入第 ${slot + 1} 位` }
}

export function applyOfflineProgress(state: GameState, now = Date.now()): OfflineSettlement {
  const rawSeconds = Math.max(0, Math.floor((now - state.lastTickAt) / 1000))
  const seconds = Math.min(rawSeconds, OFFLINE_CAP_SECONDS)
  const settlement: OfflineSettlement = {
    seconds,
    silver: Math.floor(seconds * 1.35),
    experience: Math.floor(seconds * 0.82),
    pages: Math.floor(seconds / 180),
    enemies: Math.floor(seconds / 12),
    capped: rawSeconds > OFFLINE_CAP_SECONDS,
  }
  state.resources.silver += settlement.silver
  state.resources.experience += settlement.experience
  state.resources.pages += settlement.pages
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
