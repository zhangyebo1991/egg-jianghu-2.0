# 蛋蛋江湖 2.0 武侠自动刷宝重铸 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 version 9 单敌人轮转挂机游戏替换为从零开始的 version 10 武侠自动刷宝游戏，完整落地六侠两排阵容、独立职业、气机/真气/回气、十波关卡、即时随机装备、势力任务与双线武功传承。

**Architecture:** 保留 Vite/Electron 页面外壳，在旧 `game.ts` 旁建立 `content/`、`combat/`、`domain/` 三组纯 TypeScript 模块，通过 `GameSession` 统一长期状态与临时战斗。新存档使用独立 key 且只接受 version 10；战斗引擎固定 100ms tick、可注入 seed，临时战斗永不序列化。每个里程碑都保持 `npm test` 与 `npm run build` 可通过，最终再删除 version 9 领域代码。

**Tech Stack:** TypeScript 6、Vite 8、Vitest 4、Playwright 1.54、Electron 40、原生 DOM/CSS、localStorage

---

## 0. 执行边界与里程碑

规格横跨内容、战斗、长期成长和 UI，不能以一次大爆炸改写完成。按下列四个可独立验证的里程碑顺序执行：

1. **M1 基础领域与新存档**：version 10 状态、内容目录、职业/邀请/武功修习；旧页面继续运行，不读取新模块。
2. **M2 战斗与关卡竖切**：纯战斗模拟、十波、驻守/闯荡、即时掉落；用单元测试完成无 UI 竖切。
3. **M3 长期循环**：背包、势力任务、贡献、城市武馆和转职信物；形成可保存的完整领域循环。
4. **M4 页面切换与旧域移除**：`GameSession` 接管入口、实现新页面、删除 version 9 规则并完成 E2E。

本计划不实现设计规格明确排除的铁匠铺、装备加工、离线收益、抽卡、秘籍残页、首次通关礼包、固定名器、门派套装和战斗中途恢复。

所有命令默认从 `egg-jianghu/` 执行。

## 1. 文件结构锁定

新增文件及单一职责：

```text
src/
  content/
    careers.ts          # 42 个职业节点与转职边
    factions.ts         # 10 卷 30 势力与稀有度预算
    heroes.ts           # 酒馆/势力侠客定义
    martials.ts         # 势力双线与城市通用武功
    worlds.ts           # 江湖卷、小关、敌群与世界货币
    equipment.ts        # 部位、品质、词条和掉落池
    validate.ts         # 内容引用与数量不变量
  combat/
    types.ts            # 临时战斗快照与事件
    rng.ts              # 可复现 PRNG
    timeline.ts         # 100ms 气机、回气与状态时间
    targeting.ts        # 2×3 阵型目标选择
    stats.ts            # 五维资质、职业系数与圆满心得面板
    damage.ts           # 外/内功伤害乘区
    skill-ai.ts         # 四槽优先级与跳过原因
    statuses.ts         # 刷新/取强/叠层/独立结算
    waves.ts            # 十波生成、继承与换波
    engine.ts           # 纯模拟入口与事件输出
  domain/
    types.ts            # version 10 长期状态类型
    state.ts            # 新档与不变量
    careers.ts          # 职业经验、转职、圆满
    recruitment.ts      # 酒馆/势力直接邀请
    martial-training.ts # 学习、升级、遗忘账本
    inventory.ts        # 300 格即时入包
    quests.ts           # 六格悬榜与 60 分钟刷新
    progression.ts      # 世界/小关解锁与失败回退
    rewards.ts          # 击杀长期收益结算
    save-v10.ts         # 新 key、version 10 校验、导入导出
  app/
    game-session.ts     # 长期状态 + 可空战斗会话
  ui/
    shell.ts            # 页签与页面容器
    idle-page.ts        # 江湖卷/小关/十波战斗
    heroes-page.ts      # 侠客、阵容、职业、武功
    factions-page.ts    # 悬榜、传承、势力侠客
    city-page.ts        # 酒馆与武馆
    inventory-page.ts   # 装备比较、锁定、穿戴
```

保留并最终修改：`src/main.ts`、`src/style.css`、`src/save.test.ts`、`src/game.test.ts`、`tests/e2e/mvp.spec.ts`。最终删除：`src/game.ts`、`src/data.ts`、`src/martials.ts` 及已被新模块覆盖的旧测试。

---

### Task 1: 建立 version 10 长期状态与独立存档

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/state.ts`
- Create: `src/domain/save-v10.ts`
- Create: `src/domain/save-v10.test.ts`

- [ ] **Step 1: 写下新档不读取旧 key、战斗不序列化的失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { createInitialStateV10 } from './state'
import { loadGameV10, SAVE_KEY_V10, saveGameV10 } from './save-v10'

const memoryStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    values,
  }
}

describe('version 10 存档', () => {
  it('忽略 version 1～9 的旧 key 并从零开始', () => {
    const storage = memoryStorage()
    storage.setItem('egg-jianghu-2-save-v1', JSON.stringify({ version: 9, resources: { silver: 999999 } }))
    const loaded = loadGameV10(storage, 1000)
    expect(loaded.state).toEqual(createInitialStateV10(1000))
    expect(storage.getItem(SAVE_KEY_V10)).toBeNull()
  })

  it('只保存长期状态且不存在 combat 字段', () => {
    const storage = memoryStorage()
    const state = createInitialStateV10(1000)
    saveGameV10(storage, state, 2000)
    const raw = JSON.parse(storage.getItem(SAVE_KEY_V10)!)
    expect(raw.version).toBe(10)
    expect(raw.combat).toBeUndefined()
    expect(raw.lastSavedAt).toBe(2000)
  })
})
```

- [ ] **Step 2: 运行测试确认缺少新模块**

Run: `npm test -- src/domain/save-v10.test.ts`

Expected: FAIL，错误包含 `Cannot find module './state'`。

- [ ] **Step 3: 定义严格的长期状态并实现新 key 存取**

```ts
// src/domain/types.ts
export type HeroGrade = '丙' | '乙' | '甲' | '地' | '天'
export type Rarity = '粗浅' | '寻常' | '精妙' | '上乘' | '绝学'
export type FormationRow = 'front' | 'back'
export type FormationPosition = 0 | 1 | 2
export type CampaignMode = 'guard' | 'roam'
export type QuestGrade = HeroGrade
export type EquipmentQuality = '凡品' | '良品' | '上品' | '珍品' | '绝品'
export interface ActionResult { ok: boolean; message: string }

export interface CurrencyWallet { [worldId: string]: number }
export interface ContributionWallet { [factionId: string]: number }
export interface InvestmentLedger { worldCurrency: Record<string, number>; contribution: Record<string, number> }
export interface LearnedMartial { level: number; invested: InvestmentLedger }
export interface CareerRecord { level: number; experience: number; perfected: boolean }
export interface HeroProgressV10 {
  recruited: boolean
  level: number
  experience: number
  careers: Record<string, CareerRecord>
  currentCareerId: string
  learnedMartials: Record<string, LearnedMartial>
  equippedMartialIds: [string | null, string | null, string | null, string | null]
  heartMethodId: string | null
  equipmentBySlot: Record<string, string | null>
}
export interface FormationSlot { heroId: string; row: FormationRow; position: FormationPosition }
export interface QuestProgress {
  id: string
  type: 'normal' | 'boss'
  grade: QuestGrade
  targetId: string
  targetCount: number
  rewardContribution: number
  generatedAt: number
  accepted: boolean
  completed: boolean
  claimed: boolean
  progress: number
}
export interface FactionBoardState { refreshRemainingMs: number; slots: Array<QuestProgress | null> }
export interface EquipmentInstance { uid: string; definitionId: string; level: number; quality: EquipmentQuality; affixes: Array<{ id: string; value: number }>; locked: boolean }
export interface GameStateV10 {
  version: 10
  worldCurrency: CurrencyWallet
  contribution: ContributionWallet
  heroes: Record<string, HeroProgressV10>
  careerTokens: string[]
  formation: FormationSlot[]
  unlockedWorldIds: string[]
  clearedStageByWorld: Record<string, number>
  encounteredEnemyIds: string[]
  factionBoards: Record<string, FactionBoardState>
  inventory: EquipmentInstance[]
  statistics: { kills: number; bossKills: number; equipmentMissedAtCapacity: number }
  lastSavedAt: number
}
```

```ts
// src/domain/state.ts
import type { GameStateV10 } from './types'

export const createInitialStateV10 = (now = Date.now()): GameStateV10 => ({
  version: 10,
  worldCurrency: { world_01: 1000 },
  contribution: {},
  heroes: {},
  careerTokens: [],
  formation: [],
  unlockedWorldIds: ['world_01'],
  clearedStageByWorld: { world_01: 0 },
  encounteredEnemyIds: [],
  factionBoards: {},
  inventory: [],
  statistics: { kills: 0, bossKills: 0, equipmentMissedAtCapacity: 0 },
  lastSavedAt: now,
})
```

