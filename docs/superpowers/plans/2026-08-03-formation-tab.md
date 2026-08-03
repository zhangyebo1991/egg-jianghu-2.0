# 阵容独立 Tab 与拖拽编辑 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把阵容从侠客页拆成侧边栏独立 Tab，桌面用原生拖拽（上阵/移动/交换/下阵），触屏用点击流 + 格子角落 × 下阵。

**Architecture:** 新增 `src/domain/formation.ts`（`placeFormation` 交换语义 + `removeFormation`），新增 `src/ui/formation-page.ts` 渲染阵容页；`shell.ts` 增加 `formation` Tab；`main.ts` 扩展渲染分派、新增拖拽/触屏事件委托、接入 domain。侠客页移除阵容编辑器。

**Tech Stack:** TypeScript + Vite + Vitest + Playwright。无新增依赖，遵循现有 `data-action` 事件委托 + `createDomPatcher` 架构。

## Global Constraints

- 全程 TDD：先写失败测试，再实现，再跑测试确认通过，最后提交。
- 文案统一中文；保留 `data-testid`/`data-action` 约定。
- 触屏检测统一用 `const isTouchDevice = (): boolean => window.matchMedia('(hover: none)').matches || navigator.maxTouchPoints > 0`。
- 拖拽事件只在 `[data-testid="formation-page"]` 内生效；非目标区不响应。
- 不新增第三方依赖；不改存档 schema；不引入未在下面任务中定义的符号。
- 每个 Task 结束时 `npm test` 必须全绿（Task 7 再跑 E2E）。

---

### Task 1: Domain 阵容模块（交换语义）+ 单测

**Files:**
- Create: `egg-jianghu/src/domain/formation.ts`
- Create: `egg-jianghu/src/domain/formation.test.ts`

**Interfaces:**
- Produces: `placeFormation(state: GameStateV10, heroId: string, row: FormationRow, position: FormationPosition): ActionResult`
- Produces: `removeFormation(state: GameStateV10, heroId: string): ActionResult`
- Consumes: `createNewGameStateV10` from `./state`、`PLAYER_HERO_ID` from `../content/heroes`、`recruitFromTavern` from `./recruitment`、`FormationRow/FormationPosition/GameStateV10/ActionResult` from `./types`

- [ ] **Step 1: 写失败测试** `egg-jianghu/src/domain/formation.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { PLAYER_HERO_ID } from '../content/heroes'
import { createNewGameStateV10 } from './state'
import { recruitFromTavern } from './recruitment'
import { placeFormation, removeFormation } from './formation'

const freshState = () => {
  const state = createNewGameStateV10('燕七', 1000)
  recruitFromTavern(state, 'hero_shen_yanqiu')
  recruitFromTavern(state, 'hero_huo_chuan')
  return state
}

describe('阵容领域逻辑', () => {
  it('未招募侠客不能入阵', () => {
    const state = freshState()
    expect(placeFormation(state, 'hero_none', 'front', 0)).toEqual({ ok: false, message: '请先选择已加入的侠客' })
    expect(state.formation).toEqual([{ heroId: PLAYER_HERO_ID, row: 'front', position: 0 }])
  })

  it('已上阵侠客移动到空格', () => {
    const state = freshState()
    placeFormation(state, PLAYER_HERO_ID, 'back', 1)
    expect(state.formation).toEqual([{ heroId: PLAYER_HERO_ID, row: 'back', position: 1 }])
  })

  it('两个已上阵侠客交换位置', () => {
    const state = freshState()
    state.formation.push({ heroId: 'hero_shen_yanqiu', row: 'front', position: 1 })
    placeFormation(state, PLAYER_HERO_ID, 'front', 1)
    expect(state.formation).toEqual([
      { heroId: 'hero_shen_yanqiu', row: 'front', position: 0 },
      { heroId: PLAYER_HERO_ID, row: 'front', position: 1 },
    ])
  })

  it('未上阵侠客拖到已占格时顶替原侠客', () => {
    const state = freshState()
    placeFormation(state, 'hero_shen_yanqiu', 'front', 0)
    expect(state.formation).toEqual([{ heroId: 'hero_shen_yanqiu', row: 'front', position: 0 }])
  })

  it('侠客拖回自己原位不产生变化', () => {
    const state = freshState()
    expect(placeFormation(state, PLAYER_HERO_ID, 'front', 0)).toEqual({ ok: false, message: '侠客已在该位' })
    expect(state.formation).toEqual([{ heroId: PLAYER_HERO_ID, row: 'front', position: 0 }])
  })

  it('removeFormation 移除侠客并支持空操作提示', () => {
    const state = freshState()
    expect(removeFormation(state, PLAYER_HERO_ID)).toEqual({ ok: true, message: '侠客已下阵' })
    expect(state.formation).toEqual([])
    expect(removeFormation(state, PLAYER_HERO_ID)).toEqual({ ok: false, message: '侠客不在阵中' })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test`
