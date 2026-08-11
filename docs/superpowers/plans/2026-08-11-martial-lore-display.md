# 势力·传承卡片显示层补全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让势力·传承卡片呈现 `docs/武功重设计方案` 的设计意图（效果描述、连击/威力说明、机制标签、文学出处），消除"卡片与设计文档完全对不上"的观感——仅显示层，战斗引擎与数值不动。

**Architecture:** 用 sidecar `content/martial-lore.ts`（由 `tmp/gen-martial-lore.cjs` 从设计文档解析生成）承载展示性元数据；view-model 构造时用纯函数 `withLore` 按 id 注入；`renderMartialDetail` 增量渲染。`MartialDefinitionV10`、`combat/engine.ts`、所有数值公式零改动。

**Tech Stack:** TypeScript（ESM）、Vite、Vitest、Playwright；CommonJS 生成器脚本（`.cjs`，沿用 `tmp/gen-martial-names.cjs` 范式）。

## Global Constraints

- **注释语言：中文**（与现有代码库一致）。
- **不得改动**：`content/martials.ts` 的 `MartialDefinitionV10` 接口与 `FACTION_MARTIALS`/`CITY_MARTIALS` 数值公式、`combat/` 全部文件、存档结构。
- **测试命令**（在 `egg-jianghu/` 目录执行）：单元 `npm test`（= `vitest run src`）；单文件 `npx vitest run src/content/martial-lore.test.ts`；类型检查 `npx tsc --noEmit`；e2e `npm run test:e2e`。
- **生成器命令**（在**仓库根目录**执行）：`node tmp/gen-martial-lore.cjs`。
- **`tmp/` 被 `.gitignore` 忽略**：生成器 `tmp/gen-martial-lore.cjs` 是 scratch，**不提交**（与既有 `gen-martial-names.cjs` 同约定）；只提交其产物 `martial-lore.ts` 与测试。
- **worktree 无 `node_modules`**（被忽略）：进入 worktree 后需在 `egg-jianghu/` 执行一次 `npm install` 才能跑 `npm test` / `npx tsc` / e2e。
- **提交**：遵循用户全局规则——仅在用户授权时提交；提交信息格式 `<emoji> <type>(<scope>): <desc>`，emoji 开头、中文祈使语气、≤150 字符、不以句号结尾。每个 Task 末尾给出建议提交信息，但**执行时需用户确认**。
- **数据口径**：`powerNote` 显示**文档设计值**（如 `1.15 ×2段(总1.27)`），与引擎近似实战存在过渡态落差——此为既定决策，不在本计划修正。

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `tmp/gen-martial-lore.cjs` | 从 `docs/武功重设计方案/*.md` 解析 lore，生成 `martial-lore.ts` | 新建 |
| `egg-jianghu/src/content/martial-lore.ts` | 展示性 lore 数据（`MARTIAL_LORE` + `MartialLore` 接口） | 新建（生成产物） |
| `egg-jianghu/src/content/martial-lore.test.ts` | 校验生成数据：计数/样例/标签去脚手架 | 新建 |
| `egg-jianghu/src/ui/factions-page.ts` | `FactionMartialView` 扩展可选字段；`withLore` 纯函数；`renderMartialDetail` 增量 | 修改 |
| `egg-jianghu/src/style.css` | 新增 `.faction-detail-origin/-desc/-tags` 样式 | 修改 |
| `egg-jianghu/src/ui/pages.test.ts` | 夹具补 lore 字段 + 渲染断言 + `withLore` 单测 | 修改 |
| `egg-jianghu/src/main.ts` | 导入 `MARTIAL_LORE` 与 `withLore`，在 `martialViews.map` 注入 | 修改 |
| `egg-jianghu/tests/e2e/mvp.spec.ts` | 既有"经脉研习"用例追加 lore 端到端断言 | 修改 |

