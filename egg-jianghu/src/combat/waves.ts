import { ENEMY_FORMATIONS, stageEnemyGroup, type EnemyDefinition, type StageEnemyGroup } from '../content/enemies'
import type { FormationColumn, FormationRow } from '../domain/types'
import { applyPassiveAttributes } from './skill-ai'
import { createRng, type Rng } from './rng'
import { panelToAttributeMap } from './stats'
import type { CombatRank, CombatSnapshot, CombatUnit } from './types'

export { enemyDisplayName } from '../content/enemy-names'

export interface CombatWave {
  worldId: string
  difficulty: number
  stage: number
  wave: number
  enemies: CombatUnit[]
}

interface EnemyIdentity {
  definition: EnemyDefinition
  /** mob 为本关小怪序号 0..4；boss 无 */
  mobIndex: number | null
}

const TYPE_MULTIPLIERS: Record<CombatRank, { hp: number; speed: number; offenseDefense: number }> = {
  normal: { hp: 1, speed: 1, offenseDefense: 1 },
  elite: { hp: 1.5, speed: 1.1, offenseDefense: 1.2 },
  captain: { hp: 2.2, speed: 1.2, offenseDefense: 1.4 },
  boss: { hp: 12, speed: 1.25, offenseDefense: 1.6 },
}

const POSITIVE_ATTRIBUTE_IDS = [
  16, 17, 20, 22, 25, 31, 38,
  44, 46, 48, 50, 52, 54, 56, 58,
  ...Array.from({ length: 16 }, (_, index) => 60 + index),
  ...Array.from({ length: 10 }, (_, index) => 92 + index),
] as const
const REDUCTION_ATTRIBUTE_IDS = [21, 23, 45, 47, 49, 51, 53, 55, 57, 59] as const

/** 原版「普通战斗难度系数」：难度、sq 地点原始行号与当前波次共同决定。 */
export const ordinaryCombatDifficulty = (difficulty: number, locationId: number, wave: number): number =>
  (Math.max(1, Math.trunc(difficulty)) - 1) * 100 + (locationId - 1) * 10 + wave

export const waveEnemyLevel = (worldId: string, stage: number, wave: number, difficulty: number): number => {
  const group = stageEnemyGroup(worldId, stage)
  if (!group) throw new Error(`${worldId} 第 ${stage} 关缺少怪物表`)
  return ordinaryCombatDifficulty(difficulty, group.locationId, wave)
}

const rankForMob = (wave: number, rng: Rng): CombatRank => {
  if (wave <= 3) return 'normal'
  const roll = rng.nextInt(1, 101)
  if (roll <= 80) return 'normal'
  if (roll <= 96) return 'elite'
  return 'captain'
}

const formationIdForWave = (wave: number, rng: Rng): number => {
  if (wave === 1) return 1
  if (wave === 2) return 2
  if (wave === 10) return rng.nextInt(19, 24)
  return rng.nextInt(3, 19)
}

const identityFor = (group: StageEnemyGroup, enemyIndex: number): EnemyIdentity => {
  if (enemyIndex === 6) return { definition: group.boss, mobIndex: null }
  const mobIndex = enemyIndex - 1
  const definition = group.mobs[mobIndex]
  if (!definition) throw new Error(`阵型引用了不存在的小怪编号 ${enemyIndex}`)
  return { definition, mobIndex }
}

const instanceEnemyId = (
  worldId: string,
  stage: number,
  identity: EnemyIdentity,
  localPosition: number,
): string => {
  const prefix = `${worldId}_stage_${String(stage).padStart(2, '0')}`
  const canonical = identity.mobIndex === null ? `${prefix}_boss` : `${prefix}_mob_${identity.mobIndex + 1}`
  return `${canonical}_at_${String(localPosition).padStart(2, '0')}`
}

const localPositionToSlot = (localPosition: number): { row: FormationRow; col: FormationColumn } => {
  const zeroBased = localPosition - 1
  return {
    row: Math.floor(zeroBased / 5) as FormationRow,
    col: (zeroBased % 5) as FormationColumn,
  }
}

const applyOriginalEnemyAttributes = (enemy: CombatUnit, difficultyFactor: number): void => {
  const positive = difficultyFactor / 20
  for (const attributeId of POSITIVE_ATTRIBUTE_IDS) enemy.attributes[attributeId] = positive

  const reduction = Math.min(80, Math.max(0, difficultyFactor / 100 + 10))
  for (const attributeId of REDUCTION_ATTRIBUTE_IDS) enemy.attributes[attributeId] = reduction

  enemy.attributes[26] = Math.max(0, difficultyFactor / 4000)
  enemy.attributes[27] = Math.min(80, Math.max(0, difficultyFactor / 100))
  // 敌人属性函数未命中的基础分支：吸血、生命恢复、护盾超限为 0，能量回复为 1。
  enemy.attributes[14] = 0
  enemy.attributes[15] = 0
  enemy.attributes[24] = 0
  enemy.attributes[29] = 1
}

