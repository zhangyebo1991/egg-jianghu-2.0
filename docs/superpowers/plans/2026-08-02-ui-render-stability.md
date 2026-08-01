# UI 增量渲染稳定性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留 `100ms` 战斗刷新，同时停止重复重建按钮 DOM，彻底修复 hover 边框闪烁和慢速点击丢失。

**Architecture:** 新建无依赖的 `createDomPatcher()`，继续使用现有纯 HTML renderer，但将每帧完整字符串与当前 DOM 做带稳定 key 的递归同步。HTML 未变化时跳过更新；HTML 变化时复用相同语义节点，只局部插入、移动、删除或替换不兼容节点。

**Tech Stack:** TypeScript 6、Vite 8、原生 DOM、Playwright 1.54、Vitest 4

---

## 文件结构

- Create: `egg-jianghu/src/ui/dom-patch.ts`：缓存渲染 HTML，并按 key 递归同步真实 DOM。
- Modify: `egg-jianghu/src/main.ts`：将 `app.innerHTML` 替换为 `createDomPatcher(app)`。
- Modify: `egg-jianghu/tests/e2e/mvp.spec.ts`：覆盖静态页面和战斗中的节点身份与慢速点击。

### Task 1: 用 E2E 锁定节点重建回归

**Files:**
- Modify: `egg-jianghu/tests/e2e/mvp.spec.ts`

- [ ] **Step 1: 写静态页签节点与慢速点击失败测试**

在 `tests/e2e/mvp.spec.ts` 增加：

```ts
test('连续 tick 保持页签按钮节点并支持慢速点击', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.__EGG_JIANGHU__.reset())

  const stableAcrossTicks = await page.getByTestId('tab-heroes').evaluate(async (button) => {
    await new Promise((resolve) => setTimeout(resolve, 350))
    return button === document.querySelector('[data-testid="tab-heroes"]')
  })
  expect(stableAcrossTicks).toBe(true)

  const button = page.getByTestId('tab-heroes')
  const box = await button.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(250)
  await page.mouse.up()
  await expect(page.locator('[data-page="heroes"]')).toBeVisible()
})
```

- [ ] **Step 2: 写战斗动态刷新失败测试**

```ts
test('战斗刷新保持页签和战斗控制按钮节点', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.__EGG_JIANGHU__.reset())
  await page.getByTestId('start-guard').click()

  const stableAcrossCombatTicks = await page.evaluate(async () => {
    const tab = document.querySelector('[data-testid="tab-idle"]')
    const stop = document.querySelector('[data-testid="stop-combat"]')
    await new Promise((resolve) => setTimeout(resolve, 350))
    return {
      tab: tab === document.querySelector('[data-testid="tab-idle"]'),
      stop: stop === document.querySelector('[data-testid="stop-combat"]'),
    }
  })

  expect(stableAcrossCombatTicks).toEqual({ tab: true, stop: true })
})
```

- [ ] **Step 3: 运行测试确认命中当前缺陷**

Run:

```powershell
npx playwright test tests/e2e/mvp.spec.ts --grep "连续 tick|战斗刷新"
```

Expected: 两个测试 FAIL，节点身份断言收到 `false`；页面能正常启动且没有 selector 或脚本错误。保持红灯，不提交。

### Task 2: 实现无依赖 DOM 增量同步

**Files:**
- Create: `egg-jianghu/src/ui/dom-patch.ts`
- Modify: `egg-jianghu/src/main.ts`
- Test: `egg-jianghu/tests/e2e/mvp.spec.ts`

- [ ] **Step 1: 创建 key 与兼容性规则**

在 `src/ui/dom-patch.ts` 定义：

```ts
type PatchParent = HTMLElement | DocumentFragment

const elementKey = (node: Node | undefined): string | null => {
  if (!(node instanceof Element)) return null
  for (const attribute of ['id', 'data-testid', 'data-tab']) {
    const value = node.getAttribute(attribute)
    if (value) return `${node.tagName}:${attribute}:${value}`
  }
  if (!node.hasAttribute('data-action')) return null
  const data = [...node.attributes]
    .filter(({ name }) => name.startsWith('data-'))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({ name, value }) => `${name}=${value}`)
    .join('|')
  return `${node.tagName}:${data}`
}

const compatible = (current: Node, next: Node): boolean => {
  if (current.nodeType !== next.nodeType) return false
  if (!(current instanceof Element) || !(next instanceof Element)) return true
  if (current.tagName !== next.tagName) return false
  const currentKey = elementKey(current)
  const nextKey = elementKey(next)
  return currentKey === nextKey || currentKey === null && nextKey === null
}
```

- [ ] **Step 2: 实现 attributes、表单 property 与单节点同步**

```ts
const syncAttributes = (current: Element, next: Element): void => {
  for (const { name } of [...current.attributes]) {
    if (!next.hasAttribute(name)) current.removeAttribute(name)
  }
  for (const { name, value } of [...next.attributes]) {
    if (current.getAttribute(name) !== value) current.setAttribute(name, value)
  }
}

const syncControlState = (current: Element, next: Element): void => {
  if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
    if (document.activeElement !== current) current.value = next.value
    current.checked = next.checked
  } else if (current instanceof HTMLSelectElement && next instanceof HTMLSelectElement) {
    if (document.activeElement !== current) current.value = next.value
  } else if (current instanceof HTMLOptionElement && next instanceof HTMLOptionElement) {
    current.selected = next.selected
  }
}

const patchNode = (current: Node, next: Node): Node => {
  if (!compatible(current, next)) {
    const replacement = next.cloneNode(true)
    current.replaceWith(replacement)
    return replacement
  }
  if (!(current instanceof Element) || !(next instanceof Element)) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue
    return current
  }
  syncAttributes(current, next)
  syncChildren(current as HTMLElement, next)
  syncControlState(current, next)
  return current
}
```

