import { escapeHtml } from './html'
import type { CombatStats } from '../combat/stats'
import { EQUIPMENT_QUALITIES, type EquipmentSlot } from '../content/equipment'
import type { HeroAptitudes } from '../content/heroes'
import type { EquipmentQuality } from '../domain/types'
import { equipmentIconAsset } from './equipment-icon-assets'

export interface HeroesEquipmentView {
  uid: string
  definitionId: string
  name: string
  slot: EquipmentSlot
  slotName: string
  level: number
  quality: EquipmentQuality
  locked: boolean
  equippedByHeroId: string | null
  equippedByHeroName: string | null
  baseStat: { name: string; value: number; percent: boolean }
  affixes: Array<{ name: string; value: number; percent: boolean }>
}

export interface HeroesEquipmentSlotView {
  id: EquipmentSlot
  name: string
  equipment: HeroesEquipmentView | null
}

export interface HeroesHeroView {
  id: string
  name: string
  grade: string
  recruited: boolean
  level: number
  careerId: string
  careerName: string
  careerLevel: number
  careerPerfected: boolean
  availableCareerIds: string[]
  aptitudes: HeroAptitudes
  combatStats: CombatStats
  equipmentSlots: HeroesEquipmentSlotView[]
  learnedMartials: Array<{ id: string; name: string; rarity: string; level: number }>
  equippedMartialIds: [string | null, string | null, string | null, string | null]
  heartMethodId: string | null
}

export interface HeroesCareerView {
  id: string
  name: string
  tier: string
  owned: boolean
  tokenOwned: boolean
}

export interface HeroesPageViewModel {
  selectedHeroId: string | null
  heroes: HeroesHeroView[]
  careers: HeroesCareerView[]
  martials: Array<{ id: string; name: string; rarity: string; level: number; learned: boolean }>
  heartMethods: Array<{ id: string; name: string; equipped: boolean }>
  inventoryItems: HeroesEquipmentView[]
  inventoryCapacity: number
  inventorySlotFilter: EquipmentSlot | 'all'
  inventoryQualityFilter: EquipmentQuality | 'all'
  inventoryPage: number
  batchDiscardQuality: EquipmentQuality | 'all'
  batchDiscardConfirm: boolean
}

const HERO_INVENTORY_PAGE_SIZE = 200

const formatNumber = (value: number): string => Number.isInteger(value) ? String(value) : value.toFixed(1)
const formatPercent = (value: number): string => `${(value * 100).toFixed(value * 100 % 1 === 0 ? 0 : 1)}%`

const statMarks: Record<string, string> = {
  臂力: '力', 悟性: '悟', 体魄: '骨', 身法: '身', 定力: '心', 气血: '♥', 真气: '●',
  初始真气: '✣', 真气回复: '◉', 外功: '剑', 内功: '气', 外防: '盾', 内防: '甲',
  有效身法: '影', 命中修正: '羽', 闪避: '闪', 控制抗性: '定', 暴击: '暴',
  暴击倍率: '破', 冷却缩减: '冷', 气机加速: '速', 武势加成: '势', 生存加成: '生', 圆满加成: '圆',
}

const renderStat = (label: string, value: string | number): string =>
  `<div class="hero-stat" data-stat-label="${escapeHtml(label)}"><i aria-hidden="true">${statMarks[label] ?? '◇'}</i><dt>${escapeHtml(label)}</dt><dd>${typeof value === 'number' ? formatNumber(value) : escapeHtml(value)}</dd></div>`

const renderEquipmentArt = (slot: EquipmentSlot, definitionId?: string): string => {
  const icon = equipmentIconAsset(slot, definitionId)
  return `<img class="equipment-art" src="${escapeHtml(icon.url)}" data-slot-art="${slot}" data-icon-source="${icon.source}" alt="" aria-hidden="true" draggable="false">`
}

