# 侠客名册与四槽武功配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将侠客 Tab 改造成只管理已拥有侠客的名册工作台，并真实支持每人最多学习 20 门、装备 4 门、已学被动叠加、槽位优先级战斗和遗忘返还 80% 资源。

**Architecture:** 保留现有数据驱动和单体 `GameState` 架构，在 `martials.ts` 中集中纯武功规则，在 `save.ts` 完成 version 7 幂等迁移，在 `game.ts` 处理状态变更和战斗轮转。`main.ts` 只负责渲染与事件编排，侠客页采用参考稿的左侧紧凑名册、右侧详情工作台。

**Tech Stack:** TypeScript 6、Vite 8、Vitest 4、Playwright、原生 DOM/CSS、localStorage JSON 存档

---

## 文件结构

- Create: `egg-jianghu/src/martials.ts` — 武功上限、资源账本、退款、被动汇总和兼容访问器。
- Create: `egg-jianghu/src/martials.test.ts` — 纯武功规则测试。
- Modify: `egg-jianghu/src/types.ts` — version 7 存档、学习账本、四槽和独立冷却类型。
- Modify: `egg-jianghu/src/data.ts` — 五门武功的被动数据。
- Modify: `egg-jianghu/src/save.ts` — version 1–7 载入、version 6 旧字段迁移和 version 7 清洗。
- Modify: `egg-jianghu/src/save.test.ts` — 旧存档迁移、幂等和异常账本测试。
- Modify: `egg-jianghu/src/game.ts` — 初始化、属性汇总、装备/排序/遗忘动作和四槽战斗。
- Modify: `egg-jianghu/src/game.test.ts` — 业务动作、被动、退款、锁定和战斗优先级测试。
- Modify: `egg-jianghu/src/main.ts` — 名册工作台、四槽、已学列表、确认弹窗和战斗展示。
- Modify: `egg-jianghu/src/style.css` — 参考稿布局及响应式规则。
- Modify: `egg-jianghu/tests/e2e/mvp.spec.ts` — 删除购买/藏经阁旧断言，覆盖新侠客页完整交互。

## Task 1: 建立纯武功规则与被动数据

**Files:**

- Create: `egg-jianghu/src/martials.ts`
- Create: `egg-jianghu/src/martials.test.ts`
- Modify: `egg-jianghu/src/types.ts:29-45`
- Modify: `egg-jianghu/src/data.ts:143-229`

- [ ] **Step 1: 写资源账本、退款和被动汇总失败测试**

在 `egg-jianghu/src/martials.test.ts` 写入：

```ts
import { describe, expect, it } from 'vitest'
import {
  MAX_EQUIPPED_MARTIALS,
  MAX_LEARNED_MARTIALS,
  getLegacyInvestment,
  getMartialRefund,
  getPassiveBonuses,
} from './martials'

describe('武功纯规则', () => {
  it('固定最多学习 20 门并装备 4 门', () => {
    expect(MAX_LEARNED_MARTIALS).toBe(20)
    expect(MAX_EQUIPPED_MARTIALS).toBe(4)
  })

  it('按旧版三重培养公式还原累计投入', () => {
    expect(getLegacyInvestment(1)).toEqual({ silver: 0, experience: 0, pages: 0, reputation: 0 })
    expect(getLegacyInvestment(2)).toEqual({ silver: 55, experience: 0, pages: 12, reputation: 0 })
    expect(getLegacyInvestment(3)).toEqual({ silver: 165, experience: 0, pages: 36, reputation: 0 })
  })

  it('按每项累计投入的 80% 向下取整退款', () => {
    expect(getMartialRefund({ silver: 101, experience: 9, pages: 11, reputation: 1 }))
      .toEqual({ silver: 80, experience: 7, pages: 8, reputation: 0 })
  })

  it('全部已学武功按重数叠加被动', () => {
    const learned = {
      dragon_palm: { rank: 2, invested: { silver: 0, experience: 0, pages: 0, reputation: 0 } },
      frost_sword: { rank: 3, invested: { silver: 0, experience: 0, pages: 0, reputation: 0 } },
      taiji_breath: { rank: 1, invested: { silver: 0, experience: 0, pages: 0, reputation: 0 } },
    }
    expect(getPassiveBonuses(learned)).toEqual({ attack: 0.06, defense: 0.09, hp: 0.04 })
  })
})
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `npm test -- --run src/martials.test.ts`

Workdir: `egg-jianghu`

Expected: FAIL，提示无法解析 `./martials`。

- [ ] **Step 3: 增加被动和账本类型**

在 `egg-jianghu/src/types.ts` 增加并用于 `MartialDefinition`：

```ts
export type MartialPassiveEffectType = 'attack' | 'defense' | 'hp'

export interface ResourceInvestment extends Resources {}

export interface LearnedMartialProgress {
  rank: number
  invested: ResourceInvestment
}

export interface MartialPassiveEffect {
  type: MartialPassiveEffectType
  valuePerRank: number
}
```

在 `MartialDefinition` 的 `skill` 后增加：

```ts
  passive: MartialPassiveEffect
```

- [ ] **Step 4: 为五门现有武功补齐被动配置**

在 `egg-jianghu/src/data.ts` 的五个 `MartialDefinition` 中分别加入：

```ts
// 沧浪降龙掌
passive: { type: 'attack', valuePerRank: 0.03 },

// 凝霜十三剑
passive: { type: 'defense', valuePerRank: 0.03 },

// 太极吐纳法
passive: { type: 'hp', valuePerRank: 0.04 },

// 金刚伏魔棍
passive: { type: 'attack', valuePerRank: 0.04 },

// 厚土归元功
passive: { type: 'defense', valuePerRank: 0.04 },
```

- [ ] **Step 5: 实现纯武功规则**

创建 `egg-jianghu/src/martials.ts`：

```ts
import { martialById } from './data'
import type { LearnedMartialProgress, Resources } from './types'

export const MAX_LEARNED_MARTIALS = 20
export const MAX_EQUIPPED_MARTIALS = 4

export type MartialPassiveBonuses = {
  attack: number
  defense: number
  hp: number
}

export const zeroResources = (): Resources => ({
  silver: 0,
  experience: 0,
  pages: 0,
  reputation: 0,
})

export function getLegacyInvestment(rank: number): Resources {
  const safeRank = Math.max(1, Math.min(3, Math.floor(rank)))
  const invested = zeroResources()
  for (let currentRank = 1; currentRank < safeRank; currentRank += 1) {
    invested.silver += currentRank * 55
    invested.pages += currentRank * 12
  }
  return invested
}

export const getMartialRefund = (invested: Resources): Resources => ({
  silver: Math.floor(Math.max(0, invested.silver) * 0.8),
  experience: Math.floor(Math.max(0, invested.experience) * 0.8),
  pages: Math.floor(Math.max(0, invested.pages) * 0.8),
  reputation: Math.floor(Math.max(0, invested.reputation) * 0.8),
})

export function getPassiveBonuses(
  learnedMartials: Record<string, LearnedMartialProgress>,
): MartialPassiveBonuses {
  const result: MartialPassiveBonuses = { attack: 0, defense: 0, hp: 0 }
  for (const [martialId, progress] of Object.entries(learnedMartials)) {
    const martial = martialById(martialId)
    if (!martial) continue
    const rank = Math.max(1, Math.min(3, Math.floor(progress.rank)))
    result[martial.passive.type] += martial.passive.valuePerRank * rank
  }
  return result
}

