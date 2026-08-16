import { describe, expect, it } from 'vitest'
import { EQUIPMENT_SLOTS } from '../content/equipment'
import { renderCityPage, type CityPageViewModel } from './city-page'
import { renderFactionsPage, type FactionsPageViewModel } from './factions-page'
import type { FactionExchangeViewModel } from './faction-exchange'
import { renderHeroesPage, type HeroesPageViewModel } from './heroes-page'
import { renderInventoryPage, type InventoryPageViewModel } from './inventory-page'
import { renderFormationPage, type FormationPageViewModel } from './formation-page'
import { renderTownsPage, type TownsPageViewModel } from './towns-page'

const heroesFixture = (): HeroesPageViewModel => ({
  selectedHeroId: 'hero_test',
  heroes: [{
    id: 'hero_test', name: '试剑人', grade: '乙', recruited: true,
    level: 12, careerId: 'job_1', careerName: '白丁', careerLevel: 5,
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
    averageItemLevel: 0,
    wornCount: 0,
    slots: EQUIPMENT_SLOTS.map((slot) => ({ slot, item: null })),
  },
  pack: {
    capacity: 300,
    itemCount: 0,
    slotFilter: 'all',
    qualityFilter: 'all',
    page: 1,
    pageCount: 1,
    items: [],
    batchOpen: false,
    batchQuality: 'all',
    batchCount: 0,
  },
})

const exchangeFixture = (factionId = 'qingfeng_hall', factionName = '全真教'): FactionExchangeViewModel => ({
  factionId,
  factionName,
  contribution: 600,
  reputation: 120,
  reputationLevel: 1,
  reputationLevelName: '冷淡',
  reputationCurrentThreshold: 0,
  reputationNextThreshold: 200,
  items: [{
    slot: 1, kind: 'job-book', name: '护卫转职书', price: 200,
    requiredReputationLevel: null, requiredReputationName: null,
    quantity: 1, owned: false, actionDisabled: false, actionReason: null,
  }, {
    slot: 2, kind: 'blueprint', name: '虎豹之头盔图纸', price: 800,
    requiredReputationLevel: 2, requiredReputationName: '友好',
    quantity: 0, owned: false, actionDisabled: true, actionReason: '需友好声望',
  }],
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
    name: '邢道荣',
    requiredReputationLevel: 1,
    requiredReputationName: '冷淡',
    price: 100,
    actionReason: '角色资料待开放',
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
  abilityBonusAvailable: false,
  taskAutomationAvailable: false,
})

const factionsFixture = (): FactionsPageViewModel => ({
  worldIndex: 1,
  worldName: '牛家村',
  selectedFactionId: 'qingfeng_hall',
  factions: [{
    id: 'qingfeng_hall', name: '全真教', category: '剑', branchNames: ['快剑', '重剑'], contribution: 600, selected: true,
  }],
  exchange: exchangeFixture(),
  refreshRemainingMs: 3_600_000,
  quests: Array.from({ length: 5 }, (_, index) => ({
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
  factionExchange: exchangeFixture('tieyi_school', '魏国'),
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
    level: 1, quality: 1, locked: false,
    coreStats: [
      { attributeId: 8, name: '物攻', value: 12, formattedValue: '12', rollPercent: 94 },
      { attributeId: 20, name: '物理增伤', value: 0.1, formattedValue: '10%', rollPercent: 103 },
    ],
    affixes: [{ attributeId: 40, name: '土系增伤', value: 0.04, formattedValue: '4%', grade: 'C' }],
  }],
  selectedItem: {
    uid: 'equipment_1', definitionId: 'wp_101', name: '长戟', slot: 'weapon', slotName: '武器',
    level: 1, quality: 1, locked: false,
    coreStats: [
      { attributeId: 8, name: '物攻', value: 12, formattedValue: '12', rollPercent: 94 },
      { attributeId: 20, name: '物理增伤', value: 0.1, formattedValue: '10%', rollPercent: 103 },
    ],
    affixes: [{ attributeId: 40, name: '土系增伤', value: 0.04, formattedValue: '4%', grade: 'C' }],
  },
  shop: {
    worldName: '牛家村',
    currencyName: '铜钱',
    currency: 1000,
    rank: 2,
    ranks: [
      { id: 2, name: '一阶' },
      { id: 3, name: '二阶' },
      { id: 4, name: '三阶' },
      { id: 5, name: '四阶' },
      { id: 6, name: '五阶' },
    ],
    items: [{
      careerId: 'job_5', bookName: '弓手转职书', careerName: '弓手',
      price: 200, owned: 0, affordable: true,
    }],
  },
})

const formationFixture = (): FormationPageViewModel => ({
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
    expect(html).toContain('职业 <b>Lv.5</b>')
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
    expect(html).toContain('诸天属性')
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
    expect(html).toContain('可用技能类型')
    expect(html).toContain('已修职业')
    expect(html).toContain('class="hero-medallion"')
    expect(html).toContain('class="roster-search"')
    expect(html).toContain('data-testid="hero-equipment-slots"')
    expect(html).toContain('data-testid="hero-inventory-panel"')
    expect(html).toContain('随身装备')
    expect(html).not.toContain('四槽武功')
    const open = renderHeroesPage({ ...heroesFixture(), careerTreeOpen: true })
    expect(open).toContain('data-testid="career-tree"')
    expect(open).toContain('data-testid="career-node-job_1"')
    expect(open).toContain('当前职业')
  })

  it('侠客已装备槽和行囊都使用原版装备图标', () => {
    const view = heroesFixture()
    const item = inventoryFixture().items[0]
    view.equipment = {
      heroId: 'hero_test',
      setIndex: 0,
      averageItemLevel: item.level,
      wornCount: 1,
      slots: EQUIPMENT_SLOTS.map((slot) => ({ slot, item: slot === item.slot ? item : null })),
    }
    view.pack = {
      ...view.pack!,
      itemCount: 1,
      items: [{ ...item, ownerName: null, current: false, occupied: false }],
    }

    const html = renderHeroesPage(view)
    expect(html.match(/data-equipment-icon-source="unique"/g)).toHaveLength(2)
    expect(html).toContain('class="equipment-art"')
    expect(html).toContain('class="pr-icon"><img')
  })

  it('势力页显示五格悬榜、两线三门传承和原版招募名录', () => {
    const html = renderFactionsPage(factionsFixture())
    expect(html.match(/data-quest-slot=/g)).toHaveLength(5)
    expect(html).toContain('村中泼皮')
    expect(html).toContain('势力招募')
    expect(html).toContain('邢道荣')
    expect(html).toContain('角色资料待开放')
    expect(html).not.toContain('world_01_stage_01_mob_1')
    expect(html).toContain('data-testid="faction-meridian"')
    expect(html.match(/class="faction-node /g)).toHaveLength(6)
    expect(html).toContain('Lv.0/30')
    expect(html).toContain('451 SP + 势力贡献 80')
    expect(html).toContain('效果值 100')
    expect(html).toContain('来源 <b>全真教</b>')
    expect(html).toContain('data-testid="faction-reputation"')
    expect(html).toContain('<strong>冷淡</strong>')
    expect(html).toContain('护卫转职书')
    expect(html).toContain('虎豹之头盔图纸')
    expect(html).toContain('data-action="faction-exchange"')
  })

  it('城市和背包页没有抽卡、残页与旧铁匠操作', () => {
    const html = renderCityPage(cityFixture()) + renderInventoryPage(inventoryFixture())
    expect(html).not.toMatch(/十连|保底|秘籍残页|铁匠铺|强化|淬炼|重铸|拆解/)
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
    expect(html).toContain('data-testid="faction-exchange"')
    expect(html).toContain('data-faction-id="tieyi_school"')
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
      factionExchange: null,
    })
    expect(html).toContain('data-testid="faction-agent"')
    expect(html).toContain('位面代理人')
    expect(html).toContain('data-action="toggle-faction-agent"')
    expect(html).toContain('data-action="dismiss-faction-agent"')
    expect(html).toContain('data-action="appoint-faction-agent"')
    expect(html).toContain('当前角色数据未接入该能力')
    expect(html).toContain('条件矩阵尚未接入，保持关闭')
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
    expect(html).toContain('未核验操作保持关闭')
    expect(html).not.toContain('本卷货币')
  })

  it('城市公司总览展示七类财务并关闭未核验的注册与职位操作', () => {
    const html = renderCityPage(cityFixture('company'))
    expect(html).toContain('data-testid="city-company"')
    expect(html).toContain('<button type="button" disabled>注册公司</button>')
    expect(html).toContain('原版公司名称完整校验尚未解码')
    expect(html.match(/class="(?:income|expense)"/g)).toHaveLength(7)
    expect(html).toContain('原版七类收支')
    expect(html).toContain('职位能力待接入')
  })

  it('背包页按原型输出原版装备图标、详情器影和品质件数', () => {
    const html = renderInventoryPage({ ...inventoryFixture(), detailOpen: true })
    expect(html).toContain('class="inventory-cell-icon"')
    expect(html).toContain('class="inventory-cell-slot"')
    expect(html).toContain('class="inventory-appraise-figure"')
    expect(html).toContain('class="inventory-figure-ring"')
    expect(html.match(/data-equipment-icon-source="unique"/g)).toHaveLength(2)
    expect(html).toContain('品质 1<b>1</b>')
    expect(html).toContain('物攻</span>')
    expect(html).toContain('(94%)')
    expect(html).toContain('[C]')
    expect(html).toContain('共 1 件 · 囊容 300')
    expect(html).toContain('data-testid="job-book-shop"')
    expect(html).toContain('弓手转职书')
    expect(html).toContain('data-testid="shop-buy-job_5"')
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
    expect(html).toContain('data-testid="formation-synergy-fist"')
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
