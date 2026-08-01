import { FACTIONS, RARITY_BUDGET_BY_WORLD } from './factions'
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
  name: string
  source: 'faction' | 'city'
  factionId: string | null
  worldId: string
  branch: string
  branchIndex: 1 | 2
  stage: 1 | 2 | 3 | 4
  rarity: Rarity
  category: CareerCategory
  damageRoute: DamageRoute
  force: MartialForce
  energyCost: number
  cooldownMs: number
  power: number
  previousId: string | null
  careerIds: string[]
  currencySource: MartialCost
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

const careersForBranch = (category: CareerCategory, branchIndex: 1 | 2): string[] => {
  const [base, firstBranch, secondBranch] = categoryCareerIds[category]
  const prefix = branchIndex === 1 ? firstBranch : secondBranch
  return [base, `${prefix}_mid`, `${prefix}_high`, `${prefix}_top`]
}

const routeForCategory = (category: CareerCategory): DamageRoute => {
  if (category === '医') return 'healing'
  if (category === '内家') return 'internal'
  return 'external'
}

const forceFor = (category: CareerCategory, branchIndex: 1 | 2): MartialForce => {
  if (category === '医') return 'support'
  if (category === '内家') return 'soft'
  if (branchIndex === 1 && (category === '剑' || category === '刀' || category === '暗')) return 'swift'
  return branchIndex === 1 ? 'hard' : 'soft'
}

const stageLetters = ['a', 'b', 'c', 'd'] as const
const stageNames = ['初传', '进境', '真传', '秘传'] as const

export const FACTION_MARTIALS: MartialDefinitionV10[] = FACTIONS.flatMap((faction) => {
  const rarities = RARITY_BUDGET_BY_WORLD[faction.worldId]
  const worldIndex = Number(faction.worldId.slice(-2))
  return ([1, 2] as const).flatMap((branchIndex) => stageLetters.map((letter, stageOffset) => {
    const stage = (stageOffset + 1) as 1 | 2 | 3 | 4
    const id = `${faction.id}_${letter}${branchIndex}`
    return {
      id,
      name: `${faction.name}·${faction.branchLabels[branchIndex - 1]}${stageNames[stageOffset]}`,
      source: 'faction' as const,
      factionId: faction.id,
      worldId: faction.worldId,
      branch: faction.branchLabels[branchIndex - 1],
      branchIndex,
      stage,
      rarity: rarities[(branchIndex - 1) * 4 + stageOffset],
      category: faction.category,
      damageRoute: routeForCategory(faction.category),
      force: forceFor(faction.category, branchIndex),
      energyCost: 8 + stage * 4,
      cooldownMs: 1800 + stage * 400,
      power: 0.8 + stage * 0.35,
      previousId: stage === 1 ? null : `${faction.id}_${stageLetters[stageOffset - 1]}${branchIndex}`,
      careerIds: careersForBranch(faction.category, branchIndex),
      currencySource: {
        kind: 'contribution' as const,
        id: faction.id,
        amount: 60 * stage + worldIndex * 20,
      },
    }
  }))
})

export const CITY_MARTIALS: MartialDefinitionV10[] = Array.from({ length: 10 }, (_, worldOffset) => {
  const worldIndex = worldOffset + 1
  const worldId = `world_${String(worldIndex).padStart(2, '0')}`
  return (Object.keys(categoryCareerIds) as CareerCategory[]).map((category) => {
    const baseCareer = categoryCareerIds[category][0]
    return {
      id: `${worldId}_common_${baseCareer}_01`,
      name: `${worldId}通用${category}法`,
      source: 'city' as const,
      factionId: null,
      worldId,
      branch: '通用',
      branchIndex: 1 as const,
      stage: 1 as const,
      rarity: (RARITY_BUDGET_BY_WORLD[worldId][0] ?? '粗浅') as Rarity,
      category,
      damageRoute: routeForCategory(category),
      force: forceFor(category, 1),
      energyCost: 10 + worldIndex,
      cooldownMs: 2500,
      power: 0.9 + worldIndex * 0.05,
      previousId: null,
      careerIds: [baseCareer, ...careersForBranch(category, 1).slice(1), ...careersForBranch(category, 2).slice(1)],
      currencySource: { kind: 'worldCurrency' as const, id: worldId, amount: 150 + worldIndex * 50 },
    }
  })
}).flat()

export const FACTION_HEART_METHODS: HeartMethodDefinitionV10[] = FACTIONS.map((faction) => ({
  id: `${faction.id}_heart_01`,
  name: `${faction.name}心法`,
  source: 'faction',
  factionId: faction.id,
  worldId: faction.worldId,
  careerIds: [
    ...careersForBranch(faction.category, 1),
    ...careersForBranch(faction.category, 2).slice(1),
  ],
  energyRecovery: 1,
  gaugeRate: 0.02,
  cooldownRate: 0.02,
  momentumBonus: 0.03,
  survivalBonus: 0.03,
}))

export const CITY_HEART_METHODS: HeartMethodDefinitionV10[] = Array.from({ length: 10 }, (_, worldOffset) => {
  const worldIndex = worldOffset + 1
  const worldId = `world_${String(worldIndex).padStart(2, '0')}`
  return {
    id: `${worldId}_heart_common`,
    name: `第${worldIndex}卷通用心法`,
    source: 'city',
    factionId: null,
    worldId,
    careerIds: Object.values(categoryCareerIds).flatMap(([base, first, second]) => [
      base,
      `${first}_mid`, `${first}_high`, `${first}_top`,
      `${second}_mid`, `${second}_high`, `${second}_top`,
    ]),
    energyRecovery: 1 + worldIndex * 0.1,
    gaugeRate: worldIndex * 0.005,
    cooldownRate: worldIndex * 0.004,
    momentumBonus: worldIndex * 0.005,
    survivalBonus: worldIndex * 0.005,
  }
})

export const MARTIALS_V10 = [...FACTION_MARTIALS, ...CITY_MARTIALS]
export const HEART_METHODS_V10 = [...FACTION_HEART_METHODS, ...CITY_HEART_METHODS]

export const martialByIdV10 = (id: string): MartialDefinitionV10 | undefined =>
  MARTIALS_V10.find((martial) => martial.id === id)

export const heartMethodByIdV10 = (id: string): HeartMethodDefinitionV10 | undefined =>
  HEART_METHODS_V10.find((heartMethod) => heartMethod.id === id)
