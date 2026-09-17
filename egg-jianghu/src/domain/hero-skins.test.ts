import { describe, expect, it } from 'vitest'
import { HEROES_V10, PLAYER_HERO_V10 } from '../content/heroes'
import { HERO_SKINS, ORIGINAL_HERO_APPEARANCES } from '../content/hero-skins.generated'
import { ownsSkin, ownedSkinAttributes, skinById, skinStars } from '../content/hero-skins'
import { createHeroProgress, createNewGameStateV10 } from './state'
import { selectHeroSkin, upgradeHeroSkin } from './hero-skins'
import { hydrateStateV10 } from './save-v10'
import { buildCombatStats } from '../combat/stats'
import { buildCombatParty } from '../app/game-session'
import { originalFactionExchangeByFaction } from '../content/original-faction-exchange.generated'
import { FACTIONS } from '../content/factions'
import { exchangeFactionItem } from './faction-exchange'

describe('皮肤所有权、升星与属性', () => {
  it('免费外观可切换，切回本体不损失加成，不能使用未解锁或他人皮肤', () => {
    const state = createNewGameStateV10('皮肤测试')
    const hero = state.heroes.hero_player
    expect(selectHeroSkin(state, 'hero_player', 212).ok).toBe(true)
    const before = buildCombatStats(PLAYER_HERO_V10, hero, [], state.unlockedSkinIds)
    expect(selectHeroSkin(state, 'hero_player', 0).ok).toBe(true)
    expect(buildCombatStats(PLAYER_HERO_V10, hero, [], state.unlockedSkinIds)).toEqual(before)
    const snapshot = structuredClone(state)
    expect(selectHeroSkin(state, 'hero_player', 214).ok).toBe(false)
    expect(selectHeroSkin(state, 'hero_player', 1).ok).toBe(false)
    expect(upgradeHeroSkin(state, 'missing', 212).ok).toBe(false)
    expect(state).toEqual(snapshot)
  })
  it('升星准确扣除幻化石、同品质外观共享星级，面板与战斗快照同时生效', () => {
    const state = createNewGameStateV10('升星')
    state.formation = [{ heroId: 'hero_player', row: 0, col: 0 }]
    const hero = state.heroes.hero_player
    const before = buildCombatStats(PLAYER_HERO_V10, hero, [], state.unlockedSkinIds)
    state.materials['10'] = 1000
    expect(upgradeHeroSkin(state, 'hero_player', 212).ok).toBe(true)
    expect(state.materials['10']).toBe(996)
    expect(skinStars(hero, skinById(213)!)).toBe(2)
    const bonuses = ownedSkinAttributes(PLAYER_HERO_V10, hero, [])
    expect(bonuses[133]).toBe(1) // 男女版本不重复叠加。
    const after = buildCombatStats(PLAYER_HERO_V10, hero, [], state.unlockedSkinIds)
    expect(after.externalAttack).toBeGreaterThanOrEqual(before.externalAttack)
    expect(buildCombatParty(state)[0].externalAttack).toBe(after.externalAttack)
    for (let i = 2; i < 10; i++) expect(upgradeHeroSkin(state, 'hero_player', 212).ok).toBe(true)
    expect(buildCombatParty(state)[0].externalAttack).toBeGreaterThan(before.externalAttack)
    expect(state.materials['10']).toBe(820) // 4 * (1 + ... + 9)
    const maxed = structuredClone(state)
    expect(upgradeHeroSkin(state, 'hero_player', 213).ok).toBe(false)
    expect(state).toEqual(maxed)
  })
  it('材料不足不扣除、不升星；非免费皮肤必须先拥有', () => {
    const state = createNewGameStateV10('材料不足')
    state.materials['10'] = 3
    const before = structuredClone(state)
    expect(upgradeHeroSkin(state, 'hero_player', 212).ok).toBe(false)
    expect(upgradeHeroSkin(state, 'hero_player', 214).ok).toBe(false)
    expect(state).toEqual(before)
  })
  it('现有势力兑换直接解锁对应角色皮肤及加成', () => {
    const faction = FACTIONS.find(f => originalFactionExchangeByFaction(f.originalId).some(item => item.kind === 'skin'))!
    const item = originalFactionExchangeByFaction(faction.originalId).find(item => item.target.kind === 'skin')!
    if (item.target.kind !== 'skin') throw Error('皮肤配置错误')
    const target = item.target
    const definition = HEROES_V10.find(h => h.sourceId === target.heroSourceId)!
    const state = createNewGameStateV10('兑换')
    state.heroes[definition.id] = { ...createHeroProgress(definition.baseCareerId), recruited: true }
    state.unlockedFactionIds.push(faction.id)
    state.worldReputation[faction.worldId] = 1e12
    state.contribution[faction.worldId] = item.price
    const before = ownedSkinAttributes(definition, state.heroes[definition.id], state.unlockedSkinIds)
    expect(exchangeFactionItem(state, faction.id, item.slot).ok).toBe(true)
    expect(selectHeroSkin(state, definition.id, item.target.sourceId).ok).toBe(true)
    expect(ownedSkinAttributes(definition, state.heroes[definition.id], state.unlockedSkinIds)).not.toEqual(before)
  })
  it('旧存档缺省字段可读，已兑换皮肤保留，升星切换可持久化', () => {
    const old = createNewGameStateV10('存档')
    old.unlockedSkinIds = [214]
    expect(hydrateStateV10(old).unlockedSkinIds).toEqual([214])
    old.materials['10'] = 9
    expect(upgradeHeroSkin(old, 'hero_player', 214).ok).toBe(true)
    expect(selectHeroSkin(old, 'hero_player', 214).ok).toBe(true)
    const restored = hydrateStateV10(JSON.parse(JSON.stringify(old)))
    expect(restored.heroes.hero_player.selectedSkinId).toBe(214)
    expect(restored.heroes.hero_player.skinStars).toEqual({ '3': 2 })
    expect(restored.materials['10']).toBe(0)
    restored.heroes.hero_player.skinStars = { '3': -1 }
    expect(() => hydrateStateV10(restored)).toThrow()
  })
  it('原版角色和皮肤编号完整唯一，皮肤均引用真实原版角色', () => {
    expect(ORIGINAL_HERO_APPEARANCES).toHaveLength(193)
    expect(HERO_SKINS).toHaveLength(267)
    expect(new Set(HERO_SKINS.map(s => s.id)).size).toBe(267)
    for (const skin of HERO_SKINS) {
      expect(ORIGINAL_HERO_APPEARANCES.some(h => h.id === skin.heroSourceId)).toBe(true)
      expect(skin.attributeIds.every(id => id >= 131 && id <= 136)).toBe(true)
      if (!skin.source.includes('免费')) expect(ownsSkin(skin, [])).toBe(false)
    }
  })
})
