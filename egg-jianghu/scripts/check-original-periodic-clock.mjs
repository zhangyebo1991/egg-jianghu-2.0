// 重放原版System.Every本体，独立核对持续效果计时；不代替原客户端完整事件顺序验收。
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createCombatTimeline, consumeStatusPulse } from '../src/combat/scheduler.ts'

const runtimeSource = readFileSync('../../诸天刷宝录/_analysis/scripts/c3runtime.js', 'utf8')
const source = runtimeSource.slice(runtimeSource.indexOf('Every(seconds){'), runtimeSource.indexOf('IsGroupActive(groupName){'))
assert(source.startsWith('Every(seconds){') && source.includes('Every_lastTime'))
const { Every } = Function(`return ({${source}})`)()
const scenarios = [
  { name: '正常秒跳', samples: [[0, true], [900, true], [1000, true], [1999, true], [2000, true]] },
  { name: '暂停不求值，恢复仅跳一次', samples: [[0, true], [900, true], [1000, false], [2500, false], [2600, true], [2600, true], [3599, true], [3600, true]] },
  { name: '漏过多秒不逐秒追补', samples: [[1000, true], [1500, false], [8000, true], [8000, true], [8999, true], [9000, true]] },
  { name: '迟到不足40ms保留原相位', samples: [[1000, true], [2039, true], [2999, true], [3000, true]] },
  { name: '迟到40ms重新计时', samples: [[1000, true], [2040, true], [3000, true], [3040, true]] },
  { name: '游戏时钟回退重置', samples: [[2000, true], [1500, true], [2499, true], [2500, true]] },
]
const cases = scenarios.map(({ name, samples }) => {
  const saved = new Map()
  const timeline = createCombatTimeline()
  let time = 0
  const original = { _runtime: { GetGameTime: () => time / 1000, GetCurrentCondition: () => ({ GetSavedDataMap: () => saved }) } }
  return { name, samples: samples.map(([atMs, enabled]) => {
    time = atMs
    const expected = enabled ? Every.call(original, 1) : false
    const actual = enabled ? consumeStatusPulse(timeline, atMs) : false
    assert.equal(actual, expected, `${name}@${atMs}`)
    const originalLastTimeMs = (saved.get('Every_lastTime') ?? 0) * 1000
    assert(Math.abs(timeline.lastStatusPulseAtMs - originalLastTimeMs) < 1e-6, `${name}@${atMs}相位不符`)
    return { atMs, enabled, original: expected, current: actual, originalLastTimeMs, currentLastTimeMs: timeline.lastStatusPulseAtMs }
  }) }
})
writeFileSync('../docs/evidence/original-world/original-periodic-clock-audit.json', `${JSON.stringify({
  sourceSha256: createHash('sha256').update(runtimeSource).digest('hex'),
  scope: '直接执行未改写的原版Every函数；验证条件求值和相位，不代表完整战斗事件调度已验收',
  source, cases,
}, null, 2)}\n`)
console.log(`原版Every函数重放：${cases.length}组、${cases.reduce((n, c) => n + c.samples.length, 0)}个采样全部一致`)
