import { describe, expect, it } from 'vitest'
import { EQUIPMENT_SLOTS } from '../content/equipment'
import { renderCityPage, type CityPageViewModel } from './city-page'
import { renderFactionsPage, type FactionsPageViewModel } from './factions-page'
import type { FactionExchangeViewModel } from './faction-exchange'
import { renderHeroesPage, type HeroesPageViewModel } from './heroes-page'
import { renderInventoryPage, type InventoryPageViewModel } from './inventory-page'
import { renderInkInventoryEquipment } from './ink-inventory'
import { renderFormationPage, type FormationPageViewModel } from './formation-page'
import { renderTownsPage, type TownsPageViewModel } from './towns-page'
import { heroAbilityAttributes } from '../domain/faction-agent'
import { createHeroProgress } from '../domain/state'

it('侠客基础页显示邢道荣的原版能力，不再从战斗面板丢失等级', () => {
  const view = heroesFixture()
  view.heroes[0].abilityAttributes = heroAbilityAttributes(2, createHeroProgress('job_1'), [])
  const html = renderHeroesPage(view)
  for (const [name, level] of [['驯兽', 1], ['锻造', 2], ['建造', 3]] as const) {
    expect(html).toContain(`<span class="ab-name">${name}</span><span class="ab-lv">Lv.${level}</span>`)
  }
})

const heroesFixture = (): HeroesPageViewModel => ({
  selectedHeroId: 'hero_test',
  mainTab: 'basic',
  heroes: [{
    id: 'hero_test', name: '试剑人', grade: '乙', recruited: true,
    level: 12, experience: 340, experienceRequired: 1200, careerId: 'job_1', careerName: '白丁', careerLevel: 5,
    careerTier: '初级', skillTypeNames: ['通用'],
    growth: [
      { id: 'physicalAttack', label: '物攻', grade: 'D', coeff: '0.9' },
      { id: 'magicAttack', label: '法攻', grade: 'D', coeff: '0.9' },
      { id: 'speed', label: '速度', grade: 'D', coeff: '0.9' },
      { id: 'physicalDefense', label: '物防', grade: 'D', coeff: '0.9' },
      { id: 'magicDefense', label: '法防', grade: 'D', coeff: '0.9' },
      { id: 'heal', label: '治疗', grade: 'D', coeff: '0.9' },
    ],
    careerExperience: 12, careerExperienceRequired: 114, careerMaxed: false,
    learnedCareers: [{ id: 'job_1', name: '白丁', level: 5, current: true }],
    aptitudes: { strength: 10, insight: 8, constitution: 9, agility: 11, resolve: 7 },
    combatStats: {
      maxHp: 520, maxEnergy: 100, initialEnergy: 20, energyRecovery: 6,
      externalAttack: 88, internalAttack: 62, externalDefense: 51, internalDefense: 44,
      effectiveAgility: 92.4, accuracy: 0.073, evade: 0.11, controlResistance: 0.084,
      criticalChance: 0.092, criticalMultiplier: 1.5, cooldownRate: 0.02, lifeSteal: 0,
      gaugeRate: 0.02, momentumBonus: 0.03, survivalBonus: 0.03, perfectedBonusPool: 0,
    },
    category: '剑', source: '本队主角', inFormation: true,
  }],
  careerTreeOpen: false,
  treeNodes: [{
    id: 'job_1', name: '白丁', rank: 1, indexInRank: 0, rankCount: 1, tier: '初级',
    learned: true, current: true, selected: true,
  }, {
    id: 'job_5', name: '弓手', rank: 2, indexInRank: 3, rankCount: 5, tier: '一阶',
    learned: false, current: false, selected: false,
  }],
  treeLinks: [{ fromId: 'job_1', toId: 'job_5' }],
  treeDetail: {
    id: 'job_1', name: '白丁', description: '这是一个神奇的职业。', tier: '初级',
    skillTypeNames: ['通用'],
    growth: [{ id: 'physicalAttack', label: '物攻', grade: 'D', coeff: '0.9' }],
    requirements: [], bookName: '白丁转职书', bookOwned: false, learned: true, current: true,
    actionLabel: '当前职业', actionDisabled: true,
  },
  equipment: {
    heroId: 'hero_test',
    setIndex: 0,
    slots: EQUIPMENT_SLOTS.map((slot) => ({ slot, item: null })),
  },
})

