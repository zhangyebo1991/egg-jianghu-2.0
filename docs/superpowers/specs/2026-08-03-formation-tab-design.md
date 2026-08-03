# 蛋蛋江湖 2.0 阵容独立 Tab 与拖拽编辑设计

## 背景

当前【侠客】Tab 把「侠客名单 + 六侠阵容 + 侠客详情」挤在同一屏：左列名单、右列 workbench 内先放阵容编辑器、再放详情面板。阵容编辑器与名单之间靠「选中侠客 → 置入所选侠客」的点击流交互，且没有移动/交换位置的直接手段，阵容编辑体验偏弱。

本次改造将阵容拆分到侧边栏独立 Tab，并将阵容编辑改为拖拽为主、触屏点击流降级的交互。

## 目标

- 侧边栏全局入口由【江湖】【侠客】【背包】扩为【江湖】【侠客】【阵容】【背包】。
- 侠客页只保留「名单 + 详情」，移除阵容编辑器区块。
- 阵容页自带侠客名单，桌面以拖拽完成上阵、移动、交换、下阵；触屏以点击流 + 格子角落 × 完成同等操作。
- 领域层阵容操作支持「真交换」语义（两个已上阵侠客互换位置）。
- 不改变存档 schema、角色养成、战斗数值与掉落规则。

## 信息架构

### 全局导航

侧边栏顶级入口扩展为四个，顺序与 mark 如下：

1. 江湖（卷）
2. 侠客（侠）
3. 阵容（阵）
4. 背包（匣）

阵容与侠客、背包同级，不接入江湖大关的二级导航（关卡/势力/城市），不涉及 `worldContext`。

### 侠客页（瘦身）

`heroes-page.ts` 删除 `renderFormation` 辅助函数与页面内的 `formation-editor` 区块；`HeroesPageViewModel` 移除 `formation` 字段。左列名单、右列详情占满原 workbench 整列，回归纯粹「名单 + 培养详情」。

### 阵容页（新增）

新增 `egg-jianghu/src/ui/formation-page.ts`，导出 `renderFormationPage(view)` 与 `FormationPageViewModel`。页面复用 `.heroes-layout` 双栏栅格：

- 左列 `formation-roster`：全部已招募侠客（品级、名、Lv），已上阵者带「已上阵」角标；桌面为拖拽源，触屏为点选源；同时是「下阵」drop 区。
- 右列 `formation-editor`：六格阵容，后排（back）一行在上、前排（front）一行在下；空格为虚线 drop 目标，已占格显示侠客名与品级。

## 交互设计

### 桌面（原生拖拽）

| 操作 | 行为 |
|---|---|
| 名单未上阵侠客 → 空格 | 上阵 |
| 名单未上阵侠客 → 已占格 | 顶替（原侠客下阵） |
| 已上阵侠客 → 空格 | 移动 |
| 已占格 → 另一已占格 | 交换位置 |
| 已占格 → 名单区 | 下阵 |
| 点击空格/已占格 | 无任何效果 |

拖拽源元素 `draggable="true"` 并携带 `data-hero-id`；已占格在拖拽经过时显示 `.drag-over` 高亮。

### 触屏（点击流降级）

- 点选名单侠客 → 高亮，设为 `formationSelectedHeroId`。
- 点空格 → 置入选中侠客；点已占格 → 交换/顶替。
- 已占格右下角显示小 × 按钮（`@media (hover: none)` 下可见），点击即下阵。
- 不显示任何「下阵」按钮在桌面拖拽流程中。

## 领域逻辑

### 抽出 `src/domain/formation.ts`

把 `placeFormation` / `removeFormation` 从 `main.ts` 闭包抽出到 `src/domain/formation.ts`（遵循现有 `src/domain/*.ts` 模块模式），使交换语义可单元测试。签名以 `GameStateV10` 为第一参数，返回 `ActionResult`。

### `placeFormation` 升级为交换语义

原实现先移除侠客旧槽与目标占位再入阵（等价「替换」）。改为：

