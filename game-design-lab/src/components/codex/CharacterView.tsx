import { useMemo, useState } from 'react'
import {
  characters,
  factions,
  factionNameOf,
  characterSkills,
  type Character,
} from '../../data/codex'
import { RichText, SkillRow, formatPrice, ReputationBadge, Badge } from './shared'

/** 角色视图：按势力筛选，展示成长值、招募价、自带技能与传记 */
export default function CharacterView() {
  const [factionFilter, setFactionFilter] = useState<number | 'all'>('all')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<number>(characters[0]?.id ?? 0)

  // 势力下拉项：只列出确实有角色的势力
  const usedFactions = useMemo(() => {
    const ids = new Set(characters.map((c) => c.factionId))
    return factions.filter((f) => ids.has(f.id))
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return characters.filter((c) => {
      if (factionFilter !== 'all' && c.factionId !== factionFilter) return false
      if (needle) {
        const hay = `${c.name} ${c.title} ${c.bioZh}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factionFilter, q])

  const selected: Character | undefined =
    filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? characters.find((c) => c.id === selectedId)

  return (
    <div className="cx-layout">
      <aside className="cx-side cx-filters">
        <div className="cx-side-head">
          <span className="kicker">角色 · {characters.length}</span>
        </div>
        <label className="cx-filter">
          <span>名称 / 传记</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索角色…" />
        </label>
        <label className="cx-filter">
          <span>归属势力</span>
          <select
            value={String(factionFilter)}
            onChange={(e) => setFactionFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">全部势力</option>
            <option value="0">无 / 主角</option>
            {usedFactions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <p className="cx-filter-count">命中 {filtered.length} 项</p>
      </aside>

      <section className="cx-main cx-char-main">
        <div className="cx-char-grid cx-char-grid-wide">
          {filtered.length ? (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`cx-char-card${selected?.id === c.id ? ' is-active' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <header>
                  <strong>{c.name}</strong>
                  {c.title && <span className="cx-char-title">{c.title}</span>}
                </header>
                <div className="cx-growth" title="勇 / 智 / 体 / 敏 / 精">
                  <span>勇 {c.growth.yong}</span>
                  <span>智 {c.growth.zhi}</span>
                  <span>体 {c.growth.ti}</span>
                  <span>敏 {c.growth.min}</span>
                  <span>精 {c.growth.jing}</span>
                </div>
                <div className="cx-char-foot">
                  <span className="cx-char-price">{formatPrice(c.price)}</span>
                  {c.reputationTier > 0 && (
                    <ReputationBadge tier={c.reputationTier} name={c.reputation} color={c.reputationColor} />
                  )}
                </div>
                <div className="cx-char-plane">
                  {c.plane} · {factionNameOf(c.factionId)}
                </div>
              </button>
            ))
          ) : (
            <div className="empty-state">
              <span>∅</span>
              <strong>无匹配角色</strong>
            </div>
          )}
        </div>
      </section>

      <aside className="cx-detail">
        <p className="cx-detail-kicker">角色详情</p>
        {selected ? <CharacterDetail c={selected} /> : (
          <div className="empty-state">
            <span>·</span>
            <strong>未选择角色</strong>
          </div>
        )}
      </aside>
    </div>
  )
}

function CharacterDetail({ c }: { c: Character }) {
  const skills = characterSkills(c)
  const g = c.growth
  const max = Math.max(g.yong, g.zhi, g.ti, g.min, g.jing, 1)
  return (
    <article className="cx-char-detail">
      <header className="cx-faction-head">
        <p className="cx-detail-kicker">
          角色 #{c.id} · {c.plane} · {factionNameOf(c.factionId)}
        </p>
        <h2>{c.name}</h2>
        {c.title && <Badge color="var(--c-gold)">{c.title}</Badge>}
      </header>

      <div className="cx-recruit-row">
        <div className="cx-stat-row">
          <span>招募价格</span>
          <strong>{formatPrice(c.price)}</strong>
        </div>
        <div className="cx-stat-row">
          <span>位面声望</span>
          {c.reputationTier > 0 ? (
            <ReputationBadge tier={c.reputationTier} name={c.reputation} color={c.reputationColor} />
          ) : (
            <strong className="cx-recruit-none">无要求</strong>
          )}
        </div>
      </div>

      <div className="cx-growth-detail">
        {([
          ['勇', g.yong],
          ['智', g.zhi],
          ['体', g.ti],
          ['敏', g.min],
          ['精', g.jing],
        ] as const).map(([k, v]) => (
          <div key={k} className="cx-growth-bar">
            <span className="cx-growth-bar-label">{k}</span>
            <div className="cx-growth-bar-track">
              <div className="cx-growth-bar-fill" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <span className="cx-growth-bar-val">{v}</span>
          </div>
        ))}
      </div>

      {c.bioZh && (
        <p className="cx-bio">
          <RichText html={c.bioHtml} />
        </p>
      )}

      <div className="cx-section-title">
        <h4>自带技能</h4>
        <small>{skills.length} 个</small>
      </div>
      <div className="cx-skill-list">
        {skills.length ? (
          skills.map((s) => <SkillRow key={s.id} skill={s} />)
        ) : (
          <p className="cx-empty-inline">无</p>
        )}
      </div>
    </article>
  )
}
