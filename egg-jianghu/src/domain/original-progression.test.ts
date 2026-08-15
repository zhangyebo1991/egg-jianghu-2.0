import { describe, expect, it } from 'vitest'
import type { Rng } from '../combat/rng'
import {
  artifactSoulById,
  equipmentDefinitionById,
  EQUIPMENT_SLOT_NAMES,
} from '../content/equipment'
import { PLAYER_HERO_ID } from '../content/heroes'
import { martialIdFromOriginal } from '../content/martials'
import {
  ORIGINAL_DEITIES,
  ORIGINAL_INTERWORLD_DROP_ITEMS,
  ORIGINAL_INTERWORLD_ENEMIES,
  ORIGINAL_LARGE_DUNGEONS,
  ORIGINAL_SACRED_BEASTS,
  ORIGINAL_SACRED_UPGRADES,
  ORIGINAL_TREASURES,
} from '../content/original-progression.generated'
import { DIFFICULTY_COUNT, STAGE_COUNT } from '../content/worlds'
import { equipEquipment, unequipEquipment } from './inventory'
import { forgetMartial, relearnPermanentMartial } from './martial-training'
import {
  advanceSacredEquipment,
  BROKEN_DIVINITY_ITEM_ID,
  claimDeity,
  claimSacredBeastStageReward,
  completeDivineLadderFloor,
  CREATION_ORIGIN_ITEM_ID,
  craftSacredEquipment,
  completeLargeDungeon,
  completeInfiniteTowerFloor,
  createOriginalEquipmentInstance,
  deityUpgradeCost,
  forgeImperialWeapon,
  grantLargeDungeonReward,
  interworldDropProbability,
  isDivineRealmUnlocked,
  isSacredBeastUnlocked,
  largeDungeonBattleDifficulty,
  largeDungeonDropProbability,
  learnSacredRecipe,
  recordShrineBossKill,
  recordShrineEnemyKill,
  rollInterworldDrops,
  sacredBeastBattleDifficulty,
  settleShrineSpawn,
  SHRINE_PHASE_PROGRESS,
  upgradeDeity,
  WORLD_TREE_LEAF_ITEM_ID,
  clearSacredBeastStage,
} from './original-progression'
import { progressKey } from './progression'
import { createNewGameStateV10 } from './state'
import type { EquipmentInstance } from './types'

const scriptedRng = (floats: number[] = [], calls?: string[]): Rng => ({
  nextFloat: () => {
    calls?.push('float')
    return floats.shift() ?? 0
  },
  nextInt: (minInclusive) => minInclusive,
  pick: <T>(values: readonly T[]): T => values[0],
})

const createState = () => createNewGameStateV10('测试少侠', 1)

