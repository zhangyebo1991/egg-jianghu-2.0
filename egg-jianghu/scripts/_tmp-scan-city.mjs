import { readFileSync } from 'node:fs'

const t = readFileSync(new URL('../src/content/original-city.generated.ts', import.meta.url), 'utf8')
const names = Object.fromEntries([...t.matchAll(/"sourceId": (\d+),\s+"name": "([^"]+)"/g)].map((m) => [m[1], m[2]]))
console.log('names', { 16: names[16], 17: names[17], 19: names[19] })

const start = t.indexOf('export const ORIGINAL_CITY_INITIAL_TILES')
const end = t.indexOf('export const ORIGINAL_CITY_INITIAL_TECHNOLOGY')
const chunk = t.slice(start, end)
const objects = [...chunk.matchAll(/\{\s*"tileId": (\d+),\s*"buildingId": (\d+),\s*"buildingLevel": (\d+),\s*"owned": (true|false)/g)]
const counts = {}
for (const m of objects) counts[m[2]] = (counts[m[2]] || 0) + 1
console.log('building counts', counts)
for (const id of ['16', '17', '19']) {
  const hits = objects.filter((m) => m[2] === id).map((m) => ({ tile: m[1], level: m[3], owned: m[4] }))
  console.log(`building ${id} ${names[id]}`, hits)
}
