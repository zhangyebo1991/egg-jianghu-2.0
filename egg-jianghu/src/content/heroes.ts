import { FACTIONS } from './factions'
import type { CareerCategory } from './careers'
import type { HeroGrade, HeroProgressV10 } from '../domain/types'

export interface HeroAptitudes {
  strength: number
  insight: number
  constitution: number
  agility: number
  resolve: number
}

export interface HeroDefinitionV10 {
  id: string
  name: string
  grade: HeroGrade
  baseCareerId: string
  worldId: string
  source: 'starter' | 'tavern' | 'faction'
  cost: number
  factionId: string | null
  aptitudes: HeroAptitudes
}

export const TAVERN_HERO_ROWS = [
  ['hero_shen_yanqiu', '沈砚秋', '乙', 'sword', 280, [10, 7, 8, 11, 7]],
  ['hero_huo_chuan', '霍川', '乙', 'blade', 280, [11, 6, 10, 8, 8]],
  ['hero_yue_jinghong', '岳惊鸿', '乙', 'fist', 260, [10, 7, 11, 7, 8]],
  ['hero_pei_wuying', '裴无影', '乙', 'shadow', 300, [8, 8, 7, 12, 8]],
  ['hero_su_wenlan', '苏问岚', '乙', 'doctor', 260, [6, 12, 8, 8, 10]],
  ['hero_lu_guiyuan', '陆归元', '乙', 'inner', 300, [7, 11, 9, 7, 11]],
] as const

export const PLAYER_HERO_ID = 'hero_player'

export const PLAYER_HERO_V10: HeroDefinitionV10 = {
  id: PLAYER_HERO_ID,
  name: '无名少侠',
  grade: '丙',
  baseCareerId: 'sword',
  worldId: 'world_01',
  source: 'starter',
  cost: 0,
  factionId: null,
  aptitudes: {
    strength: 8,
    insight: 8,
    constitution: 9,
    agility: 9,
    resolve: 8,
  },
}

const careerByCategory: Record<CareerCategory, string> = {
  剑: 'sword',
  刀: 'blade',
  拳: 'fist',
  暗: 'shadow',
  医: 'doctor',
  内家: 'inner',
}

const factionGrade = (worldId: string): HeroGrade => {
  const worldIndex = Number(worldId.slice(-2))
  if (worldIndex >= 9) return '天'
  if (worldIndex >= 7) return '地'
  if (worldIndex >= 4) return '甲'
  return '乙'
}

const aptitudesFor = (category: CareerCategory, worldIndex: number): HeroAptitudes => {
  const base = 7 + Math.floor(worldIndex / 2)
  const aptitude: HeroAptitudes = {
    strength: base,
    insight: base,
    constitution: base,
    agility: base,
    resolve: base,
  }
  if (category === '剑' || category === '暗') aptitude.agility += 3
  if (category === '刀' || category === '拳') aptitude.strength += 3
  if (category === '拳') aptitude.constitution += 2
  if (category === '医' || category === '内家') aptitude.insight += 3
  if (category === '内家') aptitude.resolve += 2
  return aptitude
}

export const TAVERN_HEROES: HeroDefinitionV10[] = TAVERN_HERO_ROWS.map(
  ([id, name, grade, baseCareerId, cost, values]) => ({
    id,
    name,
    grade,
    baseCareerId,
    worldId: 'world_01',
    source: 'tavern',
    cost,
    factionId: null,
    aptitudes: {
      strength: values[0],
      insight: values[1],
      constitution: values[2],
      agility: values[3],
      resolve: values[4],
    },
  }),
)

export const FACTION_HEROES: HeroDefinitionV10[] = FACTIONS.map((faction) => {
  const worldIndex = Number(faction.worldId.slice(-2))
  return {
    id: `hero_${faction.id}`,
    name: `${faction.name}传人`,
    grade: factionGrade(faction.worldId),
    baseCareerId: careerByCategory[faction.category],
    worldId: faction.worldId,
    source: 'faction',
    cost: 600 + worldIndex * 200,
    factionId: faction.id,
    aptitudes: aptitudesFor(faction.category, worldIndex),
  }
})

export const HEROES_V10: HeroDefinitionV10[] = [PLAYER_HERO_V10, ...TAVERN_HEROES, ...FACTION_HEROES]

export const heroByIdV10 = (id: string): HeroDefinitionV10 | undefined =>
  HEROES_V10.find((hero) => hero.id === id)

export const heroDisplayNameV10 = (definition: HeroDefinitionV10, progress?: HeroProgressV10): string =>
  typeof progress?.customName === 'string' && progress.customName.trim() || definition.name
