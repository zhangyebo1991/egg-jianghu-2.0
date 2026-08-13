import { createRng, type Rng } from './rng'
import { panelToAttributeMap } from './stats'
import { stageEnemyGroup, type EnemyDefinition } from '../content/enemies'
import type { FormationColumn, FormationRow } from '../domain/types'
import type { CombatRank, CombatSnapshot, CombatUnit } from './types'

export { enemyDisplayName } from '../content/enemy-names'

interface EnemySlot {
  row: FormationRow
  col: FormationColumn
}

// 内置敌方阵型模板：普通敌前列铺开、精英居次列、boss 中路居中（参照诸天 zx 阵型思路）
const WAVE_FORMATIONS: Record<number, EnemySlot[]> = {
  1: [{ row: 1, col: 0 }],
  2: [{ row: 0, col: 0 }, { row: 2, col: 0 }],
  3: [{ row: 0, col: 0 }, { row: 2, col: 0 }, { row: 1, col: 1 }],
  4: [{ row: 0, col: 0 }, { row: 2, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }],
}

// 第 10 波：boss 中路居中，精英上路前列，小怪下路前列
const BOSS_FORMATION: EnemySlot[] = [{ row: 1, col: 1 }, { row: 0, col: 0 }, { row: 2, col: 0 }]

const waveSlots = (wave: number, count: number): EnemySlot[] => {
  const template = wave === 10 ? BOSS_FORMATION : WAVE_FORMATIONS[count] ?? WAVE_FORMATIONS[4]
  return Array.from({ length: count }, (_, index) => template[index % template.length])
}

export interface CombatWave {
  worldId: string
  difficulty: number
  stage: number
  wave: number
  enemies: CombatUnit[]
}

// 精英 1.5 对齐诸天「敌人属性function」；boss 维持自有平衡倍率
const enemyRankMultiplier: Record<CombatRank, number> = {
  normal: 1,
  elite: 1.5,
  boss: 3.1,
}

interface EnemyIdentity {
  definition: EnemyDefinition
  /** mob 为本关小怪序号 0-4；boss 无 */
  mobIndex: number | null
}

const enemyId = (worldId: string, stage: number, identity: EnemyIdentity): string => {
  const prefix = `${worldId}_stage_${String(stage).padStart(2, '0')}`
  return identity.mobIndex === null ? `${prefix}_boss` : `${prefix}_mob_${identity.mobIndex + 1}`
}

const createEnemy = (
  worldId: string,
  difficulty: number,
  stage: number,
  wave: number,
  rank: CombatRank,
  identity: EnemyIdentity,
  slot: EnemySlot,
  seed: number,
): CombatUnit => {
  const rng = createRng(seed)
  const worldIndex = Number(worldId.slice(-2)) || 1
  const difficultyIndex = Math.max(1, difficulty)
  // 六维成长系数（生命/物攻/物防/法防/法攻/速度，基准 100）做同关怪物差异化
  const growth = identity.definition.growth
  const scale = (1
    + (worldIndex - 1) * 0.6
    + (difficultyIndex - 1) * 0.45
    + (stage - 1) * 0.09
    + (wave - 1) * 0.025) * enemyRankMultiplier[rank]
  const maxHp = Math.floor((70 + rng.nextInt(0, 21)) * scale * growth[0] / 100)
  const effectiveAgility = Math.floor((35 + worldIndex * 4 + difficultyIndex * 3 + stage + rng.nextInt(0, 8)) * growth[5] / 100)
  const externalAttack = Math.floor((25 + worldIndex * 8 + difficultyIndex * 6 + stage * 2) * enemyRankMultiplier[rank] * growth[1] / 100)
  const internalAttack = Math.floor((20 + worldIndex * 7 + difficultyIndex * 5 + stage * 2) * enemyRankMultiplier[rank] * growth[4] / 100)
  const externalDefense = Math.floor((12 + worldIndex * 5 + difficultyIndex * 3 + stage) * enemyRankMultiplier[rank] * growth[2] / 100)
  const internalDefense = Math.floor((10 + worldIndex * 5 + difficultyIndex * 3 + stage) * enemyRankMultiplier[rank] * growth[3] / 100)
  const accuracy = 0.02 + worldIndex * 0.005
  const evade = Math.min(0.35, 0.03 + worldIndex * 0.01)
  const criticalChance = Math.min(0.35, 0.04 + worldIndex * 0.01)
  const criticalMultiplier = 1.5
  const controlResistance = rank === 'boss' ? 0.55 : rank === 'elite' ? 0.3 : 0.1
  return {
    id: enemyId(worldId, stage, identity),
    name: identity.definition.name,
    side: 'enemy',
    row: slot.row,
    col: slot.col,
    formationOrder: 15 + slot.row * 5 + slot.col,
    rank,
    alive: true,
    hp: maxHp,
    maxHp,
    energy: 0,
    maxEnergy: 100,
    gauge: 0,
    effectiveAgility,
    externalAttack,
    internalAttack,
    externalDefense,
    internalDefense,
    accuracy,
    evade,
    criticalChance,
    criticalMultiplier,
    controlResistance,
    controlDiminishing: {},
    cooldowns: {},
    statuses: [],
    momentum: {},
    skillIds: [null, null, null, null],
    baseSkillId: 'enemy_base',
    attributes: panelToAttributeMap({
      maxHp,
      effectiveAgility,
      externalAttack,
      externalDefense,
      internalAttack,
      internalDefense,
      accuracy,
      evade,
      criticalChance,
      criticalMultiplier,
      controlResistance,
      initialEnergy: 0,
      energyRecovery: 1,
      cooldownRate: 0,
      lifeSteal: 0,
    }),
  }
}

const ranksForWave = (wave: number): CombatRank[] => {
  if (wave === 10) return ['boss', 'elite', 'normal']
  const count = 2 + (wave % 3)
  return Array.from({ length: count }, (_, index) => wave >= 3 && index === count - 1 && wave % 3 === 0 ? 'elite' : 'normal')
}

// 从本关 5 小怪中不放回抽取，保证同波不出重复工种（id 亦随之唯一）
const pickMobIndices = (rng: Rng, count: number): number[] => {
  const pool = [0, 1, 2, 3, 4]
  return Array.from({ length: Math.min(count, pool.length) }, () => pool.splice(rng.nextInt(0, pool.length), 1)[0])
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
  const ranks = ranksForWave(wave)
  const slots = waveSlots(wave, ranks.length)
  const pickRng = createRng(seed + wave * 101)
  const mobIndices = pickMobIndices(pickRng, wave === 10 ? ranks.length - 1 : ranks.length)
  let mobCursor = 0
  const identities: EnemyIdentity[] = ranks.map((rank) => {
    if (rank === 'boss') return { definition: group.boss, mobIndex: null }
    const mobIndex = mobIndices[mobCursor]
    mobCursor += 1
    return { definition: group.mobs[mobIndex], mobIndex }
  })
  return {
    worldId,
    difficulty,
    stage,
    wave,
    enemies: ranks.map((rank, index) => createEnemy(worldId, difficulty, stage, wave, rank, identities[index], slots[index], seed + wave * 101 + index * 17)),
  }
}

export const isWaveCleared = (enemies: CombatUnit[]): boolean =>
  enemies.length > 0 && enemies.every((enemy) => !enemy.alive || enemy.hp <= 0)

export const advanceToNextWave = (state: CombatSnapshot): void => {
  if (state.wave >= 10) throw new Error('第十波后不能继续换波')
  state.wave += 1
  state.enemies = createWave(state.worldId, state.stage, state.wave, state.seed, state.difficulty).enemies
}
