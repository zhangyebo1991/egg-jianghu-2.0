import { careerById } from '../content/careers'
import type { ActionResult, HeroProgressV10 } from './types'

export const CAREER_MAX_LEVEL = 20
export const CAREER_TRANSFER_LEVEL = 10

export const careerExperienceForNextLevel = (level: number): number =>
  100 + level * level * 20

export const addCareerExperience = (hero: HeroProgressV10, gained: number): void => {
  const record = hero.careers[hero.currentCareerId]
  if (!record) throw new Error(`当前职业不存在: ${hero.currentCareerId}`)

  record.experience += Math.max(0, Math.floor(gained))
  while (record.level < CAREER_MAX_LEVEL) {
    const required = careerExperienceForNextLevel(record.level)
    if (record.experience < required) break
    record.experience -= required
    record.level += 1
  }
  if (record.level === CAREER_MAX_LEVEL) record.experience = 0
}

export const changeCareer = (
  hero: HeroProgressV10,
  targetId: string,
  ownedTokens: string[],
): ActionResult => {
  const target = careerById(targetId)
  if (!target) return { ok: false, message: '职业不存在' }

  if (hero.careers[targetId]) {
    hero.currentCareerId = targetId
    return { ok: true, message: '已切换职业' }
  }

  if (!target.previousId) return { ok: false, message: '初级职业不能通过转职解锁' }
  const previous = hero.careers[target.previousId]
  if (!previous || previous.level < CAREER_TRANSFER_LEVEL) {
    return { ok: false, message: '前置职业未达到 Lv.10' }
  }

  const tokenId = `token_${targetId}`
  const tokenIndex = ownedTokens.indexOf(tokenId)
  if (tokenIndex < 0) return { ok: false, message: '缺少转职信物' }

  ownedTokens.splice(tokenIndex, 1)
  hero.careers[targetId] = { level: 1, experience: 0, perfected: false }
  hero.currentCareerId = targetId
  return { ok: true, message: '转职成功' }
}

export const perfectCareer = (hero: HeroProgressV10, careerId: string): ActionResult => {
  const record = hero.careers[careerId]
  if (!record) return { ok: false, message: '尚未解锁该职业' }
  if (record.level < CAREER_MAX_LEVEL) return { ok: false, message: '职业未达到 Lv.20' }
  if (record.perfected) return { ok: false, message: '已经领取圆满心得' }

  record.perfected = true
  return { ok: true, message: '已领悟圆满心得' }
}
