import type { HeroesPageViewModel } from './heroes-page'
import { EQUIPMENT_SLOT_NAMES } from '../content/equipment'
import { equipmentIconAsset } from './equipment-icon-assets'
import { heroPortraitAsset } from './portrait-assets'
import { escapeHtml } from './html'
import { renderEquipmentTooltip } from './inventory-page'

export const renderInkInventoryHeroes = (view: HeroesPageViewModel): string => {
  const selected = view.heroes.find(hero => hero.id === view.selectedHeroId)
  const query = (view.rosterQuery ?? '').trim().toLocaleLowerCase()
  const grades: Record<string, number> = { 主: 0, 天: 1, 地: 2, 甲: 3, 乙: 4, 丙: 5 }
  const roster = view.heroes.filter(hero => `${hero.name}${hero.careerName}${hero.category ?? ''}`.toLocaleLowerCase().includes(query))
    .sort((a, b) => Number(b.inFormation) - Number(a.inFormation) || (grades[a.grade] ?? 9) - (grades[b.grade] ?? 9) || b.level - a.level)
  return `<aside class="ink-bag-heroes" aria-label="穿戴侠客">
    <header class="ink-section-title"><h2>为谁换装</h2><span>${view.heroes.length} 侠 · 在阵优先</span></header>
    <input type="search" data-action="hero-roster-search" aria-label="搜索穿戴侠客" placeholder="搜索侠客 · 名称 / 职业 / 脉系" value="${escapeHtml(view.rosterQuery ?? '')}">
    <div class="ink-bag-roster">${roster.map(hero => `<button type="button" data-action="select-hero" data-hero-id="${hero.id}" aria-pressed="${hero.id === selected?.id}" class="${hero.id === selected?.id ? 'active' : ''}"><img src="${escapeHtml(heroPortraitAsset(hero.id, hero.category).url)}" alt=""><strong>${escapeHtml(hero.name)}</strong><small>Lv.${hero.level}</small></button>`).join('') || '<p>没有符合条件的侠客</p>'}</div>
  </aside>`
}

export const renderInkInventoryEquipment = (view: HeroesPageViewModel): string => {
  const selected = view.heroes.find(hero => hero.id === view.selectedHeroId)
  if (!selected) return ''
  const build = view.equipment?.autoEquipBuild
  const slots = (view.equipment?.slots ?? []).map((slot) => {
    const item = slot.item
    return `<button type="button" class="ink-equipped-slot" data-action="equipment-unequip" data-hero-id="${escapeHtml(selected.id)}" data-slot="${slot.slot}"${item ? ` data-rarity="${item.quality}" data-equipment-uid="${escapeHtml(item.uid)}"` : ''} data-testid="equipped-${slot.slot}" ${item ? '' : 'disabled'} title="${item ? `${escapeHtml(item.name)} · 点击卸下` : `${EQUIPMENT_SLOT_NAMES[slot.slot]} · 未装备`}">
      ${item ? `<img src="${escapeHtml(equipmentIconAsset(slot.slot, item.definitionId).url)}" alt="">` : ''}
      <small>${EQUIPMENT_SLOT_NAMES[slot.slot]}</small><span>${item ? escapeHtml(item.name) : '虚位'}</span>
      ${item ? renderEquipmentTooltip(item, '点击格子卸下当前装备') : ''}
    </button>`
  }).join('')
  return `<section class="ink-bag-equipped"><header class="ink-section-title"><h2>身上装备</h2><span>${escapeHtml(selected.name)} · ${escapeHtml(selected.careerName)}</span><div class="ink-bag-equipment-actions">
    <button type="button" class="ink-tool-btn" data-action="equipment-build-toggle" aria-label="切换一键穿戴方向" title="点击切换物理 / 法术">${build === 'magical' ? '法术' : '物理'} ↔</button>
    <button type="button" class="ink-tool-btn primary" data-action="equipment-auto-equip" data-hero-id="${escapeHtml(selected.id)}" title="核心词条优先，附加词条次之；仅更新当前套装，不更换至宝">一键穿戴</button>
    <button type="button" class="ink-tool-btn" data-tab="heroes">详情</button>
  </div></header><div class="ink-equipped">${slots}</div></section>`
}
