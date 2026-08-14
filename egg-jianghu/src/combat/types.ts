import type { CampaignMode, FormationColumn, FormationRow } from '../domain/types'
import type { AttributeMap } from '../content/attributes'

export type CombatSide = 'party' | 'enemy'
export type CombatRank = 'normal' | 'elite' | 'boss'

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
  nextTickMs?: number
}

export interface CombatUnit {
  id: string
  name: string
  careerId?: string
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
  /** 诸天模型统一属性面板（属性 id → 数值）；与上方散落字段并行，Phase 2 起战斗公式改读此字段 */
  attributes: AttributeMap
}

export interface CombatSummon extends CombatUnit {
  remainingMs: number
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
}

export type CombatEvent =
  | { type: 'damage'; atMs: number; sourceId: string; targetId: string; amount: number; critical: boolean }
  | { type: 'healing'; atMs: number; sourceId: string; targetId: string; amount: number }
  | { type: 'shield-applied'; atMs: number; sourceId: string; targetId: string; amount: number }
  | { type: 'status-applied'; atMs: number; sourceId: string; targetId: string; buffId: number; stacks: number }
  | { type: 'unit-revived'; atMs: number; sourceId: string; targetId: string }
  | { type: 'summoned'; atMs: number; sourceId: string; summonId: string; summonName: string }
  | { type: 'skill-used'; atMs: number; sourceId: string; skillId: number; targetIds: string[] }
  | { type: 'enemy-defeated'; atMs: number; enemyId: string; rank: CombatRank; worldId: string; stage: number; difficulty: number; seed: number }
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
