# 三十卷江湖命名与未开放世界 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 10 个江湖改为金庸小说地名，并把世界池扩到 30 卷（前 10 开放、后 20 显示「无法进入」），为后续扩展预留完整弱→强难度阶梯。

**Architecture:** `WORLDS` 扩为 30 个世界，`WorldDefinition` 新增 `released` 布尔字段区分开放/未开放；未开放世界 `factionIds`/`stageIds` 为空。江湖总览按「已解锁 / 未解锁 / 未开放」三态渲染卡片；解锁与进入逻辑在 `game-session.ts` 增加 `released` 护栏；校验器只对已开放世界做强校验。

**Tech Stack:** TypeScript + Vite + Vitest + Playwright。所有命令在 `egg-jianghu/` 目录下执行。

## Global Constraints

- **不执行 git commit**：按用户全局约定，除非用户明确要求，本计划不包含提交步骤；每个任务以测试/构建通过收尾。
- 世界 id 不变（`world_01`…`world_30`），存档 schema、`unlockedWorldIds` 语义不变。
- `RELEASED_WORLD_COUNT = 10`：前 10 卷当前版本开放，后 20 卷 `released: false`。
- 不改难度/推荐战力公式、势力名（听雨剑庐等）、Boss/小怪/精英名称、顶部「十卷风云」文案。
- 测试命令：`npm test`（vitest run src）、`npm run build`（tsc && vite build）、`npm run test:e2e`（playwright test）。

---

### Task 1: 30 卷命名与 released 数据模型

**Files:**
- Modify: `src/content/worlds.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/validate.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `WORLDS`（30 项，含 `released`）、`RELEASED_WORLD_COUNT = 10`、`WorldDefinition.released: boolean`。后续任务依赖本任务的 `WORLDS` 与 `released`。

- [ ] **Step 1: 写失败测试**

在 `src/content/validate.test.ts` 中：

1a. 第 11 行规模断言改为 30：

```ts
    expect(WORLDS).toHaveLength(30)
    expect(FACTIONS).toHaveLength(30)
    expect(FACTION_MARTIALS).toHaveLength(240)
    expect(CAREERS).toHaveLength(42)
```

1b. 重写「10 卷各 3 势力」测试（约第 29-36 行）为：

```ts
  it('已开放 10 卷各 3 势力且未开放卷无势力', () => {
    const released = WORLDS.filter((world) => world.released)
    const unreleased = WORLDS.filter((world) => !world.released)
    expect(WORLDS).toHaveLength(30)
    expect(released).toHaveLength(10)
    expect(unreleased).toHaveLength(20)
    expect(released.every((world) => world.factionIds.length === 3)).toBe(true)
    expect(unreleased.every((world) => world.factionIds.length === 0)).toBe(true)
    for (const category of ['剑', '刀', '拳', '暗', '医', '内家']) {
      expect(FACTIONS.filter((faction) => faction.category === category)).toHaveLength(5)
    }
    expect(validateContent()).toEqual([])
  })
