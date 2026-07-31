import { HEROES, MARTIALS, MYSTERY_BLESSINGS, MYSTERY_ENCOUNTERS, REGIONS, regionById } from './data'
import { createInitialState, getMysteryChoices, resumeMysteryCombat, returnToIdle } from './game'
import type { FormationRow, FormationSlot, GameState, MysteryBlessingId } from './types'

export const SAVE_KEY = 'egg-jianghu-2-save-v1'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface LoadResult {
  state: GameState
  recoveredFromError: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const safeNumber = (value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback

export function hydrateState(raw: unknown, now = Date.now()): GameState {
  if (!isRecord(raw) || (raw.version !== 1 && raw.version !== 2 && raw.version !== 3 && raw.version !== 4 && raw.version !== 5 && raw.version !== 6)) {
    throw new Error('存档版本不受支持或格式无效')
  }
  const state = createInitialState(now)

  if (isRecord(raw.resources)) {
    state.resources.silver = safeNumber(raw.resources.silver, state.resources.silver)
    state.resources.experience = safeNumber(raw.resources.experience, state.resources.experience)
    state.resources.pages = safeNumber(raw.resources.pages, state.resources.pages)
    state.resources.reputation = safeNumber(raw.resources.reputation, state.resources.reputation)
  }

  const allowedMartials = new Set(MARTIALS.map((martial) => martial.id))
  const importedMartials = Array.isArray(raw.unlockedMartials)
    ? raw.unlockedMartials.filter((id): id is string => typeof id === 'string' && allowedMartials.has(id))
    : []
  state.unlockedMartials = [...new Set([
    ...MARTIALS.filter((martial) => martial.initial).map((martial) => martial.id),
    ...importedMartials,
  ])]

  if (isRecord(raw.heroes)) {
    for (const hero of HEROES) {
      const imported = raw.heroes[hero.id]
      if (!isRecord(imported)) continue
      const progress = state.heroes[hero.id]
      progress.unlocked = hero.initial || imported.unlocked === true
      progress.level = Math.floor(safeNumber(imported.level, 1, 999)) || 1
      const equipped = typeof imported.equippedMartialId === 'string' ? imported.equippedMartialId : null
      progress.equippedMartialId = equipped && state.unlockedMartials.includes(equipped)
        ? equipped
        : progress.unlocked ? state.unlockedMartials[0] ?? null : null
      progress.martialRanks = {}
      if (isRecord(imported.martialRanks)) {
        for (const [martialId, rank] of Object.entries(imported.martialRanks)) {
          if (allowedMartials.has(martialId)) progress.martialRanks[martialId] = Math.max(1, Math.floor(safeNumber(rank, 1, 3)))
        }
      }
      if (progress.equippedMartialId) progress.martialRanks[progress.equippedMartialId] ??= 1
    }
  }

  const availableHeroIds = HEROES.filter((hero) => state.heroes[hero.id].unlocked).map((hero) => hero.id)
  const importedFormation: FormationSlot[] = []
  if (Array.isArray(raw.formation)) {
    for (const entry of raw.formation) {
      if (!isRecord(entry) || typeof entry.heroId !== 'string' || !availableHeroIds.includes(entry.heroId)) continue
      if (importedFormation.some((slot) => slot.heroId === entry.heroId)) continue
      const row: FormationRow = entry.row === 'back' ? 'back' : 'front'
      importedFormation.push({ heroId: entry.heroId, row })
    }
  } else if (Array.isArray(raw.party)) {
    for (const heroId of raw.party) {
      if (typeof heroId !== 'string' || !availableHeroIds.includes(heroId)) continue
      if (importedFormation.some((slot) => slot.heroId === heroId)) continue
      importedFormation.push({ heroId, row: importedFormation.length < 2 ? 'front' : 'back' })
    }
  }

  state.formation = importedFormation.slice(0, 3)
  for (const heroId of availableHeroIds) {
    if (state.formation.length >= 3) break
    if (!state.formation.some((slot) => slot.heroId === heroId)) {
      state.formation.push({ heroId, row: state.formation.length < 2 ? 'front' : 'back' })
    }
  }
  if (!state.formation.some((slot) => slot.row === 'front')) state.formation[0].row = 'front'
  if (!state.formation.some((slot) => slot.row === 'back')) state.formation.at(-1)!.row = 'back'
  const allowedBossIds = new Set(REGIONS.map((region) => region.boss.id))
  if (Array.isArray(raw.defeatedBossIds)) {
    state.defeatedBossIds = [...new Set(raw.defeatedBossIds.filter(
      (id): id is string => typeof id === 'string' && allowedBossIds.has(id),
    ))]
  } else {
    const legacyClears = Math.floor(safeNumber(raw.clearedStage, 0, REGIONS.length))
    state.defeatedBossIds = REGIONS.slice(0, legacyClears).map((region) => region.boss.id)
  }

  if (isRecord(raw.regionDefeats)) {
    for (const region of REGIONS) {
      state.regionDefeats[region.id] = Math.floor(safeNumber(raw.regionDefeats[region.id], 0))
    }
  } else if (isRecord(raw.statistics)) {
    state.regionDefeats.bluestone_path = Math.floor(safeNumber(raw.statistics.idleEnemiesDefeated, 0))
  }

  const importedRegion = typeof raw.selectedRegionId === 'string' ? regionById(raw.selectedRegionId) : undefined
  if (importedRegion && (importedRegion.requiredBossId === null || state.defeatedBossIds.includes(importedRegion.requiredBossId))) {
    state.selectedRegionId = importedRegion.id
  }

  if (isRecord(raw.statistics)) {
    state.statistics.idleEnemiesDefeated = Math.floor(safeNumber(raw.statistics.idleEnemiesDefeated, 0))
    state.statistics.challengesWon = Math.floor(safeNumber(raw.statistics.challengesWon, 0))
    state.statistics.silverEarned = Math.floor(safeNumber(raw.statistics.silverEarned, 0))
  }

  if (isRecord(raw.mystery)) {
    state.mystery.runsCompleted = Math.floor(safeNumber(raw.mystery.runsCompleted, 0))
    state.mystery.bestFloor = Math.floor(safeNumber(raw.mystery.bestFloor, 0, MYSTERY_ENCOUNTERS.length))
    if (isRecord(raw.mystery.run)) {
      const importedRun = raw.mystery.run
      const seed = Math.floor(safeNumber(importedRun.seed, 1)) || 1
      const floor = Math.floor(safeNumber(importedRun.floor, 0, MYSTERY_ENCOUNTERS.length))
      const allowedBlessings = new Set(MYSTERY_BLESSINGS.map((blessing) => blessing.id))
      const blessingIds = Array.isArray(importedRun.blessingIds)
        ? importedRun.blessingIds.filter((id): id is MysteryBlessingId => typeof id === 'string' && allowedBlessings.has(id as MysteryBlessingId))
        : []
      const importedStatus = importedRun.status
      const status = floor >= MYSTERY_ENCOUNTERS.length
        ? 'completed'
        : importedStatus === 'fighting'
          ? 'fighting'
          : importedStatus === 'failed'
            ? 'failed'
            : 'choosing'
      const earned = isRecord(importedRun.earned) ? importedRun.earned : {}
      state.mystery.run = {
        seed,
        floor,
        status,
        blessingIds,
        choiceIds: status === 'choosing' ? getMysteryChoices(seed, floor) : [],
        earned: {
          silver: safeNumber(earned.silver, 0),
          experience: safeNumber(earned.experience, 0),
          pages: safeNumber(earned.pages, 0),
          reputation: safeNumber(earned.reputation, 0),
        },
      }
      state.mystery.bestFloor = Math.max(state.mystery.bestFloor, floor)
    }
  }

  state.lastTickAt = Math.min(now, safeNumber(raw.lastTickAt, now))
  state.lastSavedAt = Math.min(now, safeNumber(raw.lastSavedAt, now))
  returnToIdle(state)
  if (state.mystery.run?.status === 'fighting') resumeMysteryCombat(state)
  return state
}

export function loadGame(storage: StorageLike, now = Date.now()): LoadResult {
  const serialized = storage.getItem(SAVE_KEY)
  if (!serialized) return { state: createInitialState(now), recoveredFromError: false }
  try {
    const state = hydrateState(JSON.parse(serialized) as unknown, now)
    return { state, recoveredFromError: false }
  } catch {
    return { state: createInitialState(now), recoveredFromError: true }
  }
}

export function saveGame(storage: StorageLike, state: GameState, now = Date.now()): void {
  state.lastSavedAt = now
  state.lastTickAt = now
  storage.setItem(SAVE_KEY, JSON.stringify(state))
}

export function exportSave(state: GameState): string {
  return JSON.stringify({ ...state, lastSavedAt: Date.now(), lastTickAt: Date.now() }, null, 2)
}

export function importSave(serialized: string, now = Date.now()): { state: GameState } {
  const state = hydrateState(JSON.parse(serialized) as unknown, now)
  return { state }
}

export function clearSave(storage: StorageLike): void {
  storage.removeItem(SAVE_KEY)
}
