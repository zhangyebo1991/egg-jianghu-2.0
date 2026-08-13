import { FACTIONS } from './factions'

export const PLANE_COUNT = 13
export const RELEASED_WORLD_COUNT = PLANE_COUNT
export const DIFFICULTY_COUNT = 10
export const STAGE_COUNT = 10

export interface WorldDefinition {
  id: string
  name: string
  index: number
  released: boolean
  currencyId: string
  factionIds: string[]
  stageIds: string[]
  stageNames: readonly string[]
  flavor: string
  latinName: string
  currencyName: string
}

interface PlaneSeed {
  name: string
  latinName: string
  currencyName: string
  flavor: string
  stageNames: readonly string[]
}

const PLANE_SEEDS: readonly PlaneSeed[] = [
  {
    name: '东汉三国',
    latinName: 'Eastern Han',
    currencyName: '汉末通宝',
    flavor: '烽火燃天地，英雄乱世争。三国风云起。',
    stageNames: ['黄巾起义', '联军讨董', '濮阳之战', '新野之战', '会师江夏', '刮骨疗毒', '败走麦城', '夷陵之战', '濡须口战', '六出祁山'],
  },
  {
    name: '武侠江湖',
    latinName: 'Wuxia Jianghu',
    currencyName: '江湖通宝',
    flavor: '江湖侠客影，仗剑走天涯。恩怨随风去。',
    stageNames: ['丐帮内乱', '聚义山庄', '少室山下', '巫山云雨', '绝情山谷', '华山崖壁', '雁门山麓', '西湖湖畔', '英雄大会', '海外孤岛'],
  },
  {
    name: '摸金盗墓',
    latinName: 'Tomb Raiders',
    currencyName: '摸金通宝',
    flavor: '摸金寻秘宝，古墓险中行。奇珍惊世现。',
    stageNames: ['东北深山', '太行秘穴', '流沙古墓', '海底墓葬', '湘西地宫', '云南虫谷', '巴蜀棺崖', '楼兰遗址', '秦岭古墓', '昆仑雪山'],
  },
  {
    name: '十字东征',
    latinName: 'Crusades',
    currencyName: '圣战通宝',
    flavor: '圣战硝烟漫，东征旗帜扬。骑士挥剑勇。',
    stageNames: ['尼西亚', '多里列', '安条克', '的黎波里', '开罗', '安卡拉', '阿克萨', '安提瓦利', '图尔库', '特拉布宗'],
  },
  {
    name: '聊斋志异',
    latinName: 'Liaozhai',
    currencyName: '聊斋通宝',
    flavor: '聊斋书异事，狐魅寄深情。夜话人心动。',
    stageNames: ['盂兰会', '上京路', '蓬莱岛', '黑风山', '鬼门关', '上清山', '青丘岭', '桃花谷', '罗刹海', '幽冥谷'],
  },
  {
    name: '东瀛战国',
    latinName: 'Sengoku',
    currencyName: '战国通宝',
    flavor: '武士刀光闪，诸侯战火纷。战国英魂在。',
    stageNames: ['桶狭间战', '川中岛战', '姉川合战', '三方原战', '长筱合战', '贱岳合战', '山崎合战', '长久手战', '关原合战', '大阪冬阵'],
  },
  {
    name: '二战风云',
    latinName: 'World War II',
    currencyName: '战火通宝',
    flavor: '硝烟弥四海，战火毁千州。勇士沙场战。',
    stageNames: ['闪击波兰', '敦刻尔克', '巴巴罗萨', '基辅战役', '列宁格勒', '斯大林格勒', '库尔斯克', '诺曼底', '阿登战役', '柏林战役'],
  },
  {
    name: '凡人修仙',
    latinName: 'Cultivation',
    currencyName: '修仙通宝',
    flavor: '凡心求仙道，仙路踏天行。逆命长生觅。',
    stageNames: ['青鸾仙岛', '苍云秘洞', '幽影魔林', '紫炎灵峰', '灵霄仙谷', '皓月天池', '玄冰剑冢', '炎阳圣地', '灵风峡谷', '翠羽仙林'],
  },
  {
    name: '星球战争',
    latinName: 'Star Wars',
    currencyName: '星际通宝',
    flavor: '星际硝烟起，正邪剑影纷。原力惊天地。',
    stageNames: ['阿德拉行星', '塞伦诺星', '维兰星', '泽洛斯星', '凯拉星', '奥瑞恩星', '菲尼克斯星', '塔尔西斯星', '艾瑞丹星', '伽马星'],
  },
  {
    name: '斗气大陆',
    latinName: 'Douqi Continent',
    currencyName: '斗气通宝',
    flavor: '斗气冲霄汉，豪情震八方。霸图强者路。',
    stageNames: ['焚炎谷', '寒霜岭', '雷陨崖', '风翔原', '灵木林', '暗魔窟', '金锐峰', '水泽湖', '岩罡山', '幻雾谷'],
  },
  {
    name: '艾泽大陆',
    latinName: 'Azeroth',
    currencyName: '艾泽通宝',
    flavor: '兽族雄心壮，联盟壮志昂。战场烽火烈。',
    stageNames: ['幽影裂谷', '熔火隘口', '霜语峰', '翡翠迷径', '虚空礁', '暮光圣所', '铁棘原', '星陨台', '潮汐深渊', '烬羽林'],
  },
  {
    name: '超级英雄',
    latinName: 'Superheroes',
    currencyName: '英雄通宝',
    flavor: '联盟豪杰聚，变种人威扬。守护苍生志。',
    stageNames: ['英雄集结', '超能觉醒', '无限序曲', '神域陨落', '内战裂痕', '量子狂潮', '终局计时', '烁灭回声', '终焉之战', '传奇不灭'],
  },
  {
    name: '西行之路',
    latinName: 'Journey West',
    currencyName: '西行通宝',
    flavor: '师徒西行去，妖魔阻路途。真经心所向。',
    stageNames: ['白马佛寺', '鹰渊化龙', '高家老庄', '流沙天河', '翠云焰窟', '积雷魔寨', '三幻尸丘', '火云妖市', '莲花魔炉', '小雷音寺'],
  },
]

export const WORLD_NAMES = PLANE_SEEDS.map((plane) => plane.name)

export const WORLDS: WorldDefinition[] = PLANE_SEEDS.map((plane, offset) => {
  const index = offset + 1
  const id = `world_${String(index).padStart(2, '0')}`
  return {
    id,
    name: plane.name,
    index,
    released: true,
    currencyId: id,
    factionIds: FACTIONS.filter((faction) => faction.worldId === id).map((faction) => faction.id),
    stageIds: Array.from({ length: STAGE_COUNT }, (_, stageOffset) => `${id}_stage_${String(stageOffset + 1).padStart(2, '0')}`),
    stageNames: plane.stageNames,
    flavor: plane.flavor,
    latinName: plane.latinName,
    currencyName: plane.currencyName,
  }
})

export const worldById = (id: string): WorldDefinition | undefined =>
  WORLDS.find((world) => world.id === id)

export const planeRecommendedPower = (worldIndex: number, difficulty: number): number =>
  Math.round(4000 * (1.35 ** Math.max(0, worldIndex - 1)) * (1.28 ** Math.max(0, difficulty - 1)))
