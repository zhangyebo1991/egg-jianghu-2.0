import { describe, expect, it } from 'vitest'
import { renderCityPage, type CityPageViewModel } from './city-page'
import { renderFactionsPage, type FactionsPageViewModel } from './factions-page'
import { renderHeroesPage, type HeroesEquipmentView, type HeroesPageViewModel } from './heroes-page'
import { renderInventoryPage, type InventoryPageViewModel } from './inventory-page'
import { renderFormationPage, type FormationPageViewModel } from './formation-page'

const equippedWeapon: HeroesEquipmentView = {
  uid: 'weapon_old', name: '旧试剑', slot: 'weapon', slotName: '兵刃', level: 2, quality: '良品', locked: false,
  equippedByHeroId: 'hero_test', equippedByHeroName: '试剑人',
  baseStat: { name: '外功 / 内功', value: 11, percent: false },
  affixes: [{ name: '外功', value: 4, percent: false }],
}

const inventoryWeapon: HeroesEquipmentView = {
  uid: 'weapon_new', name: '新试剑', slot: 'weapon', slotName: '兵刃', level: 5, quality: '上品', locked: true,
  equippedByHeroId: null, equippedByHeroName: null,
  baseStat: { name: '外功 / 内功', value: 18, percent: false },
  affixes: [{ name: '暴击', value: 5, percent: true }],
}

const heroesFixture = (): HeroesPageViewModel => ({
  selectedHeroId: 'hero_test',
  heroes: [{
    id: 'hero_test', name: '试剑人', grade: '乙', recruited: true,
    level: 12, careerId: 'sword', careerName: '剑客', careerLevel: 10,
    careerPerfected: false, availableCareerIds: ['sword_swift_mid'],
    aptitudes: { strength: 10, insight: 8, constitution: 9, agility: 11, resolve: 7 },
    combatStats: {
      maxHp: 520, maxEnergy: 100, initialEnergy: 20, energyRecovery: 6,
      externalAttack: 88, internalAttack: 62, externalDefense: 51, internalDefense: 44,
      effectiveAgility: 92.4, accuracy: 0.073, evade: 0.11, controlResistance: 0.084,
      criticalChance: 0.092, criticalMultiplier: 1.5, cooldownRate: 0.02,
      gaugeRate: 0.02, momentumBonus: 0.03, survivalBonus: 0.03, perfectedBonusPool: 0.05,
    },
    equipmentSlots: [
      { id: 'weapon', name: '兵刃', equipment: equippedWeapon },
      { id: 'head', name: '冠巾', equipment: null },
      { id: 'armor', name: '衣甲', equipment: null },
      { id: 'wrist', name: '护腕', equipment: null },
      { id: 'waist', name: '腰佩', equipment: null },
      { id: 'boots', name: '履靴', equipment: null },
      { id: 'token', name: '信物', equipment: null },
    ],
    learnedMartials: [], equippedMartialIds: [null, null, null, null],
    heartMethodId: null,
  }],
  careers: [{ id: 'sword_swift_mid', name: '游剑客', tier: '中级', owned: false, tokenOwned: true }],
  martials: [],
  heartMethods: [],
  inventoryItems: [equippedWeapon, inventoryWeapon],
  inventoryCapacity: 300,
  inventorySlotFilter: 'all',
  inventoryQualityFilter: 'all',
  inventoryPage: 1,
  batchDiscardQuality: 'all',
  batchDiscardConfirm: false,
})

