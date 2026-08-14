// 生成脚本：从诸天 wp.json / sq.json / dl.json / tz.json / zbct.json / shili.json 导出战斗可掉落装备。
// 普通底模：档位(col4)=1、部位 1–8、六风格族。档位 7 探索具名装不进击杀池。
// 地点普通池：sq.col3–7 → dl 列、行 1–3（黄巾=铁爪/长戟等，不含联军讨董列的铁盾）。
// 地点套装：sq.col8 → dl 列两件套（黄巾=鬼谋），只掉部件、不算套装效果。
// 用法：node scripts/generate-zhutian-equipment.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CANDIDATES = [
  join(HERE, 'tmp/zhutian-pkg/wp.json'),
  'D:/Projects/OpenProject/花旦的各种小游戏/挂机游戏/诸天刷宝录/_analysis/wp.json',
]
const WP_FILE = CANDIDATES.find((path) => existsSync(path))
if (!WP_FILE) throw new Error('找不到 wp.json，请先解包诸天数据或保留 _analysis/wp.json')
const sibling = (name) => WP_FILE.replace(/wp\.json$/i, name)
for (const name of ['tz.json', 'sq.json', 'dl.json', 'zbct.json', 'shili.json']) {
  if (!existsSync(sibling(name))) throw new Error(`找不到 ${name}：${sibling(name)}`)
}

const OUT_FILE = join(HERE, '../src/content/equipment-generated.ts')

const SLOT_BY_ID = {
  1: 'weapon',
  2: 'offhand',
  3: 'head',
  4: 'armor',
  5: 'wrist',
  6: 'boots',
  7: 'necklace',
  8: 'ring',
}

const WEAPON_TYPE_NAMES = {
  1: '长柄',
  2: '刀剑',
  3: '拳指',
  4: '暗器',
  5: '法杖',
  6: '法球',
  7: '枪弩',
  8: '大炮',
  9: '书卷',
  10: '仪器',
  11: '盾牌',
  12: '匕首',
  13: '符箓',
  14: '箭袋',
  15: '针盒',
  16: '重甲',
  17: '皮甲',
  18: '布甲',
  20: '物攻饰品',
  21: '法攻饰品',
}

const STYLE_FAMILIES = ['中式古代', '江湖', '西方', '日式', '近代', '未来']

// 原版 `装备基础核心属性function`，格式为 [属性 id, 模板系数]。
const WEAPON_CORE_STATS = {
  1: [[8, 180], [6, 80]],
  2: [[8, 220], [20, 100]],
  3: [[8, 200], [12, 100]],
  4: [[8, 210], [37, 100]],
  5: [[10, 220], [22, 100]],
  6: [[10, 200], [13, 100]],
  7: [[8, 230], [7, 100]],
  8: [[8, 240], [10, 240]],
  9: [[10, 180], [34, 100]],
  10: [[10, 190], [16, 100]],
  11: [[6, 80], [21, 100]],
  12: [[8, 40], [13, 100]],
  13: [[10, 40], [12, 100]],
  14: [[8, 40], [18, 100]],
  15: [[10, 40], [23, 100]],
}

const ARMOR_CORE_STATS = {
  head: {
    16: [[9, 120], [11, 80]],
    17: [[9, 100], [11, 100]],
    18: [[9, 80], [11, 120]],
  },
  armor: {
    16: [[6, 120], [9, 120]],
    17: [[6, 100], [9, 100]],
    18: [[6, 80], [9, 80]],
  },
  wrist: {
    16: [[6, 120], [11, 80]],
    17: [[6, 100], [11, 100]],
    18: [[6, 80], [11, 120]],
  },
  boots: {
    16: [[7, 80], [6, 120]],
    17: [[7, 120], [6, 100]],
    18: [[7, 100], [6, 80]],
  },
}

const ACCESSORY_CORE_STATS = {
  necklace: {
    20: [[8, 40], [19, 200]],
    21: [[10, 40], [19, 200]],
  },
  ring: {
    20: [[8, 40], [18, 200]],
    21: [[10, 40], [18, 200]],
  },
}

const loadTable = (path) => JSON.parse(readFileSync(path, 'utf8')).data.map((col) => col.map((cell) => cell[0]))

const familyOf = (style) => STYLE_FAMILIES.find((family) => String(style).startsWith(family)) ?? null

const quote = (value) => JSON.stringify(value)

