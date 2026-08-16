import { createCombatEngine, type CombatEngine } from '../combat/engine'
import { createRng, type Rng } from '../combat/rng'
import { buildAttributeMap, buildCareerCombatCoefficients, buildCombatStats, equippedMainhandWeaponType } from '../combat/stats'
import type { CombatEvent, CombatStartInput, CombatUnit, StageSelectionInput } from '../combat/types'
import { careerById } from '../content/careers'
import { FACTIONS } from '../content/factions'
import { heroByIdV10, heroDisplayNameV10 } from '../content/heroes'
import { WORLDS } from '../content/worlds'
import {
  clearedStageOf,
  isDifficultyUnlocked,
  progressKey,
  resolveDefeat,
  resolveVictory,
  type CampaignSelection,
} from '../domain/progression'
import { advanceQuestBoards, initializeQuestBoard } from '../domain/quests'
import { settleCombatEvent } from '../domain/rewards'
import { loadExistingGameV10, loadGameV10, SAVE_KEY_V10, saveGameV10, type StorageLike } from '../domain/save-v10'
import { createNewGameStateV10 } from '../domain/state'
import type { ActionResult, CampaignMode, GameStateV10 } from '../domain/types'

// 阵位号：row * 5 + col（0-14），与诸天「(排-1)*5+列」对齐
const formationOrder = (row: 0 | 1 | 2, col: 0 | 1 | 2 | 3 | 4): number => row * 5 + col

export const buildCombatParty = (state: GameStateV10): CombatUnit[] => state.formation
  .slice()
  .sort((left, right) => formationOrder(left.row, left.col) - formationOrder(right.row, right.col))
  .flatMap((slot) => {
    const progress = state.heroes[slot.heroId]
    const definition = heroByIdV10(slot.heroId)
    if (!progress?.recruited || !definition) return []
    const stats = buildCombatStats(definition, progress, state.inventory)
    return [{
      id: slot.heroId,
      name: heroDisplayNameV10(definition, progress),
      careerId: progress.currentCareerId,
      careerCoefficients: buildCareerCombatCoefficients(progress),
      side: 'party' as const,
      row: slot.row,
      col: slot.col,
      formationOrder: formationOrder(slot.row, slot.col),
      rank: 'normal' as const,
      alive: true,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      shield: 0,
      energy: Math.min(5, stats.initialEnergy),
      maxEnergy: 5,
      gauge: 0,
      effectiveAgility: stats.effectiveAgility,
      externalAttack: stats.externalAttack,
      internalAttack: stats.internalAttack,
      externalDefense: stats.externalDefense,
      internalDefense: stats.internalDefense,
      accuracy: stats.accuracy,
      evade: stats.evade,
      criticalChance: stats.criticalChance,
      criticalMultiplier: stats.criticalMultiplier,
      controlResistance: stats.controlResistance,
      cooldowns: {},
      statuses: [],
      skillIds: [],
      baseAttackId: careerById(progress.currentCareerId)?.basicAttackSkillId ?? 1,
      mainhandWeaponType: equippedMainhandWeaponType(progress, state.inventory),
      attributes: buildAttributeMap(definition, progress, state.inventory),
    }]
  })

export const buildCombatStartInput = (
  state: GameStateV10,
  input: StageSelectionInput,
): CombatStartInput => ({ ...input, party: buildCombatParty(state) })

export class SaveConflictError extends Error {
  readonly actualSnapshot: string | null

  constructor(actualSnapshot: string | null) {
    super('存档已在其他窗口发生变化')
    this.name = 'SaveConflictError'
    this.actualSnapshot = actualSnapshot
  }
}

const ORIGINAL_AUTO_RESTART_COUNTDOWN_MS = 3000
const ORIGINAL_RESTART_CLOSE_MS = 300

export interface PendingCombatRestart {
  outcome: 'victory' | 'defeat'
  selection: CampaignSelection
  elapsedMs: number
  countdownMs: number
  durationMs: number
}

export class GameSession {
  readonly state: GameStateV10
  combat: CombatEngine | null = null
  selection: CampaignSelection | null = null
  pendingCombatRestart: PendingCombatRestart | null = null
  private readonly runtimeRng: Rng
  private readonly combatRng: Rng
  private readonly storage: StorageLike
  private expectedSaveSnapshot: string | null

