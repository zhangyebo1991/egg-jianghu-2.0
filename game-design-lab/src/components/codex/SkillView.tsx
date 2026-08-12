import { useMemo, useState } from 'react'
import { skills, factions, type Skill } from '../../data/codex'
import { SkillDetail, SkillRow } from './shared'

const CATEGORIES = ['通用', '战技', '武功', '符咒', '箭弩', '方术', '异能', '神技', '斗气', '忍术', '魔法', '功法', '枪械', '机甲', '召唤', '医术']
const ELEMENTS = ['雷', '水', '火', '木', '土', '精神', '神圣', '黑暗']
const DAMAGES = ['物理', '法术', '治疗', '辅助']

/** 技能 id → 教授该技能的势力名（反向索引） */
function useSkillFactionMap() {
  return useMemo(() => {
    const m = new Map<number, string[]>()
    for (const f of factions) {
      for (const sid of f.skillIds) {
        if (!m.has(sid)) m.set(sid, [])
        m.get(sid)!.push(f.name)
      }
    }
    return m
  }, [])
}

export default function SkillView() {
  const factionMap = useSkillFactionMap()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [elem, setElem] = useState('')
  const [dmg, setDmg] = useState('')
  const [onlyFaction, setOnlyFaction] = useState(false)
  const [selectedId, setSelectedId] = useState<number>(skills[0]?.id ?? 0)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return skills.filter((s) => {
      if (cat && s.category !== cat) return false
      if (elem && s.element !== elem) return false
      if (dmg && s.damageType !== dmg) return false
      if (onlyFaction && !factionMap.has(s.id)) return false
      if (needle) {
        const hay = `${s.name} ${s.descZh} ${s.kind}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [q, cat, elem, dmg, onlyFaction, factionMap])

  const selected: Skill | undefined =
    filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? skills.find((s) => s.id === selectedId)

  return (
    <div className="cx-layout">
      <aside className="cx-side cx-filters">
        <div className="cx-side-head">
          <span className="kicker">技能筛选 · {skills.length}</span>
        </div>
        <label className="cx-filter">
          <span>名称 / 描述</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索技能…" />
        </label>
        <label className="cx-filter">
          <span>类别</span>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">全部</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="cx-filter">
          <span>元素</span>
          <select value={elem} onChange={(e) => setElem(e.target.value)}>
            <option value="">全部</option>
            {ELEMENTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="cx-filter">
          <span>伤害性质</span>
          <select value={dmg} onChange={(e) => setDmg(e.target.value)}>
            <option value="">全部</option>
            {DAMAGES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="cx-check">
          <input type="checkbox" checked={onlyFaction} onChange={(e) => setOnlyFaction(e.target.checked)} />
          <span>仅势力教授技能</span>
        </label>
        <p className="cx-filter-count">命中 {filtered.length} 项</p>
      </aside>

      <section className="cx-main cx-skill-main">
        <div className="cx-skill-list">
          {filtered.length ? (
            filtered.map((s) => (
              <SkillRow
                key={s.id}
                skill={s}
                active={selected?.id === s.id}
                onClick={() => setSelectedId(s.id)}
              />
            ))
          ) : (
            <div className="empty-state">
              <span>∅</span>
              <strong>无匹配技能</strong>
              <p>调整筛选条件后重试</p>
            </div>
          )}
        </div>
      </section>

      <aside className="cx-detail">
        <p className="cx-detail-kicker">技能详情</p>
        {selected ? (
          <>
            <SkillDetail skill={selected} />
            {factionMap.has(selected.id) && (
              <p className="cx-taught-by">教授势力：{factionMap.get(selected.id)!.join('、')}</p>
            )}
          </>
        ) : (
          <div className="empty-state">
            <span>·</span>
            <strong>未选择技能</strong>
          </div>
        )}
      </aside>
    </div>
  )
}
