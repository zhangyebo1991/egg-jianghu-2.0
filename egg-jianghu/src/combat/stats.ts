import { careerById, careerCoefficientAtLevel } from '../content/careers'
import { heartMethodByIdV10 } from '../content/martials'
import { artifactSoulById, equipmentAttributeValue, equipmentDefinitionById } from '../content/equipment'
import type { HeroDefinitionV10 } from '../content/heroes'
import type { EquipmentInstance, HeroProgressV10 } from '../domain/types'
import type { AttributeMap } from '../content/attributes'
import type { CareerCombatCoefficients } from './types'

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

const COMBAT_STAT_ATTRIBUTE_IDS = new Set([6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 19, 28, 29, 37])

const DEFAULT_CAREER_COMBAT_COEFFICIENTS: CareerCombatCoefficients = {
  physicalAttack: 1,
  physicalDefense: 1,
  magicAttack: 1,
  magicDefense: 1,
  heal: 1,
}

export const buildCareerCombatCoefficients = (progress: HeroProgressV10): CareerCombatCoefficients => {
  const career = careerById(progress.currentCareerId)
  if (!career) return { ...DEFAULT_CAREER_COMBAT_COEFFICIENTS }
  const level = progress.careers[progress.currentCareerId]?.level ?? 1
  return {
    physicalAttack: careerCoefficientAtLevel(career, 'physicalAttack', level),
    physicalDefense: careerCoefficientAtLevel(career, 'physicalDefense', level),
    magicAttack: careerCoefficientAtLevel(career, 'magicAttack', level),
    magicDefense: careerCoefficientAtLevel(career, 'magicDefense', level),
    heal: careerCoefficientAtLevel(career, 'heal', level),
  }
}

export const buildCombatStats = (
  definition: HeroDefinitionV10,
  progress: HeroProgressV10,
  equipment: EquipmentInstance[] = [],
): CombatStats => {
  const aptitude = definition.aptitudes
  const career = careerById(progress.currentCareerId)
  const careerRecord = progress.careers[progress.currentCareerId]
  const careerLevel = careerRecord?.level ?? 1
  const coreCoefficient = career ? careerCoefficientAtLevel(career, 'core', careerLevel) : 1
  const heartMethod = progress.heartMethodId ? heartMethodByIdV10(progress.heartMethodId) : undefined

  const equipmentBonuses: AttributeMap = {}
  const addEquipmentBonus = (attributeId: number, value: number): void => {
    equipmentBonuses[attributeId] = (equipmentBonuses[attributeId] ?? 0) + value
  }
  for (const equipmentUid of Object.values(progress.equipmentBySlot)) {
    if (!equipmentUid) continue
    const instance = equipment.find((item) => item.uid === equipmentUid)
    const equipmentDefinition = instance ? equipmentDefinitionById(instance.definitionId) : undefined
    if (!instance || !equipmentDefinition) continue
    for (const core of instance.coreStats) {
      addEquipmentBonus(core.attributeId, equipmentAttributeValue(core.attributeId, instance.level, core.coefficient, 100))
    }
    for (const affix of instance.affixes) {
      addEquipmentBonus(affix.attributeId, equipmentAttributeValue(affix.attributeId, instance.level, affix.coefficient, 50))
    }
    for (const effect of equipmentDefinition.fixedEffects ?? []) addEquipmentBonus(effect.attributeId, effect.value)
    const artifactSoul = artifactSoulById(equipmentDefinition.artifactSoulId)
    if (artifactSoul) addEquipmentBonus(artifactSoul.attributeId, artifactSoul.value)
  }

  // expr#1026..1029：六项基础核心都读取「体」；装备核心值在天资与职业系数之前相加。
  const sharedCoreBase = 100 + Math.pow(1.0095, aptitude.constitution * 10) * 5
  const coreStat = (base: number, equipmentAttributeId: number, aptitudeBonus: number): number => Math.round(
    (base + (equipmentBonuses[equipmentAttributeId] ?? 0))
    * (100 + aptitudeBonus) / 100
    * coreCoefficient,
  )

  const stats: CombatStats = {
    // expr#1030..1035 天资加成：生命=(体+精)/2、速度=敏、物攻=勇、物防=体、法攻=智、法防=精。
    maxHp: coreStat(5 * sharedCoreBase, 6, (aptitude.constitution + aptitude.resolve) / 2),
    maxEnergy: 5,
    // 初始能量：原版 sx28 白板 0（用户实测）；战斗开始能量 = 0
    initialEnergy: 0,
    // 能量回复：原版 sx29 白板 1（用户实测）；egg 战斗循环另有行动回能机制（未确证粒度前保持）
    energyRecovery: 1 + (heartMethod?.energyRecovery ?? 0),
    externalAttack: coreStat(sharedCoreBase, 8, aptitude.strength),
    externalDefense: coreStat(0.5 * sharedCoreBase, 9, aptitude.constitution),
    internalAttack: coreStat(sharedCoreBase, 10, aptitude.insight),
    internalDefense: coreStat(0.5 * sharedCoreBase, 11, aptitude.resolve),
    effectiveAgility: Math.max(1, coreStat(150 + aptitude.constitution / 4, 7, aptitude.agility)),
    // 命中修正：原版 sx18 走特定属性统计默认分支（无资质/固有基础），白板 0；战斗命中率 = 97×(100+命中)/(100+闪避)
    accuracy: 0,
    // 闪避修正：原版 sx19 同上，白板 0
    evade: 0,
    controlResistance: 0,
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

  for (const [attributeId, value] of Object.entries(equipmentBonuses)) {
    const sxId = Number(attributeId)
    if (sxId >= 6 && sxId <= 11) continue
    applyBonus(attributeId, value)
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
    const definition = equipmentDefinitionById(instance.definitionId)
    const bonuses = [
      ...instance.coreStats.map((core) => ({ ...core, weight: 100 as const })),
      ...instance.affixes.map((affix) => ({ ...affix, weight: 50 as const })),
    ]
    for (const bonus of bonuses) {
      if (COMBAT_STAT_ATTRIBUTE_IDS.has(bonus.attributeId)) continue
      const value = equipmentAttributeValue(bonus.attributeId, instance.level, bonus.coefficient, bonus.weight)
      map[bonus.attributeId] = (map[bonus.attributeId] ?? 0) + value
    }
    const artifactSoul = artifactSoulById(definition?.artifactSoulId)
    const fixedBonuses = [
      ...(definition?.fixedEffects ?? []),
      ...(artifactSoul ? [{ attributeId: artifactSoul.attributeId, value: artifactSoul.value }] : []),
    ]
    for (const bonus of fixedBonuses) {
      if (COMBAT_STAT_ATTRIBUTE_IDS.has(bonus.attributeId)) continue
      map[bonus.attributeId] = (map[bonus.attributeId] ?? 0) + bonus.value
    }
  }
  return map
}

/** 取得当前装备方案的主手 wp[7] 武器类型，供战斗熟练增伤乘区使用。 */
export const equippedMainhandWeaponType = (
  progress: HeroProgressV10,
  equipment: EquipmentInstance[] = [],
): number | undefined => {
  const uid = progress.equipmentBySlot.weapon
  if (!uid) return undefined
  const instance = equipment.find((item) => item.uid === uid)
  const definition = instance ? equipmentDefinitionById(instance.definitionId) : undefined
  return definition?.slot === 'weapon' ? definition.weaponType : undefined
}
