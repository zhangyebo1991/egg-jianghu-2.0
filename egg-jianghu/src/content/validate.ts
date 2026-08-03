import { CAREERS } from './careers'
import { ENEMY_NAMES_BY_WORLD } from './enemy-names'
import { EQUIPMENT_SLOTS } from './equipment'
import { EQUIPMENT_NAMES_BY_WORLD } from './equipment-names'
import { FACTIONS, RARITY_BUDGET_BY_WORLD } from './factions'
import { FACTION_MARTIALS } from './martials'
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
    if (career.previousId && !careerIds.has(career.previousId)) errors.push(`${career.id} 前置职业不存在`)
    if (career.nextId && !careerIds.has(career.nextId)) errors.push(`${career.id} 后继职业不存在`)
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
    if (world.released) {
      if (world.stageIds.length !== 10) errors.push(`${world.id} 小关数不是 10`)
      if (world.factionIds.length !== 3) errors.push(`${world.id} 势力数不是 3`)
      if (RARITY_BUDGET_BY_WORLD[world.id]?.length !== 8) errors.push(`${world.id} 稀有度预算不是 8`)
      const names = ENEMY_NAMES_BY_WORLD[world.id]
      if (!names) {
        errors.push(`${world.id} 缺少敌人命名表`)
      } else {
        if (names.bosses.length !== 10) errors.push(`${world.id} Boss 数不是 10`)
        if (names.normal.length < 6) errors.push(`${world.id} 普通小怪名少于 6`)
        if (names.elite.length < 3) errors.push(`${world.id} 精英名少于 3`)
      }
      const equipmentNames = EQUIPMENT_NAMES_BY_WORLD[world.id]
      if (!equipmentNames) {
        errors.push(`${world.id} 缺少装备命名表`)
      } else {
        for (const slot of EQUIPMENT_SLOTS) {
          if (!equipmentNames[slot]?.trim()) errors.push(`${world.id} 缺少${slot}装备名`)
        }
      }
    } else {
      if (world.stageIds.length !== 0) errors.push(`${world.id} 未开放卷不应有小关`)
      if (world.factionIds.length !== 0) errors.push(`${world.id} 未开放卷不应有势力`)
    }
    for (const id of world.factionIds) {
      if (!factionIds.has(id)) errors.push(`${world.id} 引用了未知势力 ${id}`)
    }
  }

  const seenBosses = new Set<string>()
  for (const world of WORLDS) {
    if (!world.released) continue
    for (const boss of ENEMY_NAMES_BY_WORLD[world.id]?.bosses ?? []) {
      if (seenBosses.has(boss)) errors.push(`Boss 名重复：${boss}`)
      seenBosses.add(boss)
    }
  }

  const seenEquipmentNames = new Set<string>()
  for (const world of WORLDS) {
    if (!world.released) continue
    for (const slot of EQUIPMENT_SLOTS) {
      const name = EQUIPMENT_NAMES_BY_WORLD[world.id]?.[slot]
      if (!name) continue
      if (seenEquipmentNames.has(name)) errors.push(`装备名重复：${name}`)
      seenEquipmentNames.add(name)
    }
  }

  return errors
}
