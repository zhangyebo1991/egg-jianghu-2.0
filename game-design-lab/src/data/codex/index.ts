/**
 * 技能图鉴数据入口：聚合自动生成的原始数据，派生查询索引与统计。
 *
 * 数据来源：诸天刷宝录 游戏包解包（_analysis/*.json），证据等级 A。
 * 重新生成：python scripts/gen-codex.py
 */
import { factionsRaw } from './factions.generated'
import { skillsRaw } from './skills.generated'
import { passivesRaw } from './passives.generated'
import { charactersRaw } from './characters.generated'
import { itemsRaw } from './items.generated'
import type { Faction, Skill, PassiveSkill, Character, GameItem } from './types'

export type { Faction, Skill, PassiveSkill, Character, GameItem } from './types'

export const factions: Faction[] = factionsRaw
export const skills: Skill[] = skillsRaw
export const passives: PassiveSkill[] = passivesRaw
export const characters: Character[] = charactersRaw
export const items: GameItem[] = itemsRaw

/** 技能 id → 技能 查询表 */
export const skillById: Map<number, Skill> = new Map(skills.map((s) => [s.id, s]))

/** 势力 id → 势力 查询表 */
export const factionById: Map<number, Faction> = new Map(factions.map((f) => [f.id, f]))

/** 元素配色（与 styles.css 中 --c-* 别名协同） */
export const ELEMENT_COLOR: Record<string, string> = {
  雷: 'var(--c-cyan)',
  水: 'var(--c-cyan)',
  火: 'var(--c-orange)',
  木: 'var(--c-green)',
  土: 'var(--orange)',
  精神: 'var(--c-purple)',
  神圣: 'var(--c-gold)',
  黑暗: 'var(--c-fuchsia)',
  无: 'var(--muted)',
}

/** 类别配色 */
export const CATEGORY_COLOR: Record<string, string> = {
  通用: 'var(--muted-strong)',
  战技: 'var(--c-orange)',
  武功: 'var(--c-orange)',
  符咒: 'var(--c-purple)',
  箭弩: 'var(--c-green)',
  方术: 'var(--c-cyan)',
  异能: 'var(--c-fuchsia)',
  神技: 'var(--c-gold)',
  斗气: 'var(--c-red)',
  忍术: 'var(--c-purple)',
  魔法: 'var(--c-cyan)',
  功法: 'var(--c-gold)',
  枪械: 'var(--c-orange)',
  机甲: 'var(--muted-strong)',
  召唤: 'var(--c-green)',
  医术: 'var(--c-green)',
}

/** 取势力教授的技能（过滤掉查不到的 id） */
export function factionSkills(faction: Faction): Skill[] {
  return faction.skillIds.map((id) => skillById.get(id)).filter((s): s is Skill => Boolean(s))
}

/** 取归属于该势力的可招募角色 */
export function factionCharacters(faction: Faction): Character[] {
  return characters.filter((c) => c.factionId === faction.id)
}

/** 取角色的自带技能 */
export function characterSkills(c: Character): Skill[] {
  return c.skillIds.map((id) => skillById.get(id)).filter((s): s is Skill => Boolean(s))
}

/** 系列分组：series 名 → 该系列下的势力列表（保持数据顺序） */
export const factionsBySeries: { series: string; seriesId: number; factions: Faction[] }[] = (() => {
  const order: number[] = []
  const map = new Map<number, Faction[]>()
  for (const f of factions) {
    if (!map.has(f.seriesId)) {
      map.set(f.seriesId, [])
      order.push(f.seriesId)
    }
    map.get(f.seriesId)!.push(f)
  }
  return order.map((seriesId) => ({
    seriesId,
    series: map.get(seriesId)![0].series,
    factions: map.get(seriesId)!,
  }))
})()

/** 图鉴总览统计 */
export const codexStats = {
  factionCount: factions.length,
  seriesCount: factionsBySeries.length,
  skillCount: skills.length,
  passiveCount: passives.length,
  characterCount: characters.length,
  itemCount: items.length,
  get total() {
    return this.skillCount + this.passiveCount + this.characterCount + this.itemCount
  },
}

/** 角色归属势力名（0 → 「无 / 主角」） */
export function factionNameOf(factionId: number): string {
  if (factionId === 0) return '无 / 主角'
  return factionById.get(factionId)?.name ?? '未知'
}
