import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { projectileFlightMs } from '../src/combat/projectiles.ts'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 2016, height: 1136 } })
const page = await context.newPage()
const errors = []
const environment = 'Edge headless; 原版Worker; nwjs转html5宿主适配; 原版战斗代码未替换'
page.on('pageerror', error => errors.push(error.stack))
await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
  ? route.continue() : route.abort())
await context.route('**/scripts/main.js', async route => {
  const response = await route.fetch()
  await route.fulfill({ response, body: (await response.text()).replace('exportType:"nwjs"', 'exportType:"html5"') })
})
await context.route('**/scripts/c3runtime.js', async route => {
  const response = await route.fetch()
  await route.fulfill({ response, body: `${await response.text()}\n{const init=self.C3_InitRuntime;self.C3_InitRuntime=(runtime,...args)=>{self.__auditRuntime=runtime;return init(runtime,...args)}}` })
})
try {
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  await page.mouse.click(1000, 690)
  await page.waitForTimeout(2500)
  await page.mouse.click(1215, 865)
  await page.waitForTimeout(300)
  await page.mouse.click(1000, 995)
  await page.waitForTimeout(7000)
  const worker = page.workers().find(worker => worker.url().endsWith('/workermain.js'))
  await worker.evaluate(() => {
    const runtime = self.__auditRuntime
    runtime._InvokeFunctionFromJS({ name: '战斗开始', params: [1, 1, '战斗', 0] })
  })
  await page.waitForTimeout(2000)
  if (!process.argv.includes('--cooldown-only')) {
  const collision = await worker.evaluate(async () => {
    const runtime = self.__auditRuntime
    const globals = runtime.GetEventSheetManager().GetAllGlobalVariables()
    for (const [name, value] of [['游戏暂停', 0], ['角色行动', 1]]) globals.find(v => v.GetName() === name).SetValue(value)
    const cores = runtime.GetObjectClassByName('战斗核心').GetInstances()
    const snapshot = core => ({ slot: core.GetInstanceVariableValue(16), hp: core.GetInstanceVariableValue(6), alive: core.GetInstanceVariableValue(28), x: core.GetWorldInfo().GetX(), y: core.GetWorldInfo().GetY() })
    const source = cores.find(core => core.GetInstanceVariableValue(16) <= 15)
    const target = cores.find(core => core.GetInstanceVariableValue(16) > 15 && core.GetInstanceVariableValue(28))
    if (!target) return { cores: cores.map(snapshot) }
    const anchors = ['战争我方阵位点', '战争敌方阵位点'].map(name => runtime.GetObjectClassByName(name).GetInstances().map(i => ({ slot: i.GetInstanceVariableValue(0), x: i.GetWorldInfo().GetX(), y: i.GetWorldInfo().GetY() })))
    const sourceAnchor = runtime.GetObjectClassByName('战争我方阵位点').GetInstances().find(i => i.GetInstanceVariableValue(0) === source.GetInstanceVariableValue(16))
    const targetAnchor = runtime.GetObjectClassByName('战争敌方阵位点').GetInstances().find(i => i.GetInstanceVariableValue(0) + 15 === target.GetInstanceVariableValue(16))
    const cases = []
    for (const [partySlot, enemySlot] of [[7, 7], [5, 5], [11, 11], [1, 15], [15, 1], [5, 11]]) {
      for (const reverse of [false, true]) {
        // 上一弹体触发的受击位移和Wait动作结束后，再设置下一组独立场景。
        await new Promise(resolve => setTimeout(resolve, 1100))
        for (const [core, points, slot] of [[source, anchors[0], partySlot], [target, anchors[1], enemySlot]]) {
          const offset = Math.min(...points.map(p => p.slot)) > 15 ? 15 : 0
          const point = points.find(p => p.slot === slot + offset)
          if (!point) throw new Error(`找不到原版阵位 ${slot}`)
          core.GetWorldInfo().SetXY(point.x, point.y)
          core.GetWorldInfo().SetBboxChanged()
          // 原版按数据阵位匹配阵位点清除弹体；隔离场景必须同步移动核心及其阵位点。
          const anchor = core === source ? sourceAnchor : targetAnchor
          anchor.GetWorldInfo().SetXY(point.x, point.y)
          anchor.GetWorldInfo().SetBboxChanged()
          core.SetInstanceVariableValue(19, point.x)
          core.SetInstanceVariableValue(20, point.y)
          core.SetInstanceVariableValue(6, 100000)
          core.SetInstanceVariableValue(7, 100000)
          core.SetInstanceVariableValue(21, 0)
        }
        const from = reverse ? target : source
        const to = reverse ? source : target
        const initial = { source: snapshot(from), target: snapshot(to) }
        const before = runtime.GetGameTime()
        runtime._InvokeFunctionFromJS({ name: '间接子弹生成', params: [from.GetInstanceVariableValue(16), to.GetInstanceVariableValue(16), 4, 1, reverse ? '我方' : '敌方', '伤害'] })
        const samples = []
        let previousTick = -1
        let seen = false
        for (let i = 0; i < 450; i++) {
          const tick = runtime.GetTickCount()
          const bullets = runtime.GetObjectClassByName('zidan').GetInstances()
          if (tick !== previousTick) samples.push({ tick, elapsed: runtime.GetGameTime() - before, hp: to.GetInstanceVariableValue(6), target: snapshot(to), bullets: bullets.map(b => ({ x: b.GetWorldInfo().GetX(), y: b.GetWorldInfo().GetY(), width: b.GetWorldInfo().GetWidth(), height: b.GetWorldInfo().GetHeight() })) })
          previousTick = tick
          if (seen && !bullets.length) break
          seen ||= bullets.length > 0
          await new Promise(resolve => setTimeout(resolve, 5))
        }
        cases.push({ partySlot, enemySlot, reverse, initial, samples })
      }
    }
    return { anchors, cases }
  })
  for (const entry of collision.cases ?? []) {
    const unit = (side, slot) => ({ side, row: Math.floor((slot - 1) / 5), col: (slot - 1) % 5 })
    entry.predictedMs = projectileFlightMs(unit('party', entry.partySlot), unit('enemy', entry.enemySlot))
    const final = entry.samples.at(-1)
    const previous = entry.samples.at(-2)
    entry.measuredMs = final.elapsed * 1000
    entry.withinObservedFrame = previous.elapsed * 1000 <= entry.predictedMs && entry.predictedMs <= entry.measuredMs && final.bullets.length === 0
  }
  collision.environment = 'Edge headless; 原版Worker; nwjs转html5宿主适配; 原版弹体生成/移动/碰撞/清除代码未替换'
  collision.fixture = '原版新建角色后调用战斗开始(1,1,战斗,0)，移动核心及其数据阵位点到原版生成的各组阵位坐标；设置高生命以重复观察'
  collision.scope = '6组距离与斜向组合，各含双向；连续预测落在最后未命中帧与实际消失帧之间，不宣称不同宿主帧时间相等'
  writeFileSync('../docs/evidence/original-world/original-collision-probe.json', `${JSON.stringify(collision, null, 2)}\n`)
  console.log('collisions', JSON.stringify(collision.cases?.map(({ partySlot, enemySlot, reverse, predictedMs, measuredMs, withinObservedFrame }) => ({ partySlot, enemySlot, reverse, predictedMs, measuredMs, withinObservedFrame }))))
  console.log('state', await worker.evaluate(() => {
    const runtime = self.__auditRuntime
    const save = runtime.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance()
    const cores = runtime.GetObjectClassByName('战斗核心').GetInstances()
    return { layout: runtime.GetMainRunningLayout().GetName(), vars: runtime.GetEventSheetManager().GetAllGlobalVariables().filter(v => /战斗|加载|暂停/.test(v.GetName())).map(v => [v.GetName(),v.GetValue()]), cores: cores.length, firstMethods: cores.length ? Object.getOwnPropertyNames(Object.getPrototypeOf(cores[0])).filter(key => /var|world|behavior/i.test(key)) : [], saveSize: [save.GetWidth(),save.GetHeight(),save.GetDepth()] }
  }))
  console.log(JSON.stringify({ errors, body: await page.locator('body').innerText(), canvas: await page.locator('canvas').count() }))
  await page.screenshot({ path: '../test-results/original-boot.png' })
  assert.equal(errors.length, 0, '原版运行探针出现页面异常')
  assert.equal(collision.cases?.length, 12, '未完成全部12组碰撞观测')
  assert(collision.cases.every(entry => entry.withinObservedFrame), '原版碰撞与连续模型仍存在未解释差异')
  const energyCases = await worker.evaluate(() => {
    const runtime = self.__auditRuntime
    const core = runtime.GetObjectClassByName('战斗核心').GetInstances().find(core => core.GetInstanceVariableValue(16) > 15 && core.GetInstanceVariableValue(28))
    if (!core) throw new Error('缺少敌方核心，无法验证通用能量结算')
    const slot = core.GetInstanceVariableValue(16)
    const cases = []
    for (const initial of [0, 2.49, 2.5, 4.49, 4.5, 7]) {
      for (const mode of ['spend', 'gain', 'natural']) {
        core.SetInstanceVariableValue(5, initial)
        const amount = mode === 'spend' ? 4 : 2
        runtime._InvokeFunctionFromJS({ name: mode === 'spend' ? '失去能量值' : mode === 'gain' ? '战斗获得能量' : '获得能量值', params: mode === 'gain' ? [slot, 261, amount] : [slot, amount] })
        cases.push({ initial, mode, amount, actual: core.GetInstanceVariableValue(5) })
      }
    }
    return cases
  })
  for (const entry of energyCases) {
    entry.expected = Math.round(Math.min(5, Math.max(0, entry.initial + (entry.mode === 'spend' ? -entry.amount : entry.amount))))
    assert.equal(entry.actual, entry.expected, `原版能量结算不符：${JSON.stringify(entry)}`)
  }
  writeFileSync('../docs/evidence/original-world/original-energy-probe.json', `${JSON.stringify({
    environment: collision.environment,
    scope: '直接调用原版敌方核心通用耗能/技能回能/自然回能函数；小数及上下限边界，不包含器魂免耗分支和选技入口',
    cases: energyCases,
  }, null, 2)}\n`)
  console.log('energy', JSON.stringify(energyCases))
  const periodicCases = await worker.evaluate(async () => {
    const runtime = self.__auditRuntime
    const core = runtime.GetObjectClassByName('战斗核心').GetInstances().find(core => core.GetInstanceVariableValue(16) > 15 && core.GetInstanceVariableValue(28))
    const slot = core.GetInstanceVariableValue(16)
    const data = runtime.GetObjectClassByName('zdls').GetInstances()[0].GetSdkInstance()
    const cases = []
    for (const name of ['生命恢复', '恢复效果', '流血效果', '燃烧效果', '中毒效果']) {
      await new Promise(resolve => setTimeout(resolve, 1100))
      core.SetInstanceVariableValue(6, 5000)
      core.SetInstanceVariableValue(7, 10000)
      core.SetInstanceVariableValue(21, 0)
      data.Set(6, slot, 0, 10000)
      data.Set(15, slot, 0, 101)
      const before = runtime.GetGameTime()
      const samples = []
      runtime._InvokeFunctionFromJS({ name, params: name === '生命恢复' ? [slot] : [101, slot, slot] })
      let previousTick = -1
      for (let i = 0; i < 200; i++) {
        const tick = runtime.GetTickCount()
        const bullets = runtime.GetObjectClassByName('zidan1').GetInstances()
        if (tick !== previousTick) samples.push({ tick, elapsedMs: (runtime.GetGameTime() - before) * 1000, hp: core.GetInstanceVariableValue(6), bullets: bullets.length })
        previousTick = tick
        if (core.GetInstanceVariableValue(6) !== 5000 && bullets.length === 0) break
        await new Promise(resolve => setTimeout(resolve, 5))
      }
      cases.push({ name, initialHp: 5000, amount: 101, expectedHp: name.includes('恢复') ? 5101 : 4899, samples })
    }
    return cases
  })
  writeFileSync('../docs/evidence/original-world/original-periodic-probe.json', `${JSON.stringify({
    environment: collision.environment,
    scope: '直接调用原版持续效果生成函数，观察zidan1生成至碰撞；不包含1000ms调度入口',
    cases: periodicCases,
  }, null, 2)}\n`)
  for (const entry of periodicCases) {
    assert.equal(entry.samples.at(-1).hp, entry.expectedHp, `原版持续效果不符：${entry.name}`)
    assert.equal(entry.samples.at(-1).bullets, 0, `原版持续弹体未清除：${entry.name}`)
  }
  console.log('periodic', JSON.stringify(periodicCases))
  }
  const cooldownCases = await worker.evaluate(async () => {
    const runtime = self.__auditRuntime
    const globals = runtime.GetEventSheetManager().GetAllGlobalVariables()
    const data = runtime.GetObjectClassByName('zdls').GetInstances()[0].GetSdkInstance()
    const save = runtime.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance()
    const items = runtime.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance()
    const core = runtime.GetObjectClassByName('战斗核心').GetInstances().find(core => core.GetInstanceVariableValue(16) <= 15 && core.GetInstanceVariableValue(28))
    const slot = core.GetInstanceVariableValue(16)
    const role = data.At(0, slot, 0)
    let itemId = 0
    for (let id = 1; id < items.GetWidth(); id++) if (items.At(id, 27, 0) === 123 && items.At(id, 6, 0) === 2) { itemId = id; break }
    if (!itemId) throw new Error('原版未找到副手器魂123装备')
    const previous = save.At(role, 15, 1)
    const cases = []
    const matchingEnemy = runtime.GetObjectClassByName('战斗核心').GetInstances().find(candidate => candidate.GetInstanceVariableValue(16) > 15 && candidate.GetInstanceVariableValue(28))
    if (!matchingEnemy) throw new Error('原版缺少存活敌人')
    const enemySlot = matchingEnemy.GetInstanceVariableValue(16)
    const previousEnemyRole = data.At(0, enemySlot, 0)
    // 原新手战斗未必生成同编号敌人；显式构造数据编号重合的隔离条件。
    data.Set(0, enemySlot, 0, role)
    try {
      for (const actor of [core, matchingEnemy]) {
      const actorSlot = actor.GetInstanceVariableValue(16)
      for (const equipped of [false, true]) {
        globals.find(v => v.GetName() === '游戏暂停').SetValue(1)
        globals.find(v => v.GetName() === '战斗开关').SetValue(0)
        globals.find(v => v.GetName() === '战斗暂停').SetValue(1)
        // 仅修改隔离新档已有数组范围内的临时物品记录，不接触用户存档。
        save.Set(1500, 1, 3, itemId)
        save.Set(role, 15, 1, equipped ? 1500 : 0)
        data.Set(37, actorSlot, 0, 100)
        data.Set(1, actorSlot, 6, 0)
        actor.SetInstanceVariableValue(5, 5)
        globals.find(v => v.GetName() === '选中技能编号').SetValue(261)
        globals.find(v => v.GetName() === '选中技能槽编号').SetValue(1)
        const before = runtime.GetGameTime()
        runtime._InvokeFunctionFromJS({ name: '角色行动', params: [actorSlot, 261, 1, true] })
        const initialCooldown = data.At(1, actorSlot, 6)
        // 结束战斗行动另有Wait0.5清空全局选技；下一例必须等1.2+0.5全部结束。
        const pauseSamples = []
        let previousFlags = ''
        while ((runtime.GetGameTime() - before) * 1000 < 1900) {
          const acting = globals.find(v => v.GetName() === '角色行动').GetValue()
          const paused = globals.find(v => v.GetName() === '战斗暂停').GetValue()
          const flags = `${acting}/${paused}`
          if (flags !== previousFlags) pauseSamples.push({ elapsedMs: (runtime.GetGameTime() - before) * 1000, acting, paused })
          previousFlags = flags
          await new Promise(resolve => setTimeout(resolve, 5))
        }
        cases.push({ kind: 'action-pause', side: actorSlot <= 15 ? 'party' : 'enemy', equipped, pauseSamples })
        cases.push({ side: actorSlot <= 15 ? 'party' : 'enemy', actorSlot, previousEnemyRole, injectedEnemyRole: role, equipped, itemId, role, initialCooldown, elapsedMs: (runtime.GetGameTime() - before) * 1000, cooldownSeconds: data.At(1, actorSlot, 6), finalRole: data.At(0, actorSlot, 0), cooldownSlots: Array.from({length:13},(_,i)=>data.At(i,actorSlot,6)), selected: globals.filter(v=>/选中技能|角色行动/.test(v.GetName())).map(v=>[v.GetName(),v.GetValue()]) })
      }
      }
    } finally {
      save.Set(role, 15, 1, previous)
      data.Set(0, enemySlot, 0, previousEnemyRole)
    }
    return cases
  })
  writeFileSync('../docs/evidence/original-world/original-cooldown-probe.json', `${JSON.stringify({ environment, scope: '我方普通角色及同编号敌人调用完整角色行动261，冷却缩减100；我方副手器魂123有无对照，敌方数据编号为显式注入', cases: cooldownCases }, null, 2)}\n`)
  for (const entry of cooldownCases) {
    if (entry.kind === 'action-pause') {
      const ended = entry.pauseSamples.find(sample => !sample.acting && sample.paused)
      const resumed = entry.pauseSamples.find(sample => !sample.paused)
      assert(ended && resumed && ended.elapsedMs + 1e-6 >= 1200 && resumed.elapsedMs + 1e-6 >= 1700
        && resumed.elapsedMs - ended.elapsedMs + 1e-6 >= 500, '原版行动后暂停时间未符合预期')
    } else assert.equal(entry.cooldownSeconds, entry.equipped ? 0 : 0.8)
  }
  console.log('cooldown', JSON.stringify(cooldownCases))
  assert.equal(errors.length, 0, '完整原版探针结束时出现页面异常')
} finally {
  await browser.close()
}
