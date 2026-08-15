import type { Rng } from '../combat/rng'
import {
  ORIGINAL_DEITIES,
  ORIGINAL_INTERWORLD_DROP_ITEMS,
  ORIGINAL_INTERWORLD_ENEMIES,
  ORIGINAL_LARGE_DUNGEONS,
  ORIGINAL_SACRED_BEASTS,
  ORIGINAL_SACRED_UPGRADES,
} from '../content/original-progression.generated'
import {
  EQUIPMENT_SLOT_NAMES,
  equipmentDefinitionById,
  rollEquipmentStats,
  type EquipmentDefinitionV10,
} from '../content/equipment'
import { martialIdFromOriginal } from '../content/martials'
import { DIFFICULTY_COUNT, STAGE_COUNT, worldById } from '../content/worlds'
import type { ActionResult, EquipmentInstance, GameStateV10, ShrinePhase } from './types'
import { addEquipment, equipmentOwnerId } from './inventory'
import { grantPermanentMartial } from './martial-training'
import { clearedStageOf } from './progression'

export const WORLD_TREE_LEAF_ITEM_ID = 76
export const CREATION_ORIGIN_ITEM_ID = 79
export const BROKEN_DIVINITY_ITEM_ID = 80
export const SHRINE_PHASE_PROGRESS = 5000

export interface LargeDungeonCompletionResult extends ActionResult {
  droppedItemNames: string[]
  addedEquipmentUids: string[]
}

interface SacredBeastSnapshot {
  readonly id: number
  readonly worldIndex: number
  readonly battleDifficultyOffset: number
  readonly stages: readonly {
    readonly stage: number
    readonly equipment: { readonly itemId: number; readonly name: string; readonly recipeId: number | null }
    readonly worldTreeLeaves: number
    readonly starSoul: number
  }[]
}

const SACRED_BEASTS = ORIGINAL_SACRED_BEASTS as unknown as readonly SacredBeastSnapshot[]

const materialKey = (itemId: number): string => String(itemId)

const addMaterial = (state: GameStateV10, itemId: number, amount: number): void => {
  const key = materialKey(itemId)
  state.materials[key] = (state.materials[key] ?? 0) + amount
}

const spendMaterial = (state: GameStateV10, itemId: number, amount: number): boolean => {
  const key = materialKey(itemId)
  if ((state.materials[key] ?? 0) < amount) return false
  state.materials[key] -= amount
  return true
}

export const createOriginalEquipmentInstance = (
  definitionId: string,
  level: number,
  uid: string,
  rng: Rng,
): EquipmentInstance => {
  const definition = equipmentDefinitionById(definitionId)
  if (!definition?.fixedQuality) throw new Error(`固定装备定义不存在: ${definitionId}`)
  const rolled = definition.coreStats.length > 0
    ? rollEquipmentStats(definition, definition.fixedQuality, rng)
    : { coreStats: [], affixes: [] }
  return {
    uid,
    definitionId,
    level,
    quality: definition.fixedQuality,
    coreStats: rolled.coreStats,
    affixes: definition.fixedAffixes?.length
      ? definition.fixedAffixes.map((affix) => ({ ...affix }))
      : rolled.affixes,
    locked: false,
  }
}

export const grantLargeDungeonReward = (
  state: GameStateV10,
  dungeonId: number,
  rewardIndex: number,
  level: number,
  uid: string,
  rng: Rng,
): ActionResult => {
  const dungeon = ORIGINAL_LARGE_DUNGEONS.find((item) => item.id === dungeonId)
  const reward = dungeon?.rewards[rewardIndex]
  if (!dungeon || !reward) return { ok: false, message: '大型副本奖励不存在' }
  if (reward.kind === 'item') {
    addMaterial(state, reward.item.itemId, 1)
  } else {
    const result = addEquipment(state, createOriginalEquipmentInstance(`wp_${reward.item.itemId}`, level, uid, rng))
    if (!result.ok) return { ok: false, message: '物品栏已满' }
  }
  return { ok: true, message: `获得 ${reward.item.name}` }
}