const createEnemy = (
  worldId: string,
  stage: number,
  difficultyFactor: number,
  rank: CombatRank,
  identity: EnemyIdentity,
  localPosition: number,
): CombatUnit => {
  const growth = identity.definition.growth
  const multiplier = TYPE_MULTIPLIERS[rank]
  const growthFactor = (attributeIndex: number): number => growth[attributeIndex] / 100
  const commonScale = 0.8 + difficultyFactor / 3000
  const attackBase = difficultyFactor * 2 + Math.pow(1.01, difficultyFactor) * 100
  const defenseBase = difficultyFactor * 2 + Math.pow(1.01, difficultyFactor) * 100 * 0.5

  const maxHp = Math.round(
    (difficultyFactor * 10 + Math.pow(1.011, difficultyFactor) * 50 * 5)
    * multiplier.hp
    * growthFactor(0),
  ) - 100
  const effectiveAgility = Math.round(
    commonScale * (150 + difficultyFactor / 3) * multiplier.speed * growthFactor(1),
  )
  const externalAttack = Math.round(
    commonScale * attackBase * multiplier.offenseDefense * growthFactor(2),
  ) - 40
  const externalDefense = Math.round(
    commonScale * defenseBase * multiplier.offenseDefense * growthFactor(3),
  ) - 20
  const internalAttack = Math.round(
    commonScale * attackBase * multiplier.offenseDefense * growthFactor(4),
  ) - 40
  const internalDefense = Math.round(
    commonScale * defenseBase * multiplier.offenseDefense * growthFactor(5),
  ) - 20
  const criticalChancePct = Math.max(5, Math.pow(Math.log10(difficultyFactor / 20 + 5), 4) + 3)
  const criticalDamagePct = Math.max(150, (1.5 + difficultyFactor / 2000) * 100)
  const accuracyPct = Math.pow(Math.log10(difficultyFactor / 10 + 5), 4)
  const evadePct = accuracyPct
  const slot = localPositionToSlot(localPosition)

  const enemy: CombatUnit = {
    id: instanceEnemyId(worldId, stage, identity, localPosition),
    name: identity.definition.name,
    side: 'enemy',
    row: slot.row,
    col: slot.col,
    formationOrder: 15 + localPosition,
    rank,
    alive: true,
    hp: maxHp,
    maxHp,
    shield: 0,
    energy: 0,
    maxEnergy: 5,
    gauge: 0,
    effectiveAgility,
    externalAttack,
    internalAttack,
    externalDefense,
    internalDefense,
    accuracy: accuracyPct / 100,
    evade: evadePct / 100,
    criticalChance: criticalChancePct / 100,
    criticalMultiplier: criticalDamagePct / 100,
    controlResistance: 0,
    cooldowns: {},
    statuses: [],
    skillIds: identity.definition.skillIds,
    baseAttackId: identity.definition.attackSkillId,
    attributes: panelToAttributeMap({
      maxHp,
      effectiveAgility,
      externalAttack,
      externalDefense,
      internalAttack,
      internalDefense,
      accuracy: accuracyPct / 100,
      evade: evadePct / 100,
      criticalChance: criticalChancePct / 100,
      criticalMultiplier: criticalDamagePct / 100,
      controlResistance: 0,
      initialEnergy: 0,
      energyRecovery: 1,
      cooldownRate: 0,
      lifeSteal: 0,
    }),
  }
  applyOriginalEnemyAttributes(enemy, difficultyFactor)
  applyPassiveAttributes(enemy)
  return enemy
}

export const createWave = (
  worldId: string,
  stage: number,
  wave: number,
  seed: number,
  difficulty = 1,
): CombatWave => {
  if (stage < 1 || stage > 10 || wave < 1 || wave > 10) throw new Error('小关或波次超出范围')
  const group = stageEnemyGroup(worldId, stage)
  if (!group) throw new Error(`${worldId} 第 ${stage} 关缺少怪物表`)

  const rng = createRng(seed + wave * 101)
  const formationId = formationIdForWave(wave, rng)
  const formation = ENEMY_FORMATIONS[formationId]
  if (!formation) throw new Error(`原版阵型 zx#${formationId} 不存在`)
  const difficultyFactor = ordinaryCombatDifficulty(difficulty, group.locationId, wave)
  const enemies = formation.map(({ localPosition, enemyIndex }) => {
    const rank = enemyIndex === 6 ? 'boss' : rankForMob(wave, rng)
    return createEnemy(
      worldId,
      stage,
      difficultyFactor,
      rank,
      identityFor(group, enemyIndex),
      localPosition,
    )
  })

  return { worldId, difficulty, stage, wave, enemies }
}

export const isWaveCleared = (enemies: CombatUnit[]): boolean =>
  enemies.length > 0 && enemies.every((enemy) => !enemy.alive || enemy.hp <= 0)

export const advanceToNextWave = (state: CombatSnapshot): void => {
  if (state.wave >= 10) throw new Error('第十波后不能继续换波')
  state.wave += 1
  state.enemies = createWave(state.worldId, state.stage, state.wave, state.seed, state.difficulty).enemies
}
