# 江湖层级与左侧导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有并列顶部 Tab 改为左侧全局导航，并恢复“江湖大关 → 10 个小关 → 点击后立即驻守战斗”的明确层级，同时把势力和城市收进当前大关。

**Architecture:** 新增纯渲染模块 `jianghu-page.ts` 负责大关总览和小关列表，`idle-page.ts` 只负责进行中的战斗。`main.ts` 使用独立的全局页面、江湖层级和大关子页面状态组织导航；为兼容既有测试和调试 API，【江湖】继续使用内部 id `idle`，仅把可见层级改成设计中的 `jianghu`。战斗模式切换通过 `CombatEngine`/`GameSession` 新 API 原地更新，不重建战斗。

**Tech Stack:** TypeScript 6、Vite 8、Vitest 4、Playwright、原生 HTML/CSS renderer、现有 DOM patcher

---

## 文件结构

- Create: `egg-jianghu/src/ui/jianghu-page.ts` — 大关卡总览和当前大关 10 小关的纯 HTML renderer。
- Create: `egg-jianghu/src/ui/jianghu-page.test.ts` — 大关/小关层级、锁定态和稳定 action 的 renderer 测试。
- Create: `egg-jianghu/src/ui/shell.test.ts` — 全局左侧导航、顶部资源移除和大关二级导航测试。
- Modify: `egg-jianghu/src/combat/engine.ts` — 在原战斗快照上即时切换 `CampaignMode`。
- Modify: `egg-jianghu/src/app/game-session.ts` — 对 UI 暴露带校验的 `setCombatMode`。
- Modify: `egg-jianghu/src/app/game-session.test.ts` — 证明模式切换不重建战斗或重置进度。
- Modify: `egg-jianghu/src/ui/shell.ts` — 将顶部栏和顶部 Tab 改为左侧主导航及江湖二级导航。
- Modify: `egg-jianghu/src/ui/idle-page.ts` — 移除大关/小关混排，只渲染战斗并提供即时模式控制。
- Modify: `egg-jianghu/src/ui/idle-page.test.ts` — 更新战斗 renderer 断言。
- Modify: `egg-jianghu/src/main.ts` — 接入三层导航状态、按大关过滤势力/城市、点击小关自动开战和返回战斗入口。
- Modify: `egg-jianghu/src/style.css` — 左侧导航、大关网格、小关卡列表、战斗页和移动端布局。
- Modify: `egg-jianghu/tests/e2e/mvp.spec.ts` — 更新已移除 Tab 的旧流程，并覆盖完整新导航与即时模式切换。

### Task 1: 支持当前战斗即时切换驻守/闯荡

**Files:**
- Modify: `egg-jianghu/src/combat/engine.ts:16-20,187-205`
- Modify: `egg-jianghu/src/app/game-session.ts:86-122`
- Test: `egg-jianghu/src/app/game-session.test.ts`

- [ ] **Step 1: 写即时切换模式的失败测试**

在 `GameSession` 测试中启动驻守战斗，保存 engine、波次、气血、气机和 elapsed，再切为闯荡：

```typescript
it('即时切换模式但不重建或重置当前战斗', () => {
  const session = sessionWithParty()
  expect(session.startStage({ worldId: 'world_01', stage: 2, mode: 'guard', seed: 17 }).ok).toBe(true)
  session.advanceTicks(3)
  const engine = session.combat
  const before = structuredClone(session.combat!.state)

  expect(session.setCombatMode('roam')).toEqual({ ok: true, message: '已切换为闯荡' })

  expect(session.combat).toBe(engine)
  expect(session.selection).toEqual({ worldId: 'world_01', stage: 2, mode: 'roam' })
  expect(session.combat!.state).toEqual({ ...before, mode: 'roam' })
})

it('没有进行中战斗时拒绝切换模式', () => {
  const session = sessionWithParty()
  expect(session.setCombatMode('roam')).toEqual({ ok: false, message: '当前没有进行中的战斗' })
  expect(session.combat).toBeNull()
})

it('拒绝绕过界面进入尚未解锁的小关', () => {
  const session = sessionWithParty()
  expect(session.startStage({ worldId: 'world_01', stage: 2, mode: 'guard', seed: 1 }))
    .toEqual({ ok: false, message: '小关尚未解锁' })
  expect(session.combat).toBeNull()
})
```

把原有“闯荡失败”测试开始前设置 `session.state.clearedStageByWorld.world_01 = 3`，把“第十关解锁下一卷”测试开始前设置为 `9`，使 fixture 与真实解锁条件一致。

