# 蛋蛋江湖 2.0 侠客页物品按稀有度批量丢弃设计

## 背景

【侠客】Tab 右侧的物品面板（`heroes-page.ts` 的 `renderInventoryPanel`）已具备部位/品质筛选、每页 200 件分页与「整理」功能，但缺少批量清理低级装备的手段。随着卷数推进，背包中凡品/良品等低品质装备会大量堆积，玩家只能逐件操作，无批量释放空间的方式。

本次为物品面板新增「按稀有度批量丢弃」：选择稀有度阈值后，一次丢弃背包中所有「品质低于等于阈值」且未被侠客穿戴、未被锁定的装备。

## 目标

- 物品面板新增稀有度阈值下拉 + 「批量丢弃」入口。
- 点击后面板内就地展开确认条，显示将丢弃的件数；确认后执行。
- 只影响背包内未被穿戴、未被锁定的装备；已装备与已锁定一律跳过。
- 丢弃为纯清理操作，不返还货币/材料，不改变掉落与养成规则。
- 不改变存档 schema，不引入第三方依赖。

## 交互设计

### 入口（物品面板工具栏）

在 `.hero-inventory-tools` 行「整理」按钮旁新增：

- 稀有度下拉：`data-batch-discard-quality`，选项为「选择品质」+ `EQUIPMENT_QUALITIES` 五项（凡品/良品/上品/珍品/绝品），默认「选择品质」。
- 「批量丢弃」按钮：`data-action="request-batch-discard"`；阈值为「选择品质」时禁用。

### 两段式确认（就地展开）

复用重置存档（`request-reset-save` → `confirm/cancel`）的交互模式：

- 点击「批量丢弃」→ 按钮位置替换为确认条（`role="alertdialog"`）：
  - 文案：`确认丢弃 N 件装备？` + `品质 ≤上品 · 不含已装备与已锁定`。
  - N 由 `view.inventoryItems`（全量、含 `locked`/`equippedByHeroId`）本地计算，与领域判定保持一致。
  - `[确认丢弃]`（danger 样式，N=0 时禁用）+ `[取消]`。
- 确认 → 执行领域丢弃，toast 提示丢弃件数，重置确认态并回到第 1 页。
- 取消 / 切换阈值 → 复位确认态。

## 领域逻辑

### `src/domain/inventory.ts` 新增

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

- 判定谓词（`品质索引 ≤ 阈值` + `非锁定` + `未被穿戴`）与 UI 预览完全一致。
- 空集返回 `ok:false` 走错误 toast，属防御分支（确认按钮在件数为 0 时已禁用）。

## 状态与事件

界面层新增两个 UI 态（均不落盘），在 `main.ts` 声明并在 `resetSessionState()` 重置：

- `heroBatchDiscardQuality: EquipmentQuality | 'all' = 'all'`
- `showBatchDiscardConfirm = false`

`HeroesPageViewModel` 增加 `batchDiscardQuality`、`batchDiscardConfirm` 两字段，`heroesPageViewModel()` 透传。

事件沿用 `#app` 委托与 `data-action` 架构：

| 事件 | 处理 |
|---|---|
| `change` `[data-batch-discard-quality]` | 校验后写 `heroBatchDiscardQuality`，复位确认态（扩展现有 `change` handler 的守卫条件） |
| `click` `request-batch-discard` | 阈值合法时置 `showBatchDiscardConfirm = true` |
| `click` `cancel-batch-discard` | 置 `false` |
| `click` `confirm-batch-discard` | `commitAction(discardEquipmentByQuality(session.state, heroBatchDiscardQuality))`，复位确认态与 `heroInventoryPage = 1` |

`performAction` 外的统一 `render()` 负责刷新；`commitAction` 成功后自动 `saveSession()` 落盘。

## 异常与边界

- 阈值为「选择品质」：批量丢弃按钮禁用，不触发确认。
- 确认条件数为 0：确认按钮禁用，文案仍展示件数 0。
- 已装备 / 已锁定：领域层强制跳过（防御性），即使 UI 态异常也不会误删。
- 丢弃后物品数量变化：确认态复位并回到第 1 页，避免越界分页。

## 测试设计

先补失败测试，再修改实现。

### Unit / renderer tests

- `src/domain/inventory.test.ts`：
  - 低于等于阈值被丢弃、高于阈值保留；边界 `绝品` 全清。
  - 已锁定物品跳过。
  - 已被侠客穿戴的物品跳过。
  - 无可丢弃时返回 `ok:false` 提示，且 `inventory` 内容不变。
- `src/ui/pages.test.ts`：
  - 物品栏工具栏输出 `data-batch-discard-quality` 下拉与「批量丢弃」按钮。
  - 确认态下输出 `确认丢弃 N 件` 文案且件数与夹具一致。

### Playwright E2E（可选）

`tests/e2e` 补一条：进入侠客页 → 选品质阈值 → 批量丢弃 → 确认 → 背包件数减少。

### 完整验证

- `npm test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`
- `codegraph sync ..`

## 非目标

- 不返还货币/材料，不引入掉落结算。
- 不修改存档 schema 与既有存档兼容逻辑。
- 不修改装备、武功、心法、战斗数值与掉落规则。
- 不为批量丢弃引入第三方库或构建依赖。
- 不新增单件丢弃/出售入口（本次仅批量丢弃）。