  private constructor(state: GameStateV10, storage: StorageLike, expectedSaveSnapshot: string | null) {
    this.state = state
    this.storage = storage
    this.expectedSaveSnapshot = expectedSaveSnapshot
    this.runtimeRng = createRng(state.lastSavedAt)
    this.combatRng = createRng(state.lastSavedAt)
    this.ensureFactionBoards()
  }

  static create(storage: StorageLike, now = Date.now()): GameSession {
    const loaded = loadGameV10(storage, now)
    return new GameSession(loaded.state, storage, loaded.serialized)
  }

  static createNew(storage: StorageLike, playerName: string, now = Date.now(), expectedSnapshot?: string | null): GameSession {
    const snapshot = expectedSnapshot === undefined ? storage.getItem(SAVE_KEY_V10) : expectedSnapshot
    const session = new GameSession(createNewGameStateV10(playerName, now), storage, snapshot)
    session.save(now)
    return session
  }

  static continue(storage: StorageLike, now = Date.now()): GameSession {
    const loaded = loadExistingGameV10(storage, now)
    if (!loaded) throw new Error('没有可继续的存档')
    if (loaded.recoveredFromError) throw new Error('存档无法读取')
    return new GameSession(loaded.state, storage, loaded.serialized)
  }

  save(now = Date.now()): void {
    const currentSnapshot = this.storage.getItem(SAVE_KEY_V10)
    if (currentSnapshot !== this.expectedSaveSnapshot) throw new SaveConflictError(currentSnapshot)
    this.expectedSaveSnapshot = saveGameV10(this.storage, this.state, now)
  }

  startStage(input: StageSelectionInput): ActionResult {
    const world = WORLDS.find((item) => item.id === input.worldId)
    const difficulty = input.difficulty ?? 1
    if (!world?.released) return { ok: false, message: '该位面尚未开放' }
    if (!this.state.unlockedWorldIds.includes(input.worldId)) return { ok: false, message: '位面尚未解锁' }
    if (!isDifficultyUnlocked(this.state.unlockedWorldIds, this.state.clearedStageByWorldDifficulty, input.worldId, difficulty)) {
      return { ok: false, message: '难度尚未解锁' }
    }
    if (!Number.isInteger(input.stage) || input.stage < 1 || input.stage > 10) return { ok: false, message: '小关不存在' }
    const highestUnlockedStage = Math.min(10, Math.max(
      1,
      clearedStageOf(this.state.clearedStageByWorldDifficulty, input.worldId, difficulty) + 1,
    ))
    if (input.stage > highestUnlockedStage) return { ok: false, message: '小关尚未解锁' }
    const combatInput = buildCombatStartInput(this.state, { ...input, difficulty })
    if (combatInput.party.length === 0) return { ok: false, message: '请先配置出战阵容' }

    this.selection = { worldId: input.worldId, difficulty, stage: input.stage, mode: input.mode }
    this.combat = createCombatEngine(combatInput)
    this.pendingCombatRestart = null
    return { ok: true, message: '战斗开始' }
  }

  advanceTicks(count: number): CombatEvent[] {
    return this.advanceCombatTime(Math.max(0, Math.floor(count)) * 100)
  }

  advanceRealtimeTicks(count: number): CombatEvent[] {
    const safeCount = Math.max(0, Math.floor(count))
    return this.advanceCombatTime(safeCount * 100)
  }

  advanceCombatTime(elapsedMs: number): CombatEvent[] {
    if (!this.combat) return []
    const events: CombatEvent[] = []
    let remainingMs = Math.max(0, elapsedMs)
    let changed = false

    while (this.combat) {
      const pending = this.pendingCombatRestart
      if (pending) {
        const pendingRemainingMs = Math.max(0, pending.durationMs - pending.elapsedMs)
        if (pendingRemainingMs > 0) {
          if (remainingMs <= 0) break
          const stepMs = Math.min(remainingMs, pendingRemainingMs)
          pending.elapsedMs += stepMs
          remainingMs -= stepMs
          if (pending.elapsedMs < pending.durationMs) break
        }
        const restartSelection = pending.selection
        this.pendingCombatRestart = null
        this.restartSelection(restartSelection)
        if (remainingMs <= 0) break
        continue
      }

      const beforeMs = this.combat.state.elapsedMs
      const combatEvents = this.combat.advance(remainingMs)
      const consumedMs = this.combat.state.elapsedMs - beforeMs
      remainingMs = Math.max(0, remainingMs - consumedMs)
      events.push(...combatEvents)
      for (const event of combatEvents) {
        changed = settleCombatEvent(this.state, event).needsSave || changed
      }
      changed = this.handleResult() || changed

      if (this.pendingCombatRestart) continue
      if (remainingMs <= 0 || consumedMs <= 0 || this.combat.state.result === 'fighting') break
    }

    if (changed) {
      this.ensureFactionBoards(true)
      this.save()
    }
    return events
  }

