import type { EquipmentSlot } from './equipment'

export type WorldEquipmentNames = Record<EquipmentSlot, string>

export const EQUIPMENT_NAMES_BY_WORLD: Record<string, WorldEquipmentNames> = {
  world_01: { weapon: '柴刀', offhand: '柳条盾', head: '斗笠', armor: '粗布短衣', wrist: '裹腕麻布', boots: '芒鞋', necklace: '草绳项链', ring: '村口铜戒' },
  world_02: { weapon: '铁尺', offhand: '铁面盾', head: '毡帽', armor: '蓝布长衫', wrist: '藤护腕', boots: '皂靴', necklace: '铜钱项链', ring: '商铺银戒' },
  world_03: { weapon: '铁桨', offhand: '水寨藤牌', head: '竹笠', armor: '水靠', wrist: '铜钉护腕', boots: '快靴', necklace: '蚌珠项链', ring: '水纹戒指' },
  world_04: { weapon: '鎏金长剑', offhand: '金缕盾', head: '束发金冠', armor: '织锦战袍', wrist: '鎏金护腕', boots: '云头靴', necklace: '段家佛珠', ring: '段家金戒' },
  world_05: { weapon: '无量剑', offhand: '无量剑鞘', head: '束发青巾', armor: '玄青剑袍', wrist: '青藤护腕', boots: '麻线布靴', necklace: '无量玉坠', ring: '无量指环' },
  world_06: { weapon: '雁翎刀', offhand: '渡口皮盾', head: '风帽', armor: '羊皮袄', wrist: '牛皮护腕', boots: '厚底皮靴', necklace: '渡口骨链', ring: '渡船铜戒' },
  world_07: { weapon: '金针', offhand: '药师手盾', head: '葛布头巾', armor: '青布药袍', wrist: '蝶翼护腕', boots: '软底布鞋', necklace: '蝶蛹项链', ring: '药王戒指' },
  world_08: { weapon: '玉骨折扇', offhand: '慕容锦盾', head: '织金抹额', armor: '锦缎长袍', wrist: '银丝护腕', boots: '绣花软靴', necklace: '珍珠项链', ring: '慕容玉戒' },
  world_09: { weapon: '虎头刀', offhand: '虎头盾', head: '英雄巾', armor: '熟铜甲', wrist: '铁鳞护腕', boots: '铁皮战靴', necklace: '虎牙项链', ring: '聚贤铁戒' },
  world_10: { weapon: '玄铁棋剑', offhand: '玄铁盾', head: '逍遥巾', armor: '星辰道袍', wrist: '星纹护腕', boots: '凌云靴', necklace: '星辰项链', ring: '棋局玉戒' },
}

// 纯函数：名字是 (worldId, slot) 的确定性函数；缺表返回 undefined 由调用方兜底
export const equipmentName = (worldId: string, slot: EquipmentSlot): string | undefined =>
  EQUIPMENT_NAMES_BY_WORLD[worldId]?.[slot]
