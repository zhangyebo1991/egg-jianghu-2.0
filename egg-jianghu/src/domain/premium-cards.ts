import type { ActionResult, GameStateV10 } from './types'

export const PREMIUM_CARDS = [
  { id: 'monthly', name: '江湖月卡', price: 3000, days: 30, equipment: 8, material: 8, experience: 0, skillPoints: 0, description: '普通材料与装备掉落概率 +8%' },
  { id: 'treasure', name: '寻宝周卡', price: 800, days: 7, equipment: 5, material: 0, experience: 0, skillPoints: 0, description: '装备掉落概率 +5%' },
  { id: 'training', name: '修习周卡', price: 800, days: 7, equipment: 0, material: 0, experience: 10, skillPoints: 10, description: '战斗角色经验、职业经验与 SP +10%' },
] as const
export type PremiumCardId = typeof PREMIUM_CARDS[number]['id']
export interface PremiumCards {
  expiresAt: Record<PremiumCardId, number>
  remainders: Record<string, { experience: number; careerExperience?: number; skillPoints: number }>
}
export const createPremiumCards = (): PremiumCards => ({ expiresAt: { monthly: 0, treasure: 0, training: 0 }, remainders: {} })
export const premiumBonuses = (state: GameStateV10, now = Date.now()) => {
  const bonus = { equipment: 0, material: 0, experience: 0, skillPoints: 0 }
  for (const card of PREMIUM_CARDS) {
    if (state.premiumCards.expiresAt[card.id] <= now) continue
    for (const key of ['equipment', 'material', 'experience', 'skillPoints'] as const) bonus[key] += card[key]
  }
  return bonus
}

export const purchasePremiumCard = (state: GameStateV10, id: string, now = Date.now()): ActionResult => {
  const card = PREMIUM_CARDS.find(card => card.id === id)
  if (!card) return { ok: false, message: '收益卡不存在' }
  const expiresAt = Math.max(now, state.premiumCards.expiresAt[card.id]) + card.days * 86_400_000
  if (!Number.isSafeInteger(now) || now < 0 || expiresAt > 8.64e15) return { ok: false, message: '有效期超出范围' }
  if (state.idleVouchers.balance < card.price) return { ok: false, message: '蛋蛋不足' }
  state.idleVouchers.balance -= card.price
  state.premiumCards.expiresAt[card.id] = expiresAt
  return { ok: true, message: `${card.name}已生效，有效期延长 ${card.days} 天` }
}

/** 百分比尾数按侠客保存，低额奖励也能完整获得加成，不逐次四舍五入。 */
export const premiumProgressReward = (state: GameStateV10, heroId: string, kind: 'experience' | 'careerExperience' | 'skillPoints', base: number, percent: number): number => {
  if (percent === 0) return base
  const remainder = state.premiumCards.remainders[heroId] ??= { experience: 0, skillPoints: 0 }
  // 旧档两类经验共用同一笔奖励，拆分前先保留两者已有的加成尾数。
  remainder.careerExperience ??= remainder.experience
  const total = base * percent + (remainder[kind] ?? 0)
  remainder[kind] = total % 100
  return base + Math.floor(total / 100)
}

export const isPremiumCards = (value: unknown): value is PremiumCards => {
  if (!value || typeof value !== 'object') return false
  const { expiresAt, remainders } = value as PremiumCards
  return !!expiresAt && typeof expiresAt === 'object' && !Array.isArray(expiresAt)
    && PREMIUM_CARDS.every(card => Number.isSafeInteger(expiresAt[card.id]) && expiresAt[card.id] >= 0 && expiresAt[card.id] <= 8.64e15)
    && !!remainders && typeof remainders === 'object' && !Array.isArray(remainders)
    && Object.values(remainders).every(item => item && ['experience', 'skillPoints', 'careerExperience'].every(key => {
      const amount = item[key as keyof typeof item]
      if (key === 'careerExperience' && amount === undefined) return true
      return typeof amount === 'number' && Number.isInteger(amount) && amount >= 0 && amount < 100
    }))
}
