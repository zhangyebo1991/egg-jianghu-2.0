# 势力·传承 卡片显示层补全 — 设计方案

- **日期**：2026-08-11
- **范围**：`egg-jianghu/src/ui/factions-page.ts` 传承卡片（`renderMartialDetail`）
- **目标**：让势力·传承卡片呈现 `docs/武功重设计方案` 的设计意图（效果描述、连击/威力说明、机制标签、文学出处），消除"卡片与设计文档完全对不上"的观感
- **不在范围**：战斗引擎机制实现、数值公式调整、存档结构、城市页/侠客页渲染（数据先入库，渲染留作后续）

## 一、背景与根因

### 现状（已确认的根因）

势力·传承卡片当前只显示 5 个扁平字段（品阶/耗气/调息/威力/适配），与 `武功重设计方案` 文档的丰富信息"完全对不上"。根因横跨三层，但**不是 bug，是项目记录在案的分期落地状态**：

> `docs/武功重设计方案/00-总纲.md` 第 5 行：「340 个新名称已全部落地……**新效果机制属引擎扩展，尚未实现**，落地前按各卷『引擎落地』列用现有语义近似。」

| 层 | 文件 | 现状 |
|---|---|---|
| 数据模型 | `content/martials.ts:15` `MartialDefinitionV10` | 只有扁平字段 `energyCost/cooldownMs/power/rarity/careerIds/currencySource`，无描述/连击/标签/出处 |
| 数据生成 | `content/martials.ts:81` `FACTION_MARTIALS` | stage 公式批量造数；只从文档取了**名字**（`martial-names.ts`，由 `tmp/gen-martial-names.cjs` 生成） |
| 战斗引擎 | `combat/engine.ts:132,145` | `martial.power` 当单一倍率单次结算；**连击/破甲/中毒等机制未实现**（`【扩展】`= 计划中） |
| 渲染 | `ui/factions-page.ts:185-211` | 如实显示 view-model 的 5 个字段 |

### 数值对照（以全真剑法 `qingfeng_hall_a1` 为例）

| 文档 | 卡片当前显示 | 一致性 |
|---|---|---|
| 真气 12 / 冷却 2200ms / 基础威力 1.15 / 品级 粗浅 / 贡献 80 / 适配 careerIds | 耗气 12 / 调息 2.2s / 威力 1.15 / 品阶 粗浅 / 适配 剑客… | ✅ 扁平基础值对得上 |
| `×2段（各50%，总1.27）` | — | ❌ 连击维度丢失 |
| 效果设计「两段连击，剑势平正，总威力为同阶单体 1.1 倍」 | — | ❌ 无描述字段 |
| `damage·单体 + 连击【扩展】` | — | ❌ 无标签字段 |
| 出处《射雕英雄传》 | — | ❌ `source` 是数据源标志，非文学出处 |

> 注：`power = 0.8 + stage*0.35`（总纲第三节官方基准）对**无补偿纯单体**技能成立；带群体换算/控制补偿/破甲补偿的技能，文档基础威力与公式产出本就有偏差（如 鸿渐于陆 doc 0.9 vs 公式 1.5）。本轮**不校正这些数值**——属"完整落地"方案的范畴。

## 二、方案总览

**仅显示层补全**：把文档的设计信息作为**展示性元数据**采入一个 sidecar 数据文件，在 view-model 注入、在卡片渲染。战斗模型与引擎完全不碰，零平衡风险。

呈现保真度定调为**玩家向·风味化**：效果设计即游戏内文案、隐藏 `【扩展】` 脚手架与"未实现"措辞、机制译成易懂中文词、出处作装饰。

## 三、数据层

### 3.1 新增 sidecar `content/martial-lore.ts`

仿 `martial-names.ts` 模式（`Record<id, ...>` + 头部「由 scripts 生成，请勿手改」）：

```typescript
export interface MartialLore {
  /** 效果设计列 → 玩家向文案（轻度清理） */
  description: string
  /** 出处列，如「《射雕英雄传》」 */
  origin: string
  /** 阶段名：初传 / 进境 / 真传 / 秘传（派生，便于直接用） */
  stageName: string
  /** 威力展示串，如「1.15 ×2段(总1.27)」或「0.95」 */
  powerNote: string
  /** 机制标签玩家向译名，如 ['单体', '连击']（已去【扩展】） */
  tags: string[]
}

export const MARTIAL_LORE: Record<string, MartialLore> = { /* 由脚本生成 */ }
```