export function formatMartialPassive(martialId: string, rank: number): string {
  const martial = martialById(martialId)
  if (!martial) return '被动效果无效'
  const label = martial.passive.type === 'attack' ? '攻击' : martial.passive.type === 'defense' ? '防御' : '气血上限'
  const value = Math.round(martial.passive.valuePerRank * Math.max(1, rank) * 100)
  return `${label} +${value}%`
}
```

- [ ] **Step 6: 运行纯规则测试与构建**

Run: `npm test -- --run src/martials.test.ts && npm run build`

Workdir: `egg-jianghu`

Expected: `martials.test.ts` 全部 PASS，`tsc && vite build` 成功。

- [ ] **Step 7: 提交纯规则**

```powershell
git add -- egg-jianghu/src/types.ts egg-jianghu/src/data.ts egg-jianghu/src/martials.ts egg-jianghu/src/martials.test.ts
git commit -m "✨ feat(martials): 建立多武功被动与资源账本"
```

## Task 2: 升级 version 7 存档并迁移旧字段

**Files:**

- Modify: `egg-jianghu/src/types.ts:107-130,207-221`
- Modify: `egg-jianghu/src/martials.ts`
- Modify: `egg-jianghu/src/game.ts:42-86,98-124,217-220,827-881`
- Modify: `egg-jianghu/src/save.ts:20-70,160-175`
- Modify: `egg-jianghu/src/main.ts:145-170,335-403,513-520`
- Modify: `egg-jianghu/src/save.test.ts:47-90`

- [ ] **Step 1: 写 version 6 迁移和 version 7 清洗失败测试**

在 `egg-jianghu/src/save.test.ts` 增加：

```ts
  it('把 version 6 单武功字段迁移为 version 7 学习账本和四槽', () => {
    const current = createInitialState(10_000)
    const heroId = current.formation[0].heroId
    const legacy = structuredClone(current) as unknown as Record<string, unknown>
    legacy.version = 6
    const heroes = legacy.heroes as Record<string, Record<string, unknown>>
    heroes[heroId] = {
      unlocked: true,
      level: 9,
      equippedMartialId: 'dragon_palm',
      martialRanks: { dragon_palm: 3, frost_sword: 2 },
    }

    const migrated = hydrateState(legacy, 10_000)
    expect(migrated.version).toBe(7)
    expect(migrated.heroes[heroId].equippedMartialIds).toEqual(['dragon_palm', null, null, null])
    expect(migrated.heroes[heroId].learnedMartials.dragon_palm.invested)
      .toEqual({ silver: 165, experience: 0, pages: 36, reputation: 0 })
    expect(migrated.heroes[heroId].learnedMartials.frost_sword.rank).toBe(2)
  })

  it('旧存档只迁移一次并立即写回 version 7', () => {
    const storage = new MemoryStorage()
    const raw = structuredClone(createInitialState(10_000)) as unknown as Record<string, unknown>
    raw.version = 6
    const heroId = createInitialState(10_000).formation[0].heroId
    const heroes = raw.heroes as Record<string, Record<string, unknown>>
    heroes[heroId] = {
      unlocked: true,
      level: 1,
      equippedMartialId: 'dragon_palm',
      martialRanks: { dragon_palm: 3 },
    }
    storage.setItem(SAVE_KEY, JSON.stringify(raw))

    const first = loadGame(storage, 10_000).state
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(7)
    const second = loadGame(storage, 10_000).state
    expect(second.heroes[heroId].learnedMartials).toEqual(first.heroes[heroId].learnedMartials)
  })

  it('清洗 version 7 的负数账本、无效武功、重复槽位和超长槽位', () => {
    const raw = structuredClone(createInitialState(10_000))
    const heroId = raw.formation[0].heroId
    raw.heroes[heroId].learnedMartials = {
      dragon_palm: {
        rank: 99,
        invested: { silver: -50, experience: Number.NaN, pages: 12, reputation: 3 },
      },
    }
    raw.heroes[heroId].equippedMartialIds = ['dragon_palm', 'dragon_palm', 'missing', null]

    const hydrated = hydrateState(raw, 10_000)
    expect(hydrated.heroes[heroId].learnedMartials.dragon_palm).toEqual({
      rank: 3,
      invested: { silver: 0, experience: 0, pages: 12, reputation: 3 },
    })
    expect(hydrated.heroes[heroId].equippedMartialIds).toEqual(['dragon_palm', null, null, null])
  })
```

- [ ] **Step 2: 运行存档测试并确认旧字段迁移失败**

Run: `npm test -- --run src/save.test.ts`

Workdir: `egg-jianghu`

Expected: FAIL，`equippedMartialIds` 或 `learnedMartials` 不存在，版本仍为 6。

- [ ] **Step 3: 切换核心状态类型到 version 7**

把 `HeroProgress`、`CombatHeroState` 和 `GameState.version` 改为：

```ts
export type EquippedMartialIds = [
  string | null,
  string | null,
  string | null,
  string | null,
]

export interface HeroProgress {
  unlocked: boolean
  level: number
  learnedMartials: Record<string, LearnedMartialProgress>
  equippedMartialIds: EquippedMartialIds
}

export interface CombatHeroState extends FormationSlot {
  hp: number
  maxHp: number
  skillCooldown: number
  statuses: CombatStatus[]
}

export interface GameState {
  version: 7
  resources: Resources
  heroes: Record<string, HeroProgress>
  unlockedMartials: string[]
  formation: FormationSlot[]
  selectedRegionId: RegionId
  defeatedBossIds: string[]
  regionDefeats: Record<RegionId, number>
  mystery: MysteryProgress
  combat: CombatState
  statistics: GameStatistics
  lastTickAt: number
  lastSavedAt: number
}
```

本任务暂时保留单个 `skillCooldown`，Task 4 再一次性切换战斗冷却映射，避免同一提交同时改变存档和战斗语义。

- [ ] **Step 4: 为新结构增加初始化和兼容访问器**

在 `egg-jianghu/src/martials.ts` 增加：

```ts
import type { EquippedMartialIds, HeroProgress, LearnedMartialProgress, Resources } from './types'

export const emptyEquippedMartialIds = (): EquippedMartialIds => [null, null, null, null]

export const createLearnedMartial = (
  rank = 1,
  invested: Resources = zeroResources(),
): LearnedMartialProgress => ({ rank, invested: { ...invested } })

export const getPrimaryMartialId = (progress: HeroProgress): string | null =>
  progress.equippedMartialIds.find((id): id is string => Boolean(id)) ?? null

export const getLearnedMartialRank = (progress: HeroProgress, martialId: string): number =>
  Math.max(1, progress.learnedMartials[martialId]?.rank ?? 1)
```

把 `game.ts` 的 `emptyHeroProgress` 改为：

```ts
const emptyHeroProgress = (unlocked: boolean, martialId: string | null): HeroProgress => ({
  unlocked,
  level: 1,
  learnedMartials: martialId ? { [martialId]: createLearnedMartial() } : {},
  equippedMartialIds: martialId ? [martialId, null, null, null] : emptyEquippedMartialIds(),
})

```

同时把 `createInitialState` 现有状态对象中的 `version: 6` 精确替换为 `version: 7`，其他字段不改。

- [ ] **Step 5: 实现 version 1–7 的侠客武功 hydration**

在 `save.ts` 中把版本校验扩展到 7，并增加以下辅助函数：

```ts
const safeInvestment = (value: unknown) => {
  const source = isRecord(value) ? value : {}
  return {
    silver: safeNumber(source.silver, 0),
    experience: safeNumber(source.experience, 0),
    pages: safeNumber(source.pages, 0),
    reputation: safeNumber(source.reputation, 0),
  }
}

const hydrateVersion7Martials = (
  imported: Record<string, unknown>,
  allowedMartials: Set<string>,
) => {
  const learnedMartials: GameState['heroes'][string]['learnedMartials'] = {}
  if (isRecord(imported.learnedMartials)) {
    for (const [martialId, value] of Object.entries(imported.learnedMartials)) {
      if (!allowedMartials.has(martialId) || !isRecord(value)) continue
      learnedMartials[martialId] = createLearnedMartial(
        Math.max(1, Math.floor(safeNumber(value.rank, 1, 3))),
        safeInvestment(value.invested),
      )
      if (Object.keys(learnedMartials).length >= MAX_LEARNED_MARTIALS) break
    }
  }
  const equippedMartialIds = emptyEquippedMartialIds()
  const importedSlots = Array.isArray(imported.equippedMartialIds) ? imported.equippedMartialIds : []
  for (let slot = 0; slot < equippedMartialIds.length; slot += 1) {
    const martialId = importedSlots[slot]
    if (typeof martialId !== 'string' || !learnedMartials[martialId]) continue
    if (equippedMartialIds.includes(martialId)) continue
    equippedMartialIds[slot] = martialId
  }
  return { learnedMartials, equippedMartialIds }
}