/** 原版 `副本战斗难度function`：副本难度、编号和四阶段分别参与难度。 */
export const largeDungeonBattleDifficulty = (
  difficultyLevel: number,
  dungeonId: number,
  stage: number,
): number => 200 + difficultyLevel * 200 + (dungeonId - 1) * 100 + (stage - 1) * 20

/** 原版 `副本物品掉率function`，wp 第 33 列为万分比基础值。 */
export const largeDungeonDropProbability = (baseRoll: number, battleDifficulty: number): number =>
  Math.min(10000, Math.max(0, baseRoll * (1 + (battleDifficulty - 400) / 2000))) / 10000

export const completeLargeDungeon = (
  state: GameStateV10,
  dungeonId: number,
  difficultyLevel: number,
  level: number,
  uidPrefix: string,
  rng: Rng,
): LargeDungeonCompletionResult => {
  const dungeon = ORIGINAL_LARGE_DUNGEONS.find((item) => item.id === dungeonId)
  if (!dungeon) return { ok: false, message: '大型副本不存在', droppedItemNames: [], addedEquipmentUids: [] }
  const battleDifficulty = largeDungeonBattleDifficulty(difficultyLevel, dungeonId, 4)
  const droppedItemNames: string[] = []
  const addedEquipmentUids: string[] = []
  for (const [rewardIndex, reward] of dungeon.rewards.entries()) {
    if (rng.nextFloat() >= largeDungeonDropProbability(reward.baseRoll, battleDifficulty)) continue
    if (reward.kind === 'item') {
      addMaterial(state, reward.item.itemId, 1)
      droppedItemNames.push(reward.item.name)
      continue
    }
    const uid = `${uidPrefix}-${rewardIndex}`
    const added = addEquipment(state, createOriginalEquipmentInstance(`wp_${reward.item.itemId}`, level, uid, rng))
    if (!added.ok) continue
    droppedItemNames.push(reward.item.name)
    addedEquipmentUids.push(uid)
  }
  state.largeDungeonClears[String(dungeonId)] = (state.largeDungeonClears[String(dungeonId)] ?? 0) + 1
  return {
    ok: true,
    message: droppedItemNames.length > 0 ? `副本通关，获得 ${droppedItemNames.join('、')}` : '副本通关，本次没有掉落',
    droppedItemNames,
    addedEquipmentUids,
  }
}

const sacredBeastWorldId = (worldIndex: number): string =>
  `world_${String(worldIndex).padStart(2, '0')}`

export const isSacredBeastUnlocked = (state: GameStateV10, beastId: number): boolean => {
  const beast = SACRED_BEASTS.find((item) => item.id === beastId)
  if (!beast) return false
  return clearedStageOf(
    state.clearedStageByWorldDifficulty,
    sacredBeastWorldId(beast.worldIndex),
    DIFFICULTY_COUNT,
  ) >= STAGE_COUNT
}

/** 原版 `镇兽战斗难度function`：1000 + zs 第 4 列 + 已通关阶段 × 100。 */
export const sacredBeastBattleDifficulty = (beastId: number, stage: number): number => {
  const beast = SACRED_BEASTS.find((item) => item.id === beastId)
  if (!beast || !Number.isInteger(stage) || stage < 1 || stage > 9) return Infinity
  return 1000 + beast.battleDifficultyOffset + (stage - 1) * 100
}

export const clearSacredBeastStage = (
  state: GameStateV10,
  beastId: number,
  stage: number,
): ActionResult => {
  const beast = SACRED_BEASTS.find((item) => item.id === beastId)
  const progress = state.sacredBeasts[String(beastId)]
  if (!beast || !progress) return { ok: false, message: '镇界圣兽不存在' }
  if (stage !== progress.highestClearedStage + 1) return { ok: false, message: '必须依次挑战圣兽阶段' }
  if (!isSacredBeastUnlocked(state, beastId)) {
    const worldName = worldById(sacredBeastWorldId(beast.worldIndex))?.name ?? `第${beast.worldIndex}位面`
    return { ok: false, message: `需通关${worldName}轮回难度` }
  }
  progress.highestClearedStage = stage
  return { ok: true, message: `圣兽第 ${stage} 阶段已通关` }
}