```ts
// src/domain/save-v10.ts
import { createInitialStateV10 } from './state'
import type { GameStateV10 } from './types'

export const SAVE_KEY_V10 = 'egg-jianghu-2-save-v10'
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

export const loadGameV10 = (storage: StorageLike, now = Date.now()): { state: GameStateV10; recoveredFromError: boolean } => {
  const serialized = storage.getItem(SAVE_KEY_V10)
  if (!serialized) return { state: createInitialStateV10(now), recoveredFromError: false }
  try {
    const raw = JSON.parse(serialized) as Partial<GameStateV10> & { combat?: unknown }
    if (raw.version !== 10 || !Array.isArray(raw.inventory) || !Array.isArray(raw.formation)) throw new Error('invalid')
    const state = createInitialStateV10(now)
    Object.assign(state, {
      worldCurrency: structuredClone(raw.worldCurrency ?? state.worldCurrency),
      contribution: structuredClone(raw.contribution ?? state.contribution),
      heroes: structuredClone(raw.heroes ?? state.heroes),
      careerTokens: structuredClone(raw.careerTokens ?? state.careerTokens),
      formation: structuredClone(raw.formation),
      unlockedWorldIds: structuredClone(raw.unlockedWorldIds ?? state.unlockedWorldIds),
      clearedStageByWorld: structuredClone(raw.clearedStageByWorld ?? state.clearedStageByWorld),
      encounteredEnemyIds: structuredClone(raw.encounteredEnemyIds ?? state.encounteredEnemyIds),
      factionBoards: structuredClone(raw.factionBoards ?? state.factionBoards),
      inventory: structuredClone(raw.inventory),
      statistics: structuredClone(raw.statistics ?? state.statistics),
      lastSavedAt: Math.min(now, Number(raw.lastSavedAt) || now),
    })
    return { state, recoveredFromError: false }
  } catch {
    return { state: createInitialStateV10(now), recoveredFromError: true }
  }
}

export const saveGameV10 = (storage: StorageLike, state: GameStateV10, now = Date.now()): void => {
  state.lastSavedAt = now
  storage.setItem(SAVE_KEY_V10, JSON.stringify(state))
}
```

- [ ] **Step 4: 运行新档测试与全量测试**

Run: `npm test -- src/domain/save-v10.test.ts && npm test`

Expected: 新测试 PASS；现有 version 9 测试仍全部 PASS。

- [ ] **Step 5: 提交长期状态骨架**

```powershell
git add src/domain/types.ts src/domain/state.ts src/domain/save-v10.ts src/domain/save-v10.test.ts
git commit -m "✨ feat(save): 建立 version 10 独立长期存档"
```

---

### Task 2: 建立职业树、世界、势力和内容校验

**Files:**
- Create: `src/content/careers.ts`
- Create: `src/content/factions.ts`
- Create: `src/content/worlds.ts`
- Create: `src/content/validate.ts`
- Create: `src/content/validate.test.ts`

- [ ] **Step 1: 写职业与势力数量不变量测试**

```ts
import { describe, expect, it } from 'vitest'
import { CAREERS } from './careers'
import { FACTIONS } from './factions'
import { WORLDS } from './worlds'
import { validateContent } from './validate'

describe('首发内容目录', () => {
  it('包含 6 初级、12 中级、12 高级和 12 顶级职业', () => {
    expect(CAREERS.filter((career) => career.tier === '初级')).toHaveLength(6)
    expect(CAREERS.filter((career) => career.tier === '中级')).toHaveLength(12)
    expect(CAREERS.filter((career) => career.tier === '高级')).toHaveLength(12)
    expect(CAREERS.filter((career) => career.tier === '顶级')).toHaveLength(12)
  })

  it('10 卷各 3 势力且六大类各出现 5 次', () => {
    expect(WORLDS).toHaveLength(10)
    expect(WORLDS.every((world) => world.factionIds.length === 3)).toBe(true)
    for (const category of ['剑', '刀', '拳', '暗', '医', '内家']) {
      expect(FACTIONS.filter((faction) => faction.category === category)).toHaveLength(5)
    }
    expect(validateContent()).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认目录尚未建立**

Run: `npm test -- src/content/validate.test.ts`

Expected: FAIL，错误包含 `Cannot find module './careers'`。

- [ ] **Step 3: 实现职业节点与十卷势力矩阵**

```ts
// src/content/careers.ts
export type CareerTier = '初级' | '中级' | '高级' | '顶级'
export interface CareerDefinition {
  id: string
  name: string
  category: '剑' | '刀' | '拳' | '暗' | '医' | '内家'
  branch: string | null
  tier: CareerTier
  previousId: string | null
  nextId: string | null
}

const branch = (category: CareerDefinition['category'], base: string, names: [string, string, string], id: string): CareerDefinition[] => [
  { id: `${id}_mid`, name: names[0], category, branch: base, tier: '中级', previousId: id.split('_')[0], nextId: `${id}_high` },
  { id: `${id}_high`, name: names[1], category, branch: base, tier: '高级', previousId: `${id}_mid`, nextId: `${id}_top` },
  { id: `${id}_top`, name: names[2], category, branch: base, tier: '顶级', previousId: `${id}_high`, nextId: null },
]

export const CAREERS: CareerDefinition[] = [
  { id: 'sword', name: '剑客', category: '剑', branch: null, tier: '初级', previousId: null, nextId: null },
  { id: 'blade', name: '刀客', category: '刀', branch: null, tier: '初级', previousId: null, nextId: null },
  { id: 'fist', name: '拳师', category: '拳', branch: null, tier: '初级', previousId: null, nextId: null },
  { id: 'shadow', name: '暗客', category: '暗', branch: null, tier: '初级', previousId: null, nextId: null },
  { id: 'doctor', name: '医者', category: '医', branch: null, tier: '初级', previousId: null, nextId: null },
  { id: 'inner', name: '内家', category: '内家', branch: null, tier: '初级', previousId: null, nextId: null },
  ...branch('剑', '快剑', ['游剑客', '追风剑师', '无痕剑宗'], 'sword_swift'),
  ...branch('剑', '重剑', ['重剑客', '镇岳剑师', '玄铁剑宗'], 'sword_heavy'),
  ...branch('刀', '快刀', ['快刀客', '追魂刀师', '无影刀宗'], 'blade_swift'),
  ...branch('刀', '狂刀', ['狂刀客', '血战刀师', '百战刀宗'], 'blade_fury'),
  ...branch('拳', '刚拳', ['长拳师', '震山拳师', '通臂宗师'], 'fist_hard'),
  ...branch('拳', '绵掌', ['绵掌师', '化劲掌师', '化境宗师'], 'fist_soft'),
  ...branch('暗', '影刺', ['影客', '追命使', '无踪魁首'], 'shadow_assassin'),
  ...branch('暗', '毒术', ['毒手', '百毒使', '毒门魁首'], 'shadow_poison'),
  ...branch('医', '疗伤', ['仁心医士', '杏林圣手', '岐黄国手'], 'doctor_heal'),
  ...branch('医', '药理', ['调息医士', '经脉医师', '药王'], 'doctor_medicine'),
  ...branch('内家', '运气', ['运气士', '周天师', '气宗'], 'inner_flow'),
  ...branch('内家', '护体', ['护气士', '铁衣护法', '金刚宗师'], 'inner_guard'),
]
```

`factions.ts` 按以下稳定 id 逐项录入 30 个 `id/name/category/worldId/branchLabels`；`worlds.ts` 按 `worldId` 分组引用恰好三个势力，并为每卷定义独立 `currencyId` 和十个 `stageIds`：

```ts
export const FACTION_ROWS = [
  ['qingfeng_hall', '青锋馆', '剑', 'world_01', ['快剑', '重剑']],
  ['tieyi_school', '铁衣武馆', '拳', 'world_01', ['刚拳', '绵掌']],
  ['renxin_hall', '仁心堂', '医', 'world_01', ['疗伤', '药理']],
  ['duanlang_blade', '断浪刀门', '刀', 'world_02', ['快刀', '狂刀']],
  ['yexing_tower', '夜行楼', '暗', 'world_02', ['影刺', '毒术']],
  ['guiyuan_manor', '归元庄', '内家', 'world_02', ['运气', '护体']],
  ['tingyu_sword', '听雨剑庐', '剑', 'world_03', ['快剑', '重剑']],
  ['feixing_dock', '飞星坞', '暗', 'world_03', ['影刺', '毒术']],
  ['tiaoxi_court', '调息院', '内家', 'world_03', ['运气', '护体']],
  ['zhenyue_blade', '镇岳刀馆', '刀', 'world_04', ['快刀', '狂刀']],
  ['mianshan_school', '绵山武院', '拳', 'world_04', ['刚拳', '绵掌']],
  ['baicao_hall', '百草堂', '医', 'world_04', ['疗伤', '药理']],
  ['cangfeng_manor', '藏锋山庄', '剑', 'world_05', ['快剑', '重剑']],
  ['hengjiang_blade', '横江刀会', '刀', 'world_05', ['快刀', '狂刀']],
  ['xinglin_valley', '杏林谷', '医', 'world_05', ['疗伤', '药理']],
  ['zhenshan_gate', '震山门', '拳', 'world_06', ['刚拳', '绵掌']],
  ['wuteng_stockade', '乌藤寨', '暗', 'world_06', ['影刺', '毒术']],
  ['baoyuan_temple', '抱元观', '内家', 'world_06', ['运气', '护体']],
  ['wanren_court', '万仞剑庭', '剑', 'world_07', ['快剑', '重剑']],
  ['juezong_gate', '绝踪门', '暗', 'world_07', ['影刺', '毒术']],
  ['jingmai_court', '经脉院', '医', 'world_07', ['疗伤', '药理']],
  ['shuofeng_blade', '朔风刀盟', '刀', 'world_08', ['快刀', '狂刀']],
  ['huajin_hall', '化劲堂', '拳', 'world_08', ['刚拳', '绵掌']],
  ['jingang_court', '金刚院', '内家', 'world_08', ['运气', '护体']],
  ['tianxia_sword', '天下剑盟', '剑', 'world_09', ['快剑', '重剑']],
  ['tongbi_society', '通臂会', '拳', 'world_09', ['刚拳', '绵掌']],
  ['zhoutian_sect', '周天宗', '内家', 'world_09', ['运气', '护体']],
  ['baizhan_blade', '百战刀宗', '刀', 'world_10', ['快刀', '狂刀']],
  ['zhuiming_office', '追命司', '暗', 'world_10', ['影刺', '毒术']],
  ['qihuang_society', '岐黄会', '医', 'world_10', ['疗伤', '药理']],
] as const