const hydrateLegacyMartials = (
  imported: Record<string, unknown>,
  allowedMartials: Set<string>,
) => {
  const learnedMartials: GameState['heroes'][string]['learnedMartials'] = {}
  if (isRecord(imported.martialRanks)) {
    for (const [martialId, value] of Object.entries(imported.martialRanks)) {
      if (!allowedMartials.has(martialId)) continue
      const rank = Math.max(1, Math.floor(safeNumber(value, 1, 3)))
      learnedMartials[martialId] = createLearnedMartial(rank, getLegacyInvestment(rank))
    }
  }
  const equipped = typeof imported.equippedMartialId === 'string' && allowedMartials.has(imported.equippedMartialId)
    ? imported.equippedMartialId
    : null
  if (equipped) learnedMartials[equipped] ??= createLearnedMartial()
  const equippedMartialIds = emptyEquippedMartialIds()
  equippedMartialIds[0] = equipped
  return { learnedMartials, equippedMartialIds }
}
```

在英雄 hydration 循环中用 `raw.version === 7` 选择对应函数，并把结果赋给 `progress.learnedMartials` 和 `progress.equippedMartialIds`。`loadGame` 成功载入 version 1–6 后立即调用 `saveGame(storage, state, now)`，使本地存档落盘为 version 7；`importSave` 仍由现有导入流程保存。

同步把现有迁移测试中的目标版本断言从 6 改为 7，并将“未来版本应拒绝”用例里的 `{ version: 7 }` 改为 `{ version: 8 }`，避免把当前合法版本继续当成损坏存档。

- [ ] **Step 6: 将旧字段读取点临时切换到新访问器**

为保证本任务结束时构建通过，逐项替换：

```ts
// game.ts / main.ts 读取主武功
const martialId = getPrimaryMartialId(progress)
const martial = martialId ? martialById(martialId) : undefined
const rank = martial ? getLearnedMartialRank(progress, martial.id) : 0

// recruitHero
const martialId = state.unlockedMartials[0] ?? null
progress.learnedMartials = martialId ? { [martialId]: createLearnedMartial() } : {}
progress.equippedMartialIds = martialId ? [martialId, null, null, null] : emptyEquippedMartialIds()

// 当前 equipMartial 的过渡行为：替换第 1 槽并补学习记录
progress.learnedMartials[martialId] ??= createLearnedMartial()
progress.equippedMartialIds[0] = martialId

// 当前 trainMartial 的过渡行为
const martialId = getPrimaryMartialId(progress)
const learned = martialId ? progress.learnedMartials[martialId] : undefined
```

把 `main.ts:154,218,336,362,517` 和 `game.ts:105,410,482,615,836-880` 的旧字段引用全部改为这些访问器；用 `rg -n "equippedMartialId|martialRanks" egg-jianghu/src` 复核只剩 `save.ts` 中明确用于旧存档迁移的字符串读取。

- [ ] **Step 7: 运行存档、核心测试和构建**

Run: `npm test -- --run src/save.test.ts src/game.test.ts && npm run build`

Workdir: `egg-jianghu`

Expected: 全部 PASS，version 6 测试断言更新为 version 7，构建成功。

- [ ] **Step 8: 提交存档迁移**

```powershell
git add -- egg-jianghu/src/types.ts egg-jianghu/src/martials.ts egg-jianghu/src/game.ts egg-jianghu/src/save.ts egg-jianghu/src/main.ts egg-jianghu/src/save.test.ts egg-jianghu/src/game.test.ts
git commit -m "♻️ refactor(save): 迁移侠客多武功存档结构"
```

## Task 3: 实现四槽配置、被动属性和遗忘退款

**Files:**

- Modify: `egg-jianghu/src/martials.ts`
- Modify: `egg-jianghu/src/game.ts:98-124,805-881`
- Modify: `egg-jianghu/src/game.test.ts`

- [ ] **Step 1: 写装备、排序、被动和遗忘失败测试**

在 `game.test.ts` 导入 `forgetMartial`、`moveMartial`、`unequipMartial`，增加：

```ts
  it('只允许装备已学武功并按最小空槽放入，且同一武功不可重复', () => {
    const state = createInitialState()
    const heroId = state.formation[0].heroId
    state.heroes[heroId].learnedMartials.frost_sword = {
      rank: 1,
      invested: { silver: 0, experience: 0, pages: 0, reputation: 0 },
    }
    expect(equipMartial(state, heroId, 'frost_sword').ok).toBe(true)
    expect(state.heroes[heroId].equippedMartialIds[1]).toBe('frost_sword')
    expect(equipMartial(state, heroId, 'frost_sword').ok).toBe(false)
    expect(equipMartial(state, heroId, 'vajra_staff').ok).toBe(false)

    for (const martialId of ['taiji_breath', 'vajra_staff', 'earth_origin']) {
      state.heroes[heroId].learnedMartials[martialId] = {
        rank: 1,
        invested: { silver: 0, experience: 0, pages: 0, reputation: 0 },
      }
    }
    expect(equipMartial(state, heroId, 'taiji_breath').ok).toBe(true)
    expect(equipMartial(state, heroId, 'vajra_staff').ok).toBe(true)
    expect(equipMartial(state, heroId, 'earth_origin').ok).toBe(false)
  })

  it('可与相邻空槽交换并卸下指定槽位', () => {
    const state = createInitialState()
    const heroId = state.formation[0].heroId
    expect(moveMartial(state, heroId, 0, 1).ok).toBe(true)
    expect(state.heroes[heroId].equippedMartialIds).toEqual([null, expect.any(String), null, null])
    expect(unequipMartial(state, heroId, 1).ok).toBe(true)
    expect(state.heroes[heroId].equippedMartialIds).toEqual([null, null, null, null])
  })

  it('全部已学被动影响属性，卸下不失效，遗忘后失效并退款 80%', () => {
    const state = createInitialState()
    const heroId = state.formation[0].heroId
    const before = getHeroStats(state, heroId)
    state.heroes[heroId].learnedMartials.vajra_staff = {
      rank: 2,
      invested: { silver: 101, experience: 9, pages: 11, reputation: 1 },
    }
    state.heroes[heroId].learnedMartials.frost_sword = {
      rank: 1,
      invested: { silver: 0, experience: 0, pages: 0, reputation: 0 },
    }
    expect(equipMartial(state, heroId, 'vajra_staff').ok).toBe(true)
    expect(equipMartial(state, heroId, 'frost_sword').ok).toBe(true)
    const learned = getHeroStats(state, heroId)
    expect(learned.attack).toBeGreaterThan(before.attack)
    expect(unequipMartial(state, heroId, 1).ok).toBe(true)
    expect(getHeroStats(state, heroId).attack).toBe(learned.attack)
    expect(equipMartial(state, heroId, 'vajra_staff').ok).toBe(true)
    expect(forgetMartial(state, heroId, 'vajra_staff').ok).toBe(true)
    expect(state.resources).toEqual({ silver: 260, experience: 97, pages: 23, reputation: 0 })
    expect(state.heroes[heroId].learnedMartials.vajra_staff).toBeUndefined()
    expect(state.heroes[heroId].equippedMartialIds).toEqual([expect.any(String), null, 'frost_sword', null])
  })

  it('挑战和秘境锁定期间拒绝装备、排序、卸下和遗忘', () => {
    const state = createInitialState()
    const heroId = state.formation[0].heroId
    expect(startChallenge(state).ok).toBe(true)
    expect(moveMartial(state, heroId, 0, 1).ok).toBe(false)
    expect(unequipMartial(state, heroId, 0).ok).toBe(false)
    expect(forgetMartial(state, heroId, state.heroes[heroId].equippedMartialIds[0]!).ok).toBe(false)

    const mystery = createInitialState()
    expect(startMystery(mystery, 4).ok).toBe(true)
    expect(moveMartial(mystery, heroId, 0, 1).ok).toBe(false)
    expect(unequipMartial(mystery, heroId, 0).ok).toBe(false)
    expect(forgetMartial(mystery, heroId, mystery.heroes[heroId].equippedMartialIds[0]!).ok).toBe(false)
  })
