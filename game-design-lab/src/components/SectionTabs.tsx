import TabList, { type TabItem } from './TabList'
import { sectionMeta, type SectionId } from '../data/sections'
import { codexStats } from '../data/codex'
import type { ResearchSubject } from '../data/subjects'

type Props = {
  subject: ResearchSubject
  activeId: SectionId
  onSelect: (id: SectionId) => void
  panelId: string
}

export default function SectionTabs({ subject, activeId, onSelect, panelId }: Props) {
  const tabs: TabItem[] = sectionMeta.map((section) => ({
    id: section.id,
    label: section.label,
    eyebrow: section.eyebrow,
    accent: section.accent,
    count: countFor(section.id, subject),
  }))

  return (
    <TabList
      tabs={tabs}
      activeId={activeId}
      onSelect={(id) => onSelect(id as SectionId)}
      label="内容入口"
      panelId={panelId}
      variant="section"
    />
  )
}

function countFor(id: SectionId, subject: ResearchSubject): number {
  if (id === 'codex') return codexStats.total
  if (id === 'mechanics') return subject.mechanismNotes.length
  if (id === 'questions') return subject.openQuestions.length
  return subject.attributes.filter((entry) => entry.category === id).length
}