export const RARITY_BUDGET_BY_WORLD = {
  world_01: ['粗浅', '粗浅', '粗浅', '粗浅', '粗浅', '寻常', '寻常', '寻常'],
  world_02: ['粗浅', '粗浅', '粗浅', '粗浅', '粗浅', '寻常', '寻常', '寻常'],
  world_03: ['粗浅', '粗浅', '寻常', '寻常', '寻常', '寻常', '精妙', '精妙'],
  world_04: ['粗浅', '粗浅', '寻常', '寻常', '寻常', '寻常', '精妙', '精妙'],
  world_05: ['寻常', '寻常', '精妙', '精妙', '精妙', '精妙', '上乘', '上乘'],
  world_06: ['寻常', '寻常', '精妙', '精妙', '精妙', '精妙', '上乘', '上乘'],
  world_07: ['精妙', '精妙', '上乘', '上乘', '上乘', '上乘', '绝学', '绝学'],
  world_08: ['精妙', '精妙', '上乘', '上乘', '上乘', '上乘', '绝学', '绝学'],
  world_09: ['上乘', '上乘', '绝学', '绝学', '绝学', '绝学', '绝学', '绝学'],
  world_10: ['上乘', '上乘', '绝学', '绝学', '绝学', '绝学', '绝学', '绝学'],
} as const
```

使用下面的校验函数阻止漏项进入运行时：

```ts
// src/content/validate.ts
import { CAREERS } from './careers'
import { FACTIONS } from './factions'
import { WORLDS } from './worlds'

export const validateContent = (): string[] => {
  const errors: string[] = []
  const careerIds = new Set(CAREERS.map((item) => item.id))
  const factionIds = new Set(FACTIONS.map((item) => item.id))
  if (careerIds.size !== CAREERS.length) errors.push('职业 id 重复')
  if (factionIds.size !== FACTIONS.length) errors.push('势力 id 重复')
  for (const career of CAREERS) {
    if (career.previousId && !careerIds.has(career.previousId)) errors.push(`${career.id} 前置职业不存在`)
    if (career.nextId && !careerIds.has(career.nextId)) errors.push(`${career.id} 后继职业不存在`)
  }
  for (const world of WORLDS) {
    if (world.stageIds.length !== 10) errors.push(`${world.id} 小关数不是 10`)
    if (world.factionIds.length !== 3) errors.push(`${world.id} 势力数不是 3`)
    for (const id of world.factionIds) if (!factionIds.has(id)) errors.push(`${world.id} 引用了未知势力 ${id}`)
  }
  return errors
}
```

- [ ] **Step 4: 运行内容校验与 TypeScript build**

Run: `npm test -- src/content/validate.test.ts && npm run build`

Expected: 测试 PASS；`tsc` 无重复 id、断裂职业边或未知势力引用。

- [ ] **Step 5: 提交内容骨架**

```powershell
git add src/content/careers.ts src/content/factions.ts src/content/worlds.ts src/content/validate.ts src/content/validate.test.ts
git commit -m "✨ feat(content): 建立职业树与十卷三十势力目录"
```

---

### Task 3: 实现职业经验、转职与圆满心得

**Files:**
- Create: `src/domain/careers.ts`
- Create: `src/domain/careers.test.ts`
- Modify: `src/domain/state.ts`

- [ ] **Step 1: 写职业等级独立、Lv.10 转职和 Lv.20 圆满测试**

```ts
import { describe, expect, it } from 'vitest'
import { addCareerExperience, changeCareer, perfectCareer } from './careers'
import { createHeroProgress } from './state'