- [ ] **Step 2: 运行目标测试并确认失败原因正确**

Run: `npm test -- src/app/game-session.test.ts`

Expected: FAIL，TypeScript/Vitest 指出 `GameSession.setCombatMode` 不存在。

- [ ] **Step 3: 在 engine 和 session 增加原地模式切换**

在 `combat/engine.ts` 增加 `import type { CampaignMode } from '../domain/types'`。扩展 `CombatEngine`，实现只修改 `state.mode`：

```typescript
export interface CombatEngine {
  readonly state: CombatSnapshot
  tick(count?: number): CombatEvent[]
  setMode(mode: CampaignMode): void
  stop(): CombatEvent[]
}
```

在 `createCombatEngine()` 返回对象内加入：

```typescript
setMode(mode): void {
  state.mode = mode
},
```

在 `GameSession` 增加校验并同步 `selection`：

```typescript
setCombatMode(mode: CampaignMode): ActionResult {
  if (!this.combat || !this.selection || this.combat.state.result !== 'fighting') {
    return { ok: false, message: '当前没有进行中的战斗' }
  }
  this.selection = { ...this.selection, mode }
  this.combat.setMode(mode)
  return { ok: true, message: mode === 'guard' ? '已切换为驻守' : '已切换为闯荡' }
}
```

从 `../domain/types` 同时导入 `CampaignMode`。在 `startStage()` 的 1～10 校验后增加领域层解锁校验：

```typescript
const highestUnlockedStage = Math.min(10, Math.max(
  1,
  (this.state.clearedStageByWorld[input.worldId] ?? 0) + 1,
))
if (input.stage > highestUnlockedStage) return { ok: false, message: '小关尚未解锁' }
```

- [ ] **Step 4: 运行目标测试并确认通过**

Run: `npm test -- src/app/game-session.test.ts`

Expected: PASS，新增两条测试和原有 `GameSession` 测试全部通过。

- [ ] **Step 5: 提交领域改动**

```powershell
git add egg-jianghu/src/combat/engine.ts egg-jianghu/src/app/game-session.ts egg-jianghu/src/app/game-session.test.ts
git commit -m "✨ feat(combat): 支持即时切换战斗模式"
```

### Task 2: 拆分大关总览、小关列表和战斗 renderer

**Files:**
- Create: `egg-jianghu/src/ui/jianghu-page.ts`
- Create: `egg-jianghu/src/ui/jianghu-page.test.ts`
- Modify: `egg-jianghu/src/ui/idle-page.ts`
- Modify: `egg-jianghu/src/ui/idle-page.test.ts`

- [ ] **Step 1: 写大关总览和小关列表的失败测试**

测试要求总览只有大关卡，小关页恰好 10 张卡片且使用点击即开战的 action：

```typescript
import { describe, expect, it } from 'vitest'
import { renderStageList, renderWorldOverview } from './jianghu-page'

describe('江湖层级页', () => {
  it('总览显示大关卡但不提前显示小关或战斗', () => {
    const html = renderWorldOverview({ worlds: [{
      id: 'world_01', name: '青石江湖', index: 1, unlocked: true,
      difficulty: 1, recommendedPower: 4000, clearedStages: 3,
      factionNames: ['青锋馆', '铁衣武馆', '仁心堂'],
    }] })
    expect(html).toContain('data-testid="world-world_01"')
    expect(html).toContain('data-action="enter-world"')
    expect(html).not.toContain('data-testid="stage-1"')
    expect(html).not.toContain('data-testid="idle-page"')
  })

  it('大关内显示十个小关且锁定关不可点击', () => {
    const html = renderStageList({
      worldId: 'world_01', worldName: '青石江湖', worldCurrency: 120,
      stages: Array.from({ length: 10 }, (_, index) => ({
        stage: index + 1, unlocked: index < 4, cleared: index < 3,
      })),
    })
    expect(html.match(/data-testid="stage-/g)).toHaveLength(10)
    expect(html).toContain('data-action="start-stage"')
    expect(html).toMatch(/data-testid="stage-5"[^>]*disabled/)
  })
})
```

更新 `idle-page.test.ts` fixture，只保留 `worldName`、`selectedStage`、背包、速度、combat 和 logs；断言模式按钮改用 `set-mode-guard`、`set-mode-roam`，当前模式具有 `active`。

- [ ] **Step 2: 运行 renderer 测试并确认失败**

Run: `npm test -- src/ui/jianghu-page.test.ts src/ui/idle-page.test.ts`