  advanceRuntime(elapsedMs: number): void {
    const before = JSON.stringify(this.state.factionBoards)
    advanceQuestBoards(this.state, elapsedMs, this.runtimeRng)
    if (JSON.stringify(this.state.factionBoards) !== before) this.save()
  }

  setCombatMode(mode: CampaignMode): ActionResult {
    if (!this.combat
      || !this.selection
      || this.combat.state.result !== 'fighting'
      || this.combat.state.timeline.phase === 'ending') {
      return { ok: false, message: '当前没有进行中的战斗' }
    }
    this.selection = { ...this.selection, mode }
    this.combat.setMode(mode)
    return { ok: true, message: mode === 'guard' ? '已切换为驻守' : '已切换为闯荡' }
  }

  stopCombat(): void {
    this.combat?.stop()
    this.combat = null
    this.selection = null
    this.pendingCombatRestart = null
  }

  private ensureFactionBoards(refillEmpty = false): void {
    const unlocked = new Set(this.state.unlockedFactionIds)
    for (const faction of FACTIONS) {
      if (!unlocked.has(faction.id)) continue
      const board = this.state.factionBoards[faction.id]
      if (!board || (refillEmpty && board.slots.every((slot) => slot === null))) {
        initializeQuestBoard(this.state, faction.id, this.runtimeRng, 0)
      }
    }
  }

  private restartSelection(selection: CampaignSelection): void {
    this.selection = selection
    this.combat = createCombatEngine(buildCombatStartInput(this.state, {
      worldId: selection.worldId,
      difficulty: selection.difficulty,
      stage: selection.stage,
      mode: selection.mode,
      seed: this.combatRng.nextInt(1, 2_147_483_647),
    }))
  }

  private handleResult(): boolean {
    if (!this.combat || !this.selection || this.pendingCombatRestart) return false
    if (this.combat.state.result === 'victory') {
      const completed = this.selection
      const key = progressKey(completed.worldId, completed.difficulty)
      this.state.clearedStageByWorldDifficulty[key] = Math.max(
        this.state.clearedStageByWorldDifficulty[key] ?? 0,
        completed.stage,
      )
      if (completed.stage === 10 && completed.difficulty === 1) {
        const currentIndex = WORLDS.findIndex((world) => world.id === completed.worldId)
        const nextWorld = WORLDS[currentIndex + 1]
        if (nextWorld?.released && !this.state.unlockedWorldIds.includes(nextWorld.id)) {
          this.state.unlockedWorldIds.push(nextWorld.id)
          this.state.unlockedFactionIds.push(...FACTIONS
            .filter((faction) => faction.worldId === nextWorld.id)
            .map((faction) => faction.id)
            .filter((factionId) => !this.state.unlockedFactionIds.includes(factionId)))
          this.state.worldCurrency[nextWorld.id] ??= 0
          this.state.clearedStageByWorldDifficulty[progressKey(nextWorld.id, 1)] ??= 0
          this.ensureFactionBoards()
        }
      }
      this.pendingCombatRestart = {
        outcome: 'victory',
        selection: resolveVictory(completed),
        elapsedMs: 0,
        countdownMs: ORIGINAL_AUTO_RESTART_COUNTDOWN_MS,
        durationMs: completed.mode === 'roam'
          ? 0
          : ORIGINAL_AUTO_RESTART_COUNTDOWN_MS + ORIGINAL_RESTART_CLOSE_MS,
      }
      return true
    }
    if (this.combat.state.result === 'defeat') {
      this.pendingCombatRestart = {
        outcome: 'defeat',
        selection: resolveDefeat(this.selection),
        elapsedMs: 0,
        countdownMs: ORIGINAL_AUTO_RESTART_COUNTDOWN_MS,
        durationMs: ORIGINAL_AUTO_RESTART_COUNTDOWN_MS + ORIGINAL_RESTART_CLOSE_MS,
      }
    }
    return false
  }
}