**为何 sidecar 而非扩展 `MartialDefinitionV10`**：lore 是纯展示数据，引擎/存档/平衡都不应感知。sidecar 在 view-model 按需注入，战斗模型保持精简（单一职责）。

### 3.2 生成器 `tmp/gen-martial-lore.cjs`

复刻 `gen-martial-names.cjs` 的逐行解析（已验证对 10 卷通用），同一行 `line.split('|')` 多取列：

- 势力武功行（含阶段列）：`['', id, 阶段, 新名称, 出处, 品级, 效果设计, 数值建议, 引擎落地]` → 取 cols[2,4,6,7,8]
- 城市通用武功行（无阶段列）：`['', id, 新名称, 出处, 品级, 效果设计, 数值建议, 引擎落地]` → 取 cols[2,3,5,6,7]（阶段固定「通用」）
- 心法行：仅有 名称/出处/效果定位/数值建议，按需采 description+origin，`tags=[]`、`powerNote=''`

字段派生规则见 §4。生成结果覆盖全部 340 id（势力 240 / 通用 60 / 心法 40），头部注明出处与「请勿手改」。

## 四、文案映射（doc 列 → lore 字段）

| doc 列 | lore 字段 | 处理规则 |
|---|---|---|
| 效果设计 | `description` | 原文，清理 `〔拟〕` 与 `**`，保留引文味 |
| 出处 | `origin` | 原样（如「《射雕英雄传》」「江湖流传」） |
| 阶段 | `stageName` | 初传/进境/真传/秘传；通用武功填「通用」 |
| 数值建议 | `powerNote` | 见 §4.1 |
| 引擎落地 | `tags` | 见 §4.2 |

### 4.1 `powerNote` 派生

解析「数值建议」列的威力片段：

- 含 `×N段`：拼 `` `${base} ×${N}段(总${total})` ``，如 `1.15×2段（各50%，总1.27）` → `1.15 ×2段(总1.27)`
- 无连击且有显式威力：` ${base}`，如 `0.95`
- 无威力（防御向，如铁布衫 `—`）：空串（卡片威力 span 回退到 `power.toFixed(2)`）

**威力口径决策（已定）**：`powerNote` 显示**文档设计值**（如 `总1.27`），与所选"玩家向·风味化"预览一致。当前引擎实际按扁平 `power` 单次结算（连击未实现），故"卡片威力"与"实战伤害"存在过渡态落差——此即总纲所称"用现有语义近似"。引擎机制上线后自然消弭。

### 4.2 `tags` 派生与翻译表

解析「引擎落地」列，按 `+` 拆分，去 `【扩展】` 后缀，经下表映射为玩家向中文词；目标动词 `damage/heal/guard/revive/cleanse/dispel·X` 单独映射。

**目标动词**（穷举自全部 10 卷）：

| doc | chip |
|---|---|
| `damage·单体` / `damage·群体` | 单体 / 群体 |
| `heal·单体` / `heal·群体` | 单疗 / 群疗 |
| `guard·单体` / `guard·自身` / `guard·群体` | 护体 |
| `revive·单体` | 复活 |
| `cleanse·单体` / `cleanse·群体` / `cleanse·我方群体` | 净化 |
| `dispel·群体` / `dispel·敌方群体` | 驱散 |

**机制**（全集取自 `00-总纲` 第二节词汇表，多数原样保留）：

| doc | chip | 备注 |
|---|---|---|
| 连击 / 破甲 / 破气 / 易伤 / 流血 / 中毒 / 点穴 / 封穴 / 迟缓 / 吸血 / 吸内 / 蓄力 / 狂暴 / 护盾 / 金钟 / 反伤 / 借力 / 闪避 / 加速 / 回气 / 阵法 / 召唤 / 自损 | 同名 | 玩家可读，原样 |
| 破绽标记 | 破绽 | 缩短 |
| 夺益 | 偷益 | 润色 |
| 复制 | 复制 | 原样（以彼之道之意已在描述） |
| 击退 / 拉近 | 击退 / 拉近 | 原样 |

未命中映射表的 token：**原样去 `【扩展】` 保留**（保底，不丢信息），并在生成器 stderr 列出供后续补全。

### 4.3 映射示例

`qingfeng_hall_a1`（全真剑法）：

```text
description : 两段连击，剑势平正，总威力为同阶单体1.1倍
origin      : 《射雕英雄传》
stageName   : 初传
powerNote   : 1.15 ×2段(总1.27)
tags        : [单体, 连击]
```

`world_01_common_inner_01`（铁布衫）：

