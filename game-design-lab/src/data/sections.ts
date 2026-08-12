import type { ResearchCategory } from './research'

/** 二级 Tab 的内容入口标识：三个属性分类 + 技能图鉴 + 机制观察 + 待核验队列。 */
export type SectionId = ResearchCategory | 'codex' | 'mechanics' | 'questions'

export type SectionMeta = {
  id: SectionId
  label: string
  eyebrow: string
  description: string
  /** 强调色的 CSS 变量名，由组件注入 --tab-accent。 */
  accent: string
}

export const sectionMeta: SectionMeta[] = [
  {
    id: 'basic',
    label: '基础属性',
    eyebrow: 'FOUNDATION',
    description: '五项成长值与核心面板',
    accent: '--gold',
  },
  {
    id: 'combat',
    label: '战斗属性',
    eyebrow: 'COMBAT',
    description: '输出、防御、命中与循环',
    accent: '--orange',
  },
  {
    id: 'special',
    label: '特殊属性',
    eyebrow: 'SPECIAL',
    description: '召唤、标签与非战斗成长',
    accent: '--purple',
  },
  {
    id: 'codex',
    label: '技能图鉴',
    eyebrow: 'CODEX',
    description: '诸天刷宝录势力 / 技能 / 角色 / 物品',
    accent: '--green',
  },
  {
    id: 'mechanics',
    label: '机制观察',
    eyebrow: 'SYSTEM',
    description: '属性如何进入战斗结算',
    accent: '--cyan',
  },
  {
    id: 'questions',
    label: '待核验队列',
    eyebrow: 'VALIDATION',
    description: '不能当作硬编码规则的边界',
    accent: '--red',
  },
]

export const attributeSectionIds: ResearchCategory[] = ['basic', 'combat', 'special']

export function isAttributeSection(id: SectionId): id is ResearchCategory {
  return (attributeSectionIds as SectionId[]).includes(id)
}
