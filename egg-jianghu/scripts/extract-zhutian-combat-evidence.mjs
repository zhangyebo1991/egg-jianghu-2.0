import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const originalAnalysisRoot = path.resolve(projectRoot, '..', '..', '诸天刷宝录', '_analysis')
const dataPath = path.join(originalAnalysisRoot, 'data.json')
const jnPath = path.join(originalAnalysisRoot, 'jn.json')
const fwPath = path.join(originalAnalysisRoot, 'fw.json')
const buffPath = path.join(originalAnalysisRoot, 'buff.json')
const sqPath = path.join(originalAnalysisRoot, 'sq.json')
const drPath = path.join(originalAnalysisRoot, 'dr.json')
const drsxPath = path.join(originalAnalysisRoot, 'drsx.json')
const zxPath = path.join(originalAnalysisRoot, 'zx.json')
const runtimePath = path.join(originalAnalysisRoot, 'scripts', 'c3runtime.js')
const functionNamesPath = path.join(originalAnalysisRoot, '_all_func_names.txt')
const outputDir = path.join(projectRoot, 'docs', 'research')
const jsonOutputPath = path.join(outputDir, 'zhutian-combat-evidence.json')
const markdownOutputPath = path.join(outputDir, 'zhutian-combat-evidence.md')

const TARGET_FUNCTION_NAMES = [
  '战斗开始function',
  '战斗行动积攒',
  '战斗技能及buff冷却、生命恢复、燃烧、中毒等',
  '冷却及状态时间计算function',
  'buff伤害计算function',
  '战斗行动',
  '开始战斗行动function',
  '结束战斗行动function',
  '战斗技能判断function',
  '技能释放',
  '角色行动function',
  '技能释放动作function',
  '角色受击动作function',
  '技能释放核心function',
  '技能子弹生成function',
  '技能主特效function',
  '总伤害显示function',
  '子弹碰撞',
  '子弹动画',
  '子弹暂停',
  '子弹消除',
  '战斗防御function',
  '技能名显示function',
  '战斗结束function',
  '位面战斗结算',
  '自动重新挑战',
  '开启自动重新挑战function',
  '自动挑战倒计时',
  '战斗速度',
  '召唤时间function',
  '新战斗核心管理',
  '敌方战斗核心死亡function',
]

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const findMatchingBracket = (source, openIndex, openChar, closeChar) => {
  let depth = 0
  let quote = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === openChar) depth += 1
    else if (char === closeChar) {
      depth -= 1
      if (depth === 0) return index
    }
  }
  throw new Error(`无法匹配 ${openChar}${closeChar}`)
}

const splitTopLevelEntries = (source) => {
  const entries = []
  let start = 0
  let roundDepth = 0
  let squareDepth = 0
  let curlyDepth = 0
  let quote = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '(') roundDepth += 1
    else if (char === ')') roundDepth -= 1
    else if (char === '[') squareDepth += 1
    else if (char === ']') squareDepth -= 1
    else if (char === '{') curlyDepth += 1
    else if (char === '}') curlyDepth -= 1
    else if (char === ',' && roundDepth === 0 && squareDepth === 0 && curlyDepth === 0) {
      const entry = source.slice(start, index).trim()
      if (entry) entries.push(entry)
      start = index + 1
    }
  }

  const last = source.slice(start).trim()
  if (last) entries.push(last)
  return entries
}

const parseExpressionFunctions = (runtimeSource) => {
  const marker = 'self.C3_ExpressionFuncs = ['
  const markerIndex = runtimeSource.indexOf(marker)
  if (markerIndex < 0) throw new Error('c3runtime.js 中未找到 C3_ExpressionFuncs')
  const openIndex = runtimeSource.indexOf('[', markerIndex)
  const closeIndex = findMatchingBracket(runtimeSource, openIndex, '[', ']')
  return splitTopLevelEntries(runtimeSource.slice(openIndex + 1, closeIndex))
}

const constantExpressionValue = (source) => {
  const match = source.match(/^\(\)\s*=>\s*(-?(?:\d+(?:\.\d+)?|\.\d+))$/s)
  return match ? Number(match[1]) : null
}

const parseFunctionNameIndex = (source) => {
  const result = new Map()
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^(\d+)\t(.+)\t(\d+)$/)
    if (!match) continue
    result.set(match[2], { eventNumber: Number(match[1]), sid: match[3] })
  }
  return result
}

const visitArrays = (node, visitor, currentPath = []) => {
  if (!Array.isArray(node)) return
  visitor(node, currentPath)
  for (let index = 0; index < node.length; index += 1) {
    if (Array.isArray(node[index])) visitArrays(node[index], visitor, [...currentPath, index])
  }
}

const visitFunctionArrays = (root, visitor) => {
  const visit = (node, currentPath, isRoot) => {
    if (!Array.isArray(node)) return
    if (!isRoot && node[0] === 3 && Array.isArray(node[1]) && node[1][0] === true && typeof node[1][1] === 'string') return
    visitor(node, currentPath)
    for (let index = 0; index < node.length; index += 1) {
      if (Array.isArray(node[index])) visit(node[index], [...currentPath, index], false)
    }
  }
  visit(root, [], true)
}

const findFunctionNodes = (data) => {
  const result = new Map()
  visitArrays(data, (node, nodePath) => {
    if (node[0] !== 3 || !Array.isArray(node[1]) || node[1][0] !== true || typeof node[1][1] !== 'string') return
    result.set(node[1][1], { node, path: nodePath })
  })
  return result
}

const findBlockNodes = (data) => {
  const result = new Map()
  visitArrays(data, (node, nodePath) => {
    if (node[0] !== 4 || !Array.isArray(node[1]) || typeof node[1][0] !== 'string') return
    result.set(node[1][0], { node, path: nodePath })
  })
  return result
}

const collectExpressionIds = (root) => {
  const ids = new Set()
  visitArrays(root, (node) => {
    if ((node[0] === 0 || node[0] === 7) && Array.isArray(node[1]) && Number.isInteger(node[1][0])) {
      ids.add(node[1][0])
    }
  })
  return [...ids].sort((left, right) => left - right)
}