**职责边界**：`martial-lore.ts` 是纯展示数据，引擎/存档/平衡均不引用；`withLore` 是无副作用的 view-model 富化函数，可独立单测；`renderMartialDetail` 只读 view-model 字段渲染。

---

## Task 1: 生成器与 lore 数据

**Files:**
- Create: `tmp/gen-martial-lore.cjs`
- Create: `egg-jianghu/src/content/martial-lore.ts`（生成产物）
- Test: `egg-jianghu/src/content/martial-lore.test.ts`

**Interfaces:**
- Consumes: `docs/武功重设计方案/*.md`（10 个分卷文档；`00-总纲.md` 含机制词汇表，其非 ascii-id 行被自动跳过）
- Produces: `export interface MartialLore { description: string; origin: string; stageName: string; powerNote: string; tags: string[] }` 与 `export const MARTIAL_LORE: Record<string, MartialLore>`（位于 `content/martial-lore.ts`）。下游 Task 2/3 依赖此两者。

- [ ] **Step 1: 写失败测试 `egg-jianghu/src/content/martial-lore.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { MARTIAL_LORE } from './martial-lore'

describe('MARTIAL_LORE 生成数据', () => {
  it('覆盖全部势力/通用/心法 id', () => {
    const ids = Object.keys(MARTIAL_LORE)
    expect(ids.filter((id) => /_[abcd][12]$/.test(id))).toHaveLength(240)
    expect(ids.filter((id) => id.includes('_common_'))).toHaveLength(60)
    expect(ids.filter((id) => id.includes('_heart_'))).toHaveLength(40)
  })

  it('全真剑法解析为玩家向 lore', () => {
    const lore = MARTIAL_LORE['qingfeng_hall_a1']
    expect(lore).toBeDefined()
    expect(lore.description).toContain('两段连击')
    expect(lore.origin).toBe('《射雕英雄传》')
    expect(lore.stageName).toBe('初传')
    expect(lore.powerNote).toBe('1.15 ×2段(总1.27)')
    expect(lore.tags).toEqual(['单体', '连击'])
  })

  it('铁布衫防御向：无威力、护体与金钟标签', () => {
    const lore = MARTIAL_LORE['world_01_common_inner_01']
    expect(lore.powerNote).toBe('')
    expect(lore.tags).toEqual(['护体', '金钟'])
  })

  it('所有 tag 已去掉【扩展】与英文目标脚手架', () => {
    for (const lore of Object.values(MARTIAL_LORE)) {
      for (const tag of lore.tags) {
        expect(tag).not.toContain('【扩展】')
        expect(tag).not.toMatch(/^(damage|heal|guard|revive|cleanse|dispel)·/)
      }
    }
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run（在 `egg-jianghu/`）：`npx vitest run src/content/martial-lore.test.ts`
Expected: FAIL —— `Failed to resolve import './martial-lore'`（文件尚未生成）。

- [ ] **Step 3: 写生成器 `tmp/gen-martial-lore.cjs`**

```javascript
// 从 docs/武功重设计方案/*.md 解析武功/心法展示性 lore，生成 src/content/martial-lore.ts
const fs = require('fs')
const path = require('path')

const docsDir = path.resolve(__dirname, '../docs/武功重设计方案')
const outFile = path.resolve(__dirname, '../egg-jianghu/src/content/martial-lore.ts')

const STAGES = new Set(['初传', '进境', '真传', '秘传'])
const clean = (s) => (s ?? '').replace(/〔拟〕/g, '').replace(/\*\*/g, '').trim()

// 目标动词 → 玩家向 chip（穷举自 10 卷「引擎落地」列）
const TARGET_MAP = {
  'damage·单体': '单体', 'damage·群体': '群体',
  'heal·单体': '单疗', 'heal·群体': '群疗',
  'guard·单体': '护体', 'guard·自身': '护体', 'guard·群体': '护体',
  'revive·单体': '复活',
  'cleanse·单体': '净化', 'cleanse·群体': '净化', 'cleanse·我方群体': '净化',
  'dispel·群体': '驱散', 'dispel·敌方群体': '驱散',
}
// 机制名 → 玩家向 chip（多数原样，仅个别润色）
const MECHANIC_MAP = { '破绽标记': '破绽', '夺益': '偷益' }

