import { martialById } from './data'
import type { LearnedMartialProgress, Resources } from './types'

export const MAX_LEARNED_MARTIALS = 20
export const MAX_EQUIPPED_MARTIALS = 4

export type MartialPassiveBonuses = {
  attack: number
  defense: number
  hp: number
}

export const zeroResources = (): Resources => ({
  silver: 0,
  experience: 0,
  pages: 0,
  reputation: 0,
})

export function getLegacyInvestment(rank: number): Resources {
  const safeRank = Math.max(1, Math.min(3, Math.floor(rank)))
  const invested = zeroResources()
  for (let currentRank = 1; currentRank < safeRank; currentRank += 1) {
    invested.silver += currentRank * 55
    invested.pages += currentRank * 12
  }
  return invested
}

const refundableAmount = (value: number): number =>
  Number.isFinite(value) ? Math.floor(Math.max(0, value) * 0.8) : 0

export const getMartialRefund = (invested: Resources): Resources => ({
  silver: refundableAmount(invested.silver),
  experience: refundableAmount(invested.experience),
  pages: refundableAmount(invested.pages),
  reputation: refundableAmount(invested.reputation),
})

export function getPassiveBonuses(
  learnedMartials: Record<string, LearnedMartialProgress>,
): MartialPassiveBonuses {
  const result: MartialPassiveBonuses = { attack: 0, defense: 0, hp: 0 }
  for (const [martialId, progress] of Object.entries(learnedMartials)) {
    const martial = martialById(martialId)
    if (!martial) continue
    const rank = Math.max(1, Math.min(3, Math.floor(progress.rank)))
    result[martial.passive.type] += martial.passive.valuePerRank * rank
  }
  return result
}

export function formatMartialPassive(martialId: string, rank: number): string {
  const martial = martialById(martialId)
  if (!martial) return '被动效果无效'
  const label = martial.passive.type === 'attack' ? '攻击' : martial.passive.type === 'defense' ? '防御' : '气血上限'
  const safeRank = Math.max(1, Math.min(3, Math.floor(rank)))
  const value = Math.round(martial.passive.valuePerRank * safeRank * 100)
  return `${label} +${value}%`
}