export const claimSacredBeastStageReward = (
  state: GameStateV10,
  beastId: number,
  stage: number,
): ActionResult => {
  const beast = SACRED_BEASTS.find((item) => item.id === beastId)
  const reward = beast?.stages.find((item) => item.stage === stage)
  const progress = state.sacredBeasts[String(beastId)]
  if (!beast || !reward || !progress) return { ok: false, message: '镇界圣兽奖励不存在' }
  if (progress.highestClearedStage < stage) return { ok: false, message: '尚未通关该阶段' }
  if (progress.claimedStages.includes(stage)) return { ok: false, message: '该阶段奖励已经领取' }
  if (!reward.equipment.recipeId) return { ok: false, message: '圣具配方不存在' }
  const recipeKey = String(reward.equipment.recipeId)
  state.blueprints[recipeKey] = (state.blueprints[recipeKey] ?? 0) + 1
  addMaterial(state, WORLD_TREE_LEAF_ITEM_ID, reward.worldTreeLeaves)
  state.starSoul += reward.starSoul
  progress.claimedStages.push(stage)
  return { ok: true, message: `获得 ${reward.equipment.name} 图纸、世界树叶与星魂` }
}

export const learnSacredRecipe = (state: GameStateV10, recipeId: number): ActionResult => {
  if (state.unlockedRecipeIds.includes(recipeId)) return { ok: false, message: '配方已经学会' }
  const key = String(recipeId)
  if ((state.blueprints[key] ?? 0) < 1) return { ok: false, message: '缺少圣具图纸' }
  state.blueprints[key] -= 1
  state.unlockedRecipeIds.push(recipeId)
  return { ok: true, message: '圣具配方已永久解锁' }
}

export const craftSacredEquipment = (
  state: GameStateV10,
  recipeId: number,
  level: number,
  uid: string,
  rng: Rng,
): ActionResult => {
  if (!state.unlockedRecipeIds.includes(recipeId)) return { ok: false, message: '尚未学习圣具配方' }
  const reward = SACRED_BEASTS.flatMap((beast) => beast.stages)
    .find((stage) => stage.equipment.recipeId === recipeId)
  if (!reward) return { ok: false, message: '圣具配方不存在' }
  const result = addEquipment(state, createOriginalEquipmentInstance(`wp_${reward.equipment.itemId}`, level, uid, rng))
  return result.ok
    ? { ok: true, message: `打造成功：${reward.equipment.name}` }
    : { ok: false, message: '物品栏已满' }
}

export const isDivineRealmUnlocked = (infiniteTowerFloor: number): boolean => infiniteTowerFloor > 300

export const completeInfiniteTowerFloor = (state: GameStateV10): ActionResult => {
  state.infiniteTowerFloor += 1
  return { ok: true, message: `无尽幻塔推进至第 ${state.infiniteTowerFloor} 层` }
}

export const completeDivineLadderFloor = (state: GameStateV10): ActionResult => {
  if (!isDivineRealmUnlocked(state.infiniteTowerFloor)) return { ok: false, message: '无尽幻塔至少达到 301 层' }
  state.divineLadderFloor += 1
  state.divineRankLevel = Math.min(100, Math.max(1, state.divineLadderFloor))
  addMaterial(state, CREATION_ORIGIN_ITEM_ID, 5)
  return { ok: true, message: '通神天梯完成一层，获得创世本源 ×5' }
}

const nextShrinePhase = (phase: ShrinePhase): ShrinePhase => {
  if (phase === 'raid') return 'siege'
  if (phase === 'siege') return 'occupation'
  return 'subdued'
}

export const settleShrineSpawn = (state: GameStateV10, shrineId: number): ActionResult => {
  const shrine = state.shrines[String(shrineId)]
  if (!shrine) return { ok: false, message: '神殿不存在' }
  if (shrine.progress !== -1) return { ok: false, message: '当前没有待结算的神殿阶段' }
  shrine.phase = nextShrinePhase(shrine.phase)
  shrine.progress = 0
  return { ok: true, message: shrine.phase === 'subdued' ? '神殿已经完全臣服' : '神殿进入下一阶段' }
}

