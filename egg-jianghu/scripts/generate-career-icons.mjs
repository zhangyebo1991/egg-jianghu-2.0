import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '../../../诸天刷宝录/_analysis')
const data = JSON.parse(readFileSync(resolve(source, 'data.json'), 'utf8'))
const rows = JSON.parse(readFileSync(resolve(source, 'zy.json'), 'utf8')).data.map(row => row.map(cell => cell[0]))
let object
const walk = node => {
  if (!Array.isArray(node) || object) return
  if (node[0] === '职业标识' && node.length > 8) { object = node; return }
  node.forEach(walk)
}
walk(data.project)
let animations
const isFrame = frame => Array.isArray(frame) && typeof frame[0] === 'string' && frame[0].startsWith('images/')
const isAnimation = animation => Array.isArray(animation) && typeof animation[0] === 'string'
  && Array.isArray(animation.at(-1)) && animation.at(-1).length > 0 && animation.at(-1).every(isFrame)
const find = node => {
  if (!Array.isArray(node) || animations) return
  if (node.length && node.every(isAnimation)) { animations = node; return }
  node.forEach(find)
}
find(object)
if (!animations) throw Error('未找到原版职业标识动画')
const frames = new Map(animations.map(animation => [animation[0], animation.at(-1)[0]]))
const careers = rows.filter(row => typeof row[1] === 'string' && row[1].trim()).map(row => ({ id: Number(row[0]), name: row[1], iconKey: String(row[2]) }))
const missing = careers.filter(career => !frames.has(career.iconKey))
if (missing.length) throw Error('原版职业标识缺失：' + JSON.stringify(missing))
const iconFrame = career => frames.get(career.iconKey)
const sheets = resolve(here, 'tmp/career-icon-sheets')
mkdirSync(sheets, { recursive: true })
const sheetNames = [...new Set(careers.map(career => iconFrame(career)[0]))]
execFileSync('python', ['-X', 'utf8', '-c', `import zipfile,sys,json,pathlib
with zipfile.ZipFile(sys.argv[1]) as package:
 for name in json.loads(sys.argv[3]):
  pathlib.Path(sys.argv[2],pathlib.PurePosixPath(name).name).write_bytes(package.read(name))`, resolve(source, '../.nw'), sheets, JSON.stringify(sheetNames)], { stdio: 'pipe' })
const out = resolve(here, '../src/assets/careers/original')
mkdirSync(out, { recursive: true })
const entries = []
for (const career of careers) {
  const frame = iconFrame(career)
  const rotated = frame[6] === true
  const crop = { left: frame[2], top: frame[3], width: rotated ? frame[5] : frame[4], height: rotated ? frame[4] : frame[5] }
  let image = sharp(resolve(sheets, basename(frame[0]))).extract(crop)
  if (rotated) image = image.rotate(-90)
  const buffer = await image.webp({ lossless: true }).toBuffer()
  writeFileSync(resolve(out, `career_${career.id}.webp`), buffer)
  entries.push({ ...career, fallback: !frames.has(career.iconKey), sheet: frame[0], crop, rotated, sha256: createHash('sha256').update(buffer).digest('hex') })
}
const evidence = {
  mapping: 'zy.json 第2列匹配职业标识动画名，提取第0帧',
  sourceHashes: Object.fromEntries(['data.json', 'zy.json'].map(name => [name, createHash('sha256').update(readFileSync(resolve(source, name))).digest('hex')])),
  careerCount: careers.length,
  uniqueIconCount: new Set(careers.filter(career => frames.has(career.iconKey)).map(career => career.iconKey)).size,
  missingCareerIds: missing.map(career => career.id),
  entries,
}
writeFileSync(resolve(here, '../../docs/evidence/original-world/career-icons-assets.json'), JSON.stringify(evidence, null, 2) + '\n')
console.log(`提取 ${careers.length} 个职业图标，独立图标 ${evidence.uniqueIconCount} 种，无缺失`)
