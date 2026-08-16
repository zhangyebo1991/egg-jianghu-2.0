// 从本机《诸天刷宝录》分析数据生成势力、城镇与城市经营真值包。
// 输出只用于证据审阅和后续生成器输入；运行时不依赖原版目录。
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_ROOT = resolve(HERE, '../../../诸天刷宝录/_analysis')
const OUT_DIR = resolve(HERE, '../../docs/evidence/original-world')
const RUNTIME_TOWNS_FILE = resolve(HERE, '../src/content/original-towns.generated.ts')
const RUNTIME_FACTION_EXCHANGE_FILE = resolve(HERE, '../src/content/original-faction-exchange.generated.ts')
const RUNTIME_FACTION_RECRUITMENT_FILE = resolve(HERE, '../src/content/original-faction-recruitment.generated.ts')
const RUNTIME_FACTION_RULES_FILE = resolve(HERE, '../src/content/original-faction-rules.generated.ts')

const sourceNames = [
  'gg.json',
  'shili.json',
  'gxdh.json',
  'rw.json',
  'wm.json',
  'dr.json',
  'wp.json',
  'pf.json',
  'zy.json',
  'hh.json',
  'js.json',
  'tz.json',
  'cj.json',
  'mc.json',
  'jz.json',
  'kj.json',
  'cscz.json',
  'csdj.json',
  'cszb.json',
  'data.json',
  '_all_func_names.txt',
  'scripts/c3runtime.js',
]

const readSource = (name) => readFileSync(join(SOURCE_ROOT, name), 'utf8')
const loadArray = (name) => JSON
  .parse(readSource(`${name}.json`))
  .data.map((row) => row.map((cell) => cell[0]))

const arrays = Object.fromEntries(
  ['gg', 'shili', 'gxdh', 'rw', 'wm', 'dr', 'wp', 'pf', 'zy', 'hh', 'js', 'tz', 'cj', 'mc', 'jz', 'kj', 'cscz', 'csdj', 'cszb']
    .map((name) => [name, loadArray(name)]),
)
const runtimeData = JSON.parse(readSource('data.json'))
const runtimeSource = readSource('scripts/c3runtime.js')

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const fingerprints = Object.fromEntries(sourceNames.map((name) => [name, sha256(readSource(name))]))

const asNumber = (value) => Number(value) || 0
const nonZeroNumbers = (values) => values.map(asNumber).filter(Boolean)

const functionNames = new Map(
  arrays.mc
    .map((row, id) => [id, String(row[10] ?? '').trim()])
    .filter(([, name]) => name),
)

const factions = arrays.shili.slice(1).map((row) => ({
  sourceId: asNumber(row[0]),
  name: String(row[1]),
  worldIndex: asNumber(row[2]),
  description: String(row[3]),
  currencyKind: String(row[4]),
  skillIds: row.slice(5, 11).map(asNumber),
  organizationKind: String(row[11]),
  sceneId: asNumber(row[19]),
  elementId: asNumber(row[22]),
  raw: row,
}))
const formalFactions = factions.filter((faction) => faction.organizationKind === '势力')
const militiaFactions = factions.filter((faction) => faction.organizationKind === '民团')
const factionBySourceId = new Map(factions.map((faction) => [faction.sourceId, faction]))

const sceneSnapshot = (row) => ({
  sourceId: asNumber(row[0]),
  name: String(row[1]),
  visualKey: String(row[2]),
  linkedSceneIds: nonZeroNumbers(row.slice(3, 8)),
  functionIds: nonZeroNumbers(row.slice(11, 16)),
  functions: nonZeroNumbers(row.slice(11, 16)).map((id) => ({
    sourceId: id,
    name: functionNames.get(id) ?? null,
  })),
  mapMarkerVisualKey: String(row[16] ?? ''),
  npcTitle: String(row[17] ?? ''),
  npcVisualKey: String(row[18] ?? ''),
  dialogueId: asNumber(row[19]),
  factionId: asNumber(row[20]),
  raw: row,
})

const worldHubs = arrays.cj.slice(1, 14).map(sceneSnapshot)
const factionTowns = arrays.cj
  .slice(1)
  .filter((row) => String(row[2]).includes('城镇'))
  .map(sceneSnapshot)
const publicSceneIds = [...new Set(worldHubs.flatMap((hub) => hub.linkedSceneIds))]
const publicLocations = publicSceneIds.map((sceneId) => sceneSnapshot(arrays.cj[sceneId]))

const buildings = arrays.jz.slice(1).map((row) => ({
  sourceId: asNumber(row[0]),
  name: String(row[1]),
  visualKey: String(row[2]),
  buildingType: String(row[3]),
  description: String(row[9]),
  category: String(row[11]),
  raw: row,
}))

const technologies = arrays.kj.slice(1).map((row) => ({
  sourceId: asNumber(row[0]),
  name: String(row[1]),
  category: String(row[2]),
  description: String(row[8]),
  raw: row,
}))

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const assertUnique = (values, label) => {
  assert(new Set(values).size === values.length, `${label}存在重复 ID`)
}

const factionExchangeKindByItemId = new Map([
  [3, 'job-book'],
  [4, 'blueprint'],
  [5, 'secret-realm-ticket'],
  [9, 'skin'],
])
const factionExchangeCategoryCorrection = {
  'job-book': 10,
  blueprint: 4,
  'secret-realm-ticket': 2,
  skin: 100000,
}
const skinTypeNames = new Map([
  [1, '本体'],
  [2, '特殊'],
  [3, '稀有'],
  [4, '典藏'],
  [5, '限定'],
  [6, '传说'],
  [7, '神话'],
  [8, '终极'],
])
const factionExchangePriceConstants = {
  qualityPriceIndex: 2.5,
  contributionCurrencyRatio: 20,
  worldPriceStep: 0.8,
}
const normalItemLevel = (quality) => Math.max((quality - 1) * 25, 5)
const worldPriceMultiplier = (worldIndex) => 1 + factionExchangePriceConstants.worldPriceStep * (worldIndex - 1)
const contributionExchangePrice = ({ categoryCorrection, worldIndex, itemLevel, quality }) => {
  const corrected = categoryCorrection
    * worldPriceMultiplier(worldIndex)
    / factionExchangePriceConstants.contributionCurrencyRatio
  return Math.max(1, Math.round(
    (corrected * 10)
    * (10 + itemLevel)
    * factionExchangePriceConstants.qualityPriceIndex ** quality,
  ))
}

const factionExchangeItems = []
for (let slot = 1; slot < arrays.gxdh.length; slot += 1) {
  for (let factionSourceId = 1; factionSourceId <= factions.length; factionSourceId += 1) {
    const itemId = asNumber(arrays.gxdh[slot][factionSourceId * 2 - 1])
    const specificId = asNumber(arrays.gxdh[slot][factionSourceId * 2])
    if (!itemId) continue

    const faction = factionBySourceId.get(factionSourceId)
    const item = arrays.wp[itemId]
    const kind = factionExchangeKindByItemId.get(itemId)
    assert(faction?.organizationKind === '势力', `贡献兑换引用了非正式势力 ${factionSourceId}`)
    assert(item, `贡献兑换引用了不存在的物品 ${itemId}`)
    assert(kind, `贡献兑换出现未知物品类型 ${itemId}`)

    let originalName = String(item[1])
    let priceQuality = 0
    let priceItemLevel = 0
    let requiredReputationLevel = null
    let target = null

    if (kind === 'job-book') {
      const job = arrays.zy[specificId]
      assert(job, `贡献兑换引用了不存在的职业 ${specificId}`)
      priceQuality = asNumber(job[32])
      priceItemLevel = normalItemLevel(priceQuality)
      originalName = `${String(job[1])}${String(item[1])}`
      target = {
        kind: 'job',
        sourceId: specificId,
        name: String(job[1]),
        stateKey: `job_${specificId}`,
      }
    } else if (kind === 'blueprint') {
      const recipe = arrays.pf[specificId]
      assert(recipe, `贡献兑换引用了不存在的图纸 ${specificId}`)
      const targetItemId = asNumber(recipe[1])
      const targetItem = arrays.wp[targetItemId]
      assert(targetItem, `图纸 ${specificId} 引用了不存在的装备 ${targetItemId}`)
      const setId = asNumber(targetItem[29])
      const set = arrays.tz[setId]
      assert(String(targetItem[9]) === '套装', `贡献兑换图纸 ${specificId} 的目标不是套装装备`)
      assert(set, `图纸 ${specificId} 的目标装备缺少套装 ${setId}`)
      priceQuality = asNumber(targetItem[4])
      priceItemLevel = normalItemLevel(priceQuality)
      requiredReputationLevel = asNumber(targetItem[36])
      originalName = `${String(set[1])}之${String(targetItem[1])}${String(item[1])}`
      target = {
        kind: 'blueprint',
        recipeId: specificId,
        stateKey: String(specificId),
        itemId: targetItemId,
        itemName: String(targetItem[1]),
        itemCategory: String(targetItem[9]),
        itemQuality: priceQuality,
        setId,
        setName: String(set[1]),
      }
    } else if (kind === 'secret-realm-ticket') {
      priceQuality = asNumber(item[4])
      priceItemLevel = normalItemLevel(priceQuality)
      requiredReputationLevel = asNumber(item[36])
      target = {
        kind: 'material',
        stateKey: String(itemId),
      }
    } else {
      const skin = arrays.hh[specificId]
      assert(skin, `贡献兑换引用了不存在的幻型 ${specificId}`)
      const heroSourceId = asNumber(skin[2])
      const hero = arrays.js[heroSourceId]
      const skinType = asNumber(skin[4])
      const skinTypeName = skinTypeNames.get(skinType)
      assert(hero, `幻型 ${specificId} 引用了不存在的角色 ${heroSourceId}`)
      assert(skinTypeName, `幻型 ${specificId} 使用了未知类型 ${skinType}`)
      requiredReputationLevel = asNumber(item[36])
      originalName = `${String(hero[1])} · ${String(item[1])} - ${skinTypeName}`
      target = {
        kind: 'skin',
        sourceId: specificId,
        variantName: String(skin[1]),
        heroSourceId,
        heroName: String(hero[1]),
        skinType,
        skinTypeName,
      }
    }

    const categoryCorrection = factionExchangeCategoryCorrection[kind]
    factionExchangeItems.push({
      factionSourceId,
      factionName: faction.name,
      worldIndex: faction.worldIndex,
      slot,
      itemId,
      specificId,
      kind,
      originalName,
      price: contributionExchangePrice({
        categoryCorrection,
        worldIndex: faction.worldIndex,
        itemLevel: priceItemLevel,
        quality: priceQuality,
      }),
      requiredReputationLevel,
      baseItemQuality: asNumber(item[4]),
      priceQuality,
      priceItemLevel,
      worldPriceMultiplier: worldPriceMultiplier(faction.worldIndex),
      categoryCorrection,
      target,
    })
  }
}
const factionExchangeCounts = {
  total: factionExchangeItems.length,
  factions: new Set(factionExchangeItems.map((item) => item.factionSourceId)).size,
  jobBooks: factionExchangeItems.filter((item) => item.kind === 'job-book').length,
  blueprints: factionExchangeItems.filter((item) => item.kind === 'blueprint').length,
  secretRealmTickets: factionExchangeItems.filter((item) => item.kind === 'secret-realm-ticket').length,
  skins: factionExchangeItems.filter((item) => item.kind === 'skin').length,
}

assert(factions.length === 42, `势力数量异常：${factions.length}`)
assert(formalFactions.length === 29, `正式势力数量异常：${formalFactions.length}`)
assert(militiaFactions.length === 13, `民团数量异常：${militiaFactions.length}`)
assert(worldHubs.length === 13, `位面主城数量异常：${worldHubs.length}`)
assert(worldHubs.every((hub) => hub.linkedSceneIds.length === 5), '位面主城不是每城 5 个公共场所')
assert(publicSceneIds.length === 65, `公共场所数量异常：${publicSceneIds.length}`)
assert(factionTowns.length === 29, `势力城镇数量异常：${factionTowns.length}`)
assert(buildings.length === 25, `非空建筑数量异常：${buildings.length}`)
assert(technologies.length === 75, `科技数量异常：${technologies.length}`)
assert(arrays.cscz.length === 52 && arrays.cscz.every((row) => row.length === 20), '城市初始地块矩阵不是 52×20')
assert(arrays.cscz.every((row) => String(row[18] ?? '') === '' && String(row[19] ?? '') === ''), '城市初始地块矩阵保留列出现数据')
assert(technologies.filter((technology) => technology.category === '基础').length === 60, '基础科技不是 60 项')
assert(technologies.filter((technology) => technology.category === '位面').length === 15, '位面科技不是 15 项')
assert(arrays.gxdh.length === 17 && arrays.gxdh.every((row) => row.length === 85), '贡献兑换矩阵不是 17×85')
assert(factionExchangeCounts.total === 396, `贡献兑换商品数量异常：${factionExchangeCounts.total}`)
assert(factionExchangeCounts.factions === 29, `贡献兑换势力数量异常：${factionExchangeCounts.factions}`)
assert(factionExchangeCounts.jobBooks === 29, `转职书数量异常：${factionExchangeCounts.jobBooks}`)
assert(factionExchangeCounts.blueprints === 290, `图纸数量异常：${factionExchangeCounts.blueprints}`)
assert(factionExchangeCounts.secretRealmTickets === 29, `秘境门票数量异常：${factionExchangeCounts.secretRealmTickets}`)
assert(factionExchangeCounts.skins === 48, `幻型数量异常：${factionExchangeCounts.skins}`)
assert(factionExchangeItems.filter((item) => item.kind === 'job-book').every((item) => item.slot === 1), '转职书不在第 1 槽')
assert(factionExchangeItems.filter((item) => item.kind === 'blueprint').every((item) => item.slot >= 2 && item.slot <= 11), '图纸不在第 2～11 槽')
assert(factionExchangeItems.filter((item) => item.kind === 'secret-realm-ticket').every((item) => item.slot === 12), '秘境门票不在第 12 槽')
assert(factionExchangeItems.filter((item) => item.kind === 'skin').every((item) => item.slot >= 13 && item.slot <= 16), '幻型不在第 13～16 槽')
assert(factionTowns.every((town) => town.functionIds.join(',') === '10,3,7,25'), '势力城镇功能不是阵营任务、学习、贡献兑换、势力招募')
assert(factionTowns.every((town) => functionNames.has(town.functionIds[0])), '势力城镇存在未知功能 ID')
assert(formalFactions.every((faction) => factionTowns.some((town) => town.sourceId === faction.sceneId && town.factionId === faction.sourceId)), '正式势力与城镇不是一一关联')
assert(militiaFactions.every((faction) => worldHubs.some((hub) => hub.sourceId === faction.sceneId)), '民团与位面主城不是一一关联')
assertUnique(factions.map((faction) => faction.sourceId), '势力')
assertUnique(worldHubs.map((hub) => hub.sourceId), '位面主城')
assertUnique(factionTowns.map((town) => town.sourceId), '势力城镇')
assertUnique(buildings.map((building) => building.sourceId), '建筑')
assertUnique(technologies.map((technology) => technology.sourceId), '科技')

