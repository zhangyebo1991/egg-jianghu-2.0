import { padCount } from '../lib/status'
import type { AttributeEntry } from '../data/research'
import type { SectionMeta } from '../data/sections'

type Props = {
  section: SectionMeta
  groupedEntries: [string, AttributeEntry[]][]
  matchCount: number
  selectedId: string
  onSelect: (id: string) => void
  search: string
  onSearchChange: (value: string) => void
}

export default function AttributeList({
  section,
  groupedEntries,
  matchCount,
  selectedId,
  onSelect,
  search,
  onSearchChange,
}: Props) {
  return (
    <div className="stat-browser">
      <div className="browser-toolbar">
        <div>
          <p className="kicker">{section.eyebrow}</p>
          <h2>{section.label}</h2>
        </div>
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索属性、标签或用途"
            aria-label="搜索属性、标签或用途"
          />
        </label>
      </div>

      <div className="browser-meta">
        <span>{section.description}</span>
        <span className="meta-divider" />
        <strong>{padCount(matchCount)} 条记录</strong>
        {search && <span className="filter-state">筛选中：{search}</span>}
      </div>

      <div className="stat-groups">
        {groupedEntries.length > 0 ? (
          groupedEntries.map(([group, entries]) => (
            <section className="stat-group" key={group}>
              <div className="group-heading">
                <span>{group}</span>
                <small>{padCount(entries.length)}</small>
              </div>
              <div className="stat-grid">
                {entries.map((entry) => (
                  <button
                    className={`stat-card ${selectedId === entry.id ? 'is-selected' : ''}`}
                    type="button"
                    key={entry.id}
                    aria-pressed={selectedId === entry.id}
                    onClick={() => onSelect(entry.id)}
                  >
                    <span className="stat-symbol">{entry.name.slice(0, 1)}</span>
                    <span className="stat-card-copy">
                      <span className="stat-card-title-row">
                        <strong>{entry.name}</strong>
                        <span className={`confidence-chip confidence-${entry.confidence}`}>
                          {entry.confidence}
                        </span>
                      </span>
                      <span>{entry.summary}</span>
                      <span className="tag-row">
                        {entry.tags.slice(0, 2).map((tag) => (
                          <em key={tag}>{tag}</em>
                        ))}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="empty-state">
            <span>⌁</span>
            <strong>没有匹配的属性</strong>
            <p>换一个关键词，或清空搜索条件。</p>
          </div>
        )}
      </div>
    </div>
  )
}
