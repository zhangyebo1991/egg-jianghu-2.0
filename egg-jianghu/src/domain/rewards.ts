import type { CombatEvent } from '../combat/types'
import { canonicalEnemyId } from '../content/enemy-names'
import { addCareerExperience } from './careers'
import { grantKillLoot } from './loot'
import { premiumBonuses, premiumProgressReward } from './premium-cards'
import { applyKillToQuests } from './quests'
import type { GameStateV10 } from './types'

export interface CombatSettlementResult {
  needsSave: boolean
  addedEquipmentUids: string[]
}

/** 原版「人物升级经验」：当前等级升至下一级的单级门槛。 */
export const heroExperienceForNextLevel = (level: number): number =>
  Math.round(10000 * Math.pow(1.129, Math.max(1, level) - 1) - 9000)

/** enemyLevel 对应原版战斗核心的「难度系数」。 */
export const heroExperienceForEnemyLevel = (enemyLevel: number): number => {
  const difficulty = Math.max(0, enemyLevel)
  return Math.round(50 + 10 * Math.pow(1.01, difficulty) + 2 * difficulty)
}

export const careerExperienceForEnemyLevel = (enemyLevel: number): number =>
  Math.round(10 * ((100 + Math.max(0, enemyLevel)) / 200))

/** 原版 c3runtime.js「敌人技能经验量function」。 */
export const skillPointsForEnemyLevel = (enemyLevel: number): number =>
  Math.round(10 + 10 * ((100 + Math.max(0, enemyLevel)) / 1000))

const grantKillProgress = (
  state: GameStateV10,
  event: Extract<CombatEvent, { type: 'enemy-defeated' }>,
  now: number,
): void => {
  const rankMultiplier = event.rank === 'boss' ? 5 : event.rank === 'elite' ? 2 : 1
  const currency = (5 + event.stage * 2) * rankMultiplier
  state.worldCurrency[event.worldId] = (state.worldCurrency[event.worldId] ?? 0) + currency
  state.statistics.kills += 1
  if (event.rank === 'boss') state.statistics.bossKills += 1
  if (!state.encounteredEnemyIds.includes(event.enemyId)) state.encounteredEnemyIds.push(event.enemyId)

  const participatingHeroIds = new Set(state.formation.map((slot) => slot.heroId))
  const skillPoints = skillPointsForEnemyLevel(event.enemyLevel)
  const bonus = premiumBonuses(state, now)
  for (const heroId of participatingHeroIds) {
    const hero = state.heroes[heroId]
    if (!hero?.recruited) continue
    const experience = premiumProgressReward(state, heroId, 'experience', heroExperienceForEnemyLevel(event.enemyLevel), bonus.experience)
    hero.experience += experience
    while (hero.experience >= heroExperienceForNextLevel(hero.level)) {
      hero.experience -= heroExperienceForNextLevel(hero.level)
      hero.level += 1
    }
    const careerExperience = premiumProgressReward(state, heroId, 'careerExperience', careerExperienceForEnemyLevel(event.enemyLevel), bonus.experience)
    addCareerExperience(hero, careerExperience)
    hero.skillPoints += premiumProgressReward(state, heroId, 'skillPoints', skillPoints, bonus.skillPoints)
  }
}

export const settleCombatEvent = (
  state: GameStateV10,
  event: CombatEvent,
  now = Date.now(),
): CombatSettlementResult => {
  if (event.type !== 'enemy-defeated') return { needsSave: false, addedEquipmentUids: [] }

  const settledEvent = { ...event, enemyId: canonicalEnemyId(event.enemyId) }
  grantKillProgress(state, settledEvent, now)
  applyKillToQuests(state, {
    enemyId: settledEvent.enemyId,
    rank: settledEvent.rank,
    bossId: settledEvent.rank === 'boss' ? settledEvent.enemyId : null,
  })
  const addedEquipmentUids = grantKillLoot(state, {
    worldId: settledEvent.worldId,
    difficulty: settledEvent.difficulty ?? 1,
    stage: settledEvent.stage,
    rank: settledEvent.rank,
    seed: settledEvent.seed,
    enemyId: settledEvent.enemyId,
  }, now)
  return { needsSave: true, addedEquipmentUids }
}
