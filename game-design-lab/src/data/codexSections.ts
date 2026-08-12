/** 技能图鉴内部子入口（在 CodexPanel 内部切换，不进 hash 路由）。 */

export type CodexSectionId = 'factions' | 'skills' | 'characters' | 'passives' | 'items'

export const CODEX_SECTIONS: { id: CodexSectionId; label: string; eyebrow: string; accent: string }[] = [
  { id: 'factions', label: '势力技能', eyebrow: 'FACTIONS', accent: '--gold' },
  { id: 'skills', label: '全技能', eyebrow: 'SKILLS', accent: '--cyan' },
  { id: 'characters', label: '角色', eyebrow: 'CHARACTERS', accent: '--purple' },
  { id: 'passives', label: '通用被动', eyebrow: 'PASSIVES', accent: '--orange' },
  { id: 'items', label: '物品', eyebrow: 'ITEMS', accent: '--red' },
]
