import { useState } from 'react'
import {
  factionsBySeries,
  factionSkills,
  factionCharacters,
  characterSkills,
  type Faction,
  type Character,
} from '../../data/codex'
import { RichText, SkillDetail, SkillRow, formatPrice, ReputationBadge, Badge } from './shared'

/** 势力浏览：按系列分组，选中势力展示其技能与可招募角色 */
export default function FactionView() {
  const first = factionsBySeries[0]?.factions[0]
  const [selectedId, setSelectedId] = useState<number>(first?.id ?? 1)
  const [activeSkillId, setActiveSkillId] = useState<number | null>(null)

  const selected = factionsBySeries
    .flatMap((g) => g.factions)
    .find((f) => f.id === selectedId)

  const skills = selected ? factionSkills(selected) : []
  const activeSkill =
    activeSkillId != null
      ? skills.find((s) => s.id === activeSkillId) ?? null
      : skills[0] ?? null

  return (
    <div className="cx-layout">
      <aside className="cx-side">
        <div className="cx-side-head">
          <span className="kicker">势力 · 42 派系</span>
          <p className="cx-side-note">按世界观系列分组，每势力教授 6 技能并可招募归属角色。</p>
        </div>
        <nav className="cx-faction-nav">
          {factionsBySeries.map((group) => (
            <div key={group.seriesId} className="cx-faction-group">
              <p className="cx-series-heading">
                {group.series}
                <small>{group.factions.length}</small>
              </p>
              {group.factions.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`cx-faction-btn${f.id === selectedId ? ' is-active' : ''}`}
                  onClick={() => {
                    setSelectedId(f.id)
                    setActiveSkillId(null)
                  }}
                >
                  <span>{f.name}</span>
                  <small>{f.currency === '货币' ? '银两' : '贡献'}</small>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <section className="cx-main">
        {selected && (
          <FactionDetail
            faction={selected}
            activeSkillId={activeSkill?.id ?? null}
            onSelectSkill={(id) => setActiveSkillId(id)}
          />
        )}
      </section>

      <aside className="cx-detail">
        <p className="cx-detail-kicker">技能详情</p>
        {activeSkill ? (
          <SkillDetail skill={activeSkill} />
        ) : (
          <div className="empty-state">
            <span>·</span>
            <strong>该势力无可解析技能</strong>
          </div>
        )}
      </aside>
    </div>
  )
}

function FactionDetail({
  faction,
  activeSkillId,
  onSelectSkill,
}: {
  faction: Faction
  activeSkillId: number | null
  onSelectSkill: (id: number) => void
}) {
  const skills = factionSkills(faction)
  const chars = factionCharacters(faction)
  return (
    <div className="cx-faction-detail">
      <header className="cx-faction-head">
        <p className="cx-detail-kicker">
          {faction.series} · 势力 #{faction.id}
        </p>
        <h2>{faction.name}</h2>
        <div className="cx-faction-tags">
          <Badge color="var(--c-gold)">{faction.skillGroup}</Badge>
          <Badge color={faction.currency === '货币' ? 'var(--c-cyan)' : 'var(--c-purple)'}>
            {faction.currency === '货币' ? '银两购买' : '贡献解锁'}
          </Badge>
          <Badge>{faction.type}</Badge>
        </div>
      </header>

      <p className="cx-faction-desc">
        <RichText html={faction.descHtml} />
      </p>

      <div className="cx-section-title">
        <h4>教授技能</h4>
        <small>点击查看详情 · 共 {skills.length} 个</small>
      </div>
      <div className="cx-skill-list">
        {skills.length ? (
          skills.map((s) => (
            <SkillRow
              key={s.id}
              skill={s}
              active={activeSkillId === s.id || (activeSkillId === null && s.id === skills[0].id)}
              onClick={() => onSelectSkill(s.id)}
            />
          ))
        ) : (
          <p className="cx-empty-inline">无</p>
        )}
      </div>

      <div className="cx-section-title">
        <h4>可招募角色</h4>
        <small>{chars.length} 名</small>
      </div>
      <div className="cx-char-grid">
        {chars.length ? (
          chars.map((c) => <CharacterMini key={c.id} c={c} />)
        ) : (
          <p className="cx-empty-inline">该势力无可招募角色（角色需通过其他系统获得）</p>
        )}
      </div>
    </div>
  )
}

function CharacterMini({ c }: { c: Character }) {
  const skills = characterSkills(c)
  const g = c.growth
  return (
    <article className="cx-char-card">
      <header>
        <strong>{c.name}</strong>
        {c.title && <span className="cx-char-title">{c.title}</span>}
      </header>
      <div className="cx-growth" title="勇 / 智 / 体 / 敏 / 精">
        <span>勇 {g.yong}</span>
        <span>智 {g.zhi}</span>
        <span>体 {g.ti}</span>
        <span>敏 {g.min}</span>
        <span>精 {g.jing}</span>
      </div>
      <div className="cx-char-foot">
        <span className="cx-char-price">{formatPrice(c.price)}</span>
        {c.reputationTier > 0 ? (
          <ReputationBadge tier={c.reputationTier} name={c.reputation} color={c.reputationColor} />
        ) : (
          <span className="cx-char-plane">无声望要求</span>
        )}
      </div>
      <div className="cx-char-skills" title={skills.map((s) => s.name).join('、')}>
        {skills.slice(0, 4).map((s) => s.name).join('、') || '—'}
      </div>
    </article>
  )
}
