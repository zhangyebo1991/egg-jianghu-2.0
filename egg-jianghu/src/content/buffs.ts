// 本文件由 scripts/generate-zhutian-skills.mjs 从《诸天刷宝录》buff.json 生成，请勿手改。

export type BuffKind = 'attribute' | 'dot' | 'hot' | 'marker'

export interface BuffContent {
  id: number
  name: string
  polarity: 'buff' | 'debuff'
  kind: BuffKind
  /** 属性修正（sx 属性 id → 修正值）；控制类为 { sxId: 113, value: -100 } */
  attributes: ReadonlyArray<{ sxId: number; value: number }>
  maxStacks: number
  durationMs: number
  unit: 'time' | 'turn'
}

export const COMBAT_BUFFS: Readonly<Record<number, BuffContent>> = {
  1: { id: 1, name: '防御姿态', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 116, value: 50 }, { sxId: 117, value: 50 }], maxStacks: 1, durationMs: 1000, unit: 'turn' },
  2: { id: 2, name: '眩晕', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 113, value: -100 }], maxStacks: 1, durationMs: 3000, unit: 'time' },
  3: { id: 3, name: '中毒', polarity: 'debuff', kind: 'dot', attributes: [], maxStacks: 10, durationMs: 15000, unit: 'time' },
  4: { id: 4, name: '燃烧', polarity: 'debuff', kind: 'dot', attributes: [], maxStacks: 5, durationMs: 15000, unit: 'time' },
  5: { id: 5, name: '流血', polarity: 'debuff', kind: 'dot', attributes: [], maxStacks: 5, durationMs: 15000, unit: 'time' },
  6: { id: 6, name: '恢复', polarity: 'buff', kind: 'hot', attributes: [], maxStacks: 1, durationMs: 10000, unit: 'time' },
  7: { id: 7, name: '利刃', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 114, value: 20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  8: { id: 8, name: '虚弱', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 114, value: -20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  9: { id: 9, name: '凝神', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 115, value: 20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  10: { id: 10, name: '扰乱', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 115, value: -20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  11: { id: 11, name: '免伤', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 120, value: -15 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  12: { id: 12, name: '增伤', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 120, value: 15 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  13: { id: 13, name: '坚固', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 116, value: 20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  14: { id: 14, name: '破甲', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 116, value: -20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  15: { id: 15, name: '坚韧', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 117, value: 20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  16: { id: 16, name: '弱点', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 117, value: -20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  17: { id: 17, name: '加速', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 113, value: 20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  18: { id: 18, name: '减速', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 113, value: -20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  19: { id: 19, name: '专注', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 18, value: 1 }], maxStacks: 5, durationMs: 30000, unit: 'time' },
  20: { id: 20, name: '仁心', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 16, value: 2 }], maxStacks: 5, durationMs: 30000, unit: 'time' },
  21: { id: 21, name: '剑势', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 12, value: 3 }], maxStacks: 10, durationMs: 30000, unit: 'time' },
  22: { id: 22, name: '闪避', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 19, value: 20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  23: { id: 23, name: '卸力', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 114, value: -5 }], maxStacks: 1, durationMs: 5000, unit: 'time' },
  24: { id: 24, name: '震慑', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 120, value: -4 }], maxStacks: 5, durationMs: 5000, unit: 'time' },
  25: { id: 25, name: '麻痹', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 113, value: -100 }], maxStacks: 1, durationMs: 1000, unit: 'time' },
  26: { id: 26, name: '箭伤', polarity: 'debuff', kind: 'marker', attributes: [], maxStacks: 50, durationMs: 30000, unit: 'time' },
  27: { id: 27, name: '决心', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 12, value: 20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  28: { id: 28, name: '木叶', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 50, value: 30 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  29: { id: 29, name: '成长', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 40, value: 20 }], maxStacks: 1, durationMs: 60000, unit: 'time' },
  30: { id: 30, name: '标记', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 120, value: 5 }], maxStacks: 5, durationMs: 30000, unit: 'time' },
  31: { id: 31, name: '火焰', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 48, value: 30 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  32: { id: 32, name: '抚慰', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 16, value: 30 }], maxStacks: 1, durationMs: 30000, unit: 'time' },
  33: { id: 33, name: '怒气', polarity: 'buff', kind: 'marker', attributes: [], maxStacks: 99, durationMs: 20000, unit: 'time' },
  34: { id: 34, name: '怒火', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 13, value: 100 }], maxStacks: 1, durationMs: 30000, unit: 'time' },
  35: { id: 35, name: '狂暴', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 113, value: 50 }], maxStacks: 1, durationMs: 10000, unit: 'time' },
  36: { id: 36, name: '后发', polarity: 'buff', kind: 'marker', attributes: [], maxStacks: 10, durationMs: 30000, unit: 'time' },
  37: { id: 37, name: '剑心', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 93, value: 30 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  38: { id: 38, name: '迟钝', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 19, value: -20 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  39: { id: 39, name: '嗜血', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 14, value: 5 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  40: { id: 40, name: '射击姿态', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 99, value: 30 }], maxStacks: 1, durationMs: 120000, unit: 'time' },
  41: { id: 41, name: '防守姿态', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 120, value: -20 }], maxStacks: 1, durationMs: 120000, unit: 'time' },
  42: { id: 42, name: '颤栗', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 116, value: -15 }], maxStacks: 1, durationMs: 30000, unit: 'time' },
  43: { id: 43, name: '弹药', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 98, value: 5 }], maxStacks: 20, durationMs: 30000, unit: 'time' },
  44: { id: 44, name: '极寒', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 113, value: -10 }], maxStacks: 3, durationMs: 30000, unit: 'time' },
  45: { id: 45, name: '冰冻', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 113, value: -100 }], maxStacks: 1, durationMs: 3000, unit: 'time' },
  46: { id: 46, name: '雷息', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 117, value: -1 }], maxStacks: 50, durationMs: 30000, unit: 'time' },
  47: { id: 47, name: '不屈', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 116, value: 2 }], maxStacks: 10, durationMs: 10000, unit: 'time' },
  48: { id: 48, name: '无敌', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 120, value: -95 }], maxStacks: 1, durationMs: 3000, unit: 'time' },
  49: { id: 49, name: '远程姿态', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 99, value: 40 }], maxStacks: 1, durationMs: 120000, unit: 'time' },
  50: { id: 50, name: '近战姿态', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 120, value: -25 }], maxStacks: 1, durationMs: 120000, unit: 'time' },
  51: { id: 51, name: '原力', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 37, value: 5 }, { sxId: 20, value: 3 }], maxStacks: 10, durationMs: 30000, unit: 'time' },
  52: { id: 52, name: '禁疗', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 121, value: -10 }], maxStacks: 5, durationMs: 30000, unit: 'time' },
  53: { id: 53, name: '枪法', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 98, value: 40 }], maxStacks: 1, durationMs: 20000, unit: 'time' },
  54: { id: 54, name: '聚气', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 29, value: 1 }], maxStacks: 1, durationMs: 30000, unit: 'time' },
  55: { id: 55, name: '魔能', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 13, value: 15 }], maxStacks: 10, durationMs: 30000, unit: 'time' },
  56: { id: 56, name: '自如', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 37, value: 5 }], maxStacks: 10, durationMs: 30000, unit: 'time' },
  57: { id: 57, name: '守卫', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 120, value: -5 }], maxStacks: 10, durationMs: 30000, unit: 'time' },
  58: { id: 58, name: '静止', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 113, value: -100 }], maxStacks: 1, durationMs: 1000, unit: 'time' },
  59: { id: 59, name: '时间', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 113, value: 30 }], maxStacks: 3, durationMs: 15000, unit: 'time' },
  60: { id: 60, name: '浴血', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 14, value: 2 }, { sxId: 20, value: 10 }], maxStacks: 10, durationMs: 10000, unit: 'time' },
  61: { id: 61, name: '狂化', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 114, value: 5 }, { sxId: 12, value: 3 }], maxStacks: 10, durationMs: 30000, unit: 'time' },
  62: { id: 62, name: '变异', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 120, value: -5 }, { sxId: 121, value: 5 }], maxStacks: 10, durationMs: 30000, unit: 'time' },
  63: { id: 63, name: '罗汉', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 114, value: 30 }, { sxId: 115, value: 30 }], maxStacks: 1, durationMs: 30000, unit: 'time' },
  64: { id: 64, name: '金刚', polarity: 'buff', kind: 'attribute', attributes: [{ sxId: 116, value: 30 }, { sxId: 117, value: 30 }], maxStacks: 1, durationMs: 30000, unit: 'time' },
  65: { id: 65, name: '焚心', polarity: 'debuff', kind: 'dot', attributes: [], maxStacks: 5, durationMs: 15000, unit: 'time' },
  66: { id: 66, name: '天威', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 114, value: -25 }, { sxId: 115, value: -25 }], maxStacks: 1, durationMs: 30000, unit: 'time' },
  67: { id: 67, name: '神压', polarity: 'debuff', kind: 'attribute', attributes: [{ sxId: 116, value: -25 }, { sxId: 117, value: -25 }], maxStacks: 1, durationMs: 30000, unit: 'time' },
}

export const buffById = (id: number): BuffContent | undefined => COMBAT_BUFFS[id]
