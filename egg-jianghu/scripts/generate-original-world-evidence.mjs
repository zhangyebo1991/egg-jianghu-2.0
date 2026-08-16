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

const sourceNames = [
  'gg.json',
  'shili.json',
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
  ['gg', 'shili', 'cj', 'mc', 'jz', 'kj', 'cscz', 'csdj', 'cszb']
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
    }
  }
  return result
}
const parameterExpression = (parameter) => {
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
const rememberPath = (name, path) => {
  const paths = namedPaths.get(name) ?? new Set()
  paths.add(path.join(' > '))
  namedPaths.set(name, paths)
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
  if (name) rememberPath(name, [context.sheet, ...nextTrail])
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
  schemaVersion: 4,
  source: {
    eventTree: 'data.json',
    runtime: 'scripts/c3runtime.js',
  },
  arrayReferences,
  trackedArrays: fieldUsageArrays,
  summary: fieldUsageSummary,
  usages: fieldUsages,
  targetedCitySaveUsages: citySaveUsages,
  unresolved: unresolvedFieldUsages,
}

const formulaCategories = [
  ['faction', /势力|阵营|贡献|声望|招募角色|学习技能|物品兑换/],
  ['town', /场景|地点|城镇|酒馆|商会|市集|铁匠|武馆/],
  ['city-core', /城市|土地|地块|建筑|扩建|项目|迁移/],
  ['company', /公司|财务|租金|职位|资产|收支/],
  ['industry', /经营|科研|科技|建造|锻造|合成|展览|仓库|修习|驯养|教育|派遣|资源池|职业进阶|灵兽|兽决|命石|淬炼|洗练/],
]
const formulaIndex = Object.fromEntries(formulaCategories.map(([category, pattern]) => [
  category,
  parsedFunctions.filter((item) => pattern.test(item.name)),
]))

const versionText = String(arrays.gg[2]?.[0] ?? '')
const version = versionText.match(/版本号([^\[]+)/)?.[1]?.trim() ?? 'unknown'
const factionBySourceId = new Map(factions.map((faction) => [faction.sourceId, faction]))
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
    buildings: buildings.length,
    technologies: technologies.length,
  },
  functionNames: Object.fromEntries(functionNames),
  factions,
  worldHubs,
  publicLocations,
  factionTowns,
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

const markdownCell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
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
- 非空建筑：${buildings.length}
- 科技：${technologies.length}

## 文件

- \`manifest.json\`：原版记录、跨表关系、原始城市表、源文件指纹与运行时索引。
- \`field-dictionary.md\`：逐列字段状态；未知列保留原始值，不猜测语义。
- \`field-usage-index.json\`：从事件树和运行时表达式函数提取的逐次字段读写证据。
- \`field-usage-index.md\`：按表和固定列汇总的人工审阅索引。
- \`city-layout.md\`：\`cscz\` 的 18×18 城市地块压缩布局与存档字段。
- \`formula-index.md\`：从原版事件表和 \`_all_func_names.txt\` 定位的相关函数入口。
- \`save-contract.md\`：新存档共享状态边界。
- \`verification-checklist.md\`：开发前仍需完成的运行时与实机核验。
- \`egg-jianghu/src/content/original-towns.generated.ts\`：运行时使用的主城、公共场所与势力城镇快照。

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
  console.log('原版势力、城镇与城市经营真值包已是最新')
} else {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const [name, content] of Object.entries(outputs)) {
    writeFileSync(join(OUT_DIR, name), content, 'utf8')
  }
  mkdirSync(dirname(RUNTIME_TOWNS_FILE), { recursive: true })
  writeFileSync(RUNTIME_TOWNS_FILE, runtimeTownsSource, 'utf8')
  console.log(`已生成真值包：势力 ${factions.length}、主城 ${worldHubs.length}、公共场所 ${publicLocations.length}、势力城镇 ${factionTowns.length}`)
  console.log(`城市数据：建筑 ${buildings.length}、科技 ${technologies.length}；运行时索引 ${parsedFunctions.length} 条中筛选相关入口`)
}