const wp = loadTable(WP_FILE)
const tz = loadTable(sibling('tz.json'))
const sq = loadTable(sibling('sq.json'))
const zbct = loadTable(sibling('zbct.json'))
const shili = loadTable(sibling('shili.json'))
const dlRaw = JSON.parse(readFileSync(sibling('dl.json'), 'utf8'))

const dlAt = (row, col) => Number(dlRaw.data[row]?.[col]?.[0] ?? 0)

const coreStatsFor = (slot, weaponType) => {
  const source = WEAPON_CORE_STATS[weaponType]
    ?? ARMOR_CORE_STATS[slot]?.[weaponType]
    ?? ACCESSORY_CORE_STATS[slot]?.[weaponType]
  if (!source) throw new Error(`缺少 ${slot}/${weaponType} 的核心属性映射`)
  return source.map(([attributeId, baseCoefficient]) => ({ attributeId, baseCoefficient }))
}

const affixPoolFor = (weaponType) => {
  const pool = zbct
    .map((row) => Number(row[weaponType]))
    .filter((attributeId) => attributeId >= 6 && attributeId <= 59)
  if (pool.length === 0) throw new Error(`zbct.json 装备类型 ${weaponType} 的附词条池为空`)
  return pool
}

const equipmentStats = (slot, weaponType) => ({
  coreStats: coreStatsFor(slot, weaponType),
  affixPool: affixPoolFor(weaponType),
})

const items = []
for (let index = 1; index < wp.length; index += 1) {
  const row = wp[index]
  const id = Number(row[0])
  const name = String(row[1] ?? '').trim()
  const style = String(row[2] ?? '')
  const category = String(row[5] ?? '')
  const slotId = Number(row[6])
  const weaponType = Number(row[7]) || 0
  const grade = Number(row[4])
  const rarity = String(row[9] ?? '')
  const slot = SLOT_BY_ID[slotId]
  const styleFamily = familyOf(style)
  if (category !== '装备' || !slot || !styleFamily) continue
  if (grade !== 1) continue
  if (rarity !== '普通' && rarity !== '特殊') continue
  if (!name || name === '无' || name.startsWith('圣阶') || style.startsWith('圣阶')) continue
  items.push({
    id: `wp_${id}`,
    name,
    slot,
    weaponType,
    weaponTypeName: WEAPON_TYPE_NAMES[weaponType] ?? '未知',
    styleFamily,
    rarity,
    ...equipmentStats(slot, weaponType),
    ...(rarity === '特殊' ? { fixedQuality: grade } : {}),
  })
}

const toItem = (row, extra = {}) => {
  const id = Number(row[0])
  const name = String(row[1] ?? '').trim()
  const style = String(row[2] ?? '')
  const slotId = Number(row[6])
  const weaponType = Number(row[7]) || 0
  const slot = SLOT_BY_ID[slotId]
  const styleFamily = familyOf(style)
  if (!id || !name || !slot || !styleFamily) return null
  const fixedQuality = Number(row[4])
  const setFactionId = Number(row[29]) || 0
  const setElement = Number(shili[setFactionId]?.[22]) || 0
  return {
    id: `wp_${id}`,
    name,
    slot,
    weaponType,
    weaponTypeName: WEAPON_TYPE_NAMES[weaponType] ?? '未知',
    styleFamily,
    rarity: String(row[9] ?? '套装'),
    ...equipmentStats(slot, weaponType),
    fixedQuality,
    setFactionId,
    setElement,
    ...extra,
  }
}

const tzByWp = new Map()
for (let index = 1; index < tz.length; index += 1) {
  const row = tz[index]
  const setName = String(row[1] ?? '').trim()
  if (!setName) continue
  for (const col of [11, 12, 13, 14, 15, 16, 17, 18]) {
    const wpId = Number(row[col])
    if (wpId) tzByWp.set(wpId, { setName, pieces: Number(row[2]), tzId: Number(row[0]) })
  }
}

const ordinaryIdsByStage = {}
const setIdsByStage = {}
const setNameByStage = {}
const setItems = []

