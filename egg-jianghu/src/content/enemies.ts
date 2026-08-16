// 本文件由 scripts/generate-zhutian-enemies.mjs 从《诸天刷宝录》解包数据生成，请勿手改。
// 数据源：sq.json（地点 → 5 小怪 + 1 首领）、dr.json（怪物图鉴）、drsx.json（六维成长模板）、js.json（首领四技能）、zy.json（职业普攻）、zx.json（波次阵型）。

export interface EnemyDefinition {
  /** 原版 dr 图鉴 id，同时是立绘文件名 zt_{drId}.webp */
  drId: number
  name: string
  /** 六维成长系数（生命/速度/物攻/物防/法攻/法防，基准 100），对应 sx6..11 */
  growth: readonly [number, number, number, number, number, number]
  /** 普攻技能 id（jn 表）：小怪按 dr 模板职业、首领按 js 职业 */
  attackSkillId: number
  /** 主动技能栏（jn 表 id）：首领四技能，小怪为空 */
  skillIds: readonly number[]
}

export interface StageEnemyGroup {
  /** sq 原始行号，参与普通战斗难度系数 */
  locationId: number
  /** 本关 5 种普通小怪 */
  mobs: readonly [EnemyDefinition, EnemyDefinition, EnemyDefinition, EnemyDefinition, EnemyDefinition]
  /** 本关首领 */
  boss: EnemyDefinition
}

export interface EnemyFormationEntry {
  /** 单边本地阵位 1..15 */
  localPosition: number
  /** 1..5 为本关小怪序号，6 为首领 */
  enemyIndex: number
}

export const ENEMY_FORMATIONS: Readonly<Record<number, readonly EnemyFormationEntry[]>> = {
  1: [{ localPosition: 7, enemyIndex: 4 }, { localPosition: 9, enemyIndex: 1 }],
  2: [{ localPosition: 2, enemyIndex: 2 }, { localPosition: 7, enemyIndex: 5 }, { localPosition: 9, enemyIndex: 3 }],
  3: [{ localPosition: 2, enemyIndex: 4 }, { localPosition: 4, enemyIndex: 1 }, { localPosition: 10, enemyIndex: 3 }, { localPosition: 12, enemyIndex: 4 }, { localPosition: 14, enemyIndex: 1 }],
  4: [{ localPosition: 3, enemyIndex: 2 }, { localPosition: 5, enemyIndex: 1 }, { localPosition: 7, enemyIndex: 5 }, { localPosition: 13, enemyIndex: 2 }, { localPosition: 15, enemyIndex: 1 }],
  5: [{ localPosition: 1, enemyIndex: 5 }, { localPosition: 4, enemyIndex: 3 }, { localPosition: 7, enemyIndex: 4 }, { localPosition: 11, enemyIndex: 5 }, { localPosition: 14, enemyIndex: 1 }],
  6: [{ localPosition: 1, enemyIndex: 4 }, { localPosition: 3, enemyIndex: 3 }, { localPosition: 8, enemyIndex: 1 }, { localPosition: 11, enemyIndex: 2 }, { localPosition: 13, enemyIndex: 3 }],
  7: [{ localPosition: 2, enemyIndex: 2 }, { localPosition: 3, enemyIndex: 3 }, { localPosition: 10, enemyIndex: 1 }, { localPosition: 12, enemyIndex: 2 }, { localPosition: 13, enemyIndex: 3 }],
  8: [{ localPosition: 4, enemyIndex: 3 }, { localPosition: 6, enemyIndex: 4 }, { localPosition: 7, enemyIndex: 5 }, { localPosition: 9, enemyIndex: 1 }, { localPosition: 14, enemyIndex: 3 }],
  9: [{ localPosition: 8, enemyIndex: 2 }, { localPosition: 9, enemyIndex: 1 }, { localPosition: 11, enemyIndex: 5 }, { localPosition: 14, enemyIndex: 2 }, { localPosition: 15, enemyIndex: 1 }],
  10: [{ localPosition: 3, enemyIndex: 3 }, { localPosition: 4, enemyIndex: 1 }, { localPosition: 6, enemyIndex: 5 }, { localPosition: 8, enemyIndex: 4 }, { localPosition: 10, enemyIndex: 1 }],
  11: [{ localPosition: 1, enemyIndex: 5 }, { localPosition: 2, enemyIndex: 2 }, { localPosition: 6, enemyIndex: 4 }, { localPosition: 7, enemyIndex: 2 }, { localPosition: 10, enemyIndex: 1 }],
  12: [{ localPosition: 5, enemyIndex: 3 }, { localPosition: 6, enemyIndex: 2 }, { localPosition: 7, enemyIndex: 5 }, { localPosition: 10, enemyIndex: 1 }, { localPosition: 15, enemyIndex: 3 }],
  13: [{ localPosition: 3, enemyIndex: 4 }, { localPosition: 4, enemyIndex: 3 }, { localPosition: 6, enemyIndex: 2 }, { localPosition: 8, enemyIndex: 5 }, { localPosition: 10, enemyIndex: 3 }],
  14: [{ localPosition: 7, enemyIndex: 2 }, { localPosition: 9, enemyIndex: 1 }, { localPosition: 11, enemyIndex: 4 }, { localPosition: 13, enemyIndex: 2 }, { localPosition: 15, enemyIndex: 3 }],
  15: [{ localPosition: 7, enemyIndex: 5 }, { localPosition: 9, enemyIndex: 4 }, { localPosition: 11, enemyIndex: 2 }, { localPosition: 13, enemyIndex: 5 }, { localPosition: 14, enemyIndex: 3 }],
  16: [{ localPosition: 2, enemyIndex: 2 }, { localPosition: 5, enemyIndex: 3 }, { localPosition: 10, enemyIndex: 3 }, { localPosition: 12, enemyIndex: 4 }, { localPosition: 15, enemyIndex: 1 }],
  17: [{ localPosition: 3, enemyIndex: 1 }, { localPosition: 6, enemyIndex: 4 }, { localPosition: 9, enemyIndex: 3 }, { localPosition: 11, enemyIndex: 2 }, { localPosition: 14, enemyIndex: 3 }],
  18: [{ localPosition: 6, enemyIndex: 4 }, { localPosition: 7, enemyIndex: 5 }, { localPosition: 9, enemyIndex: 3 }, { localPosition: 11, enemyIndex: 2 }, { localPosition: 15, enemyIndex: 1 }],
  19: [{ localPosition: 3, enemyIndex: 2 }, { localPosition: 5, enemyIndex: 1 }, { localPosition: 7, enemyIndex: 6 }, { localPosition: 9, enemyIndex: 2 }, { localPosition: 13, enemyIndex: 2 }, { localPosition: 15, enemyIndex: 1 }],
  20: [{ localPosition: 4, enemyIndex: 4 }, { localPosition: 5, enemyIndex: 3 }, { localPosition: 7, enemyIndex: 6 }, { localPosition: 10, enemyIndex: 3 }, { localPosition: 14, enemyIndex: 4 }, { localPosition: 15, enemyIndex: 3 }],
  21: [{ localPosition: 4, enemyIndex: 5 }, { localPosition: 5, enemyIndex: 1 }, { localPosition: 7, enemyIndex: 6 }, { localPosition: 10, enemyIndex: 1 }, { localPosition: 14, enemyIndex: 5 }, { localPosition: 15, enemyIndex: 1 }],
  22: [{ localPosition: 4, enemyIndex: 5 }, { localPosition: 5, enemyIndex: 3 }, { localPosition: 7, enemyIndex: 6 }, { localPosition: 9, enemyIndex: 5 }, { localPosition: 14, enemyIndex: 5 }, { localPosition: 15, enemyIndex: 3 }],
  23: [{ localPosition: 4, enemyIndex: 2 }, { localPosition: 5, enemyIndex: 4 }, { localPosition: 7, enemyIndex: 6 }, { localPosition: 9, enemyIndex: 4 }, { localPosition: 14, enemyIndex: 2 }, { localPosition: 15, enemyIndex: 4 }],
}

