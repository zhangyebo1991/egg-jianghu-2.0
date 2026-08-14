import { careerById } from '../content/careers'
import { heartMethodByIdV10 } from '../content/martials'
import { equipmentAttributeValue, equipmentDefinitionById } from '../content/equipment'
import type { HeroDefinitionV10 } from '../content/heroes'
import type { EquipmentInstance, HeroProgressV10 } from '../domain/types'
import type { AttributeMap } from '../content/attributes'

export interface CombatStats {
  maxHp: number
  maxEnergy: number
  initialEnergy: number
  energyRecovery: number
  externalAttack: number
  internalAttack: number
  externalDefense: number
  internalDefense: number
  effectiveAgility: number
  accuracy: number
  evade: number
  controlResistance: number
  criticalChance: number
  criticalMultiplier: number
  cooldownRate: number
  lifeSteal: number
  gaugeRate: number
  momentumBonus: number
  survivalBonus: number
  perfectedBonusPool: number
}

const gradeMultiplier = { 丙: 0.9, 乙: 1, 甲: 1.08, 地: 1.16, 天: 1.25 } as const
const COMBAT_STAT_ATTRIBUTE_IDS = new Set([6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 19, 28, 29, 37])

export const buildCombatStats = (
  definition: HeroDefinitionV10,
  progress: HeroProgressV10,
  equipment: EquipmentInstance[] = [],
): CombatStats => {
  const aptitude = definition.aptitudes
  const career = careerById(progress.currentCareerId)
  const careerRecord = progress.careers[progress.currentCareerId]
  const careerLevel = careerRecord?.level ?? 1
  const growth = career?.growth
  const grade = gradeMultiplier[definition.grade]
  const levelScale = 1 + Math.max(0, progress.level - 1) * 0.035
  const careerScale = 1 + Math.max(0, careerLevel - 1) * 0.02
  const sharedScale = grade * levelScale * careerScale
  const heartMethod = progress.heartMethodId ? heartMethodByIdV10(progress.heartMethodId) : undefined

  // 原版《诸天刷宝录》资质→面板公式（c3runtime.js 源码逆向，证据等级 A）。
  // 指数底数 1.0095：资质每 +1，指数项 × 1.0095^10 ≈ ×1.099。
  // 6 项核心属性（生命/速度/物攻/物防/法攻/法防）均以「体」资质推导（c3runtime 基础核心属性function 统一读 ExpObject(人物编号, 3, 1)，3 = 体）。
  // 见 docs/诸天刷宝录_资质面板公式_源码逆向.md
  const aptitudeIndex = (value: number): number => Math.pow(1.0095, value * 10)

  // 核心指数模板校准（权威白板号面板，docs/诸天刷宝录_角色属性面板_白板号.md）：
  //   模板分配：物攻/法攻共用 ×1、物防/法防共用 ×0.5、生命 ×5（文档：物攻=法攻=117、物防=法防=58、生命=580）。
  //   逆向基准 100 + 1.0095^(体×10) × 5 在体=10 ≈ 112.87，而白板面板基准为 117（攻击）/116（防御·生命）——
  //   差值来自原版职业属性系数（逆向文档 §3.3：面板 = 基础 × 职业系数），此处以校准系数落地并取整：
  //   攻击 ×1.04 → 117；防御·生命 ×1.028 → 116（0.5×116=58、5×116=580）。体=10 时逐项与文档一致。
  const attackBase = (constitution: number): number => Math.floor((100 + aptitudeIndex(constitution) * 5) * 1.04)
  const defenseBase = (constitution: number): number => Math.floor((100 + aptitudeIndex(constitution) * 5) * 1.028)

  const stats: CombatStats = {
    // 生命：防御模板 ×5（体）—— 白板 580
    maxHp: Math.floor(5 * defenseBase(aptitude.constitution) * sharedScale),
    maxEnergy: 5,
    // 初始能量：原版 sx28 白板 0（用户实测）；战斗开始能量 = 0
    initialEnergy: 0,
    // 能量回复：原版 sx29 白板 1（用户实测）；egg 战斗循环另有行动回能机制（未确证粒度前保持）
    energyRecovery: 1 + (heartMethod?.energyRecovery ?? 0),
    // 物攻：攻击模板 × 职业物攻系数
    externalAttack: Math.floor(attackBase(aptitude.constitution) * sharedScale * (growth?.physicalAttack ?? 1)),
    // 物防：防御模板 ×0.5 × 职业物防系数
    externalDefense: Math.floor(0.5 * defenseBase(aptitude.constitution) * sharedScale * (growth?.physicalDefense ?? 1)),
    // 法攻：攻击模板 × 职业法攻系数
    internalAttack: Math.floor(attackBase(aptitude.constitution) * sharedScale * (growth?.magicAttack ?? 1)),
    // 法防：防御模板 ×0.5 × 职业法防系数
    internalDefense: Math.floor(0.5 * defenseBase(aptitude.constitution) * sharedScale * (growth?.magicDefense ?? 1)),
    // 速度：线性模板 × 职业速度系数
    effectiveAgility: Math.max(1, (150 + (aptitude.constitution - 10) / 4) * (growth?.speed ?? 1) * (1 + (heartMethod?.gaugeRate ?? 0))),
    // 命中修正：原版 sx18 走特定属性统计默认分支（无资质/固有基础），白板 0；战斗命中率 = 97×(100+命中)/(100+闪避)
    accuracy: 0,
    // 闪避修正：原版 sx19 同上，白板 0
    evade: 0,
    controlResistance: Math.min(0.8, aptitude.resolve * 0.012),
    // 暴击几率：原版不随资质（特定属性统计 sx12 = 角色初始天资 + 天命天资 + 装备总属性，无资质推导项），白板恒 5%
    criticalChance: 0.05,
    criticalMultiplier: 1.5,
    cooldownRate: Math.min(0.6, heartMethod?.cooldownRate ?? 0),
    // 吸血比例（%）：原版白板 0（角色属性面板文档，权威）；战斗吸血 = ceil(伤害 × sx14/100)
    lifeSteal: 0,
    gaugeRate: heartMethod?.gaugeRate ?? 0,
    momentumBonus: heartMethod?.momentumBonus ?? 0,
    survivalBonus: heartMethod?.survivalBonus ?? 0,
    perfectedBonusPool: 0,
  }

  const applySxBonus = (sxId: number, value: number): boolean => {
    switch (sxId) {
      case 6:
        stats.maxHp += value
        return true
      case 7:
        stats.effectiveAgility += value
        return true
      case 8:
        stats.externalAttack += value
        return true
      case 9:
        stats.externalDefense += value
        return true
      case 10:
        stats.internalAttack += value
        return true
      case 11:
        stats.internalDefense += value
        return true
      case 12:
        stats.criticalChance = Math.min(1, stats.criticalChance + value / 100)
        return true
      case 13:
        stats.criticalMultiplier += value / 100
        return true
      case 14:
        stats.lifeSteal += value
        return true
      case 18:
        stats.accuracy = Math.min(0.2, stats.accuracy + value / 100)
        return true
      case 19:
        stats.evade = Math.min(1, stats.evade + value / 100)
        return true
      case 28:
        stats.initialEnergy += value
        return true
      case 29:
        stats.energyRecovery += value
        return true
      case 37:
        stats.cooldownRate = Math.min(0.6, stats.cooldownRate + value / 100)
        return true
      default:
        return false
    }
  }

  const applyBonus = (id: string, value: number): void => {
    const sxId = Number(id)
    if (Number.isInteger(sxId) && sxId > 0 && applySxBonus(sxId, value)) return
    if (id === 'attack') {
      stats.externalAttack += value
      stats.internalAttack += value
      return
    }
    if (id === 'externalAttack' || id === 'internalAttack' || id === 'maxHp'
      || id === 'externalDefense' || id === 'internalDefense' || id === 'effectiveAgility') {
      stats[id] += value
      return
    }
    if (id === 'agility') {
      stats.effectiveAgility += value
      return
    }
    if (id === 'accuracy') stats.accuracy = Math.min(0.2, stats.accuracy + value / 100)
    if (id === 'energyRecovery') stats.energyRecovery += value
    if (id === 'cooldownRate') stats.cooldownRate = Math.min(0.6, stats.cooldownRate + value / 100)
    if (id === 'criticalChance') stats.criticalChance = Math.min(1, stats.criticalChance + value / 100)
    if (id === 'controlResistance') stats.controlResistance = Math.min(0.95, stats.controlResistance + value / 100)
  }

  for (const equipmentUid of Object.values(progress.equipmentBySlot)) {
    if (!equipmentUid) continue
    const instance = equipment.find((item) => item.uid === equipmentUid)
    const equipmentDefinition = instance ? equipmentDefinitionById(instance.definitionId) : undefined
    if (!instance || !equipmentDefinition) continue
    for (const core of instance.coreStats) {
      applyBonus(String(core.attributeId), equipmentAttributeValue(core.attributeId, instance.level, core.coefficient, 100))
    }
    for (const affix of instance.affixes) {
      applyBonus(String(affix.attributeId), equipmentAttributeValue(affix.attributeId, instance.level, affix.coefficient, 50))
    }
  }

  return stats
}

