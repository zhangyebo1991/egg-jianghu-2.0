import { ATTRIBUTE_BY_ID } from '../content/attributes'
import { equipmentDefinitionById } from '../content/equipment'
import { HEROES_V10, PLAYER_HERO_ID, heroByIdV10, heroDisplayNameV10 } from '../content/heroes'
import {
  originalFactionAgentContributionMultiplier,
  originalFactionAgentReputationMultiplier,
} from '../content/original-faction-rules.generated'
import {
  ORIGINAL_ABILITY_ID_STRATEGY,
  ORIGINAL_ABILITY_MAX_LEVEL,
  originalHeroAbilityBase,
} from '../content/original-hero-abilities.generated'
import type { ActionResult, EquipmentInstance, GameStateV10, HeroProgressV10 } from './types'

const AGENT_ABILITY_ID = ORIGINAL_ABILITY_ID_STRATEGY

/** 原版「能力」组属性 id = 101 + 能力编号（能力 1..10 对应 sx 102..111）。 */
const abilityAttributeId = (abilityId: number): number => 101 + abilityId

/**
 * 复算原版 `特定属性统计(角色, 101 + 能力编号, "")` 落在「能力」组上的形态。
 *
 * 能力组属性的计算类型均为「固定」，原版 `通用单条属性` 对该类型返回
 * floor(sx[属性].默认值 / 100)——即每条命中的装备词条恒定加 1，与品质系数、装备等级、
 * 强化星级都无关。所以这里只统计命中条数，不读 fixedEffects.value：那个值来自 wp 列 12，
 * 对「固定」类属性不参与结算（原版给计略加值的孙子兵法与全息战系统各只 +1，而非 +50/+150）。
 *
 * 原版同分支还累加技能/命石/命格/灵兽/副官/套装六路，但在原版数据中它们对能力组
 * 全为零贡献（装备随机词条池值域只到 59，永不命中能力组）；强化特殊词条走 qh 表，
 * 本作没有装备强化系统。截顶取 sx[属性] 第 8 列，即属性表的 capMin。
 */
export const originalAbilityAttributeBonus = (
  progress: HeroProgressV10,
  equipment: readonly EquipmentInstance[],
  abilityId: number,
): number => {
  const attribute = ATTRIBUTE_BY_ID[abilityAttributeId(abilityId)]
  if (attribute?.calcType !== '固定') return 0
  const perEntry = Math.floor(attribute.default / 100)
  let total = 0
  for (const uid of Object.values(progress.equipmentBySlot)) {
    if (!uid) continue
    const instance = equipment.find((item) => item.uid === uid)
    const definition = instance ? equipmentDefinitionById(instance.definitionId) : undefined
    for (const effect of definition?.fixedEffects ?? []) {
      if (effect.attributeId === attribute.id) total += perEntry
    }
  }
  return Math.min(attribute.capMin, total)
}

export const originalFinalAbilityLevel = (
  baseLevel: number,
  trainedLevel: number,
  attributeBonus = 0,
): number => Math.min(
  ORIGINAL_ABILITY_MAX_LEVEL,
  Math.max(0, Math.round(baseLevel + trainedLevel + attributeBonus)),
)

export const factionAgentAbilityLevel = (state: GameStateV10, worldId: string): number => {
  const heroId = state.factionAgents[worldId]?.heroId
  if (!heroId) return 0
  const progress = state.heroes[heroId]
  if (!progress?.recruited) return 0
  // 原版 Event 1598 三项：js 白板 + save 培养 + 特定属性统计（装备）。
  // 本作自创侠客无原版角色列，白板为 0。
  return originalFinalAbilityLevel(
    originalHeroAbilityBase(heroByIdV10(heroId)?.sourceId, AGENT_ABILITY_ID),
    progress.abilityTraining?.[String(AGENT_ABILITY_ID)] ?? 0,
    originalAbilityAttributeBonus(progress, state.inventory, AGENT_ABILITY_ID),
  )
}

export const applyFactionQuestAgentReward = <T extends { currency: number; contribution: number; reputation: number }>(
  reward: T,
  abilityLevel: number,
): T => ({
  ...reward,
  contribution: Math.round(reward.contribution * originalFactionAgentContributionMultiplier(abilityLevel)),
  reputation: Math.round(reward.reputation * originalFactionAgentReputationMultiplier(abilityLevel)),
})

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

  // 原版「代理人任命function」(Event 11656) 写角色列后把开关列写为 1，而开关列 1 = 关闭，
  // 即任命后自动化默认不启用，需玩家手动开启。奖励加成只看角色列，与开关无关。
  state.factionAgents[worldId] = { heroId, enabled: false }
  return { ok: true, message: `已任命${heroDisplayNameV10(definition, progress)}为位面代理人` }
}

export const dismissFactionAgent = (state: GameStateV10, worldId: string): ActionResult => {
  if (!knownWorld(state, worldId)) return { ok: false, message: '位面尚未解锁' }
  const current = state.factionAgents[worldId]
  if (!current?.heroId) return { ok: false, message: '当前位面尚未任命代理人' }

  // 原版卸任分支同样清空角色列并把开关列写为 1（= 关闭）。
  state.factionAgents[worldId] = { heroId: null, enabled: false }
  return { ok: true, message: '已卸任当前位面代理人' }
}

export const toggleFactionAgent = (state: GameStateV10, worldId: string): ActionResult => {
  if (!knownWorld(state, worldId)) return { ok: false, message: '位面尚未解锁' }
  const current = state.factionAgents[worldId] ?? { heroId: null, enabled: false }
  const enabled = !current.enabled
  state.factionAgents[worldId] = { ...current, enabled }
  return { ok: true, message: enabled ? '已开启位面代理人' : '已关闭位面代理人' }
}
