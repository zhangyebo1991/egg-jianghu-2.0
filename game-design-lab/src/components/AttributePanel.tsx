import { useMemo, useState } from 'react'
import AttributeList from './AttributeList'
import AttributeDetail from './AttributeDetail'
import EvidenceLegend from './EvidenceLegend'
import { sectionMeta } from '../data/sections'
import type { ResearchCategory, AttributeEntry } from '../data/research'
import type { ResearchSubject } from '../data/subjects'

/**
 * 当前样本内属性分组的展示顺序。
 * 若后续样本的分组体系不同，把它移入 ResearchSubject。
 */
const groupOrder = [
  '五项成长值',
  '基础战斗面板',
  '成长修正',
  '输出词条',
  '防御与生存',
  '命中与易伤',
  '技能循环',
  '元素词条',
  '技能类别',
  '武器掌握',
  '战斗隐藏',
  '技能被动',
  '势力技能组',
  '公式输入项',
  '召唤属性',
  '技能标签',
  '经营能力',
  '工作加成',
  '非战斗与成长',
  '经营与刷宝',
  '系统来源',
]

type Props = {
  subject: ResearchSubject
  sectionId: ResearchCategory
}

export default function AttributePanel({ subject, sectionId }: Props) {
  const sectionEntries = useMemo(
    () => subject.attributes.filter((entry) => entry.category === sectionId),
    [subject, sectionId],
  )

  const [selectedId, setSelectedId] = useState(sectionEntries[0]?.id ?? '')
  const [search, setSearch] = useState('')

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return sectionEntries

    return sectionEntries.filter((entry) =>
      [entry.name, entry.summary, entry.impact, entry.designValue, entry.group, ...entry.tags]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [sectionEntries, search])

  const selectedEntry =
    filteredEntries.find((entry) => entry.id === selectedId) ?? filteredEntries[0] ?? sectionEntries[0]

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, AttributeEntry[]>()

    for (const entry of filteredEntries) {
      const entries = groups.get(entry.group) ?? []
      entries.push(entry)
      groups.set(entry.group, entries)
    }

    return [...groups.entries()].sort(
      ([groupA], [groupB]) => groupOrder.indexOf(groupA) - groupOrder.indexOf(groupB),
    )
  }, [filteredEntries])

  const section = sectionMeta.find((item) => item.id === sectionId) ?? sectionMeta[0]

  return (
    <div className="workbench-section">
      <aside className="workbench-sidebar">
        <EvidenceLegend />
      </aside>

      <AttributeList
        section={section}
        groupedEntries={groupedEntries}
        matchCount={filteredEntries.length}
        selectedId={selectedEntry?.id ?? ''}
        onSelect={setSelectedId}
        search={search}
        onSearchChange={setSearch}
      />

      {selectedEntry && <AttributeDetail entry={selectedEntry} />}
    </div>
  )
}
