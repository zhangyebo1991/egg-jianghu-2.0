import { describe, expect, it } from 'vitest'
import { renderCityPage, type CityPageViewModel } from './city-page'
import { renderFactionsPage, type FactionsPageViewModel } from './factions-page'
import { renderHeroesPage, type HeroesEquipmentView, type HeroesPageViewModel } from './heroes-page'
import { renderInventoryPage, type InventoryPageViewModel } from './inventory-page'
import { renderFormationPage, type FormationPageViewModel } from './formation-page'

const equippedWeapon: HeroesEquipmentView = {
  uid: 'weapon_old', definitionId: 'world_01_weapon', name: '旧试剑', slot: 'weapon', slotName: '兵刃', level: 2, quality: '良品', locked: false,
  equippedByHeroId: 'hero_test', equippedByHeroName: '试剑人',
  baseStat: { name: '外功 / 内功', value: 11, percent: false },
  affixes: [{ name: '外功', value: 4, percent: false }],
}

const inventoryWeapon: HeroesEquipmentView = {
  uid: 'weapon_new', definitionId: 'world_02_weapon', name: '新试剑', slot: 'weapon', slotName: '兵刃', level: 5, quality: '上品', locked: true,
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
  inventoryItems: [inventoryWeapon],
  inventoryCapacity: 300,
  inventorySlotFilter: 'all',
  inventoryQualityFilter: 'all',
  inventoryPage: 1,
  batchDiscardQuality: 'all',
  batchDiscardConfirm: false,
})

const factionsFixture = (): FactionsPageViewModel => ({
  worldIndex: 1,
  worldName: '牛家村',
  selectedFactionId: 'qingfeng_hall',
  factions: [{
    id: 'qingfeng_hall', name: '全真教', category: '剑', branchNames: ['快剑', '重剑'], contribution: 600, selected: true,
  }],
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
      rarity: '粗浅', cost: 80, upgradeCost: 96, learned: false, level: 0, state: stage === 1 ? 'next' : 'locked',
      energyCost: 12, cooldownMs: 2200, power: 1.15, previousName: stage === 1 ? null : `快剑第${stage - 1}式`,
      careerNames: ['剑客', '游剑客'], careerCompatible: true, affordable: true, actionDisabled: false, actionReason: null,
      selected: stage === 1,
    })) },
    { name: '重剑', martials: [1, 2, 3, 4].map((stage) => ({
      id: `qingfeng_hall_b${stage}`, name: `重剑第${stage}式`, stage: stage as 1 | 2 | 3 | 4,
      rarity: '寻常', cost: 100, upgradeCost: 120, learned: false, level: 0, state: stage === 1 ? 'next' : 'locked',
      energyCost: 12, cooldownMs: 2200, power: 1.15, previousName: stage === 1 ? null : `重剑第${stage - 1}式`,
      careerNames: ['剑客', '重剑客'], careerCompatible: true, affordable: true, actionDisabled: false, actionReason: null,
      selected: false,
    })) },
  ],
  factionHeroes: [
    { id: 'hero_qingfeng_hall_01', name: '孙不二', grade: '乙', cost: 800, recruited: false },
    { id: 'hero_qingfeng_hall_02', name: '刘处玄', grade: '乙', cost: 800, recruited: false },
    { id: 'hero_qingfeng_hall_03', name: '谭处端', grade: '乙', cost: 800, recruited: false },
  ],
  selectedHeroId: 'hero_test',
  selectedHero: {
    id: 'hero_test', name: '试剑人', grade: '主', category: '剑', factionName: '江湖散人', compatible: true, selected: true, isPlayer: true,
  },
  roster: [{
    id: 'hero_test', name: '试剑人', grade: '主', category: '剑', factionName: '江湖散人', compatible: true, selected: true, isPlayer: true,
  }],
  rosterCount: 1,
  rosterOpen: false,
  rosterQuery: '',
  selectedMartialId: 'qingfeng_hall_1',
  selectedMartial: {
    id: 'qingfeng_hall_1', name: '快剑第一式', stage: 1, rarity: '粗浅', cost: 80, upgradeCost: 96,
    learned: false, level: 0, state: 'next', energyCost: 12, cooldownMs: 2200, power: 1.15,
    previousName: null, careerNames: ['剑客', '游剑客'], careerCompatible: true, affordable: true,
    actionDisabled: false, actionReason: null, selected: true,
  },
})

