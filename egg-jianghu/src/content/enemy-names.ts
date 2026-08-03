import type { CombatRank } from '../combat/types'

export interface WorldEnemyNames {
  normal: readonly string[]
  elite: readonly string[]
  bosses: readonly string[]
}

export const ENEMY_NAMES_BY_WORLD: Record<string, WorldEnemyNames> = {
  world_01: {
    normal: ['村中泼皮', '无赖闲汉', '偷鸡贼', '地痞', '愣头青', '赶集莽汉'],
    elite: ['护院拳师', '金兵什长', '回乡兵痞'],
    bosses: ['段天德', '完颜洪烈', '梁子翁', '灵智上人', '侯通海', '沙通天', '彭连虎', '欧阳克', '梅超风', '曲灵风'],
  },
  world_02: {
    normal: ['市井闲汉', '茶楼伙计', '码头力工', '巡街差役', '鱼市恶霸', '无赖打手'],
    elite: ['醉仙楼护院', '武馆教头', '烟雨楼剑客'],
    bosses: ['张阿生', '韩小莹', '全金发', '南希仁', '韩宝驹', '朱聪', '柯镇恶', '丘处机', '王处一', '马钰'],
  },
  world_03: {
    normal: ['太湖水匪', '划船喽啰', '庄丁', '瞭哨水贼', '搬货苦力', '帮闲'],
    elite: ['水寨头目', '铁掌帮众', '太湖悍匪'],
    bosses: ['陆冠英', '陆乘风', '裘千丈', '陈玄风', '裘千仞', '傻姑', '黄蓉', '周伯通', '程英', '黄药师'],
  },
  world_04: {
    normal: ['巡城卫兵', '段府家丁', '街市闲汉', '白族猎户', '酒肆小二', '捕快'],
    elite: ['御林侍卫', '段家武士', '天龙寺武僧'],
    bosses: ['朱子柳', '武三通', '点苍渔隐', '樵子', '木婉清', '段正淳', '段延庆', '段正明', '枯荣大师', '段智兴'],
  },
  world_05: {
    normal: ['无量剑弟子', '采药人', '神农帮众', '猎户', '山贼', '樵夫'],
    elite: ['无量剑护法', '神农帮副帮主', '剑阵弟子'],
    bosses: ['左子穆', '辛双清', '干光豪', '葛光佩', '司空玄', '钟灵', '段誉', '秦红棉', '李秋水', '天山童姥'],
  },
  world_06: {
    normal: ['渡口船夫', '赶路镖客', '落魄刀客', '更夫', '江湖散人', '驿卒'],
    elite: ['万兽庄驯兽手', '蒙古斥候', '西山夜行客'],
    bosses: ['大头鬼', '催命鬼', '吊死鬼', '史伯威', '史仲猛', '史叔刚', '郭襄', '小龙女', '金轮法王', '神雕大侠'],
  },
  world_07: {
    normal: ['采药童子', '药圃花匠', '谷中仆役', '病愈游侠', '采蜜人', '杂役'],
    elite: ['毒王弟子', '药王侍童', '金花教众'],
    bosses: ['常遇春', '胡青牛', '王难姑', '殷离', '说不得', '周颠', '彭莹玉', '金花婆婆', '韦一笑', '张无忌'],
  },
  world_08: {
    normal: ['燕子坞家丁', '画舫船娘', '市井乞儿', '茶楼歌女', '琴师', '卖花郎'],
    elite: ['参合庄剑侍', '曼陀山庄侍女', '慕容家武士'],
    bosses: ['包不同', '风波恶', '阿碧', '阿朱', '公冶乾', '邓百川', '王语嫣', '王夫人', '鸠摩智', '慕容博'],
  },
  world_09: {
    normal: ['庄中客卿', '江湖豪客', '走镖镖师', '账房先生', '看门力士', '比武闲汉'],
    elite: ['聚贤庄护法', '游氏家将', '武林成名客'],
    bosses: ['谭婆', '谭公', '赵钱孙', '单正', '薛慕华', '游驹', '游骥', '全冠清', '徐长老', '萧峰'],
  },
  world_10: {
    normal: ['星宿派弟子', '守山力士', '持棋道童', '采芝人', '看棋老仆', '星宿小徒'],
    elite: ['星宿护法', '聪辩先生门人', '珍珑守阵人'],
    bosses: ['摘星子', '摩云子', '出尘子', '玄难', '玄寂', '虚竹', '苏星河', '丁春秋', '慕容复', '无崖子'],
  },
}

const fallbackName = (rank: CombatRank, stage: number): string => {
  if (rank === 'boss') return `第${stage}关首领`
  if (rank === 'elite') return `第${stage}关精英`
  return `第${stage}关敌手`
}

export const enemyName = (worldId: string, rank: CombatRank, stage: number, index: number): string => {
  const names = ENEMY_NAMES_BY_WORLD[worldId]
  if (!names) return fallbackName(rank, stage)
  if (rank === 'boss') {
    const bossIndex = Math.max(0, Math.min(stage - 1, names.bosses.length - 1))
    return names.bosses[bossIndex] ?? fallbackName(rank, stage)
  }
  if (rank === 'elite') {
    if (names.elite.length === 0) return fallbackName(rank, stage)
    return names.elite[(stage - 1) % names.elite.length]
  }
  if (names.normal.length === 0) return fallbackName(rank, stage)
  return names.normal[(Math.max(1, index) - 1) % names.normal.length]
}

export const enemyDisplayName = (enemyId: string): string => {
  const match = enemyId.match(/^world_(\d+)_stage_(\d+)_(normal|elite|boss)(?:_(\d+))?$/)
  if (!match) return '未知目标'
  const worldId = `world_${match[1]}`
  const stage = Number(match[2])
  const rank = match[3] as CombatRank
  const index = rank === 'boss' ? 1 : Number(match[4] ?? '1')
  return enemyName(worldId, rank, stage, index)
}