export const STAGE_ENEMIES: Readonly<Record<string, StageEnemyGroup>> = {
  // world_01 第 1 关 · 黄巾起义
  'world_01:1': {
    locationId: 1,
    mobs: [
      { drId: 1, name: '黄巾战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 2, name: '随军参谋', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 3, name: '护卫甲兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 4, name: '长弓手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 5, name: '汉末中医', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 11, name: '张角', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 4, skillIds: [32, 74, 10, 47] },
  },
  // world_01 第 2 关 · 联军讨董
  'world_01:2': {
    locationId: 2,
    mobs: [
      { drId: 6, name: '土匪豪强', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 7, name: '奸佞乡官', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 8, name: '随军校尉', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 9, name: '江洋大盗', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 10, name: '黄巾信徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 12, name: '貂蝉', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 6, skillIds: [155, 4, 18, 7] },
  },
  // world_01 第 3 关 · 濮阳之战
  'world_01:3': {
    locationId: 3,
    mobs: [
      { drId: 1, name: '黄巾战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 7, name: '奸佞乡官', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 3, name: '护卫甲兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 9, name: '江洋大盗', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 5, name: '汉末中医', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 13, name: '吕布', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [87, 200, 161, 160] },
  },
  // world_01 第 4 关 · 新野之战
  'world_01:4': {
    locationId: 4,
    mobs: [
      { drId: 6, name: '土匪豪强', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 2, name: '随军参谋', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 8, name: '随军校尉', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 4, name: '长弓手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 10, name: '黄巾信徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 14, name: '甄宓', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 2, skillIds: [11, 110, 21, 86] },
  },
  // world_01 第 5 关 · 会师江夏
  'world_01:5': {
    locationId: 5,
    mobs: [
      { drId: 1, name: '黄巾战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 2, name: '随军参谋', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 3, name: '护卫甲兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 9, name: '江洋大盗', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 10, name: '黄巾信徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 15, name: '小乔', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [64, 76, 113, 85] },
  },
  // world_01 第 6 关 · 刮骨疗毒
  'world_01:6': {
    locationId: 6,
    mobs: [
      { drId: 6, name: '土匪豪强', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 7, name: '奸佞乡官', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 8, name: '随军校尉', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 4, name: '长弓手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 5, name: '汉末中医', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 16, name: '华佗', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [217, 227, 156, 241] },
  },
  // world_01 第 7 关 · 败走麦城
  'world_01:7': {
    locationId: 7,
    mobs: [
      { drId: 1, name: '黄巾战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 2, name: '随军参谋', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 8, name: '随军校尉', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 4, name: '长弓手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 10, name: '黄巾信徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 17, name: '关羽', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 3, skillIds: [219, 159, 171, 245] },
  },
  // world_01 第 8 关 · 夷陵之战
  'world_01:8': {
    locationId: 8,
    mobs: [
      { drId: 6, name: '土匪豪强', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 7, name: '奸佞乡官', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 3, name: '护卫甲兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 9, name: '江洋大盗', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 5, name: '汉末中医', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 18, name: '孙尚香', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 5, skillIds: [12, 87, 80, 184] },
  },
  // world_01 第 9 关 · 濡须口战
  'world_01:9': {
    locationId: 9,
    mobs: [
      { drId: 6, name: '土匪豪强', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 2, name: '随军参谋', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 8, name: '随军校尉', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 9, name: '江洋大盗', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 5, name: '汉末中医', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 19, name: '王异', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 2, skillIds: [5, 45, 116, 172] },
  },
  // world_01 第 10 关 · 六出祁山
  'world_01:10': {
    locationId: 10,
    mobs: [
      { drId: 1, name: '黄巾战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 7, name: '奸佞乡官', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 3, name: '护卫甲兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 4, name: '长弓手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 10, name: '黄巾信徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 20, name: '诸葛亮', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 4, skillIds: [186, 221, 232, 284] },
  },
  // world_02 第 1 关 · 丐帮内乱
  'world_02:1': {
    locationId: 11,
    mobs: [
      { drId: 31, name: '青城弟子', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 32, name: '武当弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 33, name: '崆峒弟子', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 34, name: '狂刀弟子', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 35, name: '泰山弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 121, name: '马夫人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [19, 49, 35, 34] },
  },
  // world_02 第 2 关 · 聚义山庄
  'world_02:2': {
    locationId: 12,
    mobs: [
      { drId: 36, name: '苍山弟子', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 37, name: '嵩山弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 38, name: '雪山弟子', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 39, name: '唐门弟子', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 40, name: '逍遥弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 122, name: '蓉儿', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 3, skillIds: [36, 150, 102, 204] },
  },
  // world_02 第 3 关 · 少室山下
  'world_02:3': {
    locationId: 13,
    mobs: [
      { drId: 31, name: '青城弟子', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 37, name: '嵩山弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 33, name: '崆峒弟子', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 39, name: '唐门弟子', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 35, name: '泰山弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 123, name: '扫地僧', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 2, skillIds: [224, 163, 172, 258] },
  },
  // world_02 第 4 关 · 巫山云雨
  'world_02:4': {
    locationId: 14,
    mobs: [
      { drId: 36, name: '苍山弟子', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 32, name: '武当弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 38, name: '雪山弟子', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 34, name: '狂刀弟子', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 40, name: '逍遥弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 124, name: '空竹', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 2, skillIds: [73, 124, 93, 203] },
  },
  // world_02 第 5 关 · 绝情山谷
  'world_02:5': {
    locationId: 15,
    mobs: [
      { drId: 31, name: '青城弟子', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 32, name: '武当弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 33, name: '崆峒弟子', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 39, name: '唐门弟子', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 40, name: '逍遥弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 125, name: '龙姑娘', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 6, skillIds: [16, 38, 228, 90] },
  },
  // world_02 第 6 关 · 华山崖壁
  'world_02:6': {
    locationId: 16,
    mobs: [
      { drId: 36, name: '苍山弟子', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 37, name: '嵩山弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 38, name: '雪山弟子', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 34, name: '狂刀弟子', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 35, name: '泰山弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 126, name: '令狐少侠', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 3, skillIds: [139, 166, 125, 107] },
  },
  // world_02 第 7 关 · 雁门山麓
  'world_02:7': {
    locationId: 17,
    mobs: [
      { drId: 31, name: '青城弟子', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 32, name: '武当弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 38, name: '雪山弟子', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 34, name: '狂刀弟子', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 40, name: '逍遥弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 127, name: '萧帮主', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 3, skillIds: [125, 145, 164, 190] },
  },
  // world_02 第 8 关 · 西湖湖畔
  'world_02:8': {
    locationId: 18,
    mobs: [
      { drId: 36, name: '苍山弟子', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 37, name: '嵩山弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 33, name: '崆峒弟子', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 39, name: '唐门弟子', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 35, name: '泰山弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 128, name: '小师妹', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 5, skillIds: [27, 67, 48, 21] },
  },
  // world_02 第 9 关 · 英雄大会
  'world_02:9': {
    locationId: 19,
    mobs: [
      { drId: 36, name: '苍山弟子', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 32, name: '武当弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 38, name: '雪山弟子', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 39, name: '唐门弟子', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 35, name: '泰山弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 129, name: '张三丰', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 6, skillIds: [188, 207, 231, 261] },
  },
  // world_02 第 10 关 · 海外孤岛
  'world_02:10': {
    locationId: 20,
    mobs: [
      { drId: 31, name: '青城弟子', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 37, name: '嵩山弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 33, name: '崆峒弟子', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 34, name: '狂刀弟子', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 40, name: '逍遥弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 130, name: '无极', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 4, skillIds: [89, 134, 164, 160] },
  },
  // world_03 第 1 关 · 东北深山
  'world_03:1': {
    locationId: 21,
    mobs: [
      { drId: 41, name: '摸金劲敌', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 42, name: '护宝猛士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 43, name: '防墓刚汉', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 44, name: '夺宝悍民', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 45, name: '守陵勇者', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 131, name: '秦宇', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 3, skillIds: [87, 194, 210, 224] },
  },
  // world_03 第 2 关 · 太行秘穴
  'world_03:2': {
    locationId: 22,
    mobs: [
      { drId: 46, name: '阻盗强民', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 47, name: '护陵硬汉', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 48, name: '守墓勇夫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 49, name: '拦盗猛者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 50, name: '御贼刚民', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 132, name: '凌雪', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 4, skillIds: [74, 126, 89, 187] },
  },
  // world_03 第 3 关 · 流沙古墓
  'world_03:3': {
    locationId: 23,
    mobs: [
      { drId: 41, name: '摸金劲敌', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 47, name: '护陵硬汉', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 43, name: '防墓刚汉', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 49, name: '拦盗猛者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 45, name: '守陵勇者', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 133, name: '吴刚', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 2, skillIds: [75, 9, 84, 130] },
  },
  // world_03 第 4 关 · 海底墓葬
  'world_03:4': {
    locationId: 24,
    mobs: [
      { drId: 46, name: '阻盗强民', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 42, name: '护宝猛士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 48, name: '守墓勇夫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 44, name: '夺宝悍民', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 50, name: '御贼刚民', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 134, name: '苏瑶瑶', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [77, 80, 68, 14] },
  },
  // world_03 第 5 关 · 湘西地宫
  'world_03:5': {
    locationId: 25,
    mobs: [
      { drId: 41, name: '摸金劲敌', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 42, name: '护宝猛士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 43, name: '防墓刚汉', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 49, name: '拦盗猛者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 50, name: '御贼刚民', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 135, name: '叶老', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 6, skillIds: [42, 137, 237, 96] },
  },
  // world_03 第 6 关 · 云南虫谷
  'world_03:6': {
    locationId: 26,
    mobs: [
      { drId: 46, name: '阻盗强民', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 47, name: '护陵硬汉', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 48, name: '守墓勇夫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 44, name: '夺宝悍民', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 45, name: '守陵勇者', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 136, name: '林悦', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 5, skillIds: [171, 160, 189, 293] },
  },
  // world_03 第 7 关 · 巴蜀棺崖
  'world_03:7': {
    locationId: 27,
    mobs: [
      { drId: 41, name: '摸金劲敌', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 42, name: '护宝猛士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 48, name: '守墓勇夫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 44, name: '夺宝悍民', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 50, name: '御贼刚民', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 137, name: '赵猛', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 4, skillIds: [6, 113, 105, 205] },
  },
  // world_03 第 8 关 · 楼兰遗址
  'world_03:8': {
    locationId: 28,
    mobs: [
      { drId: 46, name: '阻盗强民', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 47, name: '护陵硬汉', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 43, name: '防墓刚汉', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 49, name: '拦盗猛者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 45, name: '守陵勇者', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 138, name: '楚萱', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 4, skillIds: [55, 153, 28, 142] },
  },
  // world_03 第 9 关 · 秦岭古墓
  'world_03:9': {
    locationId: 29,
    mobs: [
      { drId: 46, name: '阻盗强民', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 42, name: '护宝猛士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 48, name: '守墓勇夫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 49, name: '拦盗猛者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 45, name: '守陵勇者', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 139, name: '陈老九', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [190, 177, 212, 239] },
  },
  // world_03 第 10 关 · 昆仑雪山
  'world_03:10': {
    locationId: 30,
    mobs: [
      { drId: 41, name: '摸金劲敌', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 47, name: '护陵硬汉', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 43, name: '防墓刚汉', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 44, name: '夺宝悍民', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 50, name: '御贼刚民', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 140, name: '柳青青', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [67, 149, 85, 206] },
  },
  // world_04 第 1 关 · 尼西亚
  'world_04:1': {
    locationId: 31,
    mobs: [
      { drId: 51, name: '无畏骑士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 52, name: '狂暴骑士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 53, name: '忠诚卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 54, name: '铠甲刺客', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 55, name: '神秘教徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 141, name: '居伊', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 4, skillIds: [54, 155, 63, 26] },
  },
  // world_04 第 2 关 · 多里列
  'world_04:2': {
    locationId: 32,
    mobs: [
      { drId: 56, name: '暗影骑士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 57, name: '钢铁骑士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 58, name: '坚毅卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 59, name: '重装刺客', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 60, name: '狂热教徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 142, name: '艾莉丝', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 6, skillIds: [83, 18, 165, 138] },
  },
  // world_04 第 3 关 · 安条克
  'world_04:3': {
    locationId: 33,
    mobs: [
      { drId: 51, name: '无畏骑士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 57, name: '钢铁骑士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 53, name: '忠诚卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 59, name: '重装刺客', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 55, name: '神秘教徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 143, name: '阿丽克丝', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 2, skillIds: [40, 90, 130, 219] },
  },
  // world_04 第 4 关 · 的黎波里
  'world_04:4': {
    locationId: 34,
    mobs: [
      { drId: 56, name: '暗影骑士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 52, name: '狂暴骑士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 58, name: '坚毅卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 54, name: '铠甲刺客', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 60, name: '狂热教徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 144, name: '雷纳德', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 5, skillIds: [28, 48, 104, 146] },
  },
  // world_04 第 5 关 · 开罗
  'world_04:5': {
    locationId: 35,
    mobs: [
      { drId: 51, name: '无畏骑士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 52, name: '狂暴骑士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 53, name: '忠诚卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 59, name: '重装刺客', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 60, name: '狂热教徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 145, name: '戈弗雷', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 2, skillIds: [101, 72, 129, 167] },
  },
  // world_04 第 6 关 · 安卡拉
  'world_04:6': {
    locationId: 36,
    mobs: [
      { drId: 56, name: '暗影骑士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 57, name: '钢铁骑士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 58, name: '坚毅卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 54, name: '铠甲刺客', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 55, name: '神秘教徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 146, name: '克莱尔', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [79, 69, 83, 101] },
  },
  // world_04 第 7 关 · 阿克萨
  'world_04:7': {
    locationId: 37,
    mobs: [
      { drId: 51, name: '无畏骑士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 52, name: '狂暴骑士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 58, name: '坚毅卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 54, name: '铠甲刺客', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 60, name: '狂热教徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 147, name: '伊莎贝拉', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 6, skillIds: [147, 119, 229, 217] },
  },
  // world_04 第 8 关 · 安提瓦利
  'world_04:8': {
    locationId: 38,
    mobs: [
      { drId: 56, name: '暗影骑士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 57, name: '钢铁骑士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 53, name: '忠诚卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 59, name: '重装刺客', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 55, name: '神秘教徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 148, name: '鲍德温四世', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 5, skillIds: [159, 187, 215, 249] },
  },
  // world_04 第 9 关 · 图尔库
  'world_04:9': {
    locationId: 39,
    mobs: [
      { drId: 56, name: '暗影骑士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 52, name: '狂暴骑士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 58, name: '坚毅卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 59, name: '重装刺客', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 55, name: '神秘教徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 149, name: '萨拉丁', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [212, 81, 179, 250] },
  },
  // world_04 第 10 关 · 特拉布宗
  'world_04:10': {
    locationId: 40,
    mobs: [
      { drId: 51, name: '无畏骑士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 57, name: '钢铁骑士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 53, name: '忠诚卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 54, name: '铠甲刺客', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 60, name: '狂热教徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 150, name: '狮心王理查', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 2, skillIds: [209, 169, 198, 242] },
  },
  // world_05 第 1 关 · 盂兰会
  'world_05:1': {
    locationId: 41,
    mobs: [
      { drId: 61, name: '噬魂鬼', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 62, name: '迷心鬼', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 63, name: '幻形鬼', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 64, name: '勾魂鬼', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 65, name: '摄魄鬼', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 151, name: '聂小倩', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [226, 175, 201, 253] },
  },
  // world_05 第 2 关 · 上京路
  'world_05:2': {
    locationId: 42,
    mobs: [
      { drId: 66, name: '恶念鬼', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 67, name: '魅人鬼', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 68, name: '阴灵鬼', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 69, name: '怨煞鬼', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 70, name: '邪祟鬼', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 152, name: '宁采臣', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 6, skillIds: [17, 152, 128, 162] },
  },
  // world_05 第 3 关 · 蓬莱岛
  'world_05:3': {
    locationId: 43,
    mobs: [
      { drId: 61, name: '噬魂鬼', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 67, name: '魅人鬼', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 63, name: '幻形鬼', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 69, name: '怨煞鬼', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 65, name: '摄魄鬼', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 153, name: '燕赤霞', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [218, 164, 230, 238] },
  },
  // world_05 第 4 关 · 黑风山
  'world_05:4': {
    locationId: 44,
    mobs: [
      { drId: 66, name: '恶念鬼', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 62, name: '迷心鬼', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 68, name: '阴灵鬼', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 64, name: '勾魂鬼', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 70, name: '邪祟鬼', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 154, name: '辛十四娘', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 6, skillIds: [93, 176, 174, 196] },
  },
  // world_05 第 5 关 · 鬼门关
  'world_05:5': {
    locationId: 45,
    mobs: [
      { drId: 61, name: '噬魂鬼', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 62, name: '迷心鬼', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 63, name: '幻形鬼', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 69, name: '怨煞鬼', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 70, name: '邪祟鬼', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 155, name: '冯生', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 4, skillIds: [62, 153, 19, 106] },
  },
  // world_05 第 6 关 · 上清山
  'world_05:6': {
    locationId: 46,
    mobs: [
      { drId: 66, name: '恶念鬼', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 67, name: '魅人鬼', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 68, name: '阴灵鬼', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 64, name: '勾魂鬼', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 65, name: '摄魄鬼', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 156, name: '婴宁', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 4, skillIds: [213, 156, 159, 220] },
  },
  // world_05 第 7 关 · 青丘岭
  'world_05:7': {
    locationId: 47,
    mobs: [
      { drId: 61, name: '噬魂鬼', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 62, name: '迷心鬼', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 68, name: '阴灵鬼', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 64, name: '勾魂鬼', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 70, name: '邪祟鬼', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 157, name: '小翠', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 4, skillIds: [111, 98, 164, 221] },
  },
  // world_05 第 8 关 · 桃花谷
  'world_05:8': {
    locationId: 48,
    mobs: [
      { drId: 66, name: '恶念鬼', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 67, name: '魅人鬼', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 63, name: '幻形鬼', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 69, name: '怨煞鬼', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 65, name: '摄魄鬼', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 158, name: '王生', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [158, 60, 53, 91] },
  },
  // world_05 第 9 关 · 罗刹海
  'world_05:9': {
    locationId: 49,
    mobs: [
      { drId: 66, name: '恶念鬼', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 62, name: '迷心鬼', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 68, name: '阴灵鬼', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 69, name: '怨煞鬼', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 65, name: '摄魄鬼', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 159, name: '画皮鬼', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [10, 149, 147, 213] },
  },
  // world_05 第 10 关 · 幽冥谷
  'world_05:10': {
    locationId: 50,
    mobs: [
      { drId: 61, name: '噬魂鬼', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 67, name: '魅人鬼', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 63, name: '幻形鬼', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 64, name: '勾魂鬼', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 70, name: '邪祟鬼', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 160, name: '孔雪笠', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 4, skillIds: [92, 151, 161, 171] },
  },
  // world_06 第 1 关 · 桶狭间战
  'world_06:1': {
    locationId: 51,
    mobs: [
      { drId: 71, name: '萨摩武士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 72, name: '长州武士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 73, name: '足轻步兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 74, name: '铁炮步兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 75, name: '旗本步兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 161, name: '织田信长', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 5, skillIds: [170, 190, 193, 302] },
  },
  // world_06 第 2 关 · 川中岛战
  'world_06:2': {
    locationId: 52,
    mobs: [
      { drId: 76, name: '甲斐武士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 77, name: '越后武士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 78, name: '尾张武士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 79, name: '弓取步兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 80, name: '薙刀步兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 162, name: '上杉谦信', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [188, 163, 236, 167] },
  },
  // world_06 第 3 关 · 姉川合战
  'world_06:3': {
    locationId: 53,
    mobs: [
      { drId: 71, name: '萨摩武士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 77, name: '越后武士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 73, name: '足轻步兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 79, name: '弓取步兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 75, name: '旗本步兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 163, name: '真田幸村', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [2, 132, 103, 219] },
  },
  // world_06 第 4 关 · 三方原战
  'world_06:4': {
    locationId: 54,
    mobs: [
      { drId: 76, name: '甲斐武士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 72, name: '长州武士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 78, name: '尾张武士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 74, name: '铁炮步兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 80, name: '薙刀步兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 164, name: '服部半藏', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 3, skillIds: [121, 225, 211, 240] },
  },
  // world_06 第 5 关 · 长筱合战
  'world_06:5': {
    locationId: 55,
    mobs: [
      { drId: 71, name: '萨摩武士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 72, name: '长州武士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 73, name: '足轻步兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 79, name: '弓取步兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 80, name: '薙刀步兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 165, name: '武田信玄', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 2, skillIds: [88, 218, 195, 208] },
  },
  // world_06 第 6 关 · 贱岳合战
  'world_06:6': {
    locationId: 56,
    mobs: [
      { drId: 76, name: '甲斐武士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 77, name: '越后武士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 78, name: '尾张武士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 74, name: '铁炮步兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 75, name: '旗本步兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 166, name: '丰臣秀吉', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [18, 233, 59, 148] },
  },
  // world_06 第 7 关 · 山崎合战
  'world_06:7': {
    locationId: 57,
    mobs: [
      { drId: 71, name: '萨摩武士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 72, name: '长州武士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 78, name: '尾张武士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 74, name: '铁炮步兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 80, name: '薙刀步兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 167, name: '明智光秀', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 5, skillIds: [106, 57, 14, 144] },
  },
  // world_06 第 8 关 · 长久手战
  'world_06:8': {
    locationId: 58,
    mobs: [
      { drId: 76, name: '甲斐武士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 77, name: '越后武士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 73, name: '足轻步兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 79, name: '弓取步兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 75, name: '旗本步兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 168, name: '本多忠胜', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [72, 87, 131, 219] },
  },
  // world_06 第 9 关 · 关原合战
  'world_06:9': {
    locationId: 59,
    mobs: [
      { drId: 76, name: '甲斐武士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 72, name: '长州武士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 78, name: '尾张武士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 79, name: '弓取步兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 75, name: '旗本步兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 169, name: '石田三成', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [155, 27, 35, 103] },
  },
  // world_06 第 10 关 · 大阪冬阵
  'world_06:10': {
    locationId: 60,
    mobs: [
      { drId: 71, name: '萨摩武士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 77, name: '越后武士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 73, name: '足轻步兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 74, name: '铁炮步兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 80, name: '薙刀步兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 170, name: '德川家康', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 6, skillIds: [150, 3, 216, 121] },
  },
  // world_07 第 1 关 · 闪击波兰
  'world_07:1': {
    locationId: 61,
    mobs: [
      { drId: 81, name: '突击兵', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 82, name: '机枪兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 83, name: '宪卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 84, name: '狙击兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 85, name: '山地兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 171, name: '曼施坦因', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 5, skillIds: [192, 214, 222, 243] },
  },
  // world_07 第 2 关 · 敦刻尔克
  'world_07:2': {
    locationId: 62,
    mobs: [
      { drId: 86, name: '冲锋兵', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 87, name: '步枪兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 88, name: '侦察兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 89, name: '雪地兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 90, name: '特种兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 172, name: '隆美尔', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 5, skillIds: [91, 78, 160, 165] },
  },
  // world_07 第 3 关 · 巴巴罗萨
  'world_07:3': {
    locationId: 63,
    mobs: [
      { drId: 81, name: '突击兵', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 87, name: '步枪兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 83, name: '宪卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 89, name: '雪地兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 85, name: '山地兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 173, name: '古德里安', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [115, 66, 23, 116] },
  },
  // world_07 第 4 关 · 基辅战役
  'world_07:4': {
    locationId: 64,
    mobs: [
      { drId: 86, name: '冲锋兵', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 82, name: '机枪兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 88, name: '侦察兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 84, name: '狙击兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 90, name: '特种兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 174, name: '邓尼茨', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 5, skillIds: [13, 135, 109, 229] },
  },
  // world_07 第 5 关 · 列宁格勒
  'world_07:5': {
    locationId: 65,
    mobs: [
      { drId: 81, name: '突击兵', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 82, name: '机枪兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 83, name: '宪卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 89, name: '雪地兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 90, name: '特种兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 175, name: '朱可夫', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [84, 65, 236, 171] },
  },
  // world_07 第 6 关 · 斯大林格勒
  'world_07:6': {
    locationId: 66,
    mobs: [
      { drId: 86, name: '冲锋兵', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 87, name: '步枪兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 88, name: '侦察兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 84, name: '狙击兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 85, name: '山地兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 176, name: '科涅夫', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 5, skillIds: [143, 127, 166, 170] },
  },
  // world_07 第 7 关 · 库尔斯克
  'world_07:7': {
    locationId: 67,
    mobs: [
      { drId: 81, name: '突击兵', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 82, name: '机枪兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 88, name: '侦察兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 84, name: '狙击兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 90, name: '特种兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 177, name: '艾森豪威尔', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 5, skillIds: [136, 154, 223, 191] },
  },
  // world_07 第 8 关 · 诺曼底
  'world_07:8': {
    locationId: 68,
    mobs: [
      { drId: 86, name: '冲锋兵', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 87, name: '步枪兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 83, name: '宪卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 89, name: '雪地兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 85, name: '山地兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 178, name: '巴顿', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 5, skillIds: [56, 64, 32, 157] },
  },
  // world_07 第 9 关 · 阿登战役
  'world_07:9': {
    locationId: 69,
    mobs: [
      { drId: 86, name: '冲锋兵', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 82, name: '机枪兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 88, name: '侦察兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 89, name: '雪地兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 85, name: '山地兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 179, name: '麦克阿瑟', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 2, skillIds: [208, 180, 165, 246] },
  },
  // world_07 第 10 关 · 柏林战役
  'world_07:10': {
    locationId: 70,
    mobs: [
      { drId: 81, name: '突击兵', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 87, name: '步枪兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 83, name: '宪卫兵', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 84, name: '狙击兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 90, name: '特种兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 180, name: '蒙哥马利', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 6, skillIds: [59, 229, 117, 172] },
  },
  // world_08 第 1 关 · 青鸾仙岛
  'world_08:1': {
    locationId: 71,
    mobs: [
      { drId: 91, name: '毒修士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 92, name: '邪刀客', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 93, name: '暗刃手', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 94, name: '邪灵者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 95, name: '魔火徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 181, name: '洛尘羽', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 4, skillIds: [213, 159, 179, 247] },
  },
  // world_08 第 2 关 · 苍云秘洞
  'world_08:2': {
    locationId: 72,
    mobs: [
      { drId: 96, name: '毒蛊人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 97, name: '血刀卫', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 98, name: '血影卫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 99, name: '暗魔者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 100, name: '邪火使', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 182, name: '沐雪瑶', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 3, skillIds: [140, 76, 108, 210] },
  },
  // world_08 第 3 关 · 幽影魔林
  'world_08:3': {
    locationId: 73,
    mobs: [
      { drId: 91, name: '毒修士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 97, name: '血刀卫', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 93, name: '暗刃手', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 99, name: '暗魔者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 95, name: '魔火徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 183, name: '轩辕逸', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 4, skillIds: [133, 75, 188, 171] },
  },
  // world_08 第 4 关 · 紫炎灵峰
  'world_08:4': {
    locationId: 74,
    mobs: [
      { drId: 96, name: '毒蛊人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 92, name: '邪刀客', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 98, name: '血影卫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 94, name: '邪灵者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 100, name: '邪火使', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 184, name: '苏灵月', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [80, 141, 79, 205] },
  },
  // world_08 第 5 关 · 灵霄仙谷
  'world_08:5': {
    locationId: 75,
    mobs: [
      { drId: 91, name: '毒修士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 92, name: '邪刀客', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 93, name: '暗刃手', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 99, name: '暗魔者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 100, name: '邪火使', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 185, name: '萧逸云', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 2, skillIds: [86, 169, 180, 194] },
  },
  // world_08 第 6 关 · 皓月天池
  'world_08:6': {
    locationId: 76,
    mobs: [
      { drId: 96, name: '毒蛊人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 97, name: '血刀卫', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 98, name: '血影卫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 94, name: '邪灵者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 95, name: '魔火徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 186, name: '云霓裳', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 4, skillIds: [160, 226, 168, 267] },
  },
  // world_08 第 7 关 · 玄冰剑冢
  'world_08:7': {
    locationId: 77,
    mobs: [
      { drId: 91, name: '毒修士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 92, name: '邪刀客', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 98, name: '血影卫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 94, name: '邪灵者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 100, name: '邪火使', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 187, name: '墨羽轩', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [152, 50, 86, 193] },
  },
  // world_08 第 8 关 · 炎阳圣地
  'world_08:8': {
    locationId: 78,
    mobs: [
      { drId: 96, name: '毒蛊人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 97, name: '血刀卫', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 93, name: '暗刃手', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 99, name: '暗魔者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 95, name: '魔火徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 188, name: '凌紫嫣', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 2, skillIds: [185, 198, 51, 184] },
  },
  // world_08 第 9 关 · 灵风峡谷
  'world_08:9': {
    locationId: 79,
    mobs: [
      { drId: 96, name: '毒蛊人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 92, name: '邪刀客', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 98, name: '血影卫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 99, name: '暗魔者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 95, name: '魔火徒', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 189, name: '叶清婉', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 6, skillIds: [156, 38, 95, 227] },
  },
  // world_08 第 10 关 · 翠羽仙林
  'world_08:10': {
    locationId: 80,
    mobs: [
      { drId: 91, name: '毒修士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 97, name: '血刀卫', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 93, name: '暗刃手', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 94, name: '邪灵者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 100, name: '邪火使', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 190, name: '风无痕', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 3, skillIds: [28, 139, 52, 182] },
  },
  // world_09 第 1 关 · 阿德拉行星
  'world_09:1': {
    locationId: 81,
    mobs: [
      { drId: 101, name: '暗星卫卒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 102, name: '镭影战兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 103, name: '幽光锐士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 104, name: '炽炎猛士', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 105, name: '寒霜锐兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 191, name: '亚历克斯雷顿', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 2, skillIds: [136, 233, 93, 186] },
  },
  // world_09 第 2 关 · 塞伦诺星
  'world_09:2': {
    locationId: 82,
    mobs: [
      { drId: 106, name: '风暴劲卒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 107, name: '磁能卫士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 108, name: '电浆锐士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 109, name: '量子战兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 110, name: '星陨猛士', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 192, name: '凯斯哈特曼', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 5, skillIds: [223, 172, 215, 171] },
  },
  // world_09 第 3 关 · 维兰星
  'world_09:3': {
    locationId: 83,
    mobs: [
      { drId: 101, name: '暗星卫卒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 107, name: '磁能卫士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 103, name: '幽光锐士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 109, name: '量子战兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 105, name: '寒霜锐兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 193, name: '艾丽娅斯通', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 5, skillIds: [188, 159, 170, 293] },
  },
  // world_09 第 4 关 · 泽洛斯星
  'world_09:4': {
    locationId: 84,
    mobs: [
      { drId: 106, name: '风暴劲卒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 102, name: '镭影战兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 108, name: '电浆锐士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 104, name: '炽炎猛士', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 110, name: '星陨猛士', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 194, name: '琳恩帕克', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [135, 106, 235, 197] },
  },
  // world_09 第 5 关 · 凯拉星
  'world_09:5': {
    locationId: 85,
    mobs: [
      { drId: 101, name: '暗星卫卒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 102, name: '镭影战兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 103, name: '幽光锐士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 109, name: '量子战兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 110, name: '星陨猛士', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 195, name: '卓格克里克斯', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [107, 163, 180, 294] },
  },
  // world_09 第 6 关 · 奥瑞恩星
  'world_09:6': {
    locationId: 86,
    mobs: [
      { drId: 106, name: '风暴劲卒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 107, name: '磁能卫士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 108, name: '电浆锐士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 104, name: '炽炎猛士', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 105, name: '寒霜锐兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 196, name: '托克斯维恩', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 3, skillIds: [218, 181, 179, 287] },
  },
  // world_09 第 7 关 · 菲尼克斯星
  'world_09:7': {
    locationId: 87,
    mobs: [
      { drId: 101, name: '暗星卫卒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 102, name: '镭影战兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 108, name: '电浆锐士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 104, name: '炽炎猛士', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 110, name: '星陨猛士', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 197, name: '米娅拉克斯', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 5, skillIds: [162, 232, 176, 184] },
  },
  // world_09 第 8 关 · 塔尔西斯星
  'world_09:8': {
    locationId: 88,
    mobs: [
      { drId: 106, name: '风暴劲卒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 107, name: '磁能卫士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 103, name: '幽光锐士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 109, name: '量子战兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 105, name: '寒霜锐兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 198, name: '妮拉索尔', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 4, skillIds: [198, 169, 230, 280] },
  },
  // world_09 第 9 关 · 艾瑞丹星
  'world_09:9': {
    locationId: 89,
    mobs: [
      { drId: 106, name: '风暴劲卒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 102, name: '镭影战兵', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 108, name: '电浆锐士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 109, name: '量子战兵', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 105, name: '寒霜锐兵', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 199, name: '星语者', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 2, skillIds: [166, 171, 269, 258] },
  },
  // world_09 第 10 关 · 伽马星
  'world_09:10': {
    locationId: 90,
    mobs: [
      { drId: 101, name: '暗星卫卒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 107, name: '磁能卫士', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 103, name: '幽光锐士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 104, name: '炽炎猛士', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 110, name: '星陨猛士', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 200, name: '影刃', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 3, skillIds: [160, 200, 243, 304] },
  },
  // world_10 第 1 关 · 焚炎谷
  'world_10:1': {
    locationId: 91,
    mobs: [
      { drId: 111, name: '星陨门徒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 112, name: '紫阳弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 113, name: '灵云长老', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 114, name: '寒霜门徒', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 115, name: '清风弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 201, name: '萧尘', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 3, skillIds: [166, 161, 239, 289] },
  },
  // world_10 第 2 关 · 寒霜岭
  'world_10:2': {
    locationId: 92,
    mobs: [
      { drId: 116, name: '紫雷门徒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 117, name: '焚天弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 118, name: '皓月长老', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 119, name: '苍炎门徒', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 120, name: '燃月弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 202, name: '言慕然', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 3, skillIds: [210, 179, 171, 297] },
  },
  // world_10 第 3 关 · 雷陨崖
  'world_10:3': {
    locationId: 93,
    mobs: [
      { drId: 111, name: '星陨门徒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 117, name: '焚天弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 113, name: '灵云长老', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 119, name: '苍炎门徒', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 115, name: '清风弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 203, name: '雷震天', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [81, 170, 186, 224] },
  },
  // world_10 第 4 关 · 风翔原
  'world_10:4': {
    locationId: 94,
    mobs: [
      { drId: 116, name: '紫雷门徒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 112, name: '紫阳弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 118, name: '皓月长老', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 114, name: '寒霜门徒', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 120, name: '燃月弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 204, name: '岩峰', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 2, skillIds: [203, 165, 140, 194] },
  },
  // world_10 第 5 关 · 灵木林
  'world_10:5': {
    locationId: 95,
    mobs: [
      { drId: 111, name: '星陨门徒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 112, name: '紫阳弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 113, name: '灵云长老', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 119, name: '苍炎门徒', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 120, name: '燃月弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 205, name: '林羽', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 6, skillIds: [138, 183, 162, 176] },
  },
  // world_10 第 6 关 · 暗魔窟
  'world_10:6': {
    locationId: 96,
    mobs: [
      { drId: 116, name: '紫雷门徒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 117, name: '焚天弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 118, name: '皓月长老', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 114, name: '寒霜门徒', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 115, name: '清风弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 206, name: '展灵儿', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 3, skillIds: [218, 191, 210, 269] },
  },
  // world_10 第 7 关 · 金锐峰
  'world_10:7': {
    locationId: 97,
    mobs: [
      { drId: 111, name: '星陨门徒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 112, name: '紫阳弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 118, name: '皓月长老', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 114, name: '寒霜门徒', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 120, name: '燃月弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 207, name: '苏雪', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 3, skillIds: [183, 225, 159, 267] },
  },
  // world_10 第 8 关 · 水泽湖
  'world_10:8': {
    locationId: 98,
    mobs: [
      { drId: 116, name: '紫雷门徒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 117, name: '焚天弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 113, name: '灵云长老', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 119, name: '苍炎门徒', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 115, name: '清风弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 208, name: '语昕', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 6, skillIds: [184, 176, 182, 163] },
  },
  // world_10 第 9 关 · 岩罡山
  'world_10:9': {
    locationId: 99,
    mobs: [
      { drId: 116, name: '紫雷门徒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 112, name: '紫阳弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 118, name: '皓月长老', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 119, name: '苍炎门徒', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 115, name: '清风弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 209, name: '灵心月', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [168, 221, 177, 271] },
  },
  // world_10 第 10 关 · 幻雾谷
  'world_10:10': {
    locationId: 100,
    mobs: [
      { drId: 111, name: '星陨门徒', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 117, name: '焚天弟子', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 113, name: '灵云长老', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 114, name: '寒霜门徒', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 120, name: '燃月弟子', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 210, name: '雷紫', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 3, skillIds: [159, 218, 243, 265] },
  },
  // world_11 第 1 关 · 幽影裂谷
  'world_11:1': {
    locationId: 101,
    mobs: [
      { drId: 291, name: '兽族战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 292, name: '人类法师', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 293, name: '牛头人护卫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 294, name: '巨魔弓箭手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 295, name: '人类牧师', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 321, name: '珍娜潮歌', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 4, skillIds: [221, 177, 291, 267] },
  },
  // world_11 第 2 关 · 熔火隘口
  'world_11:2': {
    locationId: 102,
    mobs: [
      { drId: 296, name: '矮人战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 297, name: '德莱法师', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 298, name: '人类骑士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 299, name: '精灵弓箭手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 300, name: '萨满祭祀', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 322, name: '西尔维夜影', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 5, skillIds: [200, 159, 244, 301] },
  },
  // world_11 第 3 关 · 霜语峰
  'world_11:3': {
    locationId: 103,
    mobs: [
      { drId: 291, name: '兽族战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 297, name: '德莱法师', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 293, name: '牛头人护卫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 299, name: '精灵弓箭手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 295, name: '人类牧师', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 323, name: '乌瑟圣辉', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 2, skillIds: [167, 176, 169, 288] },
  },
  // world_11 第 4 关 · 翡翠迷径
  'world_11:4': {
    locationId: 104,
    mobs: [
      { drId: 296, name: '矮人战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 292, name: '人类法师', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 298, name: '人类骑士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 294, name: '巨魔弓箭手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 300, name: '萨满祭祀', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 324, name: '泰莉丝月瞳', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 5, skillIds: [174, 160, 199, 279] },
  },
  // world_11 第 5 关 · 虚空礁
  'world_11:5': {
    locationId: 105,
    mobs: [
      { drId: 291, name: '兽族战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 292, name: '人类法师', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 293, name: '牛头人护卫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 299, name: '精灵弓箭手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 300, name: '萨满祭祀', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 325, name: '维里安预视', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 6, skillIds: [168, 200, 180, 171] },
  },
  // world_11 第 6 关 · 暮光圣所
  'world_11:6': {
    locationId: 106,
    mobs: [
      { drId: 296, name: '矮人战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 297, name: '德莱法师', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 298, name: '人类骑士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 294, name: '巨魔弓箭手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 295, name: '人类牧师', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 326, name: '萨恩裂地', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 3, skillIds: [159, 161, 160, 273] },
  },
  // world_11 第 7 关 · 铁棘原
  'world_11:7': {
    locationId: 107,
    mobs: [
      { drId: 291, name: '兽族战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 292, name: '人类法师', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 298, name: '人类骑士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 294, name: '巨魔弓箭手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 300, name: '萨满祭祀', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 327, name: '凯兰炽翼', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 4, skillIds: [190, 184, 168, 226] },
  },
  // world_11 第 8 关 · 星陨台
  'world_11:8': {
    locationId: 108,
    mobs: [
      { drId: 296, name: '矮人战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 297, name: '德莱法师', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 293, name: '牛头人护卫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 299, name: '精灵弓箭手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 295, name: '人类牧师', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 328, name: '莫林铁须', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [136, 223, 230, 251] },
  },
  // world_11 第 9 关 · 潮汐深渊
  'world_11:9': {
    locationId: 109,
    mobs: [
      { drId: 296, name: '矮人战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 292, name: '人类法师', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 298, name: '人类骑士', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 299, name: '精灵弓箭手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 295, name: '人类牧师', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 329, name: '玛洛恩林语', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [137, 169, 227, 228] },
  },
  // world_11 第 10 关 · 烬羽林
  'world_11:10': {
    locationId: 110,
    mobs: [
      { drId: 291, name: '兽族战士', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 297, name: '德莱法师', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 293, name: '牛头人护卫', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 294, name: '巨魔弓箭手', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 300, name: '萨满祭祀', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 330, name: '奥菲莉天翼', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [171, 206, 182, 192] },
  },
  // world_12 第 1 关 · 英雄集结
  'world_12:1': {
    locationId: 111,
    mobs: [
      { drId: 301, name: '机械异种', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 302, name: '鳄鱼人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 303, name: '黑暗毒液', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 304, name: '血色蜘蛛', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 305, name: '章鱼怪', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
    ],
    boss: { drId: 331, name: '猩红梦魇', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 4, skillIds: [212, 160, 269, 305] },
  },
  // world_12 第 2 关 · 超能觉醒
  'world_12:2': {
    locationId: 112,
    mobs: [
      { drId: 306, name: '暗黑机甲', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 307, name: '变种狼人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 308, name: '鲨鱼异形', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 309, name: '忍者猫侠', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 310, name: '通灵人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
    ],
    boss: { drId: 332, name: '暗夜裁决', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [166, 200, 165, 161] },
  },
  // world_12 第 3 关 · 无限序曲
  'world_12:3': {
    locationId: 113,
    mobs: [
      { drId: 301, name: '机械异种', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 307, name: '变种狼人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 303, name: '黑暗毒液', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 309, name: '忍者猫侠', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 305, name: '章鱼怪', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
    ],
    boss: { drId: 333, name: '雷霆王托尔', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [170, 159, 179, 265] },
  },
  // world_12 第 4 关 · 神域陨落
  'world_12:4': {
    locationId: 114,
    mobs: [
      { drId: 306, name: '暗黑机甲', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 302, name: '鳄鱼人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 308, name: '鲨鱼异形', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 304, name: '血色蜘蛛', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 310, name: '通灵人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
    ],
    boss: { drId: 334, name: '白凤凰', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [171, 168, 263, 275] },
  },
  // world_12 第 5 关 · 内战裂痕
  'world_12:5': {
    locationId: 115,
    mobs: [
      { drId: 301, name: '机械异种', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 302, name: '鳄鱼人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 303, name: '黑暗毒液', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 309, name: '忍者猫侠', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 310, name: '通灵人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
    ],
    boss: { drId: 335, name: '狂怒巨人', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 2, skillIds: [167, 169, 251, 270] },
  },
  // world_12 第 6 关 · 量子狂潮
  'world_12:6': {
    locationId: 116,
    mobs: [
      { drId: 306, name: '暗黑机甲', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 307, name: '变种狼人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 308, name: '鲨鱼异形', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 304, name: '血色蜘蛛', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 305, name: '章鱼怪', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
    ],
    boss: { drId: 336, name: '神射天眼', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 5, skillIds: [85, 206, 222, 159] },
  },
  // world_12 第 7 关 · 终局计时
  'world_12:7': {
    locationId: 117,
    mobs: [
      { drId: 301, name: '机械异种', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 302, name: '鳄鱼人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 308, name: '鲨鱼异形', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 304, name: '血色蜘蛛', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 310, name: '通灵人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
    ],
    boss: { drId: 337, name: '神裔之女', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 4, skillIds: [162, 217, 178, 272] },
  },
  // world_12 第 8 关 · 烁灭回声
  'world_12:8': {
    locationId: 118,
    mobs: [
      { drId: 306, name: '暗黑机甲', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 307, name: '变种狼人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 303, name: '黑暗毒液', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 309, name: '忍者猫侠', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 305, name: '章鱼怪', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
    ],
    boss: { drId: 338, name: '小丑女王', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [105, 200, 228, 170] },
  },
  // world_12 第 9 关 · 终焉之战
  'world_12:9': {
    locationId: 119,
    mobs: [
      { drId: 306, name: '暗黑机甲', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 302, name: '鳄鱼人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 308, name: '鲨鱼异形', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 309, name: '忍者猫侠', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 305, name: '章鱼怪', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
    ],
    boss: { drId: 339, name: '磁控领主', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [196, 179, 233, 171] },
  },
  // world_12 第 10 关 · 传奇不灭
  'world_12:10': {
    locationId: 120,
    mobs: [
      { drId: 301, name: '机械异种', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 307, name: '变种狼人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 303, name: '黑暗毒液', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 304, name: '血色蜘蛛', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 310, name: '通灵人', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
    ],
    boss: { drId: 340, name: '不朽战狼', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 3, skillIds: [180, 208, 166, 303] },
  },
  // world_13 第 1 关 · 白马佛寺
  'world_13:1': {
    locationId: 121,
    mobs: [
      { drId: 311, name: '金狮鬃圣', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 312, name: '复眼蜈蚣', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 313, name: '皈依黑熊', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 314, name: '大鹏金雕', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 315, name: '白骨鬼女', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 341, name: '唐僧', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [162, 232, 276, 299] },
  },
  // world_13 第 2 关 · 鹰渊化龙
  'world_13:2': {
    locationId: 122,
    mobs: [
      { drId: 316, name: '土匪虎妖', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 317, name: '蜘蛛精后', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 318, name: '邪魄巨象', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 319, name: '恶毒蝎女', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 320, name: '月宫白兔', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 342, name: '熬烈', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 3, skillIds: [171, 165, 181, 267] },
  },
  // world_13 第 3 关 · 高家老庄
  'world_13:3': {
    locationId: 123,
    mobs: [
      { drId: 311, name: '金狮鬃圣', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 317, name: '蜘蛛精后', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 313, name: '皈依黑熊', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 319, name: '恶毒蝎女', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 315, name: '白骨鬼女', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 343, name: '猪八戒', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 2, skillIds: [219, 195, 180, 246] },
  },
  // world_13 第 4 关 · 流沙天河
  'world_13:4': {
    locationId: 124,
    mobs: [
      { drId: 316, name: '土匪虎妖', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 312, name: '复眼蜈蚣', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 318, name: '邪魄巨象', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 314, name: '大鹏金雕', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 320, name: '月宫白兔', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 344, name: '沙和尚', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 2, skillIds: [84, 176, 172, 259] },
  },
  // world_13 第 5 关 · 翠云焰窟
  'world_13:5': {
    locationId: 125,
    mobs: [
      { drId: 311, name: '金狮鬃圣', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 312, name: '复眼蜈蚣', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 313, name: '皈依黑熊', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 319, name: '恶毒蝎女', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 320, name: '月宫白兔', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 345, name: '铁扇公主', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 4, skillIds: [168, 194, 177, 255] },
  },
  // world_13 第 6 关 · 积雷魔寨
  'world_13:6': {
    locationId: 126,
    mobs: [
      { drId: 316, name: '土匪虎妖', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 317, name: '蜘蛛精后', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 318, name: '邪魄巨象', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 314, name: '大鹏金雕', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 315, name: '白骨鬼女', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 346, name: '牛魔王', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 2, skillIds: [172, 228, 161, 270] },
  },
  // world_13 第 7 关 · 三幻尸丘
  'world_13:7': {
    locationId: 127,
    mobs: [
      { drId: 311, name: '金狮鬃圣', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 312, name: '复眼蜈蚣', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 318, name: '邪魄巨象', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 314, name: '大鹏金雕', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 320, name: '月宫白兔', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 347, name: '嫦娥', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 6, skillIds: [226, 216, 170, 253] },
  },
  // world_13 第 8 关 · 火云妖市
  'world_13:8': {
    locationId: 128,
    mobs: [
      { drId: 316, name: '土匪虎妖', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 317, name: '蜘蛛精后', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 313, name: '皈依黑熊', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 319, name: '恶毒蝎女', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 315, name: '白骨鬼女', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 348, name: '红孩儿', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [225, 179, 190, 244] },
  },
  // world_13 第 9 关 · 莲花魔炉
  'world_13:9': {
    locationId: 129,
    mobs: [
      { drId: 316, name: '土匪虎妖', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 6, skillIds: [] },
      { drId: 312, name: '复眼蜈蚣', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 2, skillIds: [] },
      { drId: 318, name: '邪魄巨象', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 8, skillIds: [] },
      { drId: 319, name: '恶毒蝎女', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 9, skillIds: [] },
      { drId: 315, name: '白骨鬼女', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 5, skillIds: [] },
    ],
    boss: { drId: 349, name: '紫霞', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [186, 159, 263, 292] },
  },
  // world_13 第 10 关 · 小雷音寺
  'world_13:10': {
    locationId: 130,
    mobs: [
      { drId: 311, name: '金狮鬃圣', growth: [110, 110, 120, 100, 80, 90], attackSkillId: 1, skillIds: [] },
      { drId: 317, name: '蜘蛛精后', growth: [90, 100, 80, 90, 130, 110], attackSkillId: 7, skillIds: [] },
      { drId: 313, name: '皈依黑熊', growth: [120, 80, 110, 120, 80, 110], attackSkillId: 3, skillIds: [] },
      { drId: 314, name: '大鹏金雕', growth: [100, 120, 110, 90, 80, 100], attackSkillId: 4, skillIds: [] },
      { drId: 320, name: '月宫白兔', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 10, skillIds: [] },
    ],
    boss: { drId: 350, name: '太上老君', growth: [96, 90, 80, 80, 110, 120], attackSkillId: 4, skillIds: [205, 230, 168, 306] },
  },
}

export const stageEnemyGroup = (worldId: string, stage: number): StageEnemyGroup | undefined =>
  STAGE_ENEMIES[`${worldId}:${stage}`]
