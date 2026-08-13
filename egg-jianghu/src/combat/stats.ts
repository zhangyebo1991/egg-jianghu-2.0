import { careerById } from '../content/careers'
import { heartMethodByIdV10 } from '../content/martials'
import { equipmentBaseStatValue, equipmentDefinitionById } from '../content/equipment'
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
const tierMultiplier = { 初级: 1, 中级: 1.08, 高级: 1.17, 顶级: 1.28 } as const

export const buildCombatStats = (
  definition: HeroDefinitionV10,
  progress: HeroProgressV10,
  equipment: EquipmentInstance[] = [],
): CombatStats => {
  const aptitude = definition.aptitudes
  const career = careerById(progress.currentCareerId)
  const careerRecord = progress.careers[progress.currentCareerId]
  const careerLevel = careerRecord?.level ?? 1
  const perfectedCount = Object.values(progress.careers).filter((record) => record.perfected).length
  const perfectedBonusPool = perfectedCount * 0.05
  const grade = gradeMultiplier[definition.grade]
  const tier = career ? tierMultiplier[career.tier] : 1
  const levelScale = 1 + Math.max(0, progress.level - 1) * 0.035
  const careerScale = 1 + Math.max(0, careerLevel - 1) * 0.02
  const sharedScale = grade * tier * levelScale * careerScale * (1 + perfectedBonusPool)

  const externalCareerBonus = career && ['剑', '刀', '拳', '暗'].includes(career.category) ? 1.15 : 1
  const internalCareerBonus = career && ['医', '内家'].includes(career.category) ? 1.15 : 1
  const heartMethod = progress.heartMethodId ? heartMethodByIdV10(progress.heartMethodId) : undefined

  // 原版《诸天刷宝录》资质→面板公式（c3runtime.js 源码逆向，证据等级 A）。
  // 指数底数 1.0095：资质每 +1，指数项 × 1.0095^10 ≈ ×1.099。
  // 6 项核心属性（生命/速度/物攻/物防/法攻/法防）均以「体」资质推导（c3runtime 基础核心属性function 统一读 ExpObject(人物编号, 3, 1)，3 = 体）。
  // 见 docs/诸天刷宝录_资质面板公式_源码逆向.md
  const aptitudeIndex = (value: number): number => Math.pow(1.0095, value * 10)

  const stats: CombatStats = {
    // 生命：指数 ×5（体）
    maxHp: Math.floor(5 * (100 + aptitudeIndex(aptitude.constitution) * 5) * sharedScale),
    maxEnergy: 100,
    // 初始能量：原版 sx28 白板 0（用户实测）；战斗开始能量 = 0
    initialEnergy: 0,
    // 能量回复：原版 sx29 白板 1（用户实测）；egg 战斗循环另有行动回能机制（未确证粒度前保持）
    energyRecovery: 1 + (heartMethod?.energyRecovery ?? 0),
    // 物攻：指数 ×1（体）—— 原版 6 核心属性均由体资质推导，见 docs 逆向文档
    externalAttack: Math.floor((100 + aptitudeIndex(aptitude.constitution) * 5) * sharedScale * externalCareerBonus),
    // 物防：指数 ×1（体）—— 与物攻同模板
    externalDefense: Math.floor((100 + aptitudeIndex(aptitude.constitution) * 5) * sharedScale),
    // 法攻：指数 ×0.5（体）
    internalAttack: Math.floor(0.5 * (100 + aptitudeIndex(aptitude.constitution) * 5) * sharedScale * internalCareerBonus),
    // 法防：指数 ×0.5（体）—— 与法攻同模板
    internalDefense: Math.floor(0.5 * (100 + aptitudeIndex(aptitude.constitution) * 5) * sharedScale),
    // 速度：线性 150 + 体/4（原版唯一非指数核心项，白板号体=10 → 152.5）
    effectiveAgility: Math.max(1, (150 + aptitude.constitution / 4) * (1 + (heartMethod?.gaugeRate ?? 0))),
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
    perfectedBonusPool,
  }

  const applyBonus = (id: string, value: number): void => {
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
    const baseValue = equipmentBaseStatValue(equipmentDefinition, instance)
    applyBonus(equipmentDefinition.baseStatId, baseValue)
    for (const affix of instance.affixes) applyBonus(affix.id, affix.value)
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
  return map
}

/** 构建侠客的诸天 AttributeMap：核心从 CombatStats 镜像 + 装备的 sx 附加词条直接累加。 */
export const buildAttributeMap = (
  definition: HeroDefinitionV10,
  progress: HeroProgressV10,
  equipment: EquipmentInstance[] = [],
): AttributeMap => {
  const stats = buildCombatStats(definition, progress, equipment)
  const map = panelToAttributeMap(stats, definition.aptitudes)
  // 装备的诸天附加词条（id 为 sx 属性编号）累加进 AttributeMap
  for (const uid of Object.values(progress.equipmentBySlot)) {
    if (!uid) continue
    const instance = equipment.find((item) => item.uid === uid)
    if (!instance) continue
    for (const affix of instance.affixes) {
      const sxId = Number(affix.id)
      if (Number.isInteger(sxId) && sxId > 0) {
        map[sxId] = (map[sxId] ?? 0) + affix.value
      }
    }
  }
  return map
}
