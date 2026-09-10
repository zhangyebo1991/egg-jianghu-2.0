import { describe, expect, it } from 'vitest'
import { ORIGINAL_HERO_APPEARANCES, HERO_SKINS } from '../content/hero-skins.generated'
import { HEROES_V10 } from '../content/heroes'
import { heroAppearanceAsset, originalSkinAsset } from './hero-appearance-assets'
import { createNewGameStateV10 } from '../domain/state'

describe('角色及皮肤图片映射', () => {
  const assets = import.meta.glob('../assets/heroes/original/*.webp', { eager: true, import: 'default' })
  it('193角色与267皮肤全部有提取文件，原版英雄不用统一图兜底', () => {
    for (const hero of ORIGINAL_HERO_APPEARANCES) expect(assets[`../assets/heroes/original/hero_${hero.id}.webp`]).toBeTruthy()
    for (const skin of HERO_SKINS) expect(originalSkinAsset(skin.id)).toBeTruthy()
    for (const hero of HEROES_V10.filter(h => h.sourceId)) expect(heroAppearanceAsset(hero.id)).toContain(`hero_${hero.sourceId}`)
    expect(heroAppearanceAsset('hero_guo_jing')).not.toBe(heroAppearanceAsset('hero_mu_nianci'))
  })
  it('合法已拥有外观才生效，错误角色和未拥有皮肤回退本体', () => {
    const hero = createNewGameStateV10('形象').heroes.hero_player
    hero.selectedSkinId = 212
    expect(heroAppearanceAsset('hero_player', hero)).toBe(originalSkinAsset(212))
    hero.selectedSkinId = 214
    expect(heroAppearanceAsset('hero_player', hero)).toBe(heroAppearanceAsset('hero_player'))
    expect(heroAppearanceAsset('hero_player', hero, [214])).toBe(originalSkinAsset(214))
    hero.selectedSkinId = 1
    expect(heroAppearanceAsset('hero_player', hero, [1])).toBe(heroAppearanceAsset('hero_player'))
  })
})