```

- [ ] **Step 2: 运行核心测试并确认新动作不存在**

Run: `npm test -- --run src/game.test.ts`

Workdir: `egg-jianghu`

Expected: FAIL，提示 `moveMartial`、`unequipMartial` 或 `forgetMartial` 未导出。

- [ ] **Step 3: 实现被动属性计算和摘要**

把 `getHeroStats` 的基础属性先按等级计算，再乘已学被动总和：

```ts
const passive = getPassiveBonuses(progress.learnedMartials)
const level = progress.level
const attack = Math.round((hero.baseAttack + (level - 1) * 3.2) * (1 + passive.attack))
const defense = Math.round((hero.baseDefense + (level - 1) * 1.9) * (1 + passive.defense))
const hp = Math.round((hero.baseHp + (level - 1) * 15) * (1 + passive.hp))
const learnedCount = Object.keys(progress.learnedMartials).length

return {
  attack,
  defense,
  hp,
  power: attack * 3 + defense * 2 + Math.round(hp / 3),
  affinityText: `已学 ${learnedCount} 门；主动武功按各自五行与刚柔相性结算`,
}
```

武功自身的 `basePower`、重数增幅和五行/刚柔相性移到 Task 4 的实际施展计算，避免四门武功共享同一个主武功倍率。

- [ ] **Step 4: 实现装备、卸下和相邻交换业务函数**

在 `game.ts` 替换过渡版 `equipMartial` 并新增：

```ts
export function equipMartial(state: GameState, heroId: string, martialId: string): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可更换武功' }
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  if (!hero || !progress?.unlocked || !martialById(martialId) || !progress.learnedMartials[martialId]) {
    return { ok: false, message: '只能装备这位侠客已经学会的武功' }
  }
  if (progress.equippedMartialIds.includes(martialId)) return { ok: false, message: '这门武功已经装备' }
  const slot = progress.equippedMartialIds.indexOf(null)
  if (slot < 0) return { ok: false, message: '出战武功已满，请先卸下一门' }
  progress.equippedMartialIds[slot] = martialId
  return { ok: true, message: `${hero.name}已将「${martialById(martialId)!.name}」设为优先级 ${slot + 1}` }
}

export function unequipMartial(state: GameState, heroId: string, slot: number): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可更换武功' }
  const progress = state.heroes[heroId]
  if (!progress?.unlocked || slot < 0 || slot >= 4 || !progress.equippedMartialIds[slot]) {
    return { ok: false, message: '这个槽位没有可卸下的武功' }
  }
  progress.equippedMartialIds[slot] = null
  return { ok: true, message: '武功已卸下' }
}

export function moveMartial(state: GameState, heroId: string, slot: number, direction: -1 | 1): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可调整优先级' }
  const progress = state.heroes[heroId]
  const target = slot + direction
  if (!progress?.unlocked || slot < 0 || slot >= 4 || target < 0 || target >= 4 || !progress.equippedMartialIds[slot]) {
    return { ok: false, message: '无法调整这个武功槽位' }
  }
  ;[progress.equippedMartialIds[slot], progress.equippedMartialIds[target]] = [
    progress.equippedMartialIds[target],
    progress.equippedMartialIds[slot],
  ]
  return { ok: true, message: `出招优先级已调整为 ${target + 1}` }
}
```

挂机战斗中新装备武功的冷却初始化在 Task 4 与独立冷却映射一起接入，避免引入不可用的过渡字段。

- [ ] **Step 5: 实现培养账本和遗忘退款**

把 `trainMartial` 改为显式接收 `martialId`，每次扣费同时累计账本；新增：

在 `game.ts` 的 type import 中加入 `EquippedMartialIds`、`Resources`，在 value import 中加入 `formatMartialPassive`、`getMartialRefund`、`getPassiveBonuses`。

```ts
export function trainMartial(state: GameState, heroId: string, martialId: string): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可调整养成' }
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  const martial = martialById(martialId)
  const learned = progress?.learnedMartials[martialId]
  if (!hero || !progress?.unlocked || !martial || !learned) return { ok: false, message: '这位侠客尚未学会该武功' }
  if (learned.rank >= 3) return { ok: false, message: '这门武功已修至圆满' }
  const silver = learned.rank * 55
  const pages = learned.rank * 12
  if (state.resources.silver < silver || state.resources.pages < pages) {
    return { ok: false, message: `进阶需要 ${silver} 银两与 ${pages} 残页` }
  }
  state.resources.silver -= silver
  state.resources.pages -= pages
  learned.invested.silver += silver
  learned.invested.pages += pages
  learned.rank += 1
  return { ok: true, message: `${hero.name}的「${martial.name}」进阶至${martial.rankNames[learned.rank - 1]}` }
}

export const getMartialForgetPreview = (state: GameState, heroId: string, martialId: string) => {
  const learned = state.heroes[heroId]?.learnedMartials[martialId]
  const martial = martialById(martialId)
  if (!learned || !martial) return null
  return {
    martial,
    rank: learned.rank,
    passiveText: formatMartialPassive(martialId, learned.rank),
    refund: getMartialRefund(learned.invested),
  }
}

export function forgetMartial(state: GameState, heroId: string, martialId: string): ActionResult {
  if (isBuildLocked(state)) return { ok: false, message: '交锋或秘境探索期间不可遗忘武功' }
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  const preview = getMartialForgetPreview(state, heroId, martialId)
  if (!hero || !progress?.unlocked || !preview) return { ok: false, message: '没有可遗忘的武功' }
  const oldMaxHp = getHeroStats(state, heroId).hp
  for (const key of Object.keys(preview.refund) as Array<keyof Resources>) {
    state.resources[key] += preview.refund[key]
  }
  delete progress.learnedMartials[martialId]
  progress.equippedMartialIds = progress.equippedMartialIds.map((id) => id === martialId ? null : id) as EquippedMartialIds
  refreshIdleMemberHp(state, heroId, oldMaxHp)
  return { ok: true, message: `${hero.name}已遗忘「${preview.martial.name}」，返还 80% 培养资源` }
}
```

实现 `refreshIdleMemberHp`，并让 `upgradeHero` 复用它：

```ts
const refreshIdleMemberHp = (state: GameState, heroId: string, oldMaxHp: number): void => {
  if (state.combat.mode !== 'idle') return
  const member = state.combat.partyMembers.find((candidate) => candidate.heroId === heroId)
  if (!member) return
  const nextMaxHp = getHeroStats(state, heroId).hp
  member.maxHp = nextMaxHp
  member.hp = Math.max(1, Math.min(nextMaxHp, member.hp + nextMaxHp - oldMaxHp))
}
```

遗忘武功的冷却清理在 Task 4 与独立冷却映射一起接入。

- [ ] **Step 6: 运行核心测试和完整 Vitest**

Run: `npm test -- --run src/game.test.ts && npm test`

Workdir: `egg-jianghu`

Expected: 全部 PASS，无退款、被动或锁定回归。

- [ ] **Step 7: 提交武功配置业务**

```powershell
git add -- egg-jianghu/src/martials.ts egg-jianghu/src/game.ts egg-jianghu/src/game.test.ts
git commit -m "✨ feat(heroes): 支持四槽配置与遗忘退款"
```

## Task 4: 将战斗切换为四槽独立冷却与优先级轮转

**Files:**

- Modify: `egg-jianghu/src/types.ts:126-130`
- Modify: `egg-jianghu/src/game.ts:217-220,407-542,557-629`
- Modify: `egg-jianghu/src/main.ts:145-170,210-220,513-520`
- Modify: `egg-jianghu/src/game.test.ts:214-286,354-397`

- [ ] **Step 1: 写四槽优先级和独立冷却失败测试**

在 `game.test.ts` 增加：

```ts
  it('按槽位选择第一门冷却完毕的武功并记录 abilityId', () => {
    const state = createInitialState()
    const heroId = state.formation[0].heroId
    state.heroes[heroId].learnedMartials.frost_sword = {
      rank: 1,
      invested: { silver: 0, experience: 0, pages: 0, reputation: 0 },
    }
    expect(equipMartial(state, heroId, 'frost_sword').ok).toBe(true)
    expect(startChallenge(state).ok).toBe(true)
    const member = state.combat.partyMembers[0]
    const firstId = state.heroes[heroId].equippedMartialIds[0]!
    member.martialCooldowns[firstId] = 2
    member.martialCooldowns.frost_sword = 0

    stepCombat(state)

    expect(state.combat.logs.at(-1)).toMatchObject({ kind: 'skill', abilityId: 'frost_sword' })
    expect(member.martialCooldowns.frost_sword).toBe(2)
    expect(member.martialCooldowns[firstId]).toBe(1)
  })

  it('所有装备武功冷却时使用普通攻击', () => {
    const state = createInitialState()
    expect(startChallenge(state).ok).toBe(true)
    const member = state.combat.partyMembers[0]
    for (const martialId of state.heroes[member.heroId].equippedMartialIds.filter(Boolean) as string[]) {
      member.martialCooldowns[martialId] = 3
    }
    stepCombat(state)
    expect(state.combat.logs.at(-1)?.kind).toBe('attack')
  })

  it('挂机中调整顺序不重置冷却，新装备武功从完整冷却开始', () => {
    const state = createInitialState()
    const heroId = state.formation[0].heroId
    state.heroes[heroId].learnedMartials.frost_sword = {
      rank: 1,
      invested: { silver: 0, experience: 0, pages: 0, reputation: 0 },
    }
    expect(startIdleStage(state, 'bluestone_path', 1).ok).toBe(true)
    expect(equipMartial(state, heroId, 'frost_sword').ok).toBe(true)
    const member = state.combat.partyMembers.find((candidate) => candidate.heroId === heroId)!
    expect(member.martialCooldowns.frost_sword).toBe(2)
    expect(moveMartial(state, heroId, 1, -1).ok).toBe(true)
    expect(member.martialCooldowns.frost_sword).toBe(2)
    expect(unequipMartial(state, heroId, 0).ok).toBe(true)
    expect(equipMartial(state, heroId, 'frost_sword').ok).toBe(true)
    expect(member.martialCooldowns.frost_sword).toBe(2)
    expect(forgetMartial(state, heroId, 'frost_sword').ok).toBe(true)
    expect(member.martialCooldowns.frost_sword).toBeUndefined()
  })
