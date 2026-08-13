// 生成脚本：从诸天刷宝录解包数据导出位面怪物内容表与立绘
// 用法：node scripts/generate-zhutian-enemies.mjs
// 前置：scripts/tmp/zhutian-sheets/ 已解压 角色形象-sheet*.webp（见 brainstorm 文档）
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const HERE = dirname(fileURLToPath(import.meta.url))
// 数据必须与 package.nw 同版本（_analysis 是旧版 dump，帧坐标已错位），统一用包内解出的副本
const ZT_ROOT = join(HERE, 'tmp/zhutian-pkg').replaceAll('\\', '/')
const SHEET_DIR = join(HERE, 'tmp/zhutian-sheets')
const ASSET_DIR = join(HERE, '../src/assets/enemies/zt')
const CONTENT_FILE = join(HERE, '../src/content/enemies.ts')

const loadC2 = (name) => JSON.parse(readFileSync(`${ZT_ROOT}/${name}.json`, 'utf8')).data.map((col) => col.map((cell) => cell[0]))

const sq = loadC2('sq')
const dr = loadC2('dr')
const drsx = loadC2('drsx')

// ---------- 解析 data.json 角色形象动画帧 ----------
const data = JSON.parse(readFileSync(`${ZT_ROOT}/data.json`, 'utf8'))
let objectNode = null
const visit = (node) => {
  if (objectNode || node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    if (node[0] === '角色形象' && node.length > 8) {
      objectNode = node
      return
    }
    for (const child of node) visit(child)
  } else {
    for (const child of Object.values(node)) visit(child)
  }
}
visit(data)
if (!objectNode) throw new Error('data.json 中未找到「角色形象」对象')

const isFrame = (f) => Array.isArray(f) && typeof f[0] === 'string' && f[0].startsWith('images/')
const isAnimation = (a) => Array.isArray(a) && typeof a[0] === 'string' && Array.isArray(a[a.length - 1]) && a[a.length - 1].every(isFrame)
let animations = null
const findAnims = (node) => {
  if (animations || !Array.isArray(node)) return
  if (node.length > 0 && node.every(isAnimation)) {
    animations = node
    return
  }
  for (const child of node) if (Array.isArray(child)) findAnims(child)
}
findAnims(objectNode)
if (!animations) throw new Error('未找到角色形象动画数组')

