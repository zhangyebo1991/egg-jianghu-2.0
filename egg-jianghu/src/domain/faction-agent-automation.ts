import { FACTIONS } from '../content/factions'
import {
  ORIGINAL_FACTION_RULES,
  originalAgentFilterFactionColumn,
  originalAgentFilterQualityColumn,
  originalAgentFilterSubtypeColumn,
} from '../content/original-faction-rules.generated'
import { acceptQuest, claimQuest, factionQuestCurrentProgress } from './quests'
import type { AcceptedFactionQuest, FactionQuestBoardEntry, GameStateV10 } from './types'

const AUTOMATION = ORIGINAL_FACTION_RULES.agentAutomation
const FILTER = ORIGINAL_FACTION_RULES.stateLayout.agentFilter

export const AGENT_AUTOMATION_TICK_MS = AUTOMATION.tickSeconds * 1000
export const AGENT_CONCURRENT_TASK_LIMIT = AUTOMATION.concurrentTaskLimit

const worldIdOf = (worldIndex: number): string => `world_${String(worldIndex).padStart(2, '0')}`
const worldIndexOf = (worldId: string): number => Number(worldId.slice(-2))

/** 筛选矩阵行 key，对应原版 save 第 16 层的 `(位面 - 1) * 5 + taskId`。 */
export const factionAgentFilterKey = (worldId: string, taskId: number): string => `${worldId}:${taskId}`

/** 该列是否被排除。黑名单语义：列出现在数组中即排除，缺省即放行。 */
export const isFactionAgentColumnExcluded = (
  state: GameStateV10,
  worldId: string,
  taskId: number,
  column: number | null,
): boolean => {
  if (column === null) return false
  return state.factionAgentFilters[factionAgentFilterKey(worldId, taskId)]?.includes(column) ?? false
}

/** 切换某一列的排除状态，返回切换后是否处于「排除」。 */
export const toggleFactionAgentFilterColumn = (
  state: GameStateV10,
  worldId: string,
  taskId: number,
  column: number,
): boolean => {
  const key = factionAgentFilterKey(worldId, taskId)
  const current = state.factionAgentFilters[key] ?? []
  const excluded = current.includes(column)
  const next = excluded ? current.filter((item) => item !== column) : [...current, column].sort((a, b) => a - b)
  if (next.length === 0) delete state.factionAgentFilters[key]
  else state.factionAgentFilters[key] = next
  return !excluded
}

const agentActive = (state: GameStateV10, worldId: string): boolean => {
  const agent = state.factionAgents[worldId]
  return Boolean(agent && agent.heroId && agent.enabled)
}

/**
 * 该悬榜槽位是否通过全部筛选列。
 * 原版 Event 11686/11687/11688/11690/11694/11696 依次校验类型、势力、品质、子类四组列。
 */
const passesFilters = (
  state: GameStateV10,
  worldId: string,
  factionSourceId: number,
  quest: FactionQuestBoardEntry,
): boolean => {
  const { taskId, quality, targetId } = quest
  if (isFactionAgentColumnExcluded(state, worldId, taskId, FILTER.taskEnabledColumn)) return false
  if (isFactionAgentColumnExcluded(state, worldId, taskId, originalAgentFilterFactionColumn(factionSourceId))) return false
  if (isFactionAgentColumnExcluded(state, worldId, taskId, originalAgentFilterQualityColumn(quality))) return false
  const subtypeColumn = originalAgentFilterSubtypeColumn(worldIndexOf(worldId), taskId, quality, targetId)
  return !isFactionAgentColumnExcluded(state, worldId, taskId, subtypeColumn)
}

const acceptedQuestCount = (state: GameStateV10): number =>
  Object.keys(state.acceptedFactionQuests).length

/** 该已接任务能否被自动交付：进度或持有量达到要求。资源扣除由 `claimQuest` 负责。 */
const canAutoComplete = (state: GameStateV10, quest: AcceptedFactionQuest): boolean => {
  if (!AUTOMATION.automatableTaskIds.includes(quest.taskId)) return false
  return factionQuestCurrentProgress(state, quest) >= quest.requiredAmount
}

/**
 * 自动交付一轮。原版 Event 11697 遍历全部已接记录（跨位面），
 * 但每条记录仍要求其所属位面已任命代理人且开关开启。
 */
const runCompletePass = (state: GameStateV10): number => {
  let completed = 0
  for (const quest of Object.values(state.acceptedFactionQuests)) {
    if (!agentActive(state, worldIdOf(quest.worldIndex))) continue
    if (!canAutoComplete(state, quest)) continue
    if (claimQuest(state, quest.factionId, quest.boardSlot).ok) completed += 1
  }
  return completed
}

/**
 * 自动接受一轮。原版 Event 11682 只遍历「玩家当前所在位面」的已解锁正式势力，
 * 每势力 5 个悬榜槽位，槽位条件只有 acceptedRecordId == 0，无冷却。
 */
const runAcceptPass = (state: GameStateV10, worldId: string): number => {
  if (!agentActive(state, worldId)) return 0
  let accepted = 0
  for (const faction of FACTIONS) {
    if (faction.worldId !== worldId) continue
    if (faction.currencyKind !== 'contribution') continue
    if (!state.unlockedFactionIds.includes(faction.id)) continue
    const board = state.factionBoards[faction.id]
    if (!board) continue
    for (const [slotIndex, quest] of board.slots.entries()) {
      // 并发上限是跨位面跨势力的总数（原版 Event 10488），到顶即停止本轮接受。
      if (acceptedQuestCount(state) >= AGENT_CONCURRENT_TASK_LIMIT) return accepted
      if (!quest || quest.acceptedRecordId !== 0) continue
      if (!passesFilters(state, worldId, faction.originalId, quest)) continue
      if (acceptQuest(state, faction.id, slotIndex).ok) accepted += 1
    }
  }
  return accepted
}

export interface FactionAgentAutomationResult {
  accepted: number
  completed: number
}

/**
 * 跑一次代理人自动化 tick。
 *
 * 原版 Event 11714 的顺序是先交付再接受；Event 11711 在本 tick 交付过任何任务后
 * 会再跑一轮接受，因此这里在 completed > 0 时补一轮。
 * `currentWorldId` 为 null 表示玩家不在任何位面世界，此时只做交付、不接新任务。
 */
export const runFactionAgentAutomation = (
  state: GameStateV10,
  currentWorldId: string | null,
): FactionAgentAutomationResult => {
  const completed = runCompletePass(state)
  let accepted = currentWorldId ? runAcceptPass(state, currentWorldId) : 0
  if (completed > 0 && AUTOMATION.reacceptAfterComplete && currentWorldId) {
    accepted += runAcceptPass(state, currentWorldId)
  }
  return { accepted, completed }
}

/** 该位面是否已任命代理人——自动化开关与筛选矩阵只在此前提下有意义。 */
export const factionAgentAutomationAvailable = (state: GameStateV10, worldId: string): boolean =>
  Boolean(state.factionAgents[worldId]?.heroId)
