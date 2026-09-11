import { describe, expect, it } from 'vitest'
import { equipmentDefinitionById } from '../content/equipment'
import { CAMPAIGN_LOOT_STAGES, CAMPAIGN_ENEMY_DROPS, CAMPAIGN_DROP_ITEMS, CAMPAIGN_MATERIALS } from '../content/campaign-loot.generated'
import { campaignDropBonus, campaignDropChance, grantKillLoot, materialExtraQuality, pickWeightedQuality } from './loot'
import { createInitialStateV10 } from './state'
import { INVENTORY_CAPACITY } from './inventory'
import { ORIGINAL_FACTION_RULES } from '../content/original-faction-rules.generated'

const input = { worldId: 'world_01', difficulty: 1, stage: 1, rank: 'normal' as const, seed: 11, enemyId: 'world_01_stage_01_mob_1' }

describe('原版普通位面掉落', () => {
  it.each(Array.from({ length: 13 }, (_, i) => i + 1))('第 %i 世界十关所有敌人的物品及材料均能入库且不串池', (world) => {
    const stages = CAMPAIGN_LOOT_STAGES.filter(s => s.worldId === `world_${String(world).padStart(2, '0')}`)
    expect(stages).toHaveLength(10)
    for (const quality of ORIGINAL_FACTION_RULES.tasks.targetPools.find(pool => pool.worldIndex === world)!.materialItemsByQuality) {
      for (const target of quality.items) {
        expect(stages.some(stage => stage.materials.some(slot => slot.family === target.family
          && target.itemQuality >= slot.baseQuality && target.itemQuality <= slot.baseQuality + 3))).toBe(true)
      }
    }
    for (const stage of stages) for (const [index, enemyId] of stage.enemyIds.entries()) {
      const state = createInitialStateV10(0)
      // 概率推至上限，穷举每个原版表项的实际入库路径。
      state.city.technologyLevels['65'] = 1_000_000
      const enemyKey = `${stage.worldId}_stage_${String(stage.stage).padStart(2, '0')}_${index === 5 ? 'boss' : `mob_${index + 1}`}`
      grantKillLoot(state, { ...input, worldId: stage.worldId, stage: stage.stage, enemyId: enemyKey, rank: index === 5 ? 'boss' : 'normal' })
      const expected = CAMPAIGN_ENEMY_DROPS[enemyId].map(id => CAMPAIGN_DROP_ITEMS[id])
      expect(state.inventory.map(i => i.definitionId)).toEqual(expected.filter(i => i.kind === 'equipment').map(i => `wp_${i.id}`))
      for (const item of state.inventory) expect(equipmentDefinitionById(item.definitionId)).toBeDefined()
      for (const item of expected.filter(i => i.kind === 'material')) expect(state.materials[String(item.id)]).toBe(1)
      const entries = Object.entries(state.materials).filter(([id]) => Number(id) >= 11)
      expect(entries.reduce((sum, [, count]) => sum + count, 0)).toBe(stage.materials.length)
      for (const [id] of entries) {
        const material = CAMPAIGN_MATERIALS.find(m => m.id === Number(id))!
        expect(stage.materials.some(slot => slot.family === material.family)).toBe(true)
        expect(index === 5 ? [3, 4] : [1, 2]).toContain(material.quality)
      }
    }
  })

  it('材料和装备品质边界符合原版权重', () => {
    expect([0, .89999, .9, .99999].map(r => materialExtraQuality('normal', r))).toEqual([0, 0, 1, 1])
    expect([0, .5, .9].map(r => materialExtraQuality('elite', r))).toEqual([0, 1, 2])
    expect([0, .7].map(r => materialExtraQuality('captain', r))).toEqual([1, 2])
    expect([0, .7].map(r => materialExtraQuality('boss', r))).toEqual([2, 3])
    expect(pickWeightedQuality('normal', .7)).toBe(2)
    expect(pickWeightedQuality('boss', .7)).toBe(4)
  })

  it('基础掉率、科技加成和上下限正确', () => {
    expect(CAMPAIGN_LOOT_STAGES[0].materials.map(m => m.baseChance)).toEqual([.37, .28])
    const state = createInitialStateV10(0)
    expect(campaignDropBonus(state)).toBe(0)
    state.city.technologyLevels['65'] = 10
    expect(campaignDropBonus(state)).toBe(15)
    expect(campaignDropChance(.37, 5)).toBeCloseTo(.3885)
    expect(campaignDropChance(.15, 100)).toBe(.3)
    expect(campaignDropChance(.37, -200)).toBe(0)
    expect(campaignDropChance(.37, 10000)).toBe(1)
  })

  it('基础概率允许空掉落，材料与三种票券均能自然取得', () => {
    const seen = new Set<number>()
    let emptyKills = 0, ore = 0
    for (let seed = 1; seed <= 1000; seed++) {
      const state = createInitialStateV10(0)
      grantKillLoot(state, { ...input, seed })
      if (!state.inventory.length) emptyKills++
      expect(state.inventory.every(i => ['wp_102', 'wp_115', 'wp_123'].includes(i.definitionId))).toBe(true)
      ore += (state.materials['11'] ?? 0) + (state.materials['12'] ?? 0)
      grantKillLoot(state, { ...input, seed: seed + 1000, rank: 'boss', enemyId: 'world_01_stage_01_boss' })
      Object.keys(state.materials).forEach(id => seen.add(Number(id)))
    }
    expect(emptyKills).toBeGreaterThan(400)
    expect(ore).toBeGreaterThan(300)
    expect(ore).toBeLessThan(440)
    expect([5, 6, 7].every(id => seen.has(id))).toBe(true)
  })

  it('同 seed 可重现，非法敌人不借用整关掉落池', () => {
    const left = createInitialStateV10(0), right = createInitialStateV10(0)
    grantKillLoot(left, input)
    grantKillLoot(right, input)
    expect(left).toEqual(right)
    const state = createInitialStateV10(0)
    expect(grantKillLoot(state, { ...input, enemyId: 'world_02_stage_01_boss' })).toEqual([])
    expect(state.materials).toEqual({})
  })

  it('装备背包满仍结算材料与票券，未装入装备均计数', () => {
    const state = createInitialStateV10(0)
    state.city.technologyLevels['65'] = 1_000_000
    state.inventory = Array.from({ length: INVENTORY_CAPACITY }, (_, i) => ({ uid: `full_${i}`, definitionId: 'wp_101', level: 1, quality: 1 as const, coreStats: [], affixes: [], locked: false }))
    expect(grantKillLoot(state, { ...input, rank: 'boss', enemyId: 'world_01_stage_01_boss' })).toEqual([])
    expect(state.inventory).toHaveLength(INVENTORY_CAPACITY)
    expect(state.statistics.equipmentMissedAtCapacity).toBe(2)
    expect(state.materials).toMatchObject({ '5': 1, '6': 1, '7': 1 })
    expect(Object.keys(state.materials).some(id => [13, 14].includes(Number(id)))).toBe(true)
  })
})


