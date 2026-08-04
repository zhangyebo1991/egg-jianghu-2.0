# 侠客页物品按稀有度批量丢弃实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为侠客页物品面板新增「按稀有度批量丢弃」：选择品质阈值，两段式确认后丢弃背包中所有「品质低于等于阈值」且未装备、未锁定的装备。

**Architecture:** 遵循项目既有 `domain → ui → main` 分层。领域层在 `src/domain/inventory.ts` 新增纯函数 `discardEquipmentByQuality`；视图层在 `src/ui/heroes-page.ts` 的 `renderInventoryPanel` 工具栏新增阈值下拉与内联确认条；`src/main.ts` 以既有 `data-action` 委托 + `commitAction` 模式接线（`request`/`confirm`/`cancel` 三动作）；样式复用 `.danger` 系配色新增 `.batch-discard-confirm`。

**Tech Stack:** TypeScript · Vite · Vitest（单测）· Playwright（e2e）· 纯字符串模板渲染 + `dom-patch` 增量更新

## Global Constraints

- 品质顺序以 `src/content/equipment.ts` 的 `EQUIPMENT_QUALITIES = ['凡品','良品','上品','珍品','绝品']`（低→高）为准，用 `indexOf` 比较。
- 判定谓词（`品质索引 ≤ 阈值` 且 `非锁定` 且 `未被穿戴`）在领域层与 UI 预览中保持一致。
- 跳过已装备与已锁定；丢弃为纯清理，不返还货币/材料。
- 不修改存档 schema，不引入第三方依赖，不做无关重构。
- 界面文案、代码注释使用中文；测试用例描述用中文。
- commit message 使用 `<emoji> <type>(<scope>): <description>`（如 `✨ feat(domain): 支持按稀有度批量丢弃装备`），emoji/type 从项目约定表中选择。
- 每个任务完成后运行对应测试，全部完成后运行 `npm test`、`npm run build`。

---

### Task 1: 领域层批量丢弃函数（TDD）

**Files:**
- Modify: `egg-jianghu/src/domain/inventory.ts`（import 行 + 文件末尾）
- Test: `egg-jianghu/src/domain/inventory.test.ts`

**Interfaces:**
- Consumes: `GameStateV10`、`EquipmentInstance`、`EquipmentQuality`、`ActionResult`（均已在 types 中定义）；`EQUIPMENT_QUALITIES`（已从 `../content/equipment` 导出）。
- Produces:
  - `discardEquipmentByQuality(state: GameStateV10, maxQuality: EquipmentQuality): ActionResult` —— 删除所有 `quality 索引 ≤ maxQuality 索引`、`!locked`、且未被任何侠客 `equipmentBySlot` 引用的装备；无可丢弃时返回 `{ ok: false, message: '没有可丢弃的装备' }`，否则返回 `{ ok: true, message: '已丢弃 N 件<品质>及以下装备' }`。

- [ ] **Step 1: 扩展测试装备构造辅助函数（写失败测试）**

在 `inventory.test.ts` 顶部，给 `equipment` 辅助函数加可选 `quality` 参数，并补充 import：

```ts
import { addEquipment, discardEquipmentByQuality, INVENTORY_CAPACITY, organizeInventory } from './inventory'
import { createInitialStateV10, createNewGameStateV10 } from './state'
import type { EquipmentInstance, EquipmentQuality } from './types'

const equipment = (uid: string, quality: EquipmentQuality = '凡品'): EquipmentInstance => ({
  uid,
  definitionId: 'world_01_weapon',
  level: 1,
  quality,
  affixes: [],
  locked: false,
})
```

- [ ] **Step 2: 写领域层失败测试**

在 `describe('装备背包', ...)` 块内新增一个 `describe('按稀有度批量丢弃', ...)` 子块：

