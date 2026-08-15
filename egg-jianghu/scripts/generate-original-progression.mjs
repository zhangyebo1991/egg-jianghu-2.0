// 从本机《诸天刷宝录》分析数据生成下一阶段所需的原版静态目录。
// 运行时只读取生成后的 TypeScript，不依赖原版目录。
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_ROOT = resolve(HERE, '../../../诸天刷宝录/_analysis')
const OUT_FILE = join(HERE, '../src/content/original-progression.generated.ts')

const load = (name) => JSON
  .parse(readFileSync(join(SOURCE_ROOT, `${name}.json`), 'utf8'))
  .data.map((row) => row.map((cell) => cell[0]))

const jn = load('jn')
const shili = load('shili')
const bk = load('bk')
const qh = load('qh')
const wp = load('wp')
const sw = load('sw')
const sq = load('sq')
const dr = load('dr')
const fb = load('fb')
const dl = load('dl')

const factionBySkillId = new Map()
const factionSkillPositionById = new Map()
const factions = shili.slice(1).map((row) => {
  const id = Number(row[0])
  const skillIds = [5, 6, 7, 8, 9, 10].map((col) => Number(row[col]))
  for (const [position, skillId] of skillIds.entries()) {
    factionBySkillId.set(skillId, id)
    factionSkillPositionById.set(skillId, position)
  }
  return {
    id,
    name: String(row[1]),
    worldIndex: Number(row[2]),
    description: String(row[3]),
    currencyKind: String(row[4]) === '贡献' ? 'contribution' : 'worldCurrency',
    skillIds,
    organizationKind: String(row[11]),
    element: Number(row[22]) || 0,
  }
})

const treasures = bk.slice(1).map((row) => {
  const itemId = Number(row[1])
  const item = wp[itemId]
  const manual = String(item[5]) === '秘籍'
  return {
    catalogId: Number(row[0]),
    itemId,
    name: String(item[1]),
    kind: manual ? 'manual' : 'treasure',
    quality: Number(item[4]),
    slotId: Number(item[6]) || 10,
    iconSource: item[2],
    description: String(item[10] ?? ''),
    price: Number(row[2]),
    worldIndex: Number(row[3]),
    grantSkillId: manual ? Number(item[6]) : null,
    effectValue: Number(item[12]) || 0,
    effectIds: [Number(item[13]) || 0, Number(item[15]) || 0].filter(Boolean),
  }
})

const manualBySkillId = new Map(
  treasures
    .filter((item) => item.kind === 'manual' && item.grantSkillId)
    .map((item) => [item.grantSkillId, item.itemId]),
)
const specialSkillIds = new Set([71, 72, 74, 75, 81, 82, 83])
const deityIdsBySkillId = new Map()
for (const row of sw.slice(1)) {
  const skillId = Number(row[4])
  const ids = deityIdsBySkillId.get(skillId) ?? []
  ids.push(Number(row[0]))
  deityIdsBySkillId.set(skillId, ids)
}

const playerSkillIds = new Set([
  ...factionBySkillId.keys(),
  ...manualBySkillId.keys(),
  ...specialSkillIds,
])
const playerSkills = [...playerSkillIds]
  .sort((left, right) => left - right)
  .map((id) => {
    const row = jn[id]
    if (!row || !String(row[1]).trim()) throw new Error(`玩家技能 jn#${id} 不存在`)
    const factionId = factionBySkillId.get(id) ?? null
    const factionSkillPosition = factionSkillPositionById.get(id)
    const source = factionId
      ? 'faction'
      : manualBySkillId.has(id)
        ? 'treasure-manual'
        : 'special'
    return {
      id,
      name: String(row[1]),
      description: String(row[14] ?? ''),
      behavior: String(row[15] ?? ''),
      route: String(row[26] ?? ''),
      skillCategory: Number(row[4]) || 0,
      element: Number(row[5]) || 0,
      difficulty: Number(row[7]) || 1,
      maxLevel: Math.max(1, Number(row[25]) || 1),
      energyCost: Number(row[19]) || 0,
      baseEffect: Number(row[16]) || 0,
      effectGrowthPerTenLevels: Number(row[17]) || 0,
      basePowerPercent: Number(row[29]) || 100,
      buffId: Number(row[21]) || null,
      buffBaseChance: Number(row[22]) || 0,
      buffChanceGrowthPerTenLevels: Number(row[23]) || 0,
      rangeId: Number(row[37]) || 0,
      targetSide: String(row[39] ?? ''),
      source,
      factionId,
      branchIndex: factionSkillPosition === undefined ? null : factionSkillPosition % 2 + 1,
      stage: factionSkillPosition === undefined ? null : Math.floor(factionSkillPosition / 2) + 1,
      previousSkillId: factionSkillPosition === undefined || factionSkillPosition < 2
        ? null
        : factions.find((item) => item.id === factionId).skillIds[factionSkillPosition - 2],
      manualItemId: manualBySkillId.get(id) ?? null,
      deityIds: deityIdsBySkillId.get(id) ?? [],
    }
  })