/**
 * 诸天 AttributeMap 构建（Phase 1 过渡）。
 * 核心 sx6-11 直接镜像 egg 派生值（数值连续，不破坏现有战斗）；附加按 sx 默认值 + egg 小数→百分比换算。
 * Phase 3 接入职业成长系数后，核心改用诸天派生（资质 × 职业系数）。
 */
export interface AttributePanelSnapshot {
  maxHp: number
  effectiveAgility: number
  externalAttack: number
  externalDefense: number
  internalAttack: number
  internalDefense: number
  accuracy: number
  evade: number
  criticalChance: number
  criticalMultiplier: number
  controlResistance: number
  initialEnergy: number
  energyRecovery: number
  cooldownRate: number
  lifeSteal: number
}

/** 把 egg 面板快照镜像到诸天 AttributeMap。
 * 白板语义：未列出的附加/元素/专精/武器属性均为 0（attr() 回退），符合诸天白板角色——
 * 除资质、核心面板、暴击几率/暴击伤害/能量回复等基础值外，附加属性全 0，靠装备/养成堆叠。 */
export const panelToAttributeMap = (
  panel: AttributePanelSnapshot,
  aptitude?: { strength: number; insight: number; constitution: number; agility: number; resolve: number },
): AttributeMap => {
  const map: AttributeMap = {}
  // 资质 sx1-5（勇/智/体/敏/精）
  if (aptitude) {
    map[1] = aptitude.strength
    map[2] = aptitude.insight
    map[3] = aptitude.constitution
    map[4] = aptitude.agility
    map[5] = aptitude.resolve
  }
  // 核心 sx6-11（生命/速度/物攻/物防/法攻/法防）
  map[6] = panel.maxHp
  map[7] = panel.effectiveAgility
  map[8] = panel.externalAttack
  map[9] = panel.externalDefense
  map[10] = panel.internalAttack
  map[11] = panel.internalDefense
  // 附加 sx12-27：egg 用小数/比值，诸天用百分比，×100 换算
  map[12] = panel.criticalChance * 100 // 暴击几率（egg 0.05 → 诸天 5）
  map[13] = panel.criticalMultiplier * 100 // 暴击伤害（egg 1.5 → 诸天 150；sx13=总量百分比，战斗系数= sx13/100）
  map[14] = panel.lifeSteal // 吸血比例（egg 3 → 诸天 3，百分比直传）
  map[18] = panel.accuracy * 100 // 命中修正
  map[19] = panel.evade * 100 // 闪避修正
  // 特殊 sx28-43
  map[28] = panel.initialEnergy // 初始能量
  map[29] = panel.energyRecovery // 能量回复（语义差异，过渡占位）
  map[37] = panel.cooldownRate * 100 // 技能冷却
  // 技能学习 sx39：白板基础 = 0。权威面板文档显示的 1% 是命石影响，非固有基础
  // （sx39 走特定属性统计默认分支 = 养成总和；sx.json 默认 20 是词条基准）。勿补 1%。
  return map
}

