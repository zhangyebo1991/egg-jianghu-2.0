// 生成脚本：从诸天刷宝录解包数据导出战斗技能表、buff 表与召唤物（含立绘）
// 用法：node scripts/generate-zhutian-skills.mjs
// 前置：scripts/tmp/zhutian-pkg/ 已解出 jn/fw/buff/js/zy/sq/dr/data.json；tmp/zhutian-sheets/ 已解压合图
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = join(HERE, 'tmp/zhutian-pkg')
const SHEET_DIR = join(HERE, 'tmp/zhutian-sheets')
const ASSET_DIR = join(HERE, '../src/assets/enemies/zt')
const SKILLS_FILE = join(HERE, '../src/content/skills.ts')
const BUFFS_FILE = join(HERE, '../src/content/buffs.ts')

const load = (name, root = PKG) => JSON.parse(readFileSync(join(root, `${name}.json`), 'utf8')).data.map((col) => col.map((cell) => cell[0]))

const jn = load('jn')
const fw = load('fw')
const buff = load('buff')
const js = load('js')
const zy = load('zy')
const sq = load('sq')
const dr = load('dr')
const zh = load('zh')

// ---------- 收集被引用技能 ----------
const usedSkillIds = new Set()
const jsByName = new Map()
for (let x = 1; x < js.length; x += 1) jsByName.set(String(js[x][1]), js[x])

for (let x = 1; x < sq.length; x += 1) {
  const world = sq[x][2]
  const stage = sq[x][13]
  if (typeof world !== 'number' || world < 1 || world > 13) continue
  if (typeof stage !== 'number' || stage < 1 || stage > 10) continue
  for (const col of [3, 4, 5, 6, 7]) {
    usedSkillIds.add(zy[dr[sq[x][col]][3]][6])
  }
  const bossRow = jsByName.get(String(dr[sq[x][8]][1]))
  usedSkillIds.add(zy[bossRow[4]][6])
  for (const col of [28, 29, 30, 31]) {
    const id = bossRow[col]
    if (typeof id === 'number' && id > 0) usedSkillIds.add(id)
  }
}
// 玩家 41 职业普攻
for (let x = 1; x < zy.length; x += 1) {
  const id = zy[x]?.[6]
  if (typeof id === 'number' && id > 0) usedSkillIds.add(id)
}

// ---------- 技能翻译 ----------
const BEHAVIORS = {
  近战攻击: { behavior: 'attack', side: 'enemy', reach: 'melee' },
  远程攻击: { behavior: 'attack', side: 'enemy', reach: 'ranged' },
  生命治疗: { behavior: 'heal', side: 'ally', reach: 'ranged' },
  自身治疗: { behavior: 'heal', side: 'ally', reach: 'ranged' },
  自身护盾: { behavior: 'shield', side: 'ally', reach: 'ranged' },
  自身状态: { behavior: 'status', side: 'ally', reach: 'ranged' },
  我方状态: { behavior: 'status', side: 'ally', reach: 'ranged' },
  我方复活: { behavior: 'revive', side: 'ally', reach: 'ranged' },
  我方进度: { behavior: 'advance-gauge', side: 'ally', reach: 'ranged' },
  增加能量: { behavior: 'grant-energy', side: 'ally', reach: 'ranged' },
  自身增加能量: { behavior: 'grant-energy', side: 'ally', reach: 'ranged' },
  召唤: { behavior: 'summon', side: 'ally', reach: 'ranged' },
  被动技能: { behavior: 'passive', side: 'ally', reach: 'ranged' },
}

const routeOf = (value) => value === '物理' ? 'external' : value === '法术' ? 'internal' : 'support'

