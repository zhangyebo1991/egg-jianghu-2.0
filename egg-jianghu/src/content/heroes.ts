import { STARTER_CAREER_ID } from './careers'
import { FACTIONS, factionByOriginalId } from './factions'
import { ORIGINAL_FACTION_RECRUITMENT } from './original-faction-recruitment.generated'
import type { CareerCategory } from './careers'
import type { HeroGrade, HeroProgressV10 } from '../domain/types'

export interface HeroAptitudes {
  strength: number
  insight: number
  constitution: number
  agility: number
  resolve: number
}

export interface HeroDefinitionV10 {
  id: string
  name: string
  grade: HeroGrade
  baseCareerId: string
  worldId: string
  source: 'starter' | 'tavern' | 'faction'
  cost: number
  factionId: string | null
  aptitudes: HeroAptitudes
  /** 酒馆英雄帖上的一句话点评（仅部分侠客有） */
  line?: string
  /** 招募声望门槛（1..5）；势力招募侠客来自原版名录，未达门槛不可邀请。 */
  requiredReputationLevel?: number
  /**
   * 原版《诸天刷宝录》js.json 的角色列号，用于继承原版能力白板等按角色索引的真值。
   * 仅在原版确有同一角色时填写；本作自创侠客（金庸人物）在原版名录中不存在，故留空，
   * 由 `originalHeroAbilityBase` 按「原版无此角色 → 白板 0」处理，不做姓名近似或位置猜测。
   */
  sourceId?: number
}

// [id, 姓名, 基础职业, 江湖卷]
export const TAVERN_HERO_ROWS = [
  ['hero_guo_jing', '郭靖', 'fist', 'world_01'],
  ['hero_yang_tiexin', '杨铁心', 'blade', 'world_01'],
  ['hero_mu_nianci', '穆念慈', 'sword', 'world_01'],
  ['hero_zhebie', '哲别', 'blade', 'world_02'],
  ['hero_tuolei', '拖雷', 'fist', 'world_02'],
  ['hero_huazheng', '华筝', 'inner', 'world_02'],
  ['hero_guo_xiaotian', '郭啸天', 'blade', 'world_03'],
  ['hero_bao_xiruo', '包惜弱', 'doctor', 'world_03'],
  ['hero_li_ping', '李萍', 'fist', 'world_03'],
  ['hero_kang_min', '康敏', 'shadow', 'world_04'],
  ['hero_qin_hongmian', '秦红棉', 'blade', 'world_04'],
  ['hero_wang_furen', '王夫人', 'inner', 'world_04'],
  ['hero_mu_wanqing', '木婉清', 'shadow', 'world_05'],
  ['hero_wang_yuyan', '王语嫣', 'inner', 'world_05'],
  ['hero_duan_zhengchun', '段正淳', 'sword', 'world_05'],
  ['hero_guo_fu', '郭芙', 'sword', 'world_06'],
  ['hero_wan_ping', '完颜萍', 'blade', 'world_06'],
  ['hero_yelv_yang', '耶律燕', 'fist', 'world_06'],
  ['hero_zhao_min', '赵敏', 'shadow', 'world_07'],
  ['hero_xie_xun', '谢逊', 'blade', 'world_07'],
  ['hero_xiao_zhao', '小昭', 'inner', 'world_07'],
  ['hero_duan_yu', '段誉', 'inner', 'world_08'],
  ['hero_zhong_ling', '钟灵', 'shadow', 'world_08'],
  ['hero_ruan_xingzhu', '阮星竹', 'sword', 'world_08'],
  ['hero_a_zhu', '阿朱', 'shadow', 'world_09'],
  ['hero_a_bi', '阿碧', 'inner', 'world_09'],
  ['hero_you_tanzhi', '游坦之', 'fist', 'world_09'],
  ['hero_jiu_mozhi', '鸠摩智', 'inner', 'world_10'],
  ['hero_murong_bo', '慕容博', 'sword', 'world_10'],
  ['hero_xue_muhua', '薛慕华', 'doctor', 'world_10'],
] as const satisfies ReadonlyArray<readonly [string, string, string, string]>

export const PLAYER_HERO_ID = 'hero_player'

