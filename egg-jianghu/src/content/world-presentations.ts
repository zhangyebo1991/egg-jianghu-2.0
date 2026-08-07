export interface WorldPresentation {
  worldId: string
  latinName: string
  currencyName: string
  flavor: string
  stageNames: readonly string[]
}

// 江湖页的正式展示内容只负责文案，不参与存档、解锁或战斗计算。
const PRESENTATIONS: Record<string, WorldPresentation> = {
  world_01: {
    worldId: 'world_01',
    latinName: 'Niujia Village',
    currencyName: '牛家村通宝',
    flavor: '临安北望，牛家村里风雪夜。郭杨两家旧事自此而起，一卷江湖，由此开笔。',
    stageNames: ['风雪夜', '郭杨旧居', '牛家东渡', '曲三酒肆', '临安驿道', '金兵哨站', '穆家旧院', '青石长街', '归云前路', '牛家村口'],
  },
  world_02: {
    worldId: 'world_02',
    latinName: 'Jiaxing',
    currencyName: '嘉兴通宝',
    flavor: '南湖烟雨，醉仙楼上旧事如约。水陆码头鱼龙混杂，正是历练拳脚的好去处。',
    stageNames: ['南湖烟雨', '醉仙楼', '陆家庄门', '烟雨码头', '嘉兴旧桥', '莲花坞', '青石长街', '陆庄后院', '水路渡口', '嘉兴城楼'],
  },
  world_03: {
    worldId: 'world_03',
    latinName: 'Guiyun Manor',
    currencyName: '归云通宝',
    flavor: '太湖烟波归云庄，庄中藏龙卧虎。水陆并济之地，风波不问自来。',
    stageNames: ['太湖渡口', '归云庄门', '湖心小筑', '庄丁营地', '烟波旧桥', '桃花水榭', '铁掌外院', '水寨暗哨', '陆庄后山', '归云正厅'],
  },
  world_04: {
    worldId: 'world_04',
    latinName: 'Dali',
    currencyName: '大理通宝',
    flavor: '点苍洱海之间，段氏一阳指名动天南。茶花漫谷、佛影崇圣，然四大恶人匿迹于此，风波正酣。',
    stageNames: ['茶花巷', '洱海渡', '崇圣寺', '点苍麓', '万劫口', '天龙外院', '断肠崖', '镜湖庄', '恶人谷口', '皇城根'],
  },
  world_05: {
    worldId: 'world_05',
    latinName: 'Wuliang Mountain',
    currencyName: '无量通宝',
    flavor: '无量剑湖，玉壁月华。山中剑派争锋多年，湖底却另有乾坤。',
    stageNames: ['无量剑门', '剑湖渡口', '神农药圃', '万劫谷口', '玉壁月华', '崖间栈道', '剑阵石坪', '琅嬛福地', '无量后山', '无量山巅'],
  },
  world_06: {
    worldId: 'world_06',
    latinName: 'Fengling Ferry',
    currencyName: '风陵通宝',
    flavor: '风陵渡口，黄河夜渡。铁骑与侠影隔岸相望，一渡难求。',
    stageNames: ['风陵渡口', '黄河夜渡', '蒙古前哨', '万兽渡头', '丐帮分舵', '长亭风雪', '铁骑营门', '西山古道', '渡口烽台', '河岸关城'],
  },
  world_07: {
    worldId: 'world_07',
    latinName: 'Butterfly Valley',
    currencyName: '蝴蝶通宝',
    flavor: '蝶舞深谷，医仙旧居。谷中草木皆药，亦皆江湖。',
    stageNames: ['蝶谷入口', '药圃小径', '胡青牛居', '金花旧寨', '蝴蝶深处', '毒池石桥', '医庐后山', '谷中花海', '明教暗哨', '蝶谷深门'],
  },
  world_08: {
    worldId: 'world_08',
    latinName: 'Gusu',
    currencyName: '姑苏通宝',
    flavor: '姑苏城外，燕子坞里参合庄。吴侬软语间，藏着复国旧梦。',
    stageNames: ['姑苏水巷', '燕子坞门', '参合庄外', '太湖画舫', '曼陀山庄', '听香水榭', '慕容别院', '琴韵长廊', '燕坞后山', '参合正厅'],
  },
  world_09: {
    worldId: 'world_09',
    latinName: 'Juxian Manor',
    currencyName: '聚贤通宝',
    flavor: '聚贤庄上英雄宴，一杯断义酒，满城风雨来。',
    stageNames: ['聚贤庄门', '英雄宴席', '丐帮别院', '杏林药庐', '雁门来客', '群雄旧台', '豪杰长街', '庄外驿站', '聚贤后院', '英雄断义'],
  },
  world_10: {
    worldId: 'world_10',
    latinName: 'Leigu Mountain',
    currencyName: '擂鼓通宝',
    flavor: '擂鼓山上珍珑局，一子落错，满盘皆江湖。',
    stageNames: ['擂鼓山麓', '珍珑棋局', '星宿山门', '聪辩别院', '棋坪石阶', '无崖旧居', '星宿药圃', '山腰古亭', '聋哑谷口', '擂鼓峰顶'],
  },
}

const fallbackPresentation = (worldId: string): WorldPresentation => ({
  worldId,
  latinName: 'Jianghu',
  currencyName: '本卷通宝',
  flavor: '此卷风物尚待揭开，待侠者踏足其中。',
  stageNames: Array.from({ length: 10 }, (_, index) => `第${index + 1}关`),
})

export const worldPresentation = (worldId: string): WorldPresentation =>
  PRESENTATIONS[worldId] ?? fallbackPresentation(worldId)

export const WORLD_PRESENTATIONS = PRESENTATIONS