// fw 范围 → 形状：按类型 + 覆盖数近似（十字/九宫等统一为从主目标邻近扩散）
const rangeOf = (skill, behavior) => {
  if (behavior === 'passive') return { kind: 'self', count: 1 }
  const fwRow = fw[skill[37]]
  if (!fwRow) return { kind: 'single', count: 1 }
  const count = Number(fwRow[20]) || 1
  if (count >= 15) return { kind: 'all', count: 15 }
  if (count <= 1) {
    // 自身向行为（自身护盾/自身状态/自身治疗/自身加能）单格即施加给自己
    if (['自身护盾', '自身状态', '自身治疗', '自身增加能量'].includes(String(skill[15]))) return { kind: 'self', count: 1 }
    return { kind: 'single', count: 1 }
  }
  return { kind: 'spread', count }
}

const skills = []
const advanceGaugeSamples = []
for (const id of [...usedSkillIds].sort((a, b) => a - b)) {
  const row = jn[id]
  if (!row) throw new Error(`jn#${id} 不存在`)
  const mapping = BEHAVIORS[String(row[15])]
  if (!mapping) {
    console.log(`跳过无行为技能 jn#${id} ${row[1]}（行为="${row[15]}"）`)
    continue
  }
  const powerPercent = (typeof row[16] === 'number' && row[16] > 0 ? row[16] : Number(row[29])) || 100
  const range = rangeOf(row, mapping.behavior)
  const skill = {
    id,
    name: String(row[1]),
    behavior: mapping.behavior,
    targetSide: mapping.side,
    route: routeOf(String(row[26])),
    element: Number(row[5]) || 0,
    powerPercent,
    energyCost: Number(row[19]) || 0,
    cooldownMs: (Number(row[19]) || 0) * 4000,
    hits: Math.max(1, Number(row[36]) || 1),
    rangeKind: range.kind,
    rangeCount: range.count,
    reach: mapping.reach,
    skillCategory: Number(row[4]) || 0,
    appliedBuffId: typeof row[21] === 'number' && row[21] > 0 ? row[21] : null,
    appliedBuffChance: typeof row[22] === 'number' && row[22] > 0 ? row[22] / 100 : null,
    appliedBuffStacks: typeof row[24] === 'number' && row[24] > 0 ? row[24] : 1,
    enhanceBuffId: typeof row[41] === 'number' && row[41] > 0 ? row[41] : null,
    enhancePerStack: typeof row[42] === 'number' ? row[42] : 0,
    summonId: mapping.behavior === 'summon' ? Number(row[51]) || 0 : null,
    passiveAttributes: mapping.behavior === 'passive'
      ? [[row[8], row[9]], [row[10], row[11]]].filter(([sxId, value]) => typeof sxId === 'number' && sxId > 0 && typeof value === 'number' && value !== 0)
      : [],
  }
  skills.push(skill)
  if (skill.behavior === 'advance-gauge') advanceGaugeSamples.push(`${skill.name}: 16=${row[16]} 25=${row[25]} 29=${row[29]}`)
}
console.log('导出技能数：', skills.length)
console.log('推条技能关键列：', advanceGaugeSamples.join(' | '))

// ---------- buff 翻译 ----------
const buffs = []
for (let x = 1; x < buff.length; x += 1) {
  const row = buff[x]
  if (!row || !String(row[1]).trim()) continue
  const attributes = [[row[3], row[6]], [row[4], row[7]]]
    .filter(([sxId, value]) => typeof sxId === 'number' && sxId > 0 && typeof value === 'number' && value !== 0)
  const desc = String(row[13] ?? '')
  const polarity = String(row[12]) === '增益' ? 'buff' : 'debuff'
  const kind = attributes.length > 0
    ? 'attribute'
    : desc.includes('每秒') && polarity === 'debuff'
      ? 'dot'
      : desc.includes('每秒') && polarity === 'buff'
        ? 'hot'
        : 'marker'
  buffs.push({
    id: Number(row[0]),
    name: String(row[1]),
    polarity,
    kind,
    attributes,
    maxStacks: Math.max(1, Number(row[9]) || 1),
    durationMs: Math.max(1000, (Number(row[10]) || 1) * 1000),
    unit: String(row[11]) === '回合' ? 'turn' : 'time',
  })
}
console.log('导出 buff 数：', buffs.length)

