import { CAREERS } from './careers'
import { STAGE_ENEMIES, type StageEnemyGroup } from './enemies'
import { COMBAT_EQUIPMENT_SLOTS, equipmentPoolForStage, equipmentPoolForWorld, equipmentSetPoolForStage } from './equipment'
import { FACTIONS, RARITY_BUDGET_BY_WORLD } from './factions'
import { FACTION_MARTIALS } from './martials'
import { HEROES_V10 } from './heroes'
import {
  ORIGINAL_ARTIFACT_SOULS,
  ORIGINAL_DEITIES,
  ORIGINAL_FACTIONS,
  ORIGINAL_INTERWORLD_DROP_ITEMS,
  ORIGINAL_INTERWORLD_ENEMIES,
  ORIGINAL_LARGE_DUNGEONS,
  ORIGINAL_PLAYER_SKILLS,
  ORIGINAL_SACRED_BEASTS,
  ORIGINAL_SACRED_UPGRADES,
  ORIGINAL_TREASURES,
} from './original-progression.generated'
import { WORLDS } from './worlds'

export const validateContent = (): string[] => {
  const errors: string[] = []
  const careerIds = new Set(CAREERS.map((item) => item.id))
  const factionIds = new Set(FACTIONS.map((item) => item.id))
  const worldIds = new Set(WORLDS.map((item) => item.id))
  const martialIds = new Set(FACTION_MARTIALS.map((item) => item.id))

  if (ORIGINAL_FACTIONS.length !== 42) errors.push('原版势力数不是 42')
  if (ORIGINAL_PLAYER_SKILLS.length !== 269) errors.push('原版玩家技能数不是 269')
  if (ORIGINAL_TREASURES.length !== 72) errors.push('原版宝库目录数不是 72')
  if (ORIGINAL_TREASURES.filter((item) => item.kind === 'treasure').length !== 62) errors.push('原版至宝数不是 62')
  if (ORIGINAL_TREASURES.filter((item) => item.kind === 'manual').length !== 10) errors.push('原版至宝秘籍数不是 10')
  if (ORIGINAL_ARTIFACT_SOULS.length !== 132) errors.push('原版器魂数不是 132')
  if (ORIGINAL_LARGE_DUNGEONS.length !== 7 || ORIGINAL_LARGE_DUNGEONS.some((item) => item.rewards.length !== 30)) {
    errors.push('原版大型副本奖励不是 7×30')
  }
  if (ORIGINAL_SACRED_BEASTS.length !== 13 || ORIGINAL_SACRED_BEASTS.some((item) => item.stages.length !== 9)) {
    errors.push('原版镇界圣兽阶段不是 13×9')
  }
  if (ORIGINAL_DEITIES.length !== 28) errors.push('原版神位链数不是 28')
  if (ORIGINAL_SACRED_UPGRADES.length !== 78) errors.push('原版圣具进阶数不是 78')
  if (ORIGINAL_INTERWORLD_ENEMIES.length !== 48 || ORIGINAL_INTERWORLD_ENEMIES.some((item) => item.itemIds.length !== 7)) {
    errors.push('原版异界敌人掉落表不是 48×7')
  }

  const originalFactionIds = new Set(ORIGINAL_FACTIONS.map((item) => item.id))
  const originalSkillIds = new Set(ORIGINAL_PLAYER_SKILLS.map((item) => item.id))
  const originalTreasureItemIds = new Set(ORIGINAL_TREASURES.map((item) => item.itemId))
  const artifactSoulIds = new Set<number>(ORIGINAL_ARTIFACT_SOULS.map((item) => item.id))
  const interworldDropItemIds = new Set(ORIGINAL_INTERWORLD_DROP_ITEMS.map((item) => item.itemId))
  if (originalFactionIds.size !== ORIGINAL_FACTIONS.length) errors.push('原版势力 id 重复')
  if (originalSkillIds.size !== ORIGINAL_PLAYER_SKILLS.length) errors.push('原版玩家技能 id 重复')
  if (originalTreasureItemIds.size !== ORIGINAL_TREASURES.length) errors.push('原版至宝物品 id 重复')
  for (const faction of ORIGINAL_FACTIONS) {
    if (faction.skillIds.length !== 6) errors.push(`原版势力 ${faction.name} 技能数不是 6`)
    for (const skillId of faction.skillIds) {
      if (!originalSkillIds.has(skillId)) errors.push(`原版势力 ${faction.name} 引用了未知技能`)
    }
  }
  for (const manual of ORIGINAL_TREASURES.filter((item) => item.kind === 'manual')) {
    if (!manual.grantSkillId || !originalSkillIds.has(manual.grantSkillId)) errors.push(`原版秘籍 ${manual.name} 授技断裂`)
  }
  const validateSoulEquipment = (item: { quality: number, artifactSoulId: number | null, name: string }): void => {
    if (item.quality >= 7 && (!item.artifactSoulId || !artifactSoulIds.has(item.artifactSoulId))) {
      errors.push(`原版器魂装备 ${item.name} 未绑定有效器魂`)
    }
  }
  for (const dungeon of ORIGINAL_LARGE_DUNGEONS) {
    for (const reward of dungeon.rewards) {
      if (reward.kind === 'equipment' && reward.item.quality === 7) validateSoulEquipment(reward.item)
    }
  }
  for (const beast of ORIGINAL_SACRED_BEASTS) {
    for (const stage of beast.stages) validateSoulEquipment(stage.equipment)
  }
  for (const deity of ORIGINAL_DEITIES) validateSoulEquipment(deity.imperialWeapon)
  for (const upgrade of ORIGINAL_SACRED_UPGRADES) {
    validateSoulEquipment(upgrade.source)
    validateSoulEquipment(upgrade.target)
    if (upgrade.source.itemId + 106 !== upgrade.target.itemId) errors.push(`圣具进阶 ${upgrade.source.name} 目标 id 错误`)
    if (upgrade.source.slotId !== upgrade.target.slotId) errors.push(`圣具进阶 ${upgrade.source.name} 装备部位变化`)
  }
  for (const enemy of ORIGINAL_INTERWORLD_ENEMIES) {
    for (const itemId of enemy.itemIds) {
      if (!interworldDropItemIds.has(itemId)) errors.push(`异界敌人 ${enemy.name} 引用了未知掉落物`)
    }
  }

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
    if (FACTION_MARTIALS.filter((martial) => martial.factionId === faction.id).length !== 6) {
      errors.push(`${faction.id} 武功数不是 6`)
    }
  }

  for (const martial of FACTION_MARTIALS) {
    if (!factionIds.has(martial.factionId ?? '')) errors.push(`${martial.id} 引用了未知势力`)
    if (martial.previousId && !martialIds.has(martial.previousId)) errors.push(`${martial.id} 前置武功不存在`)
    const previous = martial.previousId ? FACTION_MARTIALS.find((item) => item.id === martial.previousId) : undefined
    if (previous && (previous.factionId !== martial.factionId || previous.branchIndex !== martial.branchIndex)) {
      errors.push(`${martial.id} 前置武功串线`)
    }
  }

  for (const world of WORLDS) {
    if (world.stageIds.length !== 10) errors.push(`${world.id} 小关数不是 10`)
    const expectedFactionCount = ['world_01', 'world_02', 'world_03'].includes(world.id) ? 4 : 3
    if (world.factionIds.length !== expectedFactionCount) {
      errors.push(`${world.id} 势力数不是 ${expectedFactionCount}`)
    }
    for (let stage = 1; stage <= 10; stage += 1) {
      const group = STAGE_ENEMIES[`${world.id}:${stage}`]
      if (!group) {
        errors.push(`${world.id} 第 ${stage} 关缺少怪物表`)
        continue
      }
      if (group.mobs.some((mob) => !mob.name.trim())) errors.push(`${world.id} 第 ${stage} 关小怪名为空`)
      if (!group.boss.name.trim()) errors.push(`${world.id} 第 ${stage} 关首领名为空`)
      const stagePool = equipmentPoolForStage(world.id, stage)
      if (stagePool.length === 0) errors.push(`${world.id} 第 ${stage} 关装备普通池为空`)
      if (equipmentSetPoolForStage(world.id, stage).length !== 2) {
        errors.push(`${world.id} 第 ${stage} 关地点套装不是两件`)
      }
    }
    const pool = equipmentPoolForWorld(world.id)
    if (pool.length === 0) errors.push(`${world.id} 装备掉落池为空`)
    for (const slot of COMBAT_EQUIPMENT_SLOTS) {
      if (!pool.some((item) => item.slot === slot)) errors.push(`${world.id} 缺少${slot}掉落装备`)
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

  const seenEquipmentIds = new Set<string>()
  for (const world of WORLDS) {
    for (const item of equipmentPoolForWorld(world.id)) {
      if (seenEquipmentIds.has(item.id)) continue
      seenEquipmentIds.add(item.id)
      if (!item.name.trim()) errors.push(`${item.id} 装备名为空`)
      if (item.name.startsWith('圣阶') || ['柴刀', '屠龙宝刀', '祝融灵珠', '小李飞刀', '天公法杖'].includes(item.name)) {
        errors.push(`${item.id} 使用了停用装备名`)
      }
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
  // 原版名录覆盖全部 42 个势力，每势力 2～4 人。
  if (factionHeroCounts.size !== FACTIONS.length) {
    errors.push(`势力侠客未覆盖全部势力：${FACTIONS.length - factionHeroCounts.size} 个缺员`)
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
    // 原版真值角色（有 sourceId）本就与敌人图鉴同源，重名是原版设计；仅约束自创侠客。
    if (hero.source === 'starter' || hero.sourceId !== undefined) continue
    if (sameWorldEnemy(hero)) errors.push(`${hero.id} 与 ${hero.worldId} 敌人/BOSS 重名：${hero.name}`)
  }

  return errors
}
