export type HeroGrade = '丙' | '乙' | '甲' | '地' | '天'
export type Rarity = '粗浅' | '寻常' | '精妙' | '上乘' | '绝学'
/** 路（横排）：0 上路、1 中路、2 下路 */
export type FormationRow = 0 | 1 | 2
/** 列（纵深）：0 为最前列（贴中线），4 为最后列 */
export type FormationColumn = 0 | 1 | 2 | 3 | 4
export type CampaignMode = 'guard' | 'roam'
export type QuestGrade = HeroGrade
export type EquipmentQuality = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface ActionResult {
  ok: boolean
  message: string
}

export interface CurrencyWallet {
  [worldId: string]: number
}

export interface ContributionWallet {
  [factionId: string]: number
}

export interface InvestmentLedger {
  worldCurrency: Record<string, number>
  contribution: Record<string, number>
}

export interface LearnedMartial {
  level: number
  /** 该技能历次学习和升级实际消耗的 SP；遗忘时 100% 返还。 */
  investedSp: number
  invested: InvestmentLedger
}

export interface CareerRecord {
  level: number
  experience: number
}

export interface HeroProgressV10 {
  recruited: boolean
  customName?: string
  level: number
  experience: number
  skillPoints: number
  /** 秘籍、神位等永久来源授予的技能资格；遗忘后仍可重新学习。 */
  permanentMartialIds: string[]
  careers: Record<string, CareerRecord>
  currentCareerId: string
  learnedMartials: Record<string, LearnedMartial>
  equippedMartialIds: [string | null, string | null, string | null, string | null]
  heartMethodId: string | null
  equipmentSets: [Record<string, string | null>, Record<string, string | null>, Record<string, string | null>]
  activeEquipmentSetIndex: 0 | 1 | 2
  equipmentBySlot: Record<string, string | null>
}

export interface FormationSlot {
  heroId: string
  row: FormationRow
  col: FormationColumn
}

export interface QuestProgress {
  id: string
  type: 'normal' | 'boss'
  grade: QuestGrade
  targetId: string
  targetCount: number
  rewardContribution: number
  generatedAt: number
  accepted: boolean
  completed: boolean
  claimed: boolean
  progress: number
}

export interface FactionBoardState {
  refreshRemainingMs: number
  slots: Array<QuestProgress | null>
}

export interface EquipmentInstance {
  uid: string
  definitionId: string
  level: number
  quality: EquipmentQuality
  coreStats: Array<{ attributeId: number; coefficient: number }>
  affixes: Array<{ attributeId: number; coefficient: number }>
  locked: boolean
}

export type ShrinePhase = 'raid' | 'siege' | 'occupation' | 'subdued'

export interface ShrineProgressState {
  phase: ShrinePhase
  /** 0～5000；-1 是 Boss 死亡后等待刷新结算的内部握手状态。 */
  progress: number
}

export interface DeityProgressState {
  level: number
}

export interface SacredBeastProgressState {
  highestClearedStage: number
  claimedStages: number[]
}

export interface GameStateV10 {
  version: 17
  worldCurrency: CurrencyWallet
  contribution: ContributionWallet
  unlockedFactionIds: string[]
  heroes: Record<string, HeroProgressV10>
  jobBooks: Record<string, number>
  formation: FormationSlot[]
  unlockedWorldIds: string[]
  clearedStageByWorldDifficulty: Record<string, number>
  encounteredEnemyIds: string[]
  factionBoards: Record<string, FactionBoardState>
  inventory: EquipmentInstance[]
  materials: Record<string, number>
  starSoul: number
  blueprints: Record<string, number>
  unlockedRecipeIds: number[]
  treasureManualGrants: Record<string, string>
  infiniteTowerFloor: number
  divineLadderFloor: number
  divineRankLevel: number
  shrines: Record<string, ShrineProgressState>
  deities: Record<string, DeityProgressState>
  sacredBeasts: Record<string, SacredBeastProgressState>
  largeDungeonClears: Record<string, number>
  statistics: {
    kills: number
    bossKills: number
    equipmentMissedAtCapacity: number
  }
  lastSavedAt: number
}