describe('战斗自动丢弃', () => {
  it.each([0, 1, 2, 3, 4, 9] as const)('只过滤低于 %i 的新掉落，保留边界品质且不改变材料或后续随机结果', threshold => {
    let kept = 0, discarded = 0
    for (let seed = 1; seed <= 80; seed++) {
      const original = createInitialStateV10(0)
      original.city.technologyLevels['65'] = 1_000_000
      grantKillLoot(original, { ...input, seed: seed + 1000 })
      original.inventory.forEach(item => { item.locked = true })
      const filtered = structuredClone(original)
      filtered.settings.autoDiscardBelowQuality = threshold
      const existing = structuredClone(original.inventory)
      const ids = grantKillLoot(original, { ...input, seed })
      const filteredIds = grantKillLoot(filtered, { ...input, seed })
      const drops = original.inventory.filter(item => ids.includes(item.uid))
      const expected = drops.filter(item => item.quality >= threshold)
      kept += expected.length
      discarded += drops.length - expected.length
      expect(filteredIds).toEqual(expected.map(item => item.uid))
      expect(filtered.inventory).toEqual([...existing, ...expected])
      expect(filtered.materials).toEqual(original.materials)
      expect(filtered.worldCurrency).toEqual(original.worldCurrency)
    }
    if (threshold > 1) expect(discarded).toBeGreaterThan(0)
    if (threshold <= 3) expect(kept).toBeGreaterThan(0)
  })
})