const renderHeroStats = (hero: HeroesHeroView): string => {
  const aptitudes = hero.aptitudes
  const stats = hero.combatStats
  return `<div class="hero-stat-sections" data-testid="hero-stats">
    <section class="hero-stat-block hero-base-stats">
      <header><h2>基础属性</h2><small>先天资质</small></header>
      <dl>${[
        renderStat('臂力', aptitudes.strength),
        renderStat('悟性', aptitudes.insight),
        renderStat('体魄', aptitudes.constitution),
        renderStat('身法', aptitudes.agility),
        renderStat('定力', aptitudes.resolve),
      ].join('')}</dl>
    </section>
    <section class="hero-stat-block hero-combat-stats">
      <header><h2>战斗属性</h2><small>已计入等级、职业、心法与装备</small></header>
      <dl>${[
        renderStat('气血', stats.maxHp),
        renderStat('真气', stats.maxEnergy),
        renderStat('初始真气', stats.initialEnergy),
        renderStat('真气回复', stats.energyRecovery),
        renderStat('外功', stats.externalAttack),
        renderStat('内功', stats.internalAttack),
        renderStat('外防', stats.externalDefense),
        renderStat('内防', stats.internalDefense),
        renderStat('有效身法', stats.effectiveAgility),
        renderStat('命中修正', formatPercent(stats.accuracy)),
        renderStat('闪避', formatPercent(stats.evade)),
        renderStat('控制抗性', formatPercent(stats.controlResistance)),
        renderStat('暴击', formatPercent(stats.criticalChance)),
        renderStat('暴击倍率', formatPercent(stats.criticalMultiplier)),
        renderStat('冷却缩减', formatPercent(stats.cooldownRate)),
        renderStat('气机加速', formatPercent(stats.gaugeRate)),
        renderStat('武势加成', formatPercent(stats.momentumBonus)),
        renderStat('生存加成', formatPercent(stats.survivalBonus)),
        renderStat('圆满加成', formatPercent(stats.perfectedBonusPool)),
      ].join('')}</dl>
    </section>
  </div>`
}

const renderEquipmentProperties = (item: HeroesEquipmentView): string => `<dl class="equipment-properties">
  <div><dt>${escapeHtml(item.baseStat.name)}</dt><dd>+${item.baseStat.value}${item.baseStat.percent ? '%' : ''}</dd></div>
  ${item.affixes.map((affix) => `<div><dt>${escapeHtml(affix.name)}</dt><dd>+${affix.value}${affix.percent ? '%' : ''}</dd></div>`).join('')}
</dl>`

const renderEquipmentTooltip = (item: HeroesEquipmentView, comparison: HeroesEquipmentView | null = null): string =>
  `<div class="equipment-tooltip" role="tooltip" popover="manual">
    <header><span>${escapeHtml(item.slotName)} · Lv.${item.level}</span><strong data-rarity="${escapeHtml(item.quality)}">${escapeHtml(item.name)}</strong><em>${escapeHtml(item.quality)}${item.locked ? ' · 已锁定' : ''}</em></header>
    <div class="equipment-tooltip-columns">
      <section><small>${comparison ? '当前查看' : '装备属性'}</small>${renderEquipmentProperties(item)}</section>
      ${comparison ? `<section class="equipment-compare"><small>当前穿戴</small><strong>${escapeHtml(comparison.name)}</strong>${renderEquipmentProperties(comparison)}</section>` : ''}
    </div>
    <footer>${item.equippedByHeroName ? `由 ${escapeHtml(item.equippedByHeroName)} 穿戴` : '双击左键或右键，为当前侠客装备'}</footer>
  </div>`

const renderEquipmentSlots = (hero: HeroesHeroView): string => `<section class="hero-equipment-section" data-testid="hero-equipment-slots">
  <header><h2>装备栏</h2><small>悬停装备格查看属性</small></header>
  <div class="hero-equipment-grid">${hero.equipmentSlots.map((slot) => {
    const item = slot.equipment
    return `<article class="hero-equipment-slot${item ? ' equipped' : ''}" data-slot="${slot.id}" ${item ? `data-rarity="${escapeHtml(item.quality)}"` : ''} data-testid="hero-equipment-slot-${slot.id}">
      <span>${escapeHtml(slot.name)}</span>
      <strong>${item ? escapeHtml(item.name) : '未装备'}</strong>
      ${item ? `<small>${escapeHtml(item.quality)} · Lv.${item.level}</small>${renderEquipmentArt(slot.id, item.definitionId)}<button type="button" data-action="equipment-unequip" data-hero-id="${hero.id}" data-slot="${slot.id}">卸下</button>${renderEquipmentTooltip(item)}` : `<small>空</small>${renderEquipmentArt(slot.id)}`}
    </article>`
  }).join('')}</div>
</section>`

