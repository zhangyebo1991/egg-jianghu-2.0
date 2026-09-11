import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

// 只生成研究资料，不产生运行时稀有度、价格或角色获取配置。
const root = fileURLToPath(new URL('../../', import.meta.url))
const read = relative => JSON.parse(readFileSync(path.join(root, relative), 'utf8'))
const fateEvidence = read('docs/evidence/original-world/hero-fate-stone-analysis.json')
const acquisition = read('docs/evidence/original-world/hero-acquisition-classification.json')
const placement = read('docs/brainstorms/2026-09-11-hero-placement-v1.json')
const originalRoot = path.resolve(root, '../诸天刷宝录/_analysis')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
for (const [file, expected] of Object.entries(fateEvidence.sourceHashes)) {
  assert.equal(sha(readFileSync(path.join(originalRoot, file))), expected, `原版快照发生变化：${file}`)
}
const js = JSON.parse(readFileSync(path.join(originalRoot, 'js.json'), 'utf8')).data
const byId = new Map(fateEvidence.records.map(row => [row.sourceId, row]))
assert.equal(byId.size, 193)
const changedIds = new Set(fateEvidence.archiveDifferences.map(row => row.sourceId))
const eligible = fateEvidence.records.filter(row => row.eligibleCompanion && !changedIds.has(row.sourceId))
const attributes = ['勇', '智', '体', '敏', '精']
const gate = row => row.group === '常规势力' ? `第${row.originalWorld}章`
  : row.group === '礼包' ? '开局福利码'
  : row.group === '大型副本' ? `副本渠道（映射章${row.proposedChapter}，非已核实开放顺序）`
  : row.group === '神系' ? '圣魂重塑（解锁时点待核）' : row.group
const order = row => row.group === '礼包' ? 0 : row.group === '常规势力' ? row.originalWorld : row.group === '大型副本' ? 100 + row.proposedChapter : 1000
const candidate = row => ({ sourceId: row.sourceId, name: row.name, gate: gate(row), aptitudes: row.aptitudes })
const skillAxes = row => row.fates.some(fate => ['治疗加成', '医术类效果'].includes(fate.attribute)) ? ['智', '敏']
  : row.originalCareer === '护卫' ? ['体', '精']
  : ['武夫', '弓手'].includes(row.originalCareer) ? ['勇', '敏'] : ['智', '敏']
