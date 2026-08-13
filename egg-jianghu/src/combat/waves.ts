import { createRng } from './rng'
import { panelToAttributeMap } from './stats'
import { enemyName } from '../content/enemy-names'
import type { CombatRank, CombatSnapshot, CombatUnit } from './types'

export { enemyDisplayName } from '../content/enemy-names'

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
  const effectiveAgility = 35 + worldIndex * 4 + stage + rng.nextInt(0, 8)
  const externalAttack = Math.floor((25 + worldIndex * 8 + stage * 2) * enemyRankMultiplier[rank])
  const internalAttack = Math.floor((20 + worldIndex * 7 + stage * 2) * enemyRankMultiplier[rank])
  const externalDefense = Math.floor((12 + worldIndex * 5 + stage) * enemyRankMultiplier[rank])
  const internalDefense = Math.floor((10 + worldIndex * 5 + stage) * enemyRankMultiplier[rank])
  const accuracy = 0.02 + worldIndex * 0.005
  const evade = Math.min(0.35, 0.03 + worldIndex * 0.01)
  const criticalChance = Math.min(0.35, 0.04 + worldIndex * 0.01)
  const criticalMultiplier = 1.5
  const controlResistance = rank === 'boss' ? 0.55 : rank === 'elite' ? 0.3 : 0.1
  const row = index < 3 ? 'front' : 'back'
  const position = (index % 3) as 0 | 1 | 2
  const rankId = rank === 'boss' ? 'boss' : rank === 'elite' ? `elite_${index + 1}` : `normal_${index + 1}`
  return {
    id: `${worldId}_stage_${String(stage).padStart(2, '0')}_${rankId}`,
    name: enemyName(worldId, rank, stage, index + 1),
    side: 'enemy',
    row,
    position,
    formationOrder: 6 + index,
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
