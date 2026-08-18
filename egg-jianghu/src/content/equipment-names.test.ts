import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_DEFINITIONS,
  COMBAT_EQUIPMENT_SLOTS,
  EQUIPMENT_QUALITIES,
  EQUIPMENT_STYLE_FAMILIES,
  combatDifficultyCoefficient,
  equipmentIdBySlot,
  equipmentPoolForStage,
  equipmentPoolForWorld,
  equipmentSetNameForStage,
  equipmentSetPoolForStage,
  equipmentDisplayName,
  equipmentWearLevel,
  originalStageId,
  planeBaseItemLevel,
  rollEquipmentLevel,
} from './equipment'
import { ATTRIBUTE_BY_ID } from './attributes'
import { WORLDS } from './worlds'

const EXPECTED_SET_NAMES = [
  ['鬼谋', '闭月', '辕门', '洛神', '铜雀', '悬壶', '忠义', '先登', '陷阵', '奇门'],
  ['浮华', '桃花', '金刚', '巫山', '古墓', '剑势', '武林', '外功', '内劲', '江湖'],
  ['雷暴', '石像', '避祸', '力士', '枯木', '道人', '校尉', '阴阳', '兵俑', '昆仑'],
  ['古籍', '主教', '雷霆', '骑兵', '刺客', '魔力', '沙漠', '狩猎', '神灯', '领主'],
  ['冤魂', '连城', '侠义', '书生', '无声', '相思', '唤灵', '飞羽', '罗刹', '绛雪'],
  ['铁炮', '剑客', '月读', '吸血', '茨木', '恶鬼', '天狗', '武士', '西洋', '晴明'],
  ['步兵', '信念', '炮兵', '瞄准', '医疗', '投掷', '冬季', '工兵', '指挥', '胜利'],
  ['真气', '绝命', '咒法', '因果', '入道', '金丹', '长生', '灵法', '超凡', '仙缘'],
  ['探索', '生存', '狡诈', '机械', '走私', '佣兵', '流浪', '仇恨', '愤怒', '恐惧'],
  ['万卷', '仙途', '杀戮', '万物', '苍生', '器师', '燃月', '斗者', '终末', '龙魂'],
  ['野性', '魔能', '泰坦', '战歌', '天启', '翡翠', '潮汐', '风行', '铁誓', '狼性'],
  ['钢骨', '炽魂', '雷怒', '魂狩', '魂击', '终焉', '日蚀', '亲和', '王权', '变种'],
  ['济世', '炽血', '赤煞', '御雷', '灵枢', '渡厄', '灵泉', '烬灭', '震穹', '佛光'],
] as const

const HUANGJIN_ORDINARY = ['铁爪', '皮帽', '项链', '文卷', '布帽', '护符', '长戟', '头盔', '铁甲', '长弓', '皮甲', '戒指', '古剑', '长衫', '扳指']

const BANNED_DROP_NAMES = ['柴刀', '屠龙宝刀', '祝融灵珠', '小李飞刀', '天公法杖']