export const recordShrineEnemyKill = (state: GameStateV10, shrineId: number): ActionResult => {
  const shrine = state.shrines[String(shrineId)]
  if (!shrine) return { ok: false, message: '神殿不存在' }
  if (shrine.phase === 'subdued') return { ok: false, message: '神殿已经完全臣服' }
  if (shrine.progress === -1) return { ok: false, message: '阶段 Boss 正在结算' }
  if (shrine.progress >= SHRINE_PHASE_PROGRESS) return { ok: false, message: '阶段进度已满，请挑战 Boss' }
  shrine.progress += 1
  return { ok: true, message: '神殿阶段进度 +1' }
}

export const recordShrineBossKill = (state: GameStateV10, shrineId: number): ActionResult => {
  const shrine = state.shrines[String(shrineId)]
  if (!shrine || shrine.phase === 'subdued') return { ok: false, message: '神殿阶段不存在' }
  if (shrine.progress !== SHRINE_PHASE_PROGRESS) return { ok: false, message: '普通敌人进度尚未达到 5000' }
  shrine.progress = -1
  return { ok: true, message: '阶段 Boss 已击败，等待刷新结算' }
}

export const claimDeity = (
  state: GameStateV10,
  deityId: number,
  heroId: string,
): ActionResult => {
  const deity = ORIGINAL_DEITIES.find((item) => item.id === deityId)
  if (!deity) return { ok: false, message: '神位不存在' }
  if (state.shrines[String(deity.shrineId)]?.phase !== 'subdued') return { ok: false, message: '对应神殿尚未完全臣服' }
  if (state.divineRankLevel < deity.unlockDivineLevel) return { ok: false, message: `天道神位需达到 Lv.${deity.unlockDivineLevel}` }
  if (state.deities[String(deityId)]) return { ok: false, message: '神位已经夺取' }
  if ((state.materials[materialKey(BROKEN_DIVINITY_ITEM_ID)] ?? 0) < 10) return { ok: false, message: '破碎神格不足，需要 10 个' }
  const grant = grantPermanentMartial(state, heroId, martialIdFromOriginal(deity.skillId))
  if (!grant.ok) return grant
  spendMaterial(state, BROKEN_DIVINITY_ITEM_ID, 10)
  state.deities[String(deityId)] = { level: 1 }
  return { ok: true, message: `夺取神位：${deity.name}` }
}

export const deityUpgradeCost = (currentLevel: number): number => 8 + 2 * currentLevel

export const upgradeDeity = (state: GameStateV10, deityId: number): ActionResult => {
  const progress = state.deities[String(deityId)]
  if (!progress) return { ok: false, message: '尚未夺取该神位' }
  if (progress.level >= 100) return { ok: false, message: '神位已经达到 Lv.100' }
  const cost = deityUpgradeCost(progress.level)
  if (!spendMaterial(state, BROKEN_DIVINITY_ITEM_ID, cost)) return { ok: false, message: `破碎神格不足，需要 ${cost} 个` }
  progress.level += 1
  return { ok: true, message: `神位提升至 Lv.${progress.level}` }
}

const rebindTransformedEquipment = (
  state: GameStateV10,
  uid: string,
  targetDefinition: EquipmentDefinitionV10,
): ActionResult => {
  const ownerId = equipmentOwnerId(state, uid)
  if (!ownerId) return { ok: true, message: '装备位无需调整' }
  const hero = state.heroes[ownerId]
  for (const set of hero.equipmentSets) {
    const occupiedEntries = Object.entries(set).filter(([, equippedUid]) => equippedUid === uid)
    for (const [oldSlot] of occupiedEntries) {
      if (oldSlot !== targetDefinition.slot && set[targetDefinition.slot]) {
        return { ok: false, message: `请先卸下目标${EQUIPMENT_SLOT_NAMES[targetDefinition.slot]}部位装备` }
      }
    }
  }
  for (const set of hero.equipmentSets) {
    for (const [oldSlot, equippedUid] of Object.entries(set)) {
      if (equippedUid !== uid) continue
      set[oldSlot] = null
      set[targetDefinition.slot] = uid
    }
  }
  hero.equipmentBySlot = hero.equipmentSets[hero.activeEquipmentSetIndex]
  return { ok: true, message: '装备位已调整' }
}

