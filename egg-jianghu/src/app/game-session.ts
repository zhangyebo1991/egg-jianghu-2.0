import { createCombatEngine, type CombatEngine } from '../combat/engine'
import { createRng, type Rng } from '../combat/rng'
import { buildCombatStats } from '../combat/stats'
import type { CombatEvent, CombatStartInput, CombatUnit, StageSelectionInput } from '../combat/types'
import { FACTIONS } from '../content/factions'
import { heroByIdV10, heroDisplayNameV10 } from '../content/heroes'
import { WORLDS } from '../content/worlds'
import { resolveDefeat, resolveVictory, type CampaignSelection } from '../domain/progression'
import { advanceQuestBoards, initializeQuestBoard } from '../domain/quests'
import { settleCombatEvent } from '../domain/rewards'
import { loadGameV10, saveGameV10, type StorageLike } from '../domain/save-v10'
import type { ActionResult, CampaignMode, GameStateV10 } from '../domain/types'

const formationOrder = (row: 'front' | 'back', position: 0 | 1 | 2): number =>
  (row === 'front' ? 0 : 3) + position

export const buildCombatParty = (state: GameStateV10): CombatUnit[] => state.formation
  .slice()
  .sort((left, right) => formationOrder(left.row, left.position) - formationOrder(right.row, right.position))
  .flatMap((slot) => {
    const progress = state.heroes[slot.heroId]
    const definition = heroByIdV10(slot.heroId)
    if (!progress?.recruited || !definition) return []
    const stats = buildCombatStats(definition, progress, state.inventory)
    return [{
      id: slot.heroId,
      name: heroDisplayNameV10(definition, progress),
      careerId: progress.currentCareerId,
      side: 'party' as const,
      row: slot.row,
      position: slot.position,
      formationOrder: formationOrder(slot.row, slot.position),
      rank: 'normal' as const,
      alive: true,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      energy: stats.initialEnergy,
      maxEnergy: stats.maxEnergy,
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
      controlDiminishing: {},
      cooldowns: {},
      statuses: [],
      momentum: {},
      skillIds: [...progress.equippedMartialIds],
      baseSkillId: `base_${progress.currentCareerId}`,
    }]
  })

export const buildCombatStartInput = (
  state: GameStateV10,
  input: StageSelectionInput,
): CombatStartInput => ({ ...input, party: buildCombatParty(state) })

export class GameSession {
  readonly state: GameStateV10
  combat: CombatEngine | null = null
  selection: CampaignSelection | null = null
  private readonly runtimeRng: Rng
  private readonly storage: StorageLike

  private constructor(state: GameStateV10, storage: StorageLike) {
    this.state = state
    this.storage = storage
    this.runtimeRng = createRng(state.lastSavedAt)
    this.ensureFactionBoards()
  }

  static create(storage: StorageLike, now = Date.now()): GameSession {
    return new GameSession(loadGameV10(storage, now).state, storage)
  }

  save(now = Date.now()): void {
    saveGameV10(this.storage, this.state, now)
  }

  startStage(input: StageSelectionInput): ActionResult {
    if (!this.state.unlockedWorldIds.includes(input.worldId)) return { ok: false, message: '江湖卷尚未解锁' }
    if (!Number.isInteger(input.stage) || input.stage < 1 || input.stage > 10) return { ok: false, message: '小关不存在' }
    const highestUnlockedStage = Math.min(10, Math.max(
      1,
      (this.state.clearedStageByWorld[input.worldId] ?? 0) + 1,
    ))
    if (input.stage > highestUnlockedStage) return { ok: false, message: '小关尚未解锁' }
    const combatInput = buildCombatStartInput(this.state, input)
    if (combatInput.party.length === 0) return { ok: false, message: '请先配置出战阵容' }

    this.selection = { worldId: input.worldId, stage: input.stage, mode: input.mode }
    this.combat = createCombatEngine(combatInput)
    return { ok: true, message: '战斗开始' }
  }

  advanceTicks(count: number): CombatEvent[] {
    if (!this.combat) return []
    const events = this.combat.tick(count)
    let changed = false
    for (const event of events) {
      changed = settleCombatEvent(this.state, event).needsSave || changed
    }
    if (changed) {
      this.ensureFactionBoards(true)
      this.save()
    }
    this.handleResult()
    return events
  }

  advanceRuntime(elapsedMs: number): void {
    const before = JSON.stringify(this.state.factionBoards)
    advanceQuestBoards(this.state, elapsedMs, this.runtimeRng)
    if (JSON.stringify(this.state.factionBoards) !== before) this.save()
  }

  setCombatMode(mode: CampaignMode): ActionResult {
    if (!this.combat || !this.selection || this.combat.state.result !== 'fighting') {
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
  }

  private ensureFactionBoards(refillEmpty = false): void {
    const unlocked = new Set(this.state.unlockedWorldIds)
    for (const faction of FACTIONS) {
      if (!unlocked.has(faction.worldId)) continue
      const board = this.state.factionBoards[faction.id]
      if (!board || (refillEmpty && board.slots.every((slot) => slot === null))) {
        initializeQuestBoard(this.state, faction.id, this.runtimeRng, 0)
      }
    }
  }

  private restartSelection(selection: CampaignSelection): void {
    this.selection = selection
    this.combat = createCombatEngine(buildCombatStartInput(this.state, {
      ...selection,
      seed: this.runtimeRng.nextInt(1, 2_147_483_647),
    }))
  }

  private handleResult(): void {
    if (!this.combat || !this.selection) return
    if (this.combat.state.result === 'victory') {
      const completed = this.selection
      this.state.clearedStageByWorld[completed.worldId] = Math.max(
        this.state.clearedStageByWorld[completed.worldId] ?? 0,
        completed.stage,
      )
      if (completed.stage === 10) {
        const currentIndex = WORLDS.findIndex((world) => world.id === completed.worldId)
        const nextWorld = WORLDS[currentIndex + 1]
        if (nextWorld && !this.state.unlockedWorldIds.includes(nextWorld.id)) {
          this.state.unlockedWorldIds.push(nextWorld.id)
          this.state.worldCurrency[nextWorld.id] ??= 0
          this.state.clearedStageByWorld[nextWorld.id] ??= 0
          this.ensureFactionBoards()
        }
      }
      this.restartSelection(resolveVictory(completed))
      this.save()
      return
    }
    if (this.combat.state.result === 'defeat') {
      this.restartSelection(resolveDefeat(this.selection))
    }
  }
}