const known = (name, evidence) => ({ name, status: 'confirmed', evidence })
const pending = (column) => ({
  name: `unknown_col_${column}`,
  status: 'pending',
  evidence: '尚未从运行时事件确认语义，保留原始值',
})
const dictionary = (width, fields) => Array.from({ length: width }, (_, column) => ({
  column,
  ...(fields[column] ?? pending(column)),
}))
const worldPairFields = (worldCount, oddField, evenField) => Object.fromEntries(
  Array.from({ length: worldCount }, (_, offset) => {
    const worldIndex = offset + 1
    const worldLabel = String(worldIndex).padStart(2, '0')
    return [
      [worldIndex * 2 - 1, oddField(worldLabel)],
      [worldIndex * 2, evenField(worldLabel)],
    ]
  }).flat(),
)
const csczLayout = {
  gridWidth: 18,
  gridHeight: 18,
  sourceColumns: [0, 17],
  reservedColumns: [18, 19],
  packedRowBands: [
    {
      sourceRows: [0, 17],
      field: 'buildingId',
      saveColumn: 1,
      evidence: '初始化写入 save depth 10 第 1 列，后续通过 jz 表读取建筑名称、类型与场景',
    },
    {
      sourceRows: [20, 37],
      field: 'buildingLevel',
      saveColumn: 2,
      evidence: '初始化写入 save depth 10 第 2 列，建筑界面以 Lv 显示并在升级时递增',
    },
    {
      sourceRows: [34, 51],
      field: 'landPriceTier',
      saveColumn: 45,
      evidence: '初始化写入 save depth 10 第 45 列，土地价格function 以该值三次方参与地价计算',
    },
  ],
  saveRecord: {
    depth: 10,
    tileIdColumn: 0,
    buildingIdColumn: 1,
    buildingLevelColumn: 2,
    gridXColumn: 11,
    gridYColumn: 12,
    landPriceTierColumn: 45,
  },
}

const fieldDictionaries = {
  shili: dictionary(26, {
    0: known('sourceId', '现有原版生成器与连续主键'),
    1: known('name', '静态文本与原版界面名称'),
    2: known('worldIndex', '现有原版生成器与 13 位面分组'),
    3: known('description', '静态介绍文本'),
    4: known('currencyKind', '值域为“货币/贡献”，且运行时据此消费资源'),
    5: known('skillId1', '现有原版技能生成器'),
    6: known('skillId2', '现有原版技能生成器'),
    7: known('skillId3', '现有原版技能生成器'),
    8: known('skillId4', '现有原版技能生成器'),
    9: known('skillId5', '现有原版技能生成器'),
    10: known('skillId6', '现有原版技能生成器'),
    11: known('organizationKind', '值域为“民团/势力”'),
    12: known('prerequisiteSkillId1', '刷新学习技能列表function 以“次数 + 11”读取，与第 1 个技能位对应；全表为 0'),
    13: known('prerequisiteSkillId2', '刷新学习技能列表function 以“次数 + 11”读取，与第 2 个技能位对应；全表为 0'),
    14: known('prerequisiteSkillId3', '刷新学习技能列表function 以“次数 + 11”读取，与第 3 个技能位对应'),
    15: known('prerequisiteSkillId4', '刷新学习技能列表function 以“次数 + 11”读取，与第 4 个技能位对应'),
    16: known('prerequisiteSkillId5', '刷新学习技能列表function 以“次数 + 11”读取，与第 5 个技能位对应'),
    17: known('prerequisiteSkillId6', '刷新学习技能列表function 以“次数 + 11”读取，与第 6 个技能位对应'),
    18: known('mapMarkerSlot', '刷新地图地点function 将该列作为“建立地点标识”的势力标识位；正式势力固定为 12～14'),
    19: known('sceneId', '29 个正式势力与 29 个城镇、13 个民团与 13 个主城逐项对应'),
    20: known('unlockProgressCode', '位面地点解锁检测function 用该列与原版进度存档比较，满足后写入地点解锁状态'),
    21: known('affiliationName', '刷新招募角色详情function 以“所属势力”标签显示该列；部分值与势力正式名称不同'),
    22: known('elementId', '现有原版生成器'),
    23: known('skillGroupName', '值与原版“<技能组>威力”属性一一对应，并由战斗数据统计读取'),
    24: known('contributionPrefix', '刷新阵营任务详情function 将该列与“贡献”拼接显示'),
    25: known('worldFactionSlot', '代理人任务执行function 以该列定位同位面正式势力存档槽；值域为 1～3'),
  }),
  cj: dictionary(23, {
    0: known('sourceId', '连续场景主键'),
    1: known('name', '静态场景名称'),
    2: known('visualKey', '进入场景function 将该列传给场景 Sprite 动画；主城使用数字动画名，其余场景使用文本动画名'),
    3: known('linkedSceneId1', '13 个主城均通过第 3～7 列连接 5 个公共场所'),
    4: known('linkedSceneId2', '13 个主城均通过第 3～7 列连接 5 个公共场所'),
    5: known('linkedSceneId3', '13 个主城均通过第 3～7 列连接 5 个公共场所'),
    6: known('linkedSceneId4', '13 个主城均通过第 3～7 列连接 5 个公共场所'),
    7: known('linkedSceneId5', '13 个主城均通过第 3～7 列连接 5 个公共场所'),
    8: known('reservedEmpty1', '当前原版快照全表为空，未发现固定列运行时访问'),
    9: known('reservedEmpty2', '当前原版快照全表为空，未发现固定列运行时访问'),
    10: known('reservedEmpty3', '当前原版快照全表为空，未发现固定列运行时访问'),
    11: known('functionId1', '与 mc 第 10 列场景功能枚举对应'),
    12: known('functionId2', '与 mc 第 10 列场景功能枚举对应'),
    13: known('functionId3', '与 mc 第 10 列场景功能枚举对应'),
    14: known('functionId4', '与 mc 第 10 列场景功能枚举对应'),
    15: known('functionId5', '与 mc 第 10 列场景功能枚举对应'),
    16: known('mapMarkerVisualKey', '进入场景function 将该列传给地点按钮 Sprite 动画'),
    17: known('npcTitle', '进入场景function 将该列作为 NPC 称谓文本显示'),
    18: known('npcVisualKey', '进入场景function 将该列传给 NPC Sprite 动画'),
    19: known('dialogueId', '进入场景function、场景对话function 与宝录对话function 以该列选择对话'),
    20: known('factionId', '公共场所指向本位面民团，正式城镇指向对应势力'),
    21: known('buildingId', '现世场景第 45～60 行逐项指向 jz 第 10～25 号建筑'),
    22: known('specialDungeonIndex', '8 个大型副本场景取值 1～8；购买、精魄兑换、招募与元素宝库运行时均以此选组'),
  }),
  jz: dictionary(30, {
    0: known('sourceId', '建筑主键'),
    1: known('name', '建筑静态名称'),
    2: known('visualKey', '值与原版建筑对象名称一致'),
    3: known('buildingType', '值域为住宅、商业、工业、产业、特殊等'),
    4: known('sceneId', '可进入建筑逐项指向 cj 第 45～60 号现世场景'),
    5: known('cashCost', '建造现金点function 读取该列计算现金建造成本'),
    6: known('populationPerLevel', '建筑属性function 在“人口”分支按建筑等级乘算该列'),
    7: known('commercePerLevel', '建筑属性function 在“商业”分支按建筑等级乘算该列'),
    8: known('industryPerLevel', '建筑属性function 在“工业”分支按建筑等级乘算该列'),
    9: known('description', '静态建筑介绍文本'),
    10: known('baseInfluenceRange', '建筑属性function 在“范围”分支以该列加每两级 1 点'),
    11: known('category', '值域含基础、产业、特殊'),
    12: known('positionAbilityId1', '各产业职位界面以“职位序号 + 12”读取，并通过 mc 第 8 列显示能力名称'),
    13: known('positionAbilityId2', '各产业职位界面以“职位序号 + 12”读取，并通过 mc 第 8 列显示能力名称'),
    14: known('positionAbilityId3', '各产业职位界面以“职位序号 + 12”读取，并通过 mc 第 8 列显示能力名称'),
    15: known('positionAbilityId4', '各产业职位界面以“职位序号 + 12”读取，并通过 mc 第 8 列显示能力名称'),
    16: known('positionAbilityId5', '各产业职位界面以“职位序号 + 12”读取，并通过 mc 第 8 列显示能力名称'),
    17: known('positionAbilityId6', '各产业职位界面以“职位序号 + 12”读取，并通过 mc 第 8 列显示能力名称'),
    18: known('positionAbilityId7', '各产业职位界面以“职位序号 + 12”读取，并通过 mc 第 8 列显示能力名称'),
    19: known('positionTitleId1', '各产业职位界面以“职位序号 + 19”读取，并通过 mc 第 19 列显示职位名称'),
    20: known('positionTitleId2', '各产业职位界面以“职位序号 + 19”读取，并通过 mc 第 19 列显示职位名称'),
    21: known('positionTitleId3', '各产业职位界面以“职位序号 + 19”读取，并通过 mc 第 19 列显示职位名称'),
    22: known('positionTitleId4', '各产业职位界面以“职位序号 + 19”读取，并通过 mc 第 19 列显示职位名称'),
    23: known('positionTitleId5', '各产业职位界面以“职位序号 + 19”读取，并通过 mc 第 19 列显示职位名称'),
    24: known('positionTitleId6', '各产业职位界面以“职位序号 + 19”读取，并通过 mc 第 19 列显示职位名称'),
    25: known('positionTitleId7', '各产业职位界面以“职位序号 + 19”读取，并通过 mc 第 19 列显示职位名称'),
    26: known('unlockTechnologyId', '刷新建筑列表function 以该列检查对应 kj 科技；名称与建筑解锁科技逐项一致'),
    27: known('maxBuildCount', '刷新建筑列表function 与项目计划function 用该列限制建筑数量；基础区为 9999，其余为 1'),
    28: known('buildPointCost', '建筑建造点function 读取该列计算建造点成本'),
    29: known('industryIndex', '建筑主管加速function 以该列定位 10 类产业主管槽'),
  }),
  kj: dictionary(17, {
    0: known('sourceId', '科技主键'),
    1: known('name', '科技静态名称'),
    2: known('category', '60 项基础、15 项位面'),
    3: known('treeColumn', '刷新科技树function 用该列定位 1～6 列节点'),
    4: known('treeRow', '刷新科技树function 用该列定位科技树行'),
    5: known('maxLevel', '刷新科技树function 与科技研究function 以该列限制等级'),
    6: known('levelRequirementBase', '科技计算等级function 的基础值'),
    7: known('levelRequirementGrowth', '科技计算等级function 乘以当前等级后叠加到基础值'),
    8: known('description', '静态科技效果文本'),
    9: known('prerequisiteTechnologyId1', '刷新科技树function 读取的第 1 个前置科技'),
    10: known('prerequisiteTechnologyId2', '刷新科技树function 读取的第 2 个前置科技'),
    11: known('prerequisiteTechnologyId3', '刷新科技树function 读取的第 3 个前置科技'),
    13: known('effectParameter', '科技效果加成function 以“当前等级 × 参数 ÷ 10 ÷ 100”计算'),
    14: known('hiddenFromTechnologyTree', '仅“派遣自动重复”取 1；刷新科技树function 的两条节点创建分支均要求该列不等于 1'),
    15: known('effectId', '运行时按该列归并同类科技效果；重复值与同类效果逐项一致'),
    16: known('descriptionEnglish', '刷新科技树function 在英文语言分支读取；与第 8 列中文效果说明对应'),
  }),
  cscz: dictionary(20, {
    ...Object.fromEntries(Array.from({ length: 18 }, (_, gridX) => [
      gridX,
      known(
        `gridX${String(gridX).padStart(2, '0')}`,
        '初始化只遍历 CurY 0～17，并将 CurY 写入城市地块记录的 x 坐标；字段由三段 X 行偏移共同组成',
      ),
    ])),
    18: known('reservedEmptyColumn18', '当前快照 52 行均为空，初始化明确只处理 CurY ≤ 17'),
    19: known('reservedEmptyColumn19', '当前快照 52 行均为空，初始化明确只处理 CurY ≤ 17'),
  }),
  csdj: dictionary(69, {
    0: known('slotIndex', '第 0 列与 X 行号 0～54 一致；其余 68 列按动态双列分组访问'),
    ...worldPairFields(
      13,
      (worldLabel) => known(
        `world${worldLabel}ItemId`,
        '刷新物品购买function 按“当前位面编号 × 2 - 1”读取，并作为物品 ID 进入类型与名称分支',
      ),
      (worldLabel) => known(
        `world${worldLabel}ItemParameter`,
        '刷新物品购买function 按“当前位面编号 × 2”读取；普通物品用作物品参数，转职、图纸、幻型分别用作职业、配方、幻型 ID',
      ),
    ),
  }),
  cszb: dictionary(27, {
    0: known('slotIndex', '第 0 列与 X 行号 0～81 一致；其余 26 列按 13 个位面动态双列访问'),
    ...worldPairFields(
      13,
      (worldLabel) => known(
        `world${worldLabel}EquipmentItemId`,
        '刷新物品购买function 按“当前位面编号 × 2 - 1”读取，并作为装备物品 ID 进入名称、价格与购买流程',
      ),
      (worldLabel) => known(
        `world${worldLabel}EquipmentQuality`,
        '刷新物品购买function 按“当前位面编号 × 2”读取，并用于声望解锁、品质显示、价格与掉落等级计算',
      ),
    ),
  }),
}

const splitSourceArrayEntries = (source, marker) => {
  const markerIndex = source.indexOf(marker)
  assert(markerIndex >= 0, `运行时源码缺少 ${marker}`)
  const arrayStart = source.indexOf('[', markerIndex + marker.length)
  assert(arrayStart >= 0, `运行时源码 ${marker} 缺少数组起点`)

  const entries = []
  let itemStart = arrayStart + 1
  let depth = 0
  let quote = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let index = itemStart; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '(' || char === '{' || char === '[') depth += 1
    else if (char === ')' || char === '}') depth -= 1
    else if (char === ']') {
      if (depth === 0) {
        const entry = source.slice(itemStart, index).trim()
        if (entry) entries.push(entry)
        return entries
      }
      depth -= 1
    } else if (char === ',' && depth === 0) {
      entries.push(source.slice(itemStart, index).trim())
      itemStart = index + 1
    }
  }

  throw new Error(`运行时源码 ${marker} 缺少数组终点`)
}

const objectReferenceEntries = splitSourceArrayEntries(runtimeSource, 'self.C3_GetObjectRefTable = function ()')
  .map((entry) => entry.replace(/\s+/g, ' ').trim())
const expressionFunctions = splitSourceArrayEntries(runtimeSource, 'self.C3_ExpressionFuncs =')
assert(expressionFunctions.length > 10_000, `运行时表达式函数数量异常：${expressionFunctions.length}`)