const transformCoreStats = (definition: EquipmentDefinitionV10): EquipmentInstance['coreStats'] =>
  definition.coreStats.map((core) => ({ attributeId: core.attributeId, coefficient: core.baseCoefficient * 1.5 }))

export const forgeImperialWeapon = (
  state: GameStateV10,
  shrineId: number,
  sourceUid: string,
): ActionResult => {
  const deity = ORIGINAL_DEITIES.find((item) => item.shrineId === shrineId)
  const source = state.inventory.find((item) => item.uid === sourceUid)
  if (!deity || state.shrines[String(shrineId)]?.phase !== 'subdued') return { ok: false, message: '神殿尚未完全臣服' }
  if (!source || source.quality !== 8) return { ok: false, message: '帝兵改造需要任意品质 8 装备' }
  const target = equipmentDefinitionById(`wp_${deity.imperialWeapon.itemId}`)
  if (!target) return { ok: false, message: '帝兵定义不存在' }
  const rebind = rebindTransformedEquipment(state, sourceUid, target)
  if (!rebind.ok) return rebind
  source.definitionId = target.id
  source.quality = 9
  source.coreStats = transformCoreStats(target)
  source.affixes = target.fixedAffixes?.map((affix) => ({ ...affix })) ?? []
  return { ok: true, message: `改造成功：${target.name}` }
}

export const advanceSacredEquipment = (state: GameStateV10, sourceUid: string): ActionResult => {
  const source = state.inventory.find((item) => item.uid === sourceUid)
  const sourceItemId = Number(source?.definitionId.replace(/\D/g, ''))
  const upgrade = ORIGINAL_SACRED_UPGRADES.find((item) => item.source.itemId === sourceItemId)
  if (!source || source.quality !== 8 || !upgrade) return { ok: false, message: '该装备不能进行圣具进阶' }
  if ((state.materials[materialKey(CREATION_ORIGIN_ITEM_ID)] ?? 0) < upgrade.creationOriginCost) {
    return { ok: false, message: `创世本源不足，需要 ${upgrade.creationOriginCost} 个` }
  }
  const target = equipmentDefinitionById(`wp_${upgrade.target.itemId}`)
  if (!target) return { ok: false, message: '圣具进阶目标不存在' }
  spendMaterial(state, CREATION_ORIGIN_ITEM_ID, upgrade.creationOriginCost)
  source.definitionId = target.id
  source.quality = 9
  source.coreStats = transformCoreStats(target)
  source.affixes = source.affixes.map((affix) => ({ ...affix, coefficient: affix.coefficient + 10 }))
  return { ok: true, message: `进阶成功：${target.name}` }
}

export const interworldDropProbability = (baseRoll: number, totalDropRateBonus: number): number =>
  Math.min(10000, Math.max(0, baseRoll * (100 + totalDropRateBonus) / 100)) / 10000

export const rollInterworldDrops = (
  state: GameStateV10,
  enemyId: number,
  totalDropRateBonus: number,
  rng: Rng,
): number[] => {
  const enemy = ORIGINAL_INTERWORLD_ENEMIES.find((item) => item.enemyId === enemyId)
  if (!enemy) return []
  const dropped: number[] = []
  for (const itemId of enemy.itemIds) {
    const item = ORIGINAL_INTERWORLD_DROP_ITEMS.find((candidate) => candidate.itemId === itemId)
    if (!item) continue
    if (rng.nextFloat() < interworldDropProbability(item.baseRoll, totalDropRateBonus)) {
      addMaterial(state, itemId, 1)
      dropped.push(itemId)
    }
  }
  return dropped
}
