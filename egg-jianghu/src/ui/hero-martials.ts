import { heartMethodByIdV10, martialByIdV10, martialEffectAtLevel, type MartialDefinitionV10 } from '../content/martials'
import { skillById, summonById } from '../content/skills'
import { buffById } from '../content/buffs'
import type { HeroProgressV10 } from '../domain/types'
import { escapeHtml } from './html'
import { martialIconAsset } from './career-icon-assets'

export interface HeroMartialsView {
  hero: HeroProgressV10
  query: string
  category: string
  selectedSlot: number | null
  highlightedId: string | null
  locked: boolean
}

const martialCategory = (martial: MartialDefinitionV10): string => martial.skillCategory === 1 ? '通用' : martial.category

const martialDescription = (martial: MartialDefinitionV10, level: number): string => {
  const skill = skillById(martial.originalSkillId)
  return martial.description
    .replace(/\[\/?color(?:=[^\]]+)?\]/gi, '')
    .replace(/百分比数值/g, String(martialEffectAtLevel(martial, level)))
    .replace(/buff名/g, buffById(martial.buffId ?? skill?.appliedBuffId ?? 0)?.name ?? '状态')
    .replace(/召唤物名/g, summonById(skill?.summonId ?? 0)?.name ?? '召唤物')
    .replace(/数值/g, String(martialEffectAtLevel(martial, level)))
}

export const renderHeroMartials = (view: HeroMartialsView): string => {
  const { hero, selectedSlot, locked } = view
  const learned = Object.entries(hero.learnedMartials).flatMap(([id, record]) => {
    const definition = martialByIdV10(id)
    return definition ? [{ definition, record }] : []
  })
  const categories = [...new Set(learned.map(({ definition }) => martialCategory(definition)))]
  const filtered = learned.filter(({ definition, record }) =>
    (view.category === 'all' || martialCategory(definition) === view.category)
    && `${definition.name} ${martialDescription(definition, record.level)}`.includes(view.query.trim()))
  const method = hero.heartMethodId ? heartMethodByIdV10(hero.heartMethodId) : undefined
  return `<section class="hero-martials" data-testid="hero-martials">
    <header class="hm-heading"><strong>随身武学</strong><span>按槽位顺序尝试施放 · 未携带不参与战斗</span></header>
    ${locked ? '<p class="hm-notice" role="status">战斗进行中，结束或退出战斗后可调整携带武学。</p>' : ''}
    <div class="hm-slots">${hero.equippedMartialIds.map((id, slot) => {
      const martial = id ? martialByIdV10(id) : undefined
      return `<article class="hm-slot${selectedSlot === slot ? ' selected' : ''}" data-testid="martial-slot-${slot}">
        <span class="hm-slot-number">${slot + 1}</span>
        ${martial ? `<img src="${escapeHtml(martialIconAsset(martial.id))}" alt=""><div><strong>${escapeHtml(martial.name)}</strong><small>Lv.${hero.learnedMartials[martial.id]?.level ?? 1}</small></div>` : '<div><strong>空槽位</strong><small>选择已学武学装配</small></div>'}
        <div class="hm-slot-actions"><button type="button" data-action="hero-martial-slot" data-slot="${slot}" aria-pressed="${selectedSlot === slot}"${locked ? ' disabled' : ''}>${martial ? '替换' : '装配'}</button>
        ${id ? `<button type="button" data-action="martial-unequip" data-slot="${slot}"${locked ? ' disabled' : ''}>卸下</button>` : ''}</div>
      </article>`
    }).join('')}</div>
    <div class="hm-heading"><strong>已学武学 <small>${learned.length} / 12</small></strong>
      ${selectedSlot !== null ? `<span role="status">正在选择第 ${selectedSlot + 1} 槽武学 <button type="button" data-action="hero-martial-cancel">取消</button></span>` : '<span>先选择上方槽位，再点击技能装入</span>'}
    </div>
    <div class="hm-filters"><input type="search" aria-label="搜索已学武学" data-action="hero-martial-search" placeholder="搜索名称或效果…" value="${escapeHtml(view.query)}">
      <select aria-label="武学类型" data-action="hero-martial-category"><option value="all"${view.category === 'all' ? ' selected' : ''}>全部类型</option>${categories.map((category) => `<option value="${category}"${view.category === category ? ' selected' : ''}>${category}</option>`).join('')}</select></div>
    <div class="hm-library" data-testid="martial-library">${filtered.map(({ definition: martial, record }) => {
      const equippedSlot = hero.equippedMartialIds.indexOf(martial.id)
      const skill = skillById(martial.originalSkillId)
      const reason = !skill ? '暂无可用战斗效果' : locked ? '战斗中不可调整' : equippedSlot >= 0 ? `已携带 · 第 ${equippedSlot + 1} 槽` : selectedSlot === null ? '请先选择槽位' : null
      return `<article class="hm-card${view.highlightedId === martial.id ? ' highlighted' : ''}" data-testid="learned-${martial.id}">
        <header><img src="${escapeHtml(martialIconAsset(martial.id))}" alt=""><div><strong>${escapeHtml(martial.name)}</strong><small>${martialCategory(martial)} · Lv.${record.level} / ${martial.maxLevel}${skill?.behavior === 'passive' ? ' · 携带后被动生效' : ''}</small></div>${view.highlightedId === martial.id ? '<b class="hm-new">本次选中</b>' : ''}</header>
        <p>${escapeHtml(martialDescription(martial, record.level))}</p><div class="hm-meta"><span>耗气 ${martial.energyCost}</span><span>冷却 ${martial.cooldownMs / 1000}秒</span></div>
        <button type="button" data-action="martial-equip" data-martial-id="${martial.id}" data-slot="${selectedSlot ?? -1}"${reason ? ' disabled' : ''}>${reason ?? `装入第 ${selectedSlot! + 1} 槽`}</button>
      </article>`
    }).join('') || `<p class="hm-empty">${learned.length ? '没有符合筛选条件的武学。' : '尚未学习武学，请前往世界内的势力研习。'}</p>`}</div>
    <section class="hm-extra"><strong>主修心法 · 不占武功槽</strong><p>${method ? `${escapeHtml(method.name)} · 回气 +${method.energyRecovery} · 调息缩减 ${Math.round(method.cooldownRate * 100)}%` : '尚未主修心法'}</p></section>
    <section class="hm-extra"><strong>永久领悟资格 · 不自动生效</strong><p>永久保留重新学习资格，学会并装入槽位后参与战斗。</p><div>${hero.permanentMartialIds.map((id) => `<span>${escapeHtml(martialByIdV10(id)?.name ?? '未知武学')}${hero.learnedMartials[id] ? ' · 已学' : ' · 待重学'}</span>`).join('') || '<span>暂无永久领悟资格</span>'}</div></section>
  </section>`
}