const objectReferenceIndex = (name) => {
  const index = objectReferenceEntries.indexOf(name)
  assert(index >= 0, `运行时 Object Reference Table 缺少 ${name}`)
  return index
}
const arrayReferences = {
  plugin: objectReferenceIndex('C3.Plugins.Arr'),
  at: objectReferenceIndex('C3.Plugins.Arr.Exps.At'),
  compareX: objectReferenceIndex('C3.Plugins.Arr.Cnds.CompareX'),
  compareXY: objectReferenceIndex('C3.Plugins.Arr.Cnds.CompareXY'),
  compareXYZ: objectReferenceIndex('C3.Plugins.Arr.Cnds.CompareXYZ'),
  setXY: objectReferenceIndex('C3.Plugins.Arr.Acts.SetXY'),
  setXYZ: objectReferenceIndex('C3.Plugins.Arr.Acts.SetXYZ'),
}

const runtimeArrayNames = ['save', 'cj', 'cszb', 'csdj', 'shili', 'jz', 'cscz', 'kj']
const fieldUsageTableNames = runtimeArrayNames.filter((name) => name !== 'save')
const objectClassByName = new Map(runtimeData.project[3].map((row) => [String(row[0]), row]))
const objectClassById = new Map(runtimeData.project[3].map((row, objectId) => [objectId, row]))
const objectClassIdByName = new Map(runtimeData.project[3].map((row, objectId) => [String(row[0]), objectId]))
const runtimeArrays = Object.fromEntries(runtimeArrayNames.map((name) => {
  const row = objectClassByName.get(name)
  assert(row, `运行时对象表缺少 ${name}`)
  assert(row[1] === arrayReferences.plugin, `${name} 不是 Array 对象`)
  return [name, { objectId: objectClassIdByName.get(name) }]
}))
const fieldUsageArrays = Object.fromEntries(
  fieldUsageTableNames.map((name) => [name, runtimeArrays[name]]),
)
const trackedArrayNameById = new Map(
  Object.entries(runtimeArrays).map(([name, value]) => [value.objectId, name]),
)
const citySaveColumns = new Set([0, 1, 2, 11, 12, 45])
const factionSaveColumns = new Set([4, 5, 40, 54, 55])
const factionTaskSaveColumns = new Set(Array.from({ length: 13 }, (_, index) => index))

const eventVariableNamesBySid = new Map()
const collectEventVariableNames = (node) => {
  if (!Array.isArray(node)) return
  if (node[0] === 1 && typeof node[1] === 'string' && typeof node[6] === 'number') {
    const previous = eventVariableNamesBySid.get(node[6])
    assert(!previous || previous === node[1], `事件变量 SID ${node[6]} 名称冲突`)
    eventVariableNamesBySid.set(node[6], node[1])
  }
  for (const child of node) {
    if (Array.isArray(child)) collectEventVariableNames(child)
  }
}
for (const sheet of runtimeData.project[6]) collectEventVariableNames(sheet[1])

const functionRows = readSource('_all_func_names.txt')
  .split(/\r?\n/)
  .map((line) => line.match(/^(\d+)\t([^\t]+)\t([^\t]+)$/))
  .filter(Boolean)
  .map((match) => ({
    eventId: Number(match[1]),
    name: match[2],
    uid: match[3],
  }))
const functionByName = new Map(functionRows.map((item) => [item.name, item]))

const splitTopLevelArguments = (source) => {
  if (!source.trim()) return []
  const args = []
  let start = 0
  let depth = 0
  let quote = null
  let escaped = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '(' || char === '[' || char === '{') depth += 1
    else if (char === ')' || char === ']' || char === '}') depth -= 1
    else if (char === ',' && depth === 0) {
      args.push(source.slice(start, index).trim())
      start = index + 1
    }
  }
  args.push(source.slice(start).trim())
  return args
}

const findExpObjectCalls = (source, nodeIndex) => {
  const needle = `n${nodeIndex}.ExpObject(`
  const calls = []
  let searchFrom = 0
  while (searchFrom < source.length) {
    const callStart = source.indexOf(needle, searchFrom)
    if (callStart < 0) break
    const argsStart = callStart + needle.length
    let depth = 1
    let quote = null
    let escaped = false
    for (let index = argsStart; index < source.length; index += 1) {
      const char = source[index]
      if (quote) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === quote) quote = null
        continue
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char
        continue
      }
      if (char === '(') depth += 1
      else if (char === ')') {
        depth -= 1
        if (depth === 0) {
          calls.push(splitTopLevelArguments(source.slice(argsStart, index)))
          searchFrom = index + 1
          break
        }
      }
    }
    if (depth !== 0) throw new Error(`表达式函数中的 ${needle} 括号不完整`)
  }
  return calls
}

const compactExpression = (value) => String(value).replace(/\s+/g, ' ').trim()
const expressionBody = (source) => {
  const compact = compactExpression(source)
  const direct = compact.match(/^\(\)\s*=>\s*(.+)$/)
  if (direct) return direct[1]
  const nested = compact.match(/return\s+\(\)\s*=>\s*(.+);\s*}$/)
  return nested?.[1] ?? compact
}
const constantNumber = (value) => {
  const match = String(value).trim().match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*\)?$/)
  return match ? Number(match[1]) : null
}
const readableExpression = (value, expressionData) => {
  let result = compactExpression(value)
  if (!Array.isArray(expressionData)) return result
  for (let nodeIndex = 0; nodeIndex < expressionData.length - 1; nodeIndex += 1) {
    const descriptor = expressionData[nodeIndex + 1]
    if (!Array.isArray(descriptor)) continue
    if (descriptor[0] === 3) {
      const name = eventVariableNamesBySid.get(descriptor[1]) ?? `eventVar_${descriptor[1]}`
      result = result.replaceAll(`v${nodeIndex}.GetValue()`, name)
      continue
    }
    if (descriptor[0] === 5 && typeof descriptor[1] === 'string') {
      result = result.replaceAll(`f${nodeIndex}(`, `${descriptor[1]}(`)
      continue
    }
    if (descriptor[0] === 2) {
      const objectClass = objectClassById.get(descriptor[1])
      const objectName = objectClass?.[0] ?? `object_${descriptor[1]}`
      const variableName = objectClass?.[3]?.[descriptor[3]]?.[2] ?? `instanceVar_${descriptor[3]}`
      result = result.replaceAll(`n${nodeIndex}.ExpInstVar()`, `${objectName}.${variableName}`)
      continue
    }
    if (descriptor[0] === 1) {
      const objectName = objectClassById.get(descriptor[1])?.[0] ?? `object_${descriptor[1]}`
      const aceName = objectReferenceEntries[descriptor[2]]?.split('.').at(-1) ?? `ref_${descriptor[2]}`
      result = result.replaceAll(`n${nodeIndex}.ExpObject`, `${objectName}.${aceName}`)
      result = result.replaceAll(`f${nodeIndex}(`, `${objectName}.${aceName}(`)
      continue
    }
    if (descriptor[0] === 4) {
      const aceName = objectReferenceEntries[descriptor[1]]?.split('.').at(-1) ?? `ref_${descriptor[1]}`
      result = result.replaceAll(`f${nodeIndex}(`, `${aceName}(`)
    }
  }
  return result
}
const parameterExpression = (parameter) => {
  if (Array.isArray(parameter) && parameter[0] === 11 && Number.isInteger(parameter[1])) {
    const expression = eventVariableNamesBySid.get(parameter[1]) ?? `eventVar_${parameter[1]}`
    return { expressionId: null, expression, runtimeExpression: JSON.stringify(parameter) }
  }
  if (Array.isArray(parameter) && [3, 16].includes(parameter[0]) && typeof parameter[1] === 'boolean') {
    return { expressionId: null, expression: String(parameter[1]), runtimeExpression: JSON.stringify(parameter) }
  }
  if (Array.isArray(parameter?.[1]) && Number.isInteger(parameter[1][0])) {
    const expressionData = parameter[1]
    const expressionId = expressionData[0]
    const source = expressionFunctions[expressionId]
    assert(source, `运行时表达式函数缺少索引 ${expressionId}`)
    const runtimeExpression = expressionBody(source)
    return {
      expressionId,
      expression: readableExpression(runtimeExpression, expressionData),
      runtimeExpression,
    }
  }
  const expression = compactExpression(JSON.stringify(parameter))
  return { expressionId: null, expression, runtimeExpression: expression }
}

const fieldUsages = []
const citySaveUsages = []
const factionSaveUsages = []
const unresolvedFieldUsages = []
const usageContext = (context) => ({
  eventId: context.eventId,
  functionEventId: context.function?.eventId ?? null,
  functionName: context.function?.name ?? null,
  eventPath: [context.sheet, ...context.trail].filter(Boolean).join(' > '),
})
const addFieldUsage = (usage) => {
  if (usage.table !== 'save') {
    fieldUsages.push(usage)
    return
  }
  if (constantNumber(usage.runtimeDepthExpression) === 10 && citySaveColumns.has(usage.column)) {
    citySaveUsages.push(usage)
  }
  const depth = constantNumber(usage.runtimeDepthExpression)
  if ((depth === 0 && factionSaveColumns.has(usage.column))
    || (depth === 9 && (usage.column === null || factionTaskSaveColumns.has(usage.column)))
    || depth === 16) {
    factionSaveUsages.push(usage)
  }
}

const inspectAtExpression = (descriptor, parent, context) => {
  const table = trackedArrayNameById.get(descriptor[1])
  if (!table || descriptor[2] !== arrayReferences.at || !Array.isArray(parent)) return
  const expressionId = parent[0]
  const nodeIndex = parent.indexOf(descriptor) - 1
  const source = expressionFunctions[expressionId]
  if (!Number.isInteger(expressionId) || nodeIndex < 0 || !source) {
    if (table !== 'save') unresolvedFieldUsages.push({ table, reason: '无法定位表达式函数或节点索引', ...usageContext(context) })
    return
  }
  const calls = findExpObjectCalls(source, nodeIndex)
  if (!calls.length) {
    if (table !== 'save') {
      unresolvedFieldUsages.push({
        table,
        expressionId,
        nodeIndex,
        reason: '表达式函数没有对应 ExpObject 调用',
        expressionSource: compactExpression(source),
        ...usageContext(context),
      })
    }
    return
  }
  for (const args of calls) {
    const runtimeColumnExpression = args[1] ?? '0'
    const runtimeRecordExpression = args[0] ?? '0'
    const runtimeDepthExpression = args[2] ?? '0'
    addFieldUsage({
      table,
      objectId: descriptor[1],
      direction: 'read',
      access: 'At',
      expression: readableExpression(expressionBody(source), parent),
      column: constantNumber(runtimeColumnExpression),
      columnExpression: readableExpression(runtimeColumnExpression, parent),
      recordExpression: readableExpression(runtimeRecordExpression, parent),
      depthExpression: readableExpression(runtimeDepthExpression, parent),
      runtimeColumnExpression,
      runtimeRecordExpression,
      runtimeDepthExpression,
      expressionId,
      ...usageContext(context),
    })
  }
}

const inspectArrayAction = (node, context) => {
  const table = trackedArrayNameById.get(node[0])
  const access = node[1] === arrayReferences.setXY
    ? 'SetXY'
    : node[1] === arrayReferences.setXYZ ? 'SetXYZ' : null
  if (!table || !access || !Array.isArray(node[6])) return
  const args = node[6].map(parameterExpression)
  const columnExpression = args[1]?.expression ?? '0'
  const runtimeColumnExpression = args[1]?.runtimeExpression ?? '0'
  addFieldUsage({
    table,
    objectId: node[0],
    direction: 'write',
    access,
    column: constantNumber(runtimeColumnExpression),
    columnExpression,
    recordExpression: args[0]?.expression ?? '0',
    depthExpression: access === 'SetXYZ' ? (args[2]?.expression ?? '0') : '0',
    valueExpression: args[access === 'SetXYZ' ? 3 : 2]?.expression ?? null,
    runtimeColumnExpression,
    runtimeRecordExpression: args[0]?.runtimeExpression ?? '0',
    runtimeDepthExpression: access === 'SetXYZ' ? (args[2]?.runtimeExpression ?? '0') : '0',
    runtimeValueExpression: args[access === 'SetXYZ' ? 3 : 2]?.runtimeExpression ?? null,
    actionSid: node[3],
    ...usageContext(context),
  })
}

const inspectArrayCondition = (node, context) => {
  const table = trackedArrayNameById.get(node[0])
  const access = node[1] === arrayReferences.compareX
    ? 'CompareX'
    : node[1] === arrayReferences.compareXY
      ? 'CompareXY'
      : node[1] === arrayReferences.compareXYZ ? 'CompareXYZ' : null
  if (!table || !access || !Array.isArray(node[9])) return
  const args = node[9].map(parameterExpression)
  const columnExpression = access === 'CompareX' ? '0' : (args[1]?.expression ?? '0')
  const runtimeColumnExpression = access === 'CompareX' ? '0' : (args[1]?.runtimeExpression ?? '0')
  const comparisonIndex = access === 'CompareX' ? 1 : access === 'CompareXY' ? 2 : 3
  addFieldUsage({
    table,
    objectId: node[0],
    direction: 'read',
    access,
    column: constantNumber(runtimeColumnExpression),
    columnExpression,
    recordExpression: args[0]?.expression ?? '0',
    depthExpression: access === 'CompareXYZ' ? (args[2]?.expression ?? '0') : '0',
    comparisonExpression: args[comparisonIndex]?.expression ?? null,
    comparisonValueExpression: args[comparisonIndex + 1]?.expression ?? null,
    runtimeColumnExpression,
    runtimeRecordExpression: args[0]?.runtimeExpression ?? '0',
    runtimeDepthExpression: access === 'CompareXYZ' ? (args[2]?.runtimeExpression ?? '0') : '0',
    runtimeComparisonExpression: args[comparisonIndex]?.runtimeExpression ?? null,
    runtimeComparisonValueExpression: args[comparisonIndex + 1]?.runtimeExpression ?? null,
    conditionSid: node[7],
    ...usageContext(context),
  })
}

const normalizeEventName = (value) => String(value).replace(/^(?:True|False)\s+/, '').trim()
const namedPaths = new Map()
const namedEventNodes = new Map()
const rememberPath = (name, path) => {
  const paths = namedPaths.get(name) ?? new Set()
  paths.add(path.join(' > '))
  namedPaths.set(name, paths)
}
const rememberEventNode = (name, node) => {
  const nodes = namedEventNodes.get(name) ?? []
  nodes.push(node)
  namedEventNodes.set(name, nodes)
}
const eventNodeName = (node) => {
  if (!Array.isArray(node) || node[0] !== 3 || node.length < 2) return null
  if (Array.isArray(node[1]) && typeof node[1][0] === 'boolean' && typeof node[1][1] === 'string') {
    return normalizeEventName(node[1][1])
  }
  return typeof node[1] === 'string' ? normalizeEventName(node[1]) : null
}
const walkEvents = (node, context, parent = null) => {
  if (!Array.isArray(node)) return
  const name = eventNodeName(node)
  const eventId = node.length >= 8 && [0, 3, 4].includes(node[0]) && typeof node[5] === 'number'
    ? node[5]
    : context.eventId
  const nextTrail = name ? [...context.trail, name] : context.trail
  const namedFunction = name ? functionByName.get(name) : null
  const nextContext = {
    ...context,
    eventId,
    trail: nextTrail,
    function: namedFunction ?? context.function,
  }
  if (name) {
    rememberPath(name, [context.sheet, ...nextTrail])
    rememberEventNode(name, node)
  }
  inspectAtExpression(node, parent, nextContext)
  inspectArrayAction(node, nextContext)
  inspectArrayCondition(node, nextContext)
  for (const child of node) {
    if (Array.isArray(child)) walkEvents(child, nextContext, node)
  }
}
for (const sheet of runtimeData.project[6]) {
  const sheetName = String(sheet[0])
  walkEvents(sheet[1], { sheet: sheetName, trail: [], eventId: null, function: null })
}

