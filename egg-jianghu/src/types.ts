export type Wuxing = '金' | '木' | '水' | '火' | '土'
export type MartialStyle = '刚' | '柔'
export type Sect = '丐帮' | '峨眉' | '武当'

export interface HeroDefinition {
  id: string
  name: string
  epithet: string
  sect: Sect
  element: Wuxing
  style: MartialStyle
  description: string
  baseAttack: number
  baseDefense: number
  baseHp: number
  recruitCost: number
  initial: boolean
}

export interface MartialDefinition {
  id: string
  name: string
  element: Wuxing
  style: MartialStyle
  description: string
  basePower: number
  unlockCost: number
  initial: boolean
  rankNames: readonly [string, string, string]
}

export interface HeroProgress {
  unlocked: boolean
  level: number
  equippedMartialId: string | null
  martialRanks: Record<string, number>
}

export interface Resources {
  silver: number
  experience: number
  pages: number
  reputation: number
}

export interface CombatEvent {
  id: number
  kind: 'attack' | 'enemy' | 'combo' | 'victory' | 'defeat' | 'reward' | 'system'
  actorId?: string
  amount?: number
  text: string
}

export interface CombatState {
  mode: 'idle' | 'challenge'
  status: 'fighting' | 'victory' | 'defeat'
  enemyName: string
  enemyHp: number
  enemyMaxHp: number
  enemyAttack: number
  partyHp: number
  partyMaxHp: number
  turnIndex: number
  round: number
  stage: number
  logs: CombatEvent[]
  lastEvent: CombatEvent | null
}

export interface GameStatistics {
  idleEnemiesDefeated: number
  challengesWon: number
  silverEarned: number
  offlineSeconds: number
}

export interface GameState {
  version: 1
  resources: Resources
  heroes: Record<string, HeroProgress>
  unlockedMartials: string[]
  party: string[]
  clearedStage: number
  combat: CombatState
  statistics: GameStatistics
  lastTickAt: number
  lastSavedAt: number
}

export interface HeroStats {
  attack: number
  defense: number
  hp: number
  power: number
  affinityText: string
}

export interface PartySynergy {
  attackMultiplier: number
  sectName: Sect | null
  sectCount: number
  sectText: string
  comboActive: boolean
}

export interface OfflineSettlement {
  seconds: number
  silver: number
  experience: number
  pages: number
  enemies: number
  capped: boolean
}

export interface ActionResult {
  ok: boolean
  message: string
}
