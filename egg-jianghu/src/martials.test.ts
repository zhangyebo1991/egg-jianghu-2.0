import { describe, expect, it } from 'vitest'
import {
  MAX_EQUIPPED_MARTIALS,
  MAX_LEARNED_MARTIALS,
  getLegacyInvestment,
  getMartialRefund,
  getPassiveBonuses,
} from './martials'

describe('武功纯规则', () => {
  it('固定最多学习 20 门并装备 4 门', () => {
    expect(MAX_LEARNED_MARTIALS).toBe(20)
    expect(MAX_EQUIPPED_MARTIALS).toBe(4)
  })

  it('按旧版三重培养公式还原累计投入', () => {
    expect(getLegacyInvestment(1)).toEqual({ silver: 0, experience: 0, pages: 0, reputation: 0 })
    expect(getLegacyInvestment(2)).toEqual({ silver: 55, experience: 0, pages: 12, reputation: 0 })
    expect(getLegacyInvestment(3)).toEqual({ silver: 165, experience: 0, pages: 36, reputation: 0 })
  })

  it('按每项累计投入的 80% 向下取整退款', () => {
    expect(getMartialRefund({ silver: 101, experience: 9, pages: 11, reputation: 1 }))
      .toEqual({ silver: 80, experience: 7, pages: 8, reputation: 0 })
  })

  it('全部已学武功按重数叠加被动', () => {
    const learned = {
      dragon_palm: { rank: 2, invested: { silver: 0, experience: 0, pages: 0, reputation: 0 } },
      frost_sword: { rank: 3, invested: { silver: 0, experience: 0, pages: 0, reputation: 0 } },
      taiji_breath: { rank: 1, invested: { silver: 0, experience: 0, pages: 0, reputation: 0 } },
    }
    expect(getPassiveBonuses(learned)).toEqual({ attack: 0.06, defense: 0.09, hp: 0.04 })
  })
})
