/**
 * 技能图鉴（诸天刷宝录解包数据）类型定义。
 *
 * 字段含义来自 c2array 解包表的列/行映射，证据等级 A（游戏包内数据）。
 * 见 scripts/gen-codex.py 与 docs/research/诸天刷宝录-属性研究快照.md。
 */

/** 势力（shili.json，每列一个势力） */
export type Faction = {
  id: number
  name: string
  /** 系列分组 ID（1-13），对应 series 名。 */
  seriesId: number
  /** 系列名：东汉三国 / 武侠江湖 / ... / 神话天庭 */
  series: string
  /** 带颜色标签的描述 HTML */
  descHtml: string
  /** 纯文本描述 */
  descZh: string
  /** 该势力教授技能所使用的货币：货币(银两) 或 贡献 */
  currency: string
  /** 势力类型：民团（用货币）或 势力（用贡献） */
  type: string
  /** 势力技能组名称，如「曹魏虎卫」，进入 <xxx>威力 乘区 */
  skillGroup: string
  /** 该势力教授的 6 个技能在 Skill 表中的 id 列表 */
  skillIds: number[]
}

/** 技能（jn.json，每列一个技能，列号即 id） */
export type Skill = {
  id: number
  name: string
  /** 功能类型，从描述开头【XXX】解析：攻击/普攻/辅助/防御/召唤/治疗 等 */
  kind: string
  /** 技能类别 ID（1-16） */
  categoryId: number
  /** 技能类别名：通用/战技/武功/符咒/箭弩/方术/异能/神技/斗气/忍术/魔法/功法/枪械/机甲/召唤/医术 */
  category: string
  /** 元素 ID（0-8） */
  elementId: number
  /** 元素名：无/雷/水/火/木/土/精神/神圣/黑暗 */
  element: string
  /** 伤害性质：物理/法术/辅助/治疗 等（jn row26） */
  damageType: string
  /** 目标阵营：我方/敌方（jn row39） */
  targetSide: string
  /** 由描述归纳的目标范围：单体/范围/全体/随机/自身 */
  range: string
  /** 主威力百分比（jn row9），如 60 表示 法攻*60% */
  power: number
  /** 能量消耗（jn row44） */
  energyCost: number
  /** 冷却回合（jn row46） */
  cooldown: number
  /** 附加状态几率%（jn row22） */
  buffChance: number
  /** 附加状态数值（jn row25） */
  buffValue: number
  /** 受击特效名（jn row34）：斩击/锤击/雷击/爆炸/冰碎/毒爆 等 */
  hitEffect: string
  /** 学习所需等级/贡献（jn row49，推断） */
  learnReq: number
  /** 中文效果描述（纯文本） */
  descZh: string
  /** 中文效果描述（带颜色 span 的安全 HTML） */
  descHtml: string
  /** 英文效果描述（带颜色 span 的安全 HTML） */
  descEn: string
}

/** 通用属性被动技能（lsjn.json，4 阶 × 36 属性） */
export type PassiveSkill = {
  id: number
  name: string
  tierId: number
  /** 阶数：初级/中级/高级/终极 */
  tier: string
  /** 关联属性 ID（sx 属性表索引） */
  attributeId: number
  /** 学习价格 */
  cost: number
}

/** 角色（js.json，每列一个角色） */
export type Character = {
  id: number
  name: string
  race: string
  /** 称号（js row27），如「关圣帝君」 */
  title: string
  gender: string
  /** 势力归属 ID（js row25）：0=无(主角)，1-42 对应 Faction.id */
  factionId: number
  /** 位面归属 ID（js row5），对应 wm.json 位面名，如 二战风云 / 东汉三国 */
  planeId: number
  /** 位面名 */
  plane: string
  /** 招募所需位面声望阶位（js row22）：0=无，1冷淡/2友好/3尊敬/4崇拜/5信仰 */
  reputationTier: number
  /** 声望阶位名：冷淡/友好/尊敬/崇拜/信仰 */
  reputation: string
  /** 声望阶位配色 CSS 变量 */
  reputationColor: string
  /** 五项成长值：勇/智/体/敏/精（js row7-11） */
  growth: { yong: number; zhi: number; ti: number; min: number; jing: number }
  /** 招募价格（js row26） */
  price: number
  /** 自带 4 个技能 id（js row28-31） */
  skillIds: number[]
  /** 角色传记（纯文本） */
  bioZh: string
  /** 角色传记（带颜色 span 的安全 HTML） */
  bioHtml: string
}

/** 物品（wp.json，每列一个物品） */
export type GameItem = {
  id: number
  name: string
  descZh: string
  /** 价格（wp row8，部分为 0 表示非售卖） */
  price: number
  /** 数值/等级（wp row34） */
  value: number
}
