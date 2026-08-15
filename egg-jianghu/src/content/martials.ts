import { FACTIONS, factionByOriginalId } from './factions'
import { ORIGINAL_PLAYER_SKILLS, ORIGINAL_TREASURES } from './original-progression.generated'
import type { CareerCategory } from './careers'
import type { Rarity } from '../domain/types'

export type DamageRoute = 'external' | 'internal' | 'healing'
export type MartialForce = 'hard' | 'soft' | 'swift' | 'support'

export interface MartialCost {
  kind: 'worldCurrency' | 'contribution'
  id: string
  amount: number
}

export interface MartialDefinitionV10 {
  id: string
  originalSkillId: number
  name: string
  description: string
  source: 'faction' | 'treasure-manual' | 'special'
  factionId: string | null
  worldId: string
  branch: string
  branchIndex: 1 | 2
  stage: 1 | 2 | 3
  rarity: Rarity
  category: CareerCategory
  damageRoute: DamageRoute
  force: MartialForce
  energyCost: number
  cooldownMs: number
  power: number
  skillCategory: number
  weaponType: number
  element: number
  difficulty: number
  maxLevel: number
  baseEffect: number
  effectGrowthPerTenLevels: number
  effectMultiplierPercent: number
  buffId: number | null
  buffBaseChance: number
  buffChanceGrowthPerTenLevels: number
  previousId: string | null
  careerIds: string[]
  currencySource: MartialCost
  manualItemId: number | null
}

export interface HeartMethodDefinitionV10 {
  id: string
  name: string
  source: 'faction' | 'city'
  factionId: string | null
  worldId: string
  careerIds: string[]
  energyRecovery: number
  gaugeRate: number
  cooldownRate: number
  momentumBonus: number
  survivalBonus: number
}

const categoryCareerIds: Record<CareerCategory, [string, string, string]> = {
  剑: ['sword', 'sword_swift', 'sword_heavy'],
  刀: ['blade', 'blade_swift', 'blade_fury'],
  拳: ['fist', 'fist_hard', 'fist_soft'],
  暗: ['shadow', 'shadow_assassin', 'shadow_poison'],
  医: ['doctor', 'doctor_heal', 'doctor_medicine'],
  内家: ['inner', 'inner_flow', 'inner_guard'],
}

const categoryByOriginalSkillCategory: Record<number, CareerCategory> = {
  1: '内家', 2: '拳', 3: '剑', 4: '内家', 5: '暗', 6: '医', 7: '刀', 8: '内家',
  9: '刀', 10: '剑', 11: '内家', 12: '内家', 13: '暗', 14: '暗', 15: '内家', 16: '医',
}

const careersForCategory = (category: CareerCategory): string[] => {
  const [base, first, second] = categoryCareerIds[category]
  return [
    base,
    `${first}_mid`, `${first}_high`, `${first}_top`,
    `${second}_mid`, `${second}_high`, `${second}_top`,
  ]
}

const routeFor = (route: string): DamageRoute => {
  if (route === '生命') return 'healing'
  if (route === '法术' || route === '辅助') return 'internal'
  return 'external'
}

const forceFor = (route: string, branchIndex: 1 | 2): MartialForce => {
  if (route === '辅助' || route === '生命') return 'support'
  if (route === '法术') return 'soft'
  return branchIndex === 1 ? 'hard' : 'swift'
}

const rarityForDifficulty = (difficulty: number): Rarity =>
  (['粗浅', '寻常', '精妙', '上乘', '绝学'] as const)[Math.min(5, Math.max(1, difficulty)) - 1]

export const martialIdFromOriginal = (originalSkillId: number): string => `original_skill_${originalSkillId}`

/** 原版 c3runtime.js「技能升级经验function」。percentage 使用 1 表示 100%。 */
export const martialSpCost = (difficulty: number, level: number, percentage = 1): number =>
  Math.round((1000 * Math.pow(1.017, (((difficulty - 1) * 20 + level) * 3)) - 600) * percentage)

/** 原版 c3runtime.js「技能升级贡献function」，货币贡献比固定为原版全局值 20。 */
export const martialResourceCost = (
  kind: 'worldCurrency' | 'contribution',
  difficulty: number,
  level: number,
  percentage = 1,
): number => kind === 'contribution'
  ? Math.round(((5000 / 20) * Math.pow(1.025, (((difficulty - 1) * 20 + level) * 3)) - 200) * percentage)
  : Math.round((10000 * Math.pow(1.025, (((difficulty - 1) * 20 + level) * 3)) - 9700) * percentage)

export const martialEffectAtLevel = (martial: MartialDefinitionV10, level: number): number => {
  const safeLevel = Math.min(martial.maxLevel, Math.max(1, Math.floor(level)))
  if (martial.baseEffect === 0 && martial.effectGrowthPerTenLevels === 0) return martial.power * 100
  return Math.round((martial.baseEffect
    + martial.effectGrowthPerTenLevels * ((safeLevel - 1) / 10))
    * martial.effectMultiplierPercent) / 100
}