```

- [ ] **Step 2: 运行核心测试并确认冷却结构失败**

Run: `npm test -- --run src/game.test.ts`

Workdir: `egg-jianghu`

Expected: FAIL，`martialCooldowns` 不存在。

- [ ] **Step 3: 替换战斗成员冷却类型和初始化**

将 `CombatHeroState` 改为：

```ts
export interface CombatHeroState extends FormationSlot {
  hp: number
  maxHp: number
  martialCooldowns: Record<string, number>
  statuses: CombatStatus[]
}
```

把 `createCombatParty` 改为：

```ts
const createCombatParty = (state: GameState): CombatHeroState[] => state.formation.map((slot) => {
  const maxHp = getHeroStats(state, slot.heroId).hp
  const martialCooldowns = Object.fromEntries(
    state.heroes[slot.heroId].equippedMartialIds
      .filter((id): id is string => Boolean(id))
      .map((id) => [id, 0]),
  )
  return { ...slot, hp: maxHp, maxHp, martialCooldowns, statuses: [] }
})
```

- [ ] **Step 4: 让武功自身承担倍率、相性和冷却**

将 `getEnemyTraitAttackMultiplier` 和 `getAttackBase` 增加可选参数 `martial?: MartialDefinition`，寒罡克制只读取这个参数；`performMartialSkill` 传入当前施展武功，普通攻击和合击不传，避免再隐式读取第 1 槽。在 `performMartialSkill` 中使用：

```ts
const hero = heroById(member.heroId)
const learned = state.heroes[member.heroId].learnedMartials[martial.id]
const rank = Math.max(1, learned?.rank ?? 1)
const elementMatch = hero?.element === martial.element
const styleMatch = hero?.style === martial.style
const martialMultiplier = martial.basePower
  * (1 + (rank - 1) * 0.12)
  * (elementMatch ? 1.18 : 1)
  * (styleMatch ? 1.08 : 1)
const { damage: attackBase, traitMultiplier } = getAttackBase(state, member, synergy, martial)
let damage = attackBase * martialMultiplier
```

施展结束时写入独立冷却并记录武功 ID：

```ts
member.martialCooldowns[martial.id] = Math.max(1, martial.skill.cooldown - synergy.skillCooldownReduction)
addLog(combat, 'skill', text, {
  actorId: member.heroId,
  amount: roundedDamage,
  abilityId: martial.id,
})
```

寒罡克制按当前施展武功判断；普通攻击不携带武功元素。

- [ ] **Step 5: 在每次普通武功行动前递减并按槽位选招**

把 `stepCombat` 的单武功分支替换为：

```ts
const progress = state.heroes[actorId]
const equippedIds = progress.equippedMartialIds.filter((id): id is string => Boolean(id))
for (const martialId of equippedIds) {
  const current = actorMember.martialCooldowns[martialId] ?? 0
  if (current > 0) actorMember.martialCooldowns[martialId] = current - 1
}
const readyMartialId = equippedIds.find((martialId) => (actorMember.martialCooldowns[martialId] ?? 0) <= 0)
const readyMartial = readyMartialId ? martialById(readyMartialId) : undefined
if (readyMartial) {
  performMartialSkill(state, actorMember, readyMartial, synergy)
} else {
  const { damage: attackBase, traitMultiplier } = getAttackBase(state, actorMember, synergy)
  const damage = Math.max(1, Math.round(attackBase))
  combat.enemyHp = Math.max(0, combat.enemyHp - damage)
  addLog(combat, 'attack', `${actor?.name ?? '侠客'}施展拳脚，造成 ${damage} 伤害${describeTraitAdjustment(traitMultiplier)}。`, {
    actorId,
    amount: damage,
  })
}
```

合击回合沿用现有行为，不递减单人武功冷却。

- [ ] **Step 6: 补齐挂机换装冷却、遗忘清理和战斗 UI**

实现 Task 3 的两个辅助函数：

```ts
const primeNewIdleMartialCooldown = (state: GameState, heroId: string, martialId: string): void => {
  if (state.combat.mode !== 'idle' || state.combat.status !== 'fighting') return
  const member = state.combat.partyMembers.find((candidate) => candidate.heroId === heroId)
  const martial = martialById(martialId)
  if (member && martial && member.martialCooldowns[martialId] === undefined) {
    member.martialCooldowns[martialId] = martial.skill.cooldown
  }
}

const clearMartialCooldown = (state: GameState, heroId: string, martialId: string): void => {
  const member = state.combat.partyMembers.find((candidate) => candidate.heroId === heroId)
  if (member) delete member.martialCooldowns[martialId]
}
```

在 `equipMartial` 写入槽位后调用 `primeNewIdleMartialCooldown(state, heroId, martialId)`；在 `forgetMartial` 删除学习记录和槽位引用后调用 `clearMartialCooldown(state, heroId, martialId)`。

在 `main.ts` 中：

- `renderFighter` 展示优先级最高且已冷却的武功；如果全部冷却，展示最短剩余行动数。
- `skill-flash` 通过 `hitEvent.abilityId` 查找武功，不再读取角色第 1 槽。
- “本阵招式预案”每位侠客列出最多 4 门装备武功及优先级。

增加以下读取和展示辅助函数：

同时在 `main.ts` 的 type import 中加入 `CombatEvent`。

```ts
const getEquippedMartialView = (heroId: string) => state.heroes[heroId].equippedMartialIds
  .map((id, index) => id ? { martial: martialById(id), priority: index + 1 } : null)
  .filter((entry): entry is { martial: NonNullable<ReturnType<typeof martialById>>, priority: number } => Boolean(entry?.martial))

const getFighterMartialText = (heroId: string, member: CombatHeroState): string => {
  const equipped = getEquippedMartialView(heroId)
  const ready = equipped.find(({ martial }) => (member.martialCooldowns[martial.id] ?? 0) <= 0)
  if (ready) return `${ready.martial.skill.name} · 蓄势已成`
  const waiting = equipped
    .map(({ martial }) => ({ martial, cooldown: member.martialCooldowns[martial.id] ?? 0 }))
    .sort((left, right) => left.cooldown - right.cooldown)[0]
  return waiting ? `${waiting.martial.skill.name} · ${waiting.cooldown} 次行动后` : '普通攻击'
}