const records = acquisition.records.map(source => {
  const row = byId.get(source.sourceId)
  assert.equal(js[source.sourceId][1][0], row.name)
  for (let index = 0; index < 5; index++) assert.equal(Number(js[source.sourceId][7 + index][0]), row.aptitudes[attributes[index]])
  const axes = row.sourceId === 165 ? ['勇', '敏'] : skillAxes(row)
  const comparison = eligible.filter(other => other.sourceId !== row.sourceId)
  const dominates = (other, keys) => keys.every(key => other.aptitudes[key] >= row.aptitudes[key]) && keys.some(key => other.aptitudes[key] > row.aptitudes[key])
  const healing = value => value.fates.some(fate => ['治疗加成', '医术类效果'].includes(fate.attribute))
  const sameDirection = other => healing(row) ? healing(other)
    : row.originalCareer === '护卫' ? other.originalCareer === '护卫'
    : ['武夫', '弓手'].includes(row.originalCareer) || row.sourceId === 165
      ? ['武夫', '弓手'].includes(other.originalCareer) || other.sourceId === 165
      : ['学者', '方士'].includes(other.originalCareer)
  const axisCandidates = comparison.filter(other => sameDirection(other) && dominates(other, axes)).sort((a, b) => order(a) - order(b) || a.sourceId - b.sourceId).slice(0, 3).map(candidate)
  const fullCandidates = comparison.filter(other => dominates(other, attributes)).map(candidate)
  const fateAlternatives = row.fates.map(fate => ({
    position: fate.position, name: fate.name, attribute: fate.attribute, coefficient: fate.coefficient,
    originalHeroLevelGate: [1, 100, 200, 300][fate.position - 1],
    defaultAvailable: fate.availableWithoutHeroUnlock,
    sameIdProviders: fate.otherProviders,
    // 相同属性但不同命格，也可能削弱“独有”的说法；仍不是命盘配置下的强度证明。
    sameAttributeAtLeastCoefficient: comparison.flatMap(other => other.fates
      .filter(value => value.attributeId === fate.attributeId && value.coefficient >= fate.coefficient)
      .map(value => ({ sourceId: other.sourceId, name: other.name, gate: gate(other), position: value.position, coefficient: value.coefficient }))),
  }))
  const abilities = Object.entries(row.abilities).filter(([, value]) => value >= 3).map(([name, level]) => ({
    name, level, currentConsumer: name === '计略' ? '势力代理奖励' : name === '商业' ? '商店员工经营' : '本轮未找到对应生产收益结算链，不计作已兑现长期收益',
    alternatives: comparison.filter(other => other.abilities[name] >= level).sort((a, b) => order(a) - order(b) || a.sourceId - b.sourceId).slice(0, 3).map(other => ({ sourceId: other.sourceId, name: other.name, level: other.abilities[name], gate: gate(other) })),
  }))
  return {
    id: row.sourceId === 1 ? 'hero_player' : `hero_orig_${row.sourceId}`, sourceId: row.sourceId, name: row.name, group: row.group,
    acquisitionGate: gate(row), originalRoute: source.originalRoute, reputation: source.originalReputation,
    aptitudes: row.aptitudes, originalCareer: row.originalCareer,
    compareAxes: axes, axisCandidates: row.eligibleCompanion ? axisCandidates : [],
    allFiveAxesCandidates: row.eligibleCompanion ? fullCandidates : [],
    fateAlternatives, abilities,
    nonDefaultUniqueFates: row.fates.filter(fate => !fate.availableWithoutHeroUnlock && fate.otherProviders.length === 0).map(fate => ({ name: fate.name, position: fate.position, attribute: fate.attribute })),
    status: changedIds.has(row.sourceId) ? '版本差异，暂不作强度结论' : !row.eligibleCompanion ? '主角或占位，不参与伙伴投放' : ['吕布', '华佗'].includes(row.name) ? '玩家反馈：前期过渡、中期替换；撤销旧高级稀有定位，精确替换关卡未实测' : '替代关系已作静态核对；淘汰时点与高级稀有资格未证实',
    retirementTime: null,
  }
})
const tavern = placement.tavern.map(row => ({ id: row.id, name: row.name, chapter: row.chapter, aptitudes: row.aptitudes, status: '本作模板角色，无对应原版ID；不能按文学名气推定强度或终局地位', retirementTime: null }))
assert.equal(records.length + tavern.length, 223)
assert.equal(new Set([...records, ...tavern].map(row => row.id)).size, 223)
assert.equal(records.filter(row => byId.get(row.sourceId).eligibleCompanion).length, 188)
assert.equal(records.flatMap(row => row.fateAlternatives).length, 772)
assert.equal(records.filter(row => ['常规势力', '大型副本', '礼包', '神系', '主角', '占位'].includes(row.group)).length, 193)
const output = {
  date: '2026-09-11', snapshot: fateEvidence.snapshot,
  method: '阶段获取门槛、透明的五维/两轴比较、同属性替代、能力消费端核对。不是实战排名，不生成稀有度。',
  sourceHashes: fateEvidence.sourceHashes,
  coverage: { original: 193, tavern: 30, validCompanions: 218, testedCombatRetirementTimes: 0 },
  referenceSchema: '比较对象保存sourceId，姓名、门槛、五维从records查找；同ID命格来源为[sourceId,rank]，同属性来源为[sourceId,position,coefficient]',
  records: records.map(row => ({
    ...row,
    axisCandidates: row.axisCandidates.map(value => value.sourceId),
    allFiveAxesCandidates: row.allFiveAxesCandidates.map(value => value.sourceId),
    fateAlternatives: row.fateAlternatives.map(fate => ({
      ...fate,
      sameIdProviders: fate.sameIdProviders.map(value => [value.sourceId, value.rank]),
      sameAttributeAtLeastCoefficient: fate.sameAttributeAtLeastCoefficient.map(value => [value.sourceId, value.position, value.coefficient]),
    })),
  })), tavern,
}
const directory = path.join(root, 'docs/brainstorms')
const prefix = '2026-09-11-hero-lifecycle-audit'
const encode = text => String(text).replaceAll('|', '／').replaceAll('\n', ' ')
const candidateText = items => items.length ? items.map(item => `${item.name}（${item.gate}）`).join('；') : '本口径未找到，不等于不可替代'
let markdown = `# 角色生命周期逐人核对表\n\n生成器：\`egg-jianghu/scripts/audit-hero-lifecycle.mjs\`。解释、纠错与限制见[核对结论](${prefix}.md)。\n\n共193条原版记录＋30名本作酒馆角色；188名原版伙伴。表内不重新发放名侠／传奇标签。\n\n“比较对象”先按初始职业大类或治疗命格方向过滤（赵云纳入物理方向），再要求所列两轴资质不低且至少一项较高，其余属性、命格、皮肤及培养成本可能更差。必须做同岗位实战再决定替换，不能把此列当淘汰判决。完整五维、同属性命格替代和能力替代来源在同名JSON。\n\n`
for (const group of ['常规势力', '大型副本', '礼包', '神系', '主角', '占位']) {
  const rows = records.filter(row => row.group === group)
  if (!rows.length) continue
  markdown += `## ${group}\n\n| ID／角色 | 获得阶段与原门槛 | 应先比较的对象（仅两轴） | 3级以上能力与已接入用途 | 原版非默认独有命格 | 核对状态 |\n| --- | --- | --- | --- | --- | --- |\n`
  for (const row of rows) markdown += `| ${row.sourceId} ${row.name} | ${encode(row.acquisitionGate)}；${encode(row.originalRoute)}${row.reputation ? `；声望${row.reputation}` : ''} | ${row.compareAxes.join('／')}：${encode(candidateText(row.axisCandidates))} | ${encode(row.abilities.map(value => `${value.name}${value.level}：${value.currentConsumer}`).join('；') || '无3级以上白板；不表示无法培养')} | ${encode(row.nonDefaultUniqueFates.map(value => `${value.position}阶${value.name}（${value.attribute}）`).join('；') || '无；也不等于无收藏价值')} | ${row.status} |\n`
  markdown += '\n'
}
markdown += '## 本作酒馆30人\n\n| ID／角色 | 入口 | 核对状态 |\n| --- | --- | --- |\n'
for (const row of tavern) markdown += `| ${row.id} ${row.name} | 原酒馆第${row.chapter}章 | ${row.status} |\n`
const files = [[`${prefix}.json`, JSON.stringify({ ...output, records: undefined, tavern: undefined }, null, 2).slice(0, -2) + ',\n  "records": [\n' + output.records.map(row => '    ' + JSON.stringify(row)).join(',\n') + '\n  ],\n  "tavern": ' + JSON.stringify(tavern) + '\n}\n'], [`${prefix}-roster.md`, markdown]]
for (const [name, contents] of files) {
  const target = path.join(directory, name)
  if (process.argv.includes('--check')) assert.equal(readFileSync(target, 'utf8'), contents, `${name}不同步`)
  else writeFileSync(target, contents)
}
console.log(JSON.stringify(output.coverage))
