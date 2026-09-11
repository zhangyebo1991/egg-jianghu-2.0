import { HEROES_V10, heroByIdV10 } from '../content/heroes'
import { heroPlacement } from '../content/hero-placement'
import { STACK_ITEM_DEFINITIONS } from '../content/campaign-loot.generated'
import { createHeroProgress } from './state'
import type { ActionResult, GameStateV10 } from './types'

export const SUMMON_RULES = {
  cost: 100, renownedRate: 0.01, legendaryRate: 0.002,
  heroPity: 70, legendaryPity: 280, targetPity: 560,
  renownedRefund: 10, legendaryRefund: 20,
} as const
export interface ChapterSummoning {
  sinceHero: number
  sinceLegendary: number
  targetId: string | null
  sinceTarget: number
}
export interface HeroSummoning { chapters: Record<string, ChapterSummoning> }
export const createHeroSummoning = (): HeroSummoning => ({ chapters: {} })
export const emptyChapterSummoning = (): ChapterSummoning => ({ sinceHero: 0, sinceLegendary: 0, targetId: null, sinceTarget: 0 })
export const chapterPool = (worldId: string) => HEROES_V10.filter(hero => hero.worldId === worldId && heroPlacement(hero.id)?.route === '章节池')
export const chapterSummoning = (state: GameStateV10, worldId: string): ChapterSummoning => state.heroSummoning.chapters[worldId] ?? emptyChapterSummoning()

export const setSummoningTarget = (state: GameStateV10, worldId: string, heroId: string): ActionResult => {
  if (!state.unlockedWorldIds.includes(worldId)) return { ok: false, message: '章节尚未解锁' }
  if (!chapterPool(worldId).some(hero => hero.id === heroId && heroPlacement(hero.id)?.tier === '传奇')) return { ok: false, message: '请选择本章传奇侠客' }
  const progress = chapterSummoning(state, worldId)
  if (progress.targetId === heroId) return { ok: true, message: '心愿目标未改变' }
  state.heroSummoning.chapters[worldId] = { ...progress, targetId: heroId, sinceTarget: 0 }
  return { ok: true, message: '心愿目标已保存，目标保障重新累计，章节保底保留' }
}

export interface SummonReward {
  kind: 'hero' | 'material'
  id: string
  name: string
  amount: number
  tier?: string
  duplicate?: boolean
  refund?: number
  guarantee?: '心愿保障' | '传奇保底' | '侠客保底'
}
export type SummonResult = { ok: false; message: string } | { ok: true; message: string; rewards: SummonReward[] }

export const summonHeroes = (state: GameStateV10, worldId: string, count: number, random = Math.random): SummonResult => {
  if (count !== 1 && count !== 10) return { ok: false, message: '仅支持单次或十次招募' }
  const pool = chapterPool(worldId)
  if (!pool.length || !state.unlockedWorldIds.includes(worldId)) return { ok: false, message: '章节尚未解锁' }
  const progress = { ...chapterSummoning(state, worldId) }
  if (!progress.targetId) return { ok: false, message: '请先设置本章心愿传奇' }
  if (state.idleVouchers.balance < count * SUMMON_RULES.cost) return { ok: false, message: '蛋蛋不足' }
  // 先取完随机数并验证，再扣款；无效随机源不能造成半次十连。
  const rolls = Array.from({ length: count }, () => [random(), random()])
  if (rolls.flat().some(value => !Number.isFinite(value) || value < 0 || value >= 1)) return { ok: false, message: '招募随机结果无效' }
  const rewards: SummonReward[] = []
  state.idleVouchers.balance -= count * SUMMON_RULES.cost
  for (const [roll, pick] of rolls) {
    progress.sinceHero++
    progress.sinceLegendary++
    progress.sinceTarget++
    let heroId: string | undefined
    let guarantee: SummonReward['guarantee']
    let tier: string | undefined
    if (progress.sinceTarget >= SUMMON_RULES.targetPity) {
      heroId = progress.targetId!
      guarantee = '心愿保障'
    } else if (progress.sinceLegendary >= SUMMON_RULES.legendaryPity || roll < SUMMON_RULES.legendaryRate) {
      tier = '传奇'
      if (progress.sinceLegendary >= SUMMON_RULES.legendaryPity) guarantee = '传奇保底'
    } else if (progress.sinceHero >= SUMMON_RULES.heroPity || roll < SUMMON_RULES.legendaryRate + SUMMON_RULES.renownedRate) {
      tier = '名侠'
      if (progress.sinceHero >= SUMMON_RULES.heroPity) guarantee = '侠客保底'
    }
    if (tier) {
      const candidates = pool.filter(hero => heroPlacement(hero.id)?.tier === tier)
      heroId = candidates[Math.floor(pick * candidates.length)].id
    }
    if (heroId) {
      const hero = heroByIdV10(heroId)!
      tier = heroPlacement(heroId)!.tier
      const duplicate = !!state.heroes[heroId]?.recruited
      const refund = duplicate ? (tier === '传奇' ? SUMMON_RULES.legendaryRefund : SUMMON_RULES.renownedRefund) : 0
      if (!duplicate) state.heroes[heroId] = createHeroProgress(hero.baseCareerId)
      state.idleVouchers.balance += refund
      progress.sinceHero = 0
      if (tier === '传奇') progress.sinceLegendary = 0
      if (heroId === progress.targetId) progress.sinceTarget = 0
      rewards.push({ kind: 'hero', id: heroId, name: hero.name, amount: 1, tier, duplicate, refund, guarantee })
    } else {
      // 固定少量一阶材料，不投放特殊票券或高阶资源。
      const id = [11, 20][Math.floor(pick * 2)]
      state.materials[String(id)] = (state.materials[String(id)] ?? 0) + 2
      rewards.push({ kind: 'material', id: String(id), name: STACK_ITEM_DEFINITIONS[id].name, amount: 2 })
    }
  }
  state.heroSummoning.chapters[worldId] = progress
  return { ok: true, message: `完成 ${count} 次招募`, rewards }
}

export const isHeroSummoning = (raw: unknown): raw is HeroSummoning => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const { chapters } = raw as HeroSummoning
  if (!chapters || typeof chapters !== 'object' || Array.isArray(chapters)) return false
  return Object.entries(chapters).every(([worldId, progress]) => {
    if (!/^world_(0[1-9]|1[0-3])$/.test(worldId) || !progress || typeof progress !== 'object' || Array.isArray(progress)) return false
    const within = (value: number, max: number) => Number.isInteger(value) && value >= 0 && value < max
    return within(progress.sinceHero, SUMMON_RULES.heroPity)
      && within(progress.sinceLegendary, SUMMON_RULES.legendaryPity)
      && within(progress.sinceTarget, SUMMON_RULES.targetPity)
      && (progress.targetId === null ? progress.sinceTarget === 0 : chapterPool(worldId).some(hero => hero.id === progress.targetId && heroPlacement(hero.id)?.tier === '传奇'))
  })
}