const getSkillFlashName = (event: CombatEvent | null): string =>
  event?.abilityId ? martialById(event.abilityId)?.skill.name ?? '武学招式' : '武学招式'

const renderSkillPlanForHero = (heroId: string): string => `
  <span><b>${heroById(heroId)?.name ?? '侠客'}</b>
    ${getEquippedMartialView(heroId).map(({ martial, priority }) => `<i>${priority}. ${martial.skill.name}</i>`).join('')}
  </span>`
```

`renderFighter` 调用 `getFighterMartialText`，技能闪屏调用 `getSkillFlashName(hitEvent)`，战斗预案对阵容三人调用 `renderSkillPlanForHero`。

- [ ] **Step 7: 更新旧冷却断言并运行完整测试**

将所有 `member.skillCooldown` 断言改为 `member.martialCooldowns[martialId]`，运行：

Run: `npm test && npm run build`

Workdir: `egg-jianghu`

Expected: 全部 Vitest PASS，构建成功，`rg -n "skillCooldown" egg-jianghu/src egg-jianghu/tests` 只命中 `skillCooldownReduction`。

- [ ] **Step 8: 提交战斗轮转**

```powershell
git add -- egg-jianghu/src/types.ts egg-jianghu/src/game.ts egg-jianghu/src/main.ts egg-jianghu/src/game.test.ts
git commit -m "✨ feat(combat): 按四槽优先级轮转武功"
```

## Task 5: 重构侠客 Tab 为名册工作台

**Files:**

- Modify: `egg-jianghu/src/main.ts:48-63,335-403,632-769,771-832`
- Modify: `egg-jianghu/src/style.css:477-514,708-807`
- Modify: `egg-jianghu/tests/e2e/mvp.spec.ts:29-55,121-159,239-270`

- [ ] **Step 1: 写新侠客页 E2E 失败测试**

删除“9 张侠客卡、5 张藏经阁卡”和页面购买侠客的旧断言；新增：

```ts
test('侠客页只显示已拥有侠客并提供四槽武功工作台', async ({ page }) => {
  await page.getByRole('button', { name: /侠客/ }).click()

  await expect(page.getByTestId('hero-roster').locator('.hero-roster-card')).toHaveCount(3)
  await expect(page.getByText('藏经阁 · 五门武学')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /银两结识/ })).toHaveCount(0)
  await expect(page.getByTestId('martial-slots').locator('.martial-slot')).toHaveCount(4)
  await expect(page.getByTestId('learned-martials')).toContainText('已学武功')

  const cards = page.getByTestId('hero-roster').locator('.hero-roster-card')
  expect(await cards.count()).toBe(3)
  await cards.nth(1).click()
  await expect(page.getByTestId('hero-detail')).toContainText('Lv.1')
})

test('侠客可卸下、重新装备并确认遗忘返还 80% 资源', async ({ page }) => {
  const seeded = await page.evaluate(() => {
    const state = window.__EGG_JIANGHU__.getState()
    const heroId = state.formation[0].heroId
    const martialId = state.heroes[heroId].equippedMartialIds[0]!
    state.heroes[heroId].learnedMartials[martialId].invested = {
      silver: 101,
      experience: 9,
      pages: 11,
      reputation: 1,
    }
    localStorage.setItem('egg-jianghu-2-save-v1', JSON.stringify(state))
    return { heroId, martialId, silver: state.resources.silver }
  })
  await page.reload()
  await page.getByRole('button', { name: /侠客/ }).click()

  await page.getByTestId('martial-slot-0').getByRole('button', { name: '卸下' }).click()
  await page.getByTestId(`learned-${seeded.martialId}`).getByRole('button', { name: '装备' }).click()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByTestId(`learned-${seeded.martialId}`).getByRole('button', { name: '遗忘' }).click()
  await expect(page.getByTestId(`learned-${seeded.martialId}`)).toHaveCount(1)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().resources.silver)).toBe(seeded.silver)

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('返还：80 银两、7 阅历、8 残页、0 声望')
    await dialog.accept()
  })
  await page.getByTestId(`learned-${seeded.martialId}`).getByRole('button', { name: '遗忘' }).click()

  await expect(page.getByTestId(`learned-${seeded.martialId}`)).toHaveCount(0)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().resources.silver)).toBe(seeded.silver + 80)
})

test('BOSS 挑战期间侠客配置会锁定并说明原因', async ({ page }) => {
  await page.getByRole('button', { name: /战斗/ }).click()
  await page.getByRole('button', { name: /挑战断碑手/ }).click()
  await page.getByRole('button', { name: /侠客/ }).click()

  await expect(page.getByTestId('hero-build-lock')).toContainText('BOSS 挑战期间')
  await expect(page.getByTestId('martial-slot-0').getByRole('button', { name: '卸下' })).toBeDisabled()
})
```

保留 `.nth(1)` 前的显式 `count()`，符合现有 Playwright 定位纪律。

- [ ] **Step 2: 运行新 E2E 并确认工作台不存在**

Run: `npm run test:e2e -- --grep "侠客页|侠客可卸下|BOSS 挑战期间"`

Workdir: `egg-jianghu`

Expected: FAIL，缺少 `hero-roster`、`martial-slots` 或新按钮。

- [ ] **Step 3: 增加选中侠客状态和稳定排序**

在 `main.ts` 顶部状态区增加选中状态，并让现有 UI 锁定判断同时覆盖 BOSS 挑战和秘境：

```ts
let selectedHeroId: string | null = null

const getBuildUiLockMessage = (): string => {
  if (state.mystery.run) return '秘境探索期间养成与武功配置已锁定'
  if (state.combat.mode === 'challenge' && state.combat.status === 'fighting') return 'BOSS 挑战期间养成与武功配置已锁定'
  return ''
}

const isBuildUiLocked = (): boolean => Boolean(getBuildUiLockMessage())

const getOwnedHeroes = () => {
  const formationOrder = new Map(state.formation.map((slot, index) => [slot.heroId, index]))
  return HEROES
    .filter((hero) => state.heroes[hero.id].unlocked)
    .slice()
    .sort((left, right) => {
      const leftParty = formationOrder.get(left.id)
      const rightParty = formationOrder.get(right.id)
      if (leftParty !== undefined || rightParty !== undefined) {
        if (leftParty === undefined) return 1
        if (rightParty === undefined) return -1
        return leftParty - rightParty
      }
      return state.heroes[right.id].level - state.heroes[left.id].level
    })
}

const getSelectedHeroId = (): string => {
  const owned = getOwnedHeroes()
  if (selectedHeroId && state.heroes[selectedHeroId]?.unlocked) return selectedHeroId
  selectedHeroId = state.formation.find((slot) => state.heroes[slot.heroId]?.unlocked)?.heroId ?? owned[0]?.id ?? ''
  return selectedHeroId
}
```

在存档导入和重开时把 `selectedHeroId = null`，防止沿用不存在的选中对象。

- [ ] **Step 4: 渲染左侧名册、详情头和四槽**

用以下结构替换 `renderMartialSelect`、`renderHeroCard` 和旧 `renderHeroes`：

```ts
const renderHeroRosterCard = (heroId: string, selectedId: string): string => {
  const hero = heroById(heroId)!
  const progress = state.heroes[heroId]
  const inParty = state.formation.some((slot) => slot.heroId === heroId)
  return `<button class="hero-roster-card panel ${heroId === selectedId ? 'selected' : ''}"
      data-action="select-hero" data-hero-id="${heroId}" aria-pressed="${heroId === selectedId}">
    ${inParty ? '<span class="roster-party-state">出战中</span>' : ''}
    <span class="roster-level">Lv.${progress.level}</span>
    <span class="portrait element-${hero.element}">${hero.name.slice(-1)}</span>
    <strong>${hero.name}</strong>
    <small>${hero.sect} · ${hero.epithet}</small>
  </button>`
}

