# 新建游戏、玩家角色与删档重开 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加标题页、新建/继续游戏、可命名的基础玩家角色及安全删档重开，使新档可以直接开始挂机。

**Architecture:** 保留现有 version 10 存档格式，在 `HeroProgressV10` 上增加可选 `customName`，通过专用的新档工厂创建 `hero_player` 和默认阵容。`main.ts` 增加 `title | new-game | playing` 顶层页面状态，纯渲染的 `start-page.ts` 与扩展后的 `shell.ts` 负责界面，`GameSession` 提供显式新建和继续入口。

**Tech Stack:** TypeScript 6、Vite 8、Vitest 4、Playwright、原生 DOM、localStorage

---

## 文件结构

- Create: `src/domain/state.test.ts` — 覆盖姓名规范化和新档玩家生成。
- Create: `src/content/heroes.test.ts` — 覆盖玩家自定义姓名解析。
- Create: `src/ui/start-page.ts` — 纯函数渲染标题页、新建表单与覆盖确认。
- Create: `src/ui/start-page.test.ts` — 覆盖标题页和新建表单 HTML contract。
- Modify: `src/domain/types.ts` — 为侠客进度增加可选自定义姓名。
- Modify: `src/content/heroes.ts` — 定义 `hero_player` 及统一名称解析函数。
- Modify: `src/domain/state.ts` — 增加姓名校验与玩家新档工厂。
- Modify: `src/domain/save-v10.ts` — 增加当前存档存在性检查。
- Modify: `src/domain/save-v10.test.ts` — 覆盖存在性检查、删档边界和姓名持久化。
- Modify: `src/app/game-session.ts` — 增加显式新建/继续 session，并让战斗显示自定义姓名。
- Modify: `src/app/game-session.test.ts` — 覆盖新建、旧档继续、损坏存档和玩家战斗名。
- Modify: `src/ui/shell.ts` — 增加游戏内删档重开危险区。
- Modify: `src/ui/shell.test.ts` — 覆盖删档入口及二次确认。
- Modify: `src/main.ts` — 接入顶层页面状态、新建/继续/覆盖/删档事件和名称展示。
- Modify: `src/style.css` — 增加标题页、表单、危险确认区及响应式样式。
- Create: `tests/e2e/start-flow.spec.ts` — 在实现主流程前定义新建、继续、覆盖和删档的浏览器 contract。
- Modify: `tests/e2e/mvp.spec.ts` — 让既有回归从真实新档开始，并适配重载后的标题页。

---

### Task 1: 创建可命名的基础玩家新档

**Files:**
- Create: `src/domain/state.test.ts`
- Modify: `src/domain/types.ts:38-48`
- Modify: `src/content/heroes.ts:13-23,68-105`
- Modify: `src/domain/state.ts:1-39`

- [ ] **Step 1: 写姓名校验与新档生成的失败测试**

创建 `src/domain/state.test.ts`：

```typescript
import { describe, expect, it } from 'vitest'
import { PLAYER_HERO_ID, PLAYER_HERO_V10 } from '../content/heroes'
import { createNewGameStateV10, normalizePlayerName } from './state'

describe('version 10 新建游戏', () => {
  it('规范化姓名并拒绝空姓名或超过八个字符的姓名', () => {
    expect(normalizePlayerName('  燕七  ')).toBe('燕七')
    expect(() => normalizePlayerName('   ')).toThrow('请输入玩家姓名')
    expect(() => normalizePlayerName('一二三四五六七八九')).toThrow('玩家姓名最多 8 个字符')
  })

  it('创建丙级剑客玩家并自动放入前排首位', () => {
    const state = createNewGameStateV10('  燕七  ', 1000)

    expect(state.heroes[PLAYER_HERO_ID]).toMatchObject({
      recruited: true,
      level: 1,
      currentCareerId: 'sword',
      customName: '燕七',
    })
    expect(PLAYER_HERO_V10).toMatchObject({ grade: '丙', baseCareerId: 'sword' })
    expect(state.formation).toEqual([{ heroId: PLAYER_HERO_ID, row: 'front', position: 0 }])
    expect(state.lastSavedAt).toBe(1000)
  })
})
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npx vitest run src/domain/state.test.ts`

Expected: FAIL，提示 `createNewGameStateV10`、`normalizePlayerName` 或 `PLAYER_HERO_ID` 尚未导出。

- [ ] **Step 3: 增加玩家字段、静态定义和新档工厂**

在 `HeroProgressV10` 中增加可选字段：

```typescript
export interface HeroProgressV10 {
  recruited: boolean
  customName?: string
  level: number
  experience: number
  careers: Record<string, CareerRecord>
  currentCareerId: string
  learnedMartials: Record<string, LearnedMartial>
  equippedMartialIds: [string | null, string | null, string | null, string | null]
  heartMethodId: string | null
  equipmentBySlot: Record<string, string | null>
}
```

在 `src/content/heroes.ts` 中扩展来源并加入玩家定义：

