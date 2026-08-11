import { STATUS_LABEL, padCount } from '../lib/status'
import type { MechanismNote } from '../data/research'
import type { SectionMeta } from '../data/sections'

type Props = {
  section: SectionMeta
  notes: MechanismNote[]
}

export default function MechanismPanel({ section, notes }: Props) {
  return (
    <div className="mechanics-section">
      <div className="mechanics-heading">
        <div>
          <p className="kicker">{section.eyebrow}</p>
          <h2>{section.label}</h2>
        </div>
        <p>这些不是额外的属性，而是决定属性最终价值的机制入口。</p>
      </div>

      <div className="mechanics-grid">
        {notes.map((note, index) => (
          <article className="mechanism-card" key={note.id}>
            <div className="mechanism-card-topline">
              <span className="mechanism-index">{padCount(index + 1)}</span>
              <span className={`status-label status-${note.status}`}>{STATUS_LABEL[note.status]}</span>
            </div>
            <h3>{note.title}</h3>
            <p>{note.summary}</p>
            {note.formula && <code>{note.formula}</code>}
          </article>
        ))}
      </div>
    </div>
  )
}
