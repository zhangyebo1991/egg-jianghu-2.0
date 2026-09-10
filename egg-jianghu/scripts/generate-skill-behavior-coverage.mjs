// 逐ID关联已提取证据与验收边界；关联存在不等于运行时验收完成。
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMBAT_SKILLS } from '../src/content/skills.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/original-world')
const read = name => JSON.parse(readFileSync(resolve(root, name), 'utf8'))
const data = read('all-skills-data-audit.json')
const runtime = read('all-skills-runtime-audit.json')
const source = read('all-skills-runtime-sources.json')
assert.equal(data.mismatch.length, 0, '先处理独立数据核验差异')
const functions = new Set(runtime.map(node => node.name))
const behaviorFunctions = {
  attack: ['伤害计算function', '暴击计算', '闪避计算', '子弹碰撞', '直接子弹生成', '间接子弹生成'],
  heal: ['回复计算function', '直接子弹生成', '子弹碰撞', '治疗目标阵位号'],
  shield: ['护盾计算function', '直接子弹生成', '子弹碰撞'],
  status: ['buff命中计算function', '获得buff'],
  revive: ['复活目标阵位号', '生成我方战斗角色', '刷新角色战斗属性'],
  'advance-gauge': ['技能释放核心function', '能量目标阵位号'],
  'grant-energy': ['技能释放核心function', '能量目标阵位号', '战斗获得能量'],
  summon: ['生成召唤角色', '刷新召唤物战斗属性', '召唤系数', '召唤数量判定', '替换召唤阵位', '召唤时间'],
  passive: ['技能总属性function', '通用单条属性function'],
}
const records = Object.values(COMBAT_SKILLS).map(skill => {
  const evidence = new Set(behaviorFunctions[skill.behavior])
  assert(behaviorFunctions[skill.behavior], `未关联行为 ${skill.id}: ${skill.behavior}`)
  if (skill.behavior !== 'passive') {
    for (const name of ['自动战斗技能选择', '自动技能条件判断', '角色行动function', '失去能量值', '获得能量值',
      '技能释放核心function', '目标数据阵位号', '刷新技能范围数据', '技能范围阵位号', '技能等级']) evidence.add(name)
  }
  if (skill.appliedBuffId || skill.selfBuffId || skill.enhanceBuffId) {
    for (const name of ['buff命中计算function', '获得buff', '失去指定buff']) evidence.add(name)
  }
  if (skill.equippedAttributes?.length) {
    for (const name of ['技能总属性function', '通用单条属性function', '特定属性统计function']) evidence.add(name)
  }
  if (skill.specialMechanic || skill.id === 261) evidence.add('特殊技能机制function')
  if ([256, 257, 258].includes(skill.id)) evidence.add('回复计算function')
  for (const name of evidence) assert(functions.has(name), `技能${skill.id}缺少证据 ${name}`)
  const pending = ['逐技能运行入口验收与最终覆盖复核']
  if (skill.equippedAttributes?.length) pending.push('实际角色页面装配属性验收')
  if (skill.originalBehavior === '远程攻击') pending.push('完整施法链的300ms生成与目标/来源销毁边界复核')
  const boundaries = []
  if (skill.id === 261) boundaries.push('自动路径已回归：全队存活目标立即回能，自己为核心使特殊复活条件不成立；原版手动地面复活无当前入口')
  if (skill.behavior === 'summon') boundaries.push('自动满额指向已有召唤格，空格条件拦截；原版手动空格替换无当前手动入口')
  if (skill.appliedBuffId || skill.selfBuffId || skill.enhanceBuffId) boundaries.push('全项目减层调用与具名技能表已核对，无减层后仍保留状态的当前技能路径')
  if ([256, 257, 258].includes(skill.id)) boundaries.push('复合回能治疗已覆盖立即回能与300ms治疗分支')
  if (skill.originalBehavior === '远程攻击') boundaries.push('原版Worker的12组双向距离/斜向观测通过，连续预测落在最后未命中帧和消失帧之间；不代表全技能运行验收或NW.js与HTML5帧时间完全相同')
  if (skill.behavior === 'revive') boundaries.push('正常战斗UI已禁用改阵；外部直接修改存档后的原版重叠阵位行为不属于当前正常入口')
  return {
    id: skill.id, name: skill.name, originalBehavior: skill.originalBehavior,
    behavior: skill.behavior, rangeId: skill.rangeId,
    enemyConfigurationIds: data.enemies.filter(enemy => enemy.skills.includes(skill.id)).map(enemy => enemy.id),
    fieldsCheckedBy: 'check-original-skills.mjs',
    runtimeEvidence: [...evidence],
    status: 'evidence-linked-acceptance-pending', pending, boundaries,
  }
})
assert.equal(records.length, data.checked)
assert.equal(new Set(records.map(record => record.id)).size, records.length)
const result = {
  command: 'node scripts/generate-skill-behavior-coverage.mjs',
  scope: '每个技能关联原版函数和明确待验收项；函数关联及共享分支测试不等于逐ID验收通过',
  sourceHashes: data.sourceHashes,
  counts: { skills: records.length, accepted: 0, pending: records.length },
  skillTableWrites: source.skillTableWrites,
  records,
}
writeFileSync(resolve(root, 'all-skills-behavior-coverage.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(`已关联${records.length}个技能；${records.length}个仍待最终运行验收，不据此标记完成`)