export const martialBuffChanceAtLevel = (martial: MartialDefinitionV10, level: number): number => {
  const safeLevel = Math.min(martial.maxLevel, Math.max(1, Math.floor(level)))
  return Math.round(100 * Math.min(100, Math.max(0,
    martial.buffBaseChance + Math.max(0, (safeLevel - 1) * (martial.buffChanceGrowthPerTenLevels / 10)),
  ))) / 100
}

const manualWorldBySkillId = new Map<number, number>()
for (const item of ORIGINAL_TREASURES) {
  if (item.kind === 'manual' && item.grantSkillId !== null) {
    manualWorldBySkillId.set(item.grantSkillId, item.worldIndex)
  }
}

const buildMartial = (original: typeof ORIGINAL_PLAYER_SKILLS[number]): MartialDefinitionV10 => {
  const faction = original.factionId ? factionByOriginalId(original.factionId) : undefined
  const category = faction?.category ?? categoryByOriginalSkillCategory[original.skillCategory] ?? '内家'
  const source = original.source
  const worldIndex = faction
    ? Number(faction.worldId.slice(-2))
    : manualWorldBySkillId.get(original.id) ?? 1
  const worldId = `world_${String(worldIndex).padStart(2, '0')}`
  const branchIndex = (original.branchIndex ?? 1) as 1 | 2
  const currencyKind = faction?.currencyKind ?? 'worldCurrency'
  const currencyId = currencyKind === 'contribution' ? faction?.id ?? '' : worldId
  const basePower = original.baseEffect || original.basePowerPercent
  return {
    id: martialIdFromOriginal(original.id),
    originalSkillId: original.id,
    name: original.name,
    description: original.description,
    source,
    factionId: faction?.id ?? null,
    worldId,
    branch: faction?.branchLabels[branchIndex - 1] ?? '特殊',
    branchIndex,
    stage: (original.stage ?? 1) as 1 | 2 | 3,
    rarity: rarityForDifficulty(original.difficulty),
    category,
    damageRoute: routeFor(original.route),
    force: forceFor(original.route, branchIndex),
    energyCost: original.energyCost,
    cooldownMs: original.energyCost * 4000,
    power: basePower / 100,
    skillCategory: original.skillCategory,
    weaponType: 0,
    element: original.element,
    difficulty: original.difficulty,
    maxLevel: original.maxLevel,
    baseEffect: original.baseEffect,
    effectGrowthPerTenLevels: original.effectGrowthPerTenLevels,
    effectMultiplierPercent: original.basePowerPercent,
    buffId: original.buffId,
    buffBaseChance: original.buffBaseChance,
    buffChanceGrowthPerTenLevels: original.buffChanceGrowthPerTenLevels,
    previousId: original.previousSkillId ? martialIdFromOriginal(original.previousSkillId) : null,
    careerIds: careersForCategory(category),
    currencySource: {
      kind: currencyKind,
      id: currencyId,
      amount: faction ? martialResourceCost(currencyKind, original.difficulty, 1) : 0,
    },
    manualItemId: original.manualItemId,
  }
}

export const MARTIALS_V10: MartialDefinitionV10[] = ORIGINAL_PLAYER_SKILLS.map(buildMartial)
export const FACTION_MARTIALS = MARTIALS_V10.filter((martial) => martial.source === 'faction')
export const CITY_MARTIALS: MartialDefinitionV10[] = []

export const FACTION_HEART_METHODS: HeartMethodDefinitionV10[] = FACTIONS.map((faction) => ({
  id: `${faction.id}_heart_01`,
  name: `${faction.name}心法`,
  source: 'faction',
  factionId: faction.id,
  worldId: faction.worldId,
  careerIds: careersForCategory(faction.category),
  energyRecovery: 1,
  gaugeRate: 0.02,
  cooldownRate: 0.02,
  momentumBonus: 0.03,
  survivalBonus: 0.03,
}))

export const CITY_HEART_METHODS: HeartMethodDefinitionV10[] = Array.from({ length: 13 }, (_, offset) => {
  const worldIndex = offset + 1
  const worldId = `world_${String(worldIndex).padStart(2, '0')}`
  return {
    id: `${worldId}_heart_common`,
    name: `第${worldIndex}卷通用心法`,
    source: 'city',
    factionId: null,
    worldId,
    careerIds: Object.keys(categoryCareerIds).flatMap((category) => careersForCategory(category as CareerCategory)),
    energyRecovery: 1 + worldIndex * 0.1,
    gaugeRate: worldIndex * 0.005,
    cooldownRate: worldIndex * 0.004,
    momentumBonus: worldIndex * 0.005,
    survivalBonus: worldIndex * 0.005,
  }
})

export const HEART_METHODS_V10 = [...FACTION_HEART_METHODS, ...CITY_HEART_METHODS]

export const martialByIdV10 = (id: string): MartialDefinitionV10 | undefined =>
  MARTIALS_V10.find((martial) => martial.id === id)

export const martialByOriginalId = (id: number): MartialDefinitionV10 | undefined =>
  MARTIALS_V10.find((martial) => martial.originalSkillId === id)

export const heartMethodByIdV10 = (id: string): HeartMethodDefinitionV10 | undefined =>
  HEART_METHODS_V10.find((heartMethod) => heartMethod.id === id)