```ts
describe('按稀有度批量丢弃', () => {
  it('丢弃低于等于阈值的装备并保留更高品质', () => {
    const state = createInitialStateV10()
    state.inventory = [
      equipment('a', '凡品'),
      equipment('b', '良品'),
      equipment('c', '上品'),
      equipment('d', '珍品'),
    ]

    const result = discardEquipmentByQuality(state, '良品')

    expect(result).toEqual({ ok: true, message: '已丢弃 2 件良品及以下装备' })
    expect(state.inventory.map((item) => item.uid)).toEqual(['c', 'd'])
  })

  it('跳过已锁定装备', () => {
    const state = createInitialStateV10()
    state.inventory = [
      { ...equipment('locked', '凡品'), locked: true },
      { ...equipment('free', '凡品') },
    ]

    discardEquipmentByQuality(state, '凡品')

    expect(state.inventory.map((item) => item.uid)).toEqual(['locked'])
  })

  it('跳过已被侠客穿戴的装备', () => {
    const state = createNewGameStateV10('测试')
    state.inventory = [
      { ...equipment('worn', '凡品') },
      { ...equipment('loose', '凡品') },
    ]
    state.heroes.hero_player.equipmentBySlot.weapon = 'worn'

    discardEquipmentByQuality(state, '凡品')

    expect(state.inventory.map((item) => item.uid)).toEqual(['worn'])
  })

  it('无可丢弃装备时返回失败提示且不改变库存', () => {
    const state = createInitialStateV10()
    state.inventory = [
      { ...equipment('locked', '凡品'), locked: true },
      equipment('high', '珍品'),
    ]

    const result = discardEquipmentByQuality(state, '良品')

    expect(result).toEqual({ ok: false, message: '没有可丢弃的装备' })
    expect(state.inventory.map((item) => item.uid)).toEqual(['locked', 'high'])
  })

  it('阈值绝品清空全部未锁定未穿戴装备', () => {
    const state = createInitialStateV10()
    state.inventory = ['凡品', '良品', '上品', '珍品', '绝品'].map((quality, index) =>
      equipment(`e${index}`, quality as EquipmentQuality))

    const result = discardEquipmentByQuality(state, '绝品')

    expect(result.ok).toBe(true)
    expect(state.inventory).toHaveLength(0)
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm test -- --run src/domain/inventory.test.ts`（在 `egg-jianghu` 目录）
Expected: FAIL —— `discardEquipmentByQuality` 未定义（`Cannot find name 'discardEquipmentByQuality'`）。

- [ ] **Step 4: 实现领域函数**

修改 `inventory.ts` 顶部 import，加入 `EquipmentQuality`：

```ts
import type { ActionResult, EquipmentInstance, EquipmentQuality, GameStateV10 } from './types'
```

在 `organizeInventory` 之后追加：

```ts
// 判断装备是否正被某位侠客穿戴
const isEquipmentEquipped = (state: GameStateV10, uid: string): boolean =>
  Object.values(state.heroes).some((progress) =>
    Object.values(progress.equipmentBySlot).includes(uid))

export const discardEquipmentByQuality = (
  state: GameStateV10,
  maxQuality: EquipmentQuality,
): ActionResult => {
  const maxIndex = EQUIPMENT_QUALITIES.indexOf(maxQuality)
  const discarded = state.inventory.filter((item) =>
    EQUIPMENT_QUALITIES.indexOf(item.quality) <= maxIndex
    && !item.locked
    && !isEquipmentEquipped(state, item.uid))
  if (discarded.length === 0) return { ok: false, message: '没有可丢弃的装备' }
  const removed = new Set(discarded.map((item) => item.uid))
  state.inventory = state.inventory.filter((item) => !removed.has(item.uid))
  return { ok: true, message: `已丢弃 ${discarded.length} 件${maxQuality}及以下装备` }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test -- --run src/domain/inventory.test.ts`
Expected: PASS（5 个新用例 + 既有 3 个用例全绿）。

- [ ] **Step 6: 提交**

```bash
git add egg-jianghu/src/domain/inventory.ts egg-jianghu/src/domain/inventory.test.ts
git commit -m "✨ feat(domain): 支持按稀有度批量丢弃装备"
```

---

### Task 2: 侠客页物品栏渲染（TDD）

**Files:**
- Modify: `egg-jianghu/src/ui/heroes-page.ts`（`HeroesPageViewModel` 接口 + `renderInventoryPanel`）
- Modify: `egg-jianghu/src/ui/pages.test.ts`（`heroesFixture` + 新用例）

**Interfaces:**
- Consumes: Task 1 的 `EQUIPMENT_QUALITIES`（已导入）；`HeroesEquipmentView` 上的 `quality`、`locked`、`equippedByHeroId`。
- Produces:
  - `HeroesPageViewModel` 新增必填字段 `batchDiscardQuality: EquipmentQuality | 'all'`、`batchDiscardConfirm: boolean`。
  - 渲染产物：工具栏内 `<select data-batch-discard-quality>`；非确认态 `<button data-action="request-batch-discard">`（阈值为 `'all'` 时带 `disabled`）；确认态 `.batch-discard-confirm` 条，含 `data-action="confirm-batch-discard"` / `data-action="cancel-batch-discard"` 按钮。

