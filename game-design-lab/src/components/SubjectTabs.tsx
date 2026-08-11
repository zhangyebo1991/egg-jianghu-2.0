import TabList, { type TabItem } from './TabList'
import { researchSubjects } from '../data/subjects'

type Props = {
  activeId: string
  onSelect: (id: string) => void
  panelId: string
}

export default function SubjectTabs({ activeId, onSelect, panelId }: Props) {
  const tabs: TabItem[] = researchSubjects.map((subject) => ({
    id: subject.id,
    label: subject.label,
    eyebrow: subject.code,
    count: subject.attributes.length,
  }))

  return (
    <TabList
      tabs={tabs}
      activeId={activeId}
      onSelect={onSelect}
      label="研究样本"
      panelId={panelId}
      variant="subject"
    />
  )
}
