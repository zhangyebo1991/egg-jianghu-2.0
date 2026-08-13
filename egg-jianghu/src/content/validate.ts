import { CAREERS } from './careers'
import { STAGE_ENEMIES, type StageEnemyGroup } from './enemies'
import { EQUIPMENT_SLOTS } from './equipment'
import { EQUIPMENT_NAMES_BY_WORLD } from './equipment-names'
import { FACTIONS, RARITY_BUDGET_BY_WORLD } from './factions'
import { FACTION_MARTIALS } from './martials'
import { HEROES_V10 } from './heroes'
import { WORLDS } from './worlds'

export const validateContent = (): string[] => {
  const errors: string[] = []
  const careerIds = new Set(CAREERS.map((item) => item.id))
  const factionIds = new Set(FACTIONS.map((item) => item.id))
  const worldIds = new Set(WORLDS.map((item) => item.id))
  const martialIds = new Set(FACTION_MARTIALS.map((item) => item.id))

  if (careerIds.size !== CAREERS.length) errors.push('职业 id 重复')
  if (factionIds.size !== FACTIONS.length) errors.push('势力 id 重复')
  if (worldIds.size !== WORLDS.length) errors.push('江湖卷 id 重复')
  if (martialIds.size !== FACTION_MARTIALS.length) errors.push('势力武功 id 重复')

  for (const career of CAREERS) {
    for (const requirement of career.requirements) {
      if (!careerIds.has(requirement.careerId)) errors.push(`${career.id} 前置职业不存在`)
    }
  }

  for (const faction of FACTIONS) {
    if (!worldIds.has(faction.worldId)) errors.push(`${faction.id} 引用了未知江湖卷 ${faction.worldId}`)
    if (FACTION_MARTIALS.filter((martial) => martial.factionId === faction.id).length !== 8) {
      errors.push(`${faction.id} 武功数不是 8`)
    }
  }

  for (const martial of FACTION_MARTIALS) {
    if (!factionIds.has(martial.factionId ?? '')) errors.push(`${martial.id} 引用了未知势力`)
    if (martial.previousId && !martialIds.has(martial.previousId)) errors.push(`${martial.id} 前置武功不存在`)
    if (martial.previousId && martial.previousId.slice(-1) !== martial.id.slice(-1)) {
      errors.push(`${martial.id} 前置武功串线`)
    }
  }

  for (const world of WORLDS) {
    if (world.stageIds.length !== 10) errors.push(`${world.id} 小关数不是 10`)
    if (world.factionIds.length !== 0 && world.factionIds.length !== 3) {
      errors.push(`${world.id} 势力数不是 3`)
    }
    for (let stage = 1; stage <= 10; stage += 1) {
      const group = STAGE_ENEMIES[`${world.id}:${stage}`]
      if (!group) {
        errors.push(`${world.id} 第 ${stage} 关缺少怪物表`)
        continue
      }
      if (group.mobs.some((mob) => !mob.name.trim())) errors.push(`${world.id} 第 ${stage} 关小怪名为空`)
      if (!group.boss.name.trim()) errors.push(`${world.id} 第 ${stage} 关首领名为空`)
    }
    const equipmentNames = EQUIPMENT_NAMES_BY_WORLD[world.id]
    if (equipmentNames) {
      for (const slot of EQUIPMENT_SLOTS) {
        if (!equipmentNames[slot]?.trim()) errors.push(`${world.id} 缺少${slot}装备名`)
      }
    }
    const budget = RARITY_BUDGET_BY_WORLD[world.id]
    if (budget && budget.length !== 8) {
      errors.push(`${world.id} 稀有度预算不是 8`)
    }
    for (const id of world.factionIds) {
      if (!factionIds.has(id)) errors.push(`${world.id} 引用了未知势力 ${id}`)
    }
  }

  const seenBosses = new Set<string>()
  for (const world of WORLDS) {
    for (let stage = 1; stage <= 10; stage += 1) {
      const boss = STAGE_ENEMIES[`${world.id}:${stage}`]?.boss.name
      if (!boss) continue
      if (seenBosses.has(boss)) errors.push(`Boss 名重复：${boss}`)
      seenBosses.add(boss)
    }
  }

  const seenEquipmentNames = new Set<string>()
  for (const world of WORLDS) {
    for (const slot of EQUIPMENT_SLOTS) {
      const name = EQUIPMENT_NAMES_BY_WORLD[world.id]?.[slot]
      if (!name) continue
      if (seenEquipmentNames.has(name)) errors.push(`装备名重复：${name}`)
      seenEquipmentNames.add(name)
    }
  }

  const heroIds = new Set(HEROES_V10.map((hero) => hero.id))
  if (heroIds.size !== HEROES_V10.length) errors.push('侠客 id 重复')

  for (const world of WORLDS) {
    const tavernHeroes = HEROES_V10.filter((hero) => hero.source === 'tavern' && hero.worldId === world.id)
    if (tavernHeroes.length !== 0 && tavernHeroes.length !== 3) errors.push(`${world.id} 酒馆侠客数不是 3`)
  }

  const factionHeroCounts = new Map<string, number>()
  for (const hero of HEROES_V10) {
    if (hero.source !== 'faction') continue
    const factionId = hero.factionId
    if (!factionId) {
      errors.push(`${hero.id} 引用了未知势力`)
      continue
    }
    const faction = FACTIONS.find((item) => item.id === factionId)
    if (!faction) {
      errors.push(`${hero.id} 引用了未知势力`)
      continue
    }
    factionHeroCounts.set(factionId, (factionHeroCounts.get(factionId) ?? 0) + 1)
    if (!WORLDS.find((world) => world.id === faction.worldId)) {
      errors.push(`${hero.id} 所属势力不在位面目录`)
    }
  }
  for (const [factionId, count] of factionHeroCounts) {
    if (count !== 3) errors.push(`${factionId} 势力侠客数不是 3`)
  }

  const groupNames = (group: StageEnemyGroup | undefined): string[] =>
    group ? [...group.mobs.map((mob) => mob.name), group.boss.name] : []
  const sameWorldEnemy = (hero: { worldId: string; name: string }): boolean => {
    for (let stage = 1; stage <= 10; stage += 1) {
      if (groupNames(STAGE_ENEMIES[`${hero.worldId}:${stage}`]).includes(hero.name)) return true
    }
    return false
  }
  for (const hero of HEROES_V10) {
    if (hero.source === 'starter') continue
    if (sameWorldEnemy(hero)) errors.push(`${hero.id} 与 ${hero.worldId} 敌人/BOSS 重名：${hero.name}`)
  }

  return errors
}