describe('职业修习', () => {
  it('职业等级不修改侠客等级且只有当前职业获得经验', () => {
    const hero = createHeroProgress('sword')
    addCareerExperience(hero, 1900)
    expect(hero.level).toBe(1)
    expect(hero.careers.sword.level).toBeGreaterThan(1)
    expect(Object.keys(hero.careers)).toEqual(['sword'])
  })

  it('Lv.10 可转职，Lv.20 可领取一次圆满心得', () => {
    const hero = createHeroProgress('sword')
    hero.careers.sword.level = 10
    const tokens = ['token_sword_swift_mid']
    expect(changeCareer(hero, 'sword_swift_mid', tokens).ok).toBe(true)
    expect(tokens).toEqual([])
    expect(hero.careers.sword_swift_mid.level).toBe(1)
    hero.currentCareerId = 'sword'
    hero.careers.sword.level = 20
    expect(perfectCareer(hero, 'sword').ok).toBe(true)
    expect(perfectCareer(hero, 'sword').ok).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认职业领域函数不存在**

Run: `npm test -- src/domain/careers.test.ts`

Expected: FAIL，错误包含 `addCareerExperience is not exported`。

- [ ] **Step 3: 实现固定 Lv.20 上限和转职守卫**

```ts
export const CAREER_MAX_LEVEL = 20
export const CAREER_TRANSFER_LEVEL = 10
export const careerExperienceForNextLevel = (level: number): number => 100 + level * level * 20

export const addCareerExperience = (hero: HeroProgressV10, gained: number): void => {
  const record = hero.careers[hero.currentCareerId]
  record.experience += Math.max(0, Math.floor(gained))
  while (record.level < CAREER_MAX_LEVEL) {
    const required = careerExperienceForNextLevel(record.level)
    if (record.experience < required) break
    record.experience -= required
    record.level += 1
  }
  if (record.level === CAREER_MAX_LEVEL) record.experience = 0
}

export const changeCareer = (hero: HeroProgressV10, targetId: string, ownedTokens: string[]): ActionResult => {
  const target = CAREERS.find((item) => item.id === targetId)
  if (!target) return { ok: false, message: '职业不存在' }
  if (hero.careers[targetId]) { hero.currentCareerId = targetId; return { ok: true, message: '已切换职业' } }
  const previous = target.previousId && hero.careers[target.previousId]
  if (!previous || previous.level < CAREER_TRANSFER_LEVEL) return { ok: false, message: '前置职业未达到 Lv.10' }
  const tokenId = `token_${targetId}`
  const tokenIndex = ownedTokens.indexOf(tokenId)
  if (tokenIndex < 0) return { ok: false, message: '缺少转职信物' }
  ownedTokens.splice(tokenIndex, 1)
  hero.careers[targetId] = { level: 1, experience: 0, perfected: false }
  hero.currentCareerId = targetId
  return { ok: true, message: '转职成功' }
}
```

- [ ] **Step 4: 运行职业测试和全量测试**

Run: `npm test -- src/domain/careers.test.ts && npm test`

Expected: 所有测试 PASS；同一侠客切回旧职业可恢复原等级。

- [ ] **Step 5: 提交职业成长**

```powershell
git add src/domain/state.ts src/domain/careers.ts src/domain/careers.test.ts
git commit -m "✨ feat(career): 实现独立职业等级与四阶转职"
```

---

### Task 4: 实现直接邀请、双线武功学习与 80% 遗忘

**Files:**
- Create: `src/content/heroes.ts`
- Create: `src/content/martials.ts`
- Create: `src/domain/recruitment.ts`
- Create: `src/domain/martial-training.ts`
- Create: `src/domain/martial-training.test.ts`

- [ ] **Step 1: 写非抽卡邀请和武功前置测试**

```ts
it('从明确名单直接邀请侠客，不返回随机结果', () => {
  const state = seededState({ world_01: 500 })
  const result = recruitFromTavern(state, 'hero_qingshan')
  expect(result).toEqual({ ok: true, heroId: 'hero_qingshan', spent: 300 })
  expect(state.heroes.hero_qingshan.recruited).toBe(true)
  expect(state.worldCurrency.world_01).toBe(200)
})

it('A1 Lv.20 只解锁同线 B1，遗忘返还分账投入的 80%', () => {
  const state = seededState({ world_01: 1000 }, { faction_qingfeng: 1000 })
  const hero = state.heroes.hero_qingshan
  expect(learnFactionMartial(state, 'hero_qingshan', 'qingfeng_b1').ok).toBe(false)
  hero.learnedMartials.qingfeng_a1 = learnedAt(20, { contribution: { faction_qingfeng: 500 }, worldCurrency: {} })
  expect(learnFactionMartial(state, 'hero_qingshan', 'qingfeng_b1').ok).toBe(true)
  expect(learnFactionMartial(state, 'hero_qingshan', 'qingfeng_b2').ok).toBe(false)
  const refund = forgetMartial(state, 'hero_qingshan', 'qingfeng_a1')
  expect(refund.refundedContribution.faction_qingfeng).toBe(400)
})

it('每名侠客只能主修一门心法且不占四个主动槽', () => {
  const state = seededState({ world_01: 1000 }, { faction_qingfeng: 1000 })
  expect(equipHeartMethod(state, 'hero_qingshan', 'qingfeng_heart_01').ok).toBe(true)
  expect(state.heroes.hero_qingshan.heartMethodId).toBe('qingfeng_heart_01')
  expect(state.heroes.hero_qingshan.equippedMartialIds).toEqual([null, null, null, null])
})
```

- [ ] **Step 2: 运行测试确认邀请与修习模块缺失**

Run: `npm test -- src/domain/martial-training.test.ts`

Expected: FAIL，错误包含 `recruitFromTavern is not exported`。

- [ ] **Step 3: 实现固定名单、240 门势力武功生成和个人账本**

`src/content/heroes.ts` 为每名侠客固定定义 `grade` 与 `aptitudes: { strength; insight; constitution; agility; resolve }`，运行时没有升品字段。`src/content/martials.ts` 使用每势力两条线路和四个阶段生成 8 门主动武功；id 必须稳定为 `<factionId>_a1/b1/c1/d1/a2/b2/c2/d2`，显示名由势力名、分支名与 `初传/进境/真传/秘传` 组成。每门定义必须包含 `rarity/category/damageRoute/force/energyCost/cooldownMs/power/previousId/currencySource`。势力和城市另行定义心法条目，心法只提供行气、气机、回气、武学势与保命修正，不进入主动槽。稀有度按设计规格第 17.1 节预算分配并由测试统计。

第一卷酒馆提供六名明确可选侠客，开局 1000 枚本卷货币足以直接邀请至少三人；后续每势力提供一名贡献侠客。首批酒馆行使用下列稳定数据，势力侠客由 `FACTIONS` 生成 `id: hero_<factionId>`、`name: <factionName>传人`、对应基础职业，贡献费用为 `600 + worldIndex * 200`：

```ts
export const TAVERN_HERO_ROWS = [
  ['hero_shen_yanqiu', '沈砚秋', '乙', 'sword', 280, [10, 7, 8, 11, 7]],
  ['hero_huo_chuan', '霍川', '乙', 'blade', 280, [11, 6, 10, 8, 8]],
  ['hero_yue_jinghong', '岳惊鸿', '乙', 'fist', 260, [10, 7, 11, 7, 8]],
  ['hero_pei_wuying', '裴无影', '乙', 'shadow', 300, [8, 8, 7, 12, 8]],
  ['hero_su_wenlan', '苏问岚', '乙', 'doctor', 260, [6, 12, 8, 8, 10]],
  ['hero_lu_guiyuan', '陆归元', '乙', 'inner', 300, [7, 11, 9, 7, 11]],
] as const
```

```ts
export const canLearnMartial = (hero: HeroProgressV10, martial: MartialDefinitionV10): ActionResult => {
  if (hero.learnedMartials[martial.id]) return { ok: false, message: '已经学会该武功' }
  if (Object.keys(hero.learnedMartials).length >= 20) return { ok: false, message: '最多学习 20 门武功' }
  if (!martial.careerIds.includes(hero.currentCareerId)) return { ok: false, message: '当前职业不符' }
  if (martial.previousId && hero.learnedMartials[martial.previousId]?.level !== 20) {
    return { ok: false, message: '同线前置武功必须达到 Lv.20' }
  }
  return { ok: true, message: '可以学习' }
}

export const refundLedger = (ledger: InvestmentLedger): InvestmentLedger => ({
  worldCurrency: Object.fromEntries(Object.entries(ledger.worldCurrency).map(([id, value]) => [id, Math.floor(value * 0.8)])),
  contribution: Object.fromEntries(Object.entries(ledger.contribution).map(([id, value]) => [id, Math.floor(value * 0.8)])),
})
```

- [ ] **Step 4: 校验 30 势力 × 8 武功、四槽和退款**

Run: `npm test -- src/content/validate.test.ts src/domain/martial-training.test.ts`

Expected: PASS；势力武功总数恰好 240；A1/B1/C1/D1 与 A2/B2/C2/D2 不串线；第 21 门被拒绝。

- [ ] **Step 5: 提交邀请与修习领域**

```powershell
git add src/content/heroes.ts src/content/martials.ts src/domain/recruitment.ts src/domain/martial-training.ts src/domain/martial-training.test.ts src/content/validate.test.ts
git commit -m "✨ feat(training): 实现直接邀请与双线武功修习"
```

---

### Task 5: 建立确定性 PRNG、气机时间轴和实时状态

**Files:**
- Create: `src/combat/types.ts`
- Create: `src/combat/rng.ts`
- Create: `src/combat/timeline.ts`
- Create: `src/combat/statuses.ts`
- Create: `src/combat/timeline.test.ts`

- [ ] **Step 1: 写 100ms tick、平方根行动间隔和速度倍率一致性测试**

```ts
it('身法 100 的行动间隔为 5 秒', () => {
  expect(actionIntervalMs(100)).toBe(5000)
})

it('1×、2×、4×执行相同模拟毫秒会得到相同事件', () => {
  const one = simulateTicks(createFixture(42), 100, 1)
  const two = simulateTicks(createFixture(42), 50, 2)
  const four = simulateTicks(createFixture(42), 25, 4)
  expect(two.events).toEqual(one.events)
  expect(four.events).toEqual(one.events)
})

it('回气与状态按战斗毫秒减少，不依赖行动次数', () => {
  const unit = fixtureUnit({ cooldowns: { skill_a: 3000 }, statuses: [{ id: 'slow', remainingMs: 2500, mode: 'refresh', stacks: 1, value: 0.2 }] })
  advanceUnitTime(unit, 1000)
  expect(unit.cooldowns.skill_a).toBe(2000)
  expect(unit.statuses[0].remainingMs).toBe(1500)
})
```

- [ ] **Step 2: 运行测试确认战斗时间轴缺失**

Run: `npm test -- src/combat/timeline.test.ts`

Expected: FAIL，错误包含 `actionIntervalMs is not defined`。

- [ ] **Step 3: 实现无浮动步长的时间轴**

```ts
// src/combat/types.ts
export interface CombatStatus {
  id: string
  remainingMs: number
  mode: 'refresh' | 'strongest' | 'stack' | 'independent'
  stacks: number
  value: number
  sourceId?: string
}
export interface CombatUnit {
  id: string
  side: 'party' | 'enemy'
  row: 'front' | 'back'
  position: 0 | 1 | 2
  formationOrder: number
  alive: boolean
  hp: number
  maxHp: number
  energy: number
  gauge: number
  effectiveAgility: number
  cooldowns: Record<string, number>
  statuses: CombatStatus[]
  momentum: Record<string, number>
}
export interface CombatSnapshot {
  seed: number
  worldId: string
  stage: number
  wave: number
  elapsedMs: number
  result: 'fighting' | 'victory' | 'defeat' | 'stopped'
  party: CombatUnit[]
  enemies: CombatUnit[]
  summons: Array<CombatUnit & { remainingMs: number }>
}
export type CombatEvent =
  | { type: 'damage' | 'healing'; atMs: number; sourceId: string; targetId: string; amount: number }
  | { type: 'status-applied'; atMs: number; sourceId: string; targetId: string; status: CombatStatus }
  | { type: 'enemy-defeated'; atMs: number; enemyId: string; rank: 'normal' | 'elite' | 'boss'; worldId: string; stage: number; seed: number }
  | { type: 'wave-started'; atMs: number; wave: number }
  | { type: 'stage-cleared' | 'party-defeated' | 'combat-stopped'; atMs: number }
export interface StageSelectionInput { worldId: string; stage: number; mode: 'guard' | 'roam'; seed: number }
export interface CombatStartInput extends StageSelectionInput { party: CombatUnit[] }

// src/combat/timeline.ts
export const COMBAT_TICK_MS = 100
export const actionIntervalMs = (agility: number): number => Math.round(50_000 / Math.sqrt(Math.max(1, agility)))

export const advanceUnitTime = (unit: CombatUnit, elapsedMs = COMBAT_TICK_MS): void => {
  unit.gauge += elapsedMs / actionIntervalMs(unit.effectiveAgility) * 1000
  for (const id of Object.keys(unit.cooldowns)) unit.cooldowns[id] = Math.max(0, unit.cooldowns[id] - elapsedMs)
  for (const status of unit.statuses) status.remainingMs = Math.max(0, status.remainingMs - elapsedMs)
  unit.statuses = unit.statuses.filter((status) => status.remainingMs > 0)
}

export const readyOrder = (units: CombatUnit[]): CombatUnit[] => units
  .filter((unit) => unit.alive && unit.gauge >= 1000)
  .sort((left, right) => (right.gauge - left.gauge) || (right.effectiveAgility - left.effectiveAgility) || (left.formationOrder - right.formationOrder))
```

PRNG 使用 32 位 `mulberry32`，`nextFloat()` 仅返回 `[0,1)`；所有命中、会心、掉落、词条和任务刷新只能消费同一个显式 seed 派生序列。

`statuses.ts` 为每个状态显式定义 `refresh/strongest/stack/independent` 模式；持续伤害每 1000 战斗毫秒结算。Boss 通过 `controlResistance` 降低控制命中，连续同类控制通过 `controlDiminishing` 递减持续时间，但不得把所有控制设为完全免疫。

- [ ] **Step 4: 运行时间轴测试 100 次确认稳定**

Run: `1..100 | ForEach-Object { npm test -- src/combat/timeline.test.ts --silent; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`

Expected: 100 次全部 PASS，无依赖系统时间的偶发失败。

- [ ] **Step 5: 提交战斗时间基座**

```powershell
git add src/combat/types.ts src/combat/rng.ts src/combat/timeline.ts src/combat/statuses.ts src/combat/timeline.test.ts
git commit -m "✨ feat(combat): 建立确定性气机与实时回气时间轴"
```

---

### Task 6: 实现两排目标、四槽行招和伤害乘区

**Files:**
- Create: `src/combat/targeting.ts`
- Create: `src/combat/stats.ts`
- Create: `src/combat/damage.ts`
- Create: `src/combat/skill-ai.ts`
- Create: `src/combat/skill-ai.test.ts`
- Create: `src/combat/damage.test.ts`

- [ ] **Step 1: 写前排保护、技能跳过和伤害公式测试**

```ts
it('前排存活时普通近战不能选择后排', () => {
  const party = fixtureParty(['front:0:alive', 'back:0:alive'])
  expect(selectTargets(party, { shape: 'single', reach: 'melee' }).map((unit) => unit.row)).toEqual(['front'])
})

it('四槽每次行动从第一式检查并跳过非法条件', () => {
  const actor = fixtureActor({ energy: 30, slots: ['heal', 'expensive', 'strike', null] })
  const result = selectSkill(actor, fixtureAlliesAtFullHealth(), fixtureEnemies())
  expect(result).toEqual({ skillId: 'strike', skipped: [{ skillId: 'heal', reason: '没有受伤目标' }, { skillId: 'expensive', reason: '真气不足' }] })
})

it('使用 A²/(A+D) 并按层乘算', () => {
  expect(calculateDamage({ attack: 100, defense: 100, power: 2, additive: 0.5, critical: 1, momentum: 0, reduction: 0, vulnerability: 0, final: 0 })).toBe(150)
})

it('五维资质决定成长，圆满心得只进入统一加法池', () => {
  const stats = buildCombatStats(fixtureHeroDefinition({ strength: 12, insight: 6, constitution: 10, agility: 8, resolve: 7 }), fixtureProgressWithPerfected(['sword', 'sword_swift_mid']))
  expect(stats.externalAttack).toBeGreaterThan(stats.internalAttack)
  expect(stats.perfectedBonusPool).toBeCloseTo(0.1)
})
```

- [ ] **Step 2: 运行测试确认三组纯规则模块缺失**

Run: `npm test -- src/combat/skill-ai.test.ts src/combat/damage.test.ts`

Expected: FAIL，错误包含 `selectSkill is not exported`。

- [ ] **Step 3: 实现目标过滤、条件解释和伤害钳制**

```ts
export const calculateDamage = (input: DamageInput): number => {
  const attack = Math.max(1, input.attack)
  const defense = Math.max(0, input.defense)
  const core = attack * attack / (attack + defense)
  return Math.max(1, Math.floor(
    core * input.power * (1 + input.additive) * input.critical
      * (1 + input.momentum) * (1 - input.reduction)
      * (1 + input.vulnerability) * (1 + input.final),
  ))
}

export const hitChance = (accuracyDelta: number): number => Math.min(1, Math.max(0.3, 0.97 + accuracyDelta))
export const evadeChance = (evade: number): number => Math.min(0.7, Math.max(0, evade))
```

`selectSkill()` 必须按槽位 0→3 检查职业标签、真气、回气、武学势、合法目标和语义条件；都不可用时返回零耗职业基础招式。每个被跳过槽位写入中文 `reason`，供战斗日志和 UI 解释。

`buildCombatStats()` 按侠客等级和膂力/悟性/根骨/身法/定力生成外功、内功、气血、外防、内防、有效身法、命中、闪避与控制抵抗，再叠加当前职业系数、心法、装备和圆满心得。所有圆满心得汇总到单一 `perfectedBonusPool`，禁止逐职业相乘。

- [ ] **Step 4: 运行规则测试并覆盖命中上下限**

Run: `npm test -- src/combat/skill-ai.test.ts src/combat/damage.test.ts`

Expected: PASS；命中率钳制 30%～100%，闪避率不超过 70%。

- [ ] **Step 5: 提交战斗决策规则**

```powershell
git add src/combat/targeting.ts src/combat/stats.ts src/combat/damage.ts src/combat/skill-ai.ts src/combat/skill-ai.test.ts src/combat/damage.test.ts
git commit -m "✨ feat(combat): 实现两排目标与四槽行招结算"
```

---

### Task 7: 实现十波战斗、状态继承和失败回退

**Files:**
- Create: `src/combat/waves.ts`
- Create: `src/combat/engine.ts`
- Create: `src/combat/engine.test.ts`
- Create: `src/domain/progression.ts`
- Create: `src/domain/progression.test.ts`

- [ ] **Step 1: 写每小关第十波 Boss 组合与状态继承测试**

```ts
it('每个小关的第十波都含 Boss、精英和小怪', () => {
  for (let stage = 1; stage <= 10; stage += 1) {
    const wave = createWave('world_01', stage, 10, 1000 + stage)
    expect(wave.enemies.some((enemy) => enemy.rank === 'boss')).toBe(true)
    expect(wave.enemies.some((enemy) => enemy.rank === 'elite')).toBe(true)
    expect(wave.enemies.some((enemy) => enemy.rank === 'normal')).toBe(true)
  }
})

it('换波继承气血、阵亡、真气、气机、回气、状态和武学势', () => {
  const combat = fixtureAtWaveEnd({ wave: 3, hp: 71, energy: 42, gauge: 600, cooldown: 2800, statusMs: 4300, momentum: 3 })
  advanceToNextWave(combat)
  expect(snapshotMember(combat.party[0])).toEqual({ hp: 71, alive: true, energy: 42, gauge: 600, cooldown: 2800, statusMs: 4300, momentum: 3 })
})

it('波次过场暂停战斗计时并继承召唤物', () => {
  const combat = fixtureAtWaveEnd({ wave: 4, summonRemainingMs: 5000, statusMs: 4300 })
  advanceToNextWave(combat)
  expect(combat.summons[0].remainingMs).toBe(5000)
  expect(combat.party[0].statuses[0].remainingMs).toBe(4300)
})

it('闯荡失败切驻守并按规则回退', () => {
  expect(resolveDefeat({ worldId: 'world_01', stage: 6, mode: 'roam' })).toEqual({ worldId: 'world_01', stage: 5, mode: 'guard' })
  expect(resolveDefeat({ worldId: 'world_01', stage: 1, mode: 'roam' })).toEqual({ worldId: 'world_01', stage: 1, mode: 'guard' })
})
```

- [ ] **Step 2: 运行测试确认波次引擎不存在**

Run: `npm test -- src/combat/engine.test.ts src/domain/progression.test.ts`

Expected: FAIL，错误包含 `createWave is not exported`。

- [ ] **Step 3: 实现纯引擎入口与换波状态机**

```ts
export interface CombatEngine {
  readonly state: CombatSnapshot
  tick(count?: number): CombatEvent[]
  stop(): CombatEvent[]
}

export const createCombatEngine = (input: CombatStartInput): CombatEngine => {
  const state = createCombatSnapshot(input)
  return {
    state,
    tick(count = 1) {
      const events: CombatEvent[] = []
      for (let index = 0; index < count && state.result === 'fighting'; index += 1) {
        events.push(...tickOnce(state))
      }
      return events
    },
    stop() { state.result = 'stopped'; return [{ type: 'combat-stopped', atMs: state.elapsedMs }] },
  }
}
```

`tickOnce()` 每 100ms 依次执行：推进时间 → 按溢出/身法/站位处理满气机单位 → 产生伤害/治疗/状态/死亡事件 → 全灭敌群后换波 → 第十波全灭后产生 `stage-cleared`。换波函数不得重建侠客临时状态；重新驻守、推进新关或失败重开必须由新 `CombatStartInput` 创建全新战斗。

- [ ] **Step 4: 运行十波确定性竖切测试**

Run: `npm test -- src/combat/engine.test.ts src/domain/progression.test.ts`

Expected: PASS；同 seed 的事件序列完全一致；只杀 Boss 未清理其余敌人时不能通关。

- [ ] **Step 5: 提交十波引擎**

```powershell
git add src/combat/waves.ts src/combat/engine.ts src/combat/engine.test.ts src/domain/progression.ts src/domain/progression.test.ts
git commit -m "✨ feat(combat): 实现十波小关与驻守闯荡回退"
```

---

### Task 8: 实现随机装备、即时入包和 300 格上限

**Files:**
- Create: `src/content/equipment.ts`
- Create: `src/domain/inventory.ts`
- Create: `src/domain/inventory.test.ts`
- Create: `src/domain/rewards.ts`
- Create: `src/domain/rewards.test.ts`
- Modify: `src/combat/engine.ts`

- [ ] **Step 1: 写敌人死亡即时入包与满仓拒绝测试**

```ts
it('敌人死亡事件立即生成装备实例，不等待波次结束', () => {
  const state = stateWithInventory(0)
  const event = enemyDefeatedEvent({ enemyId: 'bandit_01', rank: 'elite', worldId: 'world_01', stage: 3, seed: 7 })
  const result = settleCombatEvent(state, event)
  expect(result.addedEquipmentUids.length).toBeGreaterThan(0)
  expect(state.inventory).toHaveLength(result.addedEquipmentUids.length)
})

it('第 301 件被拒绝但战斗继续', () => {
  const state = stateWithInventory(300)
  const result = addEquipment(state, fixtureEquipment('uid_301'))
  expect(result).toEqual({ ok: false, reason: 'inventory-full' })
  expect(state.inventory).toHaveLength(300)
  expect(state.statistics.equipmentMissedAtCapacity).toBe(1)
})
```

- [ ] **Step 2: 运行测试确认装备领域缺失**

Run: `npm test -- src/domain/inventory.test.ts src/domain/rewards.test.ts`

Expected: FAIL，错误包含 `addEquipment is not exported`。

- [ ] **Step 3: 实现七部位、五品质与即时结算**

```ts
export const INVENTORY_CAPACITY = 300
export const EQUIPMENT_SLOTS = ['weapon', 'head', 'armor', 'wrist', 'waist', 'boots', 'token'] as const
export const EQUIPMENT_QUALITIES = ['凡品', '良品', '上品', '珍品', '绝品'] as const

export const addEquipment = (state: GameStateV10, equipment: EquipmentInstance): { ok: true } | { ok: false; reason: 'inventory-full' } => {
  if (state.inventory.length >= INVENTORY_CAPACITY) {
    state.statistics.equipmentMissedAtCapacity += 1
    return { ok: false, reason: 'inventory-full' }
  }
  if (state.inventory.some((item) => item.uid === equipment.uid)) throw new Error(`重复装备 uid: ${equipment.uid}`)
  state.inventory.push(equipment)
  return { ok: true }
}
```

`settleCombatEvent()` 只接受战斗事件并更新长期状态；死亡事件依 rank 调整随机装备数量/品质权重，禁止按 enemyId 产出固定专属装备。每次长期变更返回 `needsSave: true`，由 `GameSession` 立即保存。

- [ ] **Step 4: 运行掉落与背包边界测试**

Run: `npm test -- src/domain/inventory.test.ts src/domain/rewards.test.ts src/combat/engine.test.ts`

Expected: PASS；失败或停止战斗不会回收已经写入背包的装备。

- [ ] **Step 5: 提交装备掉落循环**

```powershell
git add src/content/equipment.ts src/domain/inventory.ts src/domain/inventory.test.ts src/domain/rewards.ts src/domain/rewards.test.ts src/combat/engine.ts
git commit -m "✨ feat(loot): 实现即时随机装备与固定背包上限"
```

---

### Task 9: 实现势力六格悬榜与运行时刷新

**Files:**
- Create: `src/domain/quests.ts`
- Create: `src/domain/quests.test.ts`
- Modify: `src/domain/rewards.ts`
- Modify: `src/domain/state.ts`

- [ ] **Step 1: 写六格、十任务上限与 60 分钟刷新测试**

```ts
it('未接受任务在 60 分钟运行时间后刷新，已接任务锁位', () => {
  const board = fixtureBoardWithSixSlots()
  board.slots[0]!.accepted = true
  const acceptedId = board.slots[0]!.id
  advanceQuestBoards(boardState(board), 3_600_000, seededRng(9))
  expect(board.slots[0]!.id).toBe(acceptedId)
  expect(board.slots.slice(1).every((slot) => slot!.generatedAt === 3_600_000)).toBe(true)
})

it('同一势力六格都已接时刷新不产生新任务', () => {
  const board = fixtureBoardWithSixAcceptedSlots()
  const ids = board.slots.map((slot) => slot!.id)
  advanceQuestBoards(boardState(board), 7_200_000, seededRng(9))
  expect(board.slots.map((slot) => slot!.id)).toEqual(ids)
})

it('全局最多接受十个任务且同一击杀可推进多个匹配任务', () => {
  const state = stateWithAcceptedQuests(10)
  expect(acceptQuest(state, 'faction_qingfeng', 0).ok).toBe(false)
  const matching = stateWithMatchingAcceptedQuests(2, 'bandit_01')
  applyKillToQuests(matching, { enemyId: 'bandit_01', rank: 'normal', bossId: null })
  expect(acceptedProgress(matching)).toEqual([1, 1])
})
```

- [ ] **Step 2: 运行测试确认悬榜领域缺失**

Run: `npm test -- src/domain/quests.test.ts`

Expected: FAIL，错误包含 `advanceQuestBoards is not exported`。

- [ ] **Step 3: 实现品级数量和只计运行时间的刷新器**

```ts
export const QUEST_REFRESH_MS = 3_600_000
export const MAX_ACCEPTED_QUESTS = 10
export const QUEST_COUNTS = {
  丙: { normal: 5, boss: 1 },
  乙: { normal: 20, boss: 2 },
  甲: { normal: 50, boss: 4 },
  地: { normal: 100, boss: 8 },
  天: { normal: 160, boss: 16 },
} as const
export const QUEST_GRADE_WEIGHTS = { 丙: 40, 乙: 30, 甲: 18, 地: 9, 天: 3 } as const

export const advanceQuestBoards = (state: GameStateV10, elapsedRuntimeMs: number, rng: Rng): void => {
  for (const [factionId, board] of Object.entries(state.factionBoards)) {
    board.refreshRemainingMs -= Math.max(0, elapsedRuntimeMs)
    while (board.refreshRemainingMs <= 0) {
      board.slots = board.slots.map((slot, index) => slot?.accepted ? slot : generateQuest(state, factionId, index, rng))
      board.refreshRemainingMs += QUEST_REFRESH_MS
    }
  }
}
```

讨伐任务贡献必须为同品级除恶任务的 1.4 倍并向下取整；任务目标只能从当前世界已解锁且已遭遇的敌人/Boss 中抽取。完成未领取仍占槽，领取后释放槽，取消任务清空进度且等下次刷新。

- [ ] **Step 4: 运行悬榜测试与关闭期间不推进测试**

Run: `npm test -- src/domain/quests.test.ts src/domain/save-v10.test.ts`

Expected: PASS；仅显式调用 `advanceQuestBoards(runtimeMs)` 才减少倒计时，load 不根据 `lastSavedAt` 补算。

- [ ] **Step 5: 提交势力任务**

```powershell
git add src/domain/quests.ts src/domain/quests.test.ts src/domain/rewards.ts src/domain/state.ts
git commit -m "✨ feat(quest): 实现势力六格悬榜与运行时刷新"
```

---

### Task 10: 用 GameSession 串联战斗、即时保存和重启边界

**Files:**
- Create: `src/app/game-session.ts`
- Create: `src/app/game-session.test.ts`
- Modify: `src/domain/save-v10.ts`

- [ ] **Step 1: 写重启后必须重新选关的会话测试**

```ts
it('保存长期收益但不保存进行中的战斗', () => {
  const storage = memoryStorage()
  const session = GameSession.create(storage, 1000)
  session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 11 })
  session.advanceTicks(5000)
  const earned = structuredClone(session.state.worldCurrency)
  const reopened = GameSession.create(storage, 2000)
  expect(reopened.combat).toBeNull()
  expect(reopened.state.worldCurrency).toEqual(earned)
})

it('闯荡失败自动切驻守并重新创建回退关卡', () => {
  const session = losingSessionAtStage(4, 'roam')
  session.advanceUntilSettled()
  expect(session.selection).toEqual({ worldId: 'world_01', stage: 3, mode: 'guard' })
  expect(session.combat?.state.wave).toBe(1)
})
```

- [ ] **Step 2: 运行测试确认会话协调器缺失**

Run: `npm test -- src/app/game-session.test.ts`

Expected: FAIL，错误包含 `GameSession is not exported`。

- [ ] **Step 3: 实现唯一可变协调边界**

```ts
export class GameSession {
  combat: CombatEngine | null = null
  selection: { worldId: string; stage: number; mode: CampaignMode } | null = null
  private readonly runtimeRng: Rng

  private constructor(public state: GameStateV10, private readonly storage: StorageLike) {
    this.runtimeRng = createRng(state.lastSavedAt)
  }

  static create(storage: StorageLike, now = Date.now()): GameSession {
    return new GameSession(loadGameV10(storage, now).state, storage)
  }

  startStage(input: StageSelectionInput): void {
    this.selection = { worldId: input.worldId, stage: input.stage, mode: input.mode }
    this.combat = createCombatEngine(buildCombatStartInput(this.state, input))
  }

  advanceTicks(count: number): CombatEvent[] {
    if (!this.combat) return []
    const events = this.combat.tick(count)
    let changed = false
    for (const event of events) changed = settleCombatEvent(this.state, event).needsSave || changed
    if (changed) saveGameV10(this.storage, this.state)
    this.handleResult()
    return events
  }

  advanceRuntime(elapsedMs: number): void {
    const before = JSON.stringify(this.state.factionBoards)
    advanceQuestBoards(this.state, elapsedMs, this.runtimeRng)
    if (JSON.stringify(this.state.factionBoards) !== before) saveGameV10(this.storage, this.state)
  }

  stopCombat(): void { this.combat = null; this.selection = null }
}
```

`handleResult()` 必须分别处理驻守通关重开本关、闯荡通关推进下一关/世界、闯荡失败切驻守并回退、第一关失败重开第一关。击败每卷第十关第十波全部敌人时解锁下一卷。

- [ ] **Step 4: 运行领域竖切和全量单元测试**

Run: `npm test -- src/app/game-session.test.ts && npm test && npm run build`

Expected: 全部 PASS；现有页面仍可由旧入口构建，新会话尚未接管 UI。

- [ ] **Step 5: 提交会话协调器**

```powershell
git add src/app/game-session.ts src/app/game-session.test.ts src/domain/save-v10.ts
git commit -m "✨ feat(app): 串联长期状态与非持久战斗会话"
```

---

### Task 11: 实现城市、势力、职业和装备领域操作

**Files:**
- Create: `src/domain/city.ts`
- Create: `src/domain/city.test.ts`
- Modify: `src/domain/inventory.ts`
- Modify: `src/domain/martial-training.ts`
- Modify: `src/domain/careers.ts`

- [ ] **Step 1: 写武馆学习、势力邀请和高阶信物世界限制测试**

```ts
it('城市武馆消耗当前卷货币学习当地通用武功', () => {
  const state = seededState({ world_03: 600 })
  const result = learnCityMartial(state, 'hero_qingshan', 'world_03_common_sword_01')
  expect(result.ok).toBe(true)
  expect(state.worldCurrency.world_03).toBe(300)
})

it('势力侠客消耗贡献直接邀请', () => {
  const state = seededState({}, { faction_qingfeng: 800 })
  expect(recruitFromFaction(state, 'faction_qingfeng', 'hero_qingfeng_master').ok).toBe(true)
  expect(state.contribution.faction_qingfeng).toBe(0)
})

it('顶级转职信物只在配置的更高世界出售', () => {
  const state = unlockedThrough('world_03')
  expect(buyCareerToken(state, 'world_03', 'token_sword_swift_top').ok).toBe(false)
  state.unlockedWorldIds.push('world_07')
  expect(buyCareerToken(state, 'world_07', 'token_sword_swift_top').ok).toBe(true)
})
```

- [ ] **Step 2: 运行测试确认城市领域缺失**

Run: `npm test -- src/domain/city.test.ts`

Expected: FAIL，错误包含 `learnCityMartial is not exported`。

- [ ] **Step 3: 实现资源扣减事务和装备穿戴守卫**

所有购买函数先完整校验再一次性扣款，失败不得留下部分变更。装备穿戴必须校验 uid 存在、部位匹配、未被其他侠客穿戴；锁定只禁止未来加工/丢弃，不禁止穿戴。当前版本不新增出售、强化、拆解入口。

```ts
export const spend = (wallet: Record<string, number>, id: string, amount: number): ActionResult => {
  const cost = Math.max(0, Math.floor(amount))
  if ((wallet[id] ?? 0) < cost) return { ok: false, message: '资源不足' }
  wallet[id] -= cost
  return { ok: true, message: '支付成功' }
}
```

- [ ] **Step 4: 运行城市与全部领域测试**

Run: `npm test -- src/domain/city.test.ts src/domain/inventory.test.ts src/domain/martial-training.test.ts src/domain/careers.test.ts`

Expected: PASS；失败交易前后状态深度相等。

- [ ] **Step 5: 提交长期操作闭环**

```powershell
git add src/domain/city.ts src/domain/city.test.ts src/domain/inventory.ts src/domain/martial-training.ts src/domain/careers.ts
git commit -m "✨ feat(domain): 完成城市势力与装备操作闭环"
```

---

### Task 12: 切换入口并实现江湖卷、十波战斗与导航页面

**Files:**
- Create: `src/ui/shell.ts`
- Create: `src/ui/idle-page.ts`
- Create: `src/ui/idle-page.test.ts`
- Modify: `src/main.ts:59-66, 814-1056, 1082-1122`
- Modify: `src/style.css:1-893`

- [ ] **Step 1: 写页面必须显示的关卡与战斗信息测试**

```ts
it('关卡页显示驻守/闯荡且不出现叩关和首次奖励', () => {
  const html = renderIdlePage(fixtureViewModel({ combat: null }))
  expect(html).toContain('驻守')
  expect(html).toContain('闯荡')
  expect(html).not.toContain('叩关')
  expect(html).not.toContain('首次通关')
})

it('战斗页显示波次、六侠两排、气机、真气、回气与满仓警告', () => {
  const html = renderIdlePage(fixtureViewModel({ wave: 10, inventoryFull: true }))
  expect(html).toContain('第 10 / 10 波')
  expect(html.match(/data-formation-slot=/g)).toHaveLength(6)
  expect(html).toContain('气机')
  expect(html).toContain('真气')
  expect(html).toContain('回气')
  expect(html).toContain('背包已满')
})
```

- [ ] **Step 2: 运行 UI 纯渲染测试确认新页面缺失**

Run: `npm test -- src/ui/idle-page.test.ts`

Expected: FAIL，错误包含 `renderIdlePage is not exported`。

- [ ] **Step 3: 用 GameSession 替换 main.ts 的旧 state/stepCombat 定时器**

```ts
const session = GameSession.create(window.localStorage)
let combatSpeed: 1 | 2 | 4 = 1

window.setInterval(() => {
  session.advanceTicks(combatSpeed)
  session.advanceRuntime(COMBAT_TICK_MS)
  render()
}, COMBAT_TICK_MS)

window.addEventListener('beforeunload', () => saveGameV10(window.localStorage, session.state))
```

`shell.ts` 只管理 `idle/heroes/factions/city/inventory` 五个页签和激活态；`idle-page.ts` 只把 view model 转成 HTML 并暴露 `data-action="start-guard|start-roam|stop-combat|speed-1|speed-2|speed-4"`。事件处理集中在 `main.ts`，页面模块不得直接读 localStorage。

- [ ] **Step 4: 运行 UI 测试、build 和现有 E2E，记录预期旧断言失败**

Run: `npm test -- src/ui/idle-page.test.ts && npm run build && npm run test:e2e`

Expected: 单元测试和 build PASS；E2E 仅允许因旧版文案/页面结构断言而 FAIL，不允许控制台异常或启动失败。立即进入 Task 13 更新其余页面和 E2E，不在失败状态提交。

- [ ] **Step 5: 在 Task 13 完成后与页面组一并提交**

此 Task 不单独提交，避免仓库停在 E2E 红灯状态；Task 13 的 commit 同时包含本 Task 文件。

---

### Task 13: 实现侠客、势力、城市与背包页面并重写 E2E

**Files:**
- Create: `src/ui/heroes-page.ts`
- Create: `src/ui/factions-page.ts`
- Create: `src/ui/city-page.ts`
- Create: `src/ui/inventory-page.ts`
- Create: `src/ui/pages.test.ts`
- Modify: `src/main.ts:1-1122`
- Modify: `src/style.css:1-893`
- Replace: `tests/e2e/mvp.spec.ts`

- [ ] **Step 1: 写四页关键文案与禁止内容测试**

```ts
it('侠客页保持前后排各三格并展示职业独立等级', () => {
  const html = renderHeroesPage(fixtureHeroesVm())
  expect(html.match(/data-row="front"/g)).toHaveLength(3)
  expect(html.match(/data-row="back"/g)).toHaveLength(3)
  expect(html).toContain('职业 Lv.')
  expect(html).toContain('圆满心得')
})

it('势力页显示六格悬榜和两条四阶传承', () => {
  const html = renderFactionsPage(fixtureFactionVm())
  expect(html.match(/data-quest-slot=/g)).toHaveLength(6)
  expect(html).toContain('初传')
  expect(html).toContain('进境')
  expect(html).toContain('真传')
  expect(html).toContain('秘传')
})

it('城市和背包页没有抽卡、残页与铁匠铺', () => {
  const html = renderCityPage(fixtureCityVm()) + renderInventoryPage(fixtureInventoryVm())
  expect(html).not.toMatch(/十连|保底|秘籍残页|铁匠铺|强化|淬炼|重铸|拆解/)
})
```

- [ ] **Step 2: 运行页面测试确认四个 renderer 缺失**

Run: `npm test -- src/ui/pages.test.ts`

Expected: FAIL，错误包含 `renderHeroesPage is not exported`。

- [ ] **Step 3: 实现纯 renderer 和统一 data-action 事件映射**

必须实现并连接以下动作：

```ts
const ACTIONS = [
  'formation-place', 'formation-remove',
  'career-change', 'career-perfect', 'career-buy-token',
  'martial-learn', 'martial-upgrade', 'martial-equip', 'martial-unequip', 'martial-forget', 'heart-method-equip',
  'quest-accept', 'quest-cancel', 'quest-claim',
  'tavern-recruit', 'faction-recruit', 'city-martial-learn',
  'equipment-equip', 'equipment-lock',
] as const
```

每个动作在 `main.ts` 中调用 `GameSession`/domain 函数，成功或失败都显示明确 toast；长期状态成功变更后立即调用 `saveGameV10()`。颜色稀有度同时渲染文字和 `data-rarity`，CSS 使用设计规格给定的五个色值。

- [ ] **Step 4: 用新机制 E2E 替换旧版本断言**

`tests/e2e/mvp.spec.ts` 必须覆盖以下独立用例并使用 `window.__EGG_JIANGHU__` 的确定性 seed 辅助，不以固定 timeout 等待随机结果：

```ts
test('从酒馆明确名单直接邀请并放入前后三格阵容', async ({ page }) => {})
test('职业 Lv.10 转职且侠客等级保持不变', async ({ page }) => {})
test('四槽按优先级跳过不满足条件的武功', async ({ page }) => {})
test('每个小关第十波显示 Boss 精英和小怪', async ({ page }) => {})
test('闯荡失败回退上一小关并切换驻守', async ({ page }) => {})
test('敌人死亡时装备立即进入背包', async ({ page }) => {})
test('第 301 件装备被拒绝且战斗继续', async ({ page }) => {})
test('势力六格悬榜锁定已接任务并刷新未接任务', async ({ page }) => {})
test('重载页面后长期收益保留但必须重新选择关卡', async ({ page }) => {})
test('页面不出现离线收益抽卡残页铁匠铺和首次奖励', async ({ page }) => {})
```

逐项填入明确的 `page.getByTestId()` 操作与 `expect()`，每个测试开头调用 `page.goto('/')` 和 `window.__EGG_JIANGHU__.reset()`，不得共享状态。

- [ ] **Step 5: 运行页面全链验证并提交 M4 UI**

Run: `npm test && npm run build && npm run test:e2e`

Expected: 全部 PASS；浏览器控制台无 uncaught error；移动端 390×844 仍可访问五个页签和停止战斗按钮。

```powershell
git add src/main.ts src/style.css src/ui src/app/game-session.ts tests/e2e/mvp.spec.ts
git commit -m "✨ feat(ui): 切换武侠刷宝页面与完整交互"
```

---

### Task 14: 删除 version 9 领域并收口内容与存档不变量

**Files:**
- Delete: `src/game.ts`
- Delete: `src/data.ts`
- Delete: `src/martials.ts`
- Delete: `src/game.test.ts`
- Delete: `src/martials.test.ts`
- Replace: `src/save.ts:1-298`
- Replace: `src/save.test.ts:1-223`
- Modify: `src/content/validate.test.ts`
- Modify: `src/domain/save-v10.test.ts`
- Modify: `src/main.ts:1-1122`

- [ ] **Step 1: 把公开存档入口收敛到 version 10**

```ts
// src/save.ts
export {
  SAVE_KEY_V10 as SAVE_KEY,
  loadGameV10 as loadGame,
  saveGameV10 as saveGame,
  clearSaveV10 as clearSave,
  exportSaveV10 as exportSave,
  importSaveV10 as importSave,
} from './domain/save-v10'
```

`save.test.ts` 只保留 version 10：保存恢复、损坏恢复、导入导出、忽略旧 key、战斗字段拒绝/丢弃、关闭期间任务不刷新六类测试。删除所有 version 1～9 迁移断言。

- [ ] **Step 2: 删除旧模块并运行 TypeScript 找出残余引用**

Run:

```powershell
git rm src/game.ts src/data.ts src/martials.ts src/game.test.ts src/martials.test.ts
npm run build
```

Expected: 首次 build 仅允许出现对 `./game`、`./data`、`./martials` 的残余 import；逐项改到新模块后再次 build PASS。

- [ ] **Step 3: 增加最终内容与状态不变量审计**

```ts
it('最终内容满足首发规模且不含明确排除资源', () => {
  expect(WORLDS).toHaveLength(10)
  expect(FACTIONS).toHaveLength(30)
  expect(FACTION_MARTIALS).toHaveLength(240)
  expect(CAREERS).toHaveLength(42)
  expect(JSON.stringify(createInitialStateV10())).not.toMatch(/pages|秘籍残页|offline|combat/)
})

it('所有内容 id 和交叉引用唯一有效', () => {
  expect(validateContent()).toEqual([])
})
```

- [ ] **Step 4: 运行最终验证矩阵**

Run:

```powershell
npm test
npm run build
npm run test:e2e
git diff --check
codegraph sync ..
codegraph status ..
```

Expected: unit、build、E2E、whitespace 全绿；CodeGraph 文件数与当前 `src/` TypeScript 文件匹配且状态为 `[OK] Index is up to date`。

- [ ] **Step 5: 提交旧域移除与最终收口**

```powershell
git add -A src tests
git commit -m "♻️ refactor(core): 移除 version 9 领域并完成重铸切换"
```

---

### Task 15: 桌面版验收与交付证据

**Files:**
- Modify: `README.md`（若仓库根目录不存在则 Create）
- Verify only: `scripts/package-windows.ps1`
- Verify only: `electron/main.cjs`

- [ ] **Step 1: 写明新游戏规则、存档重置和运行命令**

README 必须包含：version 10 不读取旧档、无离线收益、关闭后重新选关、`npm test`、`npm run build`、`npm run test:e2e`、`npm run desktop:dist`，并链接 `../docs/superpowers/specs/2026-08-01-wuxia-atb-loot-rebuild-design.md`。

- [ ] **Step 2: 重新运行完整自动化验收**

Run: `npm test && npm run build && npm run test:e2e`

Expected: 全部 PASS，测试数以本次输出为准并记录到交付说明，不沿用旧记忆数字。

- [ ] **Step 3: 构建 Windows 安装版与便携版**

Run: `npm run desktop:dist`

Expected: `release/蛋蛋江湖2.0-Setup-2.0.0-x64.exe` 与 `release/蛋蛋江湖2.0-Portable-2.0.0-x64.zip` 生成成功。

- [ ] **Step 4: 计算产物哈希并执行启动冒烟**

Run:

```powershell
Get-FileHash -Algorithm SHA256 'release\蛋蛋江湖2.0-Setup-2.0.0-x64.exe'
Get-FileHash -Algorithm SHA256 'release\蛋蛋江湖2.0-Portable-2.0.0-x64.zip'
Start-Process -FilePath 'release\win-unpacked\蛋蛋江湖2.0.exe' -WindowStyle Hidden
```

Expected: 两个哈希均为 64 位十六进制；应用进程启动后存活且 `Responding=True`。冒烟结束时仅停止本次启动的精确进程实例。

- [ ] **Step 5: 提交文档并留下干净工作区**

```powershell
git add README.md
git commit -m "📝 docs(readme): 补充武侠刷宝重铸运行与验收说明"
git status --porcelain=v1 -b
```

Expected: 最终状态只显示当前 branch 行；`release/` 产物保持在 `.gitignore` 边界内，不提交二进制、测试报告或本机缓存。

---

## 规格覆盖索引

| 规格要求 | 计划任务 |
| --- | --- |
| 从零新档、version 10、新 key | Task 1、10、14 |
| 六侠前后排各三格 | Task 6、12、13 |
| 职业独立等级、四阶、Lv.10/Lv.20 | Task 2、3、11 |
| 固定品级、五维资质与战斗面板 | Task 4、6、13 |
| 四槽、单心法、真气、实时回气、气机 | Task 4～7、13 |
| 外/内功、多乘区、命中与状态 | Task 5～7 |
| 每小关十波且第十波 Boss 组合 | Task 7、12、13 |
| 驻守/闯荡、失败回退、终卷解锁 | Task 7、10、12 |
| 即时随机装备、300 格满仓继续 | Task 8、12、13 |
| 独立世界货币、酒馆直接邀请、武馆 | Task 1、4、11、13 |
| 每势力六格、全局十任务、60 分钟运行时刷新 | Task 9、10、13 |
| 30 势力、双线八武功、稀有度颜色 | Task 2、4、13、14 |
| 不保存战斗、关闭后重新选关 | Task 1、10、13、14 |
| 无铁匠铺/残页/抽卡/首次奖励/固定套装 | Task 11～15 |

## 执行纪律

- 每个 Task 开始前运行 `git status --porcelain=v1 -b`，不覆盖用户已有改动。
- 每次修改当前核心 flow 前运行 `codegraph sync ..`；重构/删除旧公共接口前用 CodeGraph 查询影响面并用 `rg` 复核未索引内容。
- 每个测试先红后绿；如果预期失败信息不同，先确认测试命中了目标规则，再实现代码。
- 每个 Task 完成后使用本计划指定的 emoji commit message；不得把多个红灯 Task 合并成一个提交，Task 12/13 明确为唯一例外。
- 所有随机规则必须通过 seed 测试；E2E 不依赖自然掉落概率或真实等待 60 分钟。
- 每个里程碑结束后运行 `npm test && npm run build`；M4 与最终交付额外运行 `npm run test:e2e`。
