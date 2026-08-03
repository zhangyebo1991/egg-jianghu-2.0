import { describe, expect, it } from 'vitest'
import { renderCityPage, type CityPageViewModel } from './city-page'
import { renderFactionsPage, type FactionsPageViewModel } from './factions-page'
import { renderHeroesPage, type HeroesPageViewModel } from './heroes-page'
import { renderInventoryPage, type InventoryPageViewModel } from './inventory-page'

const heroesFixture = (): HeroesPageViewModel => ({
  selectedHeroId: 'hero_test',
  formation: [{ heroId: 'hero_test', row: 'front', position: 0 }],
  heroes: [{
    id: 'hero_test', name: '试剑人', grade: '乙', recruited: true,
    level: 12, careerId: 'sword', careerName: '剑客', careerLevel: 10,
    careerPerfected: false, availableCareerIds: ['sword_swift_mid'],
    learnedMartials: [], equippedMartialIds: [null, null, null, null],
    heartMethodId: null,
  }],
  careers: [{ id: 'sword_swift_mid', name: '游剑客', tier: '中级', owned: false, tokenOwned: true }],
  martials: [],
  heartMethods: [],
})

const factionsFixture = (): FactionsPageViewModel => ({
  selectedFactionId: 'qingfeng_hall',
  factions: [{ id: 'qingfeng_hall', name: '青锋馆', category: '剑', contribution: 600, selected: true }],
  refreshRemainingMs: 3_600_000,
  quests: Array.from({ length: 6 }, (_, index) => ({
    slot: index,
    quest: index === 0 ? {
      id: 'quest_qingfeng_0', type: 'normal', grade: '乙', targetName: '第1关敌手',
      progress: 0, targetCount: 20, rewardContribution: 50, accepted: false, completed: false,
    } : null,
  })),
  branches: [
    { name: '快剑', martials: [1, 2, 3, 4].map((stage) => ({
      id: `qingfeng_hall_${stage}`, name: `快剑第${stage}式`, stage: stage as 1 | 2 | 3 | 4,
      rarity: '粗浅', cost: 80, learned: false, level: 0,
    })) },
    { name: '重剑', martials: [1, 2, 3, 4].map((stage) => ({
      id: `qingfeng_hall_b${stage}`, name: `重剑第${stage}式`, stage: stage as 1 | 2 | 3 | 4,
      rarity: '寻常', cost: 100, learned: false, level: 0,
    })) },
  ],
  factionHero: { id: 'hero_qingfeng_hall', name: '青锋馆传人', grade: '乙', cost: 800, recruited: false },
  selectedHeroId: 'hero_test',
})

const cityFixture = (): CityPageViewModel => ({
  worldId: 'world_01', worldName: '青石卷', worldCurrency: 1000,
  selectedHeroId: 'hero_test',
  heroes: [{ id: 'hero_test', name: '试剑人' }],
  tavernHeroes: [{ id: 'hero_shen_yanqiu', name: '沈砚秋', grade: '乙', cost: 280, recruited: false }],
  martials: [{ id: 'world_01_common_sword_01', name: '青石剑法', rarity: '粗浅', cost: 200, learned: false }],
  careerTokens: [{ id: 'token_sword_swift_mid', name: '游剑客信物', tier: '中级', cost: 300, owned: false }],
})

const inventoryFixture = (): InventoryPageViewModel => ({
  selectedHeroId: 'hero_test',
  heroes: [{ id: 'hero_test', name: '试剑人' }],
  capacity: 300,
  items: [{
    uid: 'equipment_1', name: '青石剑', slot: 'weapon', slotName: '兵刃',
    level: 1, quality: '良品', locked: false, equippedByHeroId: null,
    affixes: [{ name: '外功', value: 4 }],
  }],
})

describe('version 10 长期循环页面', () => {
  it('侠客页保持前后排各三格并展示职业独立等级', () => {
    const html = renderHeroesPage(heroesFixture())
    expect(html.match(/data-row="front"/g)).toHaveLength(3)
    expect(html.match(/data-row="back"/g)).toHaveLength(3)
    expect(html).toContain('职业 Lv.')
    expect(html).toContain('圆满心得')
  })

  it('势力页显示六格悬榜和两条四阶传承', () => {
    const html = renderFactionsPage(factionsFixture())
    expect(html.match(/data-quest-slot=/g)).toHaveLength(6)
    expect(html).toContain('初传')
    expect(html).toContain('进境')
    expect(html).toContain('真传')
    expect(html).toContain('秘传')
    expect(html).toContain('第1关敌手')
    expect(html).not.toContain('world_01_stage_01_normal_1')
  })

  it('城市和背包页没有抽卡、残页与铁匠铺', () => {
    const html = renderCityPage(cityFixture()) + renderInventoryPage(inventoryFixture())
    expect(html).not.toMatch(/十连|保底|秘籍残页|铁匠铺|强化|淬炼|重铸|拆解/)
  })

  it('当前大关没有势力或城市内容时显示本卷空状态', () => {
    expect(renderFactionsPage({ ...factionsFixture(), factions: [], branches: [], factionHero: null }))
      .toContain('本卷暂无可用势力')
    expect(renderCityPage({ ...cityFixture(), tavernHeroes: [], martials: [], careerTokens: [] }))
      .toContain('本卷城市暂无可用内容')
  })
})