```typescript
export const PLAYER_HERO_ID = 'hero_player'

export interface HeroDefinitionV10 {
  id: string
  name: string
  grade: HeroGrade
  baseCareerId: string
  worldId: string
  source: 'tavern' | 'faction' | 'starter'
  cost: number
  factionId: string | null
  aptitudes: HeroAptitudes
}

export const PLAYER_HERO_V10: HeroDefinitionV10 = {
  id: PLAYER_HERO_ID,
  name: '无名少侠',
  grade: '丙',
  baseCareerId: 'sword',
  worldId: 'world_01',
  source: 'starter',
  cost: 0,
  factionId: null,
  aptitudes: { strength: 8, insight: 8, constitution: 9, agility: 9, resolve: 8 },
}

export const HEROES_V10: HeroDefinitionV10[] = [PLAYER_HERO_V10, ...TAVERN_HEROES, ...FACTION_HEROES]
```

在 `src/domain/state.ts` 中增加：

```typescript
import { PLAYER_HERO_ID } from '../content/heroes'

export const normalizePlayerName = (input: string): string => {
  const name = input.trim()
  if (!name) throw new Error('请输入玩家姓名')
  if ([...name].length > 8) throw new Error('玩家姓名最多 8 个字符')
  return name
}

export const createNewGameStateV10 = (playerName: string, now = Date.now()): GameStateV10 => {
  const state = createInitialStateV10(now)
  state.heroes[PLAYER_HERO_ID] = {
    ...createHeroProgress('sword'),
    customName: normalizePlayerName(playerName),
  }
  state.formation = [{ heroId: PLAYER_HERO_ID, row: 'front', position: 0 }]
  return state
}
```

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `npx vitest run src/domain/state.test.ts`

Expected: PASS，2 tests passed。

- [ ] **Step 5: 提交玩家新档模型**

```powershell
git add egg-jianghu/src/domain/state.test.ts egg-jianghu/src/domain/state.ts egg-jianghu/src/domain/types.ts egg-jianghu/src/content/heroes.ts
git commit -m "✨ feat(player): 创建可命名的基础玩家角色"
```

---

### Task 2: 统一侠客与战斗中的自定义姓名

**Files:**
- Create: `src/content/heroes.test.ts`
- Modify: `src/content/heroes.ts:103-106`
- Modify: `src/app/game-session.test.ts`
- Modify: `src/app/game-session.ts:6,17-57`
- Modify: `src/main.ts:10,131-180,248-285`

- [ ] **Step 1: 写名称解析与战斗名称的失败测试**

创建 `src/content/heroes.test.ts`：

```typescript
import { describe, expect, it } from 'vitest'
import { createHeroProgress } from '../domain/state'
import { heroDisplayNameV10, PLAYER_HERO_V10, TAVERN_HEROES } from './heroes'

describe('侠客显示名称', () => {
  it('玩家使用自定义姓名，普通侠客使用内容定义姓名', () => {
    expect(heroDisplayNameV10(PLAYER_HERO_V10, {
      ...createHeroProgress('sword'),
      customName: '燕七',
    })).toBe('燕七')
    expect(heroDisplayNameV10(TAVERN_HEROES[0], createHeroProgress('sword')))
      .toBe(TAVERN_HEROES[0].name)
  })
})
```

向 `src/app/game-session.test.ts` 的 import 增加：

```typescript
import { createNewGameStateV10 } from '../domain/state'
import { SAVE_KEY_V10, saveGameV10, type StorageLike } from '../domain/save-v10'
```

然后增加：

```typescript
it('玩家进入战斗时使用自定义姓名', () => {
  const storage = memoryStorage()
  const state = createNewGameStateV10('燕七', 1000)
  saveGameV10(storage, state, 1000)
  const session = GameSession.create(storage, 1000)

  expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 1 }).ok).toBe(true)
  expect(session.combat?.state.party[0].name).toBe('燕七')
})
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npx vitest run src/content/heroes.test.ts src/app/game-session.test.ts`

Expected: FAIL，名称解析函数不存在，或战斗单位仍显示“无名少侠”。

- [ ] **Step 3: 实现统一名称解析并替换所有玩家可见名称**

在 `src/content/heroes.ts` 增加：

```typescript
import type { HeroGrade, HeroProgressV10 } from '../domain/types'

export const heroDisplayNameV10 = (
  definition: HeroDefinitionV10,
  progress?: HeroProgressV10,
): string => progress?.customName?.trim() || definition.name
```

在 `buildCombatParty` 中改为：

```typescript
import { heroByIdV10, heroDisplayNameV10 } from '../content/heroes'

name: heroDisplayNameV10(definition, progress),
```

在 `src/main.ts` 的 `recruitedHeroes` 中一次性解析名称：

```typescript
const recruitedHeroes = () => HEROES_V10.flatMap((definition) => {
  const progress = session.state.heroes[definition.id]
  return progress?.recruited
    ? [{ definition, progress, name: heroDisplayNameV10(definition, progress) }]
    : []
})
```

将以下三个 view model 的普通 `definition.name` 替换为解析后的 `name`：