const constantExpressionLiteral = (source) => {
  const match = source.match(/^\(\)\s*=>\s*((?:-?(?:\d+(?:\.\d+)?|\.\d+))|(?:"(?:[^"\\]|\\.)*"))$/s)
  if (!match) return undefined
  return JSON.parse(match[1])
}

const collectStatusTimingEvidence = (functionNodes, expressionFunctions) => {
  const globalGroup = functionNodes.get('战斗技能及buff冷却、生命恢复、燃烧、中毒等')
  const durationFunction = functionNodes.get('冷却及状态时间计算function')
  const pulseFunction = functionNodes.get('buff伤害计算function')
  if (!globalGroup || !durationFunction || !pulseFunction) throw new Error('原版缺少状态节拍证据函数')

  let everyEvent = null
  visitFunctionArrays(globalGroup.node, (node, nodePath) => {
    if (node[0] !== 0) return
    const condition = (node[6] ?? []).find((item) => item[0] === -1 && item[1] === 98)
    if (!condition) return
    const expressionId = condition[9]?.[0]?.[1]?.[0]
    everyEvent = {
      eventNumber: node[5],
      eventSid: String(node[4]),
      path: [...globalGroup.path, ...nodePath],
      expressionId,
      seconds: constantExpressionValue(expressionFunctions[expressionId] ?? ''),
    }
  })
  if (!everyEvent || everyEvent.seconds !== 1) throw new Error('原版全局状态节拍不再是 Every(1)')

  const expectedGateSids = new Map([
    ['530543827007591', '游戏暂停=false'],
    ['887625847774102', '战斗开关=true'],
    ['419596700017711', '战斗暂停=false'],
  ])
  const gates = []
  visitFunctionArrays(globalGroup.node, (node) => {
    if (node[0] !== -1 || node[1] !== 35) return
    const variableSid = String(node[9]?.[0]?.[1])
    const rule = expectedGateSids.get(variableSid)
    if (rule) gates.push({ variableSid, inverted: Boolean(node[5]), rule })
  })
  if (gates.length !== expectedGateSids.size) throw new Error('原版状态节拍门控发生变化')

  const durationExpressionId = 10812
  const durationExpressionSource = expressionFunctions[durationExpressionId] ?? ''
  if (!durationExpressionSource.includes('ExpObject(v1.GetValue(), v2.GetValue(), 3)')
    || !durationExpressionSource.includes('C3.clamp(subtract(')) {
    throw new Error('原版 time 型状态持续时间扣减表达式发生变化')
  }

  const pulseCallNames = new Set(['生命恢复', '流血效果', '燃烧效果', '中毒效果', '恢复效果'])
  const callOrder = []
  visitFunctionArrays(pulseFunction.node, (node, nodePath) => {
    if (node[0] !== -2 || !pulseCallNames.has(node[1])) return
    callOrder.push({ name: node[1], eventSid: String(node[3]), path: [...pulseFunction.path, ...nodePath] })
  })
  const expectedCallOrder = ['生命恢复', '流血效果', '燃烧效果', '中毒效果', '恢复效果']
  if (!expectedCallOrder.every((name, index) => callOrder[index]?.name === name)) {
    throw new Error(`原版状态脉冲顺序发生变化：${callOrder.map((item) => item.name).join(' → ')}`)
  }

  return {
    globalEvent: {
      sid: String(globalGroup.node[4]),
      eventNumber: globalGroup.node[5],
      path: globalGroup.path,
      every: everyEvent,
      gates,
    },
    duration: {
      sid: String(durationFunction.node[4]),
      eventNumber: durationFunction.node[5],
      path: durationFunction.path,
      expressionId: durationExpressionId,
      expressionSource: durationExpressionSource,
      expiryEventNumber: 2756,
    },
    pulse: {
      sid: String(pulseFunction.node[4]),
      eventNumber: pulseFunction.node[5],
      path: pulseFunction.path,
      callOrder,
    },
    rules: [
      '状态持续时间只在游戏未暂停、战斗开启且战斗未暂停时扣减。',
      'time 型状态先扣减并在归零时清除，随后才执行全局 Every(1)，同帧到期没有最后一跳。',
      '全局脉冲先遍历全部单位结算生命恢复，再按单位与状态槽顺序结算流血、燃烧、中毒和持续恢复。',
    ],
  }
}

const eventBySid = (entry, sid) => {
  let result = null
  visitFunctionArrays(entry.node, (node, nodePath) => {
    if (node[0] !== 0 || !Number.isInteger(node[5]) || String(node[4]) !== sid) return
    result = { node, path: [...entry.path, ...nodePath] }
  })
  return result
}

const actionBySid = (event, sid) => {
  let result = null
  visitArrays(event.node[7] ?? [], (node, nodePath) => {
    if (String(node[3]) === sid) result = { node, path: [...event.path, 7, ...nodePath] }
  })
  return result
}

const waitSecondsAt = (event, actionSid, expressionFunctions) => {
  const action = actionBySid(event, actionSid)
  if (!action || action.node[0] !== -1 || action.node[1] !== 45) {
    throw new Error(`原版缺少 Wait action SID ${actionSid}`)
  }
  const expressionId = action.node[6]?.[0]?.[1]?.[0]
  return {
    eventNumber: event.node[5],
    eventSid: String(event.node[4]),
    actionSid,
    expressionId,
    seconds: constantExpressionValue(expressionFunctions[expressionId] ?? ''),
    path: action.path,
  }
}

const collectDeathAndWaveTimingEvidence = (functionNodes, expressionFunctions) => {
  const deathGroup = functionNodes.get('核心阵亡')
  const enemyDeath = functionNodes.get('敌方战斗核心死亡function')
  const enemyRefresh = functionNodes.get('敌人刷新')
  const normalRefresh = functionNodes.get('刷新普通关卡function')
  const hitMotion = functionNodes.get('角色受击动作function')
  if (!deathGroup || !enemyDeath || !enemyRefresh || !normalRefresh || !hitMotion) {
    throw new Error('原版缺少死亡或普通换波证据函数')
  }
  const expectedSids = [
    [deathGroup, '351044076337432', '核心阵亡'],
    [enemyDeath, '617719594657079', '敌方战斗核心死亡function'],
    [enemyRefresh, '215191533517221', '敌人刷新'],
    [normalRefresh, '689372287032647', '刷新普通关卡function'],
    [hitMotion, '464605795539924', '角色受击动作function'],
  ]
  for (const [entry, sid, name] of expectedSids) {
    if (String(entry.node[4]) !== sid) throw new Error(`原版死亡/换波证据发生变化：${name}`)
  }

  const requiredEvents = new Map([
    ['poll', [deathGroup, '247918481054430']],
    ['lethal', [deathGroup, '679696091611273']],
    ['lastReward', [deathGroup, '646228328854323']],
    ['deathEffect', [deathGroup, '200293596091032']],
    ['partyDeathImage', [deathGroup, '406558264454990']],
    ['partySummonSlotRelease', [deathGroup, '959082867152949']],
    ['partyCoreDestroy', [deathGroup, '682483761235427']],
    ['enemyDeathCall', [deathGroup, '580746185601887']],
    ['enemyDeathCleanup', [enemyDeath, '603643284305568']],
    ['waveClear', [enemyRefresh, '172106565802830']],
    ['nextWaveIncrement', [enemyRefresh, '445361822551092']],
    ['preRefreshWait', [enemyRefresh, '691621485926731']],
    ['postRefreshWait', [normalRefresh, '805788785113651']],
  ])
  const events = {}
  for (const [key, [entry, sid]] of requiredEvents) {
    const event = eventBySid(entry, sid)
    if (!event) throw new Error(`原版缺少死亡/换波事件 SID ${sid}`)
    events[key] = event
  }

  const lethalConditions = events.lethal.node[6] ?? []
  const hpZero = lethalConditions.find((condition) => condition[0] === 245 && condition[1] === 74
    && condition[9]?.[0]?.[0] === 10 && condition[9]?.[0]?.[1] === 6)
  const survival = lethalConditions.find((condition) => condition[0] === 245 && condition[1] === 70
    && condition[9]?.[0]?.[0] === 10 && condition[9]?.[0]?.[1] === 28)
  if (!hpZero || hpZero[9]?.[2]?.[1]?.[0] !== 2 || !survival) {
    throw new Error('原版气血归零且生存开关开启的死亡门槛发生变化')
  }

  const hitWaits = []
  visitFunctionArrays(hitMotion.node, (node, nodePath) => {
    if (node[0] !== -1 || node[1] !== 45) return
    const expressionId = node[6]?.[0]?.[1]?.[0]
    hitWaits.push({
      actionSid: String(node[3]),
      expressionId,
      seconds: constantExpressionValue(expressionFunctions[expressionId] ?? ''),
      path: [...hitMotion.path, ...nodePath],
    })
  })
  if (hitWaits.length !== 2 || hitWaits.some((wait) => wait.seconds !== 0.2)) {
    throw new Error('原版角色受击位移不再是两支各 Wait(0.2)')
  }

  const preRefresh = waitSecondsAt(events.preRefreshWait, '261346173710147', expressionFunctions)
  const postRefresh = waitSecondsAt(events.postRefreshWait, '144119498354041', expressionFunctions)
  if (preRefresh.seconds !== 0.5 || postRefresh.seconds !== 0.5) {
    throw new Error('原版普通换波不再是 0.5 秒清场等待 + 0.5 秒生成等待')
  }

  const rewardBeforeDeath = events.lastReward.node[5] < events.deathEffect.node[5]
    && events.deathEffect.node[5] < events.enemyDeathCall.node[5]
  if (!rewardBeforeDeath) throw new Error('原版击杀收益、死亡特效和核心死亡顺序发生变化')

  return {
    functions: {
      deathGroup: { name: '核心阵亡', sid: String(deathGroup.node[4]), eventNumber: deathGroup.node[5], path: deathGroup.path },
      enemyDeath: { name: '敌方战斗核心死亡function', sid: String(enemyDeath.node[4]), eventNumber: enemyDeath.node[5], path: enemyDeath.path },
      enemyRefresh: { name: '敌人刷新', sid: String(enemyRefresh.node[4]), eventNumber: enemyRefresh.node[5], path: enemyRefresh.path },
      normalRefresh: { name: '刷新普通关卡function', sid: String(normalRefresh.node[4]), eventNumber: normalRefresh.node[5], path: normalRefresh.path },
    },
    hitMotion: { sid: String(hitMotion.node[4]), eventNumber: hitMotion.node[5], waits: hitWaits },
    lethalCheck: {
      eventNumber: events.lethal.node[5],
      eventSid: String(events.lethal.node[4]),
      hpFieldIndex: 6,
      survivalFieldIndex: 28,
      hpThreshold: 0,
    },
    settlementOrder: {
      lastRewardEvent: events.lastReward.node[5],
      deathEffectEvent: events.deathEffect.node[5],
      partyDeathImageEvent: events.partyDeathImage.node[5],
      partySummonSlotReleaseEvent: events.partySummonSlotRelease.node[5],
      partyCoreDestroyEvent: events.partyCoreDestroy.node[5],
      enemyDeathCallEvent: events.enemyDeathCall.node[5],
      enemyDeathCleanupEvent: events.enemyDeathCleanup.node[5],
    },
    normalWaveTransition: {
      waveClearEvent: events.waveClear.node[5],
      nextWaveIncrementEvent: events.nextWaveIncrement.node[5],
      preRefresh,
      postRefresh,
      totalSeconds: preRefresh.seconds + postRefresh.seconds,
    },
    deathImage: {
      objectTypeId: 691,
      source: 'images/shared-3-sheet1.webp',
      crop: { x: 198, y: 897, width: 76, height: 72 },
      appliesTo: '我方非召唤单位',
    },
    rules: [
      '气血归零且生存开关仍开启时才进入一次性阵亡结算。',
      '同一 tick 内先结算任务、货币、掉落和经验，再创建消灭/阵亡表现，最后清理或关闭战斗核心。',
      '我方非召唤单位保留死亡形象以供复活；召唤单位直接释放阵位；敌方隐藏核心附件与角色形象。',
      '普通换波先关闭战斗，等待 0.5 秒后刷新敌方，再等待 0.5 秒恢复战斗，总冻结 1 秒。',
    ],
  }
}

const collectStartAndRestartTimingEvidence = (
  data,
  functionNodes,
  expressionFunctions,
  deathAndWaveTimingEvidence,
) => {
  const battleStart = functionNodes.get('战斗开始function')
  const settlement = functionNodes.get('位面战斗结算')
  const enemyRefresh = functionNodes.get('敌人刷新')
  const restartToggle = functionNodes.get('开启自动重新挑战function')
  const restartCountdown = functionNodes.get('自动挑战倒计时')
  if (!battleStart || !settlement || !enemyRefresh || !restartToggle || !restartCountdown) {
    throw new Error('原版缺少首波启动、最终胜负或自动重新挑战证据函数')
  }

  let normalStartEvent = null
  visitFunctionArrays(battleStart.node, (node, nodePath) => {
    if (node[0] !== 0 || !Array.isArray(node[7])) return
    if (!node[7].some((action) => action[0] === -2 && action[1] === '刷新普通关卡')) return
    normalStartEvent = { node, path: [...battleStart.path, ...nodePath] }
  })
  if (!normalStartEvent) throw new Error('原版战斗开始缺少普通关卡分支')
  const startActions = normalStartEvent.node[7]
  const waitIndex = startActions.findIndex((action) => action[0] === -1 && action[1] === 45)
  const createCoreIndex = startActions.findIndex((action) => action[0] === -2 && action[1] === '创建敌方战斗核心')
  const refreshIndex = startActions.findIndex((action) => action[0] === -2 && action[1] === '刷新普通关卡')
  if (waitIndex < 0 || createCoreIndex < 0 || refreshIndex < 0 || !(createCoreIndex < waitIndex && waitIndex < refreshIndex)) {
    throw new Error('原版首波创建核心、等待、刷新普通关卡的顺序发生变化')
  }
  const startWaitAction = startActions[waitIndex]
  const startWaitExpressionId = startWaitAction[6]?.[0]?.[1]?.[0]
  const startWaitSeconds = constantExpressionValue(expressionFunctions[startWaitExpressionId] ?? '')
  if (startWaitSeconds !== 1) throw new Error('原版首波创建敌方核心后的等待不再是 1 秒')

  const countdownVariable = settlement.node[8]
    ?.find((node) => Array.isArray(node) && node[0] === 1 && node[1] === '自动挑战倒计时')
  const countdownSwitch = settlement.node[8]
    ?.find((node) => Array.isArray(node) && node[0] === 1 && node[1] === '挑战倒计时开关')
  if (!countdownVariable || !countdownSwitch) throw new Error('原版自动重新挑战倒计时局部变量发生变化')

  const restartBlocks = findBlockNodes(restartToggle.node)
  const startCountdownBlock = restartBlocks.get('自动重新挑战计时')
  const stopCountdownBlock = restartBlocks.get('停止自动挑战计时')
  if (!startCountdownBlock || !stopCountdownBlock) throw new Error('原版缺少自动重新挑战计时开关事件块')
  const resetActions = [startCountdownBlock, stopCountdownBlock].map((block) => {
    const action = block.node[7]?.find((node) => node[0] === -1 && node[1] === 53)
    const expressionId = action?.[6]?.[1]?.[1]?.[0]
    return {
      block: block.node[1][0],
      eventNumber: block.node[5],
      eventSid: String(block.node[4]),
      actionSid: String(action?.[3]),
      expressionId,
      expressionSource: expressionFunctions[expressionId] ?? null,
      seconds: constantExpressionValue(expressionFunctions[expressionId] ?? ''),
      path: action ? [...block.path, 7, block.node[7].indexOf(action)] : block.path,
    }
  })
  const defaultSeconds = countdownVariable[3]
  if (defaultSeconds !== 3 || resetActions.some((item) => item.seconds !== 3)) {
    throw new Error('原版自动重新挑战倒计时不再固定为 3 秒')
  }

  const requiredEndingEvents = new Map([
    ['continuousVictory', [enemyRefresh, '380637953260173']],
    ['settlementVictory', [enemyRefresh, '921703769408789']],
    ['partyWipe', [enemyRefresh, '290999630127092']],
    ['normalDefeatBranch', [enemyRefresh, '780314903999960']],
    ['normalDefeatSettlement', [enemyRefresh, '490030515080800']],
    ['normalDefeatRestart', [enemyRefresh, '356632421204959']],
    ['alternateDefeatSettlement', [enemyRefresh, '618112224628368']],
    ['alternateDefeatRestart', [enemyRefresh, '587594229796995']],
    ['countdownEvery', [restartCountdown, '562190638419860']],
    ['countdownZero', [restartCountdown, '165760752383539']],
    ['normalRestart', [restartCountdown, '947334150945665']],
  ])
  const endingEvents = {}
  for (const [key, [entry, sid]] of requiredEndingEvents) {
    const event = eventBySid(entry, sid)
    if (!event) throw new Error(`原版缺少最终胜负/自动重开事件 SID ${sid}`)
    endingEvents[key] = event
  }

  const continuousVictoryWait = waitSecondsAt(
    endingEvents.continuousVictory,
    '188525945068446',
    expressionFunctions,
  )
  const settlementVictoryWait = waitSecondsAt(
    endingEvents.settlementVictory,
    '265246203017905',
    expressionFunctions,
  )
  const defeatWaits = [
    waitSecondsAt(endingEvents.normalDefeatSettlement, '680533869020676', expressionFunctions),
    waitSecondsAt(endingEvents.alternateDefeatSettlement, '417290871187010', expressionFunctions),
  ]
  const restartCloseWait = waitSecondsAt(
    endingEvents.normalRestart,
    '939735179177550',
    expressionFunctions,
  )
  const everyCondition = endingEvents.countdownEvery.node[6]
    ?.find((condition) => condition[0] === -1 && condition[1] === 98)
  const everyExpressionId = everyCondition?.[9]?.[0]?.[1]?.[0]
  const everySeconds = constantExpressionValue(expressionFunctions[everyExpressionId] ?? '')
  if (continuousVictoryWait.seconds !== 0.8
    || settlementVictoryWait.seconds !== 1
    || defeatWaits.some((wait) => wait.seconds !== 1)
    || everySeconds !== 1
    || restartCloseWait.seconds !== 0.3) {
    throw new Error('原版最终胜负或自动重新挑战等待常量发生变化')
  }

  const actionIndex = (event, predicate) => event.node[7]?.findIndex(predicate) ?? -1
  const continuousVictoryOrder = [
    actionIndex(endingEvents.continuousVictory, (action) => action[0] === -1 && action[1] === 45),
    actionIndex(endingEvents.continuousVictory, (action) => action[0] === -2 && action[1] === '战斗结束'),
    actionIndex(endingEvents.continuousVictory, (action) => action[0] === 240 && action[1] === 40),
    actionIndex(endingEvents.continuousVictory, (action) => action[0] === -2 && action[1] === '战斗开始'),
  ]
  const normalRestartOrder = [
    actionIndex(endingEvents.normalRestart, (action) => action[0] === -2 && action[1] === '战斗结束'),
    actionIndex(endingEvents.normalRestart, (action) => action[0] === -1 && action[1] === 45),
    actionIndex(endingEvents.normalRestart, (action) => action[0] === -2 && action[1] === '关闭战斗结算'),
    actionIndex(endingEvents.normalRestart, (action) => action[0] === -2 && action[1] === '设置战斗速度'),
    actionIndex(endingEvents.normalRestart, (action) => action[0] === -2 && action[1] === '战斗开始'),
  ]
  if (continuousVictoryOrder.some((index) => index < 0)
    || continuousVictoryOrder.some((index, position) => position > 0 && index <= continuousVictoryOrder[position - 1])
    || normalRestartOrder.some((index) => index < 0)
    || normalRestartOrder.some((index, position) => position > 0 && index <= normalRestartOrder[position - 1])) {
    throw new Error('原版连续胜利或普通自动重开的动作顺序发生变化')
  }

  const countdownExpressionIds = [...collectExpressionIds(restartCountdown.node)].sort((a, b) => a - b)
  return {
    initialWave: {
      eventNumber: normalStartEvent.node[5],
      eventSid: String(normalStartEvent.node[4]),
      createCoreActionSid: String(startActions[createCoreIndex][3]),
      waitActionSid: String(startWaitAction[3]),
      refreshActionSid: String(startActions[refreshIndex][3]),
      preRefreshSeconds: startWaitSeconds,
      postRefreshSeconds: deathAndWaveTimingEvidence.normalWaveTransition.postRefresh.seconds,
      totalSeconds: startWaitSeconds + deathAndWaveTimingEvidence.normalWaveTransition.postRefresh.seconds,
      path: normalStartEvent.path,
    },
    autoRestart: {
      countdownVariable: { sid: String(countdownVariable[6]), defaultSeconds },
      switchVariable: { sid: String(countdownSwitch[6]), defaultValue: countdownSwitch[3] },
      resetActions,
      countdownFunction: {
        sid: String(restartCountdown.node[4]),
        eventNumber: restartCountdown.node[5],
        expressionIds: countdownExpressionIds,
        expressions: countdownExpressionIds.map((expressionId) => ({
          expressionId,
          expressionSource: expressionFunctions[expressionId] ?? null,
          constant: constantExpressionValue(expressionFunctions[expressionId] ?? ''),
        })),
      },
      every: {
        eventNumber: endingEvents.countdownEvery.node[5],
        eventSid: String(endingEvents.countdownEvery.node[4]),
        expressionId: everyExpressionId,
        seconds: everySeconds,
      },
      zeroEvent: {
        eventNumber: endingEvents.countdownZero.node[5],
        eventSid: String(endingEvents.countdownZero.node[4]),
      },
      normalRestart: {
        eventNumber: endingEvents.normalRestart.node[5],
        eventSid: String(endingEvents.normalRestart.node[4]),
        closeWait: restartCloseWait,
        totalSeconds: defaultSeconds + restartCloseWait.seconds,
      },
    },
    ending: {
      continuousVictory: {
        eventNumber: endingEvents.continuousVictory.node[5],
        eventSid: String(endingEvents.continuousVictory.node[4]),
        wait: continuousVictoryWait,
      },
      settlementVictory: {
        eventNumber: endingEvents.settlementVictory.node[5],
        eventSid: String(endingEvents.settlementVictory.node[4]),
        wait: settlementVictoryWait,
      },
      defeat: {
        partyWipeEvent: endingEvents.partyWipe.node[5],
        normalBranchEvent: endingEvents.normalDefeatBranch.node[5],
        settlementEvents: [endingEvents.normalDefeatSettlement.node[5], endingEvents.alternateDefeatSettlement.node[5]],
        restartEvents: [endingEvents.normalDefeatRestart.node[5], endingEvents.alternateDefeatRestart.node[5]],
        waits: defeatWaits,
      },
    },
    rules: [
      '普通关卡首波在创建敌方战斗核心后等待 1 秒，再刷新普通关卡；刷新完成后再等待 0.5 秒开启战斗，总启动冻结 1.5 秒。',
      '普通关卡最终胜利的连续推进分支等待 0.8 秒后结束战斗、更新关卡并开始下一场；非连续分支等待 1 秒后打开胜利结算。',
      '普通关卡失败在我方团灭后等待 1 秒打开失败结算，随后开启自动重新挑战计时。',
      '自动重新挑战使用独立倒计时开关，开始与停止时都把倒计时重置为 3 秒；Every(1) 归零后结束战斗，再等待 0.3 秒关闭结算并开始下一场。',
      '驻守胜利自动重复是本项目保留的挂机语义；其 1 秒结算等待与 3.3 秒自动重开分别取自原版证据，原版普通非连续胜利分支没有直接调用自动重开。',
    ],
  }
}

const collectSkillAiEvidence = (data, expressionFunctions) => {
  const blocks = findBlockNodes(data.project)
  const selection = blocks.get('自动战斗技能选择')
  const conditions = blocks.get('自动技能条件判断')
  if (!selection || !conditions) throw new Error('原版缺少自动战斗技能选择证据块')

  const selectionExpressionIds = collectExpressionIds(selection.node)
  const conditionExpressionIds = collectExpressionIds(conditions.node)
  const allExpressionSources = [...new Set([...selectionExpressionIds, ...conditionExpressionIds])]
    .map((id) => expressionFunctions[id] ?? '')
  const randomExpressionIds = [...new Set([...selectionExpressionIds, ...conditionExpressionIds])]
    .filter((id) => /random/i.test(expressionFunctions[id] ?? ''))

  const selectionLocals = selection.node[1][2] ?? []
  const latch = selectionLocals.find((variable) => variable[1] === '检测')
  if (!latch || latch[3] !== true) throw new Error('自动技能选择的“检测”锁存变量结构发生变化')
  const latchSid = latch[6]
  const latchFalseActions = []
  visitArrays(selection.node, (node, nodePath) => {
    if (node[0] !== -1 || node[1] !== 56) return
    if (node[6]?.[0]?.[0] !== 11 || node[6][0][1] !== latchSid) return
    if (node[6]?.[1]?.[0] !== 3 || node[6][1][1] !== 0) return
    latchFalseActions.push({ eventSid: String(node[3]), path: [...selection.path, ...nodePath] })
  })

  const expectedLiterals = ['自身增加能量', '我方复活', '生命治疗', '召唤', '自身状态', 338, 341, 3.5, 5]
  const literalEvidence = expectedLiterals.map((value) => {
    const expressionId = conditionExpressionIds.find((id) => constantExpressionLiteral(expressionFunctions[id] ?? '') === value)
    if (expressionId === undefined) throw new Error(`自动技能条件证据缺少常量 ${JSON.stringify(value)}`)
    return { value, expressionId, expressionSource: expressionFunctions[expressionId] }
  })

  const requiredSourcePatterns = [
    /ExpObject\(v1\.GetValue\(\), 15\)/,
    /ExpObject\(v1\.GetValue\(\), 37\)/,
    /ExpObject\(v1\.GetValue\(\), 21\)/,
    /ExpObject\(n1\.ExpObject\(v2\.GetValue\(\), 21\), 9\)/,
  ]
  if (requiredSourcePatterns.some((pattern) => !allExpressionSources.some((source) => pattern.test(source)))) {
    throw new Error('自动技能条件读取的 jn/buff/战斗字段结构发生变化')
  }
  if (latchFalseActions.length < 4 || randomExpressionIds.length > 0) {
    throw new Error('自动技能的顺序锁存或随机性证据发生变化')
  }

  return {
    selectionBlock: {
      path: selection.path,
      sid: String(selection.node[4]),
      eventNumber: selection.node[5],
      latch: { name: latch[1], sid: String(latchSid), initialValue: latch[3] },
      latchFalseActions,
      expressionIds: selectionExpressionIds,
      randomExpressionIds,
    },
    conditionBlock: {
      path: conditions.path,
      sid: String(conditions.node[4]),
      eventNumber: conditions.node[5],
      expressionIds: conditionExpressionIds,
      literalEvidence,
    },
    fields: {
      behavior: 15,
      energyCost: 19,
      appliedBuffId: 21,
      buffMaxStacks: 9,
      summonId: 51,
    },
    rules: [
      '技能按栏位顺序扫描；选中后把“检测”置为 false，后续候选不能覆盖。',
      '选择链没有 Random 表达式；0 耗攻击技能同样取最左可用项。',
      '自身增加能量在能量达到 5 时禁用。',
      '我方复活在没有合法阵亡目标时禁用。',
      '生命治疗在没有受伤目标时禁用，但技能 338、341 例外。',
      '召唤在召唤数量判定不满足时禁用。',
      '自身状态已有同 buff、达到 buff[9] 最大层数且剩余时间大于 3.5 秒时禁用。',
      '所有栏位均不可用时回退职业普攻。',
    ],
  }
}

const directConditionLiterals = (eventNode, expressionFunctions) =>
  collectExpressionIds(eventNode[6] ?? [])
    .map((id) => constantExpressionLiteral(expressionFunctions[id] ?? ''))
    .filter((value) => value !== undefined)

const priorityGroupsFromBlock = (entry, expressionFunctions) => {
  const groups = []
  visitArrays(entry.node, (node) => {
    if (node[0] !== 0) return
    const children = (node[8] ?? []).filter((child) => Array.isArray(child) && child[0] === 0)
    if (children.length !== 15) return
    const priorities = children.map((child) =>
      directConditionLiterals(child, expressionFunctions).find((value) => Number.isInteger(value) && value >= 1 && value <= 15))
    if (priorities.some((value) => value === undefined)) return
    const sourceRow = directConditionLiterals(node, expressionFunctions)
      .find((value) => Number.isInteger(value) && value >= 1 && value <= 3)
    groups.push({ eventNumber: node[5], eventSid: String(node[4]), sourceRow: sourceRow ?? null, priorities })
  })
  return groups
}

const hasSortAction = (entry, direction, variableIndex) => {
  let found = false
  visitArrays(entry.node, (node) => {
    if (node[0] !== 245 || node[1] !== 288) return
    const parameters = node[9] ?? []
    if (!Array.isArray(parameters)) return
    if (parameters.some((parameter) => parameter[0] === 3 && parameter[1] === direction)
      && parameters.some((parameter) => parameter[0] === 10 && parameter[1] === variableIndex)) {
      found = true
    }
  })
  return found
}

const collectTargetingEvidence = (data, expressionFunctions, fwSource) => {
  const blocks = findBlockNodes(data.project)
  const requiredNames = [
    '技能范围阵位号',
    '攻击目标阵位号',
    '攻击目标阵位号非首领',
    '治疗目标阵位号',
    '能量目标阵位号',
    '复活目标阵位号',
    '召唤空地阵位号',
  ]
  const missing = requiredNames.filter((name) => !blocks.has(name))
  if (missing.length > 0) throw new Error(`原版缺少目标选择证据块：${missing.join('、')}`)

  const expectedAttackPriorities = [
    [11, 12, 13, 14, 15, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5],
    [11, 12, 13, 14, 15, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  ]
  const attackGroups = priorityGroupsFromBlock(blocks.get('攻击目标阵位号'), expressionFunctions)
    .filter((group) => group.sourceRow !== null)
    .sort((left, right) => left.sourceRow - right.sourceRow)
  const nonBossGroups = priorityGroupsFromBlock(blocks.get('攻击目标阵位号非首领'), expressionFunctions)
    .filter((group) => group.sourceRow !== null)
    .sort((left, right) => left.sourceRow - right.sourceRow)
  if (JSON.stringify(attackGroups.map((group) => group.priorities)) !== JSON.stringify(expectedAttackPriorities)
    || JSON.stringify(nonBossGroups.map((group) => group.priorities)) !== JSON.stringify(expectedAttackPriorities)) {
    throw new Error('原版攻击目标阵位优先序发生变化')
  }

  const expectedSummonPriority = [1, 11, 6, 2, 12, 7, 3, 13, 8, 4, 14, 9, 5, 15, 10]
  const summonGroup = priorityGroupsFromBlock(blocks.get('召唤空地阵位号'), expressionFunctions)
    .find((group) => group.sourceRow === null)
  if (!summonGroup || JSON.stringify(summonGroup.priorities) !== JSON.stringify(expectedSummonPriority)) {
    throw new Error('原版召唤空位优先序发生变化')
  }

  const slotNormalization = expressionFunctions[2095] ?? ''
  const rangeLookup = expressionFunctions[2096] ?? ''
  if (!/GetValue\(\) - 15/.test(slotNormalization)
    || !/ExpObject\(\(v1\.GetValue\(\) \+ \(15 \* \(v2\.GetValue\(\) - 1\)\)\), v3\.GetValue\(\)\)/.test(rangeLookup)) {
    throw new Error('原版技能范围阵位公式发生变化')
  }
  if (!hasSortAction(blocks.get('治疗目标阵位号'), 0, 18)) {
    throw new Error('原版治疗目标不再按生命比例升序')
  }
  if (!hasSortAction(blocks.get('能量目标阵位号'), 1, 24)) {
    throw new Error('原版能量目标不再按攻击降序')
  }

  const fw = JSON.parse(fwSource)
  if (!fw.c2array || fw.size?.[0] !== 600 || fw.size?.[1] !== 21) {
    throw new Error('原版 fw 范围表结构发生变化')
  }
  const blockEvidence = Object.fromEntries(requiredNames.map((name) => {
    const entry = blocks.get(name)
    return [name, {
      path: entry.path,
      sid: String(entry.node[4]),
      eventNumber: entry.node[5],
      expressionIds: collectExpressionIds(entry.node),
    }]
  }))

  return {
    blocks: blockEvidence,
    formulas: {
      enemySlotNormalization: { expressionId: 2095, expressionSource: slotNormalization },
      rangeLookup: { expressionId: 2096, expressionSource: rangeLookup },
    },
    combatCoreFields: {
      side: 1,
      slot: 2,
      row: 3,
      healthRatio: 18,
      attack: 24,
      survival: 28,
    },
    rangeTable: { rowCount: fw.size[0], columnCount: fw.size[1], generatedRangeCount: 36, slotsPerSide: 15 },
    attackPriorities: attackGroups,
    nonBossAttackPriorities: nonBossGroups,
    summonEmptySlotPriority: summonGroup,
    rules: [
      '全局阵位号大于 15 时先减 15，再作为单边本地阵位号查询。',
      '范围命中使用 fw[尝试阵位 + 15 × (范围类型 - 1), 核心阵位]；fw 范围标记为“目标”时强制包含主目标。',
      '我方攻击在首领与小兵并存时使用“非首领”目标块；仅剩首领时仍可选择首领。',
      '生命治疗按战斗核心字段 18“生命比例”升序选择主目标。',
      '增加能量与我方进度排除召唤物，并按战斗核心字段 24“攻击”降序选择主目标。',
      '复活按阵位网格顺序取首个阵亡目标；自身类技能与我方状态以施法者阵位为范围核心。',
      '召唤空位使用固定阵位序 1,11,6,2,12,7,3,13,8,4,14,9,5,15,10。',
    ],
  }
}

const c2Rows = (source) => JSON.parse(source).data.map((column) => column.map((cell) => cell[0]))

const collectWaveEvidence = (
  functionNodes,
  expressionFunctions,
  sqSource,
  drSource,
  drsxSource,
  zxSource,
) => {
  const requiredFunctions = {
    randomFormation: ['随机阵型编号function', '744307687935985'],
    enemyAttribute: ['敌人属性function', '891906700468170'],
    enemyCore: ['生成敌方战斗核心function', '411719608121661'],
    refreshCombatAttribute: ['刷新角色战斗属性function', '435654228486105'],
  }
  const functions = {}
  for (const [key, [name, sid]] of Object.entries(requiredFunctions)) {
    const entry = functionNodes.get(name)
    if (!entry || String(entry.node[4]) !== sid) throw new Error(`原版波次证据函数发生变化：${name}`)
    functions[key] = { name, sid, eventNumber: entry.node[5], path: entry.path }
  }

  const randomNormalSource = expressionFunctions[10464] ?? ''
  const randomBossSource = expressionFunctions[10463] ?? ''
  const difficultySource = expressionFunctions[10475] ?? ''
  if (!/f0\(3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18\)/.test(randomNormalSource)
    || !/f0\(19, 20, 21, 22, 23\)/.test(randomBossSource)) {
    throw new Error('原版随机阵型池发生变化')
  }
  if (!/\(v0\.GetValue\(\) - 1\) \* 100/.test(difficultySource)
    || !/\(v1\.GetValue\(\) - 1\) \* 10/.test(difficultySource)
    || !/\+ v2\.GetValue\(\)/.test(difficultySource)) {
    throw new Error('原版普通战斗难度系数公式发生变化')
  }

  const rankExpressionIds = [10479, 10481, 10484, 10485, 10492, 10493, 10494, 10495, 10496]
  const attributeExpressionIds = Array.from({ length: 16 }, (_, index) => 10501 + index)
  if ([...rankExpressionIds, ...attributeExpressionIds].some((id) => !expressionFunctions[id])) {
    throw new Error('原版敌人属性表达式缺失')
  }

  const sq = c2Rows(sqSource)
  const dr = c2Rows(drSource)
  const drsx = c2Rows(drsxSource)
  const zx = c2Rows(zxSource)
  const stageRows = sq.slice(1).filter((row) => Number.isInteger(row[2]) && row[2] >= 1 && row[2] <= 13
    && Number.isInteger(row[13]) && row[13] >= 1 && row[13] <= 10)
  if (stageRows.length !== 130) throw new Error(`原版 sq 普通地点数量发生变化：${stageRows.length}`)
  if (JSON.stringify(drsx[1]?.slice(2, 8)) !== JSON.stringify([110, 110, 120, 100, 80, 90])) {
    throw new Error('原版 drsx 六维模板结构发生变化')
  }

  const formations = {}
  for (let formationId = 1; formationId <= 23; formationId += 1) {
    const row = zx[formationId]
    if (!row) throw new Error(`原版缺少 zx#${formationId}`)
    formations[formationId] = row.slice(1, 16)
      .map((enemyIndex, index) => ({ localPosition: index + 1, enemyIndex }))
      .filter(({ enemyIndex }) => enemyIndex !== '')
  }
  if (formations[1].length !== 2 || formations[2].length !== 3
    || Array.from({ length: 16 }, (_, index) => formations[index + 3]).some((formation) => formation.length !== 5)
    || Array.from({ length: 5 }, (_, index) => formations[index + 19]).some((formation) => formation.length !== 6)) {
    throw new Error('原版 zx 波次人数结构发生变化')
  }
  if (Object.values(formations).some((formation) => formation.some(({ enemyIndex }) =>
    !Number.isInteger(enemyIndex) || enemyIndex < 1 || enemyIndex > 6))) {
    throw new Error('原版 zx 敌人编号超出 1..6')
  }
  const stageBossRows = stageRows.map((row) => dr[row[8]])
  if (stageBossRows.length !== 130 || stageBossRows.some((row) => row?.[4] !== 4 || row?.[5] !== '首领')) {
    throw new Error('原版 dr 首领类型字段发生变化')
  }

  return {
    functions,
    formations,
    formationPools: {
      wave1: [1],
      wave2: [2],
      wave3To9: Array.from({ length: 16 }, (_, index) => index + 3),
      wave10: Array.from({ length: 5 }, (_, index) => index + 19),
    },
    rankChances: {
      wave1To3: { normal: 100, elite: 0, captain: 0 },
      wave4OnwardPerMob: { normal: 80, elite: 16, captain: 4 },
      enemyIndex6: 'boss',
    },
    difficulty: {
      expressionId: 10475,
      expressionSource: difficultySource,
      formula: '(difficulty - 1) * 100 + (locationId - 1) * 10 + wave',
      locationCount: stageRows.length,
    },
    growthOrder: ['生命', '速度', '物攻', '物防', '法攻', '法防'],
    rankExpressions: Object.fromEntries(rankExpressionIds.map((id) => [id, expressionFunctions[id]])),
    attributeExpressions: Object.fromEntries(attributeExpressionIds.map((id) => [id, expressionFunctions[id]])),
    rules: [
      'zx 列 1..15 对应单边本地阵位 1..15，敌方战斗核心阵位为 15 + 本地阵位。',
      'zx 值 1..5 对应 sq 的五种小怪，值 6 对应首领；同阵型允许重复怪种。',
      '第 1 波固定 zx#1，第 2 波固定 zx#2，第 3..9 波随机 zx#3..18，第 10 波随机 zx#19..23。',
      '第 1..3 波普通怪均为小怪；第 4 波起每个普通怪独立按 80% 小怪、16% 精英、4% 头目抽取。',
      'dr 字段 4 为 4 的首领直接使用首领档，不参与普通怪品级抽取。',
      'drsx 字段 2..7 依次对应 sx6..11：生命、速度、物攻、物防、法攻、法防。',
    ],
  }
}

const sameFlatArray = (left, right) =>
  Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index])

