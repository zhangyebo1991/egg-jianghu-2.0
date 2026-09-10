import { HERO_SKINS } from './hero-skins.generated'
import type { HeroDefinitionV10 } from './heroes'
import type { HeroProgressV10 } from '../domain/types'
import type { AttributeMap } from './attributes'

export const SKIN_MAX_STARS = 10
export const SKIN_TYPE_NAMES: Record<number, string> = { 2: '特殊', 3: '稀有', 4: '典藏', 5: '限定', 6: '传说', 7: '神话', 8: '终极' }
export type HeroSkin = (typeof HERO_SKINS)[number]
export const skinById = (id: number): HeroSkin | undefined => HERO_SKINS.find(skin => skin.id === id)
export const skinsForHero = (hero: HeroDefinitionV10): readonly HeroSkin[] => HERO_SKINS.filter(skin => skin.heroSourceId === hero.sourceId)
// 已包含在本地原版资源中的免费幻型随对应角色开放。
export const ownsSkin = (skin: HeroSkin, unlockedIds: readonly number[]): boolean => skin.source.includes('免费') || unlockedIds.includes(skin.id)
export const skinStars = (hero: HeroProgressV10, skin: HeroSkin): number => Math.max(1, Math.min(SKIN_MAX_STARS, hero.skinStars?.[String(skin.type)] ?? 1))
export const skinUpgradeCost = (hero: HeroProgressV10, skin: HeroSkin): number => skinStars(hero, skin) * skin.type ** 2
export const skinAttributeValue = (type: number, stars: number): number => type * 0.25 * stars

/** 同一角色同品质幻型共享星级和加成；外观选择不改变已拥有加成。 */
export const ownedSkinAttributes = (definition: HeroDefinitionV10, progress: HeroProgressV10, unlockedIds: readonly number[]): AttributeMap => {
  const result: AttributeMap = {}
  const seen = new Set<string>()
  for (const skin of skinsForHero(definition)) {
    if (!ownsSkin(skin, unlockedIds)) continue
    for (const id of skin.attributeIds) {
      const key = `${skin.type}:${id}`
      if (seen.has(key)) continue
      seen.add(key)
      result[id] = (result[id] ?? 0) + skinAttributeValue(skin.type, skinStars(progress, skin))
    }
  }
  return result
}