```typescript
heroes: recruitedHeroes().map(({ definition, progress, name }) => ({
  id: definition.id,
  name,
  grade: definition.grade,
  recruited: progress.recruited,
  level: progress.level,
  careerId: progress.currentCareerId,
  careerName: careerById(progress.currentCareerId)?.name ?? progress.currentCareerId,
  careerLevel: progress.careers[progress.currentCareerId]?.level ?? 1,
  careerPerfected: progress.careers[progress.currentCareerId]?.perfected ?? false,
  availableCareerIds: compatibleCareers.map((item) => item.id),
  learnedMartials: Object.entries(progress.learnedMartials).map(([id, record]) => {
    const martial = martialByIdV10(id)
    return { id, name: martial?.name ?? id, rarity: martial?.rarity ?? '粗浅', level: record.level }
  }),
  equippedMartialIds: progress.equippedMartialIds,
  heartMethodId: progress.heartMethodId,
}))

heroes: recruitedHeroes().map(({ definition, name }) => ({ id: definition.id, name }))
```

第二段同时用于 `cityViewModel` 和 `inventoryViewModel`。

- [ ] **Step 4: 运行名称相关测试并确认 GREEN**

Run: `npx vitest run src/content/heroes.test.ts src/app/game-session.test.ts`

Expected: PASS，名称测试和所有既有 `GameSession` 测试通过。

- [ ] **Step 5: 提交自定义姓名展示链路**

```powershell
git add egg-jianghu/src/content/heroes.test.ts egg-jianghu/src/content/heroes.ts egg-jianghu/src/app/game-session.test.ts egg-jianghu/src/app/game-session.ts egg-jianghu/src/main.ts
git commit -m "✨ feat(player): 统一显示玩家自定义姓名"
```

---

### Task 3: 增加显式新建、继续与存档检测 API

**Files:**
- Modify: `src/domain/save-v10.test.ts`
- Modify: `src/domain/save-v10.ts:4-15,58-80`
- Modify: `src/app/game-session.test.ts`
- Modify: `src/app/game-session.ts:11,64-84`

- [ ] **Step 1: 写存档存在性、新建、继续和损坏存档的失败测试**

将 `src/domain/save-v10.test.ts` 的 state import 改为：

```typescript
import { createInitialStateV10, createNewGameStateV10 } from './state'
```

并增加 save import 和测试：

```typescript
import { clearSaveV10, hasSaveV10, loadGameV10, SAVE_KEY_V10, saveGameV10 } from './save-v10'

it('只检测和删除当前 version 10 存档', () => {
  const storage = memoryStorage()
  storage.setItem('other-key', 'keep')
  expect(hasSaveV10(storage)).toBe(false)

  storage.setItem(SAVE_KEY_V10, '{}')
  expect(hasSaveV10(storage)).toBe(true)
  clearSaveV10(storage)

  expect(hasSaveV10(storage)).toBe(false)
  expect(storage.getItem('other-key')).toBe('keep')
})

it('保存和读取玩家自定义姓名', () => {
  const storage = memoryStorage()
  const state = createNewGameStateV10('燕七', 1000)
  saveGameV10(storage, state, 2000)

  expect(loadGameV10(storage, 3000).state.heroes.hero_player.customName).toBe('燕七')
})
```

在 `src/app/game-session.test.ts` 增加：

```typescript
it('显式新建游戏后立即保存玩家和默认阵容', () => {
  const storage = memoryStorage()
  const session = GameSession.createNew(storage, '燕七', 1000)

  expect(session.state.heroes.hero_player.customName).toBe('燕七')
  expect(session.state.formation).toEqual([{ heroId: 'hero_player', row: 'front', position: 0 }])
  expect(storage.getItem(SAVE_KEY_V10)).not.toBeNull()
})

it('继续旧存档时不补发玩家角色', () => {
  const storage = memoryStorage()
  const oldSession = GameSession.create(storage, 1000)
  oldSession.save(1000)

  const continued = GameSession.continue(storage, 2000)

  expect(continued.state.heroes.hero_player).toBeUndefined()
})

it('没有存档或存档损坏时拒绝继续', () => {
  const storage = memoryStorage()
  expect(() => GameSession.continue(storage, 1000)).toThrow('没有可继续的存档')
  storage.setItem(SAVE_KEY_V10, '{bad json')
  expect(() => GameSession.continue(storage, 1000)).toThrow('存档无法读取')
})
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npx vitest run src/domain/save-v10.test.ts src/app/game-session.test.ts`

Expected: FAIL，提示 `hasSaveV10`、`GameSession.createNew` 和 `GameSession.continue` 不存在。

- [ ] **Step 3: 实现存档和 session API**

在 `src/domain/save-v10.ts` 增加：

```typescript
export const hasSaveV10 = (storage: StorageLike): boolean =>
  storage.getItem(SAVE_KEY_V10) !== null
```

在 `GameSession` 增加两个工厂方法：

