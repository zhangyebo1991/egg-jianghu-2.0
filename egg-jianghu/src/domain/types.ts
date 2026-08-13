export type HeroGrade = '丙' | '乙' | '甲' | '地' | '天'
export type Rarity = '粗浅' | '寻常' | '精妙' | '上乘' | '绝学'
/** 路（横排）：0 上路、1 中路、2 下路 */
export type FormationRow = 0 | 1 | 2
/** 列（纵深）：0 为最前列（贴中线），4 为最后列 */
export type FormationColumn = 0 | 1 | 2 | 3 | 4
export type CampaignMode = 'guard' | 'roam'
export type QuestGrade = HeroGrade
export type EquipmentQuality = '凡品' | '良品' | '上品' | '珍品' | '绝品'

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
  affixes: Array<{ id: string; value: number }>
  locked: boolean
}

export interface GameStateV10 {
  version: 14
  worldCurrency: CurrencyWallet
  contribution: ContributionWallet
  heroes: Record<string, HeroProgressV10>
  jobBooks: Record<string, number>
  formation: FormationSlot[]
  unlockedWorldIds: string[]
  clearedStageByWorldDifficulty: Record<string, number>
  encounteredEnemyIds: string[]
  factionBoards: Record<string, FactionBoardState>
  inventory: EquipmentInstance[]
  statistics: {
    kills: number
    bossKills: number
    equipmentMissedAtCapacity: number
  }
  lastSavedAt: number
}
