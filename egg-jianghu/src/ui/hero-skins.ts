import { ATTRIBUTE_BY_ID } from '../content/attributes'
import { heroByIdV10 } from '../content/heroes'
import { ownedSkinAttributes, skinsForHero, skinStars, skinUpgradeCost, skinAttributeValue, ownsSkin, SKIN_TYPE_NAMES } from '../content/hero-skins'
import type { GameStateV10 } from '../domain/types'
import { originalSkinAsset, heroAppearanceAsset } from './hero-appearance-assets'
import { escapeHtml } from './html'

export const renderHeroSkins = (state: GameStateV10, heroId: string, locked: boolean): string => {
  const definition = heroByIdV10(heroId)
  const hero = state.heroes[heroId]
  if (!definition || !hero) return ''
  const skins = skinsForHero(definition)
  const bonuses = ownedSkinAttributes(definition, hero, state.unlockedSkinIds)
  const attrText = (id: number, value: number) => `${ATTRIBUTE_BY_ID[id]?.name ?? id} +${value}%`
  const currentUrl = heroAppearanceAsset(heroId, hero, state.unlockedSkinIds)
  const cards = skins.map(skin => {
    const owned = ownsSkin(skin, state.unlockedSkinIds)
    const stars = skinStars(hero, skin)
    const cost = skinUpgradeCost(hero, skin)
    const selected = owned && hero.selectedSkinId === skin.id
    const bonus = skin.attributeIds.map(id => attrText(id, skinAttributeValue(skin.type, stars))).join(' · ')
    return `<article class="hero-skin-card${selected ? ' selected' : ''}" data-testid="skin-${skin.id}">
      <img src="${escapeHtml(originalSkinAsset(skin.id))}" alt="${escapeHtml(definition.name)} · ${SKIN_TYPE_NAMES[skin.type]}" loading="lazy">
      <div class="hero-skin-info"><h3>${escapeHtml(SKIN_TYPE_NAMES[skin.type])} · ${escapeHtml(skin.imageKey.replace(/\d+$/, ''))} <small>${owned ? `${stars} / 10 星` : '未拥有'}</small></h3>
      <p>${escapeHtml(bonus)}</p><p class="skin-source">${skin.source.includes('免费') ? '免费开放' : `获取：${escapeHtml(skin.source)}`}</p>
      <div class="hero-skin-actions"><button type="button" data-action="skin-select" data-hero-id="${heroId}" data-skin-id="${skin.id}" ${locked || !owned || selected ? 'disabled' : ''}>${selected ? '使用中' : '使用外观'}</button>
      <button type="button" data-action="skin-upgrade" data-hero-id="${heroId}" data-skin-id="${skin.id}" ${locked || !owned || stars >= 10 || (state.materials['10'] ?? 0) < cost ? 'disabled' : ''}>${stars >= 10 ? '已满星' : `升星 · ${cost} 幻化石`}</button></div></div>
    </article>`
  }).join('')
  return `<section class="hero-skins" data-testid="hero-skins"><header><h2>皮肤 · 幻型</h2><span>幻化石：<b data-testid="skin-stones">${state.materials['10'] ?? 0}</b></span></header>
    <p>已拥有的皮肤加成累计生效，切换外观不损失加成。同品质外观共享星级和加成。</p>
    <p class="skin-total" data-testid="skin-total">累计加成：${Object.entries(bonuses).map(([id, value]) => escapeHtml(attrText(Number(id), value))).join(' · ') || '暂无'}</p>
    ${locked ? '<p role="status">战斗期间可查看，结束或退出战斗后可切换、升星。</p>' : ''}
    <article class="hero-skin-card"><img src="${escapeHtml(heroAppearanceAsset(heroId))}" alt="${escapeHtml(definition.name)}本体"><div class="hero-skin-info"><h3>本体</h3><p>角色原有外观</p><button type="button" data-action="skin-select" data-hero-id="${heroId}" data-skin-id="0" ${locked || currentUrl === heroAppearanceAsset(heroId) ? 'disabled' : ''}>${currentUrl === heroAppearanceAsset(heroId) ? '使用中' : '恢复本体'}</button></div></article>
    ${cards || '<p>这位侠客暂无专属皮肤。</p>'}
  </section>`
}