```typescript
import { createNewGameStateV10 } from '../domain/state'
import { hasSaveV10, loadGameV10, saveGameV10, type StorageLike } from '../domain/save-v10'

static createNew(storage: StorageLike, playerName: string, now = Date.now()): GameSession {
  const session = new GameSession(createNewGameStateV10(playerName, now), storage)
  session.save(now)
  return session
}

static continue(storage: StorageLike, now = Date.now()): GameSession {
  if (!hasSaveV10(storage)) throw new Error('没有可继续的存档')
  const loaded = loadGameV10(storage, now)
  if (loaded.recoveredFromError) throw new Error('存档无法读取')
  return new GameSession(loaded.state, storage)
}
```

保留现有 `GameSession.create`，用于既有测试和调试接口；生产启动流程在 Task 5 改用新的显式 API。

- [ ] **Step 4: 运行存档和 session 测试并确认 GREEN**

Run: `npx vitest run src/domain/save-v10.test.ts src/app/game-session.test.ts`

Expected: PASS，新增测试及所有既有测试通过。

- [ ] **Step 5: 提交存档入口 API**

```powershell
git add egg-jianghu/src/domain/save-v10.test.ts egg-jianghu/src/domain/save-v10.ts egg-jianghu/src/app/game-session.test.ts egg-jianghu/src/app/game-session.ts
git commit -m "✨ feat(save): 增加新建继续与存档检测能力"
```

---

### Task 4: 创建标题页与新建游戏表单

**Files:**
- Create: `src/ui/start-page.test.ts`
- Create: `src/ui/start-page.ts`
- Modify: `src/style.css`

- [ ] **Step 1: 写标题页、表单和覆盖确认的失败测试**

创建 `src/ui/start-page.test.ts`：

```typescript
import { describe, expect, it } from 'vitest'
import { renderStartPage } from './start-page'

describe('启动页面', () => {
  it('无存档时禁用继续游戏', () => {
    const html = renderStartPage({
      screen: 'title', hasSave: false, playerName: '', error: null,
      confirmOverwrite: false, busy: false,
    })
    expect(html).toContain('data-testid="title-page"')
    expect(html).toContain('data-action="new-game"')
    expect(html).toMatch(/data-action="continue-game"[^>]*disabled/)
  })

  it('新建页安全回显姓名、错误和覆盖确认', () => {
    const html = renderStartPage({
      screen: 'new-game', hasSave: true, playerName: '<燕七>', error: '请确认覆盖',
      confirmOverwrite: true, busy: false,
    })
    expect(html).toContain('data-testid="new-game-page"')
    expect(html).toContain('name="playerName"')
    expect(html).toContain('&lt;燕七&gt;')
    expect(html).toContain('请确认覆盖')
    expect(html).toContain('data-testid="overwrite-confirmation"')
    expect(html).toContain('data-action="confirm-overwrite"')
  })
})
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npx vitest run src/ui/start-page.test.ts`

Expected: FAIL，提示 `./start-page` 不存在。

- [ ] **Step 3: 实现纯渲染启动页面**

创建 `src/ui/start-page.ts`：

```typescript
import { escapeHtml } from './html'

export interface StartPageViewModel {
  screen: 'title' | 'new-game'
  hasSave: boolean
  playerName: string
  error: string | null
  confirmOverwrite: boolean
  busy: boolean
}

export const renderStartPage = (view: StartPageViewModel): string => {
  if (view.screen === 'title') {
    return `<main class="start-page title-page" data-testid="title-page">
      <section class="start-card panel">
        <span class="start-seal" aria-hidden="true">蛋</span>
        <small>十卷风云 · 六侠同行</small>
        <h1>蛋蛋江湖 2.0</h1>
        ${view.error ? `<p class="form-error" role="alert">${escapeHtml(view.error)}</p>` : ''}
        <div class="start-actions">
          <button type="button" class="primary" data-action="new-game" data-testid="new-game">新建游戏</button>
          <button type="button" data-action="continue-game" data-testid="continue-game" ${view.hasSave && !view.busy ? '' : 'disabled'}>继续游戏</button>
        </div>
      </section>
    </main>`
  }

  return `<main class="start-page" data-testid="new-game-page">
    <form class="start-card panel new-game-form" data-action="create-game">
      <small>少侠，请留名</small><h1>新建游戏</h1>
      <label for="player-name">玩家姓名</label>
      <input id="player-name" name="playerName" autocomplete="off"
        value="${escapeHtml(view.playerName)}" ${view.busy ? 'disabled' : ''} autofocus>
      <p class="form-hint">1～8 个字符，初始身份为丙级剑客。</p>
      ${view.error ? `<p class="form-error" role="alert">${escapeHtml(view.error)}</p>` : ''}
      ${view.confirmOverwrite ? `<section class="danger-confirm" data-testid="overwrite-confirmation">
        <strong>现有进度将被永久覆盖</strong><span>此操作无法撤销。</span>
        <div><button type="button" data-action="cancel-overwrite">取消</button>
        <button type="button" class="danger" data-action="confirm-overwrite">确认覆盖并开始</button></div>
      </section>` : `<div class="start-actions"><button type="button" data-action="back-title">返回</button>
        <button type="submit" class="primary" data-testid="enter-jianghu" ${view.busy ? 'disabled' : ''}>踏入江湖</button></div>`}
    </form>
  </main>`
}
```