// 解析「数值建议」列的威力片段 → 玩家向展示串
const parsePowerNote = (numerics) => {
  if (!numerics) return ''
  const core = ((numerics.split('/')[2] ?? '').split('；')[0] ?? '').trim()
  if (!/^\d/.test(core)) return '' // —（无威力，防御向）
  const combo = core.match(/^([\d.]+)×(\d+)段/)
  if (combo) {
    const [, base, segs] = combo
    const total = core.match(/总\s*([\d.]+)/)
    return total ? `${base} ×${segs}段(总${total[1]})` : `${base} ×${segs}段`
  }
  const single = core.match(/^([\d.]+)/)
  return single ? single[1] : ''
}

// 解析「引擎落地」列 → 玩家向标签数组（去【扩展】、去英文目标、去括注）
const parseTags = (engine) => {
  if (!engine) return []
  const tags = []
  for (const raw of engine.split(/[+→]/)) {
    let tok = raw.replace(/（[^）]*）/g, '').trim() // 去（自身）等括注
    const tm = tok.match(/^(damage|heal|guard|revive|cleanse|dispel)·(.+)$/)
    if (tm) {
      const mapped = TARGET_MAP[`${tm[1]}·${tm[2]}`]
      if (mapped) tags.push(mapped)
      else console.warn('[lore] 未映射目标:', tm[0])
      continue
    }
    tok = tok.replace(/【扩展】/g, '').trim()
    if (!tok) continue
    tags.push(MECHANIC_MAP[tok] ?? tok)
  }
  return [...new Set(tags)]
}

const lore = {}
const files = fs.readdirSync(docsDir).filter((f) => /^\d{2}-.+\.md$/.test(f))
for (const file of files) {
  const lines = fs.readFileSync(path.join(docsDir, file), 'utf8').split('\n')
  for (const line of lines) {
    const m = line.match(/^\|\s*([a-z][a-z0-9_]+)\s*\|/)
    if (!m) continue
    const id = m[1]
    const cols = line.split('|').map((c) => c.trim())
    const isHeart = id.includes('_heart_')
    const hasStage = !isHeart && STAGES.has(cols[2])
    const description = clean(isHeart ? cols[4] : (hasStage ? cols[6] : cols[5]))
    const origin = clean(isHeart ? cols[3] : (hasStage ? cols[4] : cols[3]))
    const stageName = isHeart ? '' : (hasStage ? cols[2] : '通用')
    const numerics = isHeart ? '' : (hasStage ? cols[7] : cols[6])
    const engine = isHeart ? '' : (hasStage ? cols[8] : cols[7])
    if (!description && !origin && !numerics && !engine) continue
    lore[id] = {
      description,
      origin,
      stageName,
      powerNote: parsePowerNote(numerics),
      tags: parseTags(engine),
    }
  }
}

const counts = {
  faction: Object.keys(lore).filter((id) => /_[abcd][12]$/.test(id)).length,
  city: Object.keys(lore).filter((id) => id.includes('_common_')).length,
  heart: Object.keys(lore).filter((id) => id.includes('_heart_')).length,
}
console.log(`势力 ${counts.faction} / 通用 ${counts.city} / 心法 ${counts.heart}`)

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const emitEntry = ([k, v]) =>
  `  '${k}': { description: '${esc(v.description)}', origin: '${esc(v.origin)}', stageName: '${esc(v.stageName)}', powerNote: '${esc(v.powerNote)}', tags: [${v.tags.map((t) => `'${esc(t)}'`).join(', ')}] },`