describe('诸天装备表', () => {
  it('13 个位面掉落池均覆盖八部位且不含金庸旧名与探索具名装', () => {
    for (const world of WORLDS) {
      const pool = equipmentPoolForWorld(world.id)
      expect(pool.length, `${world.id} 掉落池为空`).toBeGreaterThan(0)
      for (const slot of COMBAT_EQUIPMENT_SLOTS) {
        expect(pool.some((item) => item.slot === slot), `${world.id} 缺 ${slot}`).toBe(true)
      }
      for (const name of BANNED_DROP_NAMES) {
        expect(pool.some((item) => item.name === name), `${world.id} 不应掉 ${name}`).toBe(false)
      }
      for (let stage = 1; stage <= 10; stage += 1) {
        const stagePool = equipmentPoolForStage(world.id, stage)
        expect(stagePool.length, `${world.id}:${stage} 地点普通池为空`).toBeGreaterThan(0)
        for (const name of BANNED_DROP_NAMES) {
          expect(stagePool.some((item) => item.name === name), `${world.id}:${stage} 不应掉 ${name}`).toBe(false)
        }
      }
    }
  })

  it('战斗池只用普通底模，且六风格族都有货', () => {
    const basics = [...new Map(WORLDS.flatMap((world) => equipmentPoolForWorld(world.id)).map((item) => [item.id, item])).values()]
    expect(basics).toHaveLength(186)
    expect(basics.every((item) => item.rarity === '普通')).toBe(true)
    expect(basics.some((item) => item.name === '铁爪')).toBe(true)
    expect(basics.some((item) => item.name === '长戟')).toBe(true)
    for (const family of EQUIPMENT_STYLE_FAMILIES) {
      expect(basics.filter((item) => item.styleFamily === family)).toHaveLength(31)
    }
  })

  it('黄巾起义地点套为鬼谋文卷与符箓，展示名为鬼谋·底名', () => {
    const pool = equipmentSetPoolForStage('world_01', 1)
    expect(pool.map((item) => `${item.setName}·${item.name}`)).toEqual(['鬼谋·文卷', '鬼谋·符箓'])
    expect(equipmentDisplayName(pool[0])).toBe('鬼谋·文卷')
  })

  it('130 关地点套装与 sq.col8→dl 两件套一致', () => {
    const setItems = EQUIPMENT_DEFINITIONS.filter((item) => item.setName)
    expect(setItems).toHaveLength(260)
    expect(setItems.every((item) => item.fixedQuality === 5)).toBe(true)
    for (const world of WORLDS) {
      const worldIndex = Number(world.id.replace(/\D/g, ''))
      for (let stage = 1; stage <= 10; stage += 1) {
        expect(equipmentSetNameForStage(world.id, stage)).toBe(EXPECTED_SET_NAMES[worldIndex - 1][stage - 1])
        expect(equipmentSetPoolForStage(world.id, stage)).toHaveLength(2)
      }
    }
  })

  it('黄巾起义普通池为 sq 列 1–5 的 dl 底模，不含联军讨董的铁盾', () => {
    const pool = equipmentPoolForStage('world_01', 1)
    expect(pool.map((item) => item.name).sort()).toEqual([...HUANGJIN_ORDINARY].sort())
    expect(pool.some((item) => item.name === '铁盾')).toBe(false)
    expect(equipmentSetNameForStage('world_02', 1)).toBe('浮华')
    expect(equipmentSetNameForStage('world_03', 1)).toBe('雷暴')
    expect(equipmentSetNameForStage('world_11', 1)).toBe('野性')
  })

  it('词条用诸天 sx 名，不含旧蛋蛋江湖词', () => {
    const attributeIds = [...new Set(EQUIPMENT_DEFINITIONS.flatMap((item) => item.affixPool))]
    const names = attributeIds.map((id) => ATTRIBUTE_BY_ID[id]?.name)
    expect(names).not.toContain('行气')
    expect(names).not.toContain('外功')
    expect(names).not.toContain('会心')
    expect(names).not.toContain('气血')
    expect(names).toContain('技能冷却')
    expect(names).toContain('土系增伤')
    expect(names).toContain('物攻')
    expect(attributeIds.every((id) => id >= 6 && id <= 59)).toBe(true)
  })

  it('所有可掉落装备都有两条核心和对应类型的加权词条池', () => {
    const droppable = [...new Map(WORLDS.flatMap((world) => [
      ...equipmentPoolForWorld(world.id),
      ...world.stageIds.flatMap((_, index) => equipmentSetPoolForStage(world.id, index + 1)),
    ]).map((item) => [item.id, item])).values()]
    expect(droppable.every((item) => item.coreStats.length === 2)).toBe(true)
    expect(droppable.every((item) => item.affixPool.length > 0)).toBe(true)
    expect(EQUIPMENT_DEFINITIONS.find((item) => item.id === 'wp_257')?.coreStats).toEqual([
      { attributeId: 8, baseCoefficient: 220 },
      { attributeId: 20, baseCoefficient: 100 },
    ])
    expect(EQUIPMENT_DEFINITIONS.find((item) => item.id === 'wp_123')?.coreStats).toEqual([
      { attributeId: 8, baseCoefficient: 40 },
      { attributeId: 19, baseCoefficient: 200 },
    ])
  })

  it('中式古代武器样本为长戟', () => {
    expect(equipmentIdBySlot('weapon')).toBe('wp_101')
    expect(EQUIPMENT_DEFINITIONS.find((item) => item.id === 'wp_101')?.name).toBe('长戟')
  })

  it('物品等级只走装备装等计算，位面差异由 sq 全局地点编号承载', () => {
    // 普通物品等级只管材料，装备不走这条链路
    expect(planeBaseItemLevel(1)).toBe(5)
    expect(planeBaseItemLevel(2)).toBe(25)
    // 地点编号是 sq 总表全局编号：位面 1 占 1-10，位面 2 占 11-20
    expect(originalStageId(1, 1)).toBe(1)
    expect(originalStageId(1, 10)).toBe(10)
    expect(originalStageId(2, 1)).toBe(11)
    expect(originalStageId(13, 10)).toBe(130)
    expect(combatDifficultyCoefficient(1, 1)).toBe(1)
    expect(combatDifficultyCoefficient(1, 10)).toBe(91)
    // 原版实测样本：东汉三国「黄巾起义」难度 1，4 阶装备 → 物品等级 7、Lv1 可装备
    expect(rollEquipmentLevel('world_01', 1, 1, 4)).toBe(7)
    expect(equipmentWearLevel(7, 4)).toBe(1)
    expect(rollEquipmentLevel('world_01', 1, 1, 1)).toBe(1)
    expect(rollEquipmentLevel('world_01', 1, 10, 1)).toBe(10)
    expect(rollEquipmentLevel('world_02', 1, 1, 1)).toBe(11)
    expect(rollEquipmentLevel('world_01', 2, 1, 1)).toBe(11)
    expect(rollEquipmentLevel('world_13', 10, 10, 1)).toBe(220)
  })

  it('穿戴等级是装备装等计算的逆运算，只吃物品等级与品质', () => {
    // 原版 `装备穿戴等级function` 通用分支：round(clamp(物品等级-(物品品质-1)*2, 1))
    expect(equipmentWearLevel(10, 1)).toBe(10)
    expect(equipmentWearLevel(10, 0)).toBe(12)
    expect(equipmentWearLevel(20, 5)).toBe(12)
    // 下限 clamp 到 1，不会出现 0 或负数门槛
    expect(equipmentWearLevel(14, 9)).toBe(1)
    expect(equipmentWearLevel(1, 9)).toBe(1)
    expect(equipmentWearLevel(3, 9)).toBe(1)
  })

  it('同一位面同一地点掉落的装备，穿戴等级与品质无关', () => {
    // 品质只抬物品等级；扣回品质加成后落回同一基础难度等级。
    const wearLevels = EQUIPMENT_QUALITIES.map((quality) =>
      equipmentWearLevel(rollEquipmentLevel('world_01', 1, 1, quality), quality))
    expect(new Set(wearLevels).size).toBe(1)
    expect(wearLevels[0]).toBe(1)
  })

  it('展示名按诸天规则拼接词条前缀与底名', () => {
    const claw = EQUIPMENT_DEFINITIONS.find((item) => item.id === 'wp_102')
    const halberd = EQUIPMENT_DEFINITIONS.find((item) => item.id === 'wp_101')
    expect(claw?.name).toBe('铁爪')
    expect(equipmentDisplayName(claw!, [{ attributeId: 52 }])).toBe('大地的铁爪')
    expect(equipmentDisplayName(halberd!)).toBe('勇士的长戟')
    expect(equipmentDisplayName(halberd!, [{ attributeId: 48 }, { attributeId: 20 }])).toBe('火山的长戟')
  })
})
