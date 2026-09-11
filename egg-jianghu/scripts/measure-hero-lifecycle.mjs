import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// 调用当前运行时公式，记录可复算的面板与岗位结果，不推导原版淘汰关卡。
const root = fileURLToPath(new URL('../', import.meta.url))
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' })
try {
  const { HEROES_V10 } = await server.ssrLoadModule('/src/content/heroes.ts')
  const { factionById } = await server.ssrLoadModule('/src/content/factions.ts')
  const { createHeroProgress, createInitialStateV10 } = await server.ssrLoadModule('/src/domain/state.ts')
  const { buildCombatStats } = await server.ssrLoadModule('/src/combat/stats.ts')
  const { factionAgentAbilityLevel, applyFactionQuestAgentReward } = await server.ssrLoadModule('/src/domain/faction-agent.ts')
  const { cityShopAbility, cityShopProgressPerSecond } = await server.ssrLoadModule('/src/domain/city-shop.ts')
  const statKeys = ['maxHp', 'externalAttack', 'internalAttack', 'externalDefense', 'internalDefense', 'effectiveAgility']
  const round = n => Math.round(n * 1000) / 1000
  const rows = HEROES_V10.map(hero => {
    const state = createInitialStateV10(0)
    state.heroes[hero.id] = createHeroProgress(hero.baseCareerId)
    state.factionAgents[hero.worldId] = { heroId: hero.id, enabled: false }
    const strategy = factionAgentAbilityLevel(state, hero.worldId)
    const commerce = cityShopAbility(state, hero.id)
    const baseline = applyFactionQuestAgentReward({ currency: 100, contribution: 100, reputation: 100 }, strategy)
    const panels = [1, 60, 100].map(level => {
      const progress = createHeroProgress(hero.baseCareerId)
      progress.level = level
      const stats = buildCombatStats(hero, progress)
      return { level, ...Object.fromEntries(statKeys.map(key => [key, round(stats[key])])) }
    })
    return {
      id: hero.id, name: hero.name, source: hero.source, chapter: Number(hero.worldId.slice(-2)),
      acquisition: {
        faction: hero.factionId ? factionById(hero.factionId)?.name : null,
        reputation: hero.requiredReputationLevel ?? null,
        cost: hero.cost,
        resource: hero.source === 'welfare' ? '福利码' : hero.source === 'starter' ? '初始角色'
          : hero.factionId && factionById(hero.factionId)?.currencyKind !== 'worldCurrency' ? '势力贡献' : '本卷货币',
      },
      lifecycle: ['吕布', '华佗'].includes(hero.name) ? '玩家确认：前期过渡，中期替换；具体关卡未知'
        : hero.source === 'starter' ? '主角，不参与伙伴稀有度'
          : hero.source === 'welfare' ? '开局福利；长期战斗地位待实战核对'
            : '本章可获取；淘汰阶段和长期战斗地位待实战核对',
      strategy, commerce, rewardPer100: baseline,
      shopProgressPerSecond: round(cityShopProgressPerSecond(state, hero.id)),
      panels,
    }
  })
  assert.equal(rows.length, 163)
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length)
  assert.equal(rows.filter(row => row.source === 'faction').length, 131)
  assert.equal(rows.filter(row => row.source === 'tavern').length, 30)
  assert.equal(rows.find(row => row.name === '朱可夫').strategy, 5)
  const hua = rows.find(row => row.name === '华佗')
  const alice = rows.find(row => row.name === '艾莉丝')
  for (let i = 0; i < hua.panels.length; i++) {
    for (const key of ['maxHp', 'internalAttack', 'effectiveAgility']) assert.ok(hua.panels[i][key] > alice.panels[i][key])
  }
  const output = {
    method: '当前运行时：白丁职业1级，角色等级1/60/100，无装备、技能、皮肤、能力培养。岗位为初始城市科技与主角商业0。',
    limits: '仅测公式面板和岗位函数；不是战斗模拟、通关实测或原版强度排名。不同等级不代表取得章节；岗位数值不代表已解锁建筑、在岗或实际售出。',
    coverage: { runtimeHeroes: rows.length, testedRetirementChapters: 0 },
    rows,
  }
  const { rows: measuredRows, ...metadata } = output
  const json = `${JSON.stringify(metadata, null, 2).slice(0, -2)},\n  "rows": [\n${measuredRows.map(row => `    ${JSON.stringify(row)}`).join(',\n')}\n  ]\n}\n`
  assert.deepEqual(JSON.parse(json), output)
  const table = rows.map(row => `| ${row.name} | ${row.source === 'welfare' ? '开局福利码' : row.source === 'starter' ? '主角' : `第${row.chapter}章`} | ${row.acquisition.faction ?? row.acquisition.resource}；声望${row.acquisition.reputation ?? '—'}；${row.acquisition.cost}${row.acquisition.resource} | ${row.lifecycle} | 计略${row.strategy}／商业${row.commerce} | ${row.strategy > 0 || row.commerce > 0 ? '可考虑代理／商店；同能力上限下无独占收益' : '未测得这两种岗位的白板优势'} |`).join('\n')
  const markdown = `# 当前角色生命周期方案准备表\n\n本表由当前运行时生成，覆盖163人。待确认的实施选择：先落地阶段／用途分层并保留原版兑换；或先补齐长期机制再开放高级抽池。尚未改变运行时投放。\n\n${output.method}\n\n${output.limits}\n\n当前不能把艾莉丝列为已经成立的华佗替代：三个同等级配置下，她的生命、法攻、速度均低于华佗。也不能因此否定原版命格完整生效时的用法。\n\n长期岗位价值单独列出，不提高战斗稀有度。计略和商业最终上限5，高白板体现少补能力的优势，不代表终局独占；岗位同时还受任职、建筑、科技等条件限制。吕布、华佗按玩家经历记前期过渡，但不编造淘汰关卡。赵云福利码保持不变。\n\n| 角色 | 取得阶段 | 当前获取条件 | 生命周期结论 | 当前岗位白板 | 退队后用途 |\n| --- | --- | --- | --- | --- | --- |\n${table}\n\n复核：在egg-jianghu目录运行\`node scripts/measure-hero-lifecycle.mjs --check\`。原始测量见[JSON](2026-09-11-hero-runtime-measurements.json)。当前高级池名单与概率仍待机制路线确认，不恢复已撤回的V1名单。\n`
  for (const [name, contents] of [['hero-runtime-measurements.json', json], ['hero-placement-v2-preparation.md', markdown]]) {
    const target = new URL(`../../docs/brainstorms/2026-09-11-${name}`, import.meta.url)
    if (process.argv.includes('--check')) assert.equal(readFileSync(target, 'utf8'), contents, `${name}需重新生成`)
    else writeFileSync(target, contents)
  }
  console.log(`已复核 ${rows.length} 人、${rows.length * 3} 组面板及代理／商店岗位；没有推导淘汰关卡。`)
} finally {
  await server.close()
}
