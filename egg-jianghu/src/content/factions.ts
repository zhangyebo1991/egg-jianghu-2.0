import type { CareerCategory } from './careers'
import type { Rarity } from '../domain/types'

export interface FactionDefinition {
  id: string
  name: string
  category: CareerCategory
  worldId: string
  branchLabels: readonly [string, string]
}

export const FACTION_ROWS = [
  ['qingfeng_hall', '青锋馆', '剑', 'world_01', ['快剑', '重剑']],
  ['tieyi_school', '铁衣武馆', '拳', 'world_01', ['刚拳', '绵掌']],
  ['renxin_hall', '仁心堂', '医', 'world_01', ['疗伤', '药理']],
  ['duanlang_blade', '断浪刀门', '刀', 'world_02', ['快刀', '狂刀']],
  ['yexing_tower', '夜行楼', '暗', 'world_02', ['影刺', '毒术']],
  ['guiyuan_manor', '归元庄', '内家', 'world_02', ['运气', '护体']],
  ['tingyu_sword', '听雨剑庐', '剑', 'world_03', ['快剑', '重剑']],
  ['feixing_dock', '飞星坞', '暗', 'world_03', ['影刺', '毒术']],
  ['tiaoxi_court', '调息院', '内家', 'world_03', ['运气', '护体']],
  ['zhenyue_blade', '镇岳刀馆', '刀', 'world_04', ['快刀', '狂刀']],
  ['mianshan_school', '绵山武院', '拳', 'world_04', ['刚拳', '绵掌']],
  ['baicao_hall', '百草堂', '医', 'world_04', ['疗伤', '药理']],
  ['cangfeng_manor', '藏锋山庄', '剑', 'world_05', ['快剑', '重剑']],
  ['hengjiang_blade', '横江刀会', '刀', 'world_05', ['快刀', '狂刀']],
  ['xinglin_valley', '杏林谷', '医', 'world_05', ['疗伤', '药理']],
  ['zhenshan_gate', '震山门', '拳', 'world_06', ['刚拳', '绵掌']],
  ['wuteng_stockade', '乌藤寨', '暗', 'world_06', ['影刺', '毒术']],
  ['baoyuan_temple', '抱元观', '内家', 'world_06', ['运气', '护体']],
  ['wanren_court', '万仞剑庭', '剑', 'world_07', ['快剑', '重剑']],
  ['juezong_gate', '绝踪门', '暗', 'world_07', ['影刺', '毒术']],
  ['jingmai_court', '经脉院', '医', 'world_07', ['疗伤', '药理']],
  ['shuofeng_blade', '朔风刀盟', '刀', 'world_08', ['快刀', '狂刀']],
  ['huajin_hall', '化劲堂', '拳', 'world_08', ['刚拳', '绵掌']],
  ['jingang_court', '金刚院', '内家', 'world_08', ['运气', '护体']],
  ['tianxia_sword', '天下剑盟', '剑', 'world_09', ['快剑', '重剑']],
  ['tongbi_society', '通臂会', '拳', 'world_09', ['刚拳', '绵掌']],
  ['zhoutian_sect', '周天宗', '内家', 'world_09', ['运气', '护体']],
  ['baizhan_blade', '百战刀宗', '刀', 'world_10', ['快刀', '狂刀']],
  ['zhuiming_office', '追命司', '暗', 'world_10', ['影刺', '毒术']],
  ['qihuang_society', '岐黄会', '医', 'world_10', ['疗伤', '药理']],
] as const satisfies ReadonlyArray<readonly [string, string, CareerCategory, string, readonly [string, string]]>

export const FACTIONS: FactionDefinition[] = FACTION_ROWS.map(
  ([id, name, category, worldId, branchLabels]) => ({ id, name, category, worldId, branchLabels }),
)

export const RARITY_BUDGET_BY_WORLD: Record<string, readonly Rarity[]> = {
  world_01: ['粗浅', '粗浅', '粗浅', '粗浅', '粗浅', '寻常', '寻常', '寻常'],
  world_02: ['粗浅', '粗浅', '粗浅', '粗浅', '粗浅', '寻常', '寻常', '寻常'],
  world_03: ['粗浅', '粗浅', '寻常', '寻常', '寻常', '寻常', '精妙', '精妙'],
  world_04: ['粗浅', '粗浅', '寻常', '寻常', '寻常', '寻常', '精妙', '精妙'],
  world_05: ['寻常', '寻常', '精妙', '精妙', '精妙', '精妙', '上乘', '上乘'],
  world_06: ['寻常', '寻常', '精妙', '精妙', '精妙', '精妙', '上乘', '上乘'],
  world_07: ['精妙', '精妙', '上乘', '上乘', '上乘', '上乘', '绝学', '绝学'],
  world_08: ['精妙', '精妙', '上乘', '上乘', '上乘', '上乘', '绝学', '绝学'],
  world_09: ['上乘', '上乘', '绝学', '绝学', '绝学', '绝学', '绝学', '绝学'],
  world_10: ['上乘', '上乘', '绝学', '绝学', '绝学', '绝学', '绝学', '绝学'],
}

export const factionById = (id: string): FactionDefinition | undefined =>
  FACTIONS.find((faction) => faction.id === id)
