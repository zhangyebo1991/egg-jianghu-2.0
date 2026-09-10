import { expect, it } from 'vitest'
import { HEROES_V10, PLAYER_HERO_V10 } from '../content/heroes'
import { createHeroProgress } from '../domain/state'
import { buildCombatStats } from './stats'

const coreKeys = ['maxHp', 'effectiveAgility', 'externalAttack', 'internalAttack', 'externalDefense', 'internalDefense'] as const

it('相同天资与职业下，角色升级提升六项核心属性', () => {
  const progress = createHeroProgress('job_1')
  const before = buildCombatStats(PLAYER_HERO_V10, progress)
  progress.level = 44
  const after = buildCombatStats(PLAYER_HERO_V10, progress)
  for (const key of coreKeys) expect(after[key], key).toBeGreaterThan(before[key])
})

it('体魄仅影响对应天资乘区，不代替等级改变所有基础属性', () => {
  const progress = createHeroProgress('job_1')
  progress.level = 9
  const before = buildCombatStats(PLAYER_HERO_V10, progress)
  const after = buildCombatStats({ ...PLAYER_HERO_V10, aptitudes: { ...PLAYER_HERO_V10.aptitudes, constitution: 47 } }, progress)
  expect(after.maxHp).toBeGreaterThan(before.maxHp)
  expect(after.externalDefense).toBeGreaterThan(before.externalDefense)
  for (const key of ['externalAttack', 'internalAttack', 'internalDefense', 'effectiveAgility'] as const) expect(after[key]).toBe(before[key])
})

it('复算截图中的44级主角与9级邢道荣，白丁4级无额外加成', () => {
  const progress = createHeroProgress('job_1')
  progress.careers.job_1.level = 4
  progress.level = 44
  // 清除原版索引以排除随角色自动拥有的免费皮肤，只复算等级/天资/职业乘区。
  const player = buildCombatStats({ ...PLAYER_HERO_V10, sourceId: undefined }, progress)
  progress.level = 9
  const xing = buildCombatStats({ ...HEROES_V10.find(hero => hero.sourceId === 2)!, sourceId: undefined }, progress)
  const expectedPlayer = [2150.16, 164.61, 429.66, 429.66, 214.83, 214.83]
  const expectedXing = [730.05, 178.56, 143.22, 121.83, 76.26, 69.75]
  coreKeys.forEach((key, index) => {
    expect(player[key], key).toBeCloseTo(expectedPlayer[index])
    expect(xing[key], key).toBeCloseTo(expectedXing[index])
  })
})
