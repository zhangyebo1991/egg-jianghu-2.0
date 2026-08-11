import TabList, { type TabItem } from './TabList'
import { sectionMeta, type SectionId } from '../data/sections'
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
    count:
      section.id === 'mechanics'
        ? subject.mechanismNotes.length
        : section.id === 'questions'
          ? subject.openQuestions.length
          : subject.attributes.filter((entry) => entry.category === section.id).length,
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