const collectSegmentEvidence = (data, functionNodes, expressionFunctions) => {
  const objectTypes = data.project[3]
  const bulletObjectId = objectTypes.findIndex((objectType) => objectType[0] === 'zidan')
  if (bulletObjectId < 0) throw new Error('data.json 缺少 zidan 对象')
  const bulletVariables = objectTypes[bulletObjectId][3]
  const segmentVariableIndex = bulletVariables.findIndex((variable) => variable[2] === '分段数')
  if (segmentVariableIndex < 0) throw new Error('zidan 缺少“分段数”实例变量')

  const writes = []
  const reads = []
  const walk = (node, currentPath = [], context = {}) => {
    if (!Array.isArray(node)) return
    let nextContext = context
    if (node[0] === 3 && Array.isArray(node[1]) && node[1][0] === true) {
      nextContext = { ...context, functionName: node[1][1] }
    } else if (node[0] === 0) {
      nextContext = { ...context, eventNumber: node[5], eventSid: String(node[4]) }
    }

    if (sameFlatArray(node, [2, bulletObjectId, false, segmentVariableIndex])
      || sameFlatArray(node, [2, bulletObjectId, true, segmentVariableIndex])) {
      reads.push({ path: currentPath, ...nextContext })
    }
    if (node[0] === bulletObjectId && node[1] === 42 && node[6]?.[0]?.[0] === 10 && node[6][0][1] === segmentVariableIndex) {
      const expressionId = node[6]?.[1]?.[1]?.[0]
      writes.push({
        path: currentPath,
        actionSid: String(node[3]),
        expressionId: Number.isInteger(expressionId) ? expressionId : null,
        expressionSource: Number.isInteger(expressionId) ? expressionFunctions[expressionId] ?? null : null,
        ...nextContext,
      })
    }
    for (let index = 0; index < node.length; index += 1) {
      if (Array.isArray(node[index])) walk(node[index], [...currentPath, index], nextContext)
    }
  }
  walk(data.project)

  const skillFieldIndexes = [...new Set(writes.flatMap((write) => {
    const match = write.expressionSource?.match(/ExpObject\(v\d+\.GetValue\(\),\s*(\d+)\)/)
    return match ? [Number(match[1])] : []
  }))]
  const collision = functionNodes.get('子弹碰撞')
  const damageExpressionIds = new Set()
  const destroyActionSids = []
  visitFunctionArrays(collision.node, (node) => {
    if (Number.isInteger(node[0]) && node[1]?.[0] === 5 && node[1][1] === '伤害计算') {
      damageExpressionIds.add(node[0])
    }
    if (node[0] === bulletObjectId && node[1] === 46 && Number.isInteger(node[3])) {
      destroyActionSids.push(String(node[3]))
    }
  })

  if (writes.length === 0 || skillFieldIndexes.length !== 1 || reads.length !== 0) {
    throw new Error('原版分段数字段证据发生变化，请重新审阅碰撞链')
  }
  return {
    skillFieldIndex: skillFieldIndexes[0],
    bulletObjectId,
    bulletVariableIndex: segmentVariableIndex,
    bulletVariableName: bulletVariables[segmentVariableIndex][2],
    writeCount: writes.length,
    readCount: reads.length,
    writes,
    reads,
    collision: {
      functionSid: String(collision.node[4]),
      damageExpressionIds: [...damageExpressionIds],
      destroyActionSids,
    },
    conclusion: 'jn 分段数字段只写入子弹实例，事件表没有读取；碰撞只结算一次伤害后销毁子弹。',
  }
}

