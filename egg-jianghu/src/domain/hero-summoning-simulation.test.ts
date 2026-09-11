import { expect, it } from 'vitest'
import { createRng } from '../combat/rng'
import { heroPlacement } from '../content/hero-placement'
import { createInitialStateV10 } from './state'
import { chapterPool, setSummoningTarget, summonHeroes } from './hero-summoning'

it('固定种子验证首次传奇约一个月及13章完整收集周期', () => {
  const firstHero: number[] = [], firstLegendary: number[] = []
  const report: Array<{ chapter: number; meanDays: number; medianDays: number; p90Days: number }> = []
  for (let chapter = 1; chapter <= 13; chapter++) {
    const worldId = `world_${String(chapter).padStart(2, '0')}`
    const pool = chapterPool(worldId)
    const legends = pool.filter(hero => heroPlacement(hero.id)?.tier === '传奇')
    const days: number[] = []
    for (let seed = 1; seed <= 64; seed++) {
      const state = createInitialStateV10(1_800_000_000_000)
      state.unlockedWorldIds = [worldId]
      state.idleVouchers.balance = 10_000_000
      const rng = createRng(chapter * 10000 + seed)
      let pulls = 0, targetPulls = 0
      let seenHero = false, seenLegendary = false
      setSummoningTarget(state, worldId, legends[0].id)
      while (!pool.every(hero => state.heroes[hero.id]?.recruited)) {
        const previousTarget = state.heroSummoning.chapters[worldId].targetId!
        const result = summonHeroes(state, worldId, 1, () => rng.nextFloat())
        if (!result.ok) throw new Error(result.message)
        pulls++; targetPulls++
        const reward = result.rewards[0]
        if (reward.kind === 'hero' && !seenHero) { firstHero.push(pulls); seenHero = true }
        if (reward.tier === '传奇' && !seenLegendary) { firstLegendary.push(pulls); seenLegendary = true }
        if (!state.heroes[previousTarget]?.recruited) expect(targetPulls).toBeLessThan(560)
        if (state.heroes[previousTarget]?.recruited) {
          const next = legends.find(hero => !state.heroes[hero.id]?.recruited)
          if (next) { setSummoningTarget(state, worldId, next.id); targetPulls = 0 }
        }
        if (pulls > 15000) throw new Error(`章节${chapter}种子${seed}收集异常`)
      }
      // 净消耗扣除重复返还；不计其他蛋蛋消费，也不计章节解锁所需时间。
      days.push((10_000_000 - state.idleVouchers.balance) / 700)
    }
    days.sort((a, b) => a - b)
    report.push({ chapter, meanDays: Math.round(days.reduce((a, b) => a + b) / days.length), medianDays: Math.round(days[32]), p90Days: Math.round(days[57]) })
  }
  const mean = (values: number[]) => values.reduce((a, b) => a + b) / values.length / 7
  expect(mean(firstHero)).toBeGreaterThan(6)
  expect(mean(firstHero)).toBeLessThan(8)
  expect(mean(firstLegendary)).toBeGreaterThan(28)
  expect(mean(firstLegendary)).toBeLessThan(33)
  expect(Math.max(...firstLegendary)).toBeLessThanOrEqual(280)
  console.log(JSON.stringify({ samples: firstLegendary.length, firstHeroMeanDays: mean(firstHero), firstLegendaryMeanDays: mean(firstLegendary), collection: report }))
}, 60_000)
