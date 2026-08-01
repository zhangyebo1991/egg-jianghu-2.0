import { HEROES, MARTIALS, MYSTERY_BLESSINGS, MYSTERY_ENCOUNTERS, REGIONS, regionById } from './data'
import {
  KILLS_PER_STAGE,
  STAGES_PER_REGION,
  createInitialState,
  getMysteryChoices,
  MAX_FORMATION_ROW_SIZE,
  resumeMysteryCombat,
  returnToIdle,
} from './game'
import {
  MAX_LEARNED_MARTIALS,
  createLearnedMartial,
  emptyEquippedMartialIds,
  getLegacyInvestment,
} from './martials'
import type { FormationPosition, FormationRow, FormationSlot, GameState, MysteryBlessingId } from './types'

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

const normalizePosition = (value: unknown): FormationPosition =>
  value === 0 || value === 1 || value === 2 ? value : 0

const safeInvestment = (value: unknown) => {
  const source = isRecord(value) ? value : {}
  return {
    silver: safeNumber(source.silver, 0),
    experience: safeNumber(source.experience, 0),
    pages: safeNumber(source.pages, 0),
    reputation: safeNumber(source.reputation, 0),
  }
}

const hydrateVersion7Martials = (
  imported: Record<string, unknown>,
  allowedMartials: Set<string>,
) => {
  const learnedMartials: GameState['heroes'][string]['learnedMartials'] = {}
  if (isRecord(imported.learnedMartials)) {
    for (const [martialId, value] of Object.entries(imported.learnedMartials)) {
      if (!allowedMartials.has(martialId) || !isRecord(value)) continue
      learnedMartials[martialId] = createLearnedMartial(
        Math.max(1, Math.floor(safeNumber(value.rank, 1, 3))),
        safeInvestment(value.invested),
      )
      if (Object.keys(learnedMartials).length >= MAX_LEARNED_MARTIALS) break
    }
  }
  const equippedMartialIds = emptyEquippedMartialIds()
  const importedSlots = Array.isArray(imported.equippedMartialIds) ? imported.equippedMartialIds : []
  for (let slot = 0; slot < equippedMartialIds.length; slot += 1) {
    const martialId = importedSlots[slot]
    if (typeof martialId !== 'string' || !learnedMartials[martialId]) continue
    if (equippedMartialIds.includes(martialId)) continue
    equippedMartialIds[slot] = martialId
  }
  return { learnedMartials, equippedMartialIds }
}

const hydrateLegacyMartials = (
  imported: Record<string, unknown>,
  allowedMartials: Set<string>,
) => {
  const learnedMartials: GameState['heroes'][string]['learnedMartials'] = {}
  if (isRecord(imported.martialRanks)) {
    for (const [martialId, value] of Object.entries(imported.martialRanks)) {
      if (!allowedMartials.has(martialId)) continue
      const rank = Math.max(1, Math.floor(safeNumber(value, 1, 3)))
      learnedMartials[martialId] = createLearnedMartial(rank, getLegacyInvestment(rank))
      if (Object.keys(learnedMartials).length >= MAX_LEARNED_MARTIALS) break
    }
  }
  const equipped = typeof imported.equippedMartialId === 'string' && allowedMartials.has(imported.equippedMartialId)
    ? imported.equippedMartialId
    : null
  if (equipped) learnedMartials[equipped] ??= createLearnedMartial()
  const equippedMartialIds = emptyEquippedMartialIds()
  equippedMartialIds[0] = equipped
  return { learnedMartials, equippedMartialIds }
}