Expected: FAIL，缺少 `jianghu-page.ts`，旧 `IdlePageViewModel` 仍要求 worlds/stages。

- [ ] **Step 3: 创建江湖层级纯 renderer**

在 `jianghu-page.ts` 定义两个小而明确的 view model：

```typescript
import { escapeHtml, formatNumber } from './html'

export interface JianghuWorldCardView {
  id: string
  name: string
  index: number
  unlocked: boolean
  difficulty: number
  recommendedPower: number
  clearedStages: number
  factionNames: string[]
}

export interface WorldOverviewViewModel { worlds: JianghuWorldCardView[] }
export interface StageListViewModel {
  worldId: string
  worldName: string
  worldCurrency: number
  stages: Array<{ stage: number; unlocked: boolean; cleared: boolean }>
}

const stars = (difficulty: number): string => '★'.repeat(difficulty)

export const renderWorldOverview = (view: WorldOverviewViewModel): string => `
  <section class="world-overview" data-testid="world-overview">
    <header class="page-heading"><small>十卷风云</small><h1>江湖</h1><p>择一方江湖，访城问派，逐关而行。</p></header>
    <div class="world-card-grid">${view.worlds.map((world) => `
      <button type="button" class="world-card${world.unlocked ? '' : ' locked'}"
        data-action="enter-world" data-world-id="${world.id}"
        data-testid="world-${world.id}" ${world.unlocked ? '' : 'disabled'}>
        <span class="world-index">${String(world.index).padStart(2, '0')}</span>
        <strong>${escapeHtml(world.name)}</strong>
        <small>难度 ${stars(world.difficulty)} · 推荐战力 ${formatNumber(world.recommendedPower)}</small>
        <i><b style="width:${world.clearedStages * 10}%"></b></i>
        <em>本地势力：${world.factionNames.map(escapeHtml).join(' · ')}</em>
      </button>`).join('')}</div>
  </section>`

export const renderStageList = (view: StageListViewModel): string => `
  <section class="stage-overview" data-testid="stage-overview">
    <header class="page-heading world-heading">
      <div><small>江湖卷</small><h1>${escapeHtml(view.worldName)}</h1></div>
      <span>本卷货币 <strong>${formatNumber(view.worldCurrency)}</strong></span>
    </header>
    <div class="stage-card-grid">${view.stages.map((stage) => `
      <button type="button" class="stage-card${stage.cleared ? ' cleared' : ''}"
        data-action="start-stage" data-stage="${stage.stage}"
        data-testid="stage-${stage.stage}" ${stage.unlocked ? '' : 'disabled'}>
        <span>${String(stage.stage).padStart(2, '0')}</span>
        <strong>第 ${stage.stage} 关</strong>
        <small>${stage.cleared ? '已通关 · 点击驻守' : stage.unlocked ? '点击进入驻守' : '尚未解锁'}</small>
      </button>`).join('')}</div>
  </section>`
```

- [ ] **Step 4: 将 `idle-page.ts` 收窄为战斗页**

删除 `IdleWorldView`、`IdleStageView`、world rail 和 stage grid。`IdlePageViewModel` 改为：

```typescript
export interface IdlePageViewModel {
  worldName: string
  selectedStage: number
  inventoryCount: number
  inventoryCapacity: number
  combatSpeed: 1 | 2 | 4
  combat: IdleCombatView
  logs: string[]
}
```

战斗标题继续显示当前大关、小关和波次；模式按钮改为：

```typescript
<button type="button" class="${view.combat.mode === 'guard' ? 'active' : ''}"
  data-action="set-mode-guard" data-testid="mode-guard">驻守</button>
<button type="button" class="${view.combat.mode === 'roam' ? 'active' : ''} roam"
  data-action="set-mode-roam" data-testid="mode-roam">闯荡</button>
```

战斗页不再包含空战场和“选择驻守或闯荡后开始”的整备状态，因为只有成功启动小关后才会渲染。

- [ ] **Step 5: 运行 renderer 测试并确认通过**

Run: `npm test -- src/ui/jianghu-page.test.ts src/ui/idle-page.test.ts`

Expected: PASS，大关、小关和战斗三类 renderer 测试全部通过。

- [ ] **Step 6: 提交页面 renderer**

```powershell
git add egg-jianghu/src/ui/jianghu-page.ts egg-jianghu/src/ui/jianghu-page.test.ts egg-jianghu/src/ui/idle-page.ts egg-jianghu/src/ui/idle-page.test.ts
git commit -m "♻️ refactor(ui): 拆分江湖关卡与战斗页面"
```

