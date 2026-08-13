/**
 * 诸天刷宝录 18 乘区伤害公式（data.json 事件表，证据等级 A）。
 *
 * 最终伤害 = 基础伤害(10718) × 技能层 × 加法池 × 减伤 × 受伤害 × 最终层 × 暴击 × 增效buff(10719)
 *   基础伤害 = A² / (A + D)
 *   A = 攻击面板 × 攻击修正 × 职业攻击系数
 *   D = 防御面板 × 防御修正 × 职业防御系数
 *   技能层 = 技能系数 × (1+技能组威力) × (1+元素组威力)
 *   加法池 = 1 + (物法增伤 + 普攻增伤 + 元素增伤 + 专精增伤 + 熟练增伤)   ← 5 路求和
 *   减伤   = (1−物法减伤) × (1−元素抗性)                                  ← 两独立乘区，cap 80
 *   受伤害 = (1+受物法) × (1+受元素) × (1+受所有)                         ← 三层独立，cap 95
 *   最终层 = 1 + 最终增伤 − 最终减伤                                       ← 同括号，终减 cap 80
 *   暴击   = 裸系数（1 或 暴伤/100；sx13 为总量百分比，白板 150 → 1.5）
 *   增效buff = 1 + 增效buff系数
 *
 * 乘区形态除暴击外均 (1 + 词条/100)；cap 来自 sx.json 第 9 字段（Agent 1 源码确认）。
 */

/** 18 乘区输入。除 attack/defense/skillCoeff/critical 外，均为面板百分比（公式内部 /100）。 */
export interface DamageMultipliers {
  /** 攻击端面板（已含攻击修正 × 职业攻击系数） */
  attack: number
  /** 防御端面板（已含防御修正 × 职业防御系数） */
  defense: number
  /** 技能系数（裸倍率，如普攻 1.0、武功 1.5） */
  skillCoeff: number
  /** 技能组威力 %（按技能所属势力，Phase 3 接入） */
  factionPower: number
  /** 元素组威力 %（按技能元素，Phase 3 接入） */
  elementPower: number
  /** 加法池 5 路（%） */
  damageType: number // 物理或法术增伤（按伤害性质）
  basicAttack: number // 普攻增伤（仅普攻）
  elementDamage: number // 元素增伤（按技能元素）
  specialization: number // 技能专精增伤（按技能类别）
  mastery: number // 武器熟练增伤（按武器类型）
  /** 减伤（%，两独立乘区，cap 80） */
  typeReduction: number // 物法减伤
  elementResist: number // 元素抗性
  /** 受伤害（%，三层独立，cap 95） */
  receivedType: number // 受物法伤害
  receivedElement: number // 受元素伤害
  receivedAll: number // 受所有伤害
  /** 最终层（%，同括号：终增 − 终减，终减 cap 80） */
  finalDamage: number
  finalReduction: number
  /** 暴击裸系数（未暴击=1，暴击=暴伤/100；sx13 为总量百分比，白板 150 → 1.5） */
  critical: number
  /** 增效 BUFF 系数 % */
  buffMultiplier: number
}

const cap = (value: number, max: number): number => Math.min(max, Math.max(0, value))

/** 诸天伤害结算（表达式 10718 + 10719）。最低保底 1。 */
export const calculateDamage = (m: DamageMultipliers): number => {
  const a = Math.max(1, m.attack)
  const d = Math.max(0, m.defense)
  const core = (a * a) / (a + d) // 10718：A²/(A+D)

  const skillLayer = m.skillCoeff * (1 + m.factionPower / 100) * (1 + m.elementPower / 100)
  const additivePool = 1 + (m.damageType + m.basicAttack + m.elementDamage + m.specialization + m.mastery) / 100
  const typeRed = 1 - cap(m.typeReduction, 80) / 100
  const elementResist = 1 - cap(m.elementResist, 80) / 100
  const receivedType = 1 + cap(m.receivedType, 95) / 100
  const receivedElement = 1 + cap(m.receivedElement, 95) / 100
  const receivedAll = 1 + cap(m.receivedAll, 95) / 100
  const finalLayer = 1 + m.finalDamage / 100 - cap(m.finalReduction, 80) / 100
  const buff = 1 + m.buffMultiplier / 100

  const damage =
    core *
    skillLayer *
    additivePool *
    typeRed *
    elementResist *
    receivedType *
    receivedElement *
    receivedAll *
    finalLayer *
    m.critical *
    buff

  return Math.max(1, Math.floor(damage))
}

/**
 * 诸天命中/闪避（闪避计算function，证据 A，c3runtime 58097/58105）。
 * 命中率 = clamp(97 × (100 + 命中修正) / (100 + 闪避修正), 30, 100)%
 * 闪避率 = 100 − 命中率。下限 30 = data.json「最低真实命中率」常量（证据 A）。
 * 白板（命中修正 = 闪避修正 = 0）：命中率 97%、闪避率 3%。修正相等时相互抵消，恒 97%。
 */
export const hitChance = (evadeMod: number, hitMod: number, lowerBound = 30): number => {
  const hitPct = (97 * (100 + hitMod)) / (100 + evadeMod)
  return Math.max(lowerBound, Math.min(100, hitPct)) / 100
}

/** 闪避率 = 1 − 命中率（原版「闪避」= 100 − 命中率）。 */
export const evadeRate = (evadeMod: number, hitMod: number, lowerBound = 30): number =>
  1 - hitChance(evadeMod, hitMod, lowerBound)

/**
 * 诸天暴击判定（暴击计算function + c3runtime 57793 行，证据 A）。
 * 暴击几率（%，sx12，白板 5）随机判定；暴击系数 = 暴击伤害/100（sx13 为总量百分比，白板 150 → 1.5 倍）。
 * 注意：sx13 是「暴击伤害总量百分比」（150=150%），系数直接 /100，勿再加 1。
 */
export const rollCritical = (critRate: number, critDamage: number, roll: number): { isCritical: boolean; coefficient: number } => {
  const isCritical = roll < critRate / 100
  return { isCritical, coefficient: isCritical ? critDamage / 100 : 1 }
}