export function hydrateState(raw: unknown, now = Date.now()): GameState {
  if (!isRecord(raw) || (raw.version !== 1 && raw.version !== 2 && raw.version !== 3 && raw.version !== 4 && raw.version !== 5 && raw.version !== 6 && raw.version !== 7 && raw.version !== 8 && raw.version !== 9)) {
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
      const martialProgress = raw.version === 7 || raw.version === 8 || raw.version === 9
        ? hydrateVersion7Martials(imported, allowedMartials)
        : hydrateLegacyMartials(imported, allowedMartials)
      progress.learnedMartials = martialProgress.learnedMartials
      progress.equippedMartialIds = martialProgress.equippedMartialIds
    }
  }

  const availableHeroIds = HEROES.filter((hero) => state.heroes[hero.id].unlocked).map((hero) => hero.id)
  const importedFormation: FormationSlot[] = []
  if (Array.isArray(raw.formation)) {
    for (const entry of raw.formation) {
      if (!isRecord(entry) || typeof entry.heroId !== 'string' || !availableHeroIds.includes(entry.heroId)) continue
      if (importedFormation.some((slot) => slot.heroId === entry.heroId)) continue
      const row: FormationRow = entry.row === 'back' ? 'back' : 'front'
      const position = raw.version === 8 || raw.version === 9 ? normalizePosition(entry.position) : 0
      importedFormation.push({ heroId: entry.heroId, row, position })
    }
  } else if (Array.isArray(raw.party)) {
    for (const heroId of raw.party) {
      if (typeof heroId !== 'string' || !availableHeroIds.includes(heroId)) continue
      if (importedFormation.some((slot) => slot.heroId === heroId)) continue
      importedFormation.push({ heroId, row: importedFormation.length < 2 ? 'front' : 'back', position: 0 })
    }
  }

  // 阵容约束：每排最多 3 人；不强制补满，尊重玩家主动的减员
  const rowCounts: Record<FormationRow, number> = { front: 0, back: 0 }
  state.formation = importedFormation.filter((slot) => {
    if (rowCounts[slot.row] >= MAX_FORMATION_ROW_SIZE) return false
    rowCounts[slot.row] += 1
    return true
  })
  if (state.formation.length === 0) {
    // 空阵容无法战斗：用已拥有侠客补一支默认队伍（前排两人、后排一人）
    for (const heroId of availableHeroIds.slice(0, 3)) {
      state.formation.push({ heroId, row: state.formation.length < 2 ? 'front' : 'back', position: 0 })
    }
  }
  // position 归一化：v8/v9 保留存档站位并修复同排冲突；旧档按排内顺序紧凑分配
  if (raw.version === 8 || raw.version === 9) {
    const usedByRow: Record<FormationRow, Set<FormationPosition>> = { front: new Set(), back: new Set() }
    for (const slot of state.formation) {
      const used = usedByRow[slot.row]
      if (used.has(slot.position)) {
        const fallback = ([0, 1, 2] as const).find((position) => !used.has(position))
        slot.position = fallback ?? 0
      }
      used.add(slot.position)
    }
  } else {
    const counters: Record<FormationRow, number> = { front: 0, back: 0 }
    for (const slot of state.formation) {
      slot.position = counters[slot.row] as FormationPosition
      counters[slot.row] += 1
    }
  }
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

  // 小关递进进度：v9 档保留原值；旧档按击杀数估算，并用当前挂机关兜底，避免"高关被锁"
  for (const region of REGIONS) {
    const rawValue = isRecord(raw.regionCleared) ? Math.floor(safeNumber(raw.regionCleared[region.id], 0)) : 0
    const estimate = Math.floor(state.regionDefeats[region.id] / KILLS_PER_STAGE)
    const activeStage = isRecord(raw.combat) && raw.combat.regionId === region.id
      ? Math.floor(safeNumber(raw.combat.stage, 1))
      : 1
    state.regionCleared[region.id] = Math.min(STAGES_PER_REGION, Math.max(rawValue, estimate, activeStage - 1))
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
    const raw = JSON.parse(serialized) as unknown
    const state = hydrateState(raw, now)
    if (isRecord(raw) && raw.version !== 9) saveGame(storage, state, now)
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