在 `src/style.css` 增加：

```css
.start-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.start-card {
  width: min(460px, 100%);
  display: grid;
  gap: 14px;
  padding: clamp(24px, 5vw, 48px);
  text-align: center;
}

.start-card > small { color: var(--gold); letter-spacing: .22em; }
.start-card > h1 { margin: 0; color: #f0e4ce; font-size: clamp(30px, 6vw, 52px); letter-spacing: .12em; }
.start-seal { width: 64px; height: 64px; display: grid; place-items: center; margin: 0 auto; border: 1px solid #ca755f; color: #f0d7c7; background: #7f342b; font-size: 28px; font-weight: 800; box-shadow: inset 0 0 0 4px #2b1713; }
.start-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
.start-actions button { min-height: 44px; padding: 10px 16px; }
.new-game-form { text-align: left; }
.new-game-form input { width: 100%; padding: 11px 12px; color: var(--paper); border: 1px solid var(--line); border-radius: var(--radius); background: var(--ink-950); }
.new-game-form input:focus { outline: 2px solid var(--gold); outline-offset: 2px; }
.form-hint { margin: -6px 0 0; color: var(--paper-muted); font-size: 11px; }
.form-error { margin: 0; color: #ffd8cf; }
.danger-confirm { display: grid; gap: 10px; padding: 14px; border: 1px solid #8d4437; background: #351d19; }
.danger-confirm > span { color: #c9aaa1; font-size: 11px; }
.danger-confirm > div { display: flex; justify-content: flex-end; gap: 8px; }
button.danger { border-color: #a45141; color: #ffe1d8; background: #642f27; }

@media (max-width: 560px) {
  .start-page { padding: 12px; }
  .start-card { padding: 24px 18px; }
  .start-actions { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: 运行启动页测试并确认 GREEN**

Run: `npx vitest run src/ui/start-page.test.ts`

Expected: PASS，2 tests passed。

- [ ] **Step 5: 提交启动页面**

```powershell
git add egg-jianghu/src/ui/start-page.test.ts egg-jianghu/src/ui/start-page.ts egg-jianghu/src/style.css
git commit -m "✨ feat(ui): 新增标题与新建游戏页面"
```

---

### Task 5: 接入启动状态与删档重开交互

**Files:**
- Modify: `src/ui/shell.test.ts`
- Modify: `src/ui/shell.ts:6-55`
- Modify: `src/main.ts:2-53,131-180,331-420,422-493,540-666`
- Modify: `src/style.css`
- Create: `tests/e2e/start-flow.spec.ts`

- [ ] **Step 1: 写游戏内删档确认 UI 的失败测试**

在 `src/ui/shell.test.ts` 的两个既有 fixture 中加入 `showResetConfirmation: false`，并增加：

```typescript
it('侧栏提供删档入口并只在请求后显示二次确认', () => {
  const normal = renderShell({
    activeTab: 'idle', worldContext: null, hasCombatReturn: false,
    showResetConfirmation: false, content: '<p>内容</p>',
  })
  expect(normal).toContain('data-action="request-reset-save"')
  expect(normal).not.toContain('data-testid="reset-save-confirmation"')

  const confirming = renderShell({
    activeTab: 'idle', worldContext: null, hasCombatReturn: false,
    showResetConfirmation: true, content: '<p>内容</p>',
  })
  expect(confirming).toContain('data-testid="reset-save-confirmation"')
  expect(confirming).toContain('data-action="confirm-reset-save"')
  expect(confirming).toContain('data-action="cancel-reset-save"')
})
```

- [ ] **Step 2: 运行 Shell 测试并确认 RED**

Run: `npx vitest run src/ui/shell.test.ts`

Expected: FAIL，当前 Shell 没有删档入口或确认区域。

- [ ] **Step 3: 扩展 Shell 的危险操作区域**

在 `ShellViewModel` 增加：

```typescript
showResetConfirmation: boolean
```

在 `</aside>` 前渲染：

```typescript
<footer class="sidebar-danger-zone">
  ${view.showResetConfirmation
    ? `<section class="danger-confirm compact" data-testid="reset-save-confirmation">
        <strong>永久删除当前进度？</strong>
        <div><button type="button" data-action="cancel-reset-save">取消</button>
        <button type="button" class="danger" data-action="confirm-reset-save">确认删档</button></div>
      </section>`
    : '<button type="button" class="text-action danger-link" data-action="request-reset-save">删档重开</button>'}
</footer>
```

在 `src/style.css` 增加：

```css
.sidebar-danger-zone { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line); }
.danger-link { width: 100%; padding: 8px; color: #a9776d; background: transparent; }
.danger-confirm.compact { padding: 10px; font-size: 11px; }
.danger-confirm.compact > div { display: grid; grid-template-columns: 1fr 1fr; }
.danger-confirm.compact button { min-width: 0; padding: 7px 5px; font-size: 10px; }
```

- [ ] **Step 4: 运行 Shell 测试并确认 GREEN**

Run: `npx vitest run src/ui/shell.test.ts`

Expected: PASS，3 tests passed。

- [ ] **Step 5: 在主流程实现前写完整启动流程 E2E contract**

创建 `tests/e2e/start-flow.spec.ts`：

```typescript
import { expect, test, type Page } from '@playwright/test'

let pageErrors: string[]

test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
})