### Task 3: 将 Shell 改为左侧主导航和大关二级导航

**Files:**
- Modify: `egg-jianghu/src/ui/shell.ts`
- Create: `egg-jianghu/src/ui/shell.test.ts`

- [ ] **Step 1: 写 Shell 结构失败测试**

```typescript
import { describe, expect, it } from 'vitest'
import { renderShell } from './shell'

describe('应用 Shell', () => {
  it('仅显示三个全局入口且不显示顶部资源和自动存档', () => {
    const html = renderShell({ activeTab: 'idle', worldContext: null, hasCombatReturn: false, content: '<p>内容</p>' })
    expect(html).toContain('class="game-sidebar"')
    expect(html).toContain('data-testid="tab-idle"')
    expect(html).toContain('data-testid="tab-heroes"')
    expect(html).toContain('data-testid="tab-inventory"')
    expect(html).not.toMatch(/tab-factions|tab-city|势力贡献|装备背包|自动存档|resource-strip/)
  })

  it('进入大关后在江湖下展开关卡势力城市', () => {
    const html = renderShell({
      activeTab: 'idle',
      worldContext: { worldName: '青石江湖', activeSection: 'factions' },
      hasCombatReturn: true,
      content: '<p>内容</p>',
    })
    expect(html).toContain('data-jianghu-section="stages"')
    expect(html).toContain('data-jianghu-section="factions"')
    expect(html).toContain('data-jianghu-section="city"')
    expect(html).toContain('data-action="return-worlds"')
    expect(html).toContain('data-action="resume-combat"')
  })
})
```

- [ ] **Step 2: 运行 Shell 测试并确认失败**

Run: `npm test -- src/ui/shell.test.ts`

Expected: FAIL，旧 `ShellViewModel` 仍要求资源字段并输出顶部栏。

- [ ] **Step 3: 实现左侧 Shell**

将 `TabId` 收窄为 `'idle' | 'heroes' | 'inventory'`，新增：

```typescript
export type JianghuSection = 'stages' | 'factions' | 'city'

export interface ShellViewModel {
  activeTab: TabId
  worldContext: { worldName: string; activeSection: JianghuSection } | null
  hasCombatReturn: boolean
  content: string
}
```

全局与大关内导航元数据固定为：

```typescript
const tabs: Array<{ id: TabId; label: string; mark: string }> = [
  { id: 'idle', label: '江湖', mark: '卷' },
  { id: 'heroes', label: '侠客', mark: '侠' },
  { id: 'inventory', label: '背包', mark: '匣' },
]

const worldSections: Array<{ id: JianghuSection; label: string }> = [
  { id: 'stages', label: '关卡' },
  { id: 'factions', label: '势力' },
  { id: 'city', label: '城市' },
]
```

Shell 根结构固定为：

```typescript
<div class="app-shell">
  <aside class="game-sidebar">
    <div class="brand-block"><span class="brand-seal">蛋</span><strong>蛋蛋江湖 2.0</strong></div>
    <nav class="game-nav" aria-label="游戏区域">${tabs.map((tab) => `
      <button type="button" class="nav-item${view.activeTab === tab.id ? ' active' : ''}"
        data-tab="${tab.id}" data-testid="tab-${tab.id}">
        <span aria-hidden="true">${tab.mark}</span><strong>${tab.label}</strong>
      </button>`).join('')}</nav>
    ${view.activeTab === 'idle' && view.worldContext ? `<nav class="world-subnav" aria-label="${escapeHtml(view.worldContext.worldName)}">
      <button type="button" class="world-back" data-action="return-worlds">返回江湖</button>
      ${worldSections.map((section) => `<button type="button"
        class="${view.worldContext?.activeSection === section.id ? 'active' : ''}"
        data-jianghu-section="${section.id}">${section.label}</button>`).join('')}
    </nav>` : ''}
  </aside>
  <main class="game-main" data-page="${view.activeTab}">${view.content}</main>
  ${view.hasCombatReturn ? '<button type="button" class="idle-combat-return" data-action="resume-combat" data-testid="idle-combat-return">返回进行中战斗</button>' : ''}
</div>
```

二级按钮使用 `data-jianghu-section`，不再伪装成全局 `data-tab`。

- [ ] **Step 4: 运行 Shell 测试并确认通过**

Run: `npm test -- src/ui/shell.test.ts`

Expected: PASS，两条 Shell 结构测试通过。

- [ ] **Step 5: 提交 Shell 结构**

