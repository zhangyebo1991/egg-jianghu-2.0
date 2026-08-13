import { careerById, careerJobBookName } from '../content/careers'
import type { ActionResult, HeroProgressV10 } from './types'

export const CAREER_MAX_LEVEL = 10

export const careerExperienceForNextLevel = (
  rank: number,
  careerLevel: number,
  heroLevel: number,
): number => {
  const jobLevel = Math.max(1, careerLevel)
  const personLevel = Math.max(1, heroLevel)
  return Math.round(
    0.7
    * Math.pow((2 * (rank - 1)) + jobLevel, 2)
    * Math.pow(1.0035, (personLevel * 40) + 100)
    * 100,
  )
}

export const addCareerExperience = (hero: HeroProgressV10, gained: number): void => {
  const record = hero.careers[hero.currentCareerId]
  if (!record) throw new Error(`当前职业不存在: ${hero.currentCareerId}`)
  const career = careerById(hero.currentCareerId)
  const rank = career?.rank ?? 1

  record.experience += Math.max(0, Math.floor(gained))
  while (record.level < CAREER_MAX_LEVEL) {
    const required = careerExperienceForNextLevel(rank, record.level, hero.level)
    if (record.experience < required) break
    record.experience -= required
    record.level += 1
  }
  if (record.level === CAREER_MAX_LEVEL) record.experience = 0
}

const requirementMet = (hero: HeroProgressV10, careerId: string, level: number): boolean =>
  (hero.careers[careerId]?.level ?? 0) >= level

export type CareerChangeKind = 'current' | 'switch' | 'unlock' | 'blocked'

export const previewCareerChange = (
  hero: HeroProgressV10,
  targetId: string,
  jobBooks: Record<string, number>,
  inCombat = false,
): { kind: CareerChangeKind; ok: boolean; message: string } => {
  if (inCombat) return { kind: 'blocked', ok: false, message: '战斗时无法转职！' }
  const target = careerById(targetId)
  if (!target) return { kind: 'blocked', ok: false, message: '职业不存在' }
  if (hero.currentCareerId === targetId) return { kind: 'current', ok: false, message: '已是当前职业' }
  if (hero.careers[targetId]) return { kind: 'switch', ok: true, message: '可直接转职' }
  for (const requirement of target.requirements) {
    if (!requirementMet(hero, requirement.careerId, requirement.level)) {
      const previous = careerById(requirement.careerId)
      return {
        kind: 'blocked',
        ok: false,
        message: `前置职业未达到 Lv.${requirement.level}${previous ? `（${previous.name}）` : ''}`,
      }
    }
  }
  if ((jobBooks[targetId] ?? 0) < 1) {
    return { kind: 'blocked', ok: false, message: `缺少${careerJobBookName(target)}` }
  }
  return { kind: 'unlock', ok: true, message: '转职' }
}

export const changeCareer = (
  hero: HeroProgressV10,
  targetId: string,
  jobBooks: Record<string, number>,
  inCombat = false,
): ActionResult => {
  if (inCombat) return { ok: false, message: '战斗时无法转职！' }

  const target = careerById(targetId)
  if (!target) return { ok: false, message: '职业不存在' }
  if (hero.currentCareerId === targetId) return { ok: false, message: '已是当前职业' }

  if (hero.careers[targetId]) {
    hero.currentCareerId = targetId
    return { ok: true, message: '已切换职业' }
  }

  for (const requirement of target.requirements) {
    if (!requirementMet(hero, requirement.careerId, requirement.level)) {
      const previous = careerById(requirement.careerId)
      return { ok: false, message: `前置职业未达到 Lv.${requirement.level}${previous ? `（${previous.name}）` : ''}` }
    }
  }

  const owned = jobBooks[targetId] ?? 0
  if (owned < 1) return { ok: false, message: `缺少${careerJobBookName(target)}` }

  jobBooks[targetId] = owned - 1
  hero.careers[targetId] = { level: 1, experience: 0 }
  hero.currentCareerId = targetId
  return { ok: true, message: '转职成功' }
}
