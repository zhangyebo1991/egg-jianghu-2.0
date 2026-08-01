import { careerById } from '../content/careers'
import { heartMethodByIdV10 } from '../content/martials'
import type { HeroDefinitionV10 } from '../content/heroes'
import type { HeroProgressV10 } from '../domain/types'

export interface CombatStats {
  maxHp: number
  maxEnergy: number
  initialEnergy: number
  energyRecovery: number
  externalAttack: number
  internalAttack: number
  externalDefense: number
  internalDefense: number
  effectiveAgility: number
  accuracy: number
  evade: number
  controlResistance: number
  criticalChance: number
  criticalMultiplier: number
  cooldownRate: number
  gaugeRate: number
  momentumBonus: number
  survivalBonus: number
  perfectedBonusPool: number
}

const gradeMultiplier = { 丙: 0.9, 乙: 1, 甲: 1.08, 地: 1.16, 天: 1.25 } as const
const tierMultiplier = { 初级: 1, 中级: 1.08, 高级: 1.17, 顶级: 1.28 } as const

export const buildCombatStats = (
  definition: HeroDefinitionV10,
  progress: HeroProgressV10,
): CombatStats => {
  const aptitude = definition.aptitudes
  const career = careerById(progress.currentCareerId)
  const careerRecord = progress.careers[progress.currentCareerId]
  const careerLevel = careerRecord?.level ?? 1
  const perfectedCount = Object.values(progress.careers).filter((record) => record.perfected).length
  const perfectedBonusPool = perfectedCount * 0.05
  const grade = gradeMultiplier[definition.grade]
  const tier = career ? tierMultiplier[career.tier] : 1
  const levelScale = 1 + Math.max(0, progress.level - 1) * 0.035
  const careerScale = 1 + Math.max(0, careerLevel - 1) * 0.02
  const sharedScale = grade * tier * levelScale * careerScale * (1 + perfectedBonusPool)

  const externalCareerBonus = career && ['剑', '刀', '拳', '暗'].includes(career.category) ? 1.15 : 1
  const internalCareerBonus = career && ['医', '内家'].includes(career.category) ? 1.15 : 1
  const heartMethod = progress.heartMethodId ? heartMethodByIdV10(progress.heartMethodId) : undefined

  return {
    maxHp: Math.floor((100 + aptitude.constitution * 15 + aptitude.resolve * 4) * sharedScale),
    maxEnergy: 100,
    initialEnergy: 20,
    energyRecovery: 5 + (heartMethod?.energyRecovery ?? 0),
    externalAttack: Math.floor((20 + aptitude.strength * 4 + aptitude.agility) * sharedScale * externalCareerBonus),
    internalAttack: Math.floor((20 + aptitude.insight * 4 + aptitude.resolve) * sharedScale * internalCareerBonus),
    externalDefense: Math.floor((10 + aptitude.constitution * 2.5 + aptitude.strength) * sharedScale),
    internalDefense: Math.floor((10 + aptitude.resolve * 2.5 + aptitude.insight) * sharedScale),
    effectiveAgility: Math.max(1, (20 + aptitude.agility * 6) * (1 + (heartMethod?.gaugeRate ?? 0))),
    accuracy: Math.min(0.2, aptitude.insight * 0.005 + aptitude.agility * 0.003),
    evade: Math.min(0.7, aptitude.agility * 0.01),
    controlResistance: Math.min(0.8, aptitude.resolve * 0.012),
    criticalChance: Math.min(1, aptitude.insight * 0.006 + aptitude.agility * 0.004),
    criticalMultiplier: 1.5,
    cooldownRate: Math.min(0.6, heartMethod?.cooldownRate ?? 0),
    gaugeRate: heartMethod?.gaugeRate ?? 0,
    momentumBonus: heartMethod?.momentumBonus ?? 0,
    survivalBonus: heartMethod?.survivalBonus ?? 0,
    perfectedBonusPool,
  }
}
