import { createRng } from './rng'
import type { CombatRank, CombatSnapshot, CombatUnit } from './types'

export interface CombatWave {
  worldId: string
  stage: number
  wave: number
  enemies: CombatUnit[]
}

const enemyRankMultiplier: Record<CombatRank, number> = {
  normal: 1,
  elite: 1.65,
  boss: 3.1,
}

const enemyName = (rank: CombatRank, stage: number): string => {
  if (rank === 'boss') return `第${stage}关首领`
  if (rank === 'elite') return `第${stage}关精英`
  return `第${stage}关敌手`
}

export const enemyDisplayName = (enemyId: string): string => {
  const match = enemyId.match(/_stage_(\d+)_(normal|elite|boss)(?:_\d+)?$/)
  if (!match) return '未知目标'
  return enemyName(match[2] as CombatRank, Number(match[1]))
}

const createEnemy = (
  worldId: string,
  stage: number,
  wave: number,
  rank: CombatRank,
  index: number,
  seed: number,
): CombatUnit => {
  const rng = createRng(seed)
  const worldIndex = Number(worldId.slice(-2)) || 1
  const scale = (1 + (worldIndex - 1) * 0.6 + (stage - 1) * 0.09 + (wave - 1) * 0.025) * enemyRankMultiplier[rank]
  const maxHp = Math.floor((70 + rng.nextInt(0, 21)) * scale)
  const row = index < 3 ? 'front' : 'back'
  const position = (index % 3) as 0 | 1 | 2
  const rankId = rank === 'boss' ? 'boss' : rank === 'elite' ? `elite_${index + 1}` : `normal_${index + 1}`
  return {
    id: `${worldId}_stage_${String(stage).padStart(2, '0')}_${rankId}`,
    name: enemyName(rank, stage),
    side: 'enemy',
    row,
    position,
    formationOrder: 6 + index,
    rank,
    alive: true,
    hp: maxHp,
    maxHp,
    energy: 20,
    maxEnergy: 100,
    gauge: 0,
    effectiveAgility: 35 + worldIndex * 4 + stage + rng.nextInt(0, 8),
    externalAttack: Math.floor((25 + worldIndex * 8 + stage * 2) * enemyRankMultiplier[rank]),
    internalAttack: Math.floor((20 + worldIndex * 7 + stage * 2) * enemyRankMultiplier[rank]),
    externalDefense: Math.floor((12 + worldIndex * 5 + stage) * enemyRankMultiplier[rank]),
    internalDefense: Math.floor((10 + worldIndex * 5 + stage) * enemyRankMultiplier[rank]),
    accuracy: 0.02 + worldIndex * 0.005,
    evade: Math.min(0.35, 0.03 + worldIndex * 0.01),
    criticalChance: Math.min(0.35, 0.04 + worldIndex * 0.01),
    criticalMultiplier: 1.5,
    controlResistance: rank === 'boss' ? 0.55 : rank === 'elite' ? 0.3 : 0.1,
    controlDiminishing: {},
    cooldowns: {},
    statuses: [],
    momentum: {},
    skillIds: [null, null, null, null],
    baseSkillId: 'enemy_base',
  }
}

const ranksForWave = (wave: number): CombatRank[] => {
  if (wave === 10) return ['boss', 'elite', 'normal']
  const count = 2 + (wave % 3)
  return Array.from({ length: count }, (_, index) => wave >= 3 && index === count - 1 && wave % 3 === 0 ? 'elite' : 'normal')
}

export const createWave = (
  worldId: string,
  stage: number,
  wave: number,
  seed: number,
): CombatWave => {
  if (stage < 1 || stage > 10 || wave < 1 || wave > 10) throw new Error('小关或波次超出范围')
  const ranks = ranksForWave(wave)
  return {
    worldId,
    stage,
    wave,
    enemies: ranks.map((rank, index) => createEnemy(worldId, stage, wave, rank, index, seed + wave * 101 + index * 17)),
  }
}

export const isWaveCleared = (enemies: CombatUnit[]): boolean =>
  enemies.length > 0 && enemies.every((enemy) => !enemy.alive || enemy.hp <= 0)

export const advanceToNextWave = (state: CombatSnapshot): void => {
  if (state.wave >= 10) throw new Error('第十波后不能继续换波')
  state.wave += 1
  state.enemies = createWave(state.worldId, state.stage, state.wave, state.seed).enemies
}
