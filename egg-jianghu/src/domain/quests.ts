import type { Rng } from '../combat/rng'
import { factionById } from '../content/factions'
import type {
  ActionResult,
  FactionBoardState,
  GameStateV10,
  QuestGrade,
  QuestProgress,
} from './types'

export const QUEST_REFRESH_MS = 3_600_000
export const MAX_ACCEPTED_QUESTS = 10
export const QUEST_COUNTS = {
  丙: { normal: 5, boss: 1 },
  乙: { normal: 20, boss: 2 },
  甲: { normal: 50, boss: 4 },
  地: { normal: 100, boss: 8 },
  天: { normal: 160, boss: 16 },
} as const
export const QUEST_GRADE_WEIGHTS = { 丙: 40, 乙: 30, 甲: 18, 地: 9, 天: 3 } as const

const contributionWeights: Record<QuestGrade, number> = {
  丙: 1,
  乙: 2.5,
  甲: 6,
  地: 13,
  天: 24,
}

const rollGrade = (rng: Rng): QuestGrade => {
  let roll = rng.nextFloat() * 100
  for (const [grade, weight] of Object.entries(QUEST_GRADE_WEIGHTS) as Array<[QuestGrade, number]>) {
    roll -= weight
    if (roll < 0) return grade
  }
  return '丙'
}

const generateQuest = (
  state: GameStateV10,
  factionId: string,
  slotIndex: number,
  rng: Rng,
  generatedAt: number,
): QuestProgress | null => {
  const faction = factionById(factionId)
  if (!faction || !state.unlockedWorldIds.includes(faction.worldId)) return null
  const encountered = state.encounteredEnemyIds.filter((id) => id.startsWith(faction.worldId))
  const bosses = encountered.filter((id) => id.endsWith('_boss'))
  const normalEnemies = encountered.filter((id) => !id.endsWith('_boss'))
  if (bosses.length === 0 && normalEnemies.length === 0) return null

  const type = bosses.length > 0 && (normalEnemies.length === 0 || rng.nextFloat() < 0.3) ? 'boss' : 'normal'
  const targets = type === 'boss' ? bosses : normalEnemies
  const grade = rollGrade(rng)
  const targetCount = QUEST_COUNTS[grade][type]
  const baseReward = Math.floor(20 * contributionWeights[grade])
  const rewardContribution = type === 'boss' ? Math.floor(baseReward * 1.4) : baseReward
  return {
    id: `quest_${factionId}_${slotIndex}_${generatedAt}_${rng.nextInt(1, 1_000_000)}`,
    type,
    grade,
    targetId: rng.pick(targets),
    targetCount,
    rewardContribution,
    generatedAt,
    accepted: false,
    completed: false,
    claimed: false,
    progress: 0,
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
    slots: Array.from({ length: 6 }, (_, index) => generateQuest(state, factionId, index, rng, generatedAt)),
  }
  state.factionBoards[factionId] = board
  return board
}

const nextGenerationTime = (board: FactionBoardState): number => {
  const latest = board.slots.reduce((value, slot) => Math.max(value, slot?.generatedAt ?? 0), 0)
  return latest + QUEST_REFRESH_MS
}

export const advanceQuestBoards = (state: GameStateV10, elapsedRuntimeMs: number, rng: Rng): void => {
  const elapsed = Math.max(0, elapsedRuntimeMs)
  for (const [factionId, board] of Object.entries(state.factionBoards)) {
    board.refreshRemainingMs -= elapsed
    while (board.refreshRemainingMs <= 0) {
      const generatedAt = nextGenerationTime(board)
      board.slots = board.slots.map((slot, index) =>
        slot?.accepted ? slot : generateQuest(state, factionId, index, rng, generatedAt),
      )
      board.refreshRemainingMs += QUEST_REFRESH_MS
    }
  }
}

const acceptedQuestCount = (state: GameStateV10): number =>
  Object.values(state.factionBoards).reduce(
    (count, board) => count + board.slots.filter((slot) => slot?.accepted && !slot.claimed).length,
    0,
  )

export const acceptQuest = (state: GameStateV10, factionId: string, slotIndex: number): ActionResult => {
  const quest = state.factionBoards[factionId]?.slots[slotIndex]
  if (!quest) return { ok: false, message: '任务不存在' }
  if (quest.accepted) return { ok: false, message: '任务已经接受' }
  if (acceptedQuestCount(state) >= MAX_ACCEPTED_QUESTS) return { ok: false, message: '全局最多接受 10 个任务' }
  quest.accepted = true
  quest.progress = 0
  return { ok: true, message: '已接受任务' }
}

export interface QuestKill {
  enemyId: string
  rank: 'normal' | 'elite' | 'boss'
  bossId: string | null
}

export const applyKillToQuests = (state: GameStateV10, kill: QuestKill): void => {
  for (const board of Object.values(state.factionBoards)) {
    for (const quest of board.slots) {
      if (!quest?.accepted || quest.completed || quest.claimed) continue
      const matches = quest.type === 'boss'
        ? (kill.bossId ?? (kill.rank === 'boss' ? kill.enemyId : null)) === quest.targetId
        : kill.rank !== 'boss' && kill.enemyId === quest.targetId
      if (!matches) continue
      quest.progress = Math.min(quest.targetCount, quest.progress + 1)
      quest.completed = quest.progress >= quest.targetCount
    }
  }
}

export const claimQuest = (state: GameStateV10, factionId: string, slotIndex: number): ActionResult => {
  const board = state.factionBoards[factionId]
  const quest = board?.slots[slotIndex]
  if (!quest?.accepted || !quest.completed || quest.claimed) return { ok: false, message: '任务尚不可领取' }
  quest.claimed = true
  state.contribution[factionId] = (state.contribution[factionId] ?? 0) + quest.rewardContribution
  board.slots[slotIndex] = null
  return { ok: true, message: '已领取势力贡献' }
}

export const cancelQuest = (state: GameStateV10, factionId: string, slotIndex: number): ActionResult => {
  const board = state.factionBoards[factionId]
  const quest = board?.slots[slotIndex]
  if (!quest?.accepted) return { ok: false, message: '任务尚未接受' }
  board.slots[slotIndex] = null
  return { ok: true, message: '已取消任务，进度清空' }
}