```powershell
git add egg-jianghu/src/ui/shell.ts egg-jianghu/src/ui/shell.test.ts
git commit -m "✨ feat(ui): 将全局导航移到左侧"
```

### Task 4: 接入大关层级、子页面过滤和点击小关自动战斗

**Files:**
- Modify: `egg-jianghu/src/main.ts:41-47,78-106,176-255,286-307,320-324,378-410,465-501`
- Modify: `egg-jianghu/src/ui/factions-page.ts`
- Modify: `egg-jianghu/src/ui/city-page.ts`
- Test: `egg-jianghu/src/ui/pages.test.ts`
- Test: `egg-jianghu/tests/e2e/mvp.spec.ts`

- [ ] **Step 1: 先写完整导航流程的失败 E2E**

在 `mvp.spec.ts` 增加：

```typescript
test('江湖按大关小关分层并在点击小关后立即驻守', async ({ page }) => {
  await expect(page.getByTestId('world-overview')).toBeVisible()
  await expect(page.getByTestId('stage-1')).toHaveCount(0)

  await page.getByTestId('world-world_01').click()
  await expect(page.getByTestId('stage-overview')).toBeVisible()
  await expect(page.locator('[data-testid^="stage-"]')).toHaveCount(10)

  await page.getByTestId('stage-1').click()
  await expect(page.getByTestId('idle-page')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getSelection())).toEqual({
    worldId: 'world_01', stage: 1, mode: 'guard',
  })
})
```

Run: `npm run test:e2e -- --grep "江湖按大关小关分层"`

Expected: FAIL，当前首页直接渲染 `idle-page`，不存在 `world-overview`。

- [ ] **Step 2: 在 `main.ts` 建立三层导航状态**

```typescript
type JianghuView = 'worlds' | 'world' | 'combat'

let activeTab: TabId = 'idle'
let jianghuView: JianghuView = 'worlds'
let jianghuSection: JianghuSection = 'stages'
let selectedWorldId = session.state.unlockedWorldIds[0] ?? 'world_01'
let selectedStage = 1
```

新增 `worldOverviewViewModel()` 和 `stageListViewModel()`。难度使用 `Math.min(5, Math.ceil(world.index / 2))`，推荐战力使用 `Math.round(4000 * 1.65 ** (world.index - 1))`，势力摘要来自 `FACTIONS.filter(faction => faction.worldId === world.id)`。

初始化和每次 render 前用以下规则归一化当前大关；如果存档中的 `selectedWorldId` 已不可用，必须回到总览，不得自动开战：

```typescript
const normalizeSelectedWorld = (): void => {
  if (session.state.unlockedWorldIds.includes(selectedWorldId)) return
  selectedWorldId = session.state.unlockedWorldIds[0] ?? 'world_01'
  selectedStage = 1
  jianghuView = 'worlds'
  jianghuSection = 'stages'
}
```

- [ ] **Step 3: 按江湖层级选择 renderer**

新增：

```typescript
const renderJianghuContent = (): string => {
  if (jianghuView === 'worlds') return renderWorldOverview(worldOverviewViewModel())
  if (jianghuView === 'combat' && session.combat) return renderIdlePage(idleViewModel())
  if (jianghuSection === 'factions') return renderFactionsPage(factionsViewModel())
  if (jianghuSection === 'city') return renderCityPage(cityViewModel())
  return renderStageList(stageListViewModel())
}
```

`render()` 的 `content` 只在 `idle/heroes/inventory` 三个全局页面间选择。传给 Shell 的 `worldContext` 仅在 `activeTab === 'idle' && jianghuView !== 'worlds'` 时存在；`hasCombatReturn` 仅在存在进行中战斗且当前未显示 combat 时为真。

- [ ] **Step 4: 将势力和城市严格绑定当前大关**

`factionsViewModel()` 的候选势力改为：

```typescript
const availableFactions = FACTIONS.filter((faction) =>
  faction.worldId === selectedWorldId
  && session.state.unlockedWorldIds.includes(faction.worldId))
```

进入新大关时把 `selectedFactionId` 归一化为该大关第一个势力。`cityViewModel()` 继续只使用 `selectedWorldId`，空列表直接交给 renderer 显示当前大关空状态，不回退到其他 world。

在 `pages.test.ts` 增加空数据断言，并在 `factions-page.ts`、`city-page.ts` 使用固定空状态：

```typescript
expect(renderFactionsPage({ ...factionsFixture(), factions: [], branches: [], factionHero: null }))
  .toContain('本卷暂无可用势力')
expect(renderCityPage({ ...cityFixture(), tavernHeroes: [], martials: [], careerTokens: [] }))
  .toContain('本卷城市暂无可用内容')
```

