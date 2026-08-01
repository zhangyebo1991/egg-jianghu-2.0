import { escapeHtml } from './html'

export interface InventoryPageViewModel {
  selectedHeroId: string | null
  heroes: Array<{ id: string; name: string }>
  capacity: number
  items: Array<{
    uid: string
    name: string
    slot: string
    slotName: string
    level: number
    quality: string
    locked: boolean
    equippedByHeroId: string | null
    affixes: Array<{ name: string; value: number }>
  }>
}

export const renderInventoryPage = (view: InventoryPageViewModel): string => `<section class="inventory-layout" data-testid="inventory-page">
  <header class="inventory-heading panel"><div><small>即时掉落</small><h1>装备背包</h1></div><strong>${view.items.length} / ${view.capacity}</strong></header>
  <label class="hero-picker">穿戴对象<select data-action="select-hero-input">${view.heroes.map((hero) => `<option value="${hero.id}" ${hero.id === view.selectedHeroId ? 'selected' : ''}>${escapeHtml(hero.name)}</option>`).join('')}</select></label>
  <div class="inventory-grid">${view.items.map((item) => `<article class="equipment-card" data-rarity="${escapeHtml(item.quality)}" data-testid="equipment-${item.uid}">
    <header><span>${escapeHtml(item.slotName)}</span><strong>${escapeHtml(item.name)}</strong><em>${escapeHtml(item.quality)}</em></header>
    <div><span>Lv.${item.level}</span>${item.affixes.map((affix) => `<small>${escapeHtml(affix.name)} +${affix.value}</small>`).join('')}</div>
    <footer><button type="button" data-action="equipment-equip" data-hero-id="${view.selectedHeroId ?? ''}" data-equipment-uid="${item.uid}">${item.equippedByHeroId ? '换给所选侠客' : '穿戴'}</button><button type="button" data-action="equipment-lock" data-equipment-uid="${item.uid}">${item.locked ? '解锁' : '锁定'}</button>${item.equippedByHeroId ? `<span>由 ${escapeHtml(view.heroes.find((hero) => hero.id === item.equippedByHeroId)?.name ?? '侠客')} 穿戴</span>` : ''}</footer>
  </article>`).join('') || '<section class="empty-inventory panel"><strong>尚无装备</strong><span>敌人死亡时，随机装备会立即进入背包。</span></section>'}</div>
</section>`
