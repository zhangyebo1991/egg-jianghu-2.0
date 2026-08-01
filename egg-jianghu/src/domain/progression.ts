import type { CampaignMode } from './types'

export interface CampaignSelection {
  worldId: string
  stage: number
  mode: CampaignMode
}

const worldIndexOf = (worldId: string): number => Number(worldId.slice(-2)) || 1
const worldIdOf = (index: number): string => `world_${String(index).padStart(2, '0')}`

export const resolveDefeat = (selection: CampaignSelection): CampaignSelection => {
  if (selection.mode === 'guard') return { ...selection, mode: 'guard' }
  return {
    worldId: selection.worldId,
    stage: Math.max(1, selection.stage - 1),
    mode: 'guard',
  }
}

export const resolveVictory = (selection: CampaignSelection): CampaignSelection => {
  if (selection.mode === 'guard') return { ...selection }
  if (selection.stage < 10) return { ...selection, stage: selection.stage + 1 }
  const worldIndex = worldIndexOf(selection.worldId)
  if (worldIndex >= 10) return { ...selection, mode: 'guard' }
  return { worldId: worldIdOf(worldIndex + 1), stage: 1, mode: 'roam' }
}
