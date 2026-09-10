import { heroByIdV10 } from '../content/heroes'
import { skinById, ownsSkin } from '../content/hero-skins'
import { heroPortraitAsset } from './portrait-assets'
import type { HeroProgressV10 } from '../domain/types'

const images = import.meta.glob<string>('../assets/heroes/original/*.webp', { eager: true, import: 'default' })
export const originalSkinAsset = (skinId: number): string => images[`../assets/heroes/original/skin_${skinId}.webp`] ?? ''
export const heroAppearanceAsset = (heroId: string, progress?: HeroProgressV10, unlockedIds: readonly number[] = []): string => {
  const definition = heroByIdV10(heroId)
  const skin = skinById(progress?.selectedSkinId ?? 0)
  if (skin && skin.heroSourceId === definition?.sourceId && ownsSkin(skin, unlockedIds)) return originalSkinAsset(skin.id)
  return images[`../assets/heroes/original/hero_${definition?.sourceId}.webp`] ?? heroPortraitAsset(heroId).url
}
