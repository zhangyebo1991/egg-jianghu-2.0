import { CAREERS } from './careers'
import { FACTIONS, RARITY_BUDGET_BY_WORLD } from './factions'
import { WORLDS } from './worlds'

export const validateContent = (): string[] => {
  const errors: string[] = []
  const careerIds = new Set(CAREERS.map((item) => item.id))
  const factionIds = new Set(FACTIONS.map((item) => item.id))
  const worldIds = new Set(WORLDS.map((item) => item.id))

  if (careerIds.size !== CAREERS.length) errors.push('职业 id 重复')
  if (factionIds.size !== FACTIONS.length) errors.push('势力 id 重复')
  if (worldIds.size !== WORLDS.length) errors.push('江湖卷 id 重复')

  for (const career of CAREERS) {
    if (career.previousId && !careerIds.has(career.previousId)) errors.push(`${career.id} 前置职业不存在`)
    if (career.nextId && !careerIds.has(career.nextId)) errors.push(`${career.id} 后继职业不存在`)
  }

  for (const faction of FACTIONS) {
    if (!worldIds.has(faction.worldId)) errors.push(`${faction.id} 引用了未知江湖卷 ${faction.worldId}`)
  }

  for (const world of WORLDS) {
    if (world.stageIds.length !== 10) errors.push(`${world.id} 小关数不是 10`)
    if (world.factionIds.length !== 3) errors.push(`${world.id} 势力数不是 3`)
    if (RARITY_BUDGET_BY_WORLD[world.id]?.length !== 8) errors.push(`${world.id} 稀有度预算不是 8`)
    for (const id of world.factionIds) {
      if (!factionIds.has(id)) errors.push(`${world.id} 引用了未知势力 ${id}`)
    }
  }

  return errors
}
