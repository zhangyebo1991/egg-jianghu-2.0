export type Wuxing = '金' | '木' | '水' | '火' | '土'
export type MartialStyle = '刚' | '柔'
export type Sect = '丐帮' | '峨眉' | '武当'
export type FormationRow = 'front' | 'back'
export type RegionId = 'bluestone_path' | 'blackwind_fort' | 'frost_temple'
export type EnemyTraitId = 'none' | 'formation_breaker' | 'iron_armor' | 'frost_aura'
export type MartialSkillKind = 'blazing_palm' | 'frost_flurry' | 'taiji_restore' | 'vajra_sunder' | 'earth_guard'
export type CombatStatusId = 'burn' | 'slow' | 'sunder' | 'guard'
export type BondEffectType = 'attack' | 'damage_reduction' | 'healing' | 'skill_haste'
export type ComboEffectKind = 'damage' | 'restore' | 'guard' | 'sunder'
export type MysteryBlessingId = 'keen_edge' | 'golden_guard' | 'spring_breath' | 'cloud_steps' | 'mountain_body' | 'fortune_seal'
export type MysteryBlessingEffectType = 'attack' | 'damage_reduction' | 'healing' | 'skill_haste' | 'max_hp' | 'rewards'
export type MartialPassiveEffectType = 'attack' | 'defense' | 'hp'

export interface ResourceInvestment extends Resources {}

export interface LearnedMartialProgress {
  rank: number
  invested: ResourceInvestment
}

export interface MartialPassiveEffect {
  type: MartialPassiveEffectType
  valuePerRank: number
}

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
  skill: {
    kind: MartialSkillKind
    name: string
    description: string
    cooldown: number
  }
  passive: MartialPassiveEffect
}

export interface BondDefinition {
  id: string
  name: string
  type: '师徒' | '结义' | '知音' | '宿敌' | '同道'
  heroIds: readonly [string, string]
  story: string
  effectText: string
  effect: {
    type: BondEffectType
    value: number
  }
}

export interface ComboDefinition {
  id: string
  name: string
  heroIds: readonly [string, string]
  description: string
  multiplier: number
  effect: ComboEffectKind
  effectValue: number
}

export interface MysteryBlessingDefinition {
  id: MysteryBlessingId
  name: string
  description: string
  effectText: string
  effect: {
    type: MysteryBlessingEffectType
    value: number
  }
}

export interface MysteryEncounterDefinition {
  id: string
  name: string
  description: string
  traitId: EnemyTraitId
  baseHp: number
  baseAttack: number
  boss: boolean
  rewards: Resources
}

export interface MysteryRun {
  seed: number
  floor: number
  status: 'choosing' | 'fighting' | 'completed' | 'failed'
  blessingIds: MysteryBlessingId[]
  choiceIds: MysteryBlessingId[]
  earned: Resources
}

export interface MysteryProgress {
  runsCompleted: number
  bestFloor: number
  run: MysteryRun | null
}

export interface HeroProgress {
  unlocked: boolean
  level: number
  learnedMartials: Record<string, LearnedMartialProgress>
  equippedMartialIds: EquippedMartialIds
}

export type EquippedMartialIds = [
  string | null,
  string | null,
  string | null,
  string | null,
]

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
  skillCooldown: number
  statuses: CombatStatus[]
}

export interface CombatStatus {
  id: CombatStatusId
  turns: number
  value: number
  sourceId?: string
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
  kind: 'attack' | 'skill' | 'status' | 'enemy' | 'combo' | 'victory' | 'defeat' | 'reward' | 'system'
  actorId?: string
  targetId?: string
  amount?: number
  abilityId?: string
  text: string
}

export interface CombatState {
  mode: 'idle' | 'challenge' | 'mystery'
  status: 'ready' | 'fighting' | 'victory' | 'defeat'
  regionId: RegionId
  stage: number | null
  enemyId: string
  enemyTraitId: EnemyTraitId
  boss: boolean
  enemyName: string
  enemyHp: number
  enemyMaxHp: number
  enemyAttack: number
  enemyStatuses: CombatStatus[]
  partyMembers: CombatHeroState[]
  comboIndex: number
  turnIndex: number
  round: number
  logs: CombatEvent[]
  lastEvent: CombatEvent | null
}

export interface GameStatistics {
  idleEnemiesDefeated: number
  challengesWon: number
  silverEarned: number
}

export interface GameState {
  version: 7
  resources: Resources
  heroes: Record<string, HeroProgress>
  unlockedMartials: string[]
  formation: FormationSlot[]
  selectedRegionId: RegionId
  defeatedBossIds: string[]
  regionDefeats: Record<RegionId, number>
  mystery: MysteryProgress
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
  damageTakenMultiplier: number
  healingMultiplier: number
  skillCooldownReduction: number
  sectName: Sect | null
  sectCount: number
  sectText: string
  activeBondIds: string[]
  activeComboIds: string[]
}

export interface FormationSummary {
  frontCount: number
  backCount: number
  name: '磐石阵' | '雁行阵'
  effectText: string
}

export interface ActionResult {
  ok: boolean
  message: string
}