export const PLAYER_HERO_V10: HeroDefinitionV10 = {
  id: PLAYER_HERO_ID,
  name: '无名少侠',
  grade: '丙',
  baseCareerId: STARTER_CAREER_ID,
  worldId: 'world_01',
  source: 'starter',
  cost: 0,
  factionId: null,
  // 主角对应原版 js.json 第 1 列（"主角"），其能力 1..10 白板全为 0（生成器已 assert）。
  sourceId: 1,
  // 白板号资质对齐原版《诸天刷宝录》主角（js.json id=1）：勇/智/体/敏/精全 10，天资总和 50。
  // 见 docs/诸天刷宝录_资质面板公式_源码逆向.md
  aptitudes: {
    strength: 10,
    insight: 10,
    constitution: 10,
    agility: 10,
    resolve: 10,
  },
}

const careerCategoryById: Record<string, CareerCategory> = {
  sword: '剑',
  blade: '刀',
  fist: '拳',
  shadow: '暗',
  doctor: '医',
  inner: '内家',
}

const worldIndex = (worldId: string): number => Number(worldId.slice(-2)) || 1

const factionGrade = (worldId: string): HeroGrade => {
  const index = worldIndex(worldId)
  if (index >= 9) return '天'
  if (index >= 7) return '地'
  if (index >= 4) return '甲'
  return '乙'
}

const aptitudesFor = (category: CareerCategory, worldIdx: number): HeroAptitudes => {
  const base = 7 + Math.floor(worldIdx / 2)
  const aptitude: HeroAptitudes = {
    strength: base,
    insight: base,
    constitution: base,
    agility: base,
    resolve: base,
  }
  if (category === '剑' || category === '暗') aptitude.agility += 3
  if (category === '刀' || category === '拳') aptitude.strength += 3
  if (category === '拳') aptitude.constitution += 2
  if (category === '医' || category === '内家') aptitude.insight += 3
  if (category === '内家') aptitude.resolve += 2
  return aptitude
}

// 酒馆英雄帖点评（取自 docs/城市页面重设计.html 设计稿文案，按侠客 id 索引）。
const TAVERN_HERO_LINES: Record<string, string> = {
  hero_guo_jing: '憨厚少年，根骨清奇，一副拳掌可托付。',
  hero_yang_tiexin: '忠良之后，枪刀沉雄，性如烈火。',
  hero_mu_nianci: '身世飘零，剑里藏柔，心志愈坚。',
}

export const TAVERN_HEROES: HeroDefinitionV10[] = TAVERN_HERO_ROWS.map(
  ([id, name, baseCareerId, worldId]) => ({
    id,
    name,
    grade: factionGrade(worldId),
    baseCareerId: STARTER_CAREER_ID,
    worldId,
    source: 'tavern',
    cost: 200 + worldIndex(worldId) * 40,
    factionId: null,
    aptitudes: aptitudesFor(careerCategoryById[baseCareerId] ?? '剑', worldIndex(worldId)),
    ...(TAVERN_HERO_LINES[id] ? { line: TAVERN_HERO_LINES[id] } : {}),
  }),
)

// 势力招募门人 = 原版《诸天刷宝录》名录全量 131 人（42 势力）。
// 名录、声望门槛、价格与资质均为原版真值；id 按原版角色列号稳定生成。
export const FACTION_HEROES: HeroDefinitionV10[] = ORIGINAL_FACTION_RECRUITMENT.flatMap((entry) => {
  const faction = factionByOriginalId(entry.factionSourceId)
  if (!faction) return []
  return [{
    id: `hero_orig_${entry.heroSourceId}`,
    name: entry.name,
    grade: factionGrade(faction.worldId),
    baseCareerId: STARTER_CAREER_ID,
    worldId: faction.worldId,
    source: 'faction' as const,
    cost: entry.price,
    factionId: faction.id,
    aptitudes: entry.aptitudes,
    sourceId: entry.heroSourceId,
    requiredReputationLevel: entry.requiredReputationLevel,
  }]
})

export const HEROES_V10: HeroDefinitionV10[] = [PLAYER_HERO_V10, ...TAVERN_HEROES, ...FACTION_HEROES]

export const heroMeridianCategory = (hero: HeroDefinitionV10): CareerCategory => {
  if (hero.source === 'faction' && hero.factionId) {
    return FACTIONS.find((faction) => faction.id === hero.factionId)?.category ?? '剑'
  }
  const row = TAVERN_HERO_ROWS.find((item) => item[0] === hero.id)
  return careerCategoryById[row?.[2] ?? ''] ?? '剑'
}

export const heroByIdV10 = (id: string): HeroDefinitionV10 | undefined =>
  HEROES_V10.find((hero) => hero.id === id)

export const heroDisplayNameV10 = (definition: HeroDefinitionV10, progress?: HeroProgressV10): string =>
  typeof progress?.customName === 'string' && progress.customName.trim() || definition.name
