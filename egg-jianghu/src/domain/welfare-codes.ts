import { heroByIdV10 } from '../content/heroes'
import { createHeroProgress } from './state'
import type { GameStateV10 } from './types'

export const ZHAO_YUN_ID = 'hero_orig_165'
export const WELFARE_CODE_ID = 'zhao-yun-welcome'
export interface WelfareReward { kind: 'hero'; id: string; name: string; amount: number }
export type WelfareResult = { ok: false; message: string } | { ok: true; message: string; rewards: WelfareReward[] }

export const redeemWelfareCode = (state: GameStateV10, input: string): WelfareResult => {
  if (input.trim() !== '花花蛋无敌') return { ok: false, message: '福利码无效，请检查后重试' }
  if (state.redeemedWelfareCodes.includes(WELFARE_CODE_ID)) return { ok: false, message: '此存档已领取该福利码' }
  if (state.heroes[ZHAO_YUN_ID]?.recruited) return { ok: false, message: '已拥有赵云，无需重复领取' }
  const hero = heroByIdV10(ZHAO_YUN_ID)!
  state.heroes[hero.id] = createHeroProgress(hero.baseCareerId)
  state.redeemedWelfareCodes.push(WELFARE_CODE_ID)
  return { ok: true, message: '福利领取成功', rewards: [{ kind: 'hero', id: hero.id, name: hero.name, amount: 1 }] }
}
