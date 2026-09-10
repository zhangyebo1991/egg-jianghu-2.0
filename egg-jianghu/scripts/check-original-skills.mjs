// 独立重放已解码的原版表达式，不调用生成器的系数实现。
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { COMBAT_SKILLS, SUMMON_UNITS } from '../src/content/skills.ts'
import { COMBAT_BUFFS } from '../src/content/buffs.ts'
import { COMBAT_SKILL_RANGES } from '../src/content/skill-ranges.ts'
import { STAGE_ENEMIES } from '../src/content/enemies.ts'

const here = dirname(fileURLToPath(import.meta.url))
const sourceRoot = resolve(here, '../../../诸天刷宝录/_analysis')
const evidenceRoot = resolve(here, '../../docs/evidence/original-world')
const load = name => JSON.parse(readFileSync(resolve(sourceRoot, `${name}.json`))).data.map(r => r.map(c => c[0]))
const rows = load('jn')
const ranges = load('fw')
const evidence = JSON.parse(readFileSync(resolve(evidenceRoot, 'all-skills-runtime-audit.json')))
const operations = name => evidence.find(r => r.name === name).operations
const returnExpressions = name => operations(name).filter(o => o.reference.endsWith('.SetFunctionReturnValue'))

// 这三段原版函数仅含数值相等分支；把条件和值从证据读取，避免复刻一套常数自证。
const lookup = (name, value) => {
  const ops = operations(name)
  const condition = ops.find(o => o.reference.endsWith('.Compare') && Number(o.parameters[2]) === value)
  if (!condition) throw new Error(`${name} 不支持 ${value}`)
  const branch = condition.path.slice(0, -2).join('.')
  const result = ops.find(o => o.reference.endsWith('.SetFunctionReturnValue') && o.path.slice(0, -2).join('.') === branch)
  if (!result) throw new Error(`${name} 分支缺少返回值`)
  return Number(result.parameters[0])
}
const env = {
  jn: { At: (x, y) => rows[x]?.[y] ?? 0 },
  fw: { At: (x, y) => ranges[x]?.[y] ?? 0 },
  multiply: (a, b) => a * b,
  divide: (a, b) => a / b,
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  pow: Math.pow,
  技能属性系数: id => lookup('技能属性系数', Number(rows[id][5])),
  技能种类系数: id => lookup('技能种类系数', Number(rows[id][4])),
  技能范围分摊系数: value => lookup('技能范围分摊系数', Number(value)),
}
const evaluate = (expression, variables) => {
  const context = { ...env, ...variables }
  return Function(...Object.keys(context), `return (${expression})`)(...Object.values(context))
}
const mismatch = []
const report = []
const compare = (id, field, actual, expected) => {
  if (typeof expected === 'number' ? Math.abs(actual - expected) > 1e-9 || !Number.isFinite(actual) : actual !== expected) {
    mismatch.push({ id, field, actual, expected })
  }
}
for (const row of rows) {
  if (!String(row[1] ?? '').trim()) continue
  const id = Number(row[0])
  if (id > 0 && ['物理', '法术'].includes(row[26])) {
    const expression = returnExpressions('技能主动系数')[row[15] === '生命治疗' ? 0 : 1].parameters[0]
    row[16] = evaluate(expression, { 技能编号: id })
    row[17] = 10 * row[16] / 50
  }
  const skill = COMBAT_SKILLS[id]
  compare(id, 'skillTier', skill.skillTier, Number(row[6]) || 1)
  compare(id, 'nonBasicAttack', skill.nonBasicAttack, Boolean(row[27]))
  const equipped = [[row[8], row[9]], [row[10], row[11]]].filter(([id, value]) => id > 0 && value !== 0)
  compare(id, 'equippedAttributes', JSON.stringify((skill.equippedAttributes ?? []).map(a => [a.sxId, a.coefficient])), JSON.stringify(equipped))

  if (!skill) { mismatch.push({ id, field: 'missing' }); continue }
  const power = row[15] === '我方进度' ? Number(row[23])
    : evaluate(returnExpressions('技能系数计算')[0].parameters[0], { 技能编号: id, 等级: 1 })
  compare(id, 'powerPercent', skill.powerPercent, power)
  compare(id, 'baseEffect', skill.baseEffect, Number(row[16]))
  compare(id, 'growth', skill.effectGrowthPerTenLevels, Number(row[17]))
  compare(id, 'energyCost', skill.energyCost, Number(row[19]))
  compare(id, 'cooldownMs', skill.cooldownMs, Number(row[19]) * 4000)
  compare(id, 'originalBehavior', skill.originalBehavior, row[15])
  compare(id, 'rangeId', skill.rangeId, Number(row[37]))
  compare(id, 'specialMechanic', skill.specialMechanic ?? 0, Number(row[45]) || 0)
  if (skill.behavior === 'heal' || [257, 258].includes(id)) compare(id, 'healingStat', skill.healingStat, row[26] === '生命' ? 'health' : 'internalAttack')
  if (skill.behavior === 'grant-energy' || id === 256) compare(id, 'energyGain', skill.energyGain, Number(row[25]))
  report.push({ id, name: row[1], behavior: row[15], baseEffect: row[16], growth: row[17], powerPercent: power })
}
const enemies = new Map()
for (const group of Object.values(STAGE_ENEMIES)) for (const enemy of [...group.mobs, group.boss]) enemies.set(enemy.drId, enemy)
const dr = load('dr'), jnz = load('jnz')
const enemyReport = []
for (const enemy of enemies.values()) {
  const expected = jnz[dr[enemy.drId][8]].slice(1, 5).filter(id => id > 0)
  const actual = [enemy.attackSkillId, ...enemy.skillIds]
  compare(enemy.drId, 'enemySkillGroup', JSON.stringify(actual), JSON.stringify(expected))
  enemyReport.push({ id: enemy.drId, name: enemy.name, skillGroupId: dr[enemy.drId][8], skills: expected })
}
for (const row of load('buff')) {
  if (!(Number(row[0]) > 0) || !String(row[1] ?? '').trim()) continue
  const id = Number(row[0]), buff = COMBAT_BUFFS[id]
  if (!buff) { mismatch.push({ id, field: 'missingBuff' }); continue }
  compare(id, 'buff.durationMs', buff.durationMs, Number(row[10]) * 1000)
  compare(id, 'buff.maxStacks', buff.maxStacks, Number(row[9]))
  compare(id, 'buff.unit', buff.unit, row[11] === '回合' ? 'turn' : 'time')
  compare(id, 'buff.polarity', buff.polarity, row[12] === '增益' ? 'buff' : 'debuff')
  compare(id, 'buff.tickKind', buff.tickKind, [3, 4, 5, 65].includes(id) ? 'dot' : [6, 47].includes(id) ? 'hot' : null)
  const attrs = [[row[3], row[6]], [row[4], row[7]]].filter(([id, value]) => id > 0 && value !== 0)
  compare(id, 'buff.attributes', JSON.stringify(buff.attributes.map(a => [a.sxId, a.value])), JSON.stringify(attrs))
}
for (const row of load('zh')) {
  if (!(Number(row[0]) > 0) || !String(row[1] ?? '').trim()) continue
  const id = Number(row[0]), summon = SUMMON_UNITS[id]
  if (!summon) { mismatch.push({ id, field: 'missingSummon' }); continue }
  compare(id, 'summon.baseAttackId', summon.baseAttackId, Number(row[3]))
  compare(id, 'summon.durationMs', summon.durationMs, Number(row[11]) * 1000)
  compare(id, 'summon.coeffs', JSON.stringify(summon.coeffs), JSON.stringify([row[5], row[7], row[8], row[10], row[9], row[6]]))
}
for (let id = 1; id <= 36; id++) {
  const range = COMBAT_SKILL_RANGES[id]
  compare(id, 'range.targetMode', range.targetMode, String(ranges[id][18] ?? ''))
  for (let slot = 1; slot <= 15; slot++) {
    compare(id, `range.matrix[${slot}]`, JSON.stringify(range.matrix[slot - 1]),
      JSON.stringify(ranges[(id - 1) * 15 + slot].slice(1, 16).map(v => v === 1 ? 1 : 0)))
  }
}
const enemySupportSkills = [...new Set(enemyReport.flatMap(enemy => enemy.skills))]
  .filter(id => COMBAT_SKILLS[id].behavior !== 'attack')
  .map(id => ({ id, name: COMBAT_SKILLS[id].name, behavior: COMBAT_SKILLS[id].originalBehavior,
    rangeId: COMBAT_SKILLS[id].rangeId, enemies: enemyReport.filter(enemy => enemy.skills.includes(id)).map(enemy => enemy.id) }))
