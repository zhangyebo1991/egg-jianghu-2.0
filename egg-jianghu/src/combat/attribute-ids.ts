/**
 * 诸天属性 id 语义常量（手写，对应 attributes.ts 生成的 id 1..202）。
 * 战斗公式按这些常量读取 AttributeMap，避免魔法数字。
 * id 来自《诸天刷宝录》sx.json，证据等级 A。
 *
 * 元素、技能类别、武器熟练和技能组威力均按原版表字段映射（见下方 helpers）。
 */

/** 战斗公式直接读取的属性 id（按 sx.json 编号）。 */
export const SX = {
  // 资质 sx1-5
  勇: 1,
  智: 2,
  体: 3,
  敏: 4,
  精: 5,
  // 核心 sx6-11
  生命: 6,
  速度: 7,
  物攻: 8,
  物防: 9,
  法攻: 10,
  法防: 11,
  // 附加 sx12-27
  暴击几率: 12,
  暴击伤害: 13,
  吸血: 14,
  生命恢复: 15,
  治疗加成: 16,
  护盾加成: 17,
  命中修正: 18,
  闪避修正: 19,
  物理增伤: 20,
  物理减伤: 21,
  法术增伤: 22,
  法术减伤: 23,
  护盾超限: 24,
  普攻增伤: 25,
  最终增伤: 26,
  最终减伤: 27,
  // 特殊 sx28-43
  初始能量: 28,
  能量回复: 29,
  召唤强度: 31,
  召唤数量: 32,
  召唤时间: 33,
  增益时间: 34,
  减益时间: 35,
  技能冷却: 37,
  受疗效果: 38,
  // 战斗隐藏 sx112-130（减伤 / 受伤害 / 速度修正，公式直接读取）
  生命上限修正: 112,
  速度修正: 113,
  物攻修正: 114,
  法攻修正: 115,
  物防修正: 116,
  法防修正: 117,
  受物理伤害: 118,
  受法术伤害: 119,
  受所有伤害: 120,
  受治疗效果: 121,
  受护盾效果: 122,
} as const

/**
 * 元素标签（jn[5] 0-8）→ 相关属性 id。
 * Phase 3 技能标签接入后，公式按技能元素查这些 id 取乘区值。
 * 顺序：雷水火木土精神神圣黑暗（与 sx 元素段一致）。
 */
export const ELEMENT_IDS: Record<number, { damage: number; resist: number; received: number; groupPower: number }> = {
  1: { damage: 44, resist: 45, received: 123, groupPower: 195 }, // 雷
  2: { damage: 46, resist: 47, received: 124, groupPower: 196 }, // 水
  3: { damage: 48, resist: 49, received: 125, groupPower: 197 }, // 火
  4: { damage: 50, resist: 51, received: 126, groupPower: 198 }, // 木
  5: { damage: 52, resist: 53, received: 127, groupPower: 199 }, // 土
  6: { damage: 54, resist: 55, received: 128, groupPower: 200 }, // 精神
  7: { damage: 56, resist: 57, received: 129, groupPower: 201 }, // 神圣
  8: { damage: 58, resist: 59, received: 130, groupPower: 202 }, // 黑暗
}

/** 原版：主手 wp[7] 武器类型 1..10 → sx92..101 熟练增伤。 */
export const weaponMasteryAttributeId = (weaponType: number): number => 91 + weaponType

/** 原版：jn[49] 技能组 1..39 → sx153..191 技能组威力。 */
export const skillGroupPowerAttributeId = (skillGroupId: number): number => 152 + skillGroupId

/** 从 AttributeMap 安全取值（缺失回退默认 0）。 */
export const attr = (map: Record<number, number>, id: number): number => map[id] ?? 0