`syncChildren` 在下一步定义；函数声明使用 `function`，避免初始化顺序问题。

- [ ] **Step 3: 实现 keyed 子节点增删、移动和复用**

```ts
function syncChildren(currentParent: PatchParent, nextParent: Element | DocumentFragment): void {
  const existing = [...currentParent.childNodes]
  const used = new Set<Node>()
  const keyed = new Map(existing.flatMap((node) => {
    const key = elementKey(node)
    return key ? [[key, node] as const] : []
  }))

  ;[...nextParent.childNodes].forEach((nextChild, index) => {
    const key = elementKey(nextChild)
    const atIndex = currentParent.childNodes[index]
    let candidate = key ? keyed.get(key) : undefined
    if (!candidate && atIndex && !used.has(atIndex) && compatible(atIndex, nextChild)) candidate = atIndex
    if (!candidate && !key) candidate = existing.find((node) =>
      !used.has(node) && elementKey(node) === null && compatible(node, nextChild))

    if (!candidate) candidate = nextChild.cloneNode(true)
    const reference = currentParent.childNodes[index] ?? null
    if (candidate !== reference) currentParent.insertBefore(candidate, reference)
    used.add(candidate)
    patchNode(candidate, nextChild)
  })

  for (const node of existing) {
    if (!used.has(node) && node.parentNode === currentParent) currentParent.removeChild(node)
  }
}
```

- [ ] **Step 4: 暴露带相同 HTML 快路的 patcher**

```ts
export const createDomPatcher = (root: HTMLElement): ((html: string) => void) => {
  let previousHtml: string | null = null
  return (html) => {
    if (html === previousHtml) return
    const template = document.createElement('template')
    template.innerHTML = html.trim()
    syncChildren(root, template.content)
    previousHtml = html
  }
}
```

- [ ] **Step 5: 将 main.ts 接入增量渲染**

添加 import 和实例：

```ts
import { createDomPatcher } from './ui/dom-patch'

const patchApp = createDomPatcher(app)
```

将 `render()` 中的赋值改为：

```ts
patchApp(renderShell({
  activeTab,
  worldName: world.name,
  worldCurrency: session.state.worldCurrency[selectedWorldId] ?? 0,
  contribution,
  inventoryCount: session.state.inventory.length,
  inventoryCapacity: INVENTORY_CAPACITY,
  content,
}))
```

- [ ] **Step 6: 运行 targeted E2E 确认转绿**

Run:

```powershell
npx playwright test tests/e2e/mvp.spec.ts --grep "连续 tick|战斗刷新"
```

Expected: 2 passed；慢速点击切换到 `data-page="heroes"`。

- [ ] **Step 7: 运行完整自动化验证**

Run:

```powershell
npm test
npm run build
npm run test:e2e
git diff --check
```

Expected: 69 个 unit tests 与 12 个 E2E tests 全部 PASS，build 与 whitespace PASS。

- [ ] **Step 8: 同步 CodeGraph 并复核影响面**

Run:

```powershell
codegraph sync ..
codegraph status ..
```

Expected: `[OK] Index is up to date`；用 `rg -n "app\.innerHTML|createDomPatcher" src` 确认主入口不再全量赋值。

- [ ] **Step 9: 提交修复**

```powershell
git add src/ui/dom-patch.ts src/main.ts tests/e2e/mvp.spec.ts
git commit -m "🐛 fix(ui): 保持实时刷新中的按钮交互状态"
```

### Task 3: 浏览器交互与视觉验收

**Files:**
- Verify only: `egg-jianghu/src/main.ts`
- Verify only: `egg-jianghu/src/ui/dom-patch.ts`

- [ ] **Step 1: 启动本地页面并检查基础健康状态**

Run:

```powershell
npm run dev -- --host 127.0.0.1 --port 4187
```

使用 in-app Browser 打开 `http://127.0.0.1:4187/`，确认 title 为 `蛋蛋江湖 2.0 · 一盏江湖`、DOM 非空、无 Vite overlay，console 没有相关 error/warn。

- [ ] **Step 2: 验证 hover 与慢速点击**

- 鼠标停在【江湖】【侠客】【驻守】【停止战斗】上至少 1 秒，边框不得闪烁。
- 捕获按钮节点，等待 1 秒后确认节点 identity 不变。
- 鼠标按下【侠客】后等待 `250ms` 再松开，页面必须切换到侠客页。

- [ ] **Step 3: 验证战斗与移动端**

- 开始驻守并在战斗持续刷新时重复页签和战斗控制按钮检查。
- 桌面截图确认 hover 状态；切换 `390×844` 后确认五个页签可用且慢速点击成功。
- 恢复 viewport，console 再次保持无相关 error/warn。

- [ ] **Step 4: 最终仓库卫生检查**

Run:

```powershell
git status --porcelain=v1 -b
git show --stat --oneline HEAD
```

Expected: 只显示当前 branch 行；提交只包含计划内 3 个实现/测试文件。