const rangeUsage = Array.from({ length: 36 }, (_, index) => ({
  rangeId: index + 1, targetMode: ranges[index + 1][18],
  skills: report.filter(skill => Number(rows[skill.id][37]) === index + 1).map(skill => skill.id),
}))
const sourceHashes = Object.fromEntries(['jn.json', 'sx.json', 'jnz.json', 'dr.json', 'fw.json', 'buff.json', 'zh.json', 'data.json', 'scripts/c3runtime.js'].map(name => [name,
  createHash('sha256').update(readFileSync(resolve(sourceRoot, name))).digest('hex'),
]))
const result = { sourceHashes, checked: report.length, equippedAttributeSkillCount: Object.values(COMBAT_SKILLS).filter(skill => skill.equippedAttributes?.length).length, buffCount: Object.keys(COMBAT_BUFFS).length, summonCount: Object.keys(SUMMON_UNITS).length, rangeCount: 36, scope: '技能基础数据、敌人技能组、全部buff数据、召唤模板与36范围矩阵；不代表战斗状态机完成', mismatch, enemySupportSkills, rangeUsage, skills: report, enemies: enemyReport }
writeFileSync(resolve(evidenceRoot, 'all-skills-data-audit.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(`原版表达式独立核验 ${report.length} 条技能，差异 ${mismatch.length}`)
if (mismatch.length) { console.error(JSON.stringify(mismatch, null, 2)); process.exitCode = 1 }