const parsedFunctions = functionRows.map((item) => ({
  ...item,
  paths: [...(namedPaths.get(item.name) ?? [])].sort(),
}))

fieldUsages.sort((left, right) => (
  left.table.localeCompare(right.table, 'en')
  || (left.column ?? Number.MAX_SAFE_INTEGER) - (right.column ?? Number.MAX_SAFE_INTEGER)
  || left.direction.localeCompare(right.direction, 'en')
  || (left.eventId ?? Number.MAX_SAFE_INTEGER) - (right.eventId ?? Number.MAX_SAFE_INTEGER)
  || (left.expressionId ?? Number.MAX_SAFE_INTEGER) - (right.expressionId ?? Number.MAX_SAFE_INTEGER)
))
citySaveUsages.sort((left, right) => (
  left.column - right.column
  || left.direction.localeCompare(right.direction, 'en')
  || (left.eventId ?? Number.MAX_SAFE_INTEGER) - (right.eventId ?? Number.MAX_SAFE_INTEGER)
  || (left.expressionId ?? Number.MAX_SAFE_INTEGER) - (right.expressionId ?? Number.MAX_SAFE_INTEGER)
))
factionSaveUsages.sort((left, right) => (
  constantNumber(left.runtimeDepthExpression) - constantNumber(right.runtimeDepthExpression)
  || (left.column ?? Number.MAX_SAFE_INTEGER) - (right.column ?? Number.MAX_SAFE_INTEGER)
  || left.direction.localeCompare(right.direction, 'en')
  || (left.eventId ?? Number.MAX_SAFE_INTEGER) - (right.eventId ?? Number.MAX_SAFE_INTEGER)
  || (left.expressionId ?? Number.MAX_SAFE_INTEGER) - (right.expressionId ?? Number.MAX_SAFE_INTEGER)
))

const fieldUsageSummary = Object.fromEntries(fieldUsageTableNames.map((table) => {
  const usages = fieldUsages.filter((usage) => usage.table === table)
  const staticColumns = [...new Set(usages.map((usage) => usage.column).filter((column) => column !== null))].sort((a, b) => a - b)
  return [table, {
    objectId: fieldUsageArrays[table].objectId,
    reads: usages.filter((usage) => usage.direction === 'read').length,
    writes: usages.filter((usage) => usage.direction === 'write').length,
    staticColumns,
    dynamicColumnAccesses: usages.filter((usage) => usage.column === null).length,
    unresolvedAccesses: unresolvedFieldUsages.filter((usage) => usage.table === table).length,
  }]
}))

const fieldUsageIndex = {
  schemaVersion: 5,
  source: {
    eventTree: 'data.json',
    runtime: 'scripts/c3runtime.js',
  },
  arrayReferences,
  trackedArrays: fieldUsageArrays,
  summary: fieldUsageSummary,
  usages: fieldUsages,
  targetedCitySaveUsages: citySaveUsages,
  targetedFactionSaveUsages: factionSaveUsages,
  unresolved: unresolvedFieldUsages,
}

const formulaCategories = [
  ['faction', /势力|阵营|贡献|声望|代理人|招募角色|角色招募价格|学习技能|前置技能|技能升级贡献|位面地点解锁|主线任务检测|物品兑换|物品买卖价格|位面价格系数|普通物品等级|物品名function|获得物品function|图纸拥有检测|幻化拥有检测|幻化类型文本|提交任务function|放弃任务function/],
  ['town', /场景|地点|城镇|酒馆|商会|市集|铁匠|武馆/],
  ['city-core', /城市|土地|地块|建筑|扩建|项目|迁移/],
  ['company', /公司|财务|租金|职位|资产|收支/],
  ['industry', /经营|科研|科技|建造|锻造|合成|展览|仓库|修习|驯养|教育|派遣|资源池|职业进阶|灵兽|兽决|命石|淬炼|洗练/],
]
const formulaIndex = Object.fromEntries(formulaCategories.map(([category, pattern]) => [
  category,
  parsedFunctions.filter((item) => pattern.test(item.name)),
]))

const factionRuntimeFunctionNames = formulaIndex.faction.map((item) => item.name)
const parameterExpressionsIn = (root) => {
  const expressions = new Map()
  const visit = (node) => {
    if (!Array.isArray(node)) return
    if (node[0] === 7 && Array.isArray(node[1]) && Number.isInteger(node[1][0])) {
      const evidence = parameterExpression(node)
      const key = `${evidence.expressionId}:${evidence.expression}`
      expressions.set(key, evidence)
    }
    for (const child of node) {
      if (Array.isArray(child)) visit(child)
    }
  }
  visit(root)
  return [...expressions.values()].sort((left, right) => (
    (left.expressionId ?? Number.MAX_SAFE_INTEGER) - (right.expressionId ?? Number.MAX_SAFE_INTEGER)
    || left.expression.localeCompare(right.expression, 'zh-CN')
  ))
}
const runtimeOperationsIn = (root) => {
  const operations = []
  const visit = (node, path = []) => {
    if (!Array.isArray(node)) return
    if (Number.isInteger(node[0]) && Number.isInteger(node[1]) && Number.isInteger(node[3])) {
      const reference = objectReferenceEntries[node[1]]
      if (reference) {
        const parameterList = Array.isArray(node[9]) ? node[9] : Array.isArray(node[6]) ? node[6] : []
        operations.push({
          path,
          objectId: node[0],
          objectName: node[0] === -1 ? 'System' : (objectClassById.get(node[0])?.[0] ?? `object_${node[0]}`),
          referenceIndex: node[1],
          reference,
          sid: String(node[3]),
          parameters: parameterList.map(parameterExpression),
        })
      }
    }
    node.forEach((child, index) => {
      if (Array.isArray(child)) visit(child, [...path, index])
    })
  }
  visit(root)
  return operations
}
const functionCallsIn = (root) => {
  const calls = []
  const visit = (node, path = []) => {
    if (!Array.isArray(node)) return
    if (node[0] === -2 && typeof node[1] === 'string') {
      calls.push({
        path,
        name: node[1],
        sid: String(node[3]),
        parameters: Array.isArray(node[6]) ? node[6].map(parameterExpression) : [],
      })
    }
    node.forEach((child, index) => {
      if (Array.isArray(child)) visit(child, [...path, index])
    })
  }
  visit(root)
  return calls
}
const factionRuntimeFunctions = factionRuntimeFunctionNames.map((name) => {
  const definition = functionByName.get(name)
  const nodes = namedEventNodes.get(name) ?? []
  assert(definition, `原版函数索引缺少 ${name}`)
  assert(nodes.length === 1, `原版函数 ${name} 节点数量异常：${nodes.length}`)
  return {
    name,
    eventId: definition.eventId,
    uid: definition.uid,
    paths: [...(namedPaths.get(name) ?? [])].sort(),
    expressions: parameterExpressionsIn(nodes[0]),
    operations: runtimeOperationsIn(nodes[0]),
    calls: functionCallsIn(nodes[0]),
    fieldUsages: fieldUsages.filter((usage) => usage.functionName === name),
  }
})
const inlineFactionFunctionNames = [
  '幻化类型文本',
  '代理人贡献加成',
  '代理人声望加成',
  '位面声望等级',
  '位面声望经验',
  '指定位面声望等级',
  '学习技能',
  '前置技能等级',
  '位面首势力编号',
]
for (const name of inlineFactionFunctionNames) {
  const matches = []
  const visit = (node, path) => {
    if (!Array.isArray(node)) return
    if (node[0] === 4 && Array.isArray(node[1]) && node[1][0] === name) {
      matches.push({ node, path })
    }
    node.forEach((child, index) => {
      if (Array.isArray(child)) visit(child, [...path, index])
    })
  }
  for (const sheet of runtimeData.project[6]) visit(sheet[1], [String(sheet[0])])
  assert(matches.length === 1, `原版内联函数 ${name} 节点数量异常：${matches.length}`)
  const [{ node, path }] = matches
  factionRuntimeFunctions.push({
    name,
    eventId: node[5],
    uid: String(node[4]),
    paths: [path.join(' > ')],
    expressions: parameterExpressionsIn(node),
    operations: runtimeOperationsIn(node),
    calls: functionCallsIn(node),
    fieldUsages: [],
  })
}

