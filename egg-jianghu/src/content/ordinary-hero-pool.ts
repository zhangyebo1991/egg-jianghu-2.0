import { FACTIONS } from './factions'
import { FACTION_HEROES } from './heroes'

export const ORDINARY_POOL_RULES = { cost: 100, heroRate: 0.012, heroPity: 70, materialIds: [11, 20] } as const

// 仅任务势力；最高声望门槛并列时，保留原招募名录中先出现的角色。
export const ORDINARY_POOL_HEROES = FACTIONS.filter(faction => faction.currencyKind === 'contribution').flatMap(faction => {
  const candidates = FACTION_HEROES.filter(hero => hero.factionId === faction.id)
  if (!candidates.length) return []
  return [candidates.reduce((first, hero) => (hero.requiredReputationLevel ?? 0) > (first.requiredReputationLevel ?? 0) ? hero : first)]
})
const heroIds = new Set(ORDINARY_POOL_HEROES.map(hero => hero.id))
export const isOrdinaryPoolHero = (id: string): boolean => heroIds.has(id)
