import type { Rng } from '../combat/rng'
import type { CombatRank } from '../combat/types'
import { enemyDefinitionById, parseEnemyId } from '../content/enemy-names'
import { factionById } from '../content/factions'
import {
  ORIGINAL_FACTION_RULES,
  originalFactionTaskRequiredAmount,
  originalFactionTaskReward,
  originalFactionTaskTargetPool,
} from '../content/original-faction-rules.generated'
import { applyFactionQuestAgentReward, factionAgentAbilityLevel } from './faction-agent'
import { backpackEquipment } from './inventory'
import type {
  AcceptedFactionQuest,
  ActionResult,
  FactionBoardState,
  FactionQuestBoardEntry,
  FactionQuestQuality,
  FactionQuestTaskId,
  GameStateV10,
} from './types'

export const QUEST_REFRESH_MS = 3_600_000

interface WeightedNumber {
  value: number
  weight: number
}

const pickWeighted = (entries: readonly WeightedNumber[], rng: Rng): number => {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) throw new Error('势力任务随机权重无效')
  let roll = rng.nextFloat() * total
  for (const entry of entries) {
    roll -= entry.weight
    if (roll < 0) return entry.value
  }
  return entries.at(-1)!.value
}

const worldIndexOf = (worldId: string): number => Number(worldId.slice(-2))

const unlockedBossDrIds = (state: GameStateV10, worldId: string): number[] =>
  state.encounteredEnemyIds.flatMap((enemyId) => {
    const parsed = parseEnemyId(enemyId)
    const definition = enemyDefinitionById(enemyId)
    return parsed?.worldId === worldId && parsed.kind === 'boss' && definition ? [definition.drId] : []
  })

const rollQuality = (rng: Rng): FactionQuestQuality =>
  pickWeighted(ORIGINAL_FACTION_RULES.tasks.qualityWeights, rng) as FactionQuestQuality

const rollTaskId = (quality: FactionQuestQuality, rng: Rng): FactionQuestTaskId => {
  const rule = ORIGINAL_FACTION_RULES.tasks.typeWeights.find((candidate) =>
    quality >= candidate.qualityMin && quality <= candidate.qualityMax)
  if (!rule) throw new Error(`势力任务品质 ${quality} 缺少任务类型权重`)
  return pickWeighted(rule.weights, rng) as FactionQuestTaskId
}

const generateQuest = (
  state: GameStateV10,
  factionId: string,
  slotIndex: number,
  rng: Rng,
  generatedAt: number,
): FactionQuestBoardEntry | null => {
  const faction = factionById(factionId)
  if (!faction
    || faction.currencyKind !== 'contribution'
    || !state.unlockedFactionIds.includes(factionId)
    || !state.unlockedWorldIds.includes(faction.worldId)) return null

  const quality = rollQuality(rng)
  const taskId = rollTaskId(quality, rng)
  const targets = originalFactionTaskTargetPool(
    worldIndexOf(faction.worldId),
    taskId,
    quality,
    unlockedBossDrIds(state, faction.worldId),
  )
  if (targets.length === 0) return null
  return {
    id: `quest_${factionId}_${slotIndex}_${generatedAt}_${rng.nextInt(1, 1_000_000)}`,
    taskId,
    quality,
    targetId: rng.pick(targets),
    generatedAt,
    acceptedRecordId: 0,
  }
}

export const initializeQuestBoard = (
  state: GameStateV10,
  factionId: string,
  rng: Rng,
  generatedAt = 0,
): FactionBoardState => {
  const board: FactionBoardState = {
    refreshRemainingMs: QUEST_REFRESH_MS,
    slots: Array.from({ length: 5 }, (_, index) => generateQuest(state, factionId, index, rng, generatedAt)),
  }
  state.factionBoards[factionId] = board
  return board
}

const nextGenerationTime = (board: FactionBoardState): number => {
  const latest = board.slots.reduce((value, slot) => Math.max(value, slot?.generatedAt ?? 0), 0)
  return latest + QUEST_REFRESH_MS
}

const refreshUnacceptedSlots = (
  state: GameStateV10,
  factionId: string,
  board: FactionBoardState,
  rng: Rng,
  generatedAt: number,
): void => {
  board.slots = board.slots.map((slot, index) =>
    slot && slot.acceptedRecordId > 0 ? slot : generateQuest(state, factionId, index, rng, generatedAt))
}

export const advanceQuestBoards = (state: GameStateV10, elapsedRuntimeMs: number, rng: Rng): void => {
  const elapsed = Math.max(0, elapsedRuntimeMs)
  for (const [factionId, board] of Object.entries(state.factionBoards)) {
    board.refreshRemainingMs -= elapsed
    while (board.refreshRemainingMs <= 0) {
      refreshUnacceptedSlots(state, factionId, board, rng, nextGenerationTime(board))
      board.refreshRemainingMs += QUEST_REFRESH_MS
    }
  }
}

const nextAcceptedRecordId = (state: GameStateV10): number => {
  let recordId = 1
  while (state.acceptedFactionQuests[String(recordId)]) recordId += 1
  return recordId
}