const renderInventoryPanel = (view: HeroesPageViewModel, selected: HeroesHeroView | undefined): string => {
  const filteredItems = view.inventoryItems.filter((item) =>
    (view.inventorySlotFilter === 'all' || item.slot === view.inventorySlotFilter)
    && (view.inventoryQualityFilter === 'all' || item.quality === view.inventoryQualityFilter))
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / HERO_INVENTORY_PAGE_SIZE))
  const page = Math.min(pageCount, Math.max(1, view.inventoryPage))
  const visibleItems = filteredItems.slice((page - 1) * HERO_INVENTORY_PAGE_SIZE, page * HERO_INVENTORY_PAGE_SIZE)
  const batchDiscardThreshold = view.batchDiscardQuality
  const batchDiscardCount = batchDiscardThreshold === 'all'
    ? 0
    : view.inventoryItems.filter((item) =>
        EQUIPMENT_QUALITIES.indexOf(item.quality) <= EQUIPMENT_QUALITIES.indexOf(batchDiscardThreshold)
        && !item.locked
        && !item.equippedByHeroId).length
  return `<aside class="hero-inventory-panel panel" data-testid="hero-inventory-panel">
    <header><div><small>物品</small><strong>${filteredItems.length} 件</strong></div><span>${view.inventoryItems.length} / ${view.inventoryCapacity}</span></header>
    <div class="hero-inventory-tools">
      <label>部位<select data-hero-inventory-filter="slot"><option value="all">全部部位</option>${selected?.equipmentSlots.map((slot) => `<option value="${slot.id}" ${view.inventorySlotFilter === slot.id ? 'selected' : ''}>${escapeHtml(slot.name)}</option>`).join('') ?? ''}</select></label>
      <label>品质<select data-hero-inventory-filter="quality"><option value="all">全部品质</option>${EQUIPMENT_QUALITIES.map((quality) => `<option value="${quality}" ${view.inventoryQualityFilter === quality ? 'selected' : ''}>${quality}</option>`).join('')}</select></label>
      <label>丢弃≤<select data-batch-discard-quality><option value="all">选择品质</option>${EQUIPMENT_QUALITIES.map((quality) => `<option value="${quality}" ${view.batchDiscardQuality === quality ? 'selected' : ''}>${quality}</option>`).join('')}</select></label>
      <button type="button" data-action="organize-hero-inventory">整理</button>
      <button type="button" data-action="request-batch-discard" ${view.batchDiscardQuality === 'all' ? 'disabled' : ''}>批量丢弃</button>
    </div>
    ${view.batchDiscardConfirm && batchDiscardThreshold !== 'all'
      ? `<div class="batch-discard-confirm" role="alertdialog" aria-label="确认批量丢弃">
          <strong>确认丢弃 ${batchDiscardCount} 件装备？</strong>
          <span>品质 ≤${escapeHtml(batchDiscardThreshold)} · 不含已装备与已锁定</span>
          <button type="button" class="danger" data-action="confirm-batch-discard" ${batchDiscardCount === 0 ? 'disabled' : ''}>确认丢弃</button>
          <button type="button" data-action="cancel-batch-discard">取消</button>
        </div>`
      : ''}
    <div class="hero-inventory-viewport"><div class="hero-inventory-list${visibleItems.length > 10 ? ' dense' : ''}">${visibleItems.map((item) => {
      const comparison = selected?.equipmentSlots.find((slot) => slot.id === item.slot)?.equipment ?? null
      const isSelectedHeroEquipment = item.equippedByHeroId === selected?.id
      return `<button type="button" class="hero-inventory-item${isSelectedHeroEquipment ? ' current' : item.equippedByHeroId ? ' occupied' : ''}" data-equipment-uid="${item.uid}" data-rarity="${escapeHtml(item.quality)}" data-testid="hero-inventory-item-${item.uid}" aria-label="查看 ${escapeHtml(item.name)}">
        <span>${escapeHtml(item.slotName)}</span><strong>${escapeHtml(item.name)}</strong><em>${escapeHtml(item.quality)}</em>${renderEquipmentArt(item.slot, item.definitionId)}<small>Lv.${item.level}${isSelectedHeroEquipment ? ' · 已装备' : item.equippedByHeroName ? ` · ${escapeHtml(item.equippedByHeroName)}` : ''}</small>
        ${renderEquipmentTooltip(item, comparison?.uid === item.uid ? null : comparison)}
      </button>`
    }).join('') || '<div class="hero-inventory-empty"><strong>暂无符合条件的物品</strong><span>调整筛选条件，或前往江湖战斗获取装备。</span></div>'}</div></div>
    <nav class="hero-inventory-pagination" aria-label="物品分页">
      <button type="button" data-action="hero-inventory-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
      <div>${Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => `<button type="button" data-action="hero-inventory-page" data-page="${pageNumber}" class="${pageNumber === page ? 'active' : ''}" aria-current="${pageNumber === page ? 'page' : 'false'}">${pageNumber}</button>`).join('')}</div>
      <span>第 ${page} / ${pageCount} 页 · 本页 ${visibleItems.length} 件</span>
      <button type="button" data-action="hero-inventory-page" data-page="${page + 1}" ${page >= pageCount ? 'disabled' : ''}>下一页</button>
    </nav>
    <footer>单击查看 · 双击左键或右键装备</footer>
  </aside>`
}