const ts = `// 由 scripts 依据 docs/武功重设计方案 生成，请勿手改；展示性 lore，详见设计文档
// 势力武功 ${counts.faction} 门、城市通用武功 ${counts.city} 门、心法 ${counts.heart} 门
export interface MartialLore {
  description: string
  origin: string
  stageName: string
  powerNote: string
  tags: string[]
}

export const MARTIAL_LORE: Record<string, MartialLore> = {
${Object.entries(lore).map(emitEntry).join('\n')}
}
`
fs.writeFileSync(outFile, ts)
console.log('written:', outFile)
```

- [ ] **Step 4: 运行生成器（在仓库根目录）**

Run：`node tmp/gen-martial-lore.cjs`
Expected：stdout 打印 `势力 240 / 通用 60 / 心法 40`，并 `written: .../martial-lore.ts`；无 `[lore] 未映射目标` 警告（若有，记录并补全 `TARGET_MAP`）。

- [ ] **Step 5: 运行测试确认通过**

Run（在 `egg-jianghu/`）：`npx vitest run src/content/martial-lore.test.ts`
Expected：PASS（4 个用例全绿）。若 `qingfeng_hall_a1` 标签顺序或 `powerNote` 不符，核对 `01-牛家村.md:13` 原文与解析输出，调整 `parseTags`/`parsePowerNote` 后重跑 Step 4-5。

- [ ] **Step 6: 提交（需用户确认）**

> 生成器 `tmp/gen-martial-lore.cjs` 位于被忽略的 `tmp/`（scratch，与 `gen-martial-names.cjs` 同约定，不提交）；仅提交生成产物与测试。

```bash
git add egg-jianghu/src/content/martial-lore.ts egg-jianghu/src/content/martial-lore.test.ts
git commit -m "✨ feat(lore): 新增武功展示性 lore 数据与生成器"
```

---

## Task 2: view-model 与渲染

**Files:**
- Modify: `egg-jianghu/src/ui/factions-page.ts`（`FactionMartialView` 接口、新增 `withLore`、重写 `renderMartialDetail`）
- Modify: `egg-jianghu/src/style.css`（新增 3 个样式类）
- Test: `egg-jianghu/src/ui/pages.test.ts`（夹具 + 断言 + `withLore` 单测）

**Interfaces:**
- Consumes: `MartialLore`（来自 `content/martial-lore.ts`，Task 1 产出）
- Produces: `FactionMartialView` 新增可选字段 `description?: string; origin?: string; stageName?: string; powerNote?: string; tags?: string[]`；新导出 `withLore(view: FactionMartialView, lore?: MartialLore): FactionMartialView`。下游 Task 3 依赖 `withLore`。

- [ ] **Step 1: 写失败测试（在 `pages.test.ts` 末尾追加）**

先给 `factionsFixture()` 的 `selectedMartial`（约 107-112 行）补 lore 字段：

```typescript
  selectedMartial: {
    id: 'qingfeng_hall_1', name: '快剑第一式', stage: 1, rarity: '粗浅', cost: 80, upgradeCost: 96,
    learned: false, level: 0, state: 'next', energyCost: 12, cooldownMs: 2200, power: 1.15,
    previousName: null, careerNames: ['剑客', '游剑客'], careerCompatible: true, affordable: true,
    actionDisabled: false, actionReason: null, selected: true,
    description: '两段连击，剑势平正', origin: '《射雕英雄传》', stageName: '初传',
    powerNote: '1.15 ×2段(总1.27)', tags: ['单体', '连击'],
  },