const exchangeFixture = (): FactionExchangeViewModel => ({
  contribution: {
    category: 'all',
    categories: [
      { id: 'all', name: '全部', count: 3 },
      { id: 'job-book', name: '转职书', count: 1 },
      { id: 'blueprint', name: '装备图纸', count: 1 },
      { id: 'secret-realm-ticket', name: '秘境门票', count: 0 },
      { id: 'skin', name: '幻型', count: 1 },
    ],
    worldFilter: 'all',
    worlds: [
      { id: 'all', name: '全部位面', selected: true },
      { id: 'world_01', name: '东汉三国', selected: false },
      { id: 'world_02', name: '武侠江湖', selected: false },
    ],
    groups: [{
      factionId: 'tieyi_school',
      factionName: '魏国',
      worldId: 'world_01',
      worldName: '东汉三国',
      contribution: 1000,
      reputationLevel: 1,
      reputationLevelName: '冷淡',
      fundsShort: true,
      items: [{
        slot: 1, kind: 'job-book', name: '护卫转职书', price: 4688,
        requiredReputationLevel: null, requiredReputationName: null,
        quantity: 1, owned: false, reputationLocked: false, insufficientFunds: false, actionReason: null,
      }, {
        slot: 2, kind: 'blueprint', name: '虎豹之头盔图纸', price: 800,
        requiredReputationLevel: 2, requiredReputationName: '友好',
        quantity: 0, owned: false, reputationLocked: true, insufficientFunds: false, actionReason: '需友好声望',
      }, {
        slot: 3, kind: 'skin', name: '貂蝉·拜月幻型', price: 5000,
        requiredReputationLevel: null, requiredReputationName: null,
        quantity: 0, owned: false, reputationLocked: false, insufficientFunds: true, actionReason: null,
      }],
    }],
    totalShown: 3,
  },
})

const recruitmentFixture = (
  factionId = 'qingfeng_hall',
  factionName = '武馆',
): NonNullable<FactionsPageViewModel['recruitment']> => ({
  factionId,
  factionName,
  resourceName: '位面货币',
  balance: 600,
  reputationLevel: 1,
  reputationLevelName: '冷淡',
  heroes: [{
    heroSourceId: 2,
    heroId: 'hero_orig_2',
    name: '邢道荣',
    requiredReputationLevel: 1,
    requiredReputationName: '冷淡',
    price: 100,
    aptitudes: { strength: 38, insight: 17, constitution: 47, agility: 26, resolve: 34 },
    actionReason: null,
  }],
})

const factionAgentFixture = (): NonNullable<TownsPageViewModel['factionAgent']> => ({
  worldId: 'world_01',
  worldName: '东汉三国',
  enabled: true,
  currentAgent: {
    id: 'hero_guo_jing', name: '郭靖', grade: '乙', category: '拳', level: 12,
    fighting: false, selected: true,
  },
  candidates: [{
    id: 'hero_guo_jing', name: '郭靖', grade: '乙', category: '拳', level: 12,
    fighting: false, selected: true,
  }, {
    id: 'hero_mu_nianci', name: '穆念慈', grade: '乙', category: '剑', level: 10,
    fighting: true, selected: false,
  }],
  abilityLevel: 0,
  contributionBonusPercent: 0,
  reputationBonusPercent: 0,
  taskAutomationAvailable: true,
  taskFilters: ['消灭', '筹措', '收集', '挑战', '寻宝'].map((name, offset) => ({
    taskId: offset + 1,
    name,
    column: 1,
    // 「收集」被排除，用来验证渲染出 excluded 态。
    allowed: offset !== 2,
    qualities: Array.from({ length: 6 }, (_, qualityOffset) => ({
      quality: qualityOffset + 1,
      column: qualityOffset + 5,
      allowed: true,
    })),
  })),
  acceptedTaskCount: 3,
  concurrentTaskLimit: 12,
})

