import type {
  CombatActionPlan,
  CombatReadyEntry,
  CombatTimelineState,
  CombatUnit,
} from './types'

export const ORIGINAL_COMBAT_SPEEDS = [1, 1.8, 2.6, 3.6] as const
export type CombatSpeed = typeof ORIGINAL_COMBAT_SPEEDS[number]

export const isCombatSpeed = (value: number): value is CombatSpeed =>
  ORIGINAL_COMBAT_SPEEDS.some((speed) => speed === value)

/** 原版我方自动行动在回能与选技前等待0.1秒；敌方无此等待。 */
export const ORIGINAL_PARTY_PREPARATION_MS = 100
/** 原版“技能释放动作”分支 Wait 0.2 秒后结束起手动作。 */
export const ORIGINAL_ACTION_EFFECT_MS = 200
/** 原版“技能释放核心”常规弹道分支在生成弹道前 Wait 0.3 秒。 */
export const ORIGINAL_DEFAULT_HIT_MS = 300
/** 原版“角色行动”在技能调用链后 Wait 1.2 秒才结束本次行动。 */
export const ORIGINAL_ACTION_DURATION_MS = 1200
/** 原版首波：创建敌方核心后等待 1 秒才显示敌人。 */
export const ORIGINAL_INITIAL_WAVE_REFRESH_MS = 1000
/** 原版首波：显示敌人后再等待 0.5 秒才开始积攒。 */
export const ORIGINAL_INITIAL_WAVE_TRANSITION_MS = 1500
/** 原版普通换波：清场后等待 0.5 秒再刷新敌人。 */
export const ORIGINAL_WAVE_REFRESH_MS = 500
/** 原版刷新敌人后再等待 0.5 秒恢复战斗。 */
export const ORIGINAL_WAVE_TRANSITION_MS = 1000
/** 原版普通关卡连续推进胜利在最终击杀后等待 0.8 秒。 */
export const ORIGINAL_ROAM_VICTORY_END_MS = 800
/** 原版结算型胜利与普通失败在最终结果后等待 1 秒打开结算。 */
export const ORIGINAL_SETTLEMENT_END_MS = 1000

export const createCombatTimeline = (): CombatTimelineState => ({
  phase: 'accumulating',
  nextReadySeq: 0,
  readyQueue: [],
  activeAction: null,
  lastStatusPulseAtMs: 0,
  waveTransition: null,
  endingTransition: null,
})

/** C3 System.Every(1)：小于40ms的迟到保留原相位，否则以当前游戏时间重新计时。 */
export const consumeStatusPulse = (timeline: CombatTimelineState, gameTimeMs: number): boolean => {
  const lastTime = timeline.lastStatusPulseAtMs
  if (gameTimeMs >= lastTime + 1000) {
    timeline.lastStatusPulseAtMs = lastTime + 1000
    if (gameTimeMs >= timeline.lastStatusPulseAtMs + 40) timeline.lastStatusPulseAtMs = gameTimeMs
    return true
  }
  if (gameTimeMs < lastTime - 100) timeline.lastStatusPulseAtMs = gameTimeMs
  return false
}

export const enqueueReadyActors = (
  timeline: CombatTimelineState,
  units: readonly CombatUnit[],
  canQueue: (unit: CombatUnit) => boolean,
): void => {
  const queued = new Set(timeline.readyQueue.map((entry) => entry.actorId))
  if (timeline.activeAction) queued.add(timeline.activeAction.actorId)
  for (const unit of units) {
    if (queued.has(unit.id) || unit.gauge < 1000 - 1e-8 || !canQueue(unit)) continue
    unit.gauge = 0
    timeline.nextReadySeq += 1
    timeline.readyQueue.push({ actorId: unit.id, readySeq: timeline.nextReadySeq })
    queued.add(unit.id)
  }
}

export const takeNextReadyActor = (
  timeline: CombatTimelineState,
  units: readonly CombatUnit[],
  canAct: (unit: CombatUnit) => boolean,
): CombatUnit | null => {
  const byId = new Map(units.map((unit) => [unit.id, unit]))
  while (timeline.readyQueue.length > 0) {
    const entry = timeline.readyQueue.shift() as CombatReadyEntry
    const actor = byId.get(entry.actorId)
    if (actor && canAct(actor)) return actor
  }
  return null
}

export const createActionPlan = (
  actorId: string,
  skillId: number,
  targetIds: string[],
): CombatActionPlan => ({
  actorId,
  skillId,
  targetIds,
  elapsedMs: 0,
  effectAtMs: ORIGINAL_ACTION_EFFECT_MS,
  hitAtMs: ORIGINAL_DEFAULT_HIT_MS,
  durationMs: ORIGINAL_ACTION_DURATION_MS,
  effectEmitted: false,
  hitResolved: false,
  buffsAtMs: 1000,
  buffsResolved: false,
})
