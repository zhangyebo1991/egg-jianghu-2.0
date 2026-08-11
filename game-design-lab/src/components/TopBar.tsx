import { padCount } from '../lib/status'
import type { ResearchSubject } from '../data/subjects'

type Props = {
  subject: ResearchSubject
}

export default function TopBar({ subject }: Props) {
  const total = subject.attributes.length + subject.mechanismNotes.length

  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark">GDL</div>
        <div>
          <p className="brand-name">GAME DESIGN LAB</p>
          <p className="brand-subtitle">通用游戏策划工作台</p>
        </div>
      </div>
      <div className="lab-header-context">
        <span className="status-dot" />
        <span className="sample-chip">{subject.label}</span>
        <span className="record-count">{padCount(total)} 条研究记录</span>
      </div>
    </header>
  )
}
