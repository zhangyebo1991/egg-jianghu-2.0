import type { CampaignMode, FormationPosition, FormationRow } from '../domain/types'

export type CombatSide = 'party' | 'enemy'
export type CombatRank = 'normal' | 'elite' | 'boss'
export type StatusMode = 'refresh' | 'strongest' | 'stack' | 'independent'

export interface CombatStatus {
  id: string
  remainingMs: number
  mode: StatusMode
  stacks: number
  value: number
  sourceId?: string
  tickIntervalMs?: number
  nextTickMs?: number
  category?: 'buff' | 'debuff' | 'damage-over-time' | 'control'
}

export interface CombatUnit {
  id: string
  name: string
  careerId?: string
  side: CombatSide
  row: FormationRow
  position: FormationPosition
  formationOrder: number
  rank: CombatRank
  alive: boolean
  hp: number
  maxHp: number
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
  controlDiminishing: Record<string, number>
  cooldowns: Record<string, number>
  statuses: CombatStatus[]
  momentum: Record<string, number>
  skillIds: Array<string | null>
  baseSkillId: string
}

export interface CombatSummon extends CombatUnit {
  remainingMs: number
}

export interface CombatSnapshot {
  seed: number
  worldId: string
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
  | { type: 'status-applied'; atMs: number; sourceId: string; targetId: string; status: CombatStatus }
  | { type: 'skill-used'; atMs: number; sourceId: string; skillId: string; targetIds: string[] }
  | { type: 'skill-skipped'; atMs: number; sourceId: string; skillId: string; reason: string }
  | { type: 'enemy-defeated'; atMs: number; enemyId: string; rank: CombatRank; worldId: string; stage: number; seed: number }
  | { type: 'wave-started'; atMs: number; wave: number }
  | { type: 'stage-cleared' | 'party-defeated' | 'combat-stopped'; atMs: number }

export interface StageSelectionInput {
  worldId: string
  stage: number
  mode: CampaignMode
  seed: number
}

export interface CombatStartInput extends StageSelectionInput {
  party: CombatUnit[]
}