Expected: 失败，报 `Cannot find module './formation'`（模块还不存在）。

- [ ] **Step 3: 写实现** `egg-jianghu/src/domain/formation.ts`

```ts
import type { ActionResult, FormationPosition, FormationRow, GameStateV10 } from './types'

export const placeFormation = (
  state: GameStateV10,
  heroId: string,
  row: FormationRow,
  position: FormationPosition,
): ActionResult => {
  if (!state.heroes[heroId]?.recruited) return { ok: false, message: '请先选择已加入的侠客' }
  const current = state.formation.find((slot) => slot.heroId === heroId)
  if (current?.row === row && current?.position === position) return { ok: false, message: '侠客已在该位' }
  const target = state.formation.find((slot) => slot.row === row && slot.position === position)
  const next = state.formation.filter((slot) => slot.heroId !== heroId && !(slot.row === row && slot.position === position))
  if (target && current) next.push({ heroId: target.heroId, row: current.row, position: current.position })
  next.push({ heroId, row, position })
  state.formation = next
  return { ok: true, message: '侠客已入阵' }
}

export const removeFormation = (state: GameStateV10, heroId: string): ActionResult => {
  const before = state.formation.length
  state.formation = state.formation.filter((slot) => slot.heroId !== heroId)
  return state.formation.length < before ? { ok: true, message: '侠客已下阵' } : { ok: false, message: '侠客不在阵中' }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`
Expected: `formation.test.ts` 全部 PASS，其余既有测试不受影响。

- [ ] **Step 5: 提交**

```bash
git add egg-jianghu/src/domain/formation.ts egg-jianghu/src/domain/formation.test.ts
git commit -m "✨ feat(domain): 阵容模块支持移动交换顶替与下阵"
```

---

### Task 2: 阵容页渲染器 + 渲染测试

**Files:**
- Create: `egg-jianghu/src/ui/formation-page.ts`
- Modify: `egg-jianghu/src/ui/pages.test.ts`（新增 fixture 与测试）

**Interfaces:**
- Produces: `renderFormationPage(view: FormationPageViewModel): string`
- Produces: `FormationPageViewModel { selectedHeroId: string | null; formation: Array<{ heroId: string; row: 'front'|'back'; position: 0|1|2 }>; heroes: Array<{ id: string; name: string; grade: string; level: number; inFormation: boolean }> }`
- Consumes: `escapeHtml` from `./html`

- [ ] **Step 1: 写失败测试**（在 `pages.test.ts` 追加）

在文件顶部增加 import 与 fixture：

```ts
import { renderFormationPage, type FormationPageViewModel } from './formation-page'

const formationFixture = (): FormationPageViewModel => ({
  selectedHeroId: null,
  formation: [{ heroId: 'hero_test', row: 'front', position: 0 }],
  heroes: [
    { id: 'hero_test', name: '试剑人', grade: '乙', level: 12, inFormation: true },
    { id: 'hero_shen', name: '沈砚秋', grade: '乙', level: 1, inFormation: false },
  ],
})
```

