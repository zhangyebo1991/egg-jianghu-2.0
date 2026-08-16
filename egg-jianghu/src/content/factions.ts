import type { CareerCategory } from './careers'
import type { Rarity } from '../domain/types'
import { ORIGINAL_FACTIONS, ORIGINAL_PLAYER_SKILLS } from './original-progression.generated'

export interface FactionDefinition {
  id: string
  originalId: number
  name: string
  description: string
  category: CareerCategory
  worldId: string
  currencyKind: 'worldCurrency' | 'contribution'
  branchLabels: readonly [string, string]
  skillIds: readonly number[]
  requiredProgress: number
  /** 诸天技能组威力属性 id（sx153-194 段）。 */
  factionPowerSxId: number
}

// 复用既有 30 个内部键，保证侠客、悬榜和贡献引用仍落在原来的位面；
// 原版前三个位面各多出的第 4 个势力，以及第 11～13 位面，使用新增稳定键。
const LEGACY_FACTION_IDS_BY_WORLD: Readonly<Record<string, readonly string[]>> = {
  world_01: ['qingfeng_hall', 'tieyi_school', 'renxin_hall'],
  world_02: ['duanlang_blade', 'yexing_tower', 'guiyuan_manor'],
  world_03: ['tingyu_sword', 'feixing_dock', 'tiaoxi_court'],
  world_04: ['zhenyue_blade', 'mianshan_school', 'baicao_hall'],
  world_05: ['cangfeng_manor', 'hengjiang_blade', 'xinglin_valley'],
  world_06: ['zhenshan_gate', 'wuteng_stockade', 'baoyuan_temple'],
  world_07: ['wanren_court', 'juezong_gate', 'jingmai_court'],
  world_08: ['shuofeng_blade', 'huajin_hall', 'jingang_court'],
  world_09: ['tianxia_sword', 'tongbi_society', 'zhoutian_sect'],
  world_10: ['baizhan_blade', 'zhuiming_office', 'qihuang_society'],
}

const categoryByOriginalSkillCategory: Record<number, CareerCategory> = {
  1: '内家',
  2: '拳',
  3: '剑',
  4: '内家',
  5: '暗',
  6: '医',
  7: '刀',
  8: '内家',
  9: '刀',
  10: '剑',
  11: '内家',
  12: '内家',
  13: '暗',
  14: '暗',
  15: '内家',
  16: '医',
}

const factionIdFor = (originalId: number, worldId: string, positionInWorld: number): string =>
  LEGACY_FACTION_IDS_BY_WORLD[worldId]?.[positionInWorld]
  ?? `original_faction_${String(originalId).padStart(2, '0')}`

const worldOffsets = new Map<string, number>()

export const FACTIONS: FactionDefinition[] = ORIGINAL_FACTIONS.map((original) => {
  const worldId = `world_${String(original.worldIndex).padStart(2, '0')}`
  const positionInWorld = worldOffsets.get(worldId) ?? 0
  worldOffsets.set(worldId, positionInWorld + 1)
  const firstSkill = ORIGINAL_PLAYER_SKILLS.find((skill) => skill.id === original.skillIds[0])
  return {
    id: factionIdFor(original.id, worldId, positionInWorld),
    originalId: original.id,
    name: original.name,
    description: original.description,
    category: categoryByOriginalSkillCategory[firstSkill?.skillCategory ?? 1] ?? '内家',
    worldId,
    currencyKind: original.currencyKind,
    branchLabels: ['一脉', '二脉'],
    skillIds: original.skillIds,
    requiredProgress: original.requiredProgress,
    factionPowerSxId: 152 + original.id,
  }
})

// 仅供仍使用“每卷稀有度预算”的旧内容读取；原版 269 技能直接使用 jn 难度阶级。
export const RARITY_BUDGET_BY_WORLD: Record<string, readonly Rarity[]> = Object.fromEntries(
  Array.from({ length: 13 }, (_, offset) => {
    const worldId = `world_${String(offset + 1).padStart(2, '0')}`
    return [worldId, ['粗浅', '粗浅', '寻常', '寻常', '精妙', '精妙', '上乘', '绝学'] as const]
  }),
)

export const factionById = (id: string): FactionDefinition | undefined =>
  FACTIONS.find((faction) => faction.id === id)

export const factionByOriginalId = (id: number): FactionDefinition | undefined =>
  FACTIONS.find((faction) => faction.originalId === id)
