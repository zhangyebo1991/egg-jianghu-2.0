import { DIFFICULTY_COUNT, STAGE_COUNT } from '../content/worlds'
import type { CampaignMode } from './types'

export interface CampaignSelection {
  worldId: string
  difficulty: number
  stage: number
  mode: CampaignMode
}

export const progressKey = (worldId: string, difficulty: number): string =>
  `${worldId}:${difficulty}`

export const difficultyLabel = (difficulty: number): string =>
  difficulty === 1 ? '基础' : `难度${difficulty}`

export const clearedStageOf = (
  progress: Record<string, number>,
  worldId: string,
  difficulty: number,
): number => Math.max(0, Math.min(STAGE_COUNT, progress[progressKey(worldId, difficulty)] ?? 0))

export const isDifficultyUnlocked = (
  unlockedWorldIds: readonly string[],
  progress: Record<string, number>,
  worldId: string,
  difficulty: number,
): boolean => {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > DIFFICULTY_COUNT) return false
  if (!unlockedWorldIds.includes(worldId)) return false
  if (difficulty === 1) return true
  return clearedStageOf(progress, worldId, difficulty - 1) >= STAGE_COUNT
}

export const highestUnlockedDifficulty = (
  unlockedWorldIds: readonly string[],
  progress: Record<string, number>,
  worldId: string,
): number => {
  let highest = 0
  for (let difficulty = 1; difficulty <= DIFFICULTY_COUNT; difficulty += 1) {
    if (!isDifficultyUnlocked(unlockedWorldIds, progress, worldId, difficulty)) break
    highest = difficulty
  }
  return highest
}

export const resolveDefeat = (selection: CampaignSelection): CampaignSelection => {
  if (selection.mode === 'guard') return { ...selection, mode: 'guard' }
  return {
    ...selection,
    stage: Math.max(1, selection.stage - 1),
    mode: 'guard',
  }
}

export const resolveVictory = (selection: CampaignSelection): CampaignSelection => {
  if (selection.mode === 'guard') return { ...selection }
  if (selection.stage < STAGE_COUNT) return { ...selection, stage: selection.stage + 1 }
  return { ...selection, mode: 'guard' }
}