const factionRuntimeFunctionByName = new Map(factionRuntimeFunctions.map((fn) => [fn.name, fn]))
const requiredFactionRuntimeFunction = (name) => {
  const fn = factionRuntimeFunctionByName.get(name)
  assert(fn, `势力规则契约缺少原版函数 ${name}`)
  return fn
}
const assertJsonEqual = (actual, expected, label) => {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label}与原版运行时证据不一致`)
}
const assertExpressions = (functionName, expectedExpressions) => {
  const expressions = new Set(requiredFactionRuntimeFunction(functionName).expressions.map((item) => item.expression))
  for (const expression of expectedExpressions) {
    assert(expressions.has(expression), `${functionName} 缺少表达式：${expression}`)
  }
}
const operationParameterExpressions = (operation) => operation.parameters.map((parameter) => parameter.expression)
const assertOperation = (functionName, referenceSuffix, expectedParameters) => {
  const matched = requiredFactionRuntimeFunction(functionName).operations.some((operation) => (
    operation.reference.endsWith(referenceSuffix)
    && JSON.stringify(operationParameterExpressions(operation)) === JSON.stringify(expectedParameters)
  ))
  assert(matched, `${functionName} 缺少运行时操作 ${referenceSuffix}(${expectedParameters.join(', ')})`)
}
const assertOperationPrefix = (functionName, referenceSuffix, expectedParameterPrefix) => {
  const matched = requiredFactionRuntimeFunction(functionName).operations.some((operation) => (
    operation.reference.endsWith(referenceSuffix)
    && expectedParameterPrefix.every((value, index) => operation.parameters[index]?.expression === value)
  ))
  assert(matched, `${functionName} 缺少运行时操作前缀 ${referenceSuffix}(${expectedParameterPrefix.join(', ')})`)
}
const assertCallSubsequence = (functionName, expectedNames) => {
  const names = requiredFactionRuntimeFunction(functionName).calls.map((call) => call.name)
  let cursor = 0
  for (const name of names) {
    if (name === expectedNames[cursor]) cursor += 1
  }
  assert(cursor === expectedNames.length, `${functionName} 调用顺序缺少 ${expectedNames.join(' -> ')}`)
}
const probabilityEntries = (functionName) => requiredFactionRuntimeFunction(functionName).operations
  .filter((operation) => operation.reference.endsWith('.AddProbabilityEntry'))
  .map((operation) => ({
    value: Number(operation.parameters[0]?.expression),
    weight: Number(operation.parameters[1]?.expression),
  }))

const factionTaskQualityWeights = probabilityEntries('随机阵营任务品质function')
assertJsonEqual(factionTaskQualityWeights, [
  { value: 1, weight: 24 },
  { value: 2, weight: 24 },
  { value: 3, weight: 20 },
  { value: 4, weight: 18 },
  { value: 5, weight: 6 },
  { value: 6, weight: 3 },
], '阵营任务品质权重')

const factionTaskTypeEntrySequence = probabilityEntries('随机阵营任务编号function')
assertJsonEqual(factionTaskTypeEntrySequence, [
  { value: 1, weight: 1 },
  { value: 2, weight: 1 },
  { value: 3, weight: 1 },
  { value: 1, weight: 1 },
  { value: 2, weight: 1 },
  { value: 3, weight: 1 },
  { value: 4, weight: 1 },
  { value: 1, weight: 1 },
  { value: 2, weight: 1 },
  { value: 3, weight: 1 },
  { value: 4, weight: 2 },
  { value: 5, weight: 2 },
  { value: 1, weight: 1 },
  { value: 2, weight: 1 },
  { value: 3, weight: 1 },
  { value: 4, weight: 2 },
  { value: 5, weight: 2 },
], '阵营任务类型权重分支')

const factionTaskTypeWeights = [
  {
    qualityMin: 1,
    qualityMax: 1,
    weights: factionTaskTypeEntrySequence.slice(0, 3),
  },
  {
    qualityMin: 2,
    qualityMax: 3,
    weights: factionTaskTypeEntrySequence.slice(3, 7),
  },
  {
    qualityMin: 4,
    qualityMax: 6,
    weights: factionTaskTypeEntrySequence.slice(7, 12),
  },
]

const factionTaskDefinitions = arrays.rw.slice(1, 7).map((row) => ({
  id: asNumber(row[0]),
  name: String(row[1]),
  category: String(row[2]),
  actionName: String(row[3]),
  targetKind: String(row[4]),
  baseCurrencyReward: asNumber(row[7]),
  baseContributionReward: asNumber(row[8]),
  baseReputationReward: asNumber(row[9]),
}))
assertJsonEqual(factionTaskDefinitions.map((task) => [
  task.id,
  task.name,
  task.targetKind,
  task.baseContributionReward,
  task.baseReputationReward,
]), [
  [1, '消灭目标敌人', '敌人', 450, 4],
  [2, '筹措目标货币', '货币', 400, 4],
  [3, '收集目标材料', '物品', 500, 5],
  [4, '挑战目标敌人', '敌人', 550, 5],
  [5, '寻找目标装备', '装备', 600, 6],
  [6, '捕捉目标灵兽', '灵兽', 650, 6],
], '阵营任务定义')

const factionTaskMaterialTargets = (worldIndex, quality) => {
  const tierOffset = quality <= 2 ? 0 : quality <= 4 ? 1 : 2
  const items = []
  for (let family = 1; family <= 4; family += 1) {
    const baseQualityColumn = 22 + family * 2
    const familyGateColumn = baseQualityColumn + 1
    const baseQuality = asNumber(arrays.wm[worldIndex]?.[baseQualityColumn])
    const familyGate = asNumber(arrays.wm[worldIndex]?.[familyGateColumn])
    if (familyGate <= 20) continue
    for (const row of arrays.wp.slice(1)) {
      if (String(row[5]) !== '材料'
        || asNumber(row[7]) !== family
        || asNumber(row[4]) !== baseQuality + tierOffset) continue
      items.push({
        itemId: asNumber(row[0]),
        name: String(row[1]),
        family,
        itemQuality: asNumber(row[4]),
      })
    }
  }
  return items
}
const factionTaskWorldTargets = Array.from({ length: 13 }, (_, offset) => {
  const worldIndex = offset + 1
  const enemyRows = arrays.dr.slice(1).filter((row) => asNumber(row[12]) === worldIndex)
  const currencySourceId = asNumber(arrays.wm[worldIndex]?.[23])
  return {
    worldIndex,
    currency: {
      sourceId: currencySourceId,
      name: String(arrays.mc[currencySourceId]?.[11] ?? ''),
    },
    normalEnemies: enemyRows
      .filter((row) => String(row[5]) === '小怪')
      .map((row) => ({ drId: asNumber(row[0]), name: String(row[1]) })),
    bossEnemies: enemyRows
      .filter((row) => String(row[5]) === '首领')
      .map((row) => ({ drId: asNumber(row[0]), name: String(row[1]) })),
    materialItemsByQuality: Array.from({ length: 6 }, (_, qualityOffset) => ({
      quality: qualityOffset + 1,
      items: factionTaskMaterialTargets(worldIndex, qualityOffset + 1),
    })),
  }
})
assert(factionTaskWorldTargets.every((target) => target.normalEnemies.length === 10), '势力任务不是每个位面 10 个小怪目标')
assert(factionTaskWorldTargets.every((target) => target.bossEnemies.length === 10), '势力任务不是每个位面 10 个首领目标')
assert(factionTaskWorldTargets.every((target) => target.currency.sourceId > 0 && target.currency.name), '势力任务存在未知位面货币目标')
assert(factionTaskWorldTargets.every((target) => target.materialItemsByQuality.every((group) => group.items.length >= 3)), '势力任务存在空材料目标池')

assertExpressions('位面声望等级', [
  'C3.clamp(Math.floor((Math.sqrt((声望值 / (200 + ((位面编号 - 1) * 20)))) + 1)), 1, 5)',
])
assertExpressions('位面声望经验', [
  'Math.round(((200 + ((位面编号 - 1) * 20)) * Math.pow(C3.clamp((等级 - 1), 0, 4), 2)))',
])
const factionReputationLevelNames = Array.from(
  { length: 5 },
  (_, offset) => String(arrays.mc[offset + 1]?.[13] ?? '')
    .replace(/\[\/?color(?:=[^\]]+)?\]/gi, '')
    .trim(),
)
assert(
  JSON.stringify(factionReputationLevelNames) === JSON.stringify(['冷淡', '友好', '尊敬', '崇拜', '信仰']),
  'mc[1..5][13] 的位面声望等级名称与预期不符',
)

const factionRecruitmentEntries = arrays.js.slice(1)
  .map((row) => {
    const factionSourceId = asNumber(row[25])
    const faction = factionBySourceId.get(factionSourceId)
    if (!faction) return null
    const requiredReputationLevel = asNumber(row[22])
    const worldIndex = asNumber(row[5])
    const basePrice = asNumber(row[26])
    const worldPriceMultiplier = 1 + 0.8 * (worldIndex - 1)
    const price = faction.currencyKind === '贡献'
      ? Math.round(basePrice * (worldPriceMultiplier / 20) / 10_000) * 10_000
      : basePrice >= 10_000
        ? Math.round(basePrice * worldPriceMultiplier / 10_000) * 10_000
        : Math.round(basePrice * worldPriceMultiplier)
    return {
      heroSourceId: asNumber(row[0]),
      name: String(row[1]),
      worldIndex,
      factionSourceId,
      factionName: faction.name,
      resourceKind: faction.currencyKind,
      requiredReputationLevel,
      requiredReputationName: factionReputationLevelNames[requiredReputationLevel - 1] ?? null,
      basePrice,
      price,
      specialRequirement: asNumber(row[35]),
    }
  })
  .filter(Boolean)

const factionRecruitmentCounts = {
  total: factionRecruitmentEntries.length,
  factions: new Set(factionRecruitmentEntries.map((entry) => entry.factionSourceId)).size,
  byReputationLevel: Object.fromEntries(Array.from({ length: 5 }, (_, offset) => [
    String(offset + 1),
    factionRecruitmentEntries.filter((entry) => entry.requiredReputationLevel === offset + 1).length,
  ])),
}

assert(factionRecruitmentCounts.total === 131, `原版势力招募角色应为 131 人，实际 ${factionRecruitmentCounts.total}`)
assert(factionRecruitmentCounts.factions === 42, `原版势力招募应覆盖 42 个势力，实际 ${factionRecruitmentCounts.factions}`)
assert(
  factionRecruitmentEntries.every((entry) => entry.worldIndex === factionBySourceId.get(entry.factionSourceId)?.worldIndex),
  '原版势力招募角色的位面与势力位面不一致',
)
assert(
  factionRecruitmentEntries.every((entry) => entry.requiredReputationLevel >= 1 && entry.requiredReputationLevel <= 5),
  '原版势力招募存在 1～5 之外的声望门槛',
)
assert(factionRecruitmentEntries.every((entry) => entry.basePrice > 0), '原版势力招募存在非正基础价格')
assert(factionRecruitmentEntries.every((entry) => entry.price > 0), '原版势力招募存在非正最终价格')
assert(factionRecruitmentEntries.every((entry) => entry.specialRequirement === 0), '原版势力招募存在尚未解码的特殊条件')
assertJsonEqual(factionRecruitmentCounts.byReputationLevel, {
  1: 27,
  2: 26,
  3: 26,
  4: 26,
  5: 26,
}, '原版势力招募声望门槛分布')

const selectorNodes = namedEventNodes.get('刷新角色选择列表') ?? []
assert(selectorNodes.length === 1, `刷新角色选择列表节点数量异常：${selectorNodes.length}`)
const selectorOperations = runtimeOperationsIn(selectorNodes[0])
assert(
  selectorOperations.some((operation) => (
    operation.objectName === 'save'
    && operation.reference.endsWith('.CompareXYZ')
    && JSON.stringify(operationParameterExpressions(operation)) === JSON.stringify([
      'save.CurX()', '1', '1', '[8,0]', '1',
    ])
  )),
  '角色选择列表没有按 save[heroId,1,1] = 1 筛选已招募角色',
)
const agentSelectorMode = selectorOperations.find((operation) => (
  operation.objectName === 'System'
  && operation.reference.endsWith('.Compare')
  && JSON.stringify(operationParameterExpressions(operation)) === JSON.stringify([
    '用途', '[8,0]', '"代理人"',
  ])
))
assert(agentSelectorMode, '角色选择列表缺少代理人用途分支')
const agentSelectorPath = agentSelectorMode.path.slice(0, 4)
assert(
  selectorOperations.some((operation) => (
    operation.objectName === 'System'
    && operation.reference.endsWith('.Compare')
    && JSON.stringify(operation.path.slice(0, 4)) === JSON.stringify(agentSelectorPath)
    && JSON.stringify(operationParameterExpressions(operation)) === JSON.stringify([
      '领袖临时.At(领袖临时.CurX(), 1)', '[8,4]', '1',
    ])
  )),
  '代理人角色选择列表没有排除原版主角 sourceId 1',
)

assertExpressions('代理人贡献加成', [
  '((100 + (最终能力等级(save.At(位面编号, 54, 0), 9) * 5)) / 100)',
])
assertExpressions('代理人声望加成', [
  '((100 + (最终能力等级(save.At(位面编号, 54, 0), 9) * 2)) / 100)',
])
assertExpressions('随机阵营任务数量function', [
  'Math.round((2.5 * Math.pow(2, 任务品质)))',
  '(Math.round(((位面价格系数(位面编号) * 5000) * (Math.pow(2, 任务品质) / 10000))) * 10000)',
  'Math.round((0.25 * Math.pow(2, 任务品质)))',
])
assertExpressions('随机阵营任务奖励function', [
  'Math.ceil(multiply(multiply(位面价格系数(位面编号), rw.At(任务编号, 7)), (((1 + ((任务品质 - 1) * 0.1)) * 0.5) * Math.pow(2, 任务品质))))',
  'Math.ceil(multiply(multiply((位面价格系数(位面编号) * (1 + 科技效果加成(68))), rw.At(任务编号, 8)), (((1 + ((任务品质 - 1) * 0.1)) * 0.5) * Math.pow(2, 任务品质))))',
  'Math.ceil(multiply(multiply(rw.At(任务编号, 9), 任务品质), (1 + 科技效果加成(69))))',
])
assertExpressions('刷新阵营任务数据function', [
  'C3.clamp((阵营任务刷新时间 - (科技效果加成(67) * 100)), 100, 阵营任务刷新时间)',
])
assertExpressions('角色招募价格function', [
  '(Math.round(divide(multiply(js.At(角色编号, 26), 位面价格系数(位面编号)), 10000)) * 10000)',
  'Math.round(multiply(js.At(角色编号, 26), 位面价格系数(位面编号)))',
  '(Math.round(divide(multiply(js.At(角色编号, 26), (位面价格系数(位面编号) / 货币贡献比)), 10000)) * 10000)',
])
assertExpressions('技能升级贡献function', [
  'Math.round(((((5000 / 货币贡献比) * Math.pow(1.025, ((((难度系数 - 1) * 20) + 技能等级) * 3))) - 200) * 百分比))',
  'Math.round((((10000 * Math.pow(1.025, ((((难度系数 - 1) * 20) + 技能等级) * 3))) - 9700) * 百分比))',
])

assertOperation('随机阵营任务目标编号function', '.CompareXY', ['dr.CurX()', '5', '[8,0]', '"小怪"'])
assertOperation('随机阵营任务目标编号function', '.CompareXY', ['dr.CurX()', '5', '[8,0]', '"首领"'])
assertOperation('随机阵营任务目标编号function', '.CompareXY', ['dr.CurX()', '12', '[8,0]', '位面编号'])
assertOperation('随机阵营任务目标编号function', '.AddProbabilityEntry', ['wm.At(位面编号, 23)', '1'])
assertOperation('随机阵营任务目标编号function', '.CompareXY', ['wp.CurX()', '5', '[8,0]', '"材料"'])
assertOperation('随机阵营任务目标编号function', '.CompareXYZ', ['dr.CurX()', '47', '0', '[8,0]', '1'])
assertOperation('随机阵营任务目标编号function', '.AddProbabilityEntry', ['C3.clamp(任务品质, 1, 9)', '1'])

assertOperation('刷新阵营任务数据function', '.Repeat', ['5'])
assertOperation('位面地点解锁检测function', '.SetXYZ', ['shili.CurX()', '40', '0', '1'])
assertOperation('代理人任命function', '.SetXYZ', ['位面编号', '54', '0', '角色编号'])
assertOperation('代理人任命function', '.SetXYZ', ['位面编号', '55', '0', '1'])
for (let field = 0; field <= 9; field += 1) {
  assertOperationPrefix('接受阵营任务function', '.SetXYZ', ['save.CurX()', String(field), '9'])
  assertOperation('完成势力任务function', '.SetXYZ', ['任务序号', String(field), '9', '0'])
  assertOperation('放弃任务function', '.SetXYZ', ['任务序号', String(field), '9', '0'])
}
assertOperation('完成势力任务function', '.SetXYZ', [
  'multiply(save.At(任务序号, 3, 9), 4)',
  'save.At(任务序号, 8, 9)',
  '9',
  '-1',
])
assertOperation('放弃任务function', '.SetXYZ', [
  'multiply(save.At(任务序号, 3, 9), 4)',
  'save.At(任务序号, 8, 9)',
  '9',
  '0',
])
assertCallSubsequence('阵营任务刷新点击', ['失去物品', '刷新任务数据', '音效播放'])
assertCallSubsequence('完成势力任务function', [
  '刷新成就数值',
  '记录文字',
  '获得货币',
  '获得贡献',
  '获得声望',
  '主线任务检测',
])

const factionRules = {
  schemaVersion: 1,
  source: {
    taskDefinitions: 'rw.json',
    factionDefinitions: 'shili.json',
    eventTree: 'data.json',
    runtime: 'scripts/c3runtime.js',
    evidenceFunctions: [
      '位面声望等级',
      '位面声望经验',
      '代理人贡献加成',
      '代理人声望加成',
      '随机阵营任务品质function',
      '随机阵营任务编号function',
      '随机阵营任务数量function',
      '随机阵营任务奖励function',
      '刷新阵营任务数据function',
      '阵营任务刷新点击',
      '接受阵营任务function',
      '完成势力任务function',
      '放弃任务function',
      '位面地点解锁检测function',
      '角色招募价格function',
      '技能升级贡献function',
      '代理人任命function',
    ],
  },
  stateLayout: {
    baseDepth: 0,
    contribution: { indexAxis: 'factionSourceId', fieldColumn: 4 },
    worldReputation: { indexAxis: 'worldIndex', fieldColumn: 5 },
    factionUnlocked: { indexAxis: 'factionSourceId', fieldColumn: 40 },
    agentHero: { indexAxis: 'worldIndex', fieldColumn: 54 },
    agentEnabled: { indexAxis: 'worldIndex', fieldColumn: 55 },
    taskDepth: 9,
    taskBoard: {
      slotCount: 5,
      slotRowStart: 11,
      slotRowEnd: 15,
      fields: {
        taskId: '4 * factionSourceId - 3',
        quality: '4 * factionSourceId - 2',
        targetId: '4 * factionSourceId - 1',
        acceptedRecordId: '4 * factionSourceId',
      },
      emptyRecordId: 0,
      completedRecordId: -1,
    },
    acceptedTaskRecord: {
      recordAxis: 'recordId',
      fieldAxis: 'field',
      fields: {
        recordId: 0,
        taskId: 1,
        worldIndex: 2,
        factionSourceId: 3,
        quality: 4,
        targetId: 5,
        requiredAmount: 6,
        progress: 7,
        boardSlot: 8,
        status: 9,
      },
      acceptedStatus: 1,
    },
    agentFilterDepth: 16,
    agentFilter: {
      row: '(worldIndex - 1) * 5 + taskId',
      taskEnabledColumn: 1,
      factionColumns: [2, 4],
      qualityColumns: [5, 10],
      targetSubtypeColumns: [11, 20],
    },
  },
  reputation: {
    baseAtWorld1: 200,
    baseWorldStep: 20,
    minimumLevel: 1,
    maximumLevel: 5,
    thresholdExponent: 2,
    levelNames: factionReputationLevelNames,
  },
  agentBonus: {
    abilityId: 9,
    contributionPercentPerAbilityLevel: 5,
    reputationPercentPerAbilityLevel: 2,
    multiplierWithoutAgent: 1,
    candidateSelector: {
      requiresRecruited: true,
      excludedHeroSourceIds: [1],
      rejectsFightingHeroes: true,
      sourceEvents: [11064, 11106, 11655, 11658],
    },
  },
  factionUnlock: {
    organizationKind: '势力',
    worldProgressColumn: 2,
    requiredProgressFactionColumn: 20,
    unlockedColumn: 40,
    comparison: 'worldProgress >= requiredProgress',
  },
  tasks: {
    definitions: factionTaskDefinitions.map((task) => ({
      ...task,
      enabledInRandomPool: task.id <= 5,
    })),
    targetPools: factionTaskWorldTargets,
    targetRules: {
      1: '同位面 dr 类型为“小怪”的 10 个图鉴 ID 等权随机',
      2: 'wm[worldIndex][23] 位面货币 ID',
      3: 'wp 类型“材料”；材料族为 wm 对应族可用时，品质 1～2/3～4/5～6 分别取基础/基础+1/基础+2',
      4: '同位面 dr 类型为“首领”且已解锁的目标等权随机；无可选目标时返回本位面首个首领',
      5: 'clamp(quality, 1, 9)，表示待上交装备品质',
      6: null,
    },
    qualityWeights: factionTaskQualityWeights,
    typeWeights: factionTaskTypeWeights,
    reservedTaskIds: [6],
    task6Status: '原版保留定义；未进入随机池且没有数量返回分支',
    quantityFormulas: {
      1: 'round(2.5 * 2^quality)',
      2: 'round(worldPriceMultiplier * 5000 * (2^quality / 10000)) * 10000',
      3: 'quality 1/3/5 => 8; quality 2/4/6 => 16',
      4: 'round(0.25 * 2^quality)',
      5: '1',
      6: null,
    },
    rewardFormulas: {
      currency: 'ceil(worldPriceMultiplier * baseCurrency * ((1 + (quality - 1) * 0.1) * 0.5) * 2^quality)',
      contribution: 'ceil(worldPriceMultiplier * (1 + technologyBonus68) * baseContribution * ((1 + (quality - 1) * 0.1) * 0.5) * 2^quality)',
      reputation: 'ceil(baseReputation * quality * (1 + technologyBonus69))',
    },
    refresh: {
      itemId: 6,
      itemAmount: 1,
      technologyEffectId: 67,
      secondsReducedPerTechnologyBonus: 100,
      minimumSeconds: 100,
      preservesAcceptedSlots: true,
    },
  },
  recruitment: {
    pageSize: 5,
    catalogSize: factionRecruitmentCounts.total,
    factionCount: factionRecruitmentCounts.factions,
    heroColumns: {
      worldIndex: 5,
      reputationLevel: 22,
      factionSourceId: 25,
      basePrice: 26,
      specialRequirement: 35,
    },
    roundCurrencyFromBasePrice: 10000,
    contributionCurrencyRatio: 20,
  },
  skills: {
    factionSkillColumns: [5, 10],
    prerequisiteSkillColumns: [12, 17],
    requiredReputationSkillColumn: 46,
    requiredWorldSkillColumn: 47,
    contributionCurrencyRatio: 20,
    exponentialBase: 1.025,
  },
  technologyEffectIds: {
    taskRefreshTime: 67,
    taskContribution: 68,
    taskReputation: 69,
  },
  formulas: {
    worldPriceMultiplier: '1 + 0.8 * (worldIndex - 1)',
    reputationBase: '200 + (worldIndex - 1) * 20',
    reputationLevel: 'clamp(floor(sqrt(reputation / reputationBase)) + 1, 1, 5)',
    reputationThreshold: 'round(reputationBase * clamp(level - 1, 0, 4)^2)',
    agentContributionMultiplier: '(100 + abilityLevel * 5) / 100',
    agentReputationMultiplier: '(100 + abilityLevel * 2) / 100',
    refreshSeconds: 'clamp(baseSeconds - technologyBonus67 * 100, 100, baseSeconds)',
    recruitmentCurrencyHigh: 'round(basePrice * worldPriceMultiplier / 10000) * 10000',
    recruitmentCurrencyLow: 'round(basePrice * worldPriceMultiplier)',
    recruitmentContribution: 'round(basePrice * (worldPriceMultiplier / 20) / 10000) * 10000',
    skillContribution: 'round(((5000 / 20) * 1.025^((((difficulty - 1) * 20) + skillLevel) * 3) - 200) * percentage)',
    skillCurrency: 'round((10000 * 1.025^((((difficulty - 1) * 20) + skillLevel) * 3) - 9700) * percentage)',
  },
}

const factionRuntimeEvidence = {
  schemaVersion: 3,
  source: {
    eventTree: 'data.json',
    runtime: 'scripts/c3runtime.js',
  },
  functions: factionRuntimeFunctions,
  saveUsages: factionSaveUsages,
}

const versionText = String(arrays.gg[2]?.[0] ?? '')
const version = versionText.match(/版本号([^\[]+)/)?.[1]?.trim() ?? 'unknown'
const runtimeSceneSnapshot = (scene) => ({
  sourceId: scene.sourceId,
  name: scene.name,
  visualKey: scene.visualKey,
  mapMarkerVisualKey: scene.mapMarkerVisualKey,
  npcTitle: scene.npcTitle,
  npcVisualKey: scene.npcVisualKey,
  dialogueId: scene.dialogueId,
  functions: scene.functions,
})
const runtimeWorldTowns = worldHubs.map((hub) => ({
  worldIndex: hub.sourceId,
  mainCity: runtimeSceneSnapshot(hub),
  publicLocations: hub.linkedSceneIds.map((sceneId) => {
    const scene = publicLocations.find((location) => location.sourceId === sceneId)
    assert(scene, `主城 ${hub.name} 引用了不存在的公共场所 ${sceneId}`)
    return runtimeSceneSnapshot(scene)
  }),
  factionTowns: factionTowns
    .filter((town) => factionBySourceId.get(town.factionId)?.worldIndex === hub.sourceId)
    .map((town) => ({
      ...runtimeSceneSnapshot(town),
      factionSourceId: town.factionId,
    })),
}))
const runtimeTownsSource = `/**
 * 原版位面城镇快照——由《诸天刷宝录》cj.json 与 mc.json 解包生成。
 * 生成器：scripts/generate-original-world-evidence.mjs；请勿手改本文件。
 */