export const acceptQuest = (state: GameStateV10, factionId: string, slotIndex: number): ActionResult => {
  const faction = factionById(factionId)
  const quest = state.factionBoards[factionId]?.slots[slotIndex]
  if (!faction || !quest) return { ok: false, message: '任务不存在' }
  if (quest.acceptedRecordId > 0) return { ok: false, message: '任务已经接受' }
  if (quest.acceptedRecordId < 0) return { ok: false, message: '任务已经完成' }
  const requiredAmount = originalFactionTaskRequiredAmount(quest.taskId, quest.quality, worldIndexOf(faction.worldId))
  if (requiredAmount === null) return { ok: false, message: '该任务尚未开放' }

  const recordId = nextAcceptedRecordId(state)
  state.acceptedFactionQuests[String(recordId)] = {
    recordId,
    factionId,
    factionSourceId: faction.originalId,
    worldIndex: worldIndexOf(faction.worldId),
    taskId: quest.taskId,
    quality: quest.quality,
    targetId: quest.targetId,
    requiredAmount,
    progress: 0,
    boardSlot: slotIndex,
    status: 1,
  }
  quest.acceptedRecordId = recordId
  return { ok: true, message: '已接受任务' }
}

export interface QuestKill {
  enemyId: string
  rank: CombatRank
  bossId: string | null
}

export const applyKillToQuests = (state: GameStateV10, kill: QuestKill): void => {
  const enemyId = kill.bossId ?? kill.enemyId
  const targetDrId = enemyDefinitionById(enemyId)?.drId
  if (!targetDrId) return
  for (const quest of Object.values(state.acceptedFactionQuests)) {
    const matches = quest.targetId === targetDrId
      && ((quest.taskId === 1 && kill.rank !== 'boss') || (quest.taskId === 4 && kill.rank === 'boss'))
    if (!matches) continue
    quest.progress = Math.min(quest.requiredAmount, quest.progress + 1)
  }
}

export const factionQuestCurrentProgress = (
  state: GameStateV10,
  quest: AcceptedFactionQuest,
): number => {
  if (quest.taskId === 2) {
    const worldId = `world_${String(quest.worldIndex).padStart(2, '0')}`
    return state.worldCurrency[worldId] ?? 0
  }
  if (quest.taskId === 3) return state.materials[String(quest.targetId)] ?? 0
  if (quest.taskId === 5) return backpackEquipment(state).filter((item) => item.quality === quest.targetId).length
  return quest.progress
}

const consumeQuestRequirement = (state: GameStateV10, quest: AcceptedFactionQuest): boolean => {
  if (factionQuestCurrentProgress(state, quest) < quest.requiredAmount) return false
  if (quest.taskId === 2) {
    const worldId = `world_${String(quest.worldIndex).padStart(2, '0')}`
    state.worldCurrency[worldId] -= quest.requiredAmount
  } else if (quest.taskId === 3) {
    state.materials[String(quest.targetId)] -= quest.requiredAmount
  } else if (quest.taskId === 5) {
    const candidateUids = new Set(
      backpackEquipment(state)
        .filter((item) => item.quality === quest.targetId)
        .slice(0, quest.requiredAmount)
        .map((item) => item.uid),
    )
    state.inventory = state.inventory.filter((item) => !candidateUids.has(item.uid))
  }
  quest.progress = quest.requiredAmount
  return true
}

export const claimQuest = (state: GameStateV10, factionId: string, slotIndex: number): ActionResult => {
  const faction = factionById(factionId)
  const board = state.factionBoards[factionId]
  const boardQuest = board?.slots[slotIndex]
  const accepted = boardQuest && boardQuest.acceptedRecordId > 0
    ? state.acceptedFactionQuests[String(boardQuest.acceptedRecordId)]
    : undefined
  if (!faction || !boardQuest || !accepted || !consumeQuestRequirement(state, accepted)) {
    return { ok: false, message: '任务尚不可领取' }
  }

  const worldId = `world_${String(accepted.worldIndex).padStart(2, '0')}`
  const reward = applyFactionQuestAgentReward(
    originalFactionTaskReward(accepted.taskId, accepted.quality, accepted.worldIndex),
    factionAgentAbilityLevel(state, worldId),
  )
  state.worldCurrency[faction.worldId] = (state.worldCurrency[faction.worldId] ?? 0) + reward.currency
  state.contribution[factionId] = (state.contribution[factionId] ?? 0) + reward.contribution
  state.worldReputation[faction.worldId] = (state.worldReputation[faction.worldId] ?? 0) + reward.reputation
  delete state.acceptedFactionQuests[String(accepted.recordId)]
  boardQuest.acceptedRecordId = -1
  return { ok: true, message: '任务完成，奖励已发放' }
}

export const cancelQuest = (state: GameStateV10, factionId: string, slotIndex: number): ActionResult => {
  const boardQuest = state.factionBoards[factionId]?.slots[slotIndex]
  if (!boardQuest || boardQuest.acceptedRecordId <= 0) return { ok: false, message: '任务尚未接受' }
  delete state.acceptedFactionQuests[String(boardQuest.acceptedRecordId)]
  boardQuest.acceptedRecordId = 0
  return { ok: true, message: '已放弃任务，悬榜任务可重新接受' }
}