const factionsFixture = (): FactionsPageViewModel => ({
  worldId: 'world_01',
  worldIndex: 1,
  worldName: '牛家村',
  contribution: 600,
  selectedFactionId: 'qingfeng_hall',
  factions: [{
    id: 'qingfeng_hall', name: '全真教', category: '剑', branchNames: ['快剑', '重剑'], selected: true,
  }],
  exchange: exchangeFixture(),
  refreshRemainingMs: 1_200_000,
  quests: Array.from({ length: 15 }, (_, index) => ({
    slot: index,
    quest: index === 0 ? {
      id: 'quest_qingfeng_0', taskId: 1, taskName: '消灭目标敌人', actionName: '杀敌', targetKind: '敌人',
      quality: 2, targetName: '村中泼皮', progress: 0, targetCount: 20, rewardContribution: 50,
      rewardReputation: 8, accepted: false, completed: false, settled: false,
    } : null,
  })),
  branches: [
    { name: '快剑', martials: [1, 2, 3].map((stage) => ({
      id: `qingfeng_hall_${stage}`, name: `快剑第${stage}式`, stage: stage as 1 | 2 | 3,
      rarity: '粗浅', cost: 80, upgradeCost: 96, learned: false, level: 0, state: stage === 1 ? 'next' : 'locked',
      spCost: 451, availableSp: 1000, resourceKind: 'contribution' as const, resourceName: '势力贡献',
      maxLevel: 30, currentEffect: null, nextEffect: 100, currentBuffChance: null, nextBuffChance: null,
      sourceName: '全真教', refundableSp: 0,
      energyCost: 12, cooldownMs: 2200, power: 1.15, previousName: stage === 1 ? null : `快剑第${stage - 1}式`, previousMaxLevel: stage === 1 ? null : 30,
      careerNames: ['剑客', '游剑客'], careerCompatible: true, affordable: true, actionDisabled: false, actionReason: null,
      selected: stage === 1,
    })) },
    { name: '重剑', martials: [1, 2, 3].map((stage) => ({
      id: `qingfeng_hall_b${stage}`, name: `重剑第${stage}式`, stage: stage as 1 | 2 | 3,
      rarity: '寻常', cost: 100, upgradeCost: 120, learned: false, level: 0, state: stage === 1 ? 'next' : 'locked',
      spCost: 451, availableSp: 1000, resourceKind: 'contribution' as const, resourceName: '势力贡献',
      maxLevel: 30, currentEffect: null, nextEffect: 100, currentBuffChance: null, nextBuffChance: null,
      sourceName: '全真教', refundableSp: 0,
      energyCost: 12, cooldownMs: 2200, power: 1.15, previousName: stage === 1 ? null : `重剑第${stage - 1}式`, previousMaxLevel: stage === 1 ? null : 30,
      careerNames: ['剑客', '重剑客'], careerCompatible: true, affordable: true, actionDisabled: false, actionReason: null,
      selected: false,
    })) },
  ],
  recruitment: recruitmentFixture(),
  selectedHeroId: 'hero_test',
  selectedHero: {
    id: 'hero_test', name: '试剑人', grade: '主', factionName: '江湖散人', compatible: true, selected: true, isPlayer: true,
  },
  roster: [{
    id: 'hero_test', name: '试剑人', grade: '主', factionName: '江湖散人', compatible: true, selected: true, isPlayer: true,
  }],
  rosterCount: 1,
  rosterOpen: false,
  rosterQuery: '',
  selectedMartialId: 'qingfeng_hall_1',
  selectedMartial: {
    id: 'qingfeng_hall_1', name: '快剑第一式', stage: 1, rarity: '粗浅', cost: 80, upgradeCost: 96,
    spCost: 451, availableSp: 1000, resourceKind: 'contribution', resourceName: '势力贡献',
    learned: false, level: 0, state: 'next', energyCost: 12, cooldownMs: 2200, power: 1.15,
    maxLevel: 30, currentEffect: null, nextEffect: 100, currentBuffChance: null, nextBuffChance: null,
    sourceName: '全真教', refundableSp: 0,
    previousName: null, previousMaxLevel: null, careerNames: ['剑客', '游剑客'], careerCompatible: true, affordable: true,
    actionDisabled: false, actionReason: null, selected: true,
    description: '两段连击，剑势平正', origin: '《射雕英雄传》', stageName: '初传',
    powerNote: '1.15 ×2段(总1.27)', tags: ['单体', '连击'],
  },
})

const cityFixture = (section: CityPageViewModel['section'] = 'map'): CityPageViewModel => ({
  shop: { tileId: 172, level: 1, enabled: true, status: '等待店员', introStep: 0, cash: 0, revenue: 0, soldCount: 0, experience: 0, customers: 0, capacity: 20, stock: [], availableItems: [], availableCount: 0, page: 1, pageCount: 1, staff: [], hiringSlot: null, candidates: [], receipts: [] },
  section,
  gridColumns: 18,
  gridRows: 18,
  effectiveColumns: 12,
  effectiveRows: 12,
  buildingCount: 25,
  technologyCount: 75,
  cityLevel: 0,
  development: 4129,
  population: 74000,
  commerce: 117350,
  industry: 56400,
  tiles: Array.from({ length: 324 }, (_, index) => {
    const tileId = index + 1
    const owned = tileId === 172
    return {
      tileId,
      buildingName: owned ? '古玩店' : '空地',
      buildingType: owned ? '商业' : '无',
      buildingLevel: owned ? 1 : 0,
      owned,
      buildable: !owned,
      locked: index % 18 >= 12 || Math.floor(index / 18) >= 12,
      selected: owned,
    }
  }),
  selectedTile: {
    tileId: 172,
    coordinates: '10 行 · 10 列',
    buildingName: '古玩店',
    buildingType: '商业',
    buildingLevel: 1,
    description: '经营古玩与收藏品的商店。',
    owned: true,
    buildable: false,
    landPriceTier: 3,
    population: 0,
    commerce: 5000,
    industry: 0,
    purchasePrice: 620000,
    salePrice: 372000,
    priceNote: null,
  },
  company: {
    name: null,
    cash: 0,
    ownedLandCount: 1,
    ownedLandValue: 620000,
    baseMonthlyRent: 0,
    previousNetIncome: 0,
    finance: [
      { name: '销售收入', amount: 0, expense: false },
      { name: '租金收入', amount: 0, expense: false },
      { name: '门票收入', amount: 0, expense: false },
      { name: '其他收入', amount: 0, expense: false },
      { name: '科研支出', amount: 0, expense: true },
      { name: '建造支出', amount: 0, expense: true },
      { name: '其他支出', amount: 0, expense: true },
    ],
    registrationCost: 100000,
    nameRuleReason: '原版公司名称完整校验尚未解码',
    positionRuleReason: '原版公司职位能力尚未解码',
  },
})

