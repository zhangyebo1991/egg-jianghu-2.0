import type { EquipmentSlot } from './equipment'

export type WorldEquipmentNames = Record<EquipmentSlot, string>

export const EQUIPMENT_NAMES_BY_WORLD: Record<string, WorldEquipmentNames> = {
  world_01: { weapon: '柴刀', head: '斗笠', armor: '粗布短衣', wrist: '裹腕麻布', waist: '系腰草绳', boots: '芒鞋', token: '半枚玉佩' },
  world_02: { weapon: '铁尺', head: '毡帽', armor: '蓝布长衫', wrist: '藤护腕', waist: '铜扣腰带', boots: '皂靴', token: '烟雨楼诗笺' },
  world_03: { weapon: '铁桨', head: '竹笠', armor: '水靠', wrist: '铜钉护腕', waist: '鲨皮腰扣', boots: '快靴', token: '水寨令牌' },
  world_04: { weapon: '鎏金长剑', head: '束发金冠', armor: '织锦战袍', wrist: '鎏金护腕', waist: '玉带', boots: '云头靴', token: '段家腰牌' },
  world_05: { weapon: '无量剑', head: '束发青巾', armor: '玄青剑袍', wrist: '青藤护腕', waist: '乌木腰带', boots: '麻线布靴', token: '琅嬛玉简' },
  world_06: { weapon: '雁翎刀', head: '风帽', armor: '羊皮袄', wrist: '牛皮护腕', waist: '褡裢', boots: '厚底皮靴', token: '渡船腰牌' },
  world_07: { weapon: '金针', head: '葛布头巾', armor: '青布药袍', wrist: '蝶翼护腕', waist: '药香囊', boots: '软底布鞋', token: '青蝶令牌' },
  world_08: { weapon: '玉骨折扇', head: '织金抹额', armor: '锦缎长袍', wrist: '银丝护腕', waist: '苏绣腰带', boots: '绣花软靴', token: '参合玉令' },
  world_09: { weapon: '虎头刀', head: '英雄巾', armor: '熟铜甲', wrist: '铁鳞护腕', waist: '犀角带', boots: '铁皮战靴', token: '聚贤令' },
  world_10: { weapon: '玄铁棋剑', head: '逍遥巾', armor: '星辰道袍', wrist: '星纹护腕', waist: '银星腰带', boots: '凌云靴', token: '珍珑棋谱' },
}

// 纯函数：名字是 (worldId, slot) 的确定性函数；缺表返回 undefined 由调用方兜底
export const equipmentName = (worldId: string, slot: EquipmentSlot): string | undefined =>
  EQUIPMENT_NAMES_BY_WORLD[worldId]?.[slot]