for (let sqId = 1; sqId <= 130; sqId += 1) {
  const row = sq[sqId]
  if (!row) throw new Error(`sq.json 缺少地点 ${sqId}`)
  const worldIndex = Number(row[2])
  const stage = Number(row[13])
  const worldId = `world_${String(worldIndex).padStart(2, '0')}`
  const key = `${worldId}:${stage}`
  const ordinaryCols = [3, 4, 5, 6, 7].map((col) => Number(row[col]))
  const setCol = Number(row[8])
  const ordinaryIds = []
  for (const col of ordinaryCols) {
    for (let dlRow = 1; dlRow <= 3; dlRow += 1) {
      const wpId = dlAt(dlRow, col)
      if (!wpId) continue
      const item = wp[wpId] ? toItem(wp[wpId]) : null
      if (!item || item.rarity !== '普通') continue
      if (!items.some((entry) => entry.id === item.id)) items.push(item)
      if (!ordinaryIds.includes(item.id)) ordinaryIds.push(item.id)
    }
  }
  if (ordinaryIds.length === 0) throw new Error(`${key} sq${sqId} 普通池为空`)
  ordinaryIdsByStage[key] = ordinaryIds

  const setIds = []
  let setName = ''
  for (let dlRow = 1; dlRow < dlRaw.size[0]; dlRow += 1) {
    const wpId = dlAt(dlRow, setCol)
    if (!wpId) continue
    const meta = tzByWp.get(wpId)
    const item = wp[wpId] ? toItem(wp[wpId], { setName: meta?.setName, worldId, stage }) : null
    if (!item || String(wp[wpId][9]) !== '套装' || !meta?.setName) continue
    if (meta.pieces !== 2) continue
    if (!setName) setName = meta.setName
    if (meta.setName !== setName) throw new Error(`${key} dl列${setCol} 混入套装 ${meta.setName}`)
    if (!setItems.some((entry) => entry.id === item.id)) setItems.push(item)
    if (!setIds.includes(item.id)) setIds.push(item.id)
  }
  if (setIds.length !== 2) throw new Error(`${key} 套装 ${setName || '?'} 不是两件：${setIds.join(',')}`)
  setIdsByStage[key] = setIds
  setNameByStage[key] = setName
}

if (Object.keys(setIdsByStage).length !== 130) throw new Error('地点套装不是 13×10')
if (items.length === 0) throw new Error('未筛出可掉落装备')

const idsByStyle = Object.fromEntries(STYLE_FAMILIES.map((family) => [
  family,
  items.filter((item) => item.styleFamily === family).map((item) => item.id),
]))

for (const family of STYLE_FAMILIES) {
  const pool = items.filter((item) => item.styleFamily === family)
  for (const slot of Object.values(SLOT_BY_ID)) {
    if (!pool.some((item) => item.slot === slot)) {
      throw new Error(`${family} 缺少 ${slot} 装备`)
    }
  }
}

const lines = [
  '// 由 scripts/generate-zhutian-equipment.mjs 从诸天 wp/sq/dl/tz/zbct/shili 生成，请勿手改。',
  '// 地点普通池 = sq.col3–7 → dl 行1–3；地点套装 = sq.col8 → dl 两件套。',
  '',
  'export const GENERATED_EQUIPMENT = [',
  ...items.map((item) => '  ' + JSON.stringify(item) + ','),
  '] as const',
  '',
  'export const GENERATED_EQUIPMENT_IDS_BY_STYLE = {',
  ...STYLE_FAMILIES.map((family) => `  ${quote(family)}: ${JSON.stringify(idsByStyle[family])},`),
  '} as const',
  '',
  'export const GENERATED_ORDINARY_IDS_BY_STAGE = {',
  ...Object.entries(ordinaryIdsByStage).map(([key, ids]) => `  ${quote(key)}: ${JSON.stringify(ids)},`),
  '} as const',
  '',
  'export const GENERATED_SET_EQUIPMENT = [',
  ...setItems.map((item) => '  ' + JSON.stringify(item) + ','),
  '] as const',
  '',
  'export const GENERATED_SET_IDS_BY_STAGE = {',
  ...Object.entries(setIdsByStage).map(([key, ids]) => `  ${quote(key)}: ${JSON.stringify(ids)},`),
  '} as const',
  '',
  'export const GENERATED_SET_NAME_BY_STAGE = {',
  ...Object.entries(setNameByStage).map(([key, name]) => `  ${quote(key)}: ${quote(name)},`),
  '} as const',
  '',
]

mkdirSync(dirname(OUT_FILE), { recursive: true })
writeFileSync(OUT_FILE, lines.join('\n'), 'utf8')
console.log(`已生成 ${items.length} 件普通底模 + ${setItems.length} 件地点套装 → ${OUT_FILE}`)
console.log(STYLE_FAMILIES.map((family) => `${family} ${idsByStyle[family].length}`).join(' · '))
console.log(`黄巾普通 ${ordinaryIdsByStage['world_01:1'].join(',')} · 套装 ${setNameByStage['world_01:1']} ${setIdsByStage['world_01:1'].join(',')}`)
console.log(`数据源 ${WP_FILE}`)