```

再在 `describe` 块内追加两个用例：

```typescript
  it('传承卡片渲染 lore：阶段/出处/描述/威力说明/机制标签', () => {
    const html = renderFactionsPage(factionsFixture())
    expect(html).toContain('快剑第一式 · 初传')
    expect(html).toContain('《射雕英雄传》')
    expect(html).toContain('「两段连击，剑势平正」')
    expect(html).toContain('1.15 ×2段(总1.27)')
    expect(html).toContain('◈单体')
    expect(html).toContain('◈连击')
  })

  it('withLore 注入 lore 字段，无 lore 时原样返回', async () => {
    const { withLore } = await import('./factions-page')
    const base = factionsFixture().selectedMartial!
    const enriched = withLore(base, { description: 'd', origin: 'o', stageName: '初传', powerNote: 'p', tags: ['单体'] })
    expect(enriched.description).toBe('d')
    expect(enriched.tags).toEqual(['单体'])
    expect(withLore(base, undefined)).toEqual(base)
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run（在 `egg-jianghu/`）：`npx vitest run src/ui/pages.test.ts`
Expected：FAIL —— 类型错误（`FactionMartialView` 无 `description` 等字段）或断言不匹配（HTML 未含 lore）。

- [ ] **Step 3: 扩展 `FactionMartialView` 接口并新增 `withLore`**

在 `egg-jianghu/src/ui/factions-page.ts` 顶部 import 区追加：

```typescript
import type { MartialLore } from '../content/martial-lore'
```

在 `FactionMartialView` 接口（约 7-27 行）末尾 `selected: boolean` 之后追加可选字段：

```typescript
  description?: string
  origin?: string
  stageName?: string
  powerNote?: string
  tags?: string[]
```

在接口定义之后（约 27 行后）新增纯函数：

```typescript
/** 将展示性 lore 富化进武术视图；无 lore 时原样返回，保证旧数据/未覆盖 id 不崩 */
export const withLore = (view: FactionMartialView, lore?: MartialLore): FactionMartialView =>
  lore
    ? {
      ...view,
      description: lore.description,
      origin: lore.origin,
      stageName: lore.stageName,
      powerNote: lore.powerNote,
      tags: lore.tags,
    }
    : view
```

- [ ] **Step 4: 重写 `renderMartialDetail`（约 185-211 行，整体替换）**

```typescript
const renderMartialDetail = (view: FactionsPageViewModel): string => {
  const martial = view.selectedMartial
  if (!martial) return '<div class="faction-martial-detail empty" data-testid="faction-martial-detail"><span>选择一处经脉节点，查看武功详情</span></div>'
  const action = martial.learned ? 'martial-upgrade' : 'martial-learn'
  const actionCost = martial.learned ? martial.upgradeCost : martial.cost
  const actionLabel = martial.actionDisabled
    ? martial.actionReason ?? (martial.learned ? '暂不可升级' : '暂不可研习')
    : `${martial.learned ? '升级' : '研习'} · 贡献 ${formatNumber(actionCost)}`
  const stageSuffix = martial.stageName ? ` · ${escapeHtml(martial.stageName)}` : ''
  const powerDisplay = martial.powerNote || martial.power.toFixed(2)
  return `<div class="faction-martial-detail ${martial.state}" data-testid="faction-martial-detail">
    <div class="faction-detail-copy">
      ${martial.origin ? `<span class="faction-detail-origin">${escapeHtml(martial.origin)}</span>` : ''}
      <img class="faction-detail-icon" src="${escapeHtml(martialIconAsset(martial.id))}" alt="" aria-hidden="true" draggable="false">
      <div class="faction-detail-name">${escapeHtml(martial.name)}${stageSuffix}${martial.learned ? ` <small>Lv.${martial.level}</small>` : ''}</div>
      ${martial.description ? `<p class="faction-detail-desc">「${escapeHtml(martial.description)}」</p>` : ''}
      <div class="faction-detail-stats">
        <span>品阶 <b data-rarity="${escapeHtml(martial.rarity)}">${escapeHtml(martial.rarity)}</b></span>
        <span>耗气 <b>${martial.energyCost}</b></span>
        <span>调息 <b>${formatCooldown(martial.cooldownMs)}</b></span>
        <span>威力 <b>${escapeHtml(powerDisplay)}</b></span>
        ${martial.previousName ? `<span>前置 <b>${escapeHtml(martial.previousName)} Lv.20</b></span>` : ''}
        <span>适配 <b>${escapeHtml(martial.careerNames.join(' / '))}</b></span>
      </div>
      ${martial.tags && martial.tags.length > 0 ? `<div class="faction-detail-tags">${martial.tags.map((tag) => `<i>◈${escapeHtml(tag)}</i>`).join('')}</div>` : ''}
    </div>
    <div class="faction-detail-action">
      <span>${view.selectedHero ? `研习对象 · ${escapeHtml(view.selectedHero.name)}` : '请先选择研习对象'}</span>
      <button type="button" class="faction-learn-button ${martial.learned ? 'upgrade' : ''}" data-action="${action}" data-hero-id="${escapeHtml(view.selectedHeroId ?? '')}" data-martial-id="${escapeHtml(martial.id)}"${martial.actionDisabled ? ' disabled' : ''}>${escapeHtml(actionLabel)}</button>
    </div>
  </div>`
}
```

> 注：顺带把原代码里 `<\small>`/`<\b>`/`<\span>` 的反斜线笔误修正为正规闭合标签（`</small>` 等）。

- [ ] **Step 5: 新增样式（`style.css`，定位到 `.faction-detail-action > span` 规则之后，约 2043 行附近）**

```css
.faction-detail-origin { float: right; color: var(--faction-paper-mute); font-size: 11px; letter-spacing: .04em; }
.faction-detail-desc { margin: 6px 0 0; color: var(--faction-paper-mute); font-size: 12px; font-style: italic; line-height: 1.7; letter-spacing: .02em; }
.faction-detail-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.faction-detail-tags i { padding: 1px 8px; border: 1px solid rgb(201 163 92 / 30%); border-radius: 999px; color: var(--faction-jade); font-style: normal; font-size: 10px; letter-spacing: .08em; }
```

并在移动端断点（约 2112 行 `.faction-martial-detail { grid-template-columns: 1fr; ... }` 所在 `@media` 块内）追加，避免 origin 浮动在窄屏错位：

```css
  .faction-detail-origin { float: none; display: block; margin-bottom: 2px; }
```

- [ ] **Step 6: 运行测试确认通过**

Run（在 `egg-jianghu/`）：`npx vitest run src/ui/pages.test.ts`
Expected：PASS（新增 2 用例 + 既有势力页用例全绿）。

- [ ] **Step 7: 类型检查 + 全量回归**

Run（在 `egg-jianghu/`）：`npx tsc --noEmit && npm test`
Expected：tsc 无错；`npm test` 全绿。

- [ ] **Step 8: 提交（需用户确认）**

```bash
git add egg-jianghu/src/ui/factions-page.ts egg-jianghu/src/style.css egg-jianghu/src/ui/pages.test.ts
git commit -m "✨ feat(factions): 传承卡片渲染武功 lore 展示信息"
```

---

## Task 3: 主程序注入与端到端验证

**Files:**
- Modify: `egg-jianghu/src/main.ts`（导入 + 在 `martialViews.map` 注入 lore）
- Modify: `egg-jianghu/tests/e2e/mvp.spec.ts`（"势力页支持切换匾额、点将谱搜索和经脉研习" 用例追加 lore 断言）

**Interfaces:**
- Consumes: `MARTIAL_LORE`（Task 1）、`withLore` 与 `FactionMartialView`（Task 2）。

- [ ] **Step 1: 追加 e2e 断言（先写失败端到端）**

在 `tests/e2e/mvp.spec.ts` 的 `test('势力页支持切换匾额、点将谱搜索和经脉研习', ...)`（约 597-620 行）中，定位到：

```typescript
  await page.getByTestId('faction-martial-qingfeng_hall_a1').click()
  await expect(page.getByTestId('faction-martial-detail')).toContainText('全真剑法')
```

在 `toContainText('全真剑法')` 之后追加：

```typescript
  await expect(page.getByTestId('faction-martial-detail')).toContainText('两段连击')
  await expect(page.getByTestId('faction-martial-detail')).toContainText('《射雕英雄传》')
  await expect(page.getByTestId('faction-martial-detail')).toContainText('◈连击')
```

- [ ] **Step 2: 运行 e2e 确认失败（注入未接）**

Run（在 `egg-jianghu/`）：`npm run test:e2e -- -g "经脉研习"`
Expected：FAIL —— detail 不含「两段连击」（main.ts 尚未注入 lore）。

- [ ] **Step 3: 在 `main.ts` 接入 lore**

在 `egg-jianghu/src/main.ts` 顶部 import 区，找到从 `./ui/factions-page` 的导入（已有 `FactionMartialView`/`renderFactionsPage` 等），追加 `withLore`；并新增 `MARTIAL_LORE` 导入：

```typescript
import { MARTIAL_LORE } from './content/martial-lore'
```

（若 `./ui/factions-page` 的 import 为命名导入列表，在其中加入 `withLore`。）

在 `martialViews.map` 的 `return { ... }`（约 969-989 行）处，把返回值用 `withLore` 包裹。改动前：

```typescript
    return {
      id: martial.id,
      /* ...既有字段... */
      selected: martial.id === selectedFactionMartialId,
    }
```

改动后：

```typescript
    return withLore({
      id: martial.id,
      /* ...既有字段保持不变... */
      selected: martial.id === selectedFactionMartialId,
    }, MARTIAL_LORE[martial.id])
```

- [ ] **Step 4: 运行 e2e 确认通过**

Run（在 `egg-jianghu/`）：`npm run test:e2e -- -g "经脉研习"`
Expected：PASS —— detail 含「两段连击」「《射雕英雄传》」「◈连击」。

- [ ] **Step 5: 全量回归**

Run（在 `egg-jianghu/`）：`npx tsc --noEmit && npm test`
Expected：tsc 无错；单元测试全绿（注入不影响既有逻辑）。

- [ ] **Step 6: 视觉确认（可选但建议）**

Run（在 `egg-jianghu/`）：`npm run dev`，浏览器进入第一卷·全真教·传承，点选「全真剑法」节点，确认卡片显示：名称带「· 初传」、右上《射雕英雄传》、效果引文行、威力 `1.15 ×2段(总1.27)`、底部 `◈单体 ◈连击` chips；移动端窄屏下 origin 换行不错位。

- [ ] **Step 7: 提交（需用户确认）**

```bash
git add egg-jianghu/src/main.ts egg-jianghu/tests/e2e/mvp.spec.ts
git commit -m "✨ feat(factions): 注入武功 lore 至传承卡片端到端打通"
```

---

## Self-Review

**1. Spec 覆盖**：§3 数据层→Task 1；§4 文案映射（含 4.1 powerNote、4.2 tag 翻译表、4.3 示例）→Task 1 生成器 + 数据测试样例（全真剑法/铁布衫）；§5 渲染层（5.1 类型/5.2 注入/5.3 DOM/5.4 样式）→Task 2 + Task 3；§6 范围与测试（计数/样例/兜底/回归）→各 Task 测试步骤；威力口径决策→Global Constraints 与 Task 1 powerNote 实现。无遗漏。

**2. 占位符扫描**：无 TBD/TODO；所有代码块完整；所有 `Run` 命令具体；tag 翻译表与解析逻辑为真实代码。

**3. 类型一致性**：`MartialLore`（Task 1 定义）→ Task 2 `withLore` 形参 `lore?: MartialLore` → Task 3 `MARTIAL_LORE[martial.id]` 传入，类型一致；`FactionMartialView` 可选字段在 Task 2 定义后被 Task 3 经 `withLore` 填充，字段名（`description/origin/stageName/powerNote/tags`）三处一致；`withLore` 导出名一致。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-11-martial-lore-display.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 我每个 Task 派发独立 subagent 执行，Task 间两阶段审查，快速迭代。

**2. Inline Execution** — 在当前会话用 executing-plans 批量执行，带检查点复核。

哪种？
