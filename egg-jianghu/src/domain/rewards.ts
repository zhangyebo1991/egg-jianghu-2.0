import type { CombatEvent } from '../combat/types'
import { canonicalEnemyId } from '../content/enemy-names'
import { addCareerExperience } from './careers'
import { grantKillLoot } from './loot'
import { applyKillToQuests } from './quests'
import type { GameStateV10 } from './types'

export interface CombatSettlementResult {
  needsSave: boolean
  addedEquipmentUids: string[]
}

/** 原版 c3runtime.js「敌人技能经验量function」。 */
export const skillPointsForEnemyLevel = (enemyLevel: number): number =>
  Math.round(10 + 10 * ((100 + Math.max(0, enemyLevel)) / 1000))

const grantKillProgress = (
  state: GameStateV10,
  event: Extract<CombatEvent, { type: 'enemy-defeated' }>,
): void => {
  const rankMultiplier = event.rank === 'boss' ? 5 : event.rank === 'elite' ? 2 : 1
  const currency = (5 + event.stage * 2) * rankMultiplier
  state.worldCurrency[event.worldId] = (state.worldCurrency[event.worldId] ?? 0) + currency
  state.statistics.kills += 1
  if (event.rank === 'boss') state.statistics.bossKills += 1
  if (!state.encounteredEnemyIds.includes(event.enemyId)) state.encounteredEnemyIds.push(event.enemyId)

  const participatingHeroIds = new Set(state.formation.map((slot) => slot.heroId))
  const skillPoints = skillPointsForEnemyLevel(event.enemyLevel)
  for (const heroId of participatingHeroIds) {
    const hero = state.heroes[heroId]
    if (!hero?.recruited) continue
    const experience = 8 * rankMultiplier
    hero.experience += experience
    while (hero.experience >= hero.level * 100) {
      hero.experience -= hero.level * 100
      hero.level += 1
    }
    addCareerExperience(hero, experience)
    hero.skillPoints += skillPoints
  }
}

export const settleCombatEvent = (
  state: GameStateV10,
  event: CombatEvent,
): CombatSettlementResult => {
  if (event.type !== 'enemy-defeated') return { needsSave: false, addedEquipmentUids: [] }

  const settledEvent = { ...event, enemyId: canonicalEnemyId(event.enemyId) }
  grantKillProgress(state, settledEvent)
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
  })
  return { needsSave: true, addedEquipmentUids }
}
