export type Wuxing = '金' | '木' | '水' | '火' | '土'
export type MartialStyle = '刚' | '柔'
export type Sect = '丐帮' | '峨眉' | '武当'
export type FormationRow = 'front' | 'back'
export type RegionId = 'bluestone_path' | 'blackwind_fort' | 'frost_temple'
export type EnemyTraitId = 'none' | 'formation_breaker' | 'iron_armor' | 'frost_aura'

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

export interface FormationSlot {
  heroId: string
  row: FormationRow
}

export interface CombatHeroState extends FormationSlot {
  hp: number
  maxHp: number
}

export interface EnemyTraitDefinition {
  id: EnemyTraitId
  name: string
  description: string
  counterHint: string
}

export interface EnemyDefinition {
  id: string
  name: string
  traitId: EnemyTraitId
  baseHp: number
  baseAttack: number
}

export interface BossDefinition extends EnemyDefinition {
  rewards: Resources
}

export interface RegionDefinition {
  id: RegionId
  name: string
  description: string
  rewardText: string
  rewardMultipliers: Pick<Resources, 'silver' | 'experience' | 'pages'>
  requiredBossId: string | null
  enemies: readonly EnemyDefinition[]
  boss: BossDefinition
}

export interface CombatEvent {
  id: number
  kind: 'attack' | 'enemy' | 'combo' | 'victory' | 'defeat' | 'reward' | 'system'
  actorId?: string
  targetId?: string
  amount?: number
  text: string
}

export interface CombatState {
  mode: 'idle' | 'challenge'
  status: 'fighting' | 'victory' | 'defeat'
  regionId: RegionId
  enemyId: string
  enemyTraitId: EnemyTraitId
  boss: boolean
  enemyName: string
  enemyHp: number
  enemyMaxHp: number
  enemyAttack: number
  partyMembers: CombatHeroState[]
  turnIndex: number
  round: number
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
  version: 3
  resources: Resources
  heroes: Record<string, HeroProgress>
  unlockedMartials: string[]
  formation: FormationSlot[]
  selectedRegionId: RegionId
  defeatedBossIds: string[]
  regionDefeats: Record<RegionId, number>
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

export interface FormationSummary {
  frontCount: number
  backCount: number
  name: '磐石阵' | '雁行阵'
  effectText: string
}

export interface OfflineSettlement {
  regionId: RegionId
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