在 `describe` 内追加两个用例：

```ts
it('阵容页输出前后排各三格与待上阵名单', () => {
  const html = renderFormationPage(formationFixture())
  expect(html.match(/data-row="front"/g)).toHaveLength(3)
  expect(html.match(/data-row="back"/g)).toHaveLength(3)
  expect(html).toContain('已上阵')
  expect(html).toContain('data-testid="formation-hero-hero_test"')
  expect(html).toContain('formation-slot-remove')
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test`
Expected: `pages.test.ts` 新增用例失败，报 `Cannot find module './formation-page'`。

- [ ] **Step 3: 写实现** `egg-jianghu/src/ui/formation-page.ts`

```ts
import { escapeHtml } from './html'

export interface FormationHeroView {
  id: string
  name: string
  grade: string
  level: number
  inFormation: boolean
}

export interface FormationPageViewModel {
  selectedHeroId: string | null
  formation: Array<{ heroId: string; row: 'front' | 'back'; position: 0 | 1 | 2 }>
  heroes: FormationHeroView[]
}

const renderFormationSlots = (view: FormationPageViewModel): string => (['back', 'front'] as const).flatMap((row) =>
  ([0, 1, 2] as const).map((position) => {
    const slot = view.formation.find((item) => item.row === row && item.position === position)
    const hero = slot ? view.heroes.find((item) => item.id === slot.heroId) : undefined
    return `<div class="formation-editor-slot ${hero ? 'filled' : ''}" data-row="${row}" data-position="${position}" data-action="formation-slot-tap" ${hero ? `data-hero-id="${hero.id}" draggable="true"` : ''}>
      <span>${row === 'front' ? '前排' : '后排'} ${position + 1}</span>
      ${hero ? `<strong>${escapeHtml(hero.name)}</strong><small>${escapeHtml(hero.grade)}品</small><button type="button" class="formation-slot-remove" data-action="formation-remove" data-hero-id="${hero.id}" aria-label="下阵 ${escapeHtml(hero.name)}">×</button>` : ''}
    </div>`
  }),
).join('')

export const renderFormationPage = (view: FormationPageViewModel): string => `
  <section class="heroes-layout" data-testid="formation-page">
    <aside class="hero-roster formation-roster panel">
      <header><small>待上阵侠客</small><strong>${view.heroes.length} 人</strong></header>
      <div class="hero-list">${view.heroes.map((hero) => `<button type="button" draggable="true" data-action="formation-select" data-hero-id="${hero.id}" class="hero-row${hero.inFormation ? ' in-formation' : ''}" data-testid="formation-hero-${hero.id}">
        <span data-rarity="${escapeHtml(hero.grade)}">${escapeHtml(hero.grade)}</span><strong>${escapeHtml(hero.name)}</strong><small>侠客 Lv.${hero.level}${hero.inFormation ? ' · 已上阵' : ''}</small>
      </button>`).join('') || '<p>尚无侠客</p>'}</div>
    </aside>
    <section class="hero-workbench">
      <section class="formation-editor panel"><header><small>六侠阵容</small><strong>前后排各三格</strong></header><div class="formation-editor-grid">${renderFormationSlots(view)}</div></section>
    </section>
  </section>`
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`
Expected: `pages.test.ts` 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add egg-jianghu/src/ui/formation-page.ts egg-jianghu/src/ui/pages.test.ts
git commit -m "✨ feat(ui): 新增阵容页渲染器"
```

---

### Task 3: 接入阵容 Tab（shell + 渲染分派 + formationViewModel）

**Files:**
- Modify: `egg-jianghu/src/ui/shell.ts`（TabId、tabs）
- Modify: `egg-jianghu/src/ui/shell.test.ts`
- Modify: `egg-jianghu/src/main.ts`（import、状态、`formationViewModel`、`render()` 分派）

**Interfaces:**
- Consumes: `renderFormationPage`、`FormationPageViewModel` from `./ui/formation-page`
- Produces: `TabId` 扩展为 `'idle' | 'heroes' | 'formation' | 'inventory'`
- Produces: `let formationSelectedHeroId: string | null`、`let dragHeroId: string | null`

- [ ] **Step 1: 改测试** `egg-jianghu/src/ui/shell.test.ts`

第 5 行用例描述与断言改为：

```ts
it('仅显示四个全局入口且不显示顶部资源和自动存档', () => {
  const html = renderShell({
    activeTab: 'idle',
    worldContext: null,
    hasCombatReturn: false,
    showResetConfirmation: false,
    content: '<p>内容</p>',
  })

  expect(html).toContain('class="game-sidebar"')
  expect(html).toContain('data-testid="tab-idle"')
  expect(html).toContain('data-testid="tab-heroes"')
  expect(html).toContain('data-testid="tab-formation"')
  expect(html).toContain('data-testid="tab-inventory"')
  expect(html).not.toMatch(/tab-factions|tab-city|势力贡献|装备背包|自动存档|resource-strip/)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test`
Expected: `shell.test.ts` 该用例失败，因 `tab-formation` 尚不存在。

- [ ] **Step 3: 改实现**

`egg-jianghu/src/ui/shell.ts`：

```ts
export type TabId = 'idle' | 'heroes' | 'formation' | 'inventory'
```

```ts
const tabs: Array<{ id: TabId; label: string; mark: string }> = [
  { id: 'idle', label: '江湖', mark: '卷' },
  { id: 'heroes', label: '侠客', mark: '侠' },
  { id: 'formation', label: '阵容', mark: '阵' },
  { id: 'inventory', label: '背包', mark: '匣' },
]
```

`egg-jianghu/src/main.ts`：

在 import 区（第 25 行附近）追加：

```ts
import { renderFormationPage, type FormationPageViewModel } from './ui/formation-page'
```

在第 53 行 `let selectedHeroId` 附近追加两个 UI 态：

```ts
let formationSelectedHeroId: string | null = null
let dragHeroId: string | null = null
```

在 `heroesViewModel`（约第 270 行）之后新增：

```ts
const formationViewModel = (): FormationPageViewModel => ({
  formation: session.state.formation,
  selectedHeroId: formationSelectedHeroId,
  heroes: recruitedHeroes().map(({ definition, progress, name }) => ({
    id: definition.id,
    name,
    grade: definition.grade,
    level: progress.level,
    inFormation: session.state.formation.some((slot) => slot.heroId === definition.id),
  })),
})
```

把 `render()`（第 421-425 行）的 content 分派改为：

```ts
  const content = activeTab === 'idle'
    ? renderJianghuContent()
    : activeTab === 'heroes'
      ? renderHeroesPage(heroesViewModel())
      : activeTab === 'formation'
        ? renderFormationPage(formationViewModel())
        : renderInventoryPage(inventoryViewModel())
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`
Expected: `shell.test.ts` 与既有测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add egg-jianghu/src/ui/shell.ts egg-jianghu/src/ui/shell.test.ts egg-jianghu/src/main.ts
git commit -m "✨ feat(ui): 侧栏新增阵容Tab并接入渲染分派"
```

---

### Task 4: 拖拽/触屏事件接线 + domain 接入

**Files:**
- Modify: `egg-jianghu/src/main.ts`（删除本地 placeFormation/removeFormation、import domain、新增 isTouchDevice/拖拽/触屏事件、更新 performAction 与 debug placeHero）

**Interfaces:**
- Consumes: `placeFormation`/`removeFormation` from `./domain/formation`
- Produces: `isTouchDevice()`、dragstart/dragover/drop/dragend 委托、`formation-select`/`formation-slot-tap`/`formation-remove` action 处理

- [ ] **Step 1: 先跑现有测试建立基线**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 2: 改实现 —— 删除本地函数并 import domain**

删除 `egg-jianghu/src/main.ts` 第 487-498 行的本地 `placeFormation`/`removeFormation` 两个函数。

在 import 区（domain 相关 import 附近，第 13-21 行）追加：

```ts
import { placeFormation, removeFormation } from './domain/formation'
```

注意：`FormationRow`、`FormationPosition` 类型仍来自 `./domain/types` 的 import，保持不变。

- [ ] **Step 3: 改实现 —— performAction 分支**

`performAction`（第 505-506 行）改为：

```ts
  if (action === 'formation-place') commitAction(placeFormation(session.state, heroId, button.dataset.targetRow as FormationRow, dataNumber(button, 'position') as FormationPosition))
  else if (action === 'formation-remove') commitAction(removeFormation(session.state, heroId))
  else if (action === 'formation-select') {
    if (isTouchDevice()) formationSelectedHeroId = heroId
  } else if (action === 'formation-slot-tap') {
    if (isTouchDevice() && formationSelectedHeroId) {
      commitAction(placeFormation(session.state, formationSelectedHeroId, button.dataset.row as FormationRow, dataNumber(button, 'position') as FormationPosition))
    }
  }
```

注意：`formation-place` 分支在 Task 5 删除旧 UI 后一并移除；此处保留以兼容仍存在的旧阵容编辑器按钮。

- [ ] **Step 4: 改实现 —— debug 钩子 placeHero**

第 902 行改为：

```ts
  placeHero: (heroId, row, position) => { ensurePlaying(); commitAction(placeFormation(session.state, heroId, row, position)); render() },
```

- [ ] **Step 5: 改实现 —— 新增触屏检测与拖拽事件委托**

在 `dataNumber`（第 500 行）之后新增：

```ts
const isTouchDevice = (): boolean => window.matchMedia('(hover: none)').matches || navigator.maxTouchPoints > 0

const clearDragOver = (): void => {
  app.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'))
}

app.addEventListener('dragstart', (event) => {
  const source = (event.target as HTMLElement).closest<HTMLElement>('[data-hero-id]')
  if (!source) return
  dragHeroId = source.dataset.heroId ?? null
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
})

app.addEventListener('dragover', (event) => {
  const target = event.target as HTMLElement
  if (!dragHeroId || !target.closest('[data-testid="formation-page"]')) return
  const slot = target.closest<HTMLElement>('.formation-editor-slot')
  const roster = target.closest<HTMLElement>('.formation-roster')
  if (slot || roster) {
    event.preventDefault()
    ;(slot ?? roster).classList.add('drag-over')
  }
})

app.addEventListener('drop', (event) => {
  if (!dragHeroId) return
  const target = event.target as HTMLElement
  const slot = target.closest<HTMLElement>('.formation-editor-slot')
  if (slot) {
    event.preventDefault()
    const row = slot.dataset.row as FormationRow
    const position = dataNumber(slot, 'position') as FormationPosition
    commitAction(placeFormation(session.state, dragHeroId, row, position))
  } else if (target.closest('.formation-roster')) {
    event.preventDefault()
    commitAction(removeFormation(session.state, dragHeroId))
  }
  dragHeroId = null
  clearDragOver()
  render()
})

app.addEventListener('dragend', () => {
  dragHeroId = null
  clearDragOver()
})
```

- [ ] **Step 6: 跑测试确认通过**

Run: `npm test`
Expected: 全绿。手动在 dev 环境确认阵容页可拖拽上阵/交换/下阵，触屏可点击流。

- [ ] **Step 7: 提交**

```bash
git add egg-jianghu/src/main.ts
git commit -m "✨ feat(ui): 阵容页接入拖拽与触屏点击流事件"
```

---

### Task 5: 侠客页瘦身 + 清理旧交互

**Files:**
- Modify: `egg-jianghu/src/ui/heroes-page.ts`（删除 renderFormation、formation 字段、formation-editor 区块）
- Modify: `egg-jianghu/src/main.ts`（heroesViewModel 移除 formation 字段；performAction 移除 formation-place 分支）
- Modify: `egg-jianghu/src/ui/pages.test.ts`（heroesFixture 移除 formation；更新侠客页测试）

- [ ] **Step 1: 写失败测试**

`egg-jianghu/src/ui/pages.test.ts`：

`heroesFixture`（第 7-20 行）删除 `formation:` 行，并把第 68-74 行用例改为：

```ts
  it('侠客页展示职业独立等级且不再含阵容编辑器', () => {
    const html = renderHeroesPage(heroesFixture())
    expect(html).toContain('职业 Lv.')
    expect(html).toContain('圆满心得')
    expect(html).not.toContain('formation-editor')
    expect(html).not.toContain('六侠阵容')
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test`
Expected: `pages.test.ts` 该用例失败（heroes-page 仍输出 formation-editor）或 TS 报错（view model 仍含 formation）。

- [ ] **Step 3: 改实现**

`egg-jianghu/src/ui/heroes-page.ts`：

- 删除第 29 行 `formation: Array<...>` 字段。
- 删除第 36-47 行 `renderFormation` 函数。
- 删除第 59 行 `<section class="formation-editor panel">...</section>` 整行。

`egg-jianghu/src/main.ts`：

- 第 233 行 `formation: session.state.formation,` 删除。
- `performAction` 中删除 `formation-place` 分支（第 505 行），保留 `formation-remove`。

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`
Expected: 全绿。

注意：`npm run test:e2e` 中的 `mvp.spec.ts` 阵容用例在 Task 7 更新前会失败，属预期。

- [ ] **Step 5: 提交**

```bash
git add egg-jianghu/src/ui/heroes-page.ts egg-jianghu/src/main.ts egg-jianghu/src/ui/pages.test.ts
git commit -m "♻️ refactor(ui): 侠客页移除阵容编辑器与阵容字段"
```

---

### Task 6: 阵容页 CSS

**Files:**
- Modify: `egg-jianghu/src/style.css`

- [ ] **Step 1: 改样式**

`.formation-editor-slot`（第 345 行）增加 `position: relative;`，并追加新规则：

```css
.formation-editor-slot { position: relative; }

.formation-slot-remove {
  display: none;
  position: absolute;
  top: 3px;
  right: 3px;
  width: 18px;
  height: 18px;
  padding: 0;
  align-items: center;
  justify-content: center;
  line-height: 1;
  border-radius: 50%;
  background: #3a2519;
  color: #e8c98a;
}

@media (hover: none) {
  .formation-slot-remove { display: grid; }
}

.formation-editor-slot.drag-over {
  border-color: #c8a55c;
  background: #20261c;
}

.formation-roster.drag-over {
  outline: 1px dashed #c8a55c;
  outline-offset: -3px;
}

.hero-row.in-formation { opacity: 0.72; }
```

- [ ] **Step 2: 跑测试确认通过**

Run: `npm test`
Expected: 全绿（CSS 不影响单测，跑一遍确认无类型/构建回归）。

- [ ] **Step 3: 提交**

```bash
git add egg-jianghu/src/style.css
git commit -m "💄 style(ui): 阵容页拖拽高亮与触屏下阵按钮"
```

---

### Task 7: E2E 更新与新增

**Files:**
- Modify: `egg-jianghu/tests/e2e/mvp.spec.ts`
- Create: `egg-jianghu/tests/e2e/formation.spec.ts`

- [ ] **Step 1: 重写旧阵容用例**（`mvp.spec.ts` 第 191-207 行）

改为拖拽交互：

```ts
test('从酒馆邀请侠客后在阵容页拖拽上阵', async ({ page }) => {
  await openWorldSection(page, 'city')
  await page.getByTestId('tavern-hero_shen_yanqiu').getByRole('button', { name: '直接邀请' }).click()
  await page.getByTestId('tavern-hero_huo_chuan').getByRole('button', { name: '直接邀请' }).click()

  await page.getByTestId('tab-formation').click()
  await expect(page.getByTestId('formation-page')).toBeVisible()

  await page.dragAndDrop('[data-testid="formation-hero-hero_shen_yanqiu"]', '[data-row="front"][data-position="0"]')
  await page.dragAndDrop('[data-testid="formation-hero-hero_huo_chuan"]', '[data-row="back"][data-position="0"]')

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual(expect.arrayContaining([
    { heroId: 'hero_shen_yanqiu', row: 'front', position: 0 },
    { heroId: 'hero_huo_chuan', row: 'back', position: 0 },
  ]))
})
```

- [ ] **Step 2: 新建** `egg-jianghu/tests/e2e/formation.spec.ts`

```ts
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('测试少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await expect(page.getByTestId('world-overview')).toBeVisible()
})

const dragToSlot = async (page: Page, source: string, target: string): Promise<void> => {
  const found = await page.evaluate(({ source, target }) => {
    const from = document.querySelector(source)
    const to = document.querySelector(target)
    if (!from || !to) return false
    const dataTransfer = new DataTransfer()
    from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }))
    to.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }))
    to.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }))
    return true
  }, { source, target })
  if (!found) await page.dragAndDrop(source, target)
}