test.afterEach(() => expect(pageErrors).toEqual([]))

const createGame = async (page: Page, name: string): Promise<void> => {
  await page.getByTestId('new-game').click()
  await page.locator('input[name="playerName"]').fill(name)
  await page.getByTestId('enter-jianghu').click()
  await expect(page.getByTestId('world-overview')).toBeVisible()
}

test('首次启动可取名并用玩家角色直接开始挂机', async ({ page }) => {
  await expect(page.getByTestId('title-page')).toBeVisible()
  await expect(page.getByTestId('continue-game')).toBeDisabled()
  await createGame(page, '燕七')
  await page.getByTestId('tab-heroes').click()
  await expect(page.getByTestId('hero-hero_player')).toContainText('燕七')
  await page.getByTestId('tab-idle').click()
  await page.getByTestId('world-world_01').click()
  await page.getByTestId('stage-1').click()
  await expect(page.locator('[data-unit-id="hero_player"]')).toContainText('燕七')
})

test('姓名无效时停留在新建页并显示校验错误', async ({ page }) => {
  await page.getByTestId('new-game').click()
  await page.locator('input[name="playerName"]').fill('         ')
  await page.getByTestId('enter-jianghu').click()
  await expect(page.getByTestId('new-game-page')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('请输入玩家姓名')
})

test('重载后从标题页继续并保持玩家姓名与阵容', async ({ page }) => {
  await createGame(page, '燕七')
  await page.reload()
  await page.getByTestId('continue-game').click()
  await page.getByTestId('tab-heroes').click()
  await expect(page.getByTestId('hero-hero_player')).toContainText('燕七')
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation))
    .toEqual([{ heroId: 'hero_player', row: 'front', position: 0 }])
})

test('已有存档的新建游戏必须确认覆盖', async ({ page }) => {
  await createGame(page, '旧少侠')
  await page.reload()
  await page.getByTestId('new-game').click()
  await page.locator('input[name="playerName"]').fill('新少侠')
  await page.getByTestId('enter-jianghu').click()
  await expect(page.getByTestId('overwrite-confirmation')).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByTestId('overwrite-confirmation')).toHaveCount(0)
  await page.getByRole('button', { name: '返回' }).click()
  await page.getByTestId('continue-game').click()
  await page.getByTestId('tab-heroes').click()
  await expect(page.getByTestId('hero-hero_player')).toContainText('旧少侠')

  await page.reload()
  await page.getByTestId('new-game').click()
  await page.locator('input[name="playerName"]').fill('新少侠')
  await page.getByTestId('enter-jianghu').click()
  await page.getByRole('button', { name: '确认覆盖并开始' }).click()
  await page.getByTestId('tab-heroes').click()
  await expect(page.getByTestId('hero-hero_player')).toContainText('新少侠')
})

test('删档重开后继续游戏不可用', async ({ page }) => {
  await createGame(page, '燕七')
  await page.getByRole('button', { name: '删档重开' }).click()
  await expect(page.getByTestId('reset-save-confirmation')).toBeVisible()
  await page.getByRole('button', { name: '确认删档' }).click()
  await expect(page.getByTestId('new-game-page')).toBeVisible()
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page.getByTestId('continue-game')).toBeDisabled()
})
```

- [ ] **Step 6: 运行启动流程 E2E 并确认 RED**

Run: `npx playwright test tests/e2e/start-flow.spec.ts`

Expected: FAIL，首页仍直接进入游戏且新建、继续与删档定位器尚不存在。

- [ ] **Step 7: 将 `main.ts` 改为显式顶层页面状态**

调整 import：

```typescript
import { clearSaveV10, hasSaveV10, SAVE_KEY_V10 } from './domain/save-v10'
import { normalizePlayerName } from './domain/state'
import { renderStartPage } from './ui/start-page'
```

用以下状态替换启动时自动载入 session：

```typescript
type AppScreen = 'title' | 'new-game' | 'playing'
let appScreen: AppScreen = 'title'
let session: GameSession
type JianghuView = 'worlds' | 'world' | 'combat'
let activeTab: TabId = 'idle'
let jianghuView: JianghuView = 'worlds'
let jianghuSection: JianghuSection = 'stages'
let selectedWorldId = 'world_01'
let selectedStage = 1
let selectedHeroId: string | null = null
let selectedFactionId = 'qingfeng_hall'
let combatSpeed: 1 | 2 | 4 = 1
let combatLogs: string[] = []
let toastTimer = 0
let hasSave = false
let playerNameInput = ''
let startError: string | null = null
let confirmOverwrite = false
let startBusy = false
let showResetConfirmation = false

