import type { CareerCategory } from './careers'
import type { Rarity } from '../domain/types'

export interface FactionDefinition {
  id: string
  name: string
  category: CareerCategory
  worldId: string
  branchLabels: readonly [string, string]
}

const branchLabelsFor = (category: CareerCategory): readonly [string, string] => {
  if (category === '剑') return ['快剑', '重剑']
  if (category === '刀') return ['快刀', '狂刀']
  if (category === '拳') return ['刚拳', '绵掌']
  if (category === '暗') return ['影刺', '毒术']
  if (category === '医') return ['疗伤', '药理']
  return ['运气', '护体']
}

// id 保持稳定（武功 id、贡献、悬榜均以势力 id 为键），仅调整金庸门派名与类别。
export const FACTION_ROWS = [
  ['qingfeng_hall', '全真教', '剑', 'world_01'],
  ['tieyi_school', '丐帮', '拳', 'world_01'],
  ['renxin_hall', '桃花岛', '医', 'world_01'],
  ['duanlang_blade', '陆家庄', '刀', 'world_02'],
  ['yexing_tower', '白驼山', '暗', 'world_02'],
  ['guiyuan_manor', '古墓派', '内家', 'world_02'],
  ['tingyu_sword', '绝情谷', '刀', 'world_03'],
  ['feixing_dock', '万兽山庄', '暗', 'world_03'],
  ['tiaoxi_court', '全真教', '内家', 'world_03'],
  ['zhenyue_blade', '大理段氏', '内家', 'world_04'],
  ['mianshan_school', '天龙寺', '医', 'world_04'],
  ['baicao_hall', '四大恶人', '暗', 'world_04'],
  ['cangfeng_manor', '逍遥派', '内家', 'world_05'],
  ['hengjiang_blade', '灵鹫宫', '剑', 'world_05'],
  ['xinglin_valley', '万劫谷', '暗', 'world_05'],
  ['zhenshan_gate', '蒙古大营', '刀', 'world_06'],
  ['wuteng_stockade', '丐帮', '拳', 'world_06'],
  ['baoyuan_temple', '渔樵耕读', '医', 'world_06'],
  ['wanren_court', '明教', '拳', 'world_07'],
  ['juezong_gate', '武当', '内家', 'world_07'],
  ['jingmai_court', '峨眉', '剑', 'world_07'],
  ['shuofeng_blade', '少林', '拳', 'world_08'],
  ['huajin_hall', '逍遥派', '剑', 'world_08'],
  ['jingang_court', '大理段氏', '医', 'world_08'],
  ['tianxia_sword', '丐帮', '拳', 'world_09'],
  ['tongbi_society', '聪辩门下', '医', 'world_09'],
  ['zhoutian_sect', '渔樵耕读', '刀', 'world_09'],
  ['baizhan_blade', '灵鹫宫', '剑', 'world_10'],
  ['zhuiming_office', '星宿派', '暗', 'world_10'],
  ['qihuang_society', '姑苏慕容', '刀', 'world_10'],
] as const satisfies ReadonlyArray<readonly [string, string, CareerCategory, string]>

export const FACTIONS: FactionDefinition[] = FACTION_ROWS.map(
  ([id, name, category, worldId]) => ({ id, name, category, worldId, branchLabels: branchLabelsFor(category) }),
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
