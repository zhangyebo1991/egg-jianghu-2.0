import { useMemo, useState } from 'react'
import { items } from '../../data/codex'
import { formatPrice } from './shared'

/** 物品图鉴：按名称搜索，展示价格与描述。物品不绑定势力，属通用售卖/掉落系统。 */
export default function ItemView() {
  const [q, setQ] = useState('')
  const [hideEmpty, setHideEmpty] = useState(false)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter((it) => {
      if (hideEmpty && !it.descZh) return false
      if (needle) {
        const hay = `${it.name} ${it.descZh}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [q, hideEmpty])

  return (
    <div className="cx-single">
      <div className="cx-single-head">
        <div>
          <span className="kicker">物品 · {items.length}</span>
          <h2>物品图鉴</h2>
          <p className="cx-side-note">
            物品按类型（命石 / 秘籍 / 转职书 / 图纸 / 门票 …）划分，属通用售卖与掉落系统，不绑定特定势力。
          </p>
        </div>
        <div className="cx-item-controls">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索物品名称或描述…" />
          <label className="cx-check">
            <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
            <span>隐藏无描述</span>
          </label>
        </div>
      </div>

      <p className="cx-filter-count">命中 {filtered.length} 项</p>

      <div className="cx-item-grid">
        {filtered.slice(0, 600).map((it) => (
          <article key={it.id} className="cx-item-card">
            <header>
              <strong>{it.name}</strong>
              {it.price > 0 && <span className="cx-item-price">{formatPrice(it.price)}</span>}
            </header>
            {it.descZh && <p>{it.descZh}</p>}
          </article>
        ))}
      </div>
      {filtered.length > 600 && (
        <p className="cx-item-more">仅展示前 600 项，缩小搜索范围以查看更多。</p>
      )}
    </div>
  )
}