const expressionIdFromWait = (node) => {
  const parameters = node[6]
  const expression = parameters?.[0]?.[1]
  return Array.isArray(expression) && Number.isInteger(expression[0]) ? expression[0] : null
}

const summarizeFunction = (name, entry, expressionFunctions, nameIndex) => {
  const waits = []
  const calls = []
  visitFunctionArrays(entry.node, (node, nodePath) => {
    if (node[0] === -1 && node[1] === 45) {
      const expressionId = expressionIdFromWait(node)
      const expressionSource = expressionId === null ? null : expressionFunctions[expressionId] ?? null
      waits.push({
        eventSid: String(node[3]),
        path: [...entry.path, ...nodePath],
        expressionId,
        seconds: expressionSource === null ? null : constantExpressionValue(expressionSource),
        expressionSource,
      })
    }
    if (node[0] === -2 && typeof node[1] === 'string') {
      calls.push({
        name: node[1],
        eventSid: String(node[3]),
        path: [...entry.path, ...nodePath],
      })
    }
  })

  return {
    name,
    sid: String(entry.node[4]),
    eventNumber: nameIndex.get(name)?.eventNumber ?? entry.node[5] ?? null,
    path: entry.path,
    waits,
    calls,
  }
}

const relativeSourcePath = (absolutePath) => path.relative(projectRoot, absolutePath).replaceAll('\\', '/')