try {
  hasSave = hasSaveV10(window.localStorage)
} catch {
  startError = '无法访问本地存储，请检查浏览器设置'
}
```

增加统一的游戏界面初始化函数：

```typescript
const enterPlaying = (nextSession: GameSession): void => {
  session = nextSession
  appScreen = 'playing'
  activeTab = 'idle'
  jianghuView = 'worlds'
  jianghuSection = 'stages'
  selectedWorldId = session.state.unlockedWorldIds[0] ?? 'world_01'
  selectedStage = Math.min(10, Math.max(1, (session.state.clearedStageByWorld[selectedWorldId] ?? 0) + 1))
  selectedHeroId = Object.keys(session.state.heroes)[0] ?? null
  selectedFactionId = FACTIONS.find((faction) => session.state.unlockedWorldIds.includes(faction.worldId))?.id ?? 'qingfeng_hall'
  combatSpeed = 1
  combatLogs = []
  showResetConfirmation = false
}
```

将现有游戏主体渲染提取为 `renderGame`，让 `render` 在访问 session 前处理启动页：

```typescript
const renderGame = (): void => {
  normalizeSelectedWorld()
  const world = WORLDS.find((item) => item.id === selectedWorldId) ?? WORLDS[0]
  const content = activeTab === 'idle'
    ? renderJianghuContent()
    : activeTab === 'heroes'
      ? renderHeroesPage(heroesViewModel())
      : renderInventoryPage(inventoryViewModel())
  patchApp(renderShell({
    activeTab,
    worldContext: activeTab === 'idle' && jianghuView !== 'worlds'
      ? { worldName: world.name, activeSection: jianghuSection }
      : null,
    hasCombatReturn: Boolean(session.combat && !(activeTab === 'idle' && jianghuView === 'combat')),
    showResetConfirmation,
    content,
  }))
}

const render = (): void => {
  if (appScreen === 'playing') {
    renderGame()
    return
  }
  patchApp(renderStartPage({
    screen: appScreen,
    hasSave,
    playerName: playerNameInput,
    error: startError,
    confirmOverwrite,
    busy: startBusy,
  }))
}
```

- [ ] **Step 8: 接入表单、新建、继续、覆盖与删档事件**

增加新档创建函数与表单提交监听：

```typescript
const createAndEnterGame = (): void => {
  startBusy = true
  startError = null
  try {
    playerNameInput = normalizePlayerName(playerNameInput)
    const nextSession = GameSession.createNew(window.localStorage, playerNameInput)
    hasSave = true
    enterPlaying(nextSession)
  } catch (error) {
    startError = error instanceof Error ? error.message : '新建游戏失败'
  } finally {
    startBusy = false
  }
}

app.addEventListener('submit', (event) => {
  const form = (event.target as HTMLElement).closest<HTMLFormElement>('form[data-action="create-game"]')
  if (!form || appScreen !== 'new-game' || startBusy) return
  event.preventDefault()
  const data = new FormData(form)
  playerNameInput = String(data.get('playerName') ?? '')
  startError = null
  try {
    playerNameInput = normalizePlayerName(playerNameInput)
    if (hasSave) confirmOverwrite = true
    else createAndEnterGame()
  } catch (error) {
    startError = error instanceof Error ? error.message : '新建游戏失败'
  }
  render()
})
```

增加两个小型 action handler：

```typescript
const handleStartAction = (button: HTMLButtonElement): boolean => {
  if (appScreen === 'playing') return false
  const action = button.dataset.action
  if (action === 'new-game') {
    appScreen = 'new-game'
    startError = null
    confirmOverwrite = false
  } else if (action === 'back-title') {
    appScreen = 'title'
    startError = null
    confirmOverwrite = false
  } else if (action === 'continue-game') {
    startBusy = true
    try {
      enterPlaying(GameSession.continue(window.localStorage))
    } catch (error) {
      startError = error instanceof Error ? error.message : '继续游戏失败'
    } finally {
      startBusy = false
    }
  } else if (action === 'cancel-overwrite') {
    confirmOverwrite = false
  } else if (action === 'confirm-overwrite') {
    confirmOverwrite = false
    createAndEnterGame()
  } else {
    return false
  }
  return true
}

const handleResetAction = (button: HTMLButtonElement): boolean => {
  if (appScreen !== 'playing') return false
  const action = button.dataset.action
  if (action === 'request-reset-save') showResetConfirmation = true
  else if (action === 'cancel-reset-save') showResetConfirmation = false
  else if (action === 'confirm-reset-save') {
  try {
    clearSaveV10(window.localStorage)
    session.stopCombat()
    hasSave = false
    appScreen = 'new-game'
    playerNameInput = ''
    startError = null
    confirmOverwrite = false
  } catch {
    showResetConfirmation = false
    notify('删档失败，当前进度仍已保留', true)
  }
  } else return false
  return true
}
```

在现有 click handler 取得 `[data-action]` button 后、访问 session 前调用：

```typescript
if (handleStartAction(button) || handleResetAction(button)) {
  render()
  return
}
```

- [ ] **Step 9: 守卫计时器、关闭保存与调试接口**

将运行时计时器和关闭保存改为：

```typescript
window.setInterval(() => {
  if (appScreen !== 'playing') return
  if (session.combat) logEvents(session.advanceTicks(combatSpeed))
  session.advanceRuntime(COMBAT_TICK_MS)
  render()
}, COMBAT_TICK_MS)