const cityFixture = (): CityPageViewModel => ({
  worldId: 'world_01', worldIndex: 1, worldName: '青石卷', worldCurrency: 1000,
  selectedHeroId: 'hero_test', selectedHeroName: '试剑人',
  heroes: [{ id: 'hero_test', name: '试剑人' }],
  tavernHeroes: [{ id: 'hero_guo_jing', name: '郭靖', grade: '乙', category: '拳', careerName: '拳师', cost: 240, recruited: false, line: '憨厚少年，根骨清奇。' }],
  martials: [{ id: 'world_01_common_sword_01', name: '青石剑法', rarity: '粗浅', category: '剑', cost: 200, energyCost: 11, cooldownMs: 2500, power: 0.95, learned: false, compatible: true, selected: true }],
  fitCount: 1,
  careerTokens: [{ id: 'token_sword_swift_mid', name: '游剑客信物', tier: '中级', category: '剑', cost: 300, owned: false }],
  lockedTiers: [{ tier: '高级', cost: 800, minWorld: 4 }],
})

const inventoryFixture = (): InventoryPageViewModel => ({
  worldName: '牛家村',
  capacity: 300,
  itemCount: 1,
  capacityRatio: 1,
  qualityCounts: { 凡品: 0, 良品: 1, 上品: 0, 珍品: 0, 绝品: 0 },
  slotFilter: 'all',
  slotTabs: [{ id: 'all', name: '全部', count: 1 }],
  selectedUid: 'equipment_1',
  detailOpen: false,
  items: [{
    uid: 'equipment_1', name: '青石剑', slot: 'weapon', slotName: '兵刃',
    level: 1, quality: '良品', locked: false,
    baseStat: { name: '攻击', value: 10 },
    affixes: [{ name: '外功', value: 4, min: 3, max: 18, ratio: 7 }],
  }],
  selectedItem: {
    uid: 'equipment_1', name: '青石剑', slot: 'weapon', slotName: '兵刃',
    level: 1, quality: '良品', locked: false,
    baseStat: { name: '攻击', value: 10 },
    affixes: [{ name: '外功', value: 4, min: 3, max: 18, ratio: 7 }],
  },
})