```text
description : 硬功横练，自身受到伤害降低30%持续5秒
origin      : 江湖流传
stageName   : 通用
powerNote   : （空，防御向）
tags        : [护体, 金钟]
```

## 五、渲染层

### 5.1 view-model 扩展

`ui/factions-page.ts:7-27` `FactionMartialView` 新增可选字段（兜底 undefined）：

```typescript
description?: string
origin?: string
stageName?: string
powerNote?: string
tags?: string[]
```

### 5.2 注入点

`main.ts:949-990` `martialViews.map` 的返回对象展开 lore，按 id 查 `MARTIAL_LORE`，无命中则字段缺省（旧数据/未覆盖 id 不崩）：

```typescript
const lore = MARTIAL_LORE[martial.id]
return {
  /* ...existing fields... */
  description: lore?.description,
  origin: lore?.origin,
  stageName: lore?.stageName,
  powerNote: lore?.powerNote,
  tags: lore?.tags,
}
```

### 5.3 卡片 DOM（`renderMartialDetail`，factions-page.ts:185-211）

在现有结构上增量，**不破坏既有 `faction-detail-stats` 与 `faction-detail-action`**：

1. **name 行**：`${name}${learned?` Lv.x`:''} · ${stageName}`；右侧挂出处 `<small class="faction-detail-origin">《…》</small>`
2. **引文行**（name 下、stats 上）：`<p class="faction-detail-desc">「${description}」</p>`，仅当 description 存在
3. **威力 span**：优先用 `powerNote`，空则回退 `power.toFixed(2)`
4. **tags 行**（stats 下）：`<div class="faction-detail-tags">${tags.map(t=>`<i>◈${t}</i>`).join('')}</div>`，仅当 tags 非空

### 5.4 样式（`style.css`）

复用现有 `--faction-*` 变量与字体，遵循水墨卷轴审美：

- `.faction-detail-origin`：`color: var(--faction-paper-mute)`，字号 11px，右浮
- `.faction-detail-desc`：`color: var(--faction-paper-mute)`，`font-style: italic`，字号 12px，`margin: 6px 0 0`，`line-height` 宽松
- `.faction-detail-tags i`：`color: var(--faction-jade)`，半透边框 chip，字号 10px，`letter-spacing: .08em`
- 移动端沿用现有 `.faction-detail-stats` 的 `@media` 换行策略；引文行/tags 行天然换行，无需额外断点

## 六、范围与测试

### 6.1 范围

- **本轮渲染**：势力·传承卡片（`factions-page.ts`）
- **数据入库**：全部 340 id 的 lore（含通用/心法，供后续城市页/侠客页复用）
- **不改动**：`MartialDefinitionV10`、`combat/engine.ts`、所有数值公式、存档结构、城市页/侠客页

### 6.2 测试

1. **生成器**：`tmp/gen-martial-lore.cjs` 运行后断言计数（势力 240 / 通用 60 / 心法 40），与 `martial-names.ts` 的 id 集合一致；未翻译 token 列表为空或已知
2. **单元/快照**：`ui/pages.test.ts` 增设势力页传承卡片断言——选中 `qingfeng_hall_a1` 时 DOM 含 description、origin《射雕英雄传》、tags 含「连击」、powerNote 含「×2段」
3. **兜底**：构造一个不在 `MARTIAL_LORE` 的 martial id，断言卡片不崩、不出现 undefined 文本、威力回退到 `power.toFixed(2)`
4. **回归**：现有 `pages.test.ts` / `e2e/mvp.spec.ts` 全绿

### 6.3 验收标准

- 任一势力·传承节点点开后，卡片显示：阶段名 + 出处 + 效果引文 + 增强威力行 + 机制 chips
- 信息与该 id 在 `武功重设计方案` 对应卷的表格行一致（描述/出处/连击/标签）
- 战斗行为、存档、数值零变化
- 全量测试通过，移动端无溢出

## 七、风险与回退

| 风险 | 缓解 |
|---|---|
| 文档某卷表格格式微差导致解析列错位 | 复用已验证的 `gen-martial-names` 解析；生成器做列数断言；先 dry-run 对比 id 集合 |
| 威力设计值与实战落差引发玩家困惑 | 风味化口径已确认；引擎机制上线后自然消弭；必要时可在描述里点明"招意" |
| 未翻译 token 渲染出生硬词 | 保底原样保留 + stderr 列表；翻译表持续补全 |
| 卡片信息增多撑高移动端 | 引文/tags 自然换行；沿用现有 @media；必要时截断描述 |

回退极简：lore 为 sidecar，删去注入与渲染增量即恢复原状，数据文件可独立保留。