renderer 不得尝试改用其他大关的数据填充空页面。

- [ ] **Step 5: 接入大关、小关、子导航、模式切换和返回事件**

事件分支按以下语义实现：

```typescript
if (tab) {
  activeTab = tab
  if (tab === 'idle') {
    jianghuView = 'worlds'
    jianghuSection = 'stages'
  }
} else if (worldSection) {
  activeTab = 'idle'
  jianghuView = 'world'
  jianghuSection = worldSection
} else if (action === 'enter-world' && button.dataset.worldId) {
  selectedWorldId = button.dataset.worldId
  selectedStage = Math.max(1, (session.state.clearedStageByWorld[selectedWorldId] ?? 0) + 1)
  jianghuView = 'world'
  jianghuSection = 'stages'
} else if (action === 'start-stage') {
  selectedStage = Number(button.dataset.stage) || 1
  const result = session.startStage({ worldId: selectedWorldId, stage: selectedStage, mode: 'guard', seed: Date.now() })
  notify(result.message, !result.ok)
  if (result.ok) jianghuView = 'combat'
} else if (action === 'set-mode-guard' || action === 'set-mode-roam') {
  const result = session.setCombatMode(action === 'set-mode-guard' ? 'guard' : 'roam')
  notify(result.message, !result.ok)
} else if (action === 'stop-combat') {
  session.stopCombat()
  jianghuView = 'world'
  jianghuSection = 'stages'
} else if (action === 'resume-combat' && session.combat) {
  activeTab = 'idle'
  selectedWorldId = session.combat.state.worldId
  selectedStage = session.combat.state.stage
  jianghuView = 'combat'
} else if (action === 'return-worlds') {
  jianghuView = 'worlds'
  jianghuSection = 'stages'
}
```

在读取事件前定义二级导航目标：

```typescript
const worldSection = target.closest<HTMLElement>('[data-jianghu-section]')
  ?.dataset.jianghuSection as JianghuSection | undefined
```

`window.__EGG_JIANGHU__.startStage` 成功后同步 `jianghuView = 'combat'`。增加调试入口 `setCombatMode(mode)`，供 E2E 在不依赖动画 timing 时断言领域状态。

为需要直接启动高阶小关的既有 E2E 增加 `setClearedStage(worldId, stage)` 调试入口，只修改 `clearedStageByWorld` 并立即 render；测试在启动第 4/10 关前分别设置 3/9，生产 UI 仍只能点击领域层判定为已解锁的小关。

```typescript
setClearedStage: (worldId: string, stage: number) => void

setClearedStage: (worldId, stage) => {
  session.state.clearedStageByWorld[worldId] = Math.max(0, Math.min(10, Math.floor(stage)))
  render()
},
```

- [ ] **Step 6: 运行导航 E2E 并确认通过**

Run: `npm run test:e2e -- --grep "江湖按大关小关分层"`

Expected: PASS，首页先出现大关，点击小关后 selection 为 `guard` 且战斗页可见。

- [ ] **Step 7: 提交导航与数据范围改动**

```powershell
git add egg-jianghu/src/main.ts egg-jianghu/src/ui/factions-page.ts egg-jianghu/src/ui/city-page.ts egg-jianghu/src/ui/pages.test.ts egg-jianghu/tests/e2e/mvp.spec.ts
git commit -m "✨ feat(jianghu): 接入大关小关与区域内容导航"
```

### Task 5: 完成左侧栏、大关网格和响应式视觉

**Files:**
- Modify: `egg-jianghu/src/style.css:52-136,299-365`

- [ ] **Step 1: 记录修改前桌面和移动端基线**

Run: `npm run dev -- --host 127.0.0.1`

使用 Browser/IAB 打开开发地址，记录 `1706×645` 和 `390×844` 两个 viewport 的截图。Expected: 当前为顶部资源栏、五个顶部 Tab 和单页混排，用作改造前证据。

- [ ] **Step 2: 实现桌面左侧 Shell**

用两列布局替换三行布局：

```css
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
}

.game-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 12px;
  border-right: 1px solid #30362d;
  background: rgb(15 18 15 / 97%);
}

.game-nav, .world-subnav { display: grid; gap: 5px; }
.nav-item { justify-content: flex-start; }
.world-subnav { padding: 12px 0 0 18px; border-top: 1px solid var(--line); }
.world-subnav button { text-align: left; background: transparent; border-color: transparent; }
.game-main { min-width: 0; padding: clamp(10px, 1.4vw, 20px); }
```