const markdownFor = (evidence) => {
  const rows = evidence.functions.map((fn) => {
    const waits = fn.waits.length === 0
      ? '—'
      : fn.waits.map((wait) => wait.seconds === null ? `expr#${wait.expressionId}` : `${wait.seconds}s`).join(', ')
    const calls = [...new Set(fn.calls.map((call) => call.name))].join(' → ') || '—'
    return `| ${fn.name} | ${fn.sid} | ${fn.path.join('.')} | ${waits} | ${calls} |`
  })
  const unresolved = evidence.functions.flatMap((fn) => fn.waits.filter((wait) => wait.seconds === null).map((wait) => `${fn.name}: expr#${wait.expressionId}`))
  return `# 《诸天刷宝录》战斗事件证据\n\n` +
    `> 本文件由 \`npm run evidence:combat\` 从本机原版导出物只读生成，禁止手工修改生成结果。\n\n` +
    `## 来源\n\n` +
    `- \`${evidence.sources.data.path}\`（SHA-256: \`${evidence.sources.data.sha256}\`）\n` +
    `- \`${evidence.sources.jn.path}\`（SHA-256: \`${evidence.sources.jn.sha256}\`）\n` +
    `- \`${evidence.sources.fw.path}\`（SHA-256: \`${evidence.sources.fw.sha256}\`）\n` +
    `- \`${evidence.sources.buff.path}\`（SHA-256: \`${evidence.sources.buff.sha256}\`）\n` +
    `- \`${evidence.sources.sq.path}\`（SHA-256: \`${evidence.sources.sq.sha256}\`）\n` +
    `- \`${evidence.sources.dr.path}\`（SHA-256: \`${evidence.sources.dr.sha256}\`）\n` +
    `- \`${evidence.sources.drsx.path}\`（SHA-256: \`${evidence.sources.drsx.sha256}\`）\n` +
    `- \`${evidence.sources.zx.path}\`（SHA-256: \`${evidence.sources.zx.sha256}\`）\n` +
    `- \`${evidence.sources.runtime.path}\`（SHA-256: \`${evidence.sources.runtime.sha256}\`）\n` +
    `- \`${evidence.sources.functionNames.path}\`（SHA-256: \`${evidence.sources.functionNames.sha256}\`）\n\n` +
    `## 核心调用与等待\n\n` +
    `| 原版事件组 | SID | data.json path | Wait | 直接调用 |\n` +
    `|---|---:|---|---|---|\n` +
    `${rows.join('\n')}\n\n` +
    `## 分段数与命中结算\n\n` +
    `- jn 字段：${evidence.segmentEvidence.skillFieldIndex}\n` +
    `- zidan 实例变量：${evidence.segmentEvidence.bulletVariableName}（index ${evidence.segmentEvidence.bulletVariableIndex}）\n` +
    `- 写入：${evidence.segmentEvidence.writeCount} 处；读取：${evidence.segmentEvidence.readCount} 处\n` +
    `- 子弹碰撞伤害表达式：${evidence.segmentEvidence.collision.damageExpressionIds.map((id) => `expr#${id}`).join(', ')}\n` +
    `- 结论：${evidence.segmentEvidence.conclusion}\n\n` +
    `## 自动技能选择\n\n` +
    `- 选择事件块：${evidence.skillAiEvidence.selectionBlock.eventNumber}（SID ${evidence.skillAiEvidence.selectionBlock.sid}）\n` +
    `- 条件事件块：${evidence.skillAiEvidence.conditionBlock.eventNumber}（SID ${evidence.skillAiEvidence.conditionBlock.sid}）\n` +
    `- 选中锁存写入 false：${evidence.skillAiEvidence.selectionBlock.latchFalseActions.length} 处\n` +
    `- Random 表达式：${evidence.skillAiEvidence.selectionBlock.randomExpressionIds.length} 处\n` +
    `${evidence.skillAiEvidence.rules.map((rule) => `- ${rule}`).join('\n')}\n\n` +
    `## 目标选择与技能范围\n\n` +
    `- 敌方本地阵位：expr#${evidence.targetingEvidence.formulas.enemySlotNormalization.expressionId}\n` +
    `- fw 查询公式：expr#${evidence.targetingEvidence.formulas.rangeLookup.expressionId}\n` +
    `- 原版 fw：${evidence.targetingEvidence.rangeTable.generatedRangeCount} 种战斗范围 × 15 核心阵位 × 15 尝试阵位\n` +
    `- 三个发起排攻击序：${evidence.targetingEvidence.attackPriorities.map((group) => `${group.sourceRow}=[${group.priorities.join(',')}]`).join('；')}\n` +
    `- 召唤空位序：[${evidence.targetingEvidence.summonEmptySlotPriority.priorities.join(',')}]\n` +
    `${evidence.targetingEvidence.rules.map((rule) => `- ${rule}`).join('\n')}\n\n` +
    `## 全局状态节拍\n\n` +
    `- 全局事件：${evidence.statusTimingEvidence.globalEvent.eventNumber}（SID ${evidence.statusTimingEvidence.globalEvent.sid}），Every(${evidence.statusTimingEvidence.globalEvent.every.seconds})\n` +
    `- 门控：${evidence.statusTimingEvidence.globalEvent.gates.map((gate) => gate.rule).join('；')}\n` +
    `- 持续时间函数：${evidence.statusTimingEvidence.duration.eventNumber}（SID ${evidence.statusTimingEvidence.duration.sid}，expr#${evidence.statusTimingEvidence.duration.expressionId}）\n` +
    `- 脉冲顺序：${evidence.statusTimingEvidence.pulse.callOrder.map((call) => call.name).join(' → ')}\n` +
    `${evidence.statusTimingEvidence.rules.map((rule) => `- ${rule}`).join('\n')}\n\n` +
    `## 死亡与普通换波时序\n\n` +
    `- 致死检查：事件 ${evidence.deathAndWaveTimingEvidence.lethalCheck.eventNumber}（SID ${evidence.deathAndWaveTimingEvidence.lethalCheck.eventSid}），字段 ${evidence.deathAndWaveTimingEvidence.lethalCheck.hpFieldIndex} 气血 ≤ ${evidence.deathAndWaveTimingEvidence.lethalCheck.hpThreshold}，且字段 ${evidence.deathAndWaveTimingEvidence.lethalCheck.survivalFieldIndex} 生存开关仍开启\n` +
    `- 收益末事件 → 消灭特效 → 敌方死亡调用：${evidence.deathAndWaveTimingEvidence.settlementOrder.lastRewardEvent} → ${evidence.deathAndWaveTimingEvidence.settlementOrder.deathEffectEvent} → ${evidence.deathAndWaveTimingEvidence.settlementOrder.enemyDeathCallEvent}\n` +
    `- 我方死亡形象事件：${evidence.deathAndWaveTimingEvidence.settlementOrder.partyDeathImageEvent}；召唤物释放阵位事件：${evidence.deathAndWaveTimingEvidence.settlementOrder.partySummonSlotReleaseEvent}\n` +
    `- 受击动作等待：${evidence.deathAndWaveTimingEvidence.hitMotion.waits.map((wait) => `${wait.seconds}s`).join('、')}\n` +
    `- 普通换波：${evidence.deathAndWaveTimingEvidence.normalWaveTransition.preRefresh.seconds}s 清场等待 + ${evidence.deathAndWaveTimingEvidence.normalWaveTransition.postRefresh.seconds}s 生成后等待 = ${evidence.deathAndWaveTimingEvidence.normalWaveTransition.totalSeconds}s\n` +
    `- 死亡形象：object ${evidence.deathAndWaveTimingEvidence.deathImage.objectTypeId}，${evidence.deathAndWaveTimingEvidence.deathImage.source} crop ${evidence.deathAndWaveTimingEvidence.deathImage.crop.width}×${evidence.deathAndWaveTimingEvidence.deathImage.crop.height}+${evidence.deathAndWaveTimingEvidence.deathImage.crop.x}+${evidence.deathAndWaveTimingEvidence.deathImage.crop.y}\n` +
    `${evidence.deathAndWaveTimingEvidence.rules.map((rule) => `- ${rule}`).join('\n')}\n\n` +
    `## 首波、最终胜负与自动重新挑战\n\n` +
    `- 首波：${evidence.startAndRestartTimingEvidence.initialWave.preRefreshSeconds}s 核心创建后等待 + ${evidence.startAndRestartTimingEvidence.initialWave.postRefreshSeconds}s 刷新后等待 = ${evidence.startAndRestartTimingEvidence.initialWave.totalSeconds}s\n` +
    `- 连续推进胜利：事件 ${evidence.startAndRestartTimingEvidence.ending.continuousVictory.eventNumber}，等待 ${evidence.startAndRestartTimingEvidence.ending.continuousVictory.wait.seconds}s 后结束并开始下一场\n` +
    `- 结算型胜利：事件 ${evidence.startAndRestartTimingEvidence.ending.settlementVictory.eventNumber}，等待 ${evidence.startAndRestartTimingEvidence.ending.settlementVictory.wait.seconds}s 后打开胜利结算\n` +
    `- 普通失败：团灭事件 ${evidence.startAndRestartTimingEvidence.ending.defeat.partyWipeEvent}，结算事件 ${evidence.startAndRestartTimingEvidence.ending.defeat.settlementEvents.join('、')}，均先等待 ${evidence.startAndRestartTimingEvidence.ending.defeat.waits[0].seconds}s\n` +
    `- 自动重新挑战倒计时默认值：${evidence.startAndRestartTimingEvidence.autoRestart.countdownVariable.defaultSeconds}s\n` +
    `- 倒计时重置事件：${evidence.startAndRestartTimingEvidence.autoRestart.resetActions.map((item) => `${item.eventNumber}=${item.seconds}s`).join('；')}\n` +
    `- 倒计时 Every(${evidence.startAndRestartTimingEvidence.autoRestart.every.seconds})：事件 ${evidence.startAndRestartTimingEvidence.autoRestart.every.eventNumber}；归零事件 ${evidence.startAndRestartTimingEvidence.autoRestart.zeroEvent.eventNumber}\n` +
    `- 普通重开：事件 ${evidence.startAndRestartTimingEvidence.autoRestart.normalRestart.eventNumber}，倒计时后再等待 ${evidence.startAndRestartTimingEvidence.autoRestart.normalRestart.closeWait.seconds}s，总计 ${evidence.startAndRestartTimingEvidence.autoRestart.normalRestart.totalSeconds}s\n` +
    `${evidence.startAndRestartTimingEvidence.rules.map((rule) => `- ${rule}`).join('\n')}\n\n` +
    `## 普通关卡波次与敌人面板\n\n` +
    `- 阵型人数：zx#1=${evidence.waveEvidence.formations[1].length}，zx#2=${evidence.waveEvidence.formations[2].length}，zx#3..18=5，zx#19..23=6\n` +
    `- 普通怪品级：第 1..3 波全为小怪；第 4 波起每只独立 ${evidence.waveEvidence.rankChances.wave4OnwardPerMob.normal}% / ${evidence.waveEvidence.rankChances.wave4OnwardPerMob.elite}% / ${evidence.waveEvidence.rankChances.wave4OnwardPerMob.captain}%\n` +
    `- 难度系数：\`${evidence.waveEvidence.difficulty.formula}\`（expr#${evidence.waveEvidence.difficulty.expressionId}）\n` +
    `- drsx 六维：[${evidence.waveEvidence.growthOrder.join(', ')}]\n` +
    `${evidence.waveEvidence.rules.map((rule) => `- ${rule}`).join('\n')}\n\n` +
    `## 解析状态\n\n` +
    `- 已提取函数：${evidence.functions.length}\n` +
    `- Wait：${evidence.summary.waitCount}\n` +
    `- 可解析为常量秒数：${evidence.summary.constantWaitCount}\n` +
    `- 动态或尚未解析的 Wait：${evidence.summary.unresolvedWaitCount}\n` +
    (unresolved.length === 0 ? '' : `- 未解析项：${unresolved.join('；')}\n`)
}

