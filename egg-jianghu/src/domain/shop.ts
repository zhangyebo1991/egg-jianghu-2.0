import { CAREERS, careerById, careerJobBookName } from '../content/careers'
import type { ActionResult, GameStateV10 } from './types'

export const JOB_BOOK_SHOP_RANKS = [2, 3, 4, 5, 6] as const
export type JobBookShopRank = typeof JOB_BOOK_SHOP_RANKS[number]

export const JOB_BOOK_PRICE_BY_RANK: Record<JobBookShopRank, number> = {
  2: 200,
  3: 600,
  4: 1500,
  5: 4000,
  6: 10000,
}

export const JOB_BOOK_SHOP_TIER_LABELS: Record<JobBookShopRank, string> = {
  2: '一阶',
  3: '二阶',
  4: '三阶',
  5: '四阶',
  6: '五阶',
}

export const jobBookPrice = (rank: number): number | undefined =>
  JOB_BOOK_PRICE_BY_RANK[rank as JobBookShopRank]

export const shopJobBooksForRank = (rank: JobBookShopRank) =>
  CAREERS.filter((career) => career.rank === rank).map((career) => ({
    careerId: career.id,
    careerName: career.name,
    bookName: careerJobBookName(career),
    price: JOB_BOOK_PRICE_BY_RANK[rank],
  }))

export const buyJobBook = (
  state: GameStateV10,
  careerId: string,
  worldId: string,
): ActionResult => {
  const career = careerById(careerId)
  if (!career) return { ok: false, message: '职业不存在' }
  if (career.rank < 2) return { ok: false, message: '白丁无需转职书' }
  const price = jobBookPrice(career.rank)
  if (price == null) return { ok: false, message: '该职业不出售转职书' }
  const wallet = state.worldCurrency[worldId] ?? 0
  if (wallet < price) return { ok: false, message: '铜钱不足' }
  state.worldCurrency[worldId] = wallet - price
  state.jobBooks[careerId] = (state.jobBooks[careerId] ?? 0) + 1
  return { ok: true, message: `购得${careerJobBookName(career)}` }
}
