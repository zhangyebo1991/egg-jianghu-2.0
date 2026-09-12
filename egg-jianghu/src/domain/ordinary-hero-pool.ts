import { ORDINARY_POOL_HEROES, ORDINARY_POOL_RULES } from '../content/ordinary-hero-pool'
import { STACK_ITEM_DEFINITIONS } from '../content/campaign-loot.generated'
import { createHeroProgress } from './state'
import type { GameStateV10 } from './types'

export const availableOrdinaryPoolHeroes = (state: GameStateV10) => ORDINARY_POOL_HEROES.filter(hero =>
  state.unlockedWorldIds.includes(hero.worldId) && !state.heroes[hero.id]?.recruited)

export interface OrdinaryPoolReward { kind: 'hero' | 'material'; id: string; name: string; amount: number }
export type OrdinaryPoolResult = { ok: false; message: string } | {
  ok: true; message: string; rewards: OrdinaryPoolReward[]; draws: number; spent: number
}

export const drawOrdinaryPool = (state: GameStateV10, count: number, random = Math.random): OrdinaryPoolResult => {
  if (count !== 1 && count !== 10) return { ok: false, message: '仅支持一次或十次招募' }
  const pool = availableOrdinaryPoolHeroes(state)
  if (!pool.length) return { ok: false, message: '暂无可抽取角色' }
  if (state.idleVouchers.balance < count * ORDINARY_POOL_RULES.cost) return { ok: false, message: '蛋蛋不足' }
  // 全批次先在副本结算；异常随机源不能造成半次消费或发奖。
  const heroes = { ...state.heroes }
  const materials = { ...state.materials }
  let misses = state.ordinaryPoolMisses
  const rewards: OrdinaryPoolReward[] = []
  const roll = () => {
    const value = random()
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('招募随机结果无效')
    return value
  }
  try {
    for (let index = 0; index < count && pool.length; index++) {
      const chance = roll()
      const pick = roll()
      if (misses + 1 >= ORDINARY_POOL_RULES.heroPity || chance < ORDINARY_POOL_RULES.heroRate) {
        const [hero] = pool.splice(Math.floor(pick * pool.length), 1)
        heroes[hero.id] = createHeroProgress(hero.baseCareerId)
        rewards.push({ kind: 'hero', id: hero.id, name: hero.name, amount: 1 })
        misses = 0
      } else {
        const id = ORDINARY_POOL_RULES.materialIds[Math.floor(pick * ORDINARY_POOL_RULES.materialIds.length)]
        materials[String(id)] = (materials[String(id)] ?? 0) + 2
        rewards.push({ kind: 'material', id: String(id), name: STACK_ITEM_DEFINITIONS[id].name, amount: 2 })
        misses++
      }
    }
  } catch {
    return { ok: false, message: '招募随机结果无效，请重试' }
  }
  const draws = rewards.length
  const spent = draws * ORDINARY_POOL_RULES.cost
  state.heroes = heroes
  state.materials = materials
  state.ordinaryPoolMisses = misses
  state.idleVouchers.balance -= spent
  return { ok: true, rewards, draws, spent, message: `完成${draws}次招募，消耗${spent}蛋蛋${pool.length ? '' : '；暂无可抽取角色'}` }
}