const main = async () => {
  const [
    dataSource,
    jnSource,
    fwSource,
    buffSource,
    sqSource,
    drSource,
    drsxSource,
    zxSource,
    runtimeSource,
    functionNamesSource,
  ] = await Promise.all([
    readFile(dataPath, 'utf8'),
    readFile(jnPath, 'utf8'),
    readFile(fwPath, 'utf8'),
    readFile(buffPath, 'utf8'),
    readFile(sqPath, 'utf8'),
    readFile(drPath, 'utf8'),
    readFile(drsxPath, 'utf8'),
    readFile(zxPath, 'utf8'),
    readFile(runtimePath, 'utf8'),
    readFile(functionNamesPath, 'utf8'),
  ])
  const data = JSON.parse(dataSource)
  const expressionFunctions = parseExpressionFunctions(runtimeSource)
  const functionNodes = findFunctionNodes(data.project)
  const functionNameIndex = parseFunctionNameIndex(functionNamesSource)
  const missing = TARGET_FUNCTION_NAMES.filter((name) => !functionNodes.has(name))
  if (missing.length > 0) throw new Error(`data.json 缺少目标函数：${missing.join('、')}`)

  const functions = TARGET_FUNCTION_NAMES.map((name) => summarizeFunction(
    name,
    functionNodes.get(name),
    expressionFunctions,
    functionNameIndex,
  ))
  const waits = functions.flatMap((fn) => fn.waits)
  const segmentEvidence = collectSegmentEvidence(data, functionNodes, expressionFunctions)
  const statusTimingEvidence = collectStatusTimingEvidence(functionNodes, expressionFunctions)
  const deathAndWaveTimingEvidence = collectDeathAndWaveTimingEvidence(functionNodes, expressionFunctions)
  const startAndRestartTimingEvidence = collectStartAndRestartTimingEvidence(
    data,
    functionNodes,
    expressionFunctions,
    deathAndWaveTimingEvidence,
  )
  const skillAiEvidence = collectSkillAiEvidence(data, expressionFunctions)
  const targetingEvidence = collectTargetingEvidence(data, expressionFunctions, fwSource)
  const waveEvidence = collectWaveEvidence(
    functionNodes,
    expressionFunctions,
    sqSource,
    drSource,
    drsxSource,
    zxSource,
  )
  const evidence = {
    schemaVersion: 1,
    sources: {
      data: { path: relativeSourcePath(dataPath), sha256: sha256(dataSource) },
      jn: { path: relativeSourcePath(jnPath), sha256: sha256(jnSource) },
      fw: { path: relativeSourcePath(fwPath), sha256: sha256(fwSource) },
      buff: { path: relativeSourcePath(buffPath), sha256: sha256(buffSource) },
      sq: { path: relativeSourcePath(sqPath), sha256: sha256(sqSource) },
      dr: { path: relativeSourcePath(drPath), sha256: sha256(drSource) },
      drsx: { path: relativeSourcePath(drsxPath), sha256: sha256(drsxSource) },
      zx: { path: relativeSourcePath(zxPath), sha256: sha256(zxSource) },
      runtime: { path: relativeSourcePath(runtimePath), sha256: sha256(runtimeSource) },
      functionNames: { path: relativeSourcePath(functionNamesPath), sha256: sha256(functionNamesSource) },
    },
    summary: {
      expressionFunctionCount: expressionFunctions.length,
      functionCount: functions.length,
      waitCount: waits.length,
      constantWaitCount: waits.filter((wait) => wait.seconds !== null).length,
      unresolvedWaitCount: waits.filter((wait) => wait.seconds === null).length,
    },
    segmentEvidence,
    statusTimingEvidence,
    deathAndWaveTimingEvidence,
    startAndRestartTimingEvidence,
    skillAiEvidence,
    targetingEvidence,
    waveEvidence,
    functions,
  }

  await mkdir(outputDir, { recursive: true })
  await Promise.all([
    writeFile(jsonOutputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8'),
    writeFile(markdownOutputPath, markdownFor(evidence), 'utf8'),
  ])
  console.log(`已生成 ${relativeSourcePath(jsonOutputPath)}`)
  console.log(`已生成 ${relativeSourcePath(markdownOutputPath)}`)
  console.log(`Wait ${evidence.summary.waitCount} 条，常量 ${evidence.summary.constantWaitCount} 条，未解析 ${evidence.summary.unresolvedWaitCount} 条`)
}

await main()
