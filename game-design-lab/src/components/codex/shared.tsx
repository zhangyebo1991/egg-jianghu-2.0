import { CATEGORY_COLOR, ELEMENT_COLOR } from '../../data/codex'
import type { Skill } from '../../data/codex'

/**
 * 富文本渲染：descHtml 由 gen-codex.py 从 BBCode 生成，仅含受信任的 <span style="color:...">
 * 标签，其余字符已 HTML 转义，故可安全注入。
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  if (!html) return null
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

/** 大数字格式化：≥10000 显示「xx万」 */
export function formatPrice(n: number): string {
  if (!n) return '—'
  if (n >= 10000) {
    const wan = n / 10000
    return `${Number.isInteger(wan) ? wan : wan.toFixed(1)} 万`
  }
  return n.toLocaleString('en-US')
}

export function Badge({
  children,
  color,
  title,
}: {
  children: React.ReactNode
  color?: string
  title?: string
}) {
  return (
    <span className="cx-badge" style={color ? { color, borderColor: color } : undefined} title={title}>
      {children}
    </span>
  )
}

export function ElementBadge({ element }: { element: string }) {
  if (!element || element === '无') return null
  return <Badge color={ELEMENT_COLOR[element] ?? 'var(--muted)'}>{element}</Badge>
}

export function CategoryBadge({ category }: { category: string }) {
  return <Badge color={CATEGORY_COLOR[category] ?? 'var(--muted-strong)'}>{category}</Badge>
}

export function DamageBadge({ damageType }: { damageType: string }) {
  if (!damageType) return null
  const color =
    damageType === '物理'
      ? 'var(--c-orange)'
      : damageType === '法术'
        ? 'var(--c-cyan)'
        : damageType === '治疗'
          ? 'var(--c-green)'
          : damageType === '辅助'
            ? 'var(--c-gold)'
            : 'var(--muted)'
  return <Badge color={color}>{damageType}</Badge>
}

/** 招募所需位面声望阶位徽章（冷淡/友好/尊敬/崇拜/信仰） */
export function ReputationBadge({
  tier,
  name,
  color,
}: {
  tier: number
  name: string
  color: string
}) {
  if (!tier || !name) return null
  return (
    <Badge color={color} title={`招募所需 ${name} 级位面声望`}>
      声望·{name}
    </Badge>
  )
}

/** 技能列表中的紧凑行 */
export function SkillRow({
  skill,
  onClick,
  active,
}: {
  skill: Skill
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={`cx-skill-row${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <div className="cx-skill-row-head">
        <span className="cx-skill-name">{skill.name}</span>
        <div className="cx-skill-badges">
          {skill.kind && <span className="cx-skill-kind">【{skill.kind}】</span>}
          <CategoryBadge category={skill.category} />
          <DamageBadge damageType={skill.damageType} />
          <ElementBadge element={skill.element} />
        </div>
      </div>
      <div className="cx-skill-row-meta">
        {skill.targetSide && <span>{skill.targetSide}</span>}
        {skill.range && <span>· {skill.range}</span>}
        {skill.power > 0 && <span>· 威力 {skill.power}%</span>}
        {skill.energyCost > 0 && <span>· 能量 {skill.energyCost}</span>}
        {skill.cooldown > 0 && <span>· CD {skill.cooldown}</span>}
      </div>
    </button>
  )
}

/** 技能完整详情卡 */
export function SkillDetail({ skill }: { skill: Skill }) {
  return (
    <article className="cx-skill-detail">
      <header className="cx-skill-detail-head">
        <div>
          <p className="cx-detail-kicker">技能 #{skill.id}</p>
          <h3>{skill.name}</h3>
        </div>
        <div className="cx-skill-badges">
          {skill.kind && <Badge color="var(--c-gold)">【{skill.kind}】</Badge>}
          <CategoryBadge category={skill.category} />
          <DamageBadge damageType={skill.damageType} />
          <ElementBadge element={skill.element} />
        </div>
      </header>

      <div className="cx-skill-stats">
        <Stat label="目标" value={[skill.targetSide, skill.range].filter(Boolean).join(' · ') || '—'} />
        <Stat label="威力" value={skill.power > 0 ? `${skill.power}%` : '—'} />
        <Stat label="能量" value={skill.energyCost > 0 ? String(skill.energyCost) : '—'} />
        <Stat label="冷却" value={skill.cooldown > 0 ? `${skill.cooldown} 回合` : '—'} />
        <Stat
          label="附加"
          value={
            skill.buffChance > 0
              ? `${skill.buffChance}%${skill.buffValue ? ` · ${skill.buffValue}` : ''}`
              : '—'
          }
        />
        <Stat label="受击" value={skill.hitEffect || '—'} />
        {skill.learnReq > 0 && <Stat label="学习需求" value={String(skill.learnReq)} />}
      </div>

      <div className="cx-skill-desc">
        <RichText html={skill.descHtml} />
      </div>

      {skill.descEn && (
        <p className="cx-skill-desc-en">
          <RichText html={skill.descEn} />
        </p>
      )}
    </article>
  )
}

export function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="cx-stat">
      <span className="cx-stat-label">{label}</span>
      <span className="cx-stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  )
}