const formationFixture = (): FormationPageViewModel => ({
  selectedHeroId: 'hero_test',
  filter: 'all',
  formation: [{ heroId: 'hero_test', row: 'front', position: 0 }],
  heroes: [
    {
      id: 'hero_test', name: '试剑人', grade: '乙', level: 12, inFormation: true,
      category: '剑', source: '本队主角', careerName: '游剑客', careerLevel: 2,
      careerPath: [
        { name: '剑客', state: 'done' },
        { name: '游剑客', state: 'current' },
        { name: '追风剑师', state: 'future' },
      ],
      aptitudes: { strength: 8, insight: 8, constitution: 9, agility: 9, resolve: 8 },
      combatStats: { maxHp: 420, externalAttack: 90, internalAttack: 80, externalDefense: 60, internalDefense: 55, effectiveAgility: 74 },
      equippedMartials: [
        { name: '越女剑法', rarity: '粗浅', level: 2 },
        null,
        null,
        null,
      ],
      heartMethodName: '第壹卷通用心法',
      slot: { row: 'front', position: 0 },
    },
    {
      id: 'hero_shen', name: '郭靖', grade: '乙', level: 1, inFormation: false,
      category: '拳', source: '酒馆相逢', careerName: '拳师', careerLevel: 1,
      careerPath: [{ name: '拳师', state: 'current' }],
      aptitudes: { strength: 10, insight: 7, constitution: 11, agility: 7, resolve: 7 },
      combatStats: { maxHp: 360, externalAttack: 74, internalAttack: 65, externalDefense: 58, internalDefense: 45, effectiveAgility: 62 },
      equippedMartials: [null, null, null, null],
      heartMethodName: null,
      slot: null,
    },
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
    expect(html).toContain('data-slot-art="weapon" data-icon-source="slot"')
    expect(html).toContain('src="/src/assets/equipment/slots/weapon.png"')
    expect(html).toContain('旧试剑')
    expect(html).toContain('data-testid="hero-inventory-panel"')
    expect(html).toContain('class="roster-search"')
    expect(html).not.toContain('roster-search-wrap')
    expect(html).toContain('data-hero-inventory-filter="slot"')
    expect(html).toContain('data-action="organize-hero-inventory"')
    expect(html).toContain('data-testid="hero-inventory-item-weapon_new"')
    expect(html).not.toContain('data-testid="hero-inventory-item-weapon_old"')
    expect(html).toContain('role="tooltip" popover="manual"')
    expect(html).toContain('当前查看')
    expect(html).toContain('当前穿戴')
    expect(html).toContain('双击左键或右键')
  })

  it('物品栏每页最多展示 8 件并可切换分页', () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      ...inventoryWeapon,
      uid: `paged_${index}`,
    }))
    const firstPage = renderHeroesPage({ ...heroesFixture(), inventoryItems: items, inventoryPage: 1 })
    const secondPage = renderHeroesPage({ ...heroesFixture(), inventoryItems: items, inventoryPage: 2 })

    expect(firstPage.match(/data-testid="hero-inventory-item-/g)).toHaveLength(8)
    expect(firstPage).toContain('1/2 · 8件')
    expect(firstPage.match(/data-action="hero-inventory-page" data-page="[123]"/g)).toHaveLength(3)
    expect(secondPage.match(/data-testid="hero-inventory-item-/g)).toHaveLength(1)
    expect(secondPage).toContain('2/2 · 1件')
  })

  it('物品栏提供按稀有度批量丢弃的品质选择与入口', () => {
    const html = renderHeroesPage(heroesFixture())
    expect(html).toContain('data-batch-discard-quality')
    expect(html).toMatch(/data-action="request-batch-discard" aria-expanded="false"/)
    expect(html).not.toContain('class="batch-panel')
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

  it('城市页按城中长街输出三铺并保留交互契约', () => {
    const html = renderCityPage(cityFixture())
    expect(html).toContain('data-testid="city-page"')
    expect(html).toContain('无名酒馆')
    expect(html).toContain('城南武馆')
    expect(html).toContain('恒昌当铺')
    expect(html).toContain('data-testid="tavern-hero_guo_jing"')
    expect(html).toContain('data-action="tavern-recruit"')
    expect(html).toContain('data-action="select-hero-input"')
    expect(html).toContain('data-action="select-city-martial"')
    expect(html).toContain('data-action="city-martial-learn"')
    expect(html).toContain('data-action="career-buy-token"')
    expect(html).toContain('aria-label="直接邀请"')
    expect(html).toContain('class="hn-line">憨厚少年，根骨清奇。')
  })

  it('背包页按原型输出部位线稿、详情器影和品质件数', () => {
    const html = renderInventoryPage({ ...inventoryFixture(), detailOpen: true })
    expect(html).toContain('class="inventory-cell-icon"')
    expect(html).toContain('class="inventory-cell-slot"')
    expect(html).toContain('class="inventory-appraise-figure"')
    expect(html).toContain('class="inventory-figure-ring"')
    expect(html).toContain('良品<b>1</b>')
    expect(html).toContain('共 1 件 · 囊容 300')
  })

  it('当前大关没有势力或城市内容时显示本卷空状态', () => {
    expect(renderFactionsPage({ ...factionsFixture(), factions: [], branches: [], factionHeroes: [] }))
      .toContain('本卷暂无可用势力')
    expect(renderCityPage({ ...cityFixture(), tavernHeroes: [], martials: [], careerTokens: [] }))
      .toContain('本卷城市暂无可用内容')
  })

  it('阵容页输出前后排各三格与待上阵名单', () => {
    const html = renderFormationPage(formationFixture())
    expect(html.match(/data-row="front"/g)).toHaveLength(3)
    expect(html.match(/data-row="back"/g)).toHaveLength(3)
    expect(html).toContain('点将名册')
    expect(html).toContain('演武场')
    expect(html).toContain('data-testid="formation-hero-card"')
    expect(html).toContain('data-testid="formation-synergy-fist"')
    expect(html).toContain('data-action="formation-auto-arrange"')
    expect(html).toContain('data-action="formation-filter"')
    expect(html).toContain('formation-radar')
    expect(html).toMatch(/formation-portrait-frame compact[\s\S]*formation-grade-seal/)
    expect(html).toMatch(/formation-portrait-frame card[\s\S]*formation-grade-seal/)
    expect(html).toContain('在阵')
    expect(html).toContain('data-testid="formation-hero-hero_test"')
    expect(html).toContain('formation-slot-remove')

    const selectedHtml = renderFormationPage({ ...formationFixture(), selectedHeroId: 'hero_test' })
    expect(selectedHtml).toMatch(/data-hero-id="hero_test"[^>]*class="[^"]*\bactive\b/)
    expect(selectedHtml).not.toMatch(/data-hero-id="hero_shen"[^>]*class="[^"]*\bactive\b/)
  })
})
