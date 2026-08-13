import { WORLDS, worldById } from './worlds'

export interface WorldPresentation {
  worldId: string
  latinName: string
  currencyName: string
  flavor: string
  stageNames: readonly string[]
}

const PRESENTATIONS: Record<string, WorldPresentation> = Object.fromEntries(
  WORLDS.map((world) => [world.id, {
    worldId: world.id,
    latinName: world.latinName,
    currencyName: world.currencyName,
    flavor: world.flavor,
    stageNames: world.stageNames,
  }]),
)

const fallbackPresentation = (worldId: string): WorldPresentation => {
  const world = worldById(worldId)
  return {
    worldId,
    latinName: world?.latinName ?? 'Jianghu',
    currencyName: world?.currencyName ?? '本面通宝',
    flavor: world?.flavor ?? '此面风物尚待揭开，待侠者踏足其中。',
    stageNames: world?.stageNames ?? Array.from({ length: 10 }, (_, index) => `第${index + 1}关`),
  }
}

export const worldPresentation = (worldId: string): WorldPresentation =>
  PRESENTATIONS[worldId] ?? fallbackPresentation(worldId)

export const WORLD_PRESENTATIONS = PRESENTATIONS
