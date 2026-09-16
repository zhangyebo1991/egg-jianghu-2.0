import { HERO_FIGURE_BOUNDS } from '../content/hero-figure-bounds.generated'
import { heroByIdV10 } from '../content/heroes'
import { skinById, ownsSkin } from '../content/hero-skins'
import { heroPortraitAsset } from './portrait-assets'
import { inkAsset } from './ink-assets'
import type { HeroProgressV10 } from '../domain/types'

const images = import.meta.glob<string>('../assets/heroes/original/*.webp', { eager: true, import: 'default' })
export const originalSkinAsset = (skinId: number): string => inkAsset(`figures/skin_${skinId}`) ?? images[`../assets/heroes/original/skin_${skinId}.webp`] ?? ''
export const heroAppearanceAsset = (heroId: string, progress?: HeroProgressV10, unlockedIds: readonly number[] = []): string => {
  const definition = heroByIdV10(heroId)
  const skin = skinById(progress?.selectedSkinId ?? 0)
  if (skin && skin.heroSourceId === definition?.sourceId && ownsSkin(skin, unlockedIds)) return originalSkinAsset(skin.id)
  return inkAsset(`figures/hero_${definition?.sourceId}`) ?? images[`../assets/heroes/original/hero_${definition?.sourceId}.webp`] ?? heroPortraitAsset(heroId).url
}
const figureBoundsByUrl = new Map(Object.entries(images).map(([path, url]) => [
  url, HERO_FIGURE_BOUNDS[path.split('/').at(-1)!.replace('.webp', '')],
]))

/** 让立绘的可见轮廓填满统一高度，透明边缘不参与缩放基准。 */
export const heroFigureStyle = (url: string): string => {
  const bounds = figureBoundsByUrl.get(url)
  return bounds
    ? `--figure-scale:${bounds.heightScale};--figure-bottom:${bounds.bottomOffset};--figure-center:${bounds.centerOffset}%`
    : ''
}