const townsFixture = (): TownsPageViewModel => ({
  worldIndex: 1, worldName: '东汉三国', mainCityName: '洛阳', worldCurrency: 1000,
  publicLocations: [
    { name: '府衙', npcTitle: '府尹', functions: ['位面总览', '代理人'], tavern: false, agent: true },
    { name: '商会', npcTitle: '商会老板', functions: ['购买装备', '购买道具', '出售物品'], tavern: false, agent: false },
    { name: '酒馆', npcTitle: '老板娘', functions: ['招募角色'], tavern: true, agent: false },
    { name: '武馆', npcTitle: '馆主', functions: ['学习技能'], tavern: false, agent: false },
    { name: '铁匠铺', npcTitle: '铁匠', functions: ['合成锻造'], tavern: false, agent: false },
  ],
  factionTowns: [
    { name: '许昌', factionId: 'tieyi_school', factionName: '魏国', unlocked: true, selected: true, functions: ['阵营任务', '学习技能', '贡献兑换', '势力招募'] },
    { name: '成都', factionId: 'renxin_hall', factionName: '蜀国', unlocked: false, selected: false, functions: ['阵营任务', '学习技能', '贡献兑换', '势力招募'] },
    { name: '建业', factionId: 'original_faction_04', factionName: '吴国', unlocked: true, selected: false, functions: ['阵营任务', '学习技能', '贡献兑换', '势力招募'] },
  ],
  factionAgent: null,
  factionRecruitment: null,
  tavernHeroes: [{ id: 'hero_guo_jing', name: '郭靖', grade: '乙', category: '拳', careerName: '白丁', cost: 240, recruited: false, line: '憨厚少年，根骨清奇。' }],
})

