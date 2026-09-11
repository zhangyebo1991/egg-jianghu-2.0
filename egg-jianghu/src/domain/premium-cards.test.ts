import { expect, it } from 'vitest'
import { createNewGameStateV10 } from './state'
import { purchasePremiumCard, premiumBonuses, isPremiumCards } from './premium-cards'
import { campaignDropChance, grantKillLoot } from './loot'
import { settleCombatEvent } from './rewards'
import { exportSaveV10, importSaveV10 } from './save-v10'

const now = 1_800_000_000_000
const day = 86_400_000
const funded = () => {
  const state = createNewGameStateV10('少侠', now)
  state.idleVouchers.balance = 10_000
  return state
}

it('购买扣款、续购延时不叠效果，到期停止且不同项目独立相加', () => {
  const state = funded()
  for (const id of ['monthly', 'treasure', 'training']) expect(purchasePremiumCard(state, id, now).ok).toBe(true)
  expect(state.idleVouchers.balance).toBe(5400)
  expect(premiumBonuses(state, now)).toEqual({ equipment: 13, material: 8, experience: 10, skillPoints: 10 })
  purchasePremiumCard(state, 'treasure', now + day)
  expect(state.premiumCards.expiresAt.treasure).toBe(now + 14 * day)
  expect(premiumBonuses(state, now + day).equipment).toBe(13)
  expect(premiumBonuses(state, now + 7 * day).experience).toBe(0)
  expect(premiumBonuses(state, now + 14 * day).equipment).toBe(8)
  expect(premiumBonuses(state, now + 30 * day).equipment).toBe(0)
  purchasePremiumCard(state, 'treasure', now + 31 * day)
  expect(state.premiumCards.expiresAt.treasure).toBe(now + 38 * day)
  expect(campaignDropChance(.01, 300, 13)).toBeCloseTo(.0452)
  expect(campaignDropChance(.9, 0, 13)).toBe(1)
})

it('余额不足和非法卡不会扣钱或增加权益', () => {
  const state = funded()
  state.idleVouchers.balance = 799
  const before = structuredClone(state)
  expect(purchasePremiumCard(state, 'training', now).ok).toBe(false)
  expect(purchasePremiumCard(state, 'invalid', now).ok).toBe(false)
  expect(state).toEqual(before)
})

it('实战经验与 SP 加成保留尾数，旧档兼容，重新载入及到期不多发奖励', () => {
  let state = funded()
  purchasePremiumCard(state, 'training', now)
  const hero = state.heroes.hero_player
  const career = hero.currentCareerId
  const baseCareer = hero.careers[career].experience
  const event = { type: 'enemy-defeated' as const, atMs: 0, enemyId: 'world_01_stage_01_mob_1', enemyLevel: 1, rank: 'normal' as const, worldId: 'world_01', stage: 1, difficulty: 1, seed: 3 }
  for (let i = 0; i < 5; i++) settleCombatEvent(state, { ...event, seed: i }, now)
  state = importSaveV10(exportSaveV10(state, now), now).state
  for (let i = 5; i < 10; i++) settleCombatEvent(state, { ...event, seed: i }, now)
  expect(state.heroes.hero_player.experience).toBe(88)
  expect(state.heroes.hero_player.careers[career].experience - baseCareer).toBe(88)
  expect(state.heroes.hero_player.skillPoints).toBe(121)
  settleCombatEvent(state, { ...event, seed: 10 }, now + 7 * day)
  expect(state.heroes.hero_player.experience).toBe(96)
  expect(state.heroes.hero_player.skillPoints).toBe(132)
  const legacy = JSON.parse(exportSaveV10(state, now))
  delete legacy.premiumCards
  expect(importSaveV10(JSON.stringify(legacy), now).state.premiumCards.expiresAt.training).toBe(0)
  expect(isPremiumCards({ expiresAt: { monthly: -1 }, remainders: {} })).toBe(false)
})

it('收益卡实际提高普通材料和装备掉落，到期恢复原始掉落', () => {
  const input = { worldId: 'world_01', difficulty: 1, stage: 1, rank: 'normal' as const, seed: 0, enemyId: 'world_01_stage_01_mob_1' }
  let baseEquipment = 0, cardEquipment = 0, baseMaterial = 0, cardMaterial = 0
  for (let seed = 1; seed <= 400; seed++) {
    const base = funded(), active = funded(), expired = funded()
    for (const state of [active, expired]) {
      purchasePremiumCard(state, 'monthly', now)
      purchasePremiumCard(state, 'treasure', now)
    }
    grantKillLoot(base, { ...input, seed }, now)
    grantKillLoot(active, { ...input, seed }, now)
    grantKillLoot(expired, { ...input, seed }, now + 30 * day)
    expect(expired.inventory).toEqual(base.inventory)
    expect(expired.materials).toEqual(base.materials)
    baseEquipment += base.inventory.length
    cardEquipment += active.inventory.length
    baseMaterial += Object.entries(base.materials).filter(([id]) => +id >= 11).reduce((sum, [, count]) => sum + count, 0)
    cardMaterial += Object.entries(active.materials).filter(([id]) => +id >= 11).reduce((sum, [, count]) => sum + count, 0)
  }
  expect(cardEquipment).toBeGreaterThan(baseEquipment)
  expect(cardMaterial).toBeGreaterThan(baseMaterial)
})