删除 `.topbar`、`.resource-strip`、`.save-state` 的布局规则。

- [ ] **Step 3: 实现参考图风格大关卡和小关卡网格**

```css
.world-card-grid { display: grid; grid-template-columns: repeat(3, minmax(240px, 1fr)); gap: 12px; }
.world-card { position: relative; min-height: 148px; display: grid; gap: 9px; padding: 16px; text-align: left; overflow: hidden; }
.world-index { position: absolute; top: 8px; right: 12px; color: rgb(207 167 93 / 18%); font: 30px Georgia, serif; }
.world-card > i { height: 6px; background: #11140f; }
.world-card > i > b { display: block; height: 100%; background: var(--gold); }
.world-card.locked { filter: saturate(.45); }
.stage-card-grid { display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 12px; }
.stage-card { min-height: 130px; display: grid; align-content: space-between; gap: 8px; padding: 14px; text-align: left; }
.stage-card.cleared { border-color: var(--jade); }
.idle-combat-return { position: fixed; right: 18px; bottom: 18px; z-index: 30; }
```

大关卡使用当前主题色、边框和字体，不照搬截图中与本项目冲突的悬浮控件。

- [ ] **Step 4: 实现窄屏左侧导航和内容单列**

在 `max-width: 760px` 中保持左侧语义：

```css
@media (max-width: 760px) {
  .app-shell { grid-template-columns: 64px minmax(0, 1fr); }
  .game-sidebar { padding: 8px 5px; }
  .brand-block strong, .nav-item strong { display: none; }
  .brand-block { justify-content: center; min-width: 0; }
  .nav-item { justify-content: center; padding: 7px 3px; }
  .world-subnav { padding-left: 0; }
  .world-subnav button { padding: 6px 2px; text-align: center; font-size: 10px; }
  .world-card-grid, .stage-card-grid { grid-template-columns: 1fr; }
  .world-card, .stage-card { min-height: 112px; }
  .game-main { padding: 7px; overflow-x: hidden; }
}
```

保留现有战斗面板、侠客、势力、城市和背包的移动端单列规则；删除把导航恢复成顶部 sticky row 的旧规则。

- [ ] **Step 5: 运行构建检查 CSS/模板集成**

Run: `npm run build`

Expected: TypeScript 和 Vite build 成功，无 CSS 解析错误。

- [ ] **Step 6: 提交视觉布局**

```powershell
git add egg-jianghu/src/style.css
git commit -m "💄 style(ui): 完成左侧导航与关卡网格布局"
```

### Task 6: 更新旧 E2E 流程并完成全链验收

**Files:**
- Modify: `egg-jianghu/tests/e2e/mvp.spec.ts`

- [ ] **Step 1: 将旧全局势力/城市入口改为大关子导航**

增加复用 helper，避免每条测试重复导航：

```typescript
const enterWorld = async (page: Page, worldId = 'world_01'): Promise<void> => {
  await page.getByTestId('tab-idle').click()
  await page.getByTestId(`world-${worldId}`).click()
}

const openWorldSection = async (page: Page, section: 'stages' | 'factions' | 'city'): Promise<void> => {
  await enterWorld(page)
  await page.locator(`[data-jianghu-section="${section}"]`).click()
}
```

从 `@playwright/test` 同时导入 `type Page`。把 `tab-city`、`tab-factions` 调用分别替换为 `openWorldSection(page, 'city')` 和 `openWorldSection(page, 'factions')`。最终禁用文案测试只遍历 `idle/heroes/inventory` 三个全局 Tab。

- [ ] **Step 2: 增加即时模式切换和区域隔离 E2E**