export interface OriginalTownFunctionDefinition {
  sourceId: number
  name: string
}

export interface OriginalTownSceneDefinition {
  sourceId: number
  name: string
  visualKey: string
  mapMarkerVisualKey: string
  npcTitle: string
  npcVisualKey: string
  dialogueId: number
  functions: readonly OriginalTownFunctionDefinition[]
}

export interface OriginalFactionTownDefinition extends OriginalTownSceneDefinition {
  factionSourceId: number
}

export interface OriginalWorldTownDefinition {
  worldIndex: number
  mainCity: OriginalTownSceneDefinition
  publicLocations: readonly OriginalTownSceneDefinition[]
  factionTowns: readonly OriginalFactionTownDefinition[]
}

export const ORIGINAL_WORLD_TOWNS: readonly OriginalWorldTownDefinition[] = ${JSON.stringify(runtimeWorldTowns, null, 2)}

export const ORIGINAL_TOWN_COUNTS = {
  worlds: ${worldHubs.length},
  publicLocations: ${publicLocations.length},
  factionTowns: ${factionTowns.length},
} as const

export const ORIGINAL_CITY_FOUNDATION = {
  gridColumns: 18,
  gridRows: 18,
  buildings: ${buildings.length},
  technologies: ${technologies.length},
} as const

export const originalWorldTownByIndex = (worldIndex: number): OriginalWorldTownDefinition | undefined =>
  ORIGINAL_WORLD_TOWNS.find((town) => town.worldIndex === worldIndex)
`
const factionExchangeCatalog = {
  schemaVersion: 1,
  source: {
    catalog: 'gxdh.json',
    itemDefinitions: 'wp.json',
    recipes: 'pf.json',
    jobs: 'zy.json',
    skins: 'hh.json',
    heroes: 'js.json',
    equipmentSets: 'tz.json',
    runtimeEvidence: [
      '物品买卖价格function',
      '位面价格系数function',
      '普通物品等级function',
      '物品名function',
      '幻化类型文本',
    ],
  },
  constants: factionExchangePriceConstants,
  formulas: {
    worldPriceMultiplier: '1 + 0.8 * (worldIndex - 1)',
    normalItemLevel: 'max((quality - 1) * 25, 5)',
    contributionCorrection: 'categoryCorrection * worldPriceMultiplier / 20',
    finalPrice: 'max(round((contributionCorrection * 10) * (10 + itemLevel) * 2.5^quality), 1)',
    skinPriceInputs: '原函数没有为幻型写入物品等级与品质，沿用默认值 0 与 0',
  },
  counts: factionExchangeCounts,
  items: factionExchangeItems,
}
const factionRecruitmentCatalog = {
  schemaVersion: 1,
  source: {
    heroes: 'js.json',
    factions: 'shili.json',
    reputationNames: 'mc.json',
    runtimeEvidence: [
      '角色招募价格function',
      '打开角色选择列表function',
      '刷新角色选择列表',
      '代理人任命function',
      '代理人任命人物列表点击',
    ],
  },
  columns: factionRules.recruitment.heroColumns,
  counts: factionRecruitmentCounts,
  entries: factionRecruitmentEntries,
}
const runtimeFactionExchangeSource = `/**
 * 原版势力贡献兑换目录——由《诸天刷宝录》gxdh.json 及关联表生成。
 * 生成器：scripts/generate-original-world-evidence.mjs；请勿手改本文件。
 */

export type OriginalFactionExchangeKind = 'job-book' | 'blueprint' | 'secret-realm-ticket' | 'skin'

export type OriginalFactionExchangeTarget =
  | { kind: 'job'; sourceId: number; name: string; stateKey: string }
  | {
      kind: 'blueprint'
      recipeId: number
      stateKey: string
      itemId: number
      itemName: string
      itemCategory: string
      itemQuality: number
      setId: number
      setName: string
    }
  | { kind: 'material'; stateKey: string }
  | {
      kind: 'skin'
      sourceId: number
      variantName: string
      heroSourceId: number
      heroName: string
      skinType: number
      skinTypeName: string
    }

export interface OriginalFactionExchangeItem {
  factionSourceId: number
  factionName: string
  worldIndex: number
  slot: number
  itemId: number
  specificId: number
  kind: OriginalFactionExchangeKind
  originalName: string
  price: number
  requiredReputationLevel: number | null
  baseItemQuality: number
  priceQuality: number
  priceItemLevel: number
  worldPriceMultiplier: number
  categoryCorrection: number
  target: OriginalFactionExchangeTarget
}

export const ORIGINAL_FACTION_EXCHANGE_PRICE_CONSTANTS = ${JSON.stringify(factionExchangePriceConstants, null, 2)} as const

export const ORIGINAL_FACTION_EXCHANGE_COUNTS = ${JSON.stringify(factionExchangeCounts, null, 2)} as const

export const ORIGINAL_FACTION_EXCHANGE: readonly OriginalFactionExchangeItem[] = ${JSON.stringify(factionExchangeItems, null, 2)}

export const originalFactionExchangeByFaction = (factionSourceId: number): readonly OriginalFactionExchangeItem[] =>
  ORIGINAL_FACTION_EXCHANGE.filter((item) => item.factionSourceId === factionSourceId)
`
const runtimeFactionRecruitmentSource = `/**
 * 原版势力招募目录——由《诸天刷宝录》js/shili 表与角色选择事件生成。
 * 生成器：scripts/generate-original-world-evidence.mjs；请勿手改本文件。
 */

export type OriginalFactionRecruitmentResourceKind = '货币' | '贡献'

export interface OriginalFactionRecruitmentEntry {
  heroSourceId: number
  name: string
  worldIndex: number
  factionSourceId: number
  factionName: string
  resourceKind: OriginalFactionRecruitmentResourceKind
  requiredReputationLevel: number
  requiredReputationName: string
  basePrice: number
  price: number
  specialRequirement: number
}

export const ORIGINAL_FACTION_RECRUITMENT_COUNTS = ${JSON.stringify(factionRecruitmentCounts, null, 2)} as const

export const ORIGINAL_FACTION_RECRUITMENT: readonly OriginalFactionRecruitmentEntry[] = ${JSON.stringify(factionRecruitmentEntries, null, 2)}

export const originalFactionRecruitmentByFaction = (factionSourceId: number): readonly OriginalFactionRecruitmentEntry[] =>
  ORIGINAL_FACTION_RECRUITMENT.filter((entry) => entry.factionSourceId === factionSourceId)
`
const runtimeFactionRulesSource = `/**
 * 原版势力规则契约——由《诸天刷宝录》rw/shili 表与 Construct 运行时事件生成。
 * 生成器：scripts/generate-original-world-evidence.mjs；请勿手改本文件。
 */

export type OriginalFactionResourceKind = '货币' | '贡献'

export const ORIGINAL_FACTION_RULES = ${JSON.stringify(factionRules, null, 2)} as const

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

export const originalFactionWorldPriceMultiplier = (worldIndex: number): number =>
  1 + 0.8 * (worldIndex - 1)

export const originalWorldReputationBase = (worldIndex: number): number =>
  ORIGINAL_FACTION_RULES.reputation.baseAtWorld1
    + (worldIndex - 1) * ORIGINAL_FACTION_RULES.reputation.baseWorldStep

export const originalWorldReputationLevel = (reputation: number, worldIndex: number): number =>
  clamp(Math.floor(Math.sqrt(reputation / originalWorldReputationBase(worldIndex))) + 1, 1, 5)

export const originalWorldReputationLevelName = (level: number): string =>
  ORIGINAL_FACTION_RULES.reputation.levelNames[clamp(level, 1, 5) - 1]

export const originalWorldReputationThreshold = (level: number, worldIndex: number): number =>
  Math.round(originalWorldReputationBase(worldIndex) * clamp(level - 1, 0, 4) ** 2)

export const originalFactionAgentContributionMultiplier = (abilityLevel: number): number =>
  (100 + abilityLevel * ORIGINAL_FACTION_RULES.agentBonus.contributionPercentPerAbilityLevel) / 100

export const originalFactionAgentReputationMultiplier = (abilityLevel: number): number =>
  (100 + abilityLevel * ORIGINAL_FACTION_RULES.agentBonus.reputationPercentPerAbilityLevel) / 100

export const originalFactionTaskDefinitionById = (taskId: number) =>
  ORIGINAL_FACTION_RULES.tasks.definitions.find((task) => task.id === taskId)

export const originalFactionTaskTargetPool = (
  worldIndex: number,
  taskId: number,
  quality: number,
  unlockedBossDrIds: readonly number[] = [],
): readonly number[] => {
  const world = ORIGINAL_FACTION_RULES.tasks.targetPools.find((target) => target.worldIndex === worldIndex)
  if (!world) return []
  if (taskId === 1) return world.normalEnemies.map((enemy) => enemy.drId)
  if (taskId === 2) return [world.currency.sourceId]
  if (taskId === 3) {
    return world.materialItemsByQuality
      .find((group) => group.quality === quality)
      ?.items.map((item) => item.itemId) ?? []
  }
  if (taskId === 4) {
    const unlocked = new Set(unlockedBossDrIds)
    const available = world.bossEnemies.filter((enemy) => unlocked.has(enemy.drId)).map((enemy) => enemy.drId)
    return available.length ? available : world.bossEnemies.slice(0, 1).map((enemy) => enemy.drId)
  }
  if (taskId === 5) return [clamp(quality, 1, 9)]
  return []
}