// ---------- 召唤物 ----------
// zh 列：0 id、1 名、3 形象 key、5-10 六维系数（生命/物攻/物防/法防/法攻/速度）、11 召唤时间秒、12 物攻系/法攻系
const summons = []
for (let x = 1; x < zh.length; x += 1) {
  const row = zh[x]
  if (!row || !String(row[1]).trim()) continue
  summons.push({
    id: Number(row[0]),
    name: String(row[1]),
    imageKey: String(row[3]),
    coeffs: [row[5], row[6], row[7], row[8], row[9], row[10]].map((value) => Number(value) || 100),
    durationMs: (Number(row[11]) || 30) * 1000,
    route: String(row[12]).includes('法') ? 'internal' : 'external',
  })
}
console.log('召唤物：', summons.map((summon) => `${summon.id}=${summon.name}(形象${summon.imageKey})`).join(', '))

// ---------- 召唤物立绘切图 ----------
const data = JSON.parse(readFileSync(join(PKG, 'data.json'), 'utf8'))
let objectNode = null
const visit = (node) => {
  if (objectNode || node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    if (node[0] === '角色形象' && node.length > 8) { objectNode = node; return }
    for (const child of node) visit(child)
  } else {
    for (const child of Object.values(node)) visit(child)
  }
}
visit(data)
const isFrame = (f) => Array.isArray(f) && typeof f[0] === 'string' && f[0].startsWith('images/')
const isAnimation = (a) => Array.isArray(a) && typeof a[0] === 'string' && Array.isArray(a[a.length - 1]) && a[a.length - 1].every(isFrame)
let animations = null
const findAnims = (node) => {
  if (animations || !Array.isArray(node)) return
  if (node.length > 0 && node.every(isAnimation)) { animations = node; return }
  for (const child of node) if (Array.isArray(child)) findAnims(child)
}
findAnims(objectNode)
const frameByKey = new Map()
for (const anim of animations) {
  const frame = anim[anim.length - 1][0]
  frameByKey.set(String(anim[0]), {
    sheet: frame[0].replace(/^images\//, ''),
    x: frame[2], y: frame[3], w: frame[4], h: frame[5],
    rotated: frame[6] === true,
  })
}

mkdirSync(ASSET_DIR, { recursive: true })
const summonPortraits = new Set()
for (const summon of summons) {
  const frame = frameByKey.get(summon.imageKey)
  if (!frame) {
    console.log(`召唤物 ${summon.name} 形象 ${summon.imageKey} 无动画帧，使用兜底立绘`)
    continue
  }
  const storedW = frame.rotated ? frame.h : frame.w
  const storedH = frame.rotated ? frame.w : frame.h
  let image = sharp(join(SHEET_DIR, frame.sheet)).extract({ left: frame.x, top: frame.y, width: storedW, height: storedH })
  if (frame.rotated) image = image.rotate(-90)
  await image.webp({ quality: 82 }).toFile(join(ASSET_DIR, `zt_s${summon.id}.webp`))
  summonPortraits.add(summon.id)
}
console.log('召唤物立绘切出：', summonPortraits.size, '/', summons.length)

// ---------- 输出 skills.ts ----------
const quote = (value) => `'${String(value).replace(/'/g, "\\'")}'`
const skillLiteral = (skill) => {
  const parts = [
    `id: ${skill.id}`,
    `name: ${quote(skill.name)}`,
    `behavior: ${quote(skill.behavior)}`,
    `targetSide: ${quote(skill.targetSide)}`,
    `route: ${quote(skill.route)}`,
    `element: ${skill.element}`,
    `powerPercent: ${skill.powerPercent}`,
    `energyCost: ${skill.energyCost}`,
    `cooldownMs: ${skill.cooldownMs}`,
    `hits: ${skill.hits}`,
    `rangeKind: ${quote(skill.rangeKind)}`,
    `rangeCount: ${skill.rangeCount}`,
    `reach: ${quote(skill.reach)}`,
    `skillCategory: ${skill.skillCategory}`,
  ]
  if (skill.appliedBuffId) {
    parts.push(`appliedBuffId: ${skill.appliedBuffId}`, `appliedBuffChance: ${skill.appliedBuffChance ?? 1}`, `appliedBuffStacks: ${skill.appliedBuffStacks}`)
  }
  if (skill.enhanceBuffId) parts.push(`enhanceBuffId: ${skill.enhanceBuffId}`, `enhancePerStack: ${skill.enhancePerStack}`)
  if (skill.summonId) parts.push(`summonId: ${skill.summonId}`)
  if (skill.passiveAttributes.length) {
    parts.push(`passiveAttributes: [${skill.passiveAttributes.map(([sxId, value]) => `{ sxId: ${sxId}, value: ${value} }`).join(', ')}]`)
  }
  return `  ${skill.id}: { ${parts.join(', ')} },`
}

const skillLines = []
skillLines.push('// 本文件由 scripts/generate-zhutian-skills.mjs 从《诸天刷宝录》解包数据生成，请勿手改。')
skillLines.push('// 数据源：jn.json（技能）、fw.json（范围）、zh.json（召唤物）、zy.json（职业普攻）。')
skillLines.push('// 范围翻译：单体/自身/全体保持原义，十字与九宫等按「主目标邻近扩散 N 格」近似。')
skillLines.push('')
skillLines.push("export type SkillBehavior = 'attack' | 'heal' | 'shield' | 'status' | 'revive' | 'advance-gauge' | 'grant-energy' | 'summon' | 'passive'")
skillLines.push("export type SkillRangeKind = 'single' | 'spread' | 'all' | 'self'")
skillLines.push('')
skillLines.push('export interface CombatSkillContent {')
skillLines.push('  /** 原版 jn 表 id */')
skillLines.push('  id: number')
skillLines.push('  name: string')
skillLines.push('  behavior: SkillBehavior')
skillLines.push("  targetSide: 'enemy' | 'ally'")
skillLines.push("  route: 'external' | 'internal' | 'support'")
skillLines.push('  /** 元素 0 无 / 1 雷 / 2 水 / 3 火 / 4 木 / 5 土 / 6 精神 / 7 神圣 / 8 黑暗 */')
skillLines.push('  element: number')
skillLines.push('  /** 威力百分比（技能等级 1）；推条技能表示行动条推进百分比 */')
skillLines.push('  powerPercent: number')
skillLines.push('  /** 能量档 0-5；冷却 = 能量档 × 4 秒 */')
skillLines.push('  energyCost: number')
skillLines.push('  cooldownMs: number')
skillLines.push('  hits: number')
skillLines.push('  rangeKind: SkillRangeKind')
skillLines.push('  rangeCount: number')
skillLines.push("  reach: 'melee' | 'ranged'")
skillLines.push('  /** 技能系（专精乘区 60+cat-1） */')
skillLines.push('  skillCategory: number')
skillLines.push('  appliedBuffId?: number')
skillLines.push('  appliedBuffChance?: number')
skillLines.push('  appliedBuffStacks?: number')
skillLines.push('  /** 增效：施法者身上每层该 buff 提升伤害百分比 */')
skillLines.push('  enhanceBuffId?: number')
skillLines.push('  enhancePerStack?: number')
skillLines.push('  summonId?: number')
skillLines.push('  passiveAttributes?: ReadonlyArray<{ sxId: number; value: number }>')
skillLines.push('}')
skillLines.push('')
skillLines.push('export const COMBAT_SKILLS: Readonly<Record<number, CombatSkillContent>> = {')
for (const skill of skills) skillLines.push(skillLiteral(skill))
skillLines.push('}')
skillLines.push('')
skillLines.push('export const skillById = (id: number): CombatSkillContent | undefined => COMBAT_SKILLS[id]')
skillLines.push('')
skillLines.push('export interface SummonUnitContent {')
skillLines.push('  /** 原版 zh 表 id，立绘文件 zt_s{id}.webp */')
skillLines.push('  id: number')
skillLines.push('  name: string')
skillLines.push('  /** 六维系数（生命/物攻/物防/法防/法攻/速度，%），乘施法者面板 */')
skillLines.push('  coeffs: readonly [number, number, number, number, number, number]')
skillLines.push('  durationMs: number')
skillLines.push("  route: 'external' | 'internal'")
skillLines.push('}')
skillLines.push('')
skillLines.push('export const SUMMON_UNITS: Readonly<Record<number, SummonUnitContent>> = {')
for (const summon of summons) {
  skillLines.push(`  ${summon.id}: { id: ${summon.id}, name: ${quote(summon.name)}, coeffs: [${summon.coeffs.join(', ')}], durationMs: ${summon.durationMs}, route: ${quote(summon.route)} },`)
}
skillLines.push('}')
skillLines.push('')
skillLines.push('// 职业（zy 行号）→ 普攻技能 id')
skillLines.push('export const BASE_SKILL_BY_ZY: Readonly<Record<number, number>> = {')
const zyLines = []
for (let x = 1; x < zy.length; x += 1) {
  const id = zy[x]?.[6]
  if (typeof id === 'number' && id > 0) zyLines.push(`  ${x}: ${id},`)
}
skillLines.push(...zyLines)
skillLines.push('}')
skillLines.push('')
writeFileSync(SKILLS_FILE, skillLines.join('\n'), 'utf8')
console.log('技能表已生成：', SKILLS_FILE)

// ---------- 输出 buffs.ts ----------
const buffLines = []
buffLines.push('// 本文件由 scripts/generate-zhutian-skills.mjs 从《诸天刷宝录》buff.json 生成，请勿手改。')
buffLines.push('')
buffLines.push("export type BuffKind = 'attribute' | 'dot' | 'hot' | 'marker'")
buffLines.push('')
buffLines.push('export interface BuffContent {')
buffLines.push('  id: number')
buffLines.push('  name: string')
buffLines.push("  polarity: 'buff' | 'debuff'")
buffLines.push('  kind: BuffKind')
buffLines.push('  /** 属性修正（sx 属性 id → 修正值）；控制类为 { sxId: 113, value: -100 } */')
buffLines.push('  attributes: ReadonlyArray<{ sxId: number; value: number }>')
buffLines.push('  maxStacks: number')
buffLines.push('  durationMs: number')
buffLines.push("  unit: 'time' | 'turn'")
buffLines.push('}')
buffLines.push('')
buffLines.push('export const COMBAT_BUFFS: Readonly<Record<number, BuffContent>> = {')
for (const item of buffs) {
  const attrs = item.attributes.map(([sxId, value]) => `{ sxId: ${sxId}, value: ${value} }`).join(', ')
  buffLines.push(`  ${item.id}: { id: ${item.id}, name: ${quote(item.name)}, polarity: ${quote(item.polarity)}, kind: ${quote(item.kind)}, attributes: [${attrs}], maxStacks: ${item.maxStacks}, durationMs: ${item.durationMs}, unit: ${quote(item.unit)} },`)
}
buffLines.push('}')
buffLines.push('')
buffLines.push('export const buffById = (id: number): BuffContent | undefined => COMBAT_BUFFS[id]')
buffLines.push('')
writeFileSync(BUFFS_FILE, buffLines.join('\n'), 'utf8')
console.log('buff 表已生成：', BUFFS_FILE)