const artifactSouls = qh.slice(1).map((row) => ({
  id: Number(row[0]),
  name: String(row[1]),
  kind: String(row[2]),
  description: String(row[3]),
  attributeId: Number(row[4]) || 0,
  value: Number(row[5]) || 0,
  tier: Number(row[6]) || 0,
}))

const equipmentSnapshot = (itemId) => {
  const row = wp[itemId]
  if (!row || String(row[5]) !== '装备') throw new Error(`wp#${itemId} 不是装备`)
  const fixedAffixes = []
  for (const attributeCol of [17, 19, 21, 23, 25]) {
    const attributeId = Number(row[attributeCol]) || 0
    const coefficient = Number(row[attributeCol + 1]) || 0
    if (attributeId) fixedAffixes.push({ attributeId, coefficient })
  }
  return {
    itemId,
    name: String(row[1]),
    iconSource: row[2],
    quality: Number(row[4]),
    slotId: Number(row[6]),
    weaponType: Number(row[7]) || 0,
    rarity: String(row[9] ?? ''),
    recipeId: Number(row[3]) || null,
    fixedAffixes,
    artifactSoulId: Number(row[27]) || null,
    setFactionId: Number(row[28]) || null,
    passiveSkillId: Number(row[29]) || null,
  }
}

const rewardSnapshot = (itemId) => {
  const row = wp[itemId]
  if (!row || !String(row[1]).trim()) throw new Error(`wp#${itemId} 奖励物品不存在`)
  const reward = String(row[5]) === '装备'
    ? { kind: 'equipment', item: equipmentSnapshot(itemId) }
    : {
        kind: 'item',
        item: {
          itemId,
          name: String(row[1]),
          category: String(row[5]),
          quality: Number(row[4]) || 0,
        },
      }
  return { ...reward, baseRoll: Number(row[32]) || 0 }
}

const largeDungeons = fb.slice(1, 8).map((row, dungeonIndex) => ({
  id: Number(row[0]),
  name: String(row[1]),
  worldIndex: Number(row[2]),
  enemyGroupIds: [3, 6, 9, 12, 15].map((col) => Number(row[col])),
  stageNames: [4, 7, 10, 13].map((col) => String(row[col])),
  rewards: fb.slice(1, 31)
    .map((rewardRow) => rewardSnapshot(Number(rewardRow[21 + dungeonIndex]))),
}))

const sacredBeasts = load('zs').slice(1).map((row) => ({
  id: Number(row[0]),
  name: String(row[1]),
  worldIndex: Number(String(row[2]).replace(/\D/g, '')),
  battleDifficultyOffset: Number(row[3]),
  element: Number(row[4]) || 0,
  enemyId: Number(row[5]),
  shortName: String(row[7]),
  stages: row.slice(8, 17).map((itemId, stageIndex) => ({
    stage: stageIndex + 1,
    equipment: equipmentSnapshot(Number(itemId)),
    worldTreeLeaves: 1,
    starSoul: 20,
  })),
}))

const deities = sw.slice(1).map((row) => {
  const shrineId = Number(row[2])
  const shrine = sq[shrineId]
  const bossId = Number(shrine[8])
  const imperialWeaponId = Number(row[8])
  return {
    id: Number(row[0]),
    name: String(row[1]),
    shrineId,
    shrineName: String(shrine[1]),
    bossId,
    bossName: String(dr[bossId][1]),
    skillId: Number(row[4]),
    unlockDivineLevel: Number(row[11]),
    recipeId: Number(row[9]),
    imperialWeapon: equipmentSnapshot(imperialWeaponId),
  }
})

const sacredUpgrades = Array.from({ length: 78 }, (_, index) => {
  const sourceItemId = 1609 + index
  const targetItemId = sourceItemId + 106
  return {
    source: equipmentSnapshot(sourceItemId),
    target: equipmentSnapshot(targetItemId),
    creationOriginCost: 30,
  }
})

const interworldDropItemIds = [78, 66, 70, 80, 77, 18, 27, 17, 26]
const interworldDropItems = interworldDropItemIds.map((itemId) => ({
  itemId,
  name: String(wp[itemId][1]),
  baseRoll: Number(wp[itemId][32]) || 0,
}))
const interworldEnemies = Array.from({ length: 48 }, (_, index) => {
  const enemyId = 410 + index
  return {
    enemyId,
    name: String(dr[enemyId][1]),
    rank: String(dr[enemyId][5]),
    itemIds: dl.map((row) => Number(row[enemyId]) || 0).filter(Boolean),
  }
})