- [ ] **Step 1: 更新渲染测试夹具（编译失败驱动）**

在 `pages.test.ts` 的 `heroesFixture()` 返回对象末尾（`inventoryPage: 1,` 后）补两个必填字段：

```ts
  inventoryPage: 1,
  batchDiscardQuality: 'all',
  batchDiscardConfirm: false,
```

- [ ] **Step 2: 写渲染失败测试**

在 `describe('version 10 长期循环页面', ...)` 块内新增用例：

```ts
it('物品栏提供按稀有度批量丢弃的品质选择与入口', () => {
  const html = renderHeroesPage(heroesFixture())
  expect(html).toContain('data-batch-discard-quality')
  expect(html).toMatch(/data-action="request-batch-discard" disabled/)
  expect(html).toContain('批量丢弃')
})

it('批量丢弃确认态展示将丢弃件数及跳过条件', () => {
  const html = renderHeroesPage({
    ...heroesFixture(),
    inventoryItems: [
      { ...inventoryWeapon, locked: false },
      { ...inventoryWeapon, uid: 'second', locked: false, quality: '良品' },
    ],
    batchDiscardQuality: '上品',
    batchDiscardConfirm: true,
  })
  expect(html).toContain('确认丢弃 2 件装备')
  expect(html).toContain('品质 ≤上品')
  expect(html).toContain('data-action="confirm-batch-discard"')
  expect(html).toContain('data-action="cancel-batch-discard"')
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm test -- --run src/ui/pages.test.ts`
Expected: FAIL —— TS 报 `HeroesPageViewModel` 缺 `batchDiscardQuality`/`batchDiscardConfirm` 字段（fixture 编译错误）。

- [ ] **Step 4: 实现视图渲染**

在 `heroes-page.ts` 的 `HeroesPageViewModel` 接口末尾（`inventoryPage: number` 后）追加：

```ts
  inventoryPage: number
  batchDiscardQuality: EquipmentQuality | 'all'
  batchDiscardConfirm: boolean
```

在 `renderInventoryPanel` 内 `visibleItems` 计算之后追加件数计算：

```ts
  const batchDiscardThreshold = view.batchDiscardQuality
  const batchDiscardCount = batchDiscardThreshold === 'all'
    ? 0
    : view.inventoryItems.filter((item) =>
        EQUIPMENT_QUALITIES.indexOf(item.quality) <= EQUIPMENT_QUALITIES.indexOf(batchDiscardThreshold)
        && !item.locked
        && !item.equippedByHeroId).length
```

将工具栏改为三下拉 + 一按钮，并在 `.hero-inventory-tools` 之后渲染确认条：

```ts
    <div class="hero-inventory-tools">
      <label>部位<select data-hero-inventory-filter="slot"><option value="all">全部部位</option>${selected?.equipmentSlots.map((slot) => `<option value="${slot.id}" ${view.inventorySlotFilter === slot.id ? 'selected' : ''}>${escapeHtml(slot.name)}</option>`).join('') ?? ''}</select></label>
      <label>品质<select data-hero-inventory-filter="quality"><option value="all">全部品质</option>${EQUIPMENT_QUALITIES.map((quality) => `<option value="${quality}" ${view.inventoryQualityFilter === quality ? 'selected' : ''}>${quality}</option>`).join('')}</select></label>
      <label>丢弃≤<select data-batch-discard-quality><option value="all">选择品质</option>${EQUIPMENT_QUALITIES.map((quality) => `<option value="${quality}" ${view.batchDiscardQuality === quality ? 'selected' : ''}>${quality}</option>`).join('')}</select></label>
      <button type="button" data-action="organize-hero-inventory">整理</button>
      <button type="button" data-action="request-batch-discard" ${view.batchDiscardQuality === 'all' ? 'disabled' : ''}>批量丢弃</button>
    </div>
    ${view.batchDiscardConfirm && batchDiscardThreshold !== 'all'
      ? `<div class="batch-discard-confirm" role="alertdialog" aria-label="确认批量丢弃">
          <strong>确认丢弃 ${batchDiscardCount} 件装备？</strong>
          <span>品质 ≤${escapeHtml(batchDiscardThreshold)} · 不含已装备与已锁定</span>
          <button type="button" class="danger" data-action="confirm-batch-discard" ${batchDiscardCount === 0 ? 'disabled' : ''}>确认丢弃</button>
          <button type="button" data-action="cancel-batch-discard">取消</button>
        </div>`
      : ''}
```

