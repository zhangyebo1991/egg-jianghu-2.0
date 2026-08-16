import type { CampaignMode, FormationColumn, FormationRow } from '../domain/types'
import type { AttributeMap } from '../content/attributes'

export type CombatSide = 'party' | 'enemy'
export type CombatRank = 'normal' | 'elite' | 'captain' | 'boss'

export interface CareerCombatCoefficients {
  physicalAttack: number
  physicalDefense: number
  magicAttack: number
  magicDefense: number
  heal: number
}

/** 单位身上的 buff 实例：定义查 content/buffs.ts 的 COMBAT_BUFFS */
export interface CombatStatus {
  buffId: number
  stacks: number
  /** time 型剩余毫秒；turn 型此值为大数兜底，按 remainingTurns 递减 */
  remainingMs: number
  /** 回合型 buff：单位每行动一次递减 1 */
  remainingTurns?: number
  sourceId?: string
  /** DoT/HoT 每层每秒结算量（施加时按施加者面板锁定） */
  tickValue?: number
}

export interface CombatUnit {
  id: string
  name: string
  careerId?: string
  /** 人物职业编码 1..4、6 的战斗系数；无人物职业的敌人默认按 1 结算。 */
  careerCoefficients?: CareerCombatCoefficients
  side: CombatSide
  row: FormationRow
  col: FormationColumn
  formationOrder: number
  rank: CombatRank
  alive: boolean
  hp: number
  maxHp: number
  /** 护盾值：伤害先扣护盾 */
  shield: number
  /** 能量点 0-5（对齐诸天） */
  energy: number
  maxEnergy: number
  gauge: number
  effectiveAgility: number
  externalAttack: number
  internalAttack: number
  externalDefense: number
  internalDefense: number
  accuracy: number
  evade: number
  criticalChance: number
  criticalMultiplier: number
  controlResistance: number
  cooldowns: Record<number, number>
  statuses: CombatStatus[]
  /** 主动技能栏（jn 表 id，从左到右优先） */
  skillIds: readonly number[]
  /** 普攻技能 id（jn 表） */
  baseAttackId: number
  /** 人物主手 wp[7] 武器类型 1..10；敌人、召唤物或未装备主手时为空。 */
  mainhandWeaponType?: number
  /** 诸天模型统一属性面板（属性 id → 数值）；与上方散落字段并行，Phase 2 起战斗公式改读此字段 */
  attributes: AttributeMap
}

export interface CombatSummon extends CombatUnit {
  /** 原版战斗核心字段 10：召唤物归属的施法者，用于逐施法者计算召唤上限。 */
  summonerId: string
  remainingMs: number
}

export interface CombatReadyEntry {
  actorId: string
  readySeq: number
}

export interface CombatActionPlan {
  actorId: string
  skillId: number
  targetIds: string[]
  elapsedMs: number
  /** 原版“技能释放动作”分支 Wait 0.2 秒后进入主特效阶段。 */
  effectAtMs: number
  /** 原版“技能释放核心”在常规弹道生成前等待 0.3 秒。 */
  hitAtMs: number
  /** 原版“角色行动”在完成结算后统一等待 1.2 秒再结束行动。 */
  durationMs: number
  effectEmitted: boolean
  hitResolved: boolean
}

export interface CombatWaveTransition {
  kind: 'initial' | 'next'
  elapsedMs: number
  /** 首波为创建核心后 Wait(1)，普通换波为清场后 Wait(0.5)。 */
  refreshAtMs: number
  /** 原版生成敌人后再 Wait(0.5)，到点才开启或恢复战斗。 */
  durationMs: number
  refreshed: boolean
}

export interface CombatEndingTransition {
  outcome: 'victory' | 'defeat'
  elapsedMs: number
  /** 从最终致死节点起计时；闯荡胜利 0.8 秒，结算型胜负 1 秒。 */
  durationMs: number
}

export interface CombatTimelineState {
  phase: 'accumulating' | 'acting' | 'wave-transition' | 'ending'
  nextReadySeq: number
  readyQueue: CombatReadyEntry[]
  activeAction: CombatActionPlan | null
  /** 行动积攒按原版 0.1 秒节点推进；不足一节点的时间留到下次。 */
  accumulationCarryMs: number
  /** 原版全局 Every(1) 状态脉冲；只在行动积攒阶段推进。 */
  statusPulseCarryMs: number
  /** 普通换波的两段确定性等待；与尚未结束的行动锁并行推进。 */
  waveTransition: CombatWaveTransition | null
  /** 最终胜负的确定性等待；与尚未结束的行动锁并行推进。 */
  endingTransition: CombatEndingTransition | null
}

export interface CombatSnapshot {
  seed: number
  worldId: string
  difficulty: number
  stage: number
  mode: CampaignMode
  wave: number
  elapsedMs: number
  result: 'fighting' | 'victory' | 'defeat' | 'stopped'
  party: CombatUnit[]
  enemies: CombatUnit[]
  summons: CombatSummon[]
  timeline: CombatTimelineState
}

export type CombatEvent =
  | { type: 'damage'; atMs: number; sourceId: string; targetId: string; amount: number; critical: boolean }
  | { type: 'healing'; atMs: number; sourceId: string; targetId: string; amount: number }
  | { type: 'shield-applied'; atMs: number; sourceId: string; targetId: string; amount: number }
  | { type: 'status-applied'; atMs: number; sourceId: string; targetId: string; buffId: number; stacks: number }
  | { type: 'unit-revived'; atMs: number; sourceId: string; targetId: string }
  | { type: 'summoned'; atMs: number; sourceId: string; summonId: string; summonName: string }
  | { type: 'skill-used'; atMs: number; sourceId: string; skillId: number; targetIds: string[] }
  | { type: 'skill-effect'; atMs: number; sourceId: string; skillId: number; targetIds: string[] }
  | { type: 'enemy-defeated'; atMs: number; enemyId: string; enemyLevel: number; rank: CombatRank; worldId: string; stage: number; difficulty: number; seed: number }
  | { type: 'unit-defeated'; atMs: number; unitId: string; side: CombatSide; summon: boolean }
  | { type: 'wave-started'; atMs: number; wave: number }
  | { type: 'stage-cleared' | 'party-defeated' | 'combat-stopped'; atMs: number }

export interface StageSelectionInput {
  worldId: string
  difficulty?: number
  stage: number
  mode: CampaignMode
  seed: number
}

export interface CombatStartInput extends StageSelectionInput {
  party: CombatUnit[]
}