const renderMartialSlots = (heroId: string): string => {
  const progress = state.heroes[heroId]
  return `<div class="martial-slots" data-testid="martial-slots">
    ${progress.equippedMartialIds.map((martialId, slot) => {
      const martial = martialId ? martialById(martialId) : undefined
      const rank = martialId ? progress.learnedMartials[martialId]?.rank ?? 1 : 0
      return `<article class="martial-slot ${martial ? 'filled' : 'empty'}" data-testid="martial-slot-${slot}">
        <span class="martial-priority">${slot + 1}</span>
        ${martial ? `<strong>${martial.name}</strong>
          <small>${martial.element}行 · ${martial.style}劲 · ${martial.skill.cooldown} 次行动冷却 · ${martial.rankNames[rank - 1]}</small>
          <p>${formatMartialPassive(martial.id, rank)}</p>
          <div class="martial-slot-actions">
            <button data-action="move-martial" data-hero-id="${heroId}" data-slot="${slot}" data-direction="-1" ${slot === 0 || isBuildUiLocked() ? 'disabled' : ''}>↑</button>
            <button data-action="move-martial" data-hero-id="${heroId}" data-slot="${slot}" data-direction="1" ${slot === 3 || isBuildUiLocked() ? 'disabled' : ''}>↓</button>
            <button data-action="unequip-martial" data-hero-id="${heroId}" data-slot="${slot}" ${isBuildUiLocked() ? 'disabled' : ''}>卸下</button>
          </div>` : '<strong>空槽位</strong><small>从下方已学武功中装备</small>'}
      </article>`
    }).join('')}
  </div>`
}
```

- [ ] **Step 5: 渲染已学列表、被动汇总和完整详情**

新增：

```ts
const renderLearnedMartials = (heroId: string): string => {
  const progress = state.heroes[heroId]
  const entries = Object.entries(progress.learnedMartials)
  return `<section class="learned-martials" data-testid="learned-martials">
    <div class="section-title"><span>已学武功 · ${entries.length}/20</span><small>全部被动持续生效并叠加</small></div>
    ${entries.map(([martialId, learned]) => {
      const martial = martialById(martialId)
      if (!martial) return ''
      const slot = progress.equippedMartialIds.indexOf(martialId)
      return `<article class="learned-martial-row ${slot >= 0 ? 'equipped' : ''}" data-testid="learned-${martialId}">
        <div><strong>${martial.name}</strong><small>${martial.element}行 · ${martial.style}劲 · ${martial.rankNames[learned.rank - 1]}</small></div>
        <p>${martial.skill.name}：${martial.skill.description}</p>
        <em>${formatMartialPassive(martialId, learned.rank)}</em>
        <div>${slot >= 0 ? `<span>优先级 ${slot + 1}</span>` : `<button data-action="equip-martial" data-hero-id="${heroId}" data-martial-id="${martialId}" ${isBuildUiLocked() ? 'disabled' : ''}>装备</button>`}
          <button class="danger" data-action="forget-martial" data-hero-id="${heroId}" data-martial-id="${martialId}" ${isBuildUiLocked() ? 'disabled' : ''}>遗忘</button>
        </div>
      </article>`
    }).join('')}
  </section>`
}

