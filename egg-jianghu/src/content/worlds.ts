import { FACTIONS } from './factions'

export interface WorldDefinition {
  id: string
  name: string
  index: number
  currencyId: string
  factionIds: string[]
  stageIds: string[]
}

export const WORLD_NAMES = [
  '青石江湖',
  '沧浪江湖',
  '听雨江湖',
  '镇岳江湖',
  '藏锋江湖',
  '震山江湖',
  '万仞江湖',
  '朔风江湖',
  '天下江湖',
  '百战江湖',
] as const

export const WORLDS: WorldDefinition[] = WORLD_NAMES.map((name, offset) => {
  const index = offset + 1
  const id = `world_${String(index).padStart(2, '0')}`
  return {
    id,
    name,
    index,
    currencyId: id,
    factionIds: FACTIONS.filter((faction) => faction.worldId === id).map((faction) => faction.id),
    stageIds: Array.from({ length: 10 }, (_, stageOffset) => `${id}_stage_${String(stageOffset + 1).padStart(2, '0')}`),
  }
})

export const worldById = (id: string): WorldDefinition | undefined =>
  WORLDS.find((world) => world.id === id)
