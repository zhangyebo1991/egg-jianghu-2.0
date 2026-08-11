import {
  attributeEntries,
  mechanismNotes,
  openQuestions,
  type AttributeEntry,
  type MechanismNote,
  type OpenQuestion,
} from './research'

/**
 * 一个研究样本 = 一级 Tab。归属关系由包含结构表达，数据行不需要 subjectId。
 * 追加样本：新建内容文件 → 在 researchSubjects 加一项，渲染代码无需改动。
 */
export type ResearchSubject = {
  id: string
  label: string
  /** 档案编号，展示在紧凑头部。 */
  code: string
  attributes: AttributeEntry[]
  mechanismNotes: MechanismNote[]
  openQuestions: OpenQuestion[]
}

export const researchSubjects: ResearchSubject[] = [
  {
    id: 'zhutian',
    label: '诸天刷宝录',
    code: 'RESEARCH SEED / 01',
    attributes: attributeEntries,
    mechanismNotes,
    openQuestions,
  },
]