const frameByKey = new Map()
for (const anim of animations) {
  const frame = anim[anim.length - 1][0]
  frameByKey.set(String(anim[0]), {
    sheet: frame[0].replace(/^images\//, ''),
    x: frame[2],
    y: frame[3],
    w: frame[4],
    h: frame[5],
    // C3 spritesheet 旋转 90° 存放的帧：存储区域宽高对调，切出后需转回
    rotated: frame[6] === true,
  })
}

// ---------- 收集 13 位面 × 10 地点的怪物 ----------
// sq 列：0 id、1 地点名、2 位面、3-7 五小怪 dr id、8 首领 dr id、13 位面内序号
// dr 列：0 id、1 名、2 形象（数字或名）、3 drsx 模板、5 类别、12 位面
// drsx 六维推断映射：[生命, 物攻, 物防, 法防, 法攻, 速度]（甲兵血厚防高、弓手物攻高、参谋/中医法攻高速度快）
const growthOf = (templateId) => {
  const row = drsx[templateId]
  if (!row) throw new Error(`drsx 模板 ${templateId} 不存在`)
  return [row[2], row[3], row[4], row[5], row[6], row[7]]
}

const enemyOf = (drId) => {
  const row = dr[drId]
  if (!row) throw new Error(`dr#${drId} 不存在`)
  return { drId, name: String(row[1]), imageKey: String(row[2]), growth: growthOf(row[3]) }
}

const groups = []
for (let x = 1; x < sq.length; x++) {
  const row = sq[x]
  const world = row[2]
  const stage = row[13]
  if (typeof world !== 'number' || world < 1 || world > 13) continue
  if (typeof stage !== 'number' || stage < 1 || stage > 10) continue
  groups.push({
    worldId: `world_${String(world).padStart(2, '0')}`,
    stage,
    stageName: String(row[1]),
    mobs: [row[3], row[4], row[5], row[6], row[7]].map(enemyOf),
    boss: enemyOf(row[8]),
  })
}

const byWorld = new Map()
for (const group of groups) {
  byWorld.set(group.worldId, (byWorld.get(group.worldId) ?? 0) + 1)
}
console.log('位面地点分布：', JSON.stringify([...byWorld.entries()]))
if (groups.length !== 130) throw new Error(`预期 130 个位面地点，实际 ${groups.length}`)

// ---------- 切图 ----------
mkdirSync(ASSET_DIR, { recursive: true })
const allEnemies = groups.flatMap((group) => [...group.mobs, group.boss])
const uniqueByDrId = [...new Map(allEnemies.map((enemy) => [enemy.drId, enemy])).values()]
console.log('唯一怪物数：', uniqueByDrId.length)

const sheetSizeCache = new Map()
const sheetSize = async (sheet) => {
  if (!sheetSizeCache.has(sheet)) {
    const meta = await sharp(join(SHEET_DIR, sheet)).metadata()
    sheetSizeCache.set(sheet, { width: meta.width, height: meta.height })
  }
  return sheetSizeCache.get(sheet)
}

let cut = 0
let rotatedCount = 0
for (const enemy of uniqueByDrId) {
  const frame = frameByKey.get(enemy.imageKey)
  if (!frame) throw new Error(`${enemy.name} 形象 ${enemy.imageKey} 无动画帧`)
  const { width, height } = await sheetSize(frame.sheet)
  const storedW = frame.rotated ? frame.h : frame.w
  const storedH = frame.rotated ? frame.w : frame.h
  if (frame.x + storedW > width || frame.y + storedH > height) {
    throw new Error(`${enemy.name} 帧越界：${frame.sheet} (${frame.x},${frame.y},${storedW},${storedH}) rotated=${frame.rotated}`)
  }
  if (frame.rotated) rotatedCount += 1
  const out = join(ASSET_DIR, `zt_${enemy.drId}.webp`)
  let image = sharp(join(SHEET_DIR, frame.sheet))
    .extract({ left: frame.x, top: frame.y, width: storedW, height: storedH })
  if (frame.rotated) image = image.rotate(-90)
  await image.webp({ quality: 82 }).toFile(out)
  cut += 1
}
console.log('切图完成：', cut, '，其中旋转帧：', rotatedCount)

// ---------- 生成内容表 ----------
const enemyLiteral = (enemy) =>
  `{ drId: ${enemy.drId}, name: '${enemy.name.replace(/'/g, "\\'")}', growth: [${enemy.growth.join(', ')}] }`

const lines = []
lines.push('// 本文件由 scripts/generate-zhutian-enemies.mjs 从《诸天刷宝录》解包数据生成，请勿手改。')
lines.push('// 数据源：sq.json（地点 → 5 小怪 + 1 首领）、dr.json（怪物图鉴）、drsx.json（六维成长模板）。')
lines.push('')
lines.push('export interface EnemyDefinition {')
lines.push('  /** 原版 dr 图鉴 id，同时是立绘文件名 zt_{drId}.webp */')
lines.push('  drId: number')
lines.push('  name: string')
lines.push('  /** 六维成长系数（生命/物攻/物防/法防/法攻/速度，基准 100），推断自诸天 drsx 模板 */')
lines.push('  growth: readonly [number, number, number, number, number, number]')
lines.push('}')
lines.push('')
lines.push('export interface StageEnemyGroup {')
lines.push('  /** 本关 5 种普通小怪 */')
lines.push('  mobs: readonly [EnemyDefinition, EnemyDefinition, EnemyDefinition, EnemyDefinition, EnemyDefinition]')
lines.push('  /** 本关首领 */')
lines.push('  boss: EnemyDefinition')
lines.push('}')
lines.push('')
lines.push('export const STAGE_ENEMIES: Readonly<Record<string, StageEnemyGroup>> = {')
for (const group of groups) {
  lines.push(`  // ${group.worldId} 第 ${group.stage} 关 · ${group.stageName}`)
  lines.push(`  '${group.worldId}:${group.stage}': {`)
  lines.push('    mobs: [')
  for (const mob of group.mobs) lines.push(`      ${enemyLiteral(mob)},`)
  lines.push('    ],')
  lines.push(`    boss: ${enemyLiteral(group.boss)},`)
  lines.push('  },')
}
lines.push('}')
lines.push('')
lines.push('export const stageEnemyGroup = (worldId: string, stage: number): StageEnemyGroup | undefined =>')
lines.push('  STAGE_ENEMIES[`${worldId}:${stage}`]')
lines.push('')

writeFileSync(CONTENT_FILE, lines.join('\n'), 'utf8')
console.log('内容表已生成：', CONTENT_FILE)
