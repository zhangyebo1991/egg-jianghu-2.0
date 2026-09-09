// 核对全部普通位面的敌人物品表与地点材料表；运行时不依赖原客户端。
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '../../../诸天刷宝录/_analysis')
const load = (name) => JSON.parse(readFileSync(resolve(source, `${name}.json`), 'utf8')).data.map(r => r.map(c => c[0]))
const [sq, wm, wp, dl] = ['sq', 'wm', 'wp', 'dl'].map(load)
const stages = sq.slice(1).filter(r => r[2] >= 1 && r[2] <= 13 && r[13] >= 1 && r[13] <= 10).map(r => ({
  worldId: `world_${String(r[2]).padStart(2, '0')}`, stage: r[13], name: r[1],
  enemyIds: r.slice(3, 9),
  materials: r.slice(10, 12).filter(Number).map(family => ({
    family, baseQuality: wm[r[2]][22 + family * 2], baseChance: wm[r[2]][23 + family * 2] / 200,
  })),
}))
assert.equal(stages.length, 130)
assert.equal(new Set(stages.map(s => `${s.worldId}:${s.stage}`)).size, 130)
const enemies = Object.fromEntries([...new Set(stages.flatMap(s => s.enemyIds))].map(id => [id,
  dl.slice(1).map(r => Number(r[id]) || 0).filter(Boolean),
]))
const itemIds = [...new Set(Object.values(enemies).flat())]
const items = Object.fromEntries(itemIds.map(id => {
  const r = wp[id]
  assert.ok(r && ['装备', '特殊'].includes(r[5]), `未处理物品 ${id}`)
  if (r[5] === '特殊') assert.ok([5, 6, 7].includes(id), `未处理特殊物品 ${id}`)
  return [id, { id, name: r[1], kind: r[5] === '装备' ? 'equipment' : 'material', chance: r[32] / 10000 }]
}))
const materials = wp.filter(r => r[5] === '材料' && stages.some(s => s.materials.some(m => m.family === r[7]))).map(r => ({
  id: r[0], name: r[1], family: r[7], quality: r[4],
}))
for (const stage of stages) for (const slot of stage.materials) {
  assert.ok(slot.baseChance >= 0 && slot.baseChance <= 1)
  for (let extra = 0; extra <= 3; extra++) assert.equal(materials.filter(m => m.family === slot.family && m.quality === slot.baseQuality + extra).length, 1)
}
const generated = `// 由 scripts/generate-campaign-loot.mjs 生成；原版规则证据见 docs/evidence/original-world/campaign-loot.md。\n`
  + `export const STACK_ITEM_DEFINITIONS: Readonly<Record<number, { name: string; kind: 'material' | 'special'; quality: number; description: string }>> = ${JSON.stringify(Object.fromEntries(wp.filter(r => Number(r[0]) > 0 && r[5] !== '装备').map(r => [r[0], { name: String(r[1]), kind: r[5] === '材料' ? 'material' : 'special', quality: Number(r[4]) || 0, description: typeof r[10] === 'string' ? r[10] : '' }])))}\n`
  + `export const CAMPAIGN_LOOT_STAGES = ${JSON.stringify(stages)} as const\n`
  + `export const CAMPAIGN_ENEMY_DROPS: Readonly<Record<number, readonly number[]>> = ${JSON.stringify(enemies)}\n`
  + `export const CAMPAIGN_DROP_ITEMS: Readonly<Record<number, { id: number; name: string; kind: 'equipment' | 'material'; chance: number }>> = ${JSON.stringify(items)}\n`
  + `export const CAMPAIGN_MATERIALS = ${JSON.stringify(materials)} as const\n`
const hashes = Object.fromEntries(['sq.json', 'wm.json', 'wp.json', 'dl.json', 'data.json', 'scripts/c3runtime.js'].map(name => [name, createHash('sha256').update(readFileSync(resolve(source, name))).digest('hex')]))
const report = { hashes, worldCount: 13, stageCount: stages.length, enemyCount: Object.keys(enemies).length,
  itemCount: itemIds.length, nonEquipmentItems: Object.values(items).filter(i => i.kind !== 'equipment'),
  stages: stages.map(s => ({ ...s, enemies: s.enemyIds.map(id => ({ id, drops: enemies[id].map(itemId => items[itemId]) })) })),
}
for (const [path, content] of [
  ['../src/content/campaign-loot.generated.ts', generated],
  ['../../docs/evidence/original-world/campaign-loot-table.json', JSON.stringify(report, null, 2) + '\n'],
]) {
  const target = resolve(here, path)
  if (process.argv.includes('--check')) assert.equal(readFileSync(target, 'utf8'), content, `${path} 与原版不一致`)
  else writeFileSync(target, content)
}
console.log(`已核对 13 世界 / ${stages.length} 地点 / ${Object.keys(enemies).length} 敌人 / ${itemIds.length} 专属物品；材料类别 ${new Set(materials.map(m => m.family)).size}`)