const factionsFixture = (): FactionsPageViewModel => ({
  selectedFactionId: 'qingfeng_hall',
  factions: [{ id: 'qingfeng_hall', name: '青锋馆', category: '剑', contribution: 600, selected: true }],
  refreshRemainingMs: 3_600_000,
  quests: Array.from({ length: 6 }, (_, index) => ({
    slot: index,
    quest: index === 0 ? {
      id: 'quest_qingfeng_0', type: 'normal', grade: '乙', targetName: '村中泼皮',
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

const formationFixture = (): FormationPageViewModel => ({
  selectedHeroId: null,
  formation: [{ heroId: 'hero_test', row: 'front', position: 0 }],
  heroes: [
    { id: 'hero_test', name: '试剑人', grade: '乙', level: 12, inFormation: true },
    { id: 'hero_shen', name: '沈砚秋', grade: '乙', level: 1, inFormation: false },
  ],
})

describe('version 10 长期循环页面', () => {
  it('侠客页展示职业独立等级且不再含阵容编辑器', () => {
    const html = renderHeroesPage(heroesFixture())
    expect(html).toContain('职业 Lv.')
    expect(html).toContain('圆满心得')
    expect(html).not.toContain('formation-editor')
    expect(html).not.toContain('六侠阵容')
  })

  it('侠客页展示基础属性与计入养成加成后的战斗属性', () => {
    const html = renderHeroesPage(heroesFixture())
    expect(html).toContain('data-testid="hero-stats"')
    expect(html).toContain('基础属性')
    expect(html).toContain('臂力</dt><dd>10')
    expect(html).toContain('战斗属性')
    expect(html).toContain('气血</dt><dd>520')
    expect(html).toContain('有效身法</dt><dd>92.4')
    expect(html).toContain('命中修正</dt><dd>7.3%')
    expect(html).toContain('圆满加成</dt><dd>5%')
  })

  it('侠客页展示装备栏、可筛选物品及同部位装备对比', () => {
    const html = renderHeroesPage(heroesFixture())
    expect(html).toContain('data-testid="hero-equipment-slots"')
    expect(html).toContain('data-testid="hero-equipment-slot-weapon"')
    expect(html).toContain('class="hero-medallion"')
    expect(html).toContain('data-slot-art="weapon"')
    expect(html).toContain('旧试剑')
    expect(html).toContain('data-testid="hero-inventory-panel"')
    expect(html).toContain('data-hero-inventory-filter="slot"')
    expect(html).toContain('data-action="organize-hero-inventory"')
    expect(html).toContain('data-testid="hero-inventory-item-weapon_new"')
    expect(html).toContain('role="tooltip" popover="manual"')
    expect(html).toContain('当前查看')
    expect(html).toContain('当前穿戴')
    expect(html).toContain('双击左键或右键')
  })

  it('物品栏每页最多展示 200 件并可切换分页', () => {
    const items = Array.from({ length: 201 }, (_, index) => ({
      ...inventoryWeapon,
      uid: `paged_${index}`,
    }))
    const firstPage = renderHeroesPage({ ...heroesFixture(), inventoryItems: items, inventoryPage: 1 })
    const secondPage = renderHeroesPage({ ...heroesFixture(), inventoryItems: items, inventoryPage: 2 })

    expect(firstPage.match(/data-testid="hero-inventory-item-/g)).toHaveLength(200)
    expect(firstPage).toContain('第 1 / 2 页 · 本页 200 件')
    expect(secondPage.match(/data-testid="hero-inventory-item-/g)).toHaveLength(1)
    expect(secondPage).toContain('第 2 / 2 页 · 本页 1 件')
  })

  it('物品栏提供按稀有度批量丢弃的品质选择与入口', () => {
    const html = renderHeroesPage(heroesFixture())
    expect(html).toContain('data-batch-discard-quality')
    expect(html).toMatch(/data-action="request-batch-discard" disabled/)
    expect(html).toContain('批量丢弃')
  })

  it('批量丢弃确认态展示将丢弃件数及跳过条件', () => {
    const html = renderHeroesPage({
      ...heroesFixture(),
      inventoryItems: [
        { ...inventoryWeapon, locked: false },
        { ...inventoryWeapon, uid: 'second', locked: false, quality: '良品' },
        { ...inventoryWeapon, uid: 'locked_one', locked: true, quality: '良品' },
        { ...inventoryWeapon, uid: 'equipped_one', locked: false, equippedByHeroId: 'hero_test', quality: '良品' },
      ],
      batchDiscardQuality: '上品',
      batchDiscardConfirm: true,
    })
    expect(html).toContain('确认丢弃 2 件装备')
    expect(html).toContain('品质 ≤上品')
    expect(html).toContain('data-action="confirm-batch-discard"')
    expect(html).toContain('data-action="cancel-batch-discard"')
  })

  it('势力页显示六格悬榜和两条四阶传承', () => {
    const html = renderFactionsPage(factionsFixture())
    expect(html.match(/data-quest-slot=/g)).toHaveLength(6)
    expect(html).toContain('初传')
    expect(html).toContain('进境')
    expect(html).toContain('真传')
    expect(html).toContain('秘传')
    expect(html).toContain('村中泼皮')
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

  it('阵容页输出前后排各三格与待上阵名单', () => {
    const html = renderFormationPage(formationFixture())
    expect(html.match(/data-row="front"/g)).toHaveLength(3)
    expect(html.match(/data-row="back"/g)).toHaveLength(3)
    expect(html).toContain('已上阵')
    expect(html).toContain('data-testid="formation-hero-hero_test"')
    expect(html).toContain('formation-slot-remove')

    const selectedHtml = renderFormationPage({ ...formationFixture(), selectedHeroId: 'hero_test' })
    expect(selectedHtml).toMatch(/data-hero-id="hero_test"[^>]*class="[^"]*\bactive\b/)
    expect(selectedHtml).not.toMatch(/data-hero-id="hero_shen"[^>]*class="[^"]*\bactive\b/)
  })
})
