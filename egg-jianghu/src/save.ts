import { HEROES, MARTIALS, REGIONS, regionById } from './data'
import { applyOfflineProgress, createInitialState, returnToIdle } from './game'
import type { FormationRow, FormationSlot, GameState, OfflineSettlement } from './types'

export const SAVE_KEY = 'egg-jianghu-2-save-v1'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface LoadResult {
  state: GameState
  settlement: OfflineSettlement | null
  recoveredFromError: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const safeNumber = (value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback

export function hydrateState(raw: unknown, now = Date.now()): GameState {
  if (!isRecord(raw) || (raw.version !== 1 && raw.version !== 2 && raw.version !== 3 && raw.version !== 4 && raw.version !== 5)) {
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
    state.statistics.offlineSeconds = Math.floor(safeNumber(raw.statistics.offlineSeconds, 0))
  }

  state.lastTickAt = Math.min(now, safeNumber(raw.lastTickAt, now))
  state.lastSavedAt = Math.min(now, safeNumber(raw.lastSavedAt, now))
  returnToIdle(state)
  return state
}

export function loadGame(storage: StorageLike, now = Date.now()): LoadResult {
  const serialized = storage.getItem(SAVE_KEY)
  if (!serialized) return { state: createInitialState(now), settlement: null, recoveredFromError: false }
  try {
    const state = hydrateState(JSON.parse(serialized) as unknown, now)
    const settlement = applyOfflineProgress(state, now)
    return { state, settlement, recoveredFromError: false }
  } catch {
    return { state: createInitialState(now), settlement: null, recoveredFromError: true }
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

export function importSave(serialized: string, now = Date.now()): { state: GameState; settlement: OfflineSettlement } {
  const state = hydrateState(JSON.parse(serialized) as unknown, now)
  const settlement = applyOfflineProgress(state, now)
  return { state, settlement }
}

export function clearSave(storage: StorageLike): void {
  storage.removeItem(SAVE_KEY)
}
