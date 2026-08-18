export type HeroGrade = '丙' | '乙' | '甲' | '地' | '天'
export type Rarity = '粗浅' | '寻常' | '精妙' | '上乘' | '绝学'
/** 路（横排）：0 上路、1 中路、2 下路 */
export type FormationRow = 0 | 1 | 2
/** 列（纵深）：0 为最前列（贴中线），4 为最后列 */
export type FormationColumn = 0 | 1 | 2 | 3 | 4
export type CampaignMode = 'guard' | 'roam'
export type EquipmentQuality = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type FactionQuestTaskId = 1 | 2 | 3 | 4 | 5
export type FactionQuestQuality = 1 | 2 | 3 | 4 | 5 | 6

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
  /** 原版 save[hero, 39+能力, 1] 培养等级；缺省视为 0。当前无培养 UI。 */
  abilityTraining?: Record<string, number>
}

export interface FormationSlot {
  heroId: string
  row: FormationRow
  col: FormationColumn
}

export interface FactionQuestBoardEntry {
  id: string
  taskId: FactionQuestTaskId
  quality: FactionQuestQuality
  targetId: number
  generatedAt: number
  /** 0 可接受、正数为接受记录 ID、-1 已完成。 */
  acceptedRecordId: number
}

export interface AcceptedFactionQuest {
  recordId: number
  factionId: string
  factionSourceId: number
  worldIndex: number
  taskId: FactionQuestTaskId
  quality: FactionQuestQuality
  targetId: number
  requiredAmount: number
  progress: number
  boardSlot: number
  status: 1
}

export interface FactionBoardState {
  refreshRemainingMs: number
  slots: Array<FactionQuestBoardEntry | null>
}

export interface FactionAgentState {
  heroId: string | null
  /**
   * 是否开启自动接受/完成。对应原版 save[位面][55]，但极性相反：
   * 原版列值 1 表示关闭、0 表示开启，且任命与卸任都写 1（即默认关闭）。
   * 本作在此用直觉极性（true = 开启），读写边界的换算见 `faction-agent.ts`。
   */
  enabled: boolean
}

/**
 * 位面代理人任务筛选矩阵。
 *
 * key 为 `${worldId}:${taskId}`，对应原版 save 第 16 层的行 `(位面 - 1) * 5 + taskId`；
 * value 是被排除的列号（黑名单语义：列出现即排除，缺省或空数组即全部放行）。
 * 列语义见 `ORIGINAL_FACTION_RULES.stateLayout.agentFilter`：
 * 1 = 任务类型总开关、2..4 = 势力、5..10 = 品质、11..20 = 子类（按 taskId 切换 key）。
 */
export type FactionAgentFilters = Record<string, number[]>

export interface EquipmentInstance {
  uid: string
  definitionId: string
  /** 物品等级：决定装备属性、词条系数与平均装等。 */
  level: number
  /** 穿戴等级：人物达到该等级后才可装备；旧存档缺省时按物品等级与品质派生。 */
  equipmentLevel?: number
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

export type CityFinanceCategory =
  | '销售收入'
  | '租金收入'
  | '门票收入'
  | '其他收入'
  | '科研支出'
  | '建造支出'
  | '其他支出'

export type CityFinanceLedger = Record<CityFinanceCategory, number>

export interface CityTileState {
  tileId: number
  buildingId: number
  buildingLevel: number
  owned: boolean
  buildable: boolean
  gridX: number
  gridY: number
  landPriceTier: number
  population: number
  commerce: number
  industry: number
}

export interface CityCompanyState {
  name: string | null
  cash: number
  /** 原版职位存档索引 -> 侠客 ID；角色公司能力接入前不生效。 */
  appointments: Record<string, string | null>
  currentFinance: CityFinanceLedger
  previousFinance: CityFinanceLedger
  previousNetIncome: number
}

export interface CityState {
  level: number
  tiles: CityTileState[]
  /** 原版 kj 科技编号 -> 已完成等级；未出现的科技视为 0 级。 */
  technologyLevels: Record<string, number>
  company: CityCompanyState
}

export interface GameStateV10 {
  version: 18
  worldCurrency: CurrencyWallet
  contribution: ContributionWallet
  worldReputation: Record<string, number>
  factionAgents: Record<string, FactionAgentState>
  factionAgentFilters: FactionAgentFilters
  unlockedFactionIds: string[]
  heroes: Record<string, HeroProgressV10>
  jobBooks: Record<string, number>
  formation: FormationSlot[]
  unlockedWorldIds: string[]
  clearedStageByWorldDifficulty: Record<string, number>
  encounteredEnemyIds: string[]
  factionBoards: Record<string, FactionBoardState>
  acceptedFactionQuests: Record<string, AcceptedFactionQuest>
  unlockedSkinIds: number[]
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
  city: CityState
  statistics: {
    kills: number
    bossKills: number
    equipmentMissedAtCapacity: number
  }
  lastSavedAt: number
}