/** 构建侠客的诸天 AttributeMap：CombatStats 已生效的属性从面板镜像，其余装备属性在此补入。 */
export const buildAttributeMap = (
  definition: HeroDefinitionV10,
  progress: HeroProgressV10,
  equipment: EquipmentInstance[] = [],
): AttributeMap => {
  const stats = buildCombatStats(definition, progress, equipment)
  const map = panelToAttributeMap(stats, definition.aptitudes)
  // 已进入 CombatStats 的属性不再重复累加；其余核心/附词条在 AttributeMap 中直接生效。
  for (const uid of Object.values(progress.equipmentBySlot)) {
    if (!uid) continue
    const instance = equipment.find((item) => item.uid === uid)
    if (!instance) continue
    const bonuses = [
      ...instance.coreStats.map((core) => ({ ...core, weight: 100 as const })),
      ...instance.affixes.map((affix) => ({ ...affix, weight: 50 as const })),
    ]
    for (const bonus of bonuses) {
      if (COMBAT_STAT_ATTRIBUTE_IDS.has(bonus.attributeId)) continue
      const value = equipmentAttributeValue(bonus.attributeId, instance.level, bonus.coefficient, bonus.weight)
      map[bonus.attributeId] = (map[bonus.attributeId] ?? 0) + value
    }
  }
  return map
}
