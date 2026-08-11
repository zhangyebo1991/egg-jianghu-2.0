import { STATUS_LABEL } from '../lib/status'
import { evidenceMeta, sources, type AttributeEntry } from '../data/research'

type Props = {
  entry: AttributeEntry
}

export default function AttributeDetail({ entry }: Props) {
  const entrySources = sources.filter((source) => entry.sourceIds.includes(source.id))

  return (
    <aside className="detail-panel">
      <div className="detail-topline">
        <span className="kicker">SELECTED ENTRY</span>
        <span className={`status-label status-${entry.status}`}>{STATUS_LABEL[entry.status]}</span>
      </div>
      <div className="detail-title-row">
        <div className="detail-symbol">{entry.name.slice(0, 1)}</div>
        <div>
          <p>{entry.group}</p>
          <h2>{entry.name}</h2>
        </div>
      </div>
      <p className="detail-summary">{entry.summary}</p>

      <div className="detail-block">
        <span className="detail-label">作用范围</span>
        <p>{entry.impact}</p>
      </div>
      <div className="detail-block design-block">
        <span className="detail-label">对当前项目的启发</span>
        <p>{entry.designValue}</p>
      </div>

      {entry.formula && (
        <div className="formula-card">
          <span className="detail-label">研究口径</span>
          <code>{entry.formula}</code>
        </div>
      )}

      <div className="detail-tags">
        {entry.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      <div className="detail-sources">
        <div className="source-heading">
          <span className="detail-label">资料链</span>
          <span className={`confidence-chip confidence-${entry.confidence}`}>
            {entry.confidence} · {evidenceMeta[entry.confidence].label}
          </span>
        </div>
        {entrySources.map((source) => (
          <a
            className="source-row"
            href={source.url ?? '#'}
            target={source.url ? '_blank' : undefined}
            rel={source.url ? 'noreferrer' : undefined}
            key={source.id}
          >
            <span className={`confidence-chip confidence-${source.level}`}>{source.level}</span>
            <span>
              <strong>{source.title}</strong>
              <small>{source.note}</small>
            </span>
            {source.url && <span className="source-arrow">↗</span>}
          </a>
        ))}
      </div>
    </aside>
  )
}