window.addEventListener('beforeunload', () => {
  if (appScreen === 'playing') session.save()
})
```

将调试 `reset` 改成创建确定性的测试新档：

```typescript
reset: () => {
  window.localStorage.removeItem(SAVE_KEY_V10)
  enterPlaying(GameSession.createNew(window.localStorage, '测试少侠', 1000))
  hasSave = true
  render()
},
```

其余调试方法只在 E2E 已进入 `playing` 后调用，不为标题页创建隐式 session。

- [ ] **Step 10: 运行单元测试、启动流程 E2E 和构建并确认 GREEN**

Run: `npm test`

Expected: PASS，所有 Vitest 测试通过。

Run: `npm run build`

Expected: PASS，`tsc && vite build` 成功且无 TypeScript error。

Run: `npx playwright test tests/e2e/start-flow.spec.ts`

Expected: PASS，5 tests passed，无 `pageerror`。

- [ ] **Step 11: 提交完整交互流程**

```powershell
git add egg-jianghu/src/ui/shell.test.ts egg-jianghu/src/ui/shell.ts egg-jianghu/src/main.ts egg-jianghu/src/style.css egg-jianghu/tests/e2e/start-flow.spec.ts
git commit -m "✨ feat(ui): 接入新建继续与删档重开流程"
```

---

### Task 6: 适配既有浏览器回归并最终验证

**Files:**
- Modify: `tests/e2e/mvp.spec.ts:1-320`

- [ ] **Step 1: 让既有 E2E 通过真实新建流程准备测试新档**

在现有 `beforeEach` 中保留 page error 收集，但先通过 UI 创建测试新档：

```typescript
test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.getByTestId('new-game').click()
  await page.locator('input[name="playerName"]').fill('测试少侠')
  await page.getByTestId('enter-jianghu').click()
  await expect(page.getByTestId('world-overview')).toBeVisible()
})
```

- [ ] **Step 2: 调整既有重载测试适配标题页**

在既有“重载页面后长期收益保留但必须重新选择关卡”用例中，`page.reload()` 后先继续游戏：

```typescript
await page.reload()
await expect(page.getByTestId('title-page')).toBeVisible()
await page.getByTestId('continue-game').click()
const after = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
```

保留该用例原有的货币、背包、战斗不持久化和世界总览断言。

- [ ] **Step 3: 运行启动流程和既有 E2E 并确认 GREEN**

Run: `npx playwright test tests/e2e/start-flow.spec.ts tests/e2e/mvp.spec.ts`

Expected: PASS，新增启动流程与全部既有回归通过，无 `pageerror`。

- [ ] **Step 4: 运行完整验证链**

Run: `npm test`

Expected: PASS，全部 Vitest 测试通过。

Run: `npm run build`

Expected: PASS，TypeScript 与 Vite build 通过。

Run: `npm run test:e2e`

Expected: PASS，全部 Playwright 测试通过。

Run: `git diff --check`

Expected: 无输出，exit code 0。

- [ ] **Step 5: 同步 CodeGraph 并核实索引状态**

```powershell
codegraph sync "D:\Projects\OpenProject\花旦的各种小游戏\挂机游戏\蛋蛋江湖2.0"
codegraph status "D:\Projects\OpenProject\花旦的各种小游戏\挂机游戏\蛋蛋江湖2.0"
```

Expected: sync 成功，status 显示 `[OK] Index is up to date`，文件和 symbol 统计包含本次新增文件。

- [ ] **Step 6: 提交 E2E 与最终测试调整**

```powershell
git add egg-jianghu/tests/e2e/mvp.spec.ts
git commit -m "✅ test(e2e): 适配标题页与继续游戏流程"
```

- [ ] **Step 7: 核对最终工作树与提交序列**

Run: `git status --porcelain=v1 -b`

Expected: 只显示当前分支行，没有未提交文件。

Run: `git log -6 --oneline`

Expected: 依次包含玩家新档、自定义姓名、存档 API、启动页面、主流程和 E2E 六个提交。

---

## 计划自检结果

- 规格覆盖：标题页、新建/继续、自由取名、丙级剑客、默认阵容、旧档不补发、覆盖确认、删档确认、异常保护和完整测试均有对应 Task。
- 类型一致性：统一使用 `hero_player`、`customName`、`createNewGameStateV10`、`GameSession.createNew`、`GameSession.continue` 和 `hasSaveV10`。
- 依赖顺序：数据模型 → 名称链路 → 存档 API → 纯 UI → E2E contract RED → 主流程 GREEN → 全量 E2E，不存在后置 Task 才能编译的中间提交。
- 范围控制：不加入职业选择、多存档、旧档迁移、外观选择或云存档。
