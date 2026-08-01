export type CareerTier = '初级' | '中级' | '高级' | '顶级'
export type CareerCategory = '剑' | '刀' | '拳' | '暗' | '医' | '内家'

export interface CareerDefinition {
  id: string
  name: string
  category: CareerCategory
  branch: string | null
  tier: CareerTier
  previousId: string | null
  nextId: string | null
}

const branch = (
  category: CareerCategory,
  branchName: string,
  names: [string, string, string],
  id: string,
): CareerDefinition[] => {
  const baseId = id.split('_')[0]
  return [
    {
      id: `${id}_mid`,
      name: names[0],
      category,
      branch: branchName,
      tier: '中级',
      previousId: baseId,
      nextId: `${id}_high`,
    },
    {
      id: `${id}_high`,
      name: names[1],
      category,
      branch: branchName,
      tier: '高级',
      previousId: `${id}_mid`,
      nextId: `${id}_top`,
    },
    {
      id: `${id}_top`,
      name: names[2],
      category,
      branch: branchName,
      tier: '顶级',
      previousId: `${id}_high`,
      nextId: null,
    },
  ]
}

export const CAREERS: CareerDefinition[] = [
  { id: 'sword', name: '剑客', category: '剑', branch: null, tier: '初级', previousId: null, nextId: null },
  { id: 'blade', name: '刀客', category: '刀', branch: null, tier: '初级', previousId: null, nextId: null },
  { id: 'fist', name: '拳师', category: '拳', branch: null, tier: '初级', previousId: null, nextId: null },
  { id: 'shadow', name: '暗客', category: '暗', branch: null, tier: '初级', previousId: null, nextId: null },
  { id: 'doctor', name: '医者', category: '医', branch: null, tier: '初级', previousId: null, nextId: null },
  { id: 'inner', name: '内家', category: '内家', branch: null, tier: '初级', previousId: null, nextId: null },
  ...branch('剑', '快剑', ['游剑客', '追风剑师', '无痕剑宗'], 'sword_swift'),
  ...branch('剑', '重剑', ['重剑客', '镇岳剑师', '玄铁剑宗'], 'sword_heavy'),
  ...branch('刀', '快刀', ['快刀客', '追魂刀师', '无影刀宗'], 'blade_swift'),
  ...branch('刀', '狂刀', ['狂刀客', '血战刀师', '百战刀宗'], 'blade_fury'),
  ...branch('拳', '刚拳', ['长拳师', '震山拳师', '通臂宗师'], 'fist_hard'),
  ...branch('拳', '绵掌', ['绵掌师', '化劲掌师', '化境宗师'], 'fist_soft'),
  ...branch('暗', '影刺', ['影客', '追命使', '无踪魁首'], 'shadow_assassin'),
  ...branch('暗', '毒术', ['毒手', '百毒使', '毒门魁首'], 'shadow_poison'),
  ...branch('医', '疗伤', ['仁心医士', '杏林圣手', '岐黄国手'], 'doctor_heal'),
  ...branch('医', '药理', ['调息医士', '经脉医师', '药王'], 'doctor_medicine'),
  ...branch('内家', '运气', ['运气士', '周天师', '气宗'], 'inner_flow'),
  ...branch('内家', '护体', ['护气士', '铁衣护法', '金刚宗师'], 'inner_guard'),
]

export const careerById = (id: string): CareerDefinition | undefined =>
  CAREERS.find((career) => career.id === id)