```

1c. 新增名称与边界断言测试：

```ts
  it('30 卷名称使用金庸地名且前 10 卷开放', () => {
    expect(WORLDS[0]).toMatchObject({ id: 'world_01', name: '牛家村', released: true })
    expect(WORLDS[9]).toMatchObject({ id: 'world_10', name: '擂鼓山', released: true })
    expect(WORLDS[10]).toMatchObject({ id: 'world_11', name: '恒山', released: false })
    expect(WORLDS[29]).toMatchObject({ id: 'world_30', name: '侠客岛', released: false })
    expect(WORLDS[0].stageIds).toHaveLength(10)
    expect(WORLDS[9].factionIds).toHaveLength(3)
    expect(WORLDS[10].stageIds).toEqual([])
    expect(WORLDS[10].factionIds).toEqual([])
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- content/validate.test.ts`
Expected: FAIL — `WORLDS` 长度为 10，断言 30 失败；`WORLDS[0].name` 为 `青石江湖` 而非 `牛家村`。

- [ ] **Step 3: 实现 `worlds.ts`**

`src/content/worlds.ts` 全文替换为：

```ts
import { FACTIONS } from './factions'

export const RELEASED_WORLD_COUNT = 10

export interface WorldDefinition {
  id: string
  name: string
  index: number
  released: boolean
  currencyId: string
  factionIds: string[]
  stageIds: string[]
}

export const WORLD_NAMES = [
  '牛家村', '嘉兴', '归云庄', '大理', '无量山',
  '风陵渡', '蝴蝶谷', '姑苏', '聚贤庄', '擂鼓山',
  '恒山', '桃花岛', '终南山', '铁掌峰', '雁门关',
  '白驼山', '梅庄', '绝情谷', '星宿海', '冰火岛',
  '神龙岛', '剑冢', '灵鹫宫', '光明顶', '万安寺',
  '襄阳', '少室山', '黑木崖', '华山', '侠客岛',
] as const

export const WORLDS: WorldDefinition[] = WORLD_NAMES.map((name, offset) => {
  const index = offset + 1
  const id = `world_${String(index).padStart(2, '0')}`
  const released = index <= RELEASED_WORLD_COUNT
  return {
    id,
    name,
    index,
    released,
    currencyId: id,
    factionIds: released
      ? FACTIONS.filter((faction) => faction.worldId === id).map((faction) => faction.id)
      : [],
    stageIds: released
      ? Array.from({ length: 10 }, (_, stageOffset) => `${id}_stage_${String(stageOffset + 1).padStart(2, '0')}`)
      : [],
  }
})

export const worldById = (id: string): WorldDefinition | undefined =>
  WORLDS.find((world) => world.id === id)
```

- [ ] **Step 4: 实现 `validate.ts`**

`src/content/validate.ts` 第 38-45 行的世界循环替换为：

```ts
  for (const world of WORLDS) {
    if (world.released) {
      if (world.stageIds.length !== 10) errors.push(`${world.id} 小关数不是 10`)
      if (world.factionIds.length !== 3) errors.push(`${world.id} 势力数不是 3`)
      if (RARITY_BUDGET_BY_WORLD[world.id]?.length !== 8) errors.push(`${world.id} 稀有度预算不是 8`)
    } else {
      if (world.stageIds.length !== 0) errors.push(`${world.id} 未开放卷不应有小关`)
      if (world.factionIds.length !== 0) errors.push(`${world.id} 未开放卷不应有势力`)
    }
    for (const id of world.factionIds) {
      if (!factionIds.has(id)) errors.push(`${world.id} 引用了未知势力 ${id}`)
    }
  }
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test -- content/validate.test.ts`
Expected: PASS（3 个用例）。再跑 `npm test` 确认无回归。

---

### Task 2: 未开放世界的解锁与进入护栏

**Files:**
- Modify: `src/app/game-session.ts`
- Modify: `src/app/game-session.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `WORLDS`（含 30 项）与 `released`。
- Produces: `startStage` 对未开放世界返回 `{ ok: false, message: '该江湖尚未开放' }`；通关最后一卷不再向 `unlockedWorldIds` 追加世界 11。

- [ ] **Step 1: 写失败测试**

在 `src/app/game-session.test.ts` 的 `describe('GameSession')` 末尾（`即时切换模式...` 用例后）追加两个用例：

```ts
  it('通关世界十不会解锁未开放的世界十一', () => {
    const session = sessionWithParty()
    session.state.unlockedWorldIds.push('world_10')
    session.state.clearedStageByWorld.world_10 = 9
    expect(session.startStage({ worldId: 'world_10', stage: 10, mode: 'roam', seed: 22 }).ok).toBe(true)
    makePartyOverwhelming(session)
    session.advanceTicks(5000)
    expect(session.selection).toEqual({ worldId: 'world_10', stage: 10, mode: 'guard' })
    expect(session.state.unlockedWorldIds).not.toContain('world_11')
  })

  it('未开放世界即使被写入解锁也不可进入', () => {
    const session = sessionWithParty()
    session.state.unlockedWorldIds.push('world_11')
    expect(session.startStage({ worldId: 'world_11', stage: 1, mode: 'guard', seed: 1 }).ok).toBe(false)
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- app/game-session.test.ts`
Expected: FAIL —— 用例 1 中 `unlockedWorldIds` 含 `world_11`；用例 2 中 `startStage` 返回 `ok: true`。

- [ ] **Step 3: 实现 `game-session.ts` 护栏**

3a. `startStage`（约第 117 行）在解锁校验之前加 released 校验：

```ts
  startStage(input: StageSelectionInput): ActionResult {
    const world = WORLDS.find((item) => item.id === input.worldId)
    if (!world?.released) return { ok: false, message: '该江湖尚未开放' }
    if (!this.state.unlockedWorldIds.includes(input.worldId)) return { ok: false, message: '江湖卷尚未解锁' }
```

3b. `handleResult`（约第 198 行）解锁下一卷时加 released 判断：

```ts
        const nextWorld = WORLDS[currentIndex + 1]
        if (nextWorld?.released && !this.state.unlockedWorldIds.includes(nextWorld.id)) {
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- app/game-session.test.ts`
Expected: PASS。再跑 `npm test` 确认无回归。

---

### Task 3: 江湖总览三态渲染

**Files:**
- Modify: `src/ui/jianghu-page.ts`
- Modify: `src/ui/jianghu-page.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `released` 概念。
- Produces: `JianghuWorldCardView.released: boolean`；`renderWorldOverview` 对未开放卡片输出 `未开放 · 无法进入` 且不带难度/进度/势力，对未解锁卡片输出 `尚未解锁 · 通关上一卷开放`。Task 4 的 view model 按此字段喂数据。

- [ ] **Step 1: 写失败测试**

在 `src/ui/jianghu-page.test.ts` 中，把首个用例的 fixture 名称改为 `牛家村` 并补 `released: true`：

```ts
    const html = renderWorldOverview({ worlds: [{
      id: 'world_01',
      name: '牛家村',
      index: 1,
      released: true,
      unlocked: true,
      difficulty: 1,
      recommendedPower: 4000,
      clearedStages: 3,
      factionNames: ['青锋馆', '铁衣武馆', '仁心堂'],
    }] })
```

新增两个用例：

```ts
  it('未开放世界显示无法进入且不带难度进度势力', () => {
    const html = renderWorldOverview({ worlds: [{
      id: 'world_11', name: '恒山', index: 11,
      released: false, unlocked: false,
      difficulty: 0, recommendedPower: 0, clearedStages: 0, factionNames: [],
    }] })

    expect(html).toMatch(/data-testid="world-world_11"[^>]*disabled/)
    expect(html).toContain('未开放 · 无法进入')
    expect(html).not.toContain('world-progress')
    expect(html).not.toContain('推荐战力')
    expect(html).not.toContain('本地势力')
  })

  it('已开放未解锁世界提示通关上一卷', () => {
    const html = renderWorldOverview({ worlds: [{
      id: 'world_02', name: '嘉兴', index: 2,
      released: true, unlocked: false,
      difficulty: 1, recommendedPower: 6600, clearedStages: 0, factionNames: [],
    }] })

    expect(html).toContain('尚未解锁 · 通关上一卷开放')
    expect(html).not.toContain('推荐战力')
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- ui/jianghu-page.test.ts`
Expected: FAIL —— `JianghuWorldCardView` 无 `released` 字段（TS 编译错），新用例的文案断言不满足。

- [ ] **Step 3: 实现 `jianghu-page.ts`**

3a. `JianghuWorldCardView` 接口（第 3-12 行）在 `unlocked` 后加一行：

```ts
  unlocked: boolean
  released: boolean
```

3b. `renderWorldOverview` 的卡片循环（第 35-44 行）替换为三态渲染：

```ts
      ${view.worlds.map((world) => !world.released
        ? `
          <button type="button" class="world-card locked" data-action="enter-world"
            data-world-id="${escapeHtml(world.id)}" data-testid="world-${escapeHtml(world.id)}" disabled>
            <span class="world-index">${String(world.index).padStart(2, '0')}</span>
            <strong>${escapeHtml(world.name)}</strong>
            <small>未开放 · 无法进入</small>
          </button>`
        : `
          <button type="button" class="world-card${world.unlocked ? '' : ' locked'}"
            data-action="enter-world" data-world-id="${escapeHtml(world.id)}"
            data-testid="world-${escapeHtml(world.id)}" ${world.unlocked ? '' : 'disabled'}>
            <span class="world-index">${String(world.index).padStart(2, '0')}</span>
            <strong>${escapeHtml(world.name)}</strong>
            <small>${world.unlocked
              ? `难度 ${stars(world.difficulty)} · 推荐战力 ${formatNumber(world.recommendedPower)}`
              : '尚未解锁 · 通关上一卷开放'}</small>
            ${world.unlocked
              ? `<i class="world-progress" aria-label="已通过 ${world.clearedStages} / 10 关"><b style="width:${world.clearedStages * 10}%"></b></i>
                 <em>本地势力：${world.factionNames.map((name) => escapeHtml(name)).join(' · ')}</em>`
              : ''}
          </button>`).join('')}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- ui/jianghu-page.test.ts`
Expected: PASS（3 个用例）。

---

### Task 4: 主流程接入 released

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: Task 1 的 `WORLDS`、`released`；Task 3 的 `JianghuWorldCardView.released`。
- Produces: `worldOverviewViewModel` 为每个世界填充 `released` 与仅在开放时计算的难度/战力；`enter-world` 点击对未开放世界提示并返回。

- [ ] **Step 1: 更新 `worldOverviewViewModel`**

`src/main.ts` 第 175-186 行的世界映射替换为：

```ts
const worldOverviewViewModel = (): WorldOverviewViewModel => ({
  worlds: WORLDS.map((world) => ({
    id: world.id,
    name: world.name,
    index: world.index,
    released: world.released,
    unlocked: session.state.unlockedWorldIds.includes(world.id),
    difficulty: world.released ? Math.min(5, Math.ceil(world.index / 2)) : 0,
    recommendedPower: world.released ? Math.round(4000 * 1.65 ** (world.index - 1)) : 0,
    clearedStages: world.released ? (session.state.clearedStageByWorld[world.id] ?? 0) : 0,
    factionNames: world.released ? FACTIONS.filter((faction) => faction.worldId === world.id).map((faction) => faction.name) : [],
  })),
})
```

- [ ] **Step 2: 更新 `enter-world` 点击处理**

`src/main.ts` 第 706-710 行，在现有解锁校验前加 released 校验：

```ts
  if (action === 'enter-world' && button.dataset.worldId) {
    const targetWorld = WORLDS.find((item) => item.id === button.dataset.worldId)
    if (!targetWorld?.released) {
      notify('该江湖尚未开放', true)
      return
    }
    if (!session.state.unlockedWorldIds.includes(button.dataset.worldId)) {
      notify('江湖卷尚未解锁', true)
      return
    }
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: `tsc && vite build` 通过，无类型错误。

---

### Task 5: 测试 fixture 与 e2e 同步

**Files:**
- Modify: `src/ui/idle-page.test.ts`
- Modify: `src/ui/shell.test.ts`
- Modify: `tests/e2e/mvp.spec.ts`

**Interfaces:**
- Consumes: Task 1 确定的 `world_01` 名称为 `牛家村`、`world_02` 名称为 `嘉兴`。

- [ ] **Step 1: 更新单元测试 fixture**

`src/ui/idle-page.test.ts` 第 5 行：`worldName: '青石江湖'` → `worldName: '牛家村'`。

`src/ui/shell.test.ts` 第 24 行：`worldContext: { worldName: '青石江湖', ... }` → `worldContext: { worldName: '牛家村', ... }`。

- [ ] **Step 2: 更新 e2e 断言**

`tests/e2e/mvp.spec.ts` 第 119-120 行替换为：

```ts
  await expect(page.getByTestId('city-page')).toContainText('牛家村')
  await expect(page.getByTestId('city-page')).not.toContainText('嘉兴')
```

- [ ] **Step 3: 运行单测与 e2e**

Run: `npm test`
Expected: PASS。

Run: `npm run test:e2e`
Expected: PASS（含「势力和城市只显示当前大关内容」用例）。

---

### Task 6: 完整验证

- [ ] **Step 1: 全量单测**

Run: `npm test`
Expected: PASS，0 失败。

- [ ] **Step 2: 构建**

Run: `npm run build`
Expected: `tsc` 与 `vite build` 均成功。

- [ ] **Step 3: e2e**

Run: `npm run test:e2e`
Expected: PASS。

- [ ] **Step 4: diff 检查**

Run: `git diff --check`
Expected: 无空白错误。手动确认改动范围仅包含：`worlds.ts`、`validate.ts`、`validate.test.ts`、`game-session.ts`、`game-session.test.ts`、`jianghu-page.ts`、`jianghu-page.test.ts`、`main.ts`、`idle-page.test.ts`、`shell.test.ts`、`mvp.spec.ts`。

- [ ] **Step 5: 人工抽查（可选，需运行 dev）**

Run: `npm run dev`，新建游戏进入江湖总览：
- 共 30 张卡片；世界 01「牛家村」可进入。
- 世界 02-10 显示「尚未解锁 · 通关上一卷开放」并禁用。
- 世界 11「恒山」至世界 30「侠客岛」显示「未开放 · 无法进入」并禁用。
- 无横向滚动（移动端窄屏同样检查）。