```typescript
test('战斗中即时切换闯荡且不重置现场', async ({ page }) => {
  await enterWorld(page)
  await page.getByTestId('stage-1').click()
  const before = await page.evaluate(() => window.__EGG_JIANGHU__.getCombat())
  const rewardsBefore = await page.evaluate(() => ({
    currency: window.__EGG_JIANGHU__.getState().worldCurrency.world_01,
    inventory: window.__EGG_JIANGHU__.getState().inventory.length,
  }))
  await page.getByTestId('mode-roam').click()
  const after = await page.evaluate(() => window.__EGG_JIANGHU__.getCombat())
  const rewardsAfter = await page.evaluate(() => ({
    currency: window.__EGG_JIANGHU__.getState().worldCurrency.world_01,
    inventory: window.__EGG_JIANGHU__.getState().inventory.length,
  }))
  expect(after?.mode).toBe('roam')
  expect(after?.worldId).toBe(before?.worldId)
  expect(after?.stage).toBe(before?.stage)
  expect(after?.wave).toBeGreaterThanOrEqual(before?.wave ?? 1)
  expect(rewardsAfter.currency).toBeGreaterThanOrEqual(rewardsBefore.currency)
  expect(rewardsAfter.inventory).toBeGreaterThanOrEqual(rewardsBefore.inventory)
})

test('势力和城市只显示当前大关内容', async ({ page }) => {
  await openWorldSection(page, 'factions')
  await expect(page.getByText('青锋馆', { exact: true })).toBeVisible()
  await expect(page.getByText('断浪刀门', { exact: true })).toHaveCount(0)
  await page.locator('[data-jianghu-section="city"]').click()
  await expect(page.getByTestId('city-page')).toContainText('青石江湖')
})

test('返回总览隐藏二级导航且新大关默认进入关卡', async ({ page }) => {
  await enterWorld(page)
  await page.locator('[data-jianghu-section="city"]').click()
  await page.locator('[data-action="return-worlds"]').click()
  await expect(page.locator('[data-jianghu-section]')).toHaveCount(0)

  await page.evaluate(() => {
    window.__EGG_JIANGHU__.setClearedStage('world_01', 9)
    window.__EGG_JIANGHU__.startStage('world_01', 10, 'roam', 23)
    window.__EGG_JIANGHU__.forceCombatResult('victory')
  })
  await page.getByTestId('tab-idle').click()
  await page.getByTestId('world-world_02').click()
  await expect(page.getByTestId('stage-overview')).toBeVisible()
  await expect(page.locator('[data-jianghu-section="stages"]')).toHaveClass(/active/)
})
```

- [ ] **Step 3: 增加停止、离页和恢复战斗 E2E**

覆盖以下顺序：进入 `world_01/stage_1` → 切到侠客 → 看到 `idle-combat-return` → 点击恢复且 combat snapshot 未重建 → 点击停止 → 回到 `stage-overview`。

```typescript
test('离页后可恢复同一战斗并在停止后返回小关列表', async ({ page }) => {
  await enterWorld(page)
  await page.getByTestId('stage-1').click()
  const before = await page.evaluate(() => window.__EGG_JIANGHU__.getCombat())
  await page.getByTestId('tab-heroes').click()
  await page.getByTestId('idle-combat-return').click()
  expect((await page.evaluate(() => window.__EGG_JIANGHU__.getCombat()))?.seed).toBe(before?.seed)
  await page.getByTestId('stop-combat').click()
  await expect(page.getByTestId('stage-overview')).toBeVisible()
})
```

- [ ] **Step 4: 运行全部 unit tests**

Run: `npm test`

Expected: PASS，所有 `src/**/*.test.ts` 通过，无未处理 promise 或 console error。

- [ ] **Step 5: 运行 production build 和完整 E2E**

Run: `npm run build`

Expected: PASS，`tsc` 与 Vite production build 成功。

Run: `npm run test:e2e`

Expected: PASS，全部 Playwright 测试通过，旧顶部 Tab 选择器已全部清除。

- [ ] **Step 6: 做视觉保真核验**

使用 Browser/IAB 在 `1706×645` 和 `390×844` 检查并截图：

- 大关总览首屏卡片密度、序号、难度、推荐战力、进度和锁定态。
- 左侧主导航及进入大关后展开的【关卡 / 势力 / 城市】。
- 顶部无货币、势力贡献、装备背包和“自动存档”。
- 小关列表恰好 10 项，点击后直接进入驻守战斗。
- 战斗页模式按钮状态、停止按钮和返回战斗入口。
- 势力/城市内容归属、文本可读性和移动端横向溢出。

用 `view_image` 查看参考图和最新两张实现截图，逐项记录并修复布局、字体、色彩、边框、间距、锁定态和响应式偏差。

- [ ] **Step 7: 运行收口检查并同步 CodeGraph**

Run: `git diff --check`

Expected: 无输出，exit code 0。

Run: `codegraph sync ..`

Expected: 同步成功。

Run: `codegraph status ..`

Expected: `[OK] Index is up to date`，文件数与当前仓库一致。

- [ ] **Step 8: 提交验收与测试更新**

```powershell
git add egg-jianghu/tests/e2e/mvp.spec.ts
git commit -m "✅ test(ui): 覆盖江湖层级与左侧导航流程"
```