（「整理」按钮原样保留；工具栏变为 3 个 `label` + 2 个 `button` 的 DOM 结构，既有 e2e 对「整理」的断言不受影响。）

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test -- --run src/ui/pages.test.ts`
Expected: PASS（新增 2 用例 + 既有用例全绿）。

- [ ] **Step 6: 提交**

```bash
git add egg-jianghu/src/ui/heroes-page.ts egg-jianghu/src/ui/pages.test.ts
git commit -m "✨ feat(ui): 侠客页物品栏接入批量丢弃品质选择与确认条"
```

---

### Task 3: 控制器接线与样式

**Files:**
- Modify: `egg-jianghu/src/main.ts`（import 行、状态变量、`resetSessionState`、`heroesPageViewModel`、`change` handler、`performAction`）
- Modify: `egg-jianghu/src/style.css`

**Interfaces:**
- Consumes: Task 1 的 `discardEquipmentByQuality`；Task 2 的 `HeroesPageViewModel.batchDiscardQuality` / `.batchDiscardConfirm` 与 `data-action="request-batch-discard"` / `"confirm-batch-discard"` / `"cancel-batch-discard"`、`data-batch-discard-quality`。
- Produces: 完整可玩的交互（阈值选择、两段式确认、执行丢弃、toast 反馈、存档）。

- [ ] **Step 1: 引入领域函数**

修改 `main.ts` 第 23 行 import，在列表最前加入 `discardEquipmentByQuality`：

```ts
import { discardEquipmentByQuality, equipEquipment, INVENTORY_CAPACITY, organizeInventory, toggleEquipmentLock, unequipEquipment } from './domain/inventory'
```

- [ ] **Step 2: 新增 UI 状态变量**

在第 66 行 `let heroInventoryPage = 1` 之后追加：

```ts
let heroBatchDiscardQuality: EquipmentQuality | 'all' = 'all'
let showBatchDiscardConfirm = false
```

- [ ] **Step 3: 重置会话状态时复位**

在 `resetSessionState` 内第 106 行 `heroInventoryPage = 1` 之后追加：

```ts
  heroBatchDiscardQuality = 'all'
  showBatchDiscardConfirm = false
```

- [ ] **Step 4: 透传 view model**

在 `heroesPageViewModel` 返回对象中 `inventoryPage: heroInventoryPage,` 之后追加：

```ts
    batchDiscardQuality: heroBatchDiscardQuality,
    batchDiscardConfirm: showBatchDiscardConfirm,
```

- [ ] **Step 5: 扩展 change 事件处理**

在 `app.addEventListener('change', ...)` 内、`if (inventoryFilter?.dataset.heroInventoryFilter === 'quality') {...}` 块之后追加，并把底部守卫改为同时识别新下拉：

```ts
  const batchDiscardSelect = target.closest<HTMLSelectElement>('[data-batch-discard-quality]')
  if (batchDiscardSelect) {
    const value = batchDiscardSelect.value as EquipmentQuality | 'all'
    heroBatchDiscardQuality = value === 'all' || EQUIPMENT_QUALITIES.includes(value as EquipmentQuality) ? value : 'all'
    showBatchDiscardConfirm = false
    heroInventoryPage = 1
  }
  if (!select && !inventoryFilter && !batchDiscardSelect) return
```

- [ ] **Step 6: 扩展 performAction**

在 `performAction` 的 `hero-inventory-page` 分支之后追加三个分支：

```ts
  else if (action === 'request-batch-discard') {
    if (heroBatchDiscardQuality !== 'all') showBatchDiscardConfirm = true
  } else if (action === 'cancel-batch-discard') {
    showBatchDiscardConfirm = false
  } else if (action === 'confirm-batch-discard') {
    if (heroBatchDiscardQuality !== 'all') {
      commitAction(discardEquipmentByQuality(session.state, heroBatchDiscardQuality))
      showBatchDiscardConfirm = false
      heroInventoryPage = 1
    }
  }
