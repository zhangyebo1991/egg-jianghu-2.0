import { describe, expect, it } from 'vitest'
import { STAGE_ENEMIES } from '../content/enemies'
import { canonicalEnemyId } from '../content/enemy-names'
import {
  createWave,
  enemyDisplayName,
  ordinaryCombatDifficulty,
  waveEnemyLevel,
} from './waves'

describe('原版普通关卡波次', () => {
  it('第 1 波固定使用 zx#1，两名敌人的怪种与阵位完全查表', () => {
    const { enemies } = createWave('world_01', 1, 1, 42)

    expect(enemies.map((enemy) => ({
      name: enemy.name,
      row: enemy.row,
      col: enemy.col,
      formationOrder: enemy.formationOrder,
      rank: enemy.rank,
    }))).toEqual([
      { name: '长弓手', row: 1, col: 1, formationOrder: 22, rank: 'normal' },
      { name: '黄巾战士', row: 1, col: 3, formationOrder: 24, rank: 'normal' },
    ])
  })

  it('第 2 波固定使用 zx#2，生成三名小怪', () => {
    const { enemies } = createWave('world_01', 1, 2, 42)

    expect(enemies.map((enemy) => [enemy.name, enemy.formationOrder])).toEqual([
      ['随军参谋', 17],
      ['汉末中医', 22],
      ['护卫甲兵', 24],
    ])
    expect(enemies.every((enemy) => enemy.rank === 'normal')).toBe(true)
  })

  it('第 3 波从 zx#3..18 确定性抽取五怪，且仍全部为小怪档', () => {
    const first = createWave('world_01', 1, 3, 42)
    const second = createWave('world_01', 1, 3, 42)

    expect(first).toEqual(second)
    expect(first.enemies.map((enemy) => enemy.formationOrder)).toEqual([16, 17, 21, 22, 25])
    expect(first.enemies).toHaveLength(5)
    expect(first.enemies.every((enemy) => enemy.rank === 'normal')).toBe(true)
  })

  it('第 4 波起每个普通怪独立按 80/16/4 生成小怪、精英、头目', () => {
    const { enemies } = createWave('world_01', 1, 4, 23)

    expect(enemies.map((enemy) => enemy.rank)).toEqual(['normal', 'captain', 'normal', 'normal', 'elite'])
    expect(enemies.map((enemy) => enemy.formationOrder)).toEqual([17, 19, 25, 27, 29])
  })

  it('第 10 波从 zx#19..23 抽取六怪，并且只有 enemyIndex=6 是首领', () => {
    const { enemies } = createWave('world_01', 1, 10, 42)
    const bosses = enemies.filter((enemy) => enemy.rank === 'boss')

    expect(enemies).toHaveLength(6)
    expect(enemies.map((enemy) => enemy.formationOrder)).toEqual([19, 20, 22, 24, 29, 30])
    expect(bosses).toHaveLength(1)
    expect(bosses[0]).toMatchObject({
      name: '张角',
      id: 'world_01_stage_01_boss_at_07',
      formationOrder: 22,
      skillIds: [32, 74, 10, 47],
      baseAttackId: 4,
    })
  })

  it('阵型允许重复怪种，但每个战斗实例 ID 唯一且能归一化结算', () => {
    const { enemies } = createWave('world_01', 1, 10, 42)
    const healers = enemies.filter((enemy) => enemy.name === '汉末中医')

    expect(healers).toHaveLength(3)
    expect(new Set(enemies.map((enemy) => enemy.id)).size).toBe(enemies.length)
    expect(healers.map((enemy) => enemy.id)).toEqual([
      'world_01_stage_01_mob_5_at_04',
      'world_01_stage_01_mob_5_at_09',
      'world_01_stage_01_mob_5_at_14',
    ])
    expect(healers.map((enemy) => canonicalEnemyId(enemy.id))).toEqual([
      'world_01_stage_01_mob_5',
      'world_01_stage_01_mob_5',
      'world_01_stage_01_mob_5',
    ])
  })
})

describe('原版敌人面板公式', () => {
  it('world_01 第 1 关难度 1 第 1 波与原版公式 golden fixture 一致', () => {
    const [longbow, fighter] = createWave('world_01', 1, 1, 42).enemies

    expect(longbow).toMatchObject({
      maxHp: 163,
      hp: 163,
      effectiveAgility: 144,
      externalAttack: 51,
      externalDefense: 18,
      internalAttack: 26,
      internalDefense: 22,
      criticalChance: 0.05,
      controlResistance: 0,
    })
    expect(fighter).toMatchObject({
      maxHp: 189,
      effectiveAgility: 132,
      externalAttack: 59,
      externalDefense: 22,
      internalAttack: 26,
      internalDefense: 18,
    })
    expect(longbow.criticalMultiplier).toBeCloseTo(1.5005)
    expect(longbow.accuracy).toBeCloseTo(0.00250655983854447)
    expect(longbow.evade).toBeCloseTo(longbow.accuracy)
    expect(longbow.attributes[20]).toBeCloseTo(0.05)
    expect(longbow.attributes[21]).toBeCloseTo(10.01)
    expect(longbow.attributes[26]).toBeCloseTo(0.00025)
    expect(longbow.attributes[27]).toBeCloseTo(0.01)
    expect(longbow.attributes[29]).toBe(1)
  })

  it('普通战斗难度系数使用 sq 原始地点行号，不在运行时猜 world/stage', () => {
    expect(ordinaryCombatDifficulty(1, 1, 1)).toBe(1)
    expect(ordinaryCombatDifficulty(2, 13, 4)).toBe(224)
    expect(waveEnemyLevel('world_13', 10, 10, 3)).toBe(1500)
  })

  it('drsx 六维严格按生命、速度、物攻、物防、法攻、法防消费', () => {
    const [longbow] = createWave('world_01', 1, 1, 42).enemies
    const definition = STAGE_ENEMIES['world_01:1']!.mobs[3]

    expect(definition.growth).toEqual([100, 120, 110, 90, 80, 100])
    expect(longbow).toMatchObject({
      maxHp: 163,
      effectiveAgility: 144,
      externalAttack: 51,
      externalDefense: 18,
      internalAttack: 26,
      internalDefense: 22,
    })
  })

  it('缺少怪物表的位面直接抛错', () => {
    expect(() => createWave('world_99', 1, 1, 42)).toThrow('缺少怪物表')
  })
})

describe('敌人显示名称', () => {
  it('规范 ID 与带阵位的实例 ID 都转换为悬榜可读名称', () => {
    expect(enemyDisplayName('world_01_stage_01_mob_1')).toBe('黄巾战士')
    expect(enemyDisplayName('world_01_stage_01_mob_1_at_09')).toBe('黄巾战士')
    expect(enemyDisplayName('world_01_stage_01_boss_at_07')).toBe('张角')
  })

  it('不向玩家暴露无法识别的内部 ID', () => {
    expect(enemyDisplayName('broken_enemy_id')).toBe('未知目标')
    expect(enemyDisplayName('world_01_stage_01_normal_1')).toBe('未知目标')
  })
})
