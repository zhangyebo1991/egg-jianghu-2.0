import { HEROES_V10, PLAYER_HERO_ID, heroDisplayNameV10 } from '../content/heroes'
import type { ActionResult, GameStateV10 } from './types'

const knownWorld = (state: GameStateV10, worldId: string): boolean =>
  state.unlockedWorldIds.includes(worldId)

export const factionAgentCandidateIds = (state: GameStateV10): string[] =>
  HEROES_V10.flatMap((hero) => {
    if (hero.id === PLAYER_HERO_ID || !state.heroes[hero.id]?.recruited) return []
    return [hero.id]
  })

export const appointFactionAgent = (
  state: GameStateV10,
  worldId: string,
  heroId: string,
  fightingHeroIds: ReadonlySet<string> = new Set(),
): ActionResult => {
  if (!knownWorld(state, worldId)) return { ok: false, message: '位面尚未解锁' }
  const definition = HEROES_V10.find((hero) => hero.id === heroId)
  const progress = state.heroes[heroId]
  if (!definition || !progress?.recruited) return { ok: false, message: '该侠客尚未加入' }
  if (heroId === PLAYER_HERO_ID) return { ok: false, message: '主角不能担任位面代理人' }
  if (fightingHeroIds.has(heroId)) return { ok: false, message: '该侠客正在战斗中，暂不能任命' }

  state.factionAgents[worldId] = { heroId, enabled: true }
  return { ok: true, message: `已任命${heroDisplayNameV10(definition, progress)}为位面代理人` }
}

export const dismissFactionAgent = (state: GameStateV10, worldId: string): ActionResult => {
  if (!knownWorld(state, worldId)) return { ok: false, message: '位面尚未解锁' }
  const current = state.factionAgents[worldId]
  if (!current?.heroId) return { ok: false, message: '当前位面尚未任命代理人' }

  // 原版“代理人任命function”的卸任分支会清空角色列，并把开关列写为 1。
  state.factionAgents[worldId] = { heroId: null, enabled: true }
  return { ok: true, message: '已卸任当前位面代理人' }
}

export const toggleFactionAgent = (state: GameStateV10, worldId: string): ActionResult => {
  if (!knownWorld(state, worldId)) return { ok: false, message: '位面尚未解锁' }
  const current = state.factionAgents[worldId] ?? { heroId: null, enabled: false }
  const enabled = !current.enabled
  state.factionAgents[worldId] = { ...current, enabled }
  return { ok: true, message: enabled ? '已开启位面代理人' : '已关闭位面代理人' }
}
