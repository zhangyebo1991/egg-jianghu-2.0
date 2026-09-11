import { describe, expect, it } from 'vitest'
import { FACTION_HEROES, HEROES_V10, heroByIdV10 } from './heroes'
import { heroLifecycle } from './hero-lifecycle'
import { factionById } from './factions'
import { originalWorldReputationThreshold } from './original-faction-rules.generated'
import { createInitialStateV10 } from '../domain/state'
import { recruitFromFaction, recruitFromTavern } from '../domain/recruitment'

describe('阶段定位与原版确定兑换', () => {
  it('全量覆盖，改变旧品级不会把过渡或后章角色升级为稀有角色', () => {
    expect(HEROES_V10).toHaveLength(163)
    for (const hero of HEROES_V10) {
      const view = heroLifecycle(hero)
      expect(view.stage).toBeTruthy()
      expect(view.replacement).toBeTruthy()
      expect(heroLifecycle({ ...hero, grade: '天' })).toEqual(view)
      expect(view.label).not.toMatch(/名侠|传奇|传说/)
    }
    for (const id of ['hero_orig_5', 'hero_orig_8']) expect(heroLifecycle(heroByIdV10(id)!).layer).toBe('transition')
    expect(heroLifecycle(heroByIdV10('hero_orig_165')!).layer).toBe('welfare')
    expect(heroLifecycle(heroByIdV10('hero_orig_67')!).jobs).toContain('计略5 · 势力代理')
    expect(heroLifecycle(HEROES_V10.find(hero => hero.name === '貂蝉')!).jobs).toContain('商业4 · 商店员工')
    expect(heroLifecycle(HEROES_V10.find(hero => hero.name === '张三丰')!).jobs).toEqual([])
  })

  it('131名章节角色逐人保留章节、声望和足额资源门槛，失败不写档，成功只扣对应资源', () => {
    for (const hero of FACTION_HEROES) {
      const state = createInitialStateV10(0)
      const faction = factionById(hero.factionId!)!
      const worldIndex = Number(hero.worldId.slice(-2))
      const threshold = originalWorldReputationThreshold(hero.requiredReputationLevel!, worldIndex)
      const wallet = faction.currencyKind === 'worldCurrency' ? state.worldCurrency : state.contribution
      const key = faction.currencyKind === 'worldCurrency' ? hero.worldId : faction.id
      wallet[key] = hero.cost
      state.worldReputation[hero.worldId] = threshold
      state.unlockedWorldIds = []
      const refuse = () => {
        const before = structuredClone(state)
        expect(recruitFromFaction(state, faction.id, hero.id).ok, hero.name).toBe(false)
        expect(state).toEqual(before)
      }
      refuse()
      state.unlockedWorldIds = [hero.worldId]
      if (threshold > 0) {
        state.worldReputation[hero.worldId] = threshold - 1
        refuse()
        state.worldReputation[hero.worldId] = threshold
      }
      wallet[key] = hero.cost - 1
      refuse()
      wallet[key] = hero.cost
      const otherWallet = structuredClone(faction.currencyKind === 'worldCurrency' ? state.contribution : state.worldCurrency)
      expect(recruitFromFaction(state, faction.id, hero.id).ok, hero.name).toBe(true)
      expect(wallet[key]).toBe(0)
      expect(faction.currencyKind === 'worldCurrency' ? state.contribution : state.worldCurrency).toEqual(otherWallet)
      expect(state.heroes[hero.id].recruited).toBe(true)
      refuse()
    }
  })

  it('赵云不能绕过福利码从酒馆或势力免费领取', () => {
    const state = createInitialStateV10(0)
    const before = structuredClone(state)
    expect(recruitFromTavern(state, 'hero_orig_165').ok).toBe(false)
    expect(recruitFromFaction(state, 'qingfeng_hall', 'hero_orig_165').ok).toBe(false)
    expect(state).toEqual(before)
  })
})