test('桌面拖拽：已占格拖到另一已占格交换位置', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_shen_yanqiu')
    window.__EGG_JIANGHU__.placeHero('hero_shen_yanqiu', 'back', 0)
  })
  await page.getByTestId('tab-formation').click()

  await dragToSlot(page, '[data-row="front"][data-position="0"]', '[data-row="back"][data-position="0"]')

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual(expect.arrayContaining([
    { heroId: 'hero_player', row: 'back', position: 0 },
    { heroId: 'hero_shen_yanqiu', row: 'front', position: 0 },
  ]))
})

test('桌面拖拽：已占格拖到名单区下阵', async ({ page }) => {
  await page.getByTestId('tab-formation').click()
  await dragToSlot(page, '[data-row="front"][data-position="0"]', '.formation-roster')

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual([])
})

test('桌面点击已占格不产生任何阵容变化', async ({ page }) => {
  await page.getByTestId('tab-formation').click()
  await page.locator('[data-row="front"][data-position="0"]').click()

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual([{ heroId: 'hero_player', row: 'front', position: 0 }])
})

test.describe('触屏视口', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

  test('触屏点击流：点选侠客后点空格置入，点角落×下阵', async ({ page }) => {
    await page.evaluate(() => {
      window.__EGG_JIANGHU__.recruitHero('hero_shen_yanqiu')
    })
    await page.getByTestId('tab-formation').click()

    await page.getByTestId('formation-hero-hero_shen_yanqiu').click()
    await page.locator('[data-row="back"][data-position="1"]').click()

    let formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
    expect(formation).toEqual(expect.arrayContaining([
      { heroId: 'hero_player', row: 'front', position: 0 },
      { heroId: 'hero_shen_yanqiu', row: 'back', position: 1 },
    ]))

    await page.locator('.formation-slot-remove[data-hero-id="hero_shen_yanqiu"]').click()
    formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
    expect(formation).toEqual([{ heroId: 'hero_player', row: 'front', position: 0 }])
  })
})
```

说明：`dragToSlot` 优先用 `page.evaluate` 派发原生 DragEvent（对 HTML5 DnD 更可靠），失败时回退 `page.dragAndDrop`。触屏用例依赖 `setViewportSize({ width: 390 })` 使 `(hover: none)` 生效或 `maxTouchPoints > 0`。

- [ ] **Step 3: 跑 E2E 确认通过**

Run: `npm run test:e2e`
Expected: 全部 PASS（含更新后的 mvp 阵容用例与新增 formation.spec）。

- [ ] **Step 4: 完整验证**

```bash
npm test
npm run build
npm run test:e2e
git diff --check
codegraph sync ..
```

- [ ] **Step 5: 提交**

```bash
git add egg-jianghu/tests/e2e/mvp.spec.ts egg-jianghu/tests/e2e/formation.spec.ts
git commit -m "✅ test(e2e): 阵容Tab拖拽与触屏交互用例"
```
