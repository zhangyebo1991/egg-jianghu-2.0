import { heroByIdV10 } from '../content/heroes'
import { ownsSkin, skinById, skinStars, skinUpgradeCost, SKIN_MAX_STARS } from '../content/hero-skins'
import type { ActionResult, GameStateV10 } from './types'

const checkSkin = (state: GameStateV10, heroId: string, skinId: number): string | null => {
  if (!state.heroes[heroId]?.recruited) return '侠客尚未招募'
  const skin = skinById(skinId)
  if (!skin || skin.heroSourceId !== heroByIdV10(heroId)?.sourceId) return '该皮肤不属于此侠客'
  if (!ownsSkin(skin, state.unlockedSkinIds)) return '尚未拥有该皮肤'
  return null
}
export const selectHeroSkin = (state: GameStateV10, heroId: string, skinId: number): ActionResult => {
  if (!state.heroes[heroId]?.recruited) return { ok: false, message: '侠客尚未招募' }
  if (skinId !== 0) {
    const error = checkSkin(state, heroId, skinId)
    if (error) return { ok: false, message: error }
  }
  state.heroes[heroId].selectedSkinId = skinId
  return { ok: true, message: skinId === 0 ? '已恢复本体外观' : '已切换皮肤' }
}
export const upgradeHeroSkin = (state: GameStateV10, heroId: string, skinId: number): ActionResult => {
  const error = checkSkin(state, heroId, skinId)
  if (error) return { ok: false, message: error }
  const skin = skinById(skinId)!
  const hero = state.heroes[heroId]
  const stars = skinStars(hero, skin)
  if (stars >= SKIN_MAX_STARS) return { ok: false, message: '皮肤已满星' }
  const cost = skinUpgradeCost(hero, skin)
  if ((state.materials['10'] ?? 0) < cost) return { ok: false, message: '幻化石不足' }
  state.materials['10'] -= cost
  hero.skinStars ??= {}
  hero.skinStars[String(skin.type)] = stars + 1
  return { ok: true, message: `皮肤升至 ${stars + 1} 星` }
}