const inventoryFixture = (): InventoryPageViewModel => ({
  worldName: '牛家村',
  capacity: 300,
  itemCount: 1,
  capacityRatio: 1,
  qualityCounts: { 0: 0, 1: 1, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
  slotFilter: 'all',
  slotTabs: [{ id: 'all', name: '全部', count: 1 }],
  selectedUid: 'equipment_1',
  detailOpen: false,
  items: [{
    uid: 'equipment_1', definitionId: 'wp_101', name: '长戟', slot: 'weapon', slotName: '武器',
    level: 1, equipmentLevel: 1, quality: 1, locked: false,
    coreStats: [
      { attributeId: 8, name: '物攻', value: 12, formattedValue: '12', rollPercent: 94 },
      { attributeId: 20, name: '物理增伤', value: 0.1, formattedValue: '10%', rollPercent: 103 },
    ],
    affixes: [{ attributeId: 40, name: '土系增伤', value: 0.04, formattedValue: '4%', grade: 'C' }],
  }],
  selectedItem: {
    uid: 'equipment_1', definitionId: 'wp_101', name: '长戟', slot: 'weapon', slotName: '武器',
    level: 1, equipmentLevel: 1, quality: 1, locked: false,
    coreStats: [
      { attributeId: 8, name: '物攻', value: 12, formattedValue: '12', rollPercent: 94 },
      { attributeId: 20, name: '物理增伤', value: 0.1, formattedValue: '10%', rollPercent: 103 },
    ],
    affixes: [{ attributeId: 40, name: '土系增伤', value: 0.04, formattedValue: '4%', grade: 'C' }],
  },
})

const formationFixture = (): FormationPageViewModel => ({
  locked: false,
  selectedHeroId: 'hero_test',
  filter: 'all',
  formation: [{ heroId: 'hero_test', row: 1, col: 0 }],
  heroes: [
    {
      id: 'hero_test', name: '试剑人', grade: '乙', level: 12, inFormation: true,
      category: '剑', source: '本队主角', careerName: '白丁', careerLevel: 5,
      aptitudes: { strength: 8, insight: 8, constitution: 9, agility: 9, resolve: 8 },
      combatStats: { maxHp: 420, externalAttack: 90, internalAttack: 80, externalDefense: 60, internalDefense: 55, effectiveAgility: 74 },
      slot: { row: 1, col: 0 },
    },
    {
      id: 'hero_shen', name: '郭靖', grade: '乙', level: 1, inFormation: false,
      category: '拳', source: '酒馆相逢', careerName: '白丁', careerLevel: 1,
      aptitudes: { strength: 10, insight: 7, constitution: 11, agility: 7, resolve: 7 },
      combatStats: { maxHp: 360, externalAttack: 74, internalAttack: 65, externalDefense: 58, internalDefense: 45, effectiveAgility: 62 },
      slot: null,
    },
  ],
})

describe('version 10 长期循环页面', () => {
  it('侠客页展示职业独立等级且不再含阵容编辑器', () => {
    const html = renderHeroesPage(heroesFixture())
    expect(html).toContain('<b class="hc-lv">Lv.5</b>')
    expect(html).toContain('当前职业')
    expect(html).toContain('白丁')
    expect(html).toContain('data-testid="open-career-tree"')
    expect(html).not.toContain('圆满心得')
    expect(html).not.toContain('formation-editor')
    expect(html).not.toContain('六侠阵容')
  })

  it('侠客页用诸天六标签页展示属性（基础/附加/特殊/元素/专精/武器）', () => {
    const html = renderHeroesPage(heroesFixture())
    expect(html).toContain('data-testid="hero-stats"')
    expect(html).toContain('class="attr-tab-label" data-attr-tab="basic"')
    expect(html).toContain('data-attr-tab="additive"')
    expect(html).toContain('data-attr-tab="element"')
    expect(html).toContain('data-attr-tab="mastery"')
    expect(html).toContain('data-attr-tab="weapon"')
    expect(html).toContain('臂力</dt><dd>10')
    expect(html).toContain('生命</dt><dd>520')
    expect(html).toContain('速度</dt><dd>92.4')
    expect(html).toContain('物攻')
    expect(html).toContain('暴击几率')
    expect(html).toContain('物理增伤')
    expect(html).toContain('命中修正</dt><dd>7.3%')
  })

  it('侠客页展示当前职业、已修列表与转职树入口', () => {
    const html = renderHeroesPage(heroesFixture())
    expect(html).toContain('data-testid="hero-career-panel"')
    expect(html).toContain('可用技能')
    expect(html).toContain('已修职业')
    expect(html).toContain('class="hero-medallion"')
    expect(html).toContain('class="roster-search"')
    expect(html).toContain('data-testid="hero-equipment-slots"')
    expect(html).not.toContain('data-testid="hero-inventory-panel"')
    expect(html).not.toContain('四槽武功')
    const open = renderHeroesPage({ ...heroesFixture(), careerTreeOpen: true })
    expect(open).toContain('data-testid="career-tree"')
    expect(open).toContain('data-testid="career-node-job_1"')
    expect(open).toContain('当前职业')
  })

  it('侠客已装备槽使用原版装备图标', () => {
    const view = heroesFixture()
    const item = inventoryFixture().items[0]
    view.equipment = {
      heroId: 'hero_test',
      setIndex: 0,
      slots: EQUIPMENT_SLOTS.map((slot) => ({ slot, item: slot === item.slot ? item : null })),
    }

    const html = renderHeroesPage(view)
    expect(html.match(/data-equipment-icon-source="unique"/g)).toHaveLength(1)
    expect(html).toContain('class="equipment-art"')
    expect(html).not.toContain('class="pack-cell"')
  })

  it('行囊页格子悬停对比身上同部位装备并标注词条增减', () => {
    const backpackItem = inventoryFixture().items[0]
    const equippedItem = {
      ...backpackItem,
      uid: 'equipped_1',
      name: '玄铁重剑',
      level: 8,
      coreStats: [
        { attributeId: 8, name: '物攻', value: 40, formattedValue: '40', rollPercent: 100 },
        { attributeId: 20, name: '物理增伤', value: 0.05, formattedValue: '5%', rollPercent: 100 },
      ],
      affixes: [{ attributeId: 41, name: '火系增伤', value: 0.06, formattedValue: '6%', grade: 'B' }],
    }
    const view = { ...inventoryFixture(), equippedBySlot: { weapon: equippedItem } }

    const html = renderInventoryPage(view)
    expect(html).toContain('class="equipment-tooltip has-compare"')
    expect(html).toContain('行囊物品')
    expect(html).toContain('身上装备')
    expect(html).toContain('>长戟</strong>')
    expect(html).toContain('>玄铁重剑</strong>')
    expect(html).toContain('tt-delta down')
    expect(html).toContain('tt-delta up')
    // 身上装备没有的词条不标注箭头
    expect(html).toContain('<dd>+4%</dd>')
    // 行囊物品与身上物品为同一件时不进入对比
    const same = { ...inventoryFixture(), equippedBySlot: { weapon: { ...backpackItem } } }
    expect(renderInventoryPage(same)).toContain('class="equipment-tooltip"')
  })

  it('百宝囊分页条只在多页时出现，并折叠中间页码', () => {
    // 单页不渲染分页条，保持小行囊的原有版面。
    const single = { ...inventoryFixture(), pager: { page: 1, pageCount: 1, pageSize: 60, total: 12, rangeStart: 1, rangeEnd: 12 } }
    expect(renderInventoryPage(single)).not.toContain('data-testid="inventory-pager"')
    expect(renderInventoryPage(inventoryFixture())).not.toContain('data-testid="inventory-pager"')

    // 千件容量：17 页时首末页常驻，中段折叠，页码槽位不超过 7 个。
    const many = { ...inventoryFixture(), pager: { page: 9, pageCount: 17, pageSize: 60, total: 1000, rangeStart: 481, rangeEnd: 540 } }
    const html = renderInventoryPage(many)
    expect(html).toContain('data-testid="inventory-pager"')
    expect(html.match(/class="inventory-pager-num[ "]/g)).toHaveLength(5)
    expect(html.match(/class="inventory-pager-gap"/g)).toHaveLength(2)
    expect(html).toContain('data-action="inventory-page" data-page="1"')
    expect(html).toContain('data-action="inventory-page" data-page="17"')
    expect(html).toContain('aria-current="page">9<')
    expect(html).toContain('第 <b>9</b> / 17 页 · 本页 481-540 件 · 共 1000 件')

    // 首页禁用上一页，末页禁用下一页。
    const first = { ...inventoryFixture(), pager: { page: 1, pageCount: 17, pageSize: 60, total: 1000, rangeStart: 1, rangeEnd: 60 } }
    expect(renderInventoryPage(first)).toContain('data-page="0" aria-label="上一页" disabled')
    const last = { ...inventoryFixture(), pager: { page: 17, pageCount: 17, pageSize: 60, total: 1000, rangeStart: 961, rangeEnd: 1000 } }
    expect(renderInventoryPage(last)).toContain('data-page="18" aria-label="下一页" disabled')
  })

  it('势力页显示十五格公共悬榜、两线三门传承和原版招募名录', () => {
    const html = renderFactionsPage(factionsFixture())
    expect(html.match(/data-quest-slot=/g)).toHaveLength(15)
    expect(html).toContain('data-testid="faction-quest-board" data-world-id="world_01"')
    expect(html).toContain('村中泼皮')
    expect(html).toContain('势力招募')
    expect(html).toContain('邢道荣')
    expect(html).toContain('邀请入队')
    expect(html).toContain('data-action="faction-recruit"')
    expect(html).toContain('data-hero-id="hero_orig_2"')
    expect(html).toContain('勇38 · 智17 · 体47 · 敏26 · 精34')
    expect(html).not.toContain('world_01_stage_01_mob_1')
    expect(html).toContain('data-testid="faction-meridian"')
    expect(html.match(/class="faction-node /g)).toHaveLength(6)
    expect(html).toContain('Lv.0/30')
    expect(html).toContain('451 SP + 势力贡献 80')
    expect(html).toContain('效果值 100')
    expect(html).toContain('来源 <b>全真教</b>')
  })

  it('悬榜页不显示势力选择器，势力专属页保留匾额选择', () => {
    const questHtml = renderFactionsPage(factionsFixture(), 'quests')
    expect(questHtml).not.toContain('data-testid="faction-selector"')
    expect(questHtml).not.toContain('data-action="select-faction"')

    expect(renderFactionsPage(factionsFixture(), 'recruit')).toContain('data-testid="faction-selector"')
    expect(renderFactionsPage(factionsFixture(), 'martials')).toContain('data-testid="faction-selector"')
  })

  it('兑换页只展示已解锁正式势力的原版贡献目录', () => {
    const html = renderFactionsPage(factionsFixture(), 'exchange')
    expect(html).toContain('data-testid="faction-exchange"')
    expect(html).toContain('data-testid="exchange-contribution"')
    expect(html).not.toContain('data-testid="exchange-tab-general"')
    expect(html).not.toContain('data-testid="shop-buy-job_5"')
    expect(html).toContain('仅已解锁正式势力可兑换')
    // 兑换模式不再依赖势力匾额与位面声望块，改为全局目录 + 分组声望摘要。
    expect(html).not.toContain('data-testid="faction-selector"')
    expect(html).not.toContain('data-testid="faction-reputation"')
    expect(html).toContain('护卫转职书')
    expect(html).toContain('4,688')
    expect(html).toContain('虎豹之头盔图纸')
    expect(html).toContain('data-action="faction-exchange" data-faction-id="tieyi_school" data-slot="1"')
    expect(html).toContain('data-testid="faction-exchange-item-tieyi_school-1"')
    expect(html).toContain('声望 冷淡 · 等级 1 / 5')
    expect(html).toContain('东汉三国声望 · 冷淡（需友好）')
    expect(html).toContain('当前冷淡 · 需友好声望')
    // 贡献不足的物品：按钮变为跳转引导，声望不足的物品保持禁用说明。
    expect(html).toContain('data-action="exchange-goto-world" data-world-id="world_01" data-dest="factions"')
    expect(html).toContain('>需友好声望</button>')
    expect(html).toContain('贡献不足 · 点击前往赚取')
    // 种类与位面筛选切换。
    expect(html).toContain('data-action="exchange-category" data-category="blueprint"')
    expect(html).toContain('data-action="exchange-world" data-world="world_02"')
    expect(html).toContain('当前筛选共 3 件')
  })

  it('城市和背包页没有抽卡、残页与旧铁匠操作', () => {
    const html = renderCityPage(cityFixture()) + renderInventoryPage(inventoryFixture())
    expect(html).not.toMatch(/十连|保底|秘籍残页|铁匠铺|强化|淬炼|重铸|拆解/)
    // 转职书只从势力贡献兑换获得，行囊不再挂购书入口。
    expect(html).not.toContain('ink-book-shop')
    expect(html).not.toContain('购入转职书')
  })

  it('城镇页输出五处公共场所、势力城镇并保留酒馆邀请契约', () => {
    const html = renderTownsPage(townsFixture())
    expect(html).toContain('data-testid="towns-page"')
    expect(html.match(/data-testid="town-location-/g)).toHaveLength(5)
    expect(html.match(/data-testid="faction-town-/g)).toHaveLength(3)
    expect(html).toContain('洛阳 · 公共场所')
    expect(html).toContain('阵营任务')
    expect(html).toContain('贡献兑换')
    expect(html).toContain('data-action="open-faction-town"')
    expect(html).toContain('data-action="select-town-agent"')
    expect(html).toContain('data-action="select-town-exchange"')
    expect(html).toContain('data-action="select-town-recruitment"')
    expect(html).not.toContain('data-testid="faction-exchange"')
    expect(html).toContain('本存档尚未解锁此势力')
    expect(html).toContain('data-testid="tavern-hero_guo_jing"')
    expect(html).toContain('data-action="tavern-recruit"')
    expect(html).toContain('aria-label="直接邀请"')
    expect(html).toContain('class="hn-line">憨厚少年，根骨清奇。')
  })

  it('城镇代理人展示任命、替换、卸任、启停与未接入边界', () => {
    const html = renderTownsPage({
      ...townsFixture(),
      factionAgent: factionAgentFixture(),
    })
    expect(html).toContain('data-testid="faction-agent"')
    expect(html).toContain('位面代理人')
    expect(html).toContain('data-action="toggle-faction-agent"')
    expect(html).toContain('data-action="dismiss-faction-agent"')
    expect(html).toContain('data-action="appoint-faction-agent"')
    expect(html).toContain('计略 Lv.0')
    expect(html).toContain('贡献 +0%')
    expect(html).toContain('声望 +0%')
    // 自动化已接入：展示并发计数，并把筛选矩阵渲染成可点击的类型/品质开关。
    expect(html).toContain('已接 3/12')
    expect(html).toContain('data-action="toggle-agent-task-filter"')
    expect(html).toContain('data-testid="agent-task-filter-3"')
    expect(html).toContain('data-task-id="3"')
    expect(html).toContain('data-column="1"')
    expect(html).toContain('data-column="10"')
    // 「收集」在夹具里被排除，应渲染出 excluded 态与文案。
    expect(html).toContain('faction-agent-task-filter excluded')
    expect(html).toContain('>已排除</span>')
    expect(html).toContain('>已启用</span>')
    expect(html).not.toContain('条件矩阵尚未接入')
    expect(html).toContain('>已任命</button>')
    expect(html).toContain('>战斗中</button>')
  })

  it('城市页与当前位面解耦并只展示已确认的经营边界', () => {
    const html = renderCityPage(cityFixture())
    expect(html).toContain('data-testid="city-page"')
    expect(html).toContain('跨位面经营')
    expect(html).toContain('data-testid="city-map"')
    expect(html.match(/data-city-tile-id=/g)).toHaveLength(324)
    expect(html).toContain('18×18 地块 · 75 项科技')
    expect(html).toContain('<strong>25</strong>类建筑')
    expect(html).toContain('10 行 · 10 列')
    expect(html).toContain('<button type="button" disabled>出售土地</button>')
    expect(html).toContain('土地买卖、建设与迁移暂未开放')
    expect(html).not.toContain('本卷货币')
  })

  it('城市公司总览展示七类财务并关闭未核验的注册与职位操作', () => {
    const html = renderCityPage(cityFixture('company'))
    expect(html).toContain('data-testid="city-company"')
    expect(html).toContain('<button type="button" disabled>注册公司</button>')
    expect(html).toContain('古玩店可独立营业积攒现金')
    expect(html.match(/class="(?:income|expense)"/g)).toHaveLength(7)
    expect(html).toContain('古玩店销售实时入账')
    expect(html).toContain('古玩店店员可在经营总览中任命')
  })

  it('背包页按原型输出原版装备图标、详情器影和品质件数', () => {
    const html = renderInventoryPage({ ...inventoryFixture(), detailOpen: true })
    expect(html).toContain('class="inventory-cell-icon"')
    expect(html).toContain('class="inventory-cell-slot"')
    expect(html).toContain('class="inventory-appraise-figure"')
    expect(html).toContain('class="inventory-figure-ring"')
    expect(html.match(/data-equipment-icon-source="unique"/g)).toHaveLength(2)
    expect(html).toContain('物攻</span>')
    expect(html).toContain('(94%)')
    expect(html).toContain('[C]')
    expect(html).not.toContain('inventory-legend')
    expect(html).not.toContain('装备 1 件 · 堆叠物品不占装备格')
    expect(html).not.toContain('inventory-page-foot')
    // 坊市迁往兑换页后，行囊不再输出购书面板。
    expect(html).not.toContain('data-testid="job-book-shop"')
    expect(html).not.toContain('弓手转职书')
    expect(html).not.toContain('data-testid="shop-buy-job_5"')
  })

  it('装备详情区分物品等级与穿戴等级', () => {
    const item = { ...inventoryFixture().items[0], level: 20, equipmentLevel: 12 }
    const html = renderInventoryPage({
      ...inventoryFixture(), detailOpen: true, items: [item], selectedItem: item,
    })
    expect(html).toContain('data-testid="inventory-item-level">物品等级 Lv.20')
    expect(html).toContain('data-testid="inventory-equipment-level">穿戴等级 Lv.12')
    expect(html).toContain('Item Lv.20 · Wear Lv.12')
    expect(html).toContain('人物等级达到穿戴等级 Lv.12 方可穿戴')
    // 背包格只显示物品等级，避免与穿戴等级混淆
    expect(html).toContain('class="inventory-cell-level" title="物品等级">Lv.20')
  })

  it('装备详情右上角提供紧凑装备入口，身上装备槽也输出完整属性提示', () => {
    const item = inventoryFixture().items[0]
    const detail = renderInventoryPage({
      ...inventoryFixture(), detailOpen: true, items: [item], selectedItem: item, selectedHeroName: '试剑人',
    })
    expect(detail).toContain('class="inventory-detail-equip"')
    expect(detail).toContain('data-action="inventory-equip"')
    expect(detail).toContain('aria-label="为试剑人装备长戟"')
    expect(detail).not.toContain('为试剑人穿戴')
    expect(detail).not.toContain('class="ink-equip-action"')

    const heroView = heroesFixture()
    heroView.equipment = {
      heroId: 'hero_test',
      setIndex: 0,
      slots: EQUIPMENT_SLOTS.map((slot) => ({ slot, item: slot === item.slot ? item : null })),
    }
    const equipped = renderInkInventoryEquipment(heroView)
    expect(equipped).toContain('class="ink-equipped-slot"')
    expect(equipped).toContain('class="equipment-tooltip"')
    expect(equipped).toContain('物攻')
    expect(equipped).toContain('物理增伤')
  })

  it('当前大关没有势力内容时显示本卷空状态', () => {
    expect(renderFactionsPage({ ...factionsFixture(), factions: [], branches: [], recruitment: null }))
      .toContain('本卷暂无可用势力')
  })

  it('阵容页输出三路五列十五格与待上阵名单', () => {
    const html = renderFormationPage(formationFixture())
    expect(html.match(/data-row="0"/g)).toHaveLength(5)
    expect(html.match(/data-row="1"/g)).toHaveLength(5)
    expect(html.match(/data-row="2"/g)).toHaveLength(5)
    expect(html).toContain('上路')
    expect(html).toContain('中路')
    expect(html).toContain('下路')
    expect(html).toContain('点将名册')
    expect(html).toContain('演武场')
    expect(html).toContain('data-testid="formation-hero-card"')
    expect(html).not.toContain('formation-synergy')
    expect(html).not.toContain('阵势')
    expect(html).toContain('data-action="formation-auto-arrange"')
    expect(html).toContain('data-action="formation-filter"')
    expect(html).toContain('formation-radar')
    expect(html).toMatch(/formation-portrait-frame compact[\s\S]*formation-grade-seal/)
    expect(html).toMatch(/formation-portrait-frame card[\s\S]*formation-grade-seal/)
    expect(html).toContain('在阵')
    expect(html).toContain('data-testid="formation-hero-hero_test"')
    expect(html).toContain('formation-slot-remove')
    expect(html).toContain('data-testid="formation-career"')
    expect(html).toContain('职业 Lv.5')
    expect(html).toContain('白丁')

    const selectedHtml = renderFormationPage({ ...formationFixture(), selectedHeroId: 'hero_test' })
    expect(selectedHtml).toMatch(/data-hero-id="hero_test"[^>]*class="[^"]*\bactive\b/)
    expect(selectedHtml).not.toMatch(/data-hero-id="hero_shen"[^>]*class="[^"]*\bactive\b/)
  })

  it('withLore 注入 lore 字段，无 lore 时原样返回', async () => {
    const { withLore } = await import('./factions-page')
    const base = factionsFixture().selectedMartial!
    const enriched = withLore(base, { description: 'd', origin: 'o', stageName: '初传', powerNote: 'p', tags: ['单体'] })
    expect(enriched.description).toBe('d')
    expect(enriched.tags).toEqual(['单体'])
    expect(withLore(base, undefined)).toBe(base)
  })
})