const renderHeroes = (): string => {
  const owned = getOwnedHeroes()
  const heroId = getSelectedHeroId()
  const hero = heroById(heroId)!
  const progress = state.heroes[heroId]
  const stats = getHeroStats(state, heroId)
  const passive = getPassiveBonuses(progress.learnedMartials)
  const upgradeCost = getUpgradeCost(progress.level)
  return `<div class="page-heading compact-heading"><div><span class="eyebrow">Hero Roster</span><h1>江湖名册</h1><p>管理已结识侠客、出招优先级与全部已学武功被动。</p></div></div>
    <div class="hero-workbench">
      <aside><div class="section-title"><span>侠客阵容</span><small>已结识 ${owned.length} 人</small></div>
        <div class="hero-roster" data-testid="hero-roster">${owned.map((item) => renderHeroRosterCard(item.id, heroId)).join('')}</div>
      </aside>
      <section class="hero-detail panel" data-testid="hero-detail">
        <header class="hero-detail-head"><div class="portrait large element-${hero.element}">${hero.name.slice(-1)}</div>
          <div><h2>${hero.name}<small>Lv.${progress.level}</small></h2><p>${hero.sect} · ${hero.epithet} · ${hero.element}行 · ${hero.style}劲</p><p class="affinity">${stats.affinityText}</p>
            <div class="stat-line"><span>攻 <b>${stats.attack}</b></span><span>御 <b>${stats.defense}</b></span><span>气血 <b>${stats.hp}</b></span><span>战力 <b>${stats.power}</b></span></div>
            <div class="hero-talent">${hero.description}</div></div>
          <button class="secondary-button" data-action="upgrade" data-hero-id="${heroId}" ${isBuildUiLocked() ? 'disabled' : ''}>提升境界<small>${upgradeCost.silver}银 / ${upgradeCost.experience}阅历</small></button>
        </header>
        ${getBuildUiLockMessage() ? `<div class="build-lock-notice" data-testid="hero-build-lock">${getBuildUiLockMessage()}</div>` : ''}
        <div class="martial-summary"><span>已学 ${Object.keys(progress.learnedMartials).length}/20</span><span>已装备 ${progress.equippedMartialIds.filter(Boolean).length}/4</span><b>被动汇总：攻击 +${Math.round(passive.attack * 100)}% · 防御 +${Math.round(passive.defense * 100)}% · 气血 +${Math.round(passive.hp * 100)}%</b></div>
        <div class="hero-detail-body"><div class="section-title"><span>出战武功</span><small>数字为施展优先级，每门独立冷却</small></div>${renderMartialSlots(heroId)}${renderLearnedMartials(heroId)}</div>
      </section>
    </div>`
}
```

- [ ] **Step 6: 绑定选中、装备、排序、卸下和遗忘确认**

删除 `recruit`、`train`、`unlock-martial` 的侠客页 case 和旧 `change` 事件中的 `equip-martial`。在 click switch 增加：

同步更新 import：从 `game.ts` 导入 `forgetMartial`、`getMartialForgetPreview`、`moveMartial`、`unequipMartial`，移除 `recruitHero`、`trainMartial`、`unlockMartial`；从 `martials.ts` 导入 `formatMartialPassive`、`getPassiveBonuses`。

```ts
case 'select-hero': selectedHeroId = heroId ?? null; render(); return
case 'equip-martial': notify(equipMartial(state, heroId ?? '', martialId ?? '')); break
case 'unequip-martial': notify(unequipMartial(state, heroId ?? '', Number(slot))); break
case 'move-martial': {
  const direction = Number(button.dataset.direction)
  if (direction !== -1 && direction !== 1) return
  notify(moveMartial(state, heroId ?? '', Number(slot), direction))
  break
}
case 'forget-martial': {
  const preview = getMartialForgetPreview(state, heroId ?? '', martialId ?? '')
  if (!preview) { notify('没有可遗忘的武功', 'warning'); break }
  const refund = preview.refund
  const confirmed = window.confirm(
    `确定遗忘「${preview.martial.name}」？\n` +
    `将失去：${preview.passiveText}\n` +
    `返还：${refund.silver} 银两、${refund.experience} 阅历、${refund.pages} 残页、${refund.reputation} 声望\n` +
    '若已装备将自动卸下，其他槽位不会前移。',
  )
  if (!confirmed) return
  notify(forgetMartial(state, heroId ?? '', martialId ?? ''))
  break
}
```

- [ ] **Step 7: 实现参考稿风格和响应式布局**

删除旧 `.martial-library`、`.martial-strip`、`.martial-item`、`.hero-grid` 和 `.hero-card` 规则，新增以下结构规则，并沿用现有 CSS 变量、字体和金色描边：

```css
.hero-workbench { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 14px; align-items: start; }
.hero-roster { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.hero-roster-card { position: relative; min-height: 112px; padding: 11px 6px; color: var(--paper); text-align: center; cursor: pointer; }
.hero-roster-card.selected { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold), 0 0 16px rgba(201,164,92,.28); }
.hero-roster-card .portrait { margin: 10px auto 6px; }
.roster-level, .roster-party-state { position: absolute; top: 6px; padding: 1px 5px; font-size: 8px; border: 1px solid var(--line); }
.roster-level { right: 6px; color: var(--gold-bright); }
.roster-party-state { left: 6px; color: #86a294; }
.hero-detail { min-width: 0; overflow: hidden; }
.hero-detail-head { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 16px; align-items: center; padding: 18px; border-bottom: 1px solid var(--line); }
.hero-detail-head h2 { color: var(--paper); font-family: "Source Han Serif SC Game Heavy", serif; }
.hero-detail-head h2 small { margin-left: 8px; color: var(--paper-dim); font-size: 10px; }
.hero-talent { margin-top: 8px; padding: 7px 10px; color: var(--gold-bright); border: 1px dashed var(--gold-dark); }
.build-lock-notice { padding: 8px 18px; color: #d9b58a; border-bottom: 1px solid var(--line); background: rgba(119,57,38,.2); }
.martial-summary { display: flex; gap: 14px; padding: 10px 18px; border-bottom: 1px solid var(--line); color: var(--paper-dim); font-size: 10px; }
.martial-summary b { margin-left: auto; color: var(--gold-bright); font-weight: 400; }
.hero-detail-body { padding: 16px 18px; }
.martial-slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
.martial-slot { position: relative; min-height: 112px; padding: 12px 10px; border: 1px dashed var(--line-strong); background: rgba(0,0,0,.18); }
.martial-slot.filled { border-style: solid; }
.martial-priority { position: absolute; top: -8px; left: -7px; display: grid; place-items: center; width: 21px; height: 21px; color: #17120d; border-radius: 50%; background: var(--gold); }
.martial-slot-actions { display: flex; gap: 5px; margin-top: 8px; }
.learned-martial-row { display: grid; grid-template-columns: 150px minmax(220px,1fr) 120px auto; gap: 12px; align-items: center; padding: 10px; border: 1px solid var(--line); }
.learned-martial-row + .learned-martial-row { margin-top: 7px; }
.learned-martial-row em { color: #86a294; font-style: normal; }

@media (max-width: 980px) {
  .hero-workbench { grid-template-columns: 1fr; }
  .hero-roster { grid-template-columns: repeat(6, 1fr); }
}

@media (max-width: 700px) {
  .hero-roster { grid-template-columns: repeat(3, 1fr); }
  .hero-detail-head { grid-template-columns: auto 1fr; }
  .hero-detail-head > button { grid-column: 1 / -1; }
  .martial-summary { flex-wrap: wrap; }
  .martial-summary b { width: 100%; margin-left: 0; }
  .martial-slots { grid-template-columns: repeat(2, 1fr); }
  .learned-martial-row { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  .martial-slots { grid-template-columns: 1fr; }
}
```

- [ ] **Step 8: 更新旧 E2E 并运行侠客页测试**

把启动流程测试中的旧侠客页断言替换为：

```ts
await page.getByRole('button', { name: /侠客/ }).click()
await expect(page.getByTestId('hero-roster').locator('.hero-roster-card')).toHaveCount(3)
await expect(page.getByTestId('martial-slots').locator('.martial-slot')).toHaveCount(4)
await expect(page.locator('.martial-item')).toHaveCount(0)
```

删除原“挂机所得可用于招募同门并激活羁绊”E2E；招募业务仍由 `game.test.ts` 覆盖，获取流程等待后续设计。把“武学招式会展示预案并在自动战斗中施展”完整替换为：

```ts
test('四槽武功会展示预案并按优先级在自动战斗中施展', async ({ page }) => {
  await page.getByRole('button', { name: /侠客/ }).click()
  await expect(page.getByTestId('martial-slots').locator('.martial-slot')).toHaveCount(4)
  await expect(page.getByTestId('learned-martials').locator('.learned-martial-row')).toHaveCount(1)

  await page.getByRole('button', { name: /战斗/ }).click()
  const plans = page.getByTestId('skill-plan').locator('.skill-plan-grid > span')
  await expect(plans).toHaveCount(3)
  await expect(plans.nth(0)).toContainText('1. 赤浪断岳')
  await expect(plans.nth(1)).toContainText('1. 寒江听雪')
  await expect(plans.nth(2)).toContainText('1. 抱元守一')
  await page.getByRole('button', { name: /挑战断碑手/ }).click()
  await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(4))

  await expect(page.locator('.log-skill').first()).toBeVisible()
  await expect(page.locator('.fighter-skill')).toHaveCount(3)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().combat.logs
    .filter((event) => event.kind === 'skill')
    .every((event) => Boolean(event.abilityId)))).toBe(true)
})
```

Run: `npm run test:e2e -- --grep "侠客页|侠客可卸下|BOSS 挑战期间|四槽武功"`

Workdir: `egg-jianghu`

Expected: 三项 PASS。

- [ ] **Step 9: 提交侠客页改版**

```powershell
git add -- egg-jianghu/src/main.ts egg-jianghu/src/style.css egg-jianghu/tests/e2e/mvp.spec.ts
git commit -m "💄 style(heroes): 重构侠客名册与武功工作台"
```

## Task 6: 全链验证与收口

**Files:**

- Verify: `egg-jianghu/src/*.test.ts`
- Verify: `egg-jianghu/tests/e2e/mvp.spec.ts`
- Verify: `egg-jianghu/src/main.ts`
- Verify: `egg-jianghu/src/style.css`

- [ ] **Step 1: 运行格式和旧字段扫描**

Run:

```powershell
rg -n "equippedMartialId|martialRanks|skillCooldown|藏经阁 · 五门武学|data-action=\"recruit\"|data-action=\"train\"" egg-jianghu/src egg-jianghu/tests
git diff --check
```

Expected: 旧字段只允许出现在 `save.ts` 的 version 6 迁移代码和对应迁移测试；`skillCooldown` 只允许作为 `skillCooldownReduction` 子串；无空白错误。

- [ ] **Step 2: 运行完整单元测试**

Run: `npm test`

Workdir: `egg-jianghu`

Expected: 所有 Vitest 测试 PASS。

- [ ] **Step 3: 运行 TypeScript 与生产构建**

Run: `npm run build`

Workdir: `egg-jianghu`

Expected: `tsc && vite build` 成功，`dist` 正常生成。

- [ ] **Step 4: 运行完整 Playwright E2E**

Run: `npm run test:e2e`

Workdir: `egg-jianghu`

Expected: 全部 E2E PASS，包括桌面、移动端、存档导入、战斗、秘境与侠客页新用例。

- [ ] **Step 5: 复核存档与关键 UI 状态**

手动使用开发服务器验证：

```powershell
npm run dev -- --host 127.0.0.1
```

检查：

- 侠客页只有 3 位初始已拥有侠客，左侧三列、右侧详情。
- 未拥有侠客和购买按钮不可见。
- 4 个槽位始终可见，排序、卸下和重新装备即时更新。
- 已学被动汇总与属性同步变化。
- 遗忘确认显示 80% 明细，取消不变，确认后自动卸下且其他槽位不前移。
- 挂机中可调整并在下一次行动生效；BOSS 和秘境锁定期间按钮禁用。
- 窄屏下名册、详情、四槽和列表均无横向溢出。

- [ ] **Step 6: 同步 CodeGraph 并检查仓库状态**

Run:

```powershell
codegraph sync "D:\Projects\OpenProject\花旦的各种小游戏\挂机游戏\蛋蛋江湖2.0"
codegraph status "D:\Projects\OpenProject\花旦的各种小游戏\挂机游戏\蛋蛋江湖2.0"
git status --porcelain=v1 -b
```

Expected: CodeGraph 为最新状态；worktree 只包含计划执行期间尚未提交的有意修改。

- [ ] **Step 7: 仅在验证修复产生改动时提交收口**

```powershell
git add -- egg-jianghu/src egg-jianghu/tests/e2e/mvp.spec.ts
git commit -m "✅ test(heroes): 覆盖侠客名册与多武功完整链路"
```

若 Step 1–6 未产生任何文件改动，则跳过本提交，保持前四个功能提交不变。
