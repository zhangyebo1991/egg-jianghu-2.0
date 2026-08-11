import { FACTIONS } from './factions'
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
  baseCareerId: 'sword',
  worldId: 'world_01',
  source: 'starter',
  cost: 0,
  factionId: null,
  aptitudes: {
    strength: 8,
    insight: 8,
    constitution: 9,
    agility: 9,
    resolve: 8,
  },
}

const careerByCategory: Record<CareerCategory, string> = {
  剑: 'sword',
  刀: 'blade',
  拳: 'fist',
  暗: 'shadow',
  医: 'doctor',
  内家: 'inner',
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
    baseCareerId,
    worldId,
    source: 'tavern',
    cost: 200 + worldIndex(worldId) * 40,
    factionId: null,
    aptitudes: aptitudesFor(careerCategoryById[baseCareerId] ?? '剑', worldIndex(worldId)),
    ...(TAVERN_HERO_LINES[id] ? { line: TAVERN_HERO_LINES[id] } : {}),
  }),
)

// 每个势力 3 名可招募门人（按势力 id 索引，名称避开本卷敌人/BOSS）。
export const FACTION_RECRUIT_NAMES: Record<string, readonly [string, string, string]> = {
  qingfeng_hall: ['孙不二', '刘处玄', '谭处端'],
  tieyi_school: ['洪七公', '黎生', '余兆兴'],
  renxin_hall: ['冯默风', '程英', '傻姑'],
  duanlang_blade: ['陆展元', '陆立鼎', '陆二娘'],
  yexing_tower: ['欧阳锋', '杨康', '欧阳克'],
  guiyuan_manor: ['李莫愁', '陆无双', '洪凌波'],
  tingyu_sword: ['公孙止', '公孙绿萼', '樊一翁'],
  feixing_dock: ['史伯威', '史仲猛', '史叔刚'],
  tiaoxi_court: ['丘处机', '王处一', '马钰'],
  zhenyue_blade: ['段誉', '刀白凤', '阮星竹'],
  mianshan_school: ['本观', '本相', '本参'],
  baicao_hall: ['岳老三', '叶二娘', '云中鹤'],
  cangfeng_manor: ['康广陵', '范百龄', '苟读'],
  hengjiang_blade: ['余婆', '石嫂', '程青霜'],
  xinglin_valley: ['钟万仇', '甘宝宝', '于婆婆'],
  zhenshan_gate: ['霍都', '达尔巴', '潇湘子'],
  wuteng_stockade: ['黄蓉', '耶律齐', '鲁有脚'],
  baoyuan_temple: ['朱子柳', '武三通', '点苍渔隐'],
  wanren_court: ['杨逍', '范遥', '殷天正'],
  juezong_gate: ['张三丰', '宋远桥', '俞莲舟'],
  jingmai_court: ['灭绝师太', '纪晓芙', '周芷若'],
  shuofeng_blade: ['玄慈', '玄苦', '扫地僧'],
  huajin_hall: ['吴领军', '冯阿三', '李傀儡'],
  jingang_court: ['段正明', '枯荣大师', '本因'],
  tianxia_sword: ['吴长风', '宋长老', '奚长老'],
  tongbi_society: ['石清露', '杨友连', '李傀儡'],
  zhoutian_sect: ['古笃诚', '朱子柳', '武三通'],
  baizhan_blade: ['竹剑', '兰剑', '梅剑'],
  zhuiming_office: ['阿紫', '天狼子', '追风子'],
  qihuang_society: ['邓百川', '公冶乾', '风波恶'],
}

export const FACTION_HEROES: HeroDefinitionV10[] = FACTIONS.flatMap((faction) => {
  const names = FACTION_RECRUIT_NAMES[faction.id] ?? []
  const worldIdx = worldIndex(faction.worldId)
  return names.map((name, index) => ({
    id: `hero_${faction.id}_${String(index + 1).padStart(2, '0')}`,
    name,
    grade: factionGrade(faction.worldId),
    baseCareerId: careerByCategory[faction.category],
    worldId: faction.worldId,
    source: 'faction',
    cost: 600 + worldIdx * 200,
    factionId: faction.id,
    aptitudes: aptitudesFor(faction.category, worldIdx),
  }))
})

export const HEROES_V10: HeroDefinitionV10[] = [PLAYER_HERO_V10, ...TAVERN_HEROES, ...FACTION_HEROES]

export const heroByIdV10 = (id: string): HeroDefinitionV10 | undefined =>
  HEROES_V10.find((hero) => hero.id === id)

export const heroDisplayNameV10 = (definition: HeroDefinitionV10, progress?: HeroProgressV10): string =>
  typeof progress?.customName === 'string' && progress.customName.trim() || definition.name