const assertUnique = (values, label) => {
  if (new Set(values).size !== values.length) throw new Error(`${label} 存在重复 id`)
}
if (factions.length !== 42) throw new Error(`势力数量异常：${factions.length}`)
if (playerSkills.length !== 269) throw new Error(`玩家技能数量异常：${playerSkills.length}`)
if (treasures.length !== 72) throw new Error(`至宝目录数量异常：${treasures.length}`)
if (treasures.filter((item) => item.kind === 'manual').length !== 10) throw new Error('至宝秘籍数量不是 10')
if (artifactSouls.length !== 132) throw new Error(`器魂数量异常：${artifactSouls.length}`)
if (largeDungeons.length !== 7 || largeDungeons.some((item) => item.rewards.length !== 30)) {
  throw new Error('大型副本奖励目录不是 7×30')
}
if (largeDungeons.some((item) => {
  const itemCount = item.rewards.filter((reward) => reward.kind === 'item').length
  const quality6Count = item.rewards.filter(
    (reward) => reward.kind === 'equipment' && reward.item.quality === 6,
  ).length
  const quality7Count = item.rewards.filter(
    (reward) => reward.kind === 'equipment' && reward.item.quality === 7,
  ).length
  return itemCount !== 4 || quality6Count !== 18 || quality7Count !== 8
})) {
  throw new Error('大型副本奖励分布不是 4 个物品、18 件品质 6 装备和 8 件品质 7 装备')
}
if (largeDungeons.some((item) => item.rewards.some((reward) => reward.baseRoll <= 0))) {
  throw new Error('大型副本奖励缺少 wp 掉落基数')
}
if (sacredBeasts.length !== 13 || sacredBeasts.some((item) => item.stages.length !== 9)) {
  throw new Error('镇界圣兽奖励不是 13×9')
}
if (deities.length !== 28) throw new Error(`神位数量异常：${deities.length}`)
if (sacredUpgrades.length !== 78) throw new Error(`圣具进阶数量异常：${sacredUpgrades.length}`)
if (interworldEnemies.length !== 48 || interworldEnemies.some((item) => item.itemIds.length !== 7)) {
  throw new Error('异界敌人掉落目录不是 48×7')
}
assertUnique(factions.map((item) => item.id), '势力')
assertUnique(playerSkills.map((item) => item.id), '玩家技能')
assertUnique(treasures.map((item) => item.itemId), '至宝')
assertUnique(deities.map((item) => item.imperialWeapon.itemId), '帝兵')

const lines = [
  '// 由 scripts/generate-original-progression.mjs 从本机《诸天刷宝录》_analysis 生成，请勿手改。',
  '// 运行时不依赖原版目录；字段映射与数量由生成器断言。',
  '',
  `export const ORIGINAL_FACTIONS = ${JSON.stringify(factions)} as const`,
  '',
  `export const ORIGINAL_PLAYER_SKILLS = ${JSON.stringify(playerSkills)} as const`,
  '',
  `export const ORIGINAL_TREASURES = ${JSON.stringify(treasures)} as const`,
  '',
  `export const ORIGINAL_ARTIFACT_SOULS = ${JSON.stringify(artifactSouls)} as const`,
  '',
  `export const ORIGINAL_LARGE_DUNGEONS = ${JSON.stringify(largeDungeons)} as const`,
  '',
  `export const ORIGINAL_SACRED_BEASTS = ${JSON.stringify(sacredBeasts)} as const`,
  '',
  `export const ORIGINAL_DEITIES = ${JSON.stringify(deities)} as const`,
  '',
  `export const ORIGINAL_SACRED_UPGRADES = ${JSON.stringify(sacredUpgrades)} as const`,
  '',
  `export const ORIGINAL_INTERWORLD_DROP_ITEMS = ${JSON.stringify(interworldDropItems)} as const`,
  '',
  `export const ORIGINAL_INTERWORLD_ENEMIES = ${JSON.stringify(interworldEnemies)} as const`,
  '',
]
writeFileSync(OUT_FILE, lines.join('\n'), 'utf8')
console.log(`已生成：势力 ${factions.length}、玩家技能 ${playerSkills.length}、至宝 ${treasures.length}、器魂 ${artifactSouls.length}`)
console.log(`大型副本 ${largeDungeons.length}×30、镇界圣兽 ${sacredBeasts.length}×9、神位 ${deities.length}、圣具进阶 ${sacredUpgrades.length}`)