```

- [ ] **Step 7: 补样式**

修改 `style.css` 第 386 行 `.hero-inventory-tools` 为四列栅格，并在其后追加确认条样式：

```css
.hero-inventory-tools { display: grid; grid-template-columns: 1fr 1fr 1fr auto auto; gap: 5px; margin: 10px 0; }
.hero-inventory-tools label { display: grid; gap: 3px; color: #777c70; font-size: 8px; }
.hero-inventory-tools select, .hero-inventory-tools button { min-width: 0; padding: 6px; font-size: 9px; }
.batch-discard-confirm {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin: 0 0 10px; padding: 8px 10px;
  border: 1px solid #6d3a33; border-radius: var(--radius);
  background: rgb(79 30 25 / 24%);
}
.batch-discard-confirm strong { color: #f0c1b6; font-size: 11px; }
.batch-discard-confirm span { color: #aa8c84; font-size: 9px; }
.batch-discard-confirm button { padding: 6px 8px; font-size: 9px; }
.batch-discard-confirm button.danger { border-color: #9d493b; color: #ffe1da; background: #73352c; }
.batch-discard-confirm button.danger:hover:not(:disabled) { border-color: var(--danger); background: #8c4134; }
```

（移动端 430px 断点既有 `.hero-inventory-tools { grid-template-columns: 1fr 1fr; }` 与 `.hero-inventory-tools > button { grid-column: 1 / -1; }` 继续生效，批量丢弃按钮自动占满整行，无需改动。）

- [ ] **Step 8: 验证类型与全量单测**

Run: `npm run build`（tsc 类型检查 + vite 构建）
Expected: 构建成功无类型错误。

Run: `npm test`
Expected: 全部单测通过。

- [ ] **Step 9: 提交**

```bash
git add egg-jianghu/src/main.ts egg-jianghu/src/style.css
git commit -m "✨ feat(ui): 主控制器接线批量丢弃确认与执行"
```

---

### Task 4: e2e 流程测试

**Files:**
- Create: `egg-jianghu/tests/e2e/batch-discard.spec.ts`

**Interfaces:**
- Consumes: Task 1–3 的完整交互链路；测试调试 API `window.__EGG_JIANGHU__.fillInventory(count)`（生产 `debugFillInventory`，生成的装备品质固定为 `凡品`、未锁定、未穿戴）。

- [ ] **Step 1: 写 e2e 流程用例**

创建 `batch-discard.spec.ts`：

```ts
import { expect, test } from '@playwright/test'

let pageErrors: string[]

test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('测试少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await expect(page.getByTestId('world-overview')).toBeVisible()
})

test.afterEach(() => {
  expect(pageErrors).toEqual([])
})

test('侠客页按稀有度批量丢弃并释放背包空间', async ({ page }) => {
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(5))
  await page.getByTestId('tab-heroes').click()

  const panel = page.getByTestId('hero-inventory-panel')
  await expect(panel.locator('[data-equipment-uid]')).toHaveCount(5)

  await panel.locator('[data-batch-discard-quality]').selectOption('凡品')
  await panel.getByRole('button', { name: '批量丢弃' }).click()
  await expect(panel).toContainText('确认丢弃 5 件装备')

  await panel.getByRole('button', { name: '确认丢弃' }).click()
  await expect(page.getByRole('status')).toHaveText('已丢弃 5 件凡品及以下装备')
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().inventory)).toHaveLength(0)
})

test('批量丢弃确认条可取消且不改变库存', async ({ page }) => {
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(3))
  await page.getByTestId('tab-heroes').click()

  const panel = page.getByTestId('hero-inventory-panel')
  await panel.locator('[data-batch-discard-quality]').selectOption('凡品')
  await panel.getByRole('button', { name: '批量丢弃' }).click()
  await panel.getByRole('button', { name: '取消' }).click()

  await expect(panel.locator('[data-batch-discard-quality]')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().inventory)).toHaveLength(3)
})
```

- [ ] **Step 2: 运行 e2e 测试**

Run: `npm run test:e2e -- batch-discard`（在 `egg-jianghu` 目录）
Expected: 2 个用例通过，且 `afterEach` 断言无 pageerror。

- [ ] **Step 3: 完整验证**

Run（在 `egg-jianghu` 目录）：

```bash
npm test
npm run build
npm run test:e2e
git diff --check
```

Expected: 全部通过；`git diff --check` 无空白错误。

- [ ] **Step 4: 提交**

```bash
git add egg-jianghu/tests/e2e/batch-discard.spec.ts
git commit -m "✅ test(e2e): 侠客页按稀有度批量丢弃流程"
```

---

## 验证收尾

完成后向用户汇报：领域单测、渲染单测、e2e、build 结果；并说明新增的交互路径（阈值下拉 → 批量丢弃 → 确认/取消）。如 e2e 需要本地 Playwright 环境，说明降级为手动验证的方式。