describe('原版高阶获取链', () => {
  it('大型副本按固定奖励位发放材料或品质 7 装备并记录次数', () => {
    const state = createState()
    const dungeon = ORIGINAL_LARGE_DUNGEONS[0]
    const itemIndex = dungeon.rewards.findIndex((reward) => reward.kind === 'item')
    const equipmentIndex = dungeon.rewards.findIndex((reward) => reward.kind === 'equipment')
    const itemReward = dungeon.rewards[itemIndex]
    const equipmentReward = dungeon.rewards[equipmentIndex]

    expect(grantLargeDungeonReward(state, dungeon.id, itemIndex, 50, 'unused', scriptedRng()).ok).toBe(true)
    expect(itemReward.kind).toBe('item')
    if (itemReward.kind === 'item') expect(state.materials[String(itemReward.item.itemId)]).toBe(1)

    expect(grantLargeDungeonReward(state, dungeon.id, equipmentIndex, 50, 'dungeon-drop', scriptedRng()).ok).toBe(true)
    expect(equipmentReward.kind).toBe('equipment')
    if (equipmentReward.kind === 'equipment') {
      expect(state.inventory[0]).toMatchObject({
        uid: 'dungeon-drop',
        definitionId: `wp_${equipmentReward.item.itemId}`,
        quality: 7,
      })
    }
    expect(state.largeDungeonClears[String(dungeon.id)]).toBeUndefined()
  })

  it('大型副本 30 个候选按原版万分比逐项判定，通关次数只增加一次', () => {
    const state = createState()
    const dungeon = ORIGINAL_LARGE_DUNGEONS[0]
    const calls: string[] = []
    const battleDifficulty = largeDungeonBattleDifficulty(1, dungeon.id, 4)
    expect(battleDifficulty).toBe(460)
    expect(largeDungeonDropProbability(100, 400)).toBe(0.01)
    expect(largeDungeonDropProbability(10_000, 2_400)).toBe(1)
    expect(largeDungeonDropProbability(100, -2_000)).toBe(0)

    const result = completeLargeDungeon(
      state,
      dungeon.id,
      1,
      80,
      'dungeon-complete',
      scriptedRng(Array(dungeon.rewards.length).fill(0), calls),
    )
    expect(result.ok).toBe(true)
    expect(calls.length).toBeGreaterThanOrEqual(dungeon.rewards.length)
    expect(result.droppedItemNames).toHaveLength(dungeon.rewards.length)
    expect(result.addedEquipmentUids).toHaveLength(dungeon.rewards.filter((reward) => reward.kind === 'equipment').length)
    expect(state.largeDungeonClears[String(dungeon.id)]).toBe(1)
  })

  it('圣兽按轮回难度和阶段顺序开放，奖励不可重复领取', () => {
    const state = createState()
    const beast = ORIGINAL_SACRED_BEASTS[0]
    const stage = beast.stages[0]
    const battleDifficulty = 1000 + beast.battleDifficultyOffset
    const worldId = `world_${String(beast.worldIndex).padStart(2, '0')}`

    expect(sacredBeastBattleDifficulty(beast.id, 1)).toBe(battleDifficulty)
    expect(sacredBeastBattleDifficulty(beast.id, 2)).toBe(battleDifficulty + 100)
    expect(isSacredBeastUnlocked(state, beast.id)).toBe(false)
    expect(clearSacredBeastStage(state, beast.id, 2).ok).toBe(false)
    expect(clearSacredBeastStage(state, beast.id, 1)).toEqual({
      ok: false,
      message: `需通关东汉三国轮回难度`,
    })

    state.clearedStageByWorldDifficulty[progressKey(worldId, DIFFICULTY_COUNT)] = STAGE_COUNT
    expect(isSacredBeastUnlocked(state, beast.id)).toBe(true)
    expect(clearSacredBeastStage(state, beast.id, 1).ok).toBe(true)

    expect(claimSacredBeastStageReward(state, beast.id, 1).ok).toBe(true)
    expect(state.blueprints[String(stage.equipment.recipeId)]).toBe(1)
    expect(state.materials[String(WORLD_TREE_LEAF_ITEM_ID)]).toBe(stage.worldTreeLeaves)
    expect(state.starSoul).toBe(20)
    expect(claimSacredBeastStageReward(state, beast.id, 1).ok).toBe(false)
    expect(state.blueprints[String(stage.equipment.recipeId)]).toBe(1)
    expect(state.starSoul).toBe(20)
  })

  it('圣具图纸消费后永久解锁，打造不再消耗额外材料或货币', () => {
    const state = createState()
    const beast = ORIGINAL_SACRED_BEASTS[0]
    const stage = beast.stages[0]
    const recipeId = stage.equipment.recipeId!
    const worldId = `world_${String(beast.worldIndex).padStart(2, '0')}`

    expect(craftSacredEquipment(state, recipeId, 80, 'too-early', scriptedRng()).ok).toBe(false)
    state.clearedStageByWorldDifficulty[progressKey(worldId, DIFFICULTY_COUNT)] = STAGE_COUNT
    expect(clearSacredBeastStage(state, beast.id, 1).ok).toBe(true)
    expect(claimSacredBeastStageReward(state, beast.id, 1).ok).toBe(true)
    expect(learnSacredRecipe(state, recipeId).ok).toBe(true)
    expect(state.blueprints[String(recipeId)]).toBe(0)
    expect(state.unlockedRecipeIds).toContain(recipeId)
    expect(learnSacredRecipe(state, recipeId).ok).toBe(false)

    const materialsBefore = { ...state.materials }
    const currencyBefore = { ...state.worldCurrency }
    expect(craftSacredEquipment(state, recipeId, 80, 'sacred-crafted', scriptedRng()).ok).toBe(true)
    expect(state.inventory[0]).toMatchObject({
      uid: 'sacred-crafted',
      definitionId: `wp_${stage.equipment.itemId}`,
      quality: 8,
    })
    expect(state.materials).toEqual(materialsBefore)
    expect(state.worldCurrency).toEqual(currencyBefore)
  })

  it('幻塔 300 层不开放神界，301 层开放且天梯每层给 5 个创世本源', () => {
    const state = createState()
    expect(isDivineRealmUnlocked(300)).toBe(false)
    expect(isDivineRealmUnlocked(301)).toBe(true)
    state.infiniteTowerFloor = 299
    expect(completeInfiniteTowerFloor(state).ok).toBe(true)
    expect(state.infiniteTowerFloor).toBe(300)
    expect(completeDivineLadderFloor(state).ok).toBe(false)
    expect(state.divineLadderFloor).toBe(0)

    state.infiniteTowerFloor = 301
    expect(completeDivineLadderFloor(state).ok).toBe(true)
    expect(state.divineLadderFloor).toBe(1)
    expect(state.divineRankLevel).toBe(1)
    expect(state.materials[String(CREATION_ORIGIN_ITEM_ID)]).toBe(5)
    state.divineLadderFloor = 100
    expect(completeDivineLadderFloor(state).ok).toBe(true)
    expect(state.divineRankLevel).toBe(100)
  })

  it('神殿三个阶段都必须达到 5000 并经过 Boss -1 刷新握手', () => {
    const state = createState()
    const shrineId = ORIGINAL_DEITIES[0].shrineId
    const shrine = state.shrines[String(shrineId)]
    const expectedPhases = ['siege', 'occupation', 'subdued'] as const

    for (const expectedPhase of expectedPhases) {
      shrine.progress = SHRINE_PHASE_PROGRESS - 1
      expect(recordShrineBossKill(state, shrineId).ok).toBe(false)
      expect(recordShrineEnemyKill(state, shrineId).ok).toBe(true)
      expect(shrine.progress).toBe(SHRINE_PHASE_PROGRESS)
      expect(recordShrineEnemyKill(state, shrineId).ok).toBe(false)
      expect(recordShrineBossKill(state, shrineId).ok).toBe(true)
      expect(shrine.progress).toBe(-1)
      expect(recordShrineEnemyKill(state, shrineId).ok).toBe(false)
      expect(settleShrineSpawn(state, shrineId).ok).toBe(true)
      expect(shrine).toEqual({ phase: expectedPhase, progress: 0 })
    }
    expect(recordShrineBossKill(state, shrineId).ok).toBe(false)
  })

  it('神位首次消耗 10 个破碎神格并永久授技，升级消耗 8 + 2L', () => {
    const state = createState()
    const deity = ORIGINAL_DEITIES[0]
    const martialId = martialIdFromOriginal(deity.skillId)
    state.shrines[String(deity.shrineId)] = { phase: 'subdued', progress: 0 }
    state.divineRankLevel = deity.unlockDivineLevel

    expect(claimDeity(state, deity.id, PLAYER_HERO_ID).ok).toBe(false)
    state.materials[String(BROKEN_DIVINITY_ITEM_ID)] = 10
    expect(claimDeity(state, deity.id, PLAYER_HERO_ID).ok).toBe(true)
    expect(state.materials[String(BROKEN_DIVINITY_ITEM_ID)]).toBe(0)
    expect(state.deities[String(deity.id)]).toEqual({ level: 1 })
    expect(state.heroes[PLAYER_HERO_ID].permanentMartialIds).toContain(martialId)
    expect(state.heroes[PLAYER_HERO_ID].learnedMartials[martialId]).toMatchObject({ level: 1, investedSp: 0 })

    expect(deityUpgradeCost(1)).toBe(10)
    state.materials[String(BROKEN_DIVINITY_ITEM_ID)] = 10
    expect(upgradeDeity(state, deity.id).ok).toBe(true)
    expect(state.deities[String(deity.id)].level).toBe(2)
    expect(state.materials[String(BROKEN_DIVINITY_ITEM_ID)]).toBe(0)
    expect(deityUpgradeCost(2)).toBe(12)
  })

  it('帝兵允许任意品质 8 装备原地改造，并用中文提示已占用目标部位', () => {
    const state = createState()
    const deity = ORIGINAL_DEITIES[0]
    const sourceSnapshot = ORIGINAL_SACRED_UPGRADES[0].source
    const source = createOriginalEquipmentInstance(`wp_${sourceSnapshot.itemId}`, 100, 'imperial-source', scriptedRng())
    const target = equipmentDefinitionById(`wp_${deity.imperialWeapon.itemId}`)!
    const sourceDefinition = equipmentDefinitionById(source.definitionId)!
    const blocker: EquipmentInstance = {
      uid: 'target-blocker',
      definitionId: 'wp_112',
      level: 1,
      quality: 0,
      coreStats: [],
      affixes: [],
      locked: false,
    }
    state.inventory.push(source, blocker)
    state.shrines[String(deity.shrineId)] = { phase: 'subdued', progress: 0 }
    const loadout = state.heroes[PLAYER_HERO_ID].equipmentSets[0]
    loadout[sourceDefinition.slot] = source.uid
    loadout[target.slot] = blocker.uid

    const blocked = forgeImperialWeapon(state, deity.shrineId, source.uid)
    expect(blocked).toEqual({ ok: false, message: `请先卸下目标${EQUIPMENT_SLOT_NAMES[target.slot]}部位装备` })
    expect(source.definitionId).toBe(`wp_${sourceSnapshot.itemId}`)

    loadout[target.slot] = null
    expect(forgeImperialWeapon(state, deity.shrineId, source.uid).ok).toBe(true)
    expect(source).toMatchObject({ definitionId: target.id, quality: 9 })
    expect(source.coreStats).toEqual(target.coreStats.map((core) => ({
      attributeId: core.attributeId,
      coefficient: core.baseCoefficient * 1.5,
    })))
    expect(source.affixes).toEqual(target.fixedAffixes)
    expect(loadout[sourceDefinition.slot]).toBeNull()
    expect(loadout[target.slot]).toBe(source.uid)
    expect(artifactSoulById(target.artifactSoulId)?.tier).toBe(3)
  })

  it('圣具进阶消耗 30 创世本源，核心变 150%，五条附词条各加 10', () => {
    const state = createState()
    const upgrade = ORIGINAL_SACRED_UPGRADES[0]
    const source = createOriginalEquipmentInstance(`wp_${upgrade.source.itemId}`, 100, 'advance-source', scriptedRng())
    const beforeAffixes = source.affixes.map((affix) => ({ ...affix }))
    const target = equipmentDefinitionById(`wp_${upgrade.target.itemId}`)!
    state.inventory.push(source)
    state.materials[String(CREATION_ORIGIN_ITEM_ID)] = 29

    expect(advanceSacredEquipment(state, source.uid).ok).toBe(false)
    expect(source.definitionId).toBe(`wp_${upgrade.source.itemId}`)
    state.materials[String(CREATION_ORIGIN_ITEM_ID)] = 30
    expect(advanceSacredEquipment(state, source.uid).ok).toBe(true)
    expect(state.materials[String(CREATION_ORIGIN_ITEM_ID)]).toBe(0)
    expect(source).toMatchObject({ definitionId: target.id, quality: 9 })
    expect(source.coreStats).toEqual(target.coreStats.map((core) => ({
      attributeId: core.attributeId,
      coefficient: core.baseCoefficient * 1.5,
    })))
    expect(source.affixes).toEqual(beforeAffixes.map((affix) => ({
      ...affix,
      coefficient: affix.coefficient + 10,
    })))
    expect(source.affixes).toHaveLength(5)
    expect(artifactSoulById(target.artifactSoulId)?.tier).toBe(3)
  })

  it('异界七个候选逐项独立判定，并应用加成、下限和概率封顶', () => {
    expect(interworldDropProbability(20, 50)).toBe(0.003)
    expect(interworldDropProbability(10_000, 50)).toBe(1)
    expect(interworldDropProbability(20, -200)).toBe(0)

    const state = createState()
    const enemy = ORIGINAL_INTERWORLD_ENEMIES[0]
    const calls: string[] = []
    const floats = enemy.itemIds.map((_, index) => index % 2 === 0 ? 0 : 0.999_999)
    const dropped = rollInterworldDrops(state, enemy.enemyId, 0, scriptedRng(floats, calls))
    const expected = enemy.itemIds.filter((_, index) => index % 2 === 0)
    expect(calls).toHaveLength(enemy.itemIds.length)
    expect(dropped).toEqual(expected)
    for (const itemId of enemy.itemIds) {
      expect(state.materials[String(itemId)] ?? 0).toBe(expected.includes(itemId) ? 1 : 0)
      expect(ORIGINAL_INTERWORLD_DROP_ITEMS.some((item) => item.itemId === itemId)).toBe(true)
    }
  })

  it('10 本秘籍首次装备永久授予正确技能，重复装备不重复发放', () => {
    const manuals = ORIGINAL_TREASURES.filter((item) => item.kind === 'manual')
    expect(manuals).toHaveLength(10)

    for (const manual of manuals) {
      const state = createState()
      const instance = createOriginalEquipmentInstance(`wp_${manual.itemId}`, 1, `manual-${manual.itemId}`, scriptedRng())
      const martialId = martialIdFromOriginal(manual.grantSkillId!)
      state.inventory.push(instance)
      expect(instance.coreStats).toEqual([])
      expect(instance.affixes).toEqual([])
      expect(equipEquipment(state, PLAYER_HERO_ID, instance.uid).ok).toBe(true)
      expect(state.treasureManualGrants[String(manual.itemId)]).toBe(PLAYER_HERO_ID)
      expect(state.heroes[PLAYER_HERO_ID].permanentMartialIds).toEqual([martialId])
      expect(state.heroes[PLAYER_HERO_ID].learnedMartials[martialId]).toMatchObject({ level: 1, investedSp: 0 })
    }

    const manual = manuals[0]
    const state = createState()
    const instance = createOriginalEquipmentInstance(`wp_${manual.itemId}`, 1, 'manual-repeat', scriptedRng())
    const martialId = martialIdFromOriginal(manual.grantSkillId!)
    state.inventory.push(instance)
    expect(equipEquipment(state, PLAYER_HERO_ID, instance.uid).ok).toBe(true)
    expect(unequipEquipment(state, PLAYER_HERO_ID, 'treasure').ok).toBe(true)
    expect(equipEquipment(state, PLAYER_HERO_ID, instance.uid).ok).toBe(true)
    expect(state.heroes[PLAYER_HERO_ID].permanentMartialIds.filter((id) => id === martialId)).toHaveLength(1)
    expect(forgetMartial(state, PLAYER_HERO_ID, martialId).ok).toBe(true)
    expect(relearnPermanentMartial(state, PLAYER_HERO_ID, martialId).ok).toBe(true)
  })

  it('至宝无随机词条和器魂，品质 7/8/9 固定装备映射一至三阶器魂', () => {
    for (const treasure of ORIGINAL_TREASURES) {
      const definition = equipmentDefinitionById(`wp_${treasure.itemId}`)!
      expect(definition.coreStats).toEqual([])
      expect(definition.affixPool).toEqual([])
      expect(definition.artifactSoulId).toBeUndefined()
    }

    const tierSources = [
      ORIGINAL_LARGE_DUNGEONS[0].rewards
        .find((reward) => reward.kind === 'equipment' && reward.item.quality === 7),
      { kind: 'equipment' as const, item: ORIGINAL_SACRED_BEASTS[0].stages[0].equipment },
      { kind: 'equipment' as const, item: ORIGINAL_DEITIES[0].imperialWeapon },
    ]
    tierSources.forEach((reward, index) => {
      expect(reward?.kind).toBe('equipment')
      if (!reward || reward.kind !== 'equipment') return
      const definition = equipmentDefinitionById(`wp_${reward.item.itemId}`)!
      expect(definition.artifactSoulId).toBe(reward.item.artifactSoulId)
      expect(artifactSoulById(definition.artifactSoulId)?.tier).toBe(index + 1)
    })
  })
})