export const originalFactionTaskTargetName = (
  worldIndex: number,
  taskId: number,
  targetId: number,
): string => {
  const world = ORIGINAL_FACTION_RULES.tasks.targetPools.find((target) => target.worldIndex === worldIndex)
  if (!world) return '未知目标'
  if (taskId === 1) return world.normalEnemies.find((enemy) => enemy.drId === targetId)?.name ?? '未知敌人'
  if (taskId === 2) return world.currency.sourceId === targetId ? world.currency.name : '未知货币'
  if (taskId === 3) {
    for (const group of world.materialItemsByQuality) {
      const item = group.items.find((candidate) => candidate.itemId === targetId)
      if (item) return item.name
    }
    return '未知材料'
  }
  if (taskId === 4) return world.bossEnemies.find((enemy) => enemy.drId === targetId)?.name ?? '未知首领'
  if (taskId === 5) return '品质 ' + targetId + ' 装备'
  return '未启用任务'
}

export const originalFactionTaskRequiredAmount = (
  taskId: number,
  quality: number,
  worldIndex: number,
): number | null => {
  if (taskId === 1) return Math.round(2.5 * 2 ** quality)
  if (taskId === 2) {
    return Math.round(
      originalFactionWorldPriceMultiplier(worldIndex) * 5000 * (2 ** quality / 10000),
    ) * 10000
  }
  if (taskId === 3) return quality % 2 === 1 ? 8 : 16
  if (taskId === 4) return Math.round(0.25 * 2 ** quality)
  if (taskId === 5) return 1
  return null
}

export interface OriginalFactionTaskReward {
  currency: number
  contribution: number
  reputation: number
}

export const originalFactionTaskReward = (
  taskId: number,
  quality: number,
  worldIndex: number,
  technologyBonus68 = 0,
  technologyBonus69 = 0,
): OriginalFactionTaskReward => {
  const task = originalFactionTaskDefinitionById(taskId)
  if (!task) return { currency: 0, contribution: 0, reputation: 0 }
  const qualityMultiplier = (1 + (quality - 1) * 0.1) * 0.5 * 2 ** quality
  const worldMultiplier = originalFactionWorldPriceMultiplier(worldIndex)
  return {
    currency: Math.ceil(worldMultiplier * task.baseCurrencyReward * qualityMultiplier),
    contribution: Math.ceil(
      worldMultiplier * (1 + technologyBonus68) * task.baseContributionReward * qualityMultiplier,
    ),
    reputation: Math.ceil(task.baseReputationReward * quality * (1 + technologyBonus69)),
  }
}

export const originalFactionTaskRefreshSeconds = (
  baseSeconds: number,
  technologyBonus67: number,
): number => clamp(baseSeconds - technologyBonus67 * 100, 100, baseSeconds)

export const originalFactionRecruitPrice = (
  basePrice: number,
  worldIndex: number,
  resourceKind: OriginalFactionResourceKind,
): number => {
  const worldMultiplier = originalFactionWorldPriceMultiplier(worldIndex)
  if (resourceKind === '贡献') {
    return Math.round(
      basePrice * (worldMultiplier / ORIGINAL_FACTION_RULES.recruitment.contributionCurrencyRatio) / 10000,
    ) * 10000
  }
  if (basePrice >= ORIGINAL_FACTION_RULES.recruitment.roundCurrencyFromBasePrice) {
    return Math.round(basePrice * worldMultiplier / 10000) * 10000
  }
  return Math.round(basePrice * worldMultiplier)
}

export const originalFactionSkillUpgradeCost = (
  skillLevel: number,
  difficulty: number,
  resourceKind: OriginalFactionResourceKind,
  percentage = 1,
): number => {
  const exponent = (((difficulty - 1) * 20) + skillLevel) * 3
  if (resourceKind === '贡献') {
    return Math.round(
      ((5000 / ORIGINAL_FACTION_RULES.skills.contributionCurrencyRatio)
        * ORIGINAL_FACTION_RULES.skills.exponentialBase ** exponent
        - 200)
      * percentage,
    )
  }
  return Math.round(
    (10000 * ORIGINAL_FACTION_RULES.skills.exponentialBase ** exponent - 9700) * percentage,
  )
}

export const originalFactionUnlocksAtProgress = (
  worldProgress: number,
  requiredProgress: number,
): boolean => worldProgress >= requiredProgress
`
const manifest = {
  schemaVersion: 2,
  source: {
    game: '诸天刷宝录',
    snapshotVersion: version,
    rootHint: '诸天刷宝录/_analysis',
    fingerprints,
  },
  counts: {
    worlds: 13,
    factions: factions.length,
    militiaFactions: militiaFactions.length,
    formalFactions: formalFactions.length,
    worldHubs: worldHubs.length,
    publicLocations: publicLocations.length,
    factionTowns: factionTowns.length,
    factionExchangeItems: factionExchangeCounts.total,
    factionRecruitmentHeroes: factionRecruitmentCounts.total,
    factionTasks: factionTaskDefinitions.length,
    buildings: buildings.length,
    technologies: technologies.length,
  },
  functionNames: Object.fromEntries(functionNames),
  factions,
  worldHubs,
  publicLocations,
  factionTowns,
  factionExchange: {
    constants: factionExchangePriceConstants,
    counts: factionExchangeCounts,
  },
  factionRecruitment: {
    counts: factionRecruitmentCounts,
  },
  factionRules: {
    schemaVersion: factionRules.schemaVersion,
    taskCount: factionTaskDefinitions.length,
    taskBoardSlots: factionRules.stateLayout.taskBoard.slotCount,
  },
  buildings,
  technologies,
  csczLayout,
  fieldDictionaries,
  formulaIndex,
  runtimeEvidence: {
    arrayReferences,
    runtimeArrays,
    fieldUsageSummary,
  },
  rawTables: {
    cscz: arrays.cscz,
    csdj: arrays.csdj,
    cszb: arrays.cszb,
  },
}

const statusLabel = {
  confirmed: '已确认',
  pending: '待解码',
}
const usageByTableAndColumn = new Map()
for (const usage of fieldUsages) {
  if (usage.column === null) continue
  const key = `${usage.table}:${usage.column}`
  const items = usageByTableAndColumn.get(key) ?? []
  items.push(usage)
  usageByTableAndColumn.set(key, items)
}
const fieldUsageLabel = (table, column) => {
  const usages = usageByTableAndColumn.get(`${table}:${column}`) ?? []
  if (!usages.length) return '未定位到固定列访问'
  const reads = usages.filter((usage) => usage.direction === 'read').length
  const writes = usages.filter((usage) => usage.direction === 'write').length
  const functions = [...new Set(usages.map((usage) => usage.functionName).filter(Boolean))]
  const counts = [reads ? `${reads} 读` : null, writes ? `${writes} 写` : null].filter(Boolean).join('、')
  return `${counts}；${functions.slice(0, 2).join('、') || '事件路径见索引'}`
}
const dictionaryMarkdown = Object.entries(fieldDictionaries).flatMap(([table, fields]) => [
  `## ${table}.json`,
  '',
  '| 列 | 字段 | 状态 | 证据 | 运行时访问 |',
  '|---:|---|---|---|---|',
  ...fields.map((field) => `| ${field.column} | \`${field.name}\` | ${statusLabel[field.status]} | ${field.evidence} | ${fieldUsageLabel(table, field.column)} |`),
  '',
]).join('\n')

const formulaMarkdown = Object.entries(formulaIndex).flatMap(([category, items]) => [
  `## ${category}（${items.length}）`,
  '',
  '| Event ID | 函数或事件 | 事件表路径 |',
  '|---:|---|---|',
  ...items.map((item) => `| ${item.eventId} | ${item.name} | ${item.paths[0] ?? '路径待定位'} |`),
  '',
]).join('\n')

const inlineCode = (value) => String(value).replace(/`/g, "'")
const factionRuntimeMarkdown = factionRuntimeFunctions.flatMap((fn) => [
  `## ${fn.name}`,
  '',
  `- Event ID：${fn.eventId}`,
  `- 事件路径：${fn.paths[0] ?? '路径待定位'}`,
  `- 运行时操作：${fn.operations.length} 条`,
  `- 函数调用：${fn.calls.length} 条`,
  `- 表字段访问：${fn.fieldUsages.length} 条`,
  '',
  '### 运行时表达式',
  '',
  ...(fn.expressions.length
    ? fn.expressions.map((item) => `- \`#${item.expressionId}\` \`${inlineCode(item.expression)}\``)
    : ['- 无表达式参数']),
  '',
]).join('\n')

const markdownCell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
const factionExchangeKindLabels = {
  'job-book': '转职书',
  blueprint: '图纸',
  'secret-realm-ticket': '秘境门票',
  skin: '幻型',
}
const factionExchangeTargetLabel = (item) => {
  if (item.target.kind === 'job') return `职业 ${item.target.sourceId} ${item.target.name}`
  if (item.target.kind === 'blueprint') {
    return `配方 ${item.target.recipeId} → ${item.target.setName}之${item.target.itemName}（装备 ${item.target.itemId}）`
  }
  if (item.target.kind === 'skin') {
    return `${item.target.heroName}（角色 ${item.target.heroSourceId}，${item.target.skinTypeName}）`
  }
  return `材料 ${item.itemId}`
}
const factionExchangeMarkdown = `# 原版势力贡献兑换目录

本目录由 \`gxdh.json\` 的 16 个商品槽和 42 组势力列生成；只有 29 个正式势力存在商品，共 ${factionExchangeCounts.total} 条。

## 数量

| 分类 | 数量 |
|---|---:|
| 转职书 | ${factionExchangeCounts.jobBooks} |
| 图纸 | ${factionExchangeCounts.blueprints} |
| 秘境门票 | ${factionExchangeCounts.secretRealmTickets} |
| 幻型 | ${factionExchangeCounts.skins} |

## 原版贡献价格

- 位面系数：\`1 + 0.8 × (位面编号 - 1)\`。
- 普通物品等级：\`max((品质 - 1) × 25, 5)\`。
- 分类修正：转职书 \`10\`、图纸 \`4\`、秘境门票 \`2\`、幻型 \`100000\`，再乘位面系数并除以贡献比 \`20\`。
- 最终价格：\`max(round((修正系数 × 10) × (10 + 物品等级) × 2.5^物品品质), 1)\`。
- 原版价格函数没有为幻型写入物品等级和品质，因此幻型按默认值 \`0 / 0\` 计算，不套用 \`wp[9]\` 的基础品质。

## 声望门槛

- 图纸读取目标装备 \`wp[targetItemId][36]\`。
- 秘境门票读取 \`wp[5][36] = 4\`。
- 幻型读取 \`wp[9][36] = 5\`。
- 转职书分支没有声望门槛，目录中记为 \`null\`。

## 商品

| 位面 | 势力 | 槽位 | 分类 | 原版名称 | 贡献 | 声望 | 目标 |
|---:|---|---:|---|---|---:|---:|---|
${factionExchangeItems.map((item) => `| ${item.worldIndex} | ${markdownCell(item.factionName)} | ${item.slot} | ${factionExchangeKindLabels[item.kind]} | ${markdownCell(item.originalName)} | ${item.price} | ${item.requiredReputationLevel ?? '—'} | ${markdownCell(factionExchangeTargetLabel(item))} |`).join('\n')}
`
const factionRecruitmentMarkdown = `# 原版势力招募目录

本目录由 \`js.json\` 与 \`shili.json\` 生成，覆盖 42 个势力、${factionRecruitmentCounts.total} 名可招募角色。角色战斗定义未接入前，运行时只能展示原版名录、声望门槛和价格，不能把自定义角色数据冒充原版招募。

## 规则

- \`js[5]\` 为位面，\`js[22]\` 为声望等级，\`js[25]\` 为所属势力，\`js[26]\` 为基础价格，\`js[35]\` 为特殊条件。
- 当前快照 131 人的特殊条件均为 \`0\`。
- 原版每页显示 5 人；正式势力消耗贡献，民团消耗位面货币。
- 代理人候选从已招募角色中产生，并排除 sourceId 1 的原版主角；任命点击会拒绝正在战斗中的角色。

## 声望分布

| 等级 | 名称 | 人数 |
|---:|---|---:|
${factionReputationLevelNames.map((name, index) => `| ${index + 1} | ${name} | ${factionRecruitmentCounts.byReputationLevel[String(index + 1)]} |`).join('\n')}

## 名录

| 位面 | 势力 | 角色 | 声望门槛 | 基础价格 | 最终价格 | 资源 |
|---:|---|---|---|---:|---:|---|
${factionRecruitmentEntries.map((entry) => `| ${entry.worldIndex} | ${markdownCell(entry.factionName)} | ${markdownCell(entry.name)} | ${entry.requiredReputationLevel} ${entry.requiredReputationName} | ${entry.basePrice} | ${entry.price} | ${entry.resourceKind} |`).join('\n')}
`
const factionRulesMarkdown = `# 原版势力规则与状态契约

本契约由 \`rw.json\`、\`shili.json\` 与 Construct 事件树逐项断言后生成；运行时 TypeScript 使用同一份数据，不手工复制第二套结论。

## 权威状态

| 状态 | save depth | 索引 | 字段 |
|---|---:|---|---:|
| 势力贡献 | 0 | 势力 ID | 4 |
| 位面声望 | 0 | 位面编号 | 5 |
| 势力解锁 | 0 | 势力 ID | 40 |
| 位面代理人角色 | 0 | 位面编号 | 54 |
| 位面代理人开关 | 0 | 位面编号 | 55 |

- 悬榜位于 depth 9，共 5 格，行号 11～15；每个势力占用四列，依次保存任务 ID、品质、目标 ID 和接受记录 ID。
- 接受记录位于 depth 9，以记录 ID 为 X 轴，Y 轴 0～9 依次保存记录 ID、任务 ID、位面、势力、品质、目标、需求量、进度、悬榜格和状态。
- 代理人筛选矩阵位于 depth 16，行号为 \`(worldIndex - 1) * 5 + taskId\`。

## 位面声望与代理人

- 位面基础值：\`200 + (worldIndex - 1) * 20\`。
- 声望等级：\`clamp(floor(sqrt(reputation / base)) + 1, 1, 5)\`。
- 等级名称：${factionReputationLevelNames.map((name, index) => `${index + 1} ${name}`).join('、')}（\`mc[1..5][13]\`）。
- 等级阈值：\`round(base * clamp(level - 1, 0, 4)^2)\`。
- 代理人使用能力 9；贡献倍率为 \`(100 + abilityLevel * 5) / 100\`，声望倍率为 \`(100 + abilityLevel * 2) / 100\`；无代理人时均为 1。
- 代理人候选来自 \`save[heroId,1,1] = 1\` 的已招募角色，并排除 sourceId 1 的原版主角；Event 11658 会拒绝正在战斗中的角色。

## 悬榜生成

品质权重总计 ${factionTaskQualityWeights.reduce((sum, entry) => sum + entry.weight, 0)}：

| 品质 | 权重 |
|---:|---:|
${factionTaskQualityWeights.map((entry) => `| ${entry.value} | ${entry.weight} |`).join('\n')}

任务类型权重：

| 品质 | 任务权重 |
|---|---|
${factionTaskTypeWeights.map((rule) => `| ${rule.qualityMin}${rule.qualityMax === rule.qualityMin ? '' : `～${rule.qualityMax}`} | ${rule.weights.map((entry) => `${entry.value}:${entry.weight}`).join('、')} |`).join('\n')}

任务 1～5 进入随机池；任务 6“捕捉目标灵兽”只存在于原表，没有进入随机权重，也没有数量返回分支，当前不得启用。

## 任务目标池

- 消灭：同位面 10 个 \`dr\` 小怪等权随机。
- 筹措：固定为 \`wm[worldIndex][23]\` 对应的位面货币。
- 收集：从 \`wp\` 四类材料中筛选本位面启用的材料族；品质 1～2、3～4、5～6 分别使用基础、基础 + 1、基础 + 2 阶。
- 挑战：从同位面已解锁首领等权随机；没有已解锁目标时回退本位面首个首领。
- 寻宝：目标值就是 \`clamp(quality, 1, 9)\` 后的装备品质。

生成契约逐位面保留 10 个小怪、10 个首领、位面货币和六档材料池，可直接用原版 \`dr/wp\` ID 结算，不需要猜测名称或目标类别。

## 数量与奖励

| 任务 | 数量公式 | 贡献基础 | 声望基础 |
|---:|---|---:|---:|
${factionTaskDefinitions.map((task) => `| ${task.id} ${task.name} | ${factionRules.tasks.quantityFormulas[task.id] ?? '未启用'} | ${task.baseContributionReward} | ${task.baseReputationReward} |`).join('\n')}

- 货币：\`ceil(worldMultiplier * baseCurrency * qualityMultiplier)\`。
- 贡献：\`ceil(worldMultiplier * (1 + techBonus68) * baseContribution * qualityMultiplier)\`。
- 声望：\`ceil(baseReputation * quality * (1 + techBonus69))\`。
- \`qualityMultiplier = ((1 + (quality - 1) * 0.1) * 0.5) * 2^quality\`。

## 刷新、解锁、招募与技能

- 刷新消耗普通物品 6“介绍信”1 个；只覆盖未接受格；刷新时间为 \`clamp(baseSeconds - techBonus67 * 100, 100, baseSeconds)\`。
- 正式势力要求同位面进度 \`save[worldIndex,2,0] >= shili[factionId,20]\`，满足后写入 \`save[factionId,40,0] = 1\`。
- 招募目录共 ${factionRecruitmentCounts.total} 人、覆盖 ${factionRecruitmentCounts.factions} 个势力，每页 5 人；货币价格在基础价达到 10000 时按万取整，否则按整数取整；贡献价格使用贡献比 20 并按万取整。
- 势力六技能来自 \`shili[5..10]\`，前置来自 \`shili[12..17]\`；技能的声望等级和位面要求来自 \`jn[46..47]\`。

## 状态变化顺序

- 接受任务时建立 0～9 字段记录，并将记录 ID 关联回悬榜格。
- 手动刷新先扣介绍信，再刷新未接受任务，最后播放成功音效。
- 完成任务依次刷新成就、记录文本、发放货币/贡献/声望、把悬榜关联写为 -1、清空接受记录并触发主线检测。
- 放弃任务把悬榜关联写回 0，并清空接受记录 0～9；悬榜原任务仍可重新接受。
`
const fieldUsageMarkdown = fieldUsageTableNames.flatMap((table) => {
  const summary = fieldUsageSummary[table]
  const staticRows = summary.staticColumns.map((column) => {
    const usages = usageByTableAndColumn.get(`${table}:${column}`) ?? []
    const reads = usages.filter((usage) => usage.direction === 'read').length
    const writes = usages.filter((usage) => usage.direction === 'write').length
    const functions = [...new Set(usages.map((usage) => usage.functionName).filter(Boolean))]
    const events = [...new Set(usages.map((usage) => usage.eventId).filter((id) => id !== null))]
    return `| ${column} | ${reads} | ${writes} | ${markdownCell(functions.slice(0, 4).join('、') || '—')} | ${events.slice(0, 8).join('、') || '—'} |`
  })
  const dynamicRows = fieldUsages
    .filter((usage) => usage.table === table && usage.column === null)
    .map((usage) => `| \`${markdownCell(usage.columnExpression)}\` | ${usage.direction} | ${usage.eventId ?? '—'} | ${markdownCell(usage.functionName ?? '—')} |`)
  return [
    `## ${table}（objectId ${summary.objectId}）`,
    '',
    `固定列访问 ${summary.reads + summary.writes - summary.dynamicColumnAccesses} 条，动态列访问 ${summary.dynamicColumnAccesses} 条，未解析 ${summary.unresolvedAccesses} 条。`,
    '',
    '| 列 | 读 | 写 | 函数样例 | Event ID |',
    '|---:|---:|---:|---|---|',
    ...staticRows,
    '',
    ...(dynamicRows.length ? [
      '### 动态列访问',
      '',
      '| 列表达式 | 方向 | Event ID | 函数 |',
      '|---|---|---:|---|',
      ...dynamicRows,
      '',
    ] : []),
  ]
}).join('\n')