```
placeFormation(state, heroId, row, position):
  1. 侠客未招募 → 报错
  2. 已在目标位 → 无操作（「侠客已在该位」）
  3. 找出 current（侠客原位）与 target（目标位占位）
  4. 从阵中移除 current 与 target 两个槽
  5. 若 current 与 target 均存在 → 真交换：target 占位搬入侠客原位
  6. 侠客入目标位
```

### `removeFormation` 保持语义

供「拖名单下阵」与触屏 × 复用，签名与语义不变（从阵中移除指定侠客）。

### main.ts 接线

`performAction` 的 `formation-place` / `formation-remove` 分支改调 domain 函数；拖拽 drop 与触屏点格 handler 同样走这两个 domain 函数。

### 边界情况

- 已上阵侠客拖到空格 → 移动。
- 未上阵侠客拖到已占格 → 顶替目标格。
- 侠客拖回自己原位 → 无操作。
- 未招募侠客不可入阵（领域层校验兜底，UI 名单只渲染已招募）。

## 状态与事件

界面层新增两个 UI 态（均不落盘）：

- `formationSelectedHeroId: string | null` —— 触屏点选状态。
- `dragHeroId: string | null` —— 拖拽会话临时态。

事件在 `#app` 上委托，与现有 `data-action` 架构一致：

| 事件 | 处理 |
|---|---|
| `[data-tab]` 点击 | 现有 handler 通用，`activeTab = 'formation'` 直接生效 |
| `dragstart` | 从最近 `[data-hero-id]` 取 heroId → `dragHeroId`；`effectAllowed='move'` |
| `dragover` | 目标是格子或名单区 → `preventDefault()` + 加 `.drag-over` |
| `drop` | 落格子 → `placeFormation`；落名单区 → `removeFormation` |
| `dragend` | 清 `dragHeroId`、移除高亮 |
| 触屏点选 | `data-action="formation-select"` → 设 `formationSelectedHeroId` |
| 触屏点格 | `data-action="formation-tap-place"` → 有选中侠客则 `placeFormation` |
| × 按钮 | `data-action="formation-remove"` → 复用 `performAction` 现有分支 |
| 桌面点格子 | 不挂 handler → 无效果 |

`render()` 分派扩展：`activeTab === 'formation'` → `renderFormationPage(formationViewModel())`。`formationViewModel()` 由 `session.state.formation` 与 `recruitedHeroes()` 组装，名单项带 `inFormation` 标记。

## 异常与边界

- 拖拽起点元素必须携带 `data-hero-id`，否则忽略该拖拽。
- 拖拽到非目标区（如页面空白、其他面板）不响应，不产生状态变更。
- 触屏点击流在 `hover: none` 设备启用；桌面端不启用，保证「点击格子无效果」。
- × 按钮事件在任何输入类型下均可触发 `removeFormation`（触屏可见，桌面若被触发也无害）。

## 测试设计

先补失败测试，再修改实现。

### Unit / renderer tests

- Shell 输出四个顶级 Tab，含「阵容」。
- 侠客页不再输出 `.formation-editor` 区块；`HeroesPageViewModel` 不再含 `formation` 字段。
- 阵容页输出六格（back 行 3 + front 行 3）与已招募名单，已上阵者带「已上阵」标记。
- `placeFormation`（`src/domain/formation.ts`）覆盖 移动 / 交换 / 顶替 / 原位无操作 / 未招募报错。
- 更新既有 `pages.test.ts` 的 view model 构造（去掉 `formation` 字段）。

### Playwright E2E

- 桌面：`dragAndDrop` 名单侠客到空格上阵；已占格拖到另一已占格交换位置；已占格拖到名单区下阵。
- 触屏视口：点选名单侠客 → 点空格置入；点已占格角落 × 下阵。
- 桌面点击已占格不产生任何阵容变化。
- 更新既有 `mvp.spec.ts` 的阵容用例，改为新交互（拖拽或触屏点击流）。

### 完整验证

- `npm test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`
- `codegraph sync ..`

## 非目标

- 不修改存档 schema 与既有存档兼容逻辑。
- 不修改角色养成、装备、武功、心法、战斗数值与掉落规则。
- 不改变江湖层级导航与 `worldContext` 逻辑。
- 不新增招募、信物、货币或侠客数据。
- 不为拖拽引入第三方库或构建依赖。
