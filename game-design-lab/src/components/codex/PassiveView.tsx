import { useState } from 'react'
import { passives } from '../../data/codex'
import { Badge } from './shared'

const TIERS = ['初级', '中级', '高级', '终极']
const TIER_COLOR: Record<string, string> = {
  初级: 'var(--muted-strong)',
  中级: 'var(--c-cyan)',
  高级: 'var(--c-purple)',
  终极: 'var(--c-gold)',
}

/** 通用属性被动技能：4 阶 × 36 属性，按阶数分组浏览 */
export default function PassiveView() {
  const [tier, setTier] = useState<string>('')
  const [q, setQ] = useState('')

  const filtered = passives.filter((p) => {
    if (tier && p.tier !== tier) return false
    if (q.trim() && !p.name.includes(q.trim())) return false
    return true
  })

  // 按属性名（去掉阶数前缀）归组
  const groups = new Map<string, typeof passives>()
  for (const p of filtered) {
    const attr = p.name.replace(/^(初级|中级|高级|终极)/, '')
    if (!groups.has(attr)) groups.set(attr, [])
    groups.get(attr)!.push(p)
  }

  return (
    <div className="cx-single">
      <div className="cx-single-head">
        <div>
          <span className="kicker">通用属性被动 · {passives.length}</span>
          <h2>属性专精被动技能</h2>
          <p className="cx-side-note">
            4 个阶数（初/中/高/终极）× 36 项属性。任何角色均可通过修习获得，按阶数递增价格，进入对应属性词条结算。
          </p>
        </div>
        <div className="cx-passive-controls">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索属性…" className="cx-passive-search" />
          <div className="cx-tier-chips">
            <button type="button" className={!tier ? 'is-active' : ''} onClick={() => setTier('')}>
              全部
            </button>
            {TIERS.map((t) => (
              <button
                key={t}
                type="button"
                className={tier === t ? 'is-active' : ''}
                onClick={() => setTier(t === tier ? '' : t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="cx-passive-grid">
        {Array.from(groups.entries()).map(([attr, list]) => (
          <article key={attr} className="cx-passive-card">
            <header>
              <strong>{attr}</strong>
            </header>
            <div className="cx-passive-tiers">
              {list
                .sort((a, b) => a.tierId - b.tierId)
                .map((p) => (
                  <div key={p.id} className="cx-passive-tier">
                    <Badge color={TIER_COLOR[p.tier]}>{p.tier}</Badge>
                    <span className="cx-passive-cost">{p.cost}</span>
                  </div>
                ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