export const renderHeroesPage = (view: HeroesPageViewModel): string => {
  const selected = view.heroes.find((hero) => hero.id === view.selectedHeroId) ?? view.heroes[0]
  return `<section class="heroes-layout" data-testid="heroes-page">
    <aside class="hero-roster panel">
      <header><small>已邀侠客</small><strong>${view.heroes.length} 人</strong></header>
      <div class="hero-list">${view.heroes.map((hero) => `<button type="button" data-action="select-hero" data-hero-id="${hero.id}" data-testid="hero-${hero.id}" class="hero-row${hero.id === selected?.id ? ' active' : ''}">
        <span class="hero-roster-medallion" data-rarity="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span><strong>${escapeHtml(hero.name)}</strong><small>侠客 Lv.${hero.level}</small>${hero.id === selected?.id ? '<em>当前</em>' : ''}
      </button>`).join('')}</div>
      <div class="hero-roster-landscape" aria-hidden="true"></div>
    </aside>
    <section class="hero-workbench">
      ${selected ? `<section class="hero-detail panel" data-testid="selected-hero">
        <header class="hero-detail-heading"><span class="hero-medallion" aria-hidden="true">${escapeHtml(selected.grade)}</span><div><small>${escapeHtml(selected.grade)}品侠客</small><h1>${escapeHtml(selected.name)}</h1><p>侠客 · 行走江湖</p></div><strong>侠客 Lv.${selected.level}</strong><i aria-hidden="true">侠<br>之<br>道</i></header>
        <div class="hero-detail-scroll">
          ${renderHeroStats(selected)}
          ${renderEquipmentSlots(selected)}
          <div class="career-summary"><span>当前职业</span><strong>${escapeHtml(selected.careerName)}</strong><em>职业 Lv.${selected.careerLevel}</em>
            <button type="button" data-action="career-perfect" data-hero-id="${selected.id}" data-career-id="${selected.careerId}" ${selected.careerLevel < 20 || selected.careerPerfected ? 'disabled' : ''}>${selected.careerPerfected ? '圆满心得已领悟' : '领悟圆满心得'}</button>
          </div>
          <div class="career-options"><h2>转职与切换</h2>${view.careers.map((career) => `<article><span>${escapeHtml(career.tier)}</span><strong>${escapeHtml(career.name)}</strong><small>${career.owned ? '已解锁' : career.tokenOwned ? '信物已备' : '缺少信物'}</small><button type="button" data-action="career-change" data-hero-id="${selected.id}" data-career-id="${career.id}">${career.owned ? '切换' : '转职'}</button></article>`).join('')}</div>
          <div class="martial-workbench"><h2>四槽武功 · 优先级</h2><div class="martial-slots">${selected.equippedMartialIds.map((martialId, slot) => `<article data-testid="martial-slot-${slot + 1}"><span>${slot + 1}</span><strong>${escapeHtml(view.martials.find((item) => item.id === martialId)?.name ?? '空槽')}</strong>${martialId ? `<button type="button" data-action="martial-unequip" data-hero-id="${selected.id}" data-slot="${slot}">卸下</button>` : ''}</article>`).join('')}</div>
            <div class="learned-martials">${selected.learnedMartials.map((martial) => `<article data-rarity="${escapeHtml(martial.rarity)}"><div><strong>${escapeHtml(martial.name)}</strong><small>${escapeHtml(martial.rarity)} · Lv.${martial.level}</small></div><button type="button" data-action="martial-upgrade" data-hero-id="${selected.id}" data-martial-id="${martial.id}">升级</button>${[0, 1, 2, 3].map((slot) => `<button type="button" data-action="martial-equip" data-hero-id="${selected.id}" data-martial-id="${martial.id}" data-slot="${slot}">槽 ${slot + 1}</button>`).join('')}<button type="button" data-action="martial-forget" data-hero-id="${selected.id}" data-martial-id="${martial.id}">遗忘返还 80%</button></article>`).join('') || '<p>尚未学会武功</p>'}</div>
          </div>
          <div class="heart-methods"><h2>主修心法</h2>${view.heartMethods.map((method) => `<button type="button" data-action="heart-method-equip" data-hero-id="${selected.id}" data-heart-method-id="${method.id}" class="${method.equipped ? 'active' : ''}">${escapeHtml(method.name)}</button>`).join('') || '<span>尚无可用心法</span>'}</div>
        </div>
      </section>` : '<section class="hero-detail panel"><strong>尚无侠客</strong><span>前往城市酒馆直接邀请。</span></section>'}
    </section>
    ${renderInventoryPanel(view, selected)}
  </section>`
}