const cityLayoutMarkdown = `# 原版现世城市初始地块矩阵

\`cscz.json\` 是一张压缩存放的 18×18 城市地块初始矩阵。初始化事件只处理 \`CurX ≤ 17\`、\`CurY ≤ 17\`，并把每个地块写入 \`save\` 的 depth 10。

## 坐标

- 源表第 0～17 列对应地块 x 坐标；第 18～19 列是当前快照全空的保留列。
- 每段源表行以 \`CurX\` 表示地块 y 坐标。
- 存档第 11 列保存 x（\`cscz.CurY()\`），第 12 列保存 y（\`cscz.CurX()\`）。

## 压缩行段

| 源表行 | 逻辑字段 | save 列 | 运行时证据 |
|---|---|---:|---|
| 0～17 | \`buildingId\` | 1 | 后续通过 \`jz\` 表读取建筑名称、类型与场景 |
| 20～37 | \`buildingLevel\` | 2 | 建筑界面以 Lv 显示并在升级时递增 |
| 34～51 | \`landPriceTier\` | 45 | \`土地价格function\` 以该值三次方参与地价计算 |

第 34～37 行同时属于两个偏移读取窗口，这是原表压缩布局和初始化表达式的直接结果，不应在生成阶段自行去重或改写。

## 地块存档字段

| save 列 | 字段 |
|---:|---|
| 0 | \`tileId\` |
| 1 | \`buildingId\` |
| 2 | \`buildingLevel\` |
| 11 | \`gridX\` |
| 12 | \`gridY\` |
| 45 | \`landPriceTier\` |

\`field-usage-index.json\` 的 \`targetedCitySaveUsages\` 保留这些字段在初始化、建筑、土地、公司和城市属性链中的逐次读写表达式，共 ${citySaveUsages.length} 条。
`

const readme = `# 原版势力、城镇与城市经营真值包

本目录由 \`npm run evidence:world\` 从本机《诸天刷宝录》\`_analysis\` 生成。生成结果不作为运行时依赖，业务代码不得直接读取本目录中的原始表。

## 原版快照

- 版本：${version}
- 势力：${factions.length}（民团 ${militiaFactions.length}、正式势力 ${formalFactions.length}）
- 位面主城：${worldHubs.length}
- 主城公共场所：${publicLocations.length}
- 正式势力城镇：${factionTowns.length}
- 势力贡献兑换：${factionExchangeCounts.total}（转职书 ${factionExchangeCounts.jobBooks}、图纸 ${factionExchangeCounts.blueprints}、秘境门票 ${factionExchangeCounts.secretRealmTickets}、幻型 ${factionExchangeCounts.skins}）
- 势力招募：${factionRecruitmentCounts.total} 人（覆盖 ${factionRecruitmentCounts.factions} 个势力）
- 非空建筑：${buildings.length}
- 科技：${technologies.length}

## 文件

- \`manifest.json\`：原版记录、跨表关系、原始城市表、源文件指纹与运行时索引。
- \`field-dictionary.md\`：逐列字段状态；未知列保留原始值，不猜测语义。
- \`field-usage-index.json\`：从事件树和运行时表达式函数提取的逐次字段读写证据。
- \`field-usage-index.md\`：按表和固定列汇总的人工审阅索引。
- \`city-layout.md\`：\`cscz\` 的 18×18 城市地块压缩布局与存档字段。
- \`formula-index.md\`：从原版事件表和 \`_all_func_names.txt\` 定位的相关函数入口。
- \`faction-runtime-evidence.json\`：势力资源、声望、兑换、任务与解锁函数的逐表达式证据。
- \`faction-runtime-evidence.md\`：上述函数的人工审阅版索引。
- \`faction-exchange-catalog.json\`：完整贡献兑换商品、名称、价格输入、声望门槛和目标映射。
- \`faction-exchange-catalog.md\`：上述 396 条兑换商品的人工审阅表。
- \`faction-recruitment-catalog.json\`：完整势力招募角色、声望门槛、基础价格和最终价格。
- \`faction-recruitment-catalog.md\`：上述 ${factionRecruitmentCounts.total} 人招募目录的人工审阅表。
- \`faction-rules.json\`：势力声望、代理人、悬榜、刷新、解锁、招募、技能与状态布局的共享契约。
- \`faction-rules.md\`：上述原版规则与状态变化的人工审阅版。
- \`save-contract.md\`：新存档共享状态边界。
- \`verification-checklist.md\`：开发前仍需完成的运行时与实机核验。
- \`egg-jianghu/src/content/original-towns.generated.ts\`：运行时使用的主城、公共场所与势力城镇快照。
- \`egg-jianghu/src/content/original-faction-exchange.generated.ts\`：运行时使用的完整势力贡献兑换目录。
- \`egg-jianghu/src/content/original-faction-recruitment.generated.ts\`：运行时使用的完整势力招募目录。
- \`egg-jianghu/src/content/original-faction-rules.generated.ts\`：运行时使用的势力规则常量与纯函数。

## 证据规则

- “已确认”可直接进入后续生成器。
- “待运行时复核”只能作为检索线索，复核前不得进入公式或存档。
- “待解码”只保留原始列和值。
- 源文件 SHA-256 变化时必须重新生成并审阅差异。
`

const outputs = {
  'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
  'README.md': readme,
  'field-dictionary.md': `# 原版字段字典\n\n${dictionaryMarkdown}`,
  'field-usage-index.json': `${JSON.stringify(fieldUsageIndex, null, 2)}\n`,
  'field-usage-index.md': `# 原版字段访问索引\n\n${fieldUsageMarkdown}`,
  'city-layout.md': cityLayoutMarkdown,
  'formula-index.md': `# 原版运行时函数索引\n\n${formulaMarkdown}`,
  'faction-runtime-evidence.json': `${JSON.stringify(factionRuntimeEvidence, null, 2)}\n`,
  'faction-runtime-evidence.md': `# 原版势力运行时公式证据\n\n${factionRuntimeMarkdown}`,
  'faction-exchange-catalog.json': `${JSON.stringify(factionExchangeCatalog, null, 2)}\n`,
  'faction-exchange-catalog.md': factionExchangeMarkdown,
  'faction-recruitment-catalog.json': `${JSON.stringify(factionRecruitmentCatalog, null, 2)}\n`,
  'faction-recruitment-catalog.md': factionRecruitmentMarkdown,
  'faction-rules.json': `${JSON.stringify(factionRules, null, 2)}\n`,
  'faction-rules.md': factionRulesMarkdown,
}

if (process.argv.includes('--check')) {
  for (const [name, content] of Object.entries(outputs)) {
    let current = null
    try {
      current = readFileSync(join(OUT_DIR, name), 'utf8')
    } catch {
      throw new Error(`真值包缺少 ${name}，请先运行 npm run evidence:world`)
    }
    assert(current === content, `真值包 ${name} 已过期，请运行 npm run evidence:world 并审阅差异`)
  }
  let currentRuntimeTowns = null
  try {
    currentRuntimeTowns = readFileSync(RUNTIME_TOWNS_FILE, 'utf8')
  } catch {
    throw new Error('运行时城镇快照缺失，请先运行 npm run evidence:world')
  }
  assert(currentRuntimeTowns === runtimeTownsSource, '运行时城镇快照已过期，请运行 npm run evidence:world 并审阅差异')
  let currentRuntimeFactionExchange = null
  try {
    currentRuntimeFactionExchange = readFileSync(RUNTIME_FACTION_EXCHANGE_FILE, 'utf8')
  } catch {
    throw new Error('运行时势力贡献兑换目录缺失，请先运行 npm run evidence:world')
  }
  assert(currentRuntimeFactionExchange === runtimeFactionExchangeSource, '运行时势力贡献兑换目录已过期，请运行 npm run evidence:world 并审阅差异')
  let currentRuntimeFactionRecruitment = null
  try {
    currentRuntimeFactionRecruitment = readFileSync(RUNTIME_FACTION_RECRUITMENT_FILE, 'utf8')
  } catch {
    throw new Error('运行时势力招募目录缺失，请先运行 npm run evidence:world')
  }
  assert(currentRuntimeFactionRecruitment === runtimeFactionRecruitmentSource, '运行时势力招募目录已过期，请运行 npm run evidence:world 并审阅差异')
  let currentRuntimeFactionRules = null
  try {
    currentRuntimeFactionRules = readFileSync(RUNTIME_FACTION_RULES_FILE, 'utf8')
  } catch {
    throw new Error('运行时势力规则契约缺失，请先运行 npm run evidence:world')
  }
  assert(currentRuntimeFactionRules === runtimeFactionRulesSource, '运行时势力规则契约已过期，请运行 npm run evidence:world 并审阅差异')
  console.log('原版势力、城镇与城市经营真值包已是最新')
} else {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const [name, content] of Object.entries(outputs)) {
    writeFileSync(join(OUT_DIR, name), content, 'utf8')
  }
  mkdirSync(dirname(RUNTIME_TOWNS_FILE), { recursive: true })
  writeFileSync(RUNTIME_TOWNS_FILE, runtimeTownsSource, 'utf8')
  mkdirSync(dirname(RUNTIME_FACTION_EXCHANGE_FILE), { recursive: true })
  writeFileSync(RUNTIME_FACTION_EXCHANGE_FILE, runtimeFactionExchangeSource, 'utf8')
  mkdirSync(dirname(RUNTIME_FACTION_RECRUITMENT_FILE), { recursive: true })
  writeFileSync(RUNTIME_FACTION_RECRUITMENT_FILE, runtimeFactionRecruitmentSource, 'utf8')
  mkdirSync(dirname(RUNTIME_FACTION_RULES_FILE), { recursive: true })
  writeFileSync(RUNTIME_FACTION_RULES_FILE, runtimeFactionRulesSource, 'utf8')
  console.log(`已生成真值包：势力 ${factions.length}、主城 ${worldHubs.length}、公共场所 ${publicLocations.length}、势力城镇 ${factionTowns.length}`)
  console.log(`贡献兑换：商品 ${factionExchangeCounts.total}、正式势力 ${factionExchangeCounts.factions}`)
  console.log(`势力招募：角色 ${factionRecruitmentCounts.total}、势力 ${factionRecruitmentCounts.factions}`)
  console.log(`城市数据：建筑 ${buildings.length}、科技 ${technologies.length}；运行时索引 ${parsedFunctions.length} 条中筛选相关入口`)
}
