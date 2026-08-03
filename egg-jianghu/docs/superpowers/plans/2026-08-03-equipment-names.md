# 前 10 大关装备命名改造 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前 10 大关（world_01~world_10）的 70 件装备（10 卷 × 7 槽位）从程序化占位名「第N卷+槽位名」替换为金庸风手写名。

**Architecture:** 新增独立命名表 `equipment-names.ts`（对标已完成的 `enemy-names.ts`）。装备定义生成器从表内取名字，缺表降级为原占位名；`validate.ts` 校验表完整性与全局唯一性；展示层经 `equipmentDefinitionById().name` 自动生效，不改 `main.ts`。

**Tech Stack:** TypeScript / Vite / Vitest（`npm test` = `vitest run src`）/ Playwright（e2e 不涉及）

## Global Constraints

- 名字是 (worldId, slot) 的**纯函数**，唯一来源为 `EQUIPMENT_NAMES_BY_WORLD`。
- 70 个名字跨大关、跨槽位**全局不重名**（validate 强制）。
- 装备 ID、槽位、品质、基础数值、掉落规则、存档 schema、UI 布局均不变。
- 不改 `main.ts`、UI 模板、e2e 断言。
- 未开放卷（world_11+）沿用占位名「第N卷+槽位名」兜底。
- 提交信息格式 `<emoji> <type>(<scope>): <description>`，以 `Co-Authored-By: Claude <noreply@anthropic.com>` 结尾。
- 工作目录为仓库根 `egg-jianghu/`。

---

### Task 1: 新增 `src/content/equipment-names.ts`（命名表 + 解析函数）

**Files:**
- Create: `src/content/equipment-names.ts`
- Test: `src/content/equipment-names.test.ts`

**Interfaces:**
- Consumes: `EquipmentSlot`（type-only，来自 `./equipment`；运行时被擦除，无循环依赖）
- Produces:
  - `EQUIPMENT_NAMES_BY_WORLD: Record<string, Record<EquipmentSlot, string>>`
  - `equipmentName(worldId: string, slot: EquipmentSlot): string | undefined`

- [ ] **Step 1: Write the failing test**

创建 `src/content/equipment-names.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { EQUIPMENT_DEFINITIONS, EQUIPMENT_SLOTS } from './equipment'
import { EQUIPMENT_NAMES_BY_WORLD, equipmentName } from './equipment-names'
import { WORLDS } from './worlds'

describe('装备命名表', () => {
  it('已开放 10 卷各有 7 个槽位装备名且非空', () => {
    for (const world of WORLDS) {
      if (!world.released) continue
      const names = EQUIPMENT_NAMES_BY_WORLD[world.id]
      expect(names, `${world.id} 缺少命名表`).toBeDefined()
      for (const slot of EQUIPMENT_SLOTS) {
        expect(names![slot]?.trim().length, `${world.id} ${slot} 名为空`).toBeGreaterThan(0)
      }
    }
  })

  it('跨大关、跨槽位 70 个装备名全局不重名', () => {
    const seen = new Set<string>()
    for (const world of WORLDS) {
      if (!world.released) continue
      for (const slot of EQUIPMENT_SLOTS) {
        const name = EQUIPMENT_NAMES_BY_WORLD[world.id][slot]
        expect(seen.has(name), `装备名重复：${name}`).toBe(false)
        seen.add(name)
      }
    }
    expect(seen.size).toBe(70)
  })

  it('装备名按 (worldId, slot) 取值', () => {
    expect(equipmentName('world_01', 'weapon')).toBe('柴刀')
    expect(equipmentName('world_10', 'token')).toBe('珍珑棋谱')
  })

  it('缺表世界返回 undefined 由调用方兜底', () => {
    expect(equipmentName('world_11', 'weapon')).toBeUndefined()
    expect(equipmentName('broken', 'weapon')).toBeUndefined()
  })

  it('EQUIPMENT_DEFINITIONS 前 10 卷装备名与命名表一致且无占位名残留', () => {
    for (const definition of EQUIPMENT_DEFINITIONS) {
      expect(definition.name, `${definition.id} 名字未接命名表`).toBe(equipmentName(definition.worldId, definition.slot))
      expect(definition.name).not.toMatch(/^第\d+卷/)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content/equipment-names.test.ts`
Expected: FAIL —— `Cannot find module './equipment-names'`（模块尚不存在）。

- [ ] **Step 3: Write minimal implementation**

创建 `src/content/equipment-names.ts`（完整 70 名，来源为已批准规格《2026-08-03-equipment-names-design.md》明细表）：

```ts
import type { EquipmentSlot } from './equipment'

export type WorldEquipmentNames = Record<EquipmentSlot, string>

export const EQUIPMENT_NAMES_BY_WORLD: Record<string, WorldEquipmentNames> = {
  world_01: { weapon: '柴刀', head: '斗笠', armor: '粗布短衣', wrist: '裹腕麻布', waist: '系腰草绳', boots: '芒鞋', token: '半枚玉佩' },
  world_02: { weapon: '铁尺', head: '毡帽', armor: '蓝布长衫', wrist: '藤护腕', waist: '铜扣腰带', boots: '皂靴', token: '烟雨楼诗笺' },
  world_03: { weapon: '铁桨', head: '竹笠', armor: '水靠', wrist: '铜钉护腕', waist: '鲨皮腰扣', boots: '快靴', token: '水寨令牌' },
  world_04: { weapon: '鎏金长剑', head: '束发金冠', armor: '织锦战袍', wrist: '鎏金护腕', waist: '玉带', boots: '云头靴', token: '段家腰牌' },
  world_05: { weapon: '无量剑', head: '束发青巾', armor: '玄青剑袍', wrist: '青藤护腕', waist: '乌木腰带', boots: '麻线布靴', token: '琅嬛玉简' },
  world_06: { weapon: '雁翎刀', head: '风帽', armor: '羊皮袄', wrist: '牛皮护腕', waist: '褡裢', boots: '厚底皮靴', token: '渡船腰牌' },
  world_07: { weapon: '金针', head: '葛布头巾', armor: '青布药袍', wrist: '蝶翼护腕', waist: '药香囊', boots: '软底布鞋', token: '青蝶令牌' },
  world_08: { weapon: '玉骨折扇', head: '织金抹额', armor: '锦缎长袍', wrist: '银丝护腕', waist: '苏绣腰带', boots: '绣花软靴', token: '参合玉令' },
  world_09: { weapon: '虎头刀', head: '英雄巾', armor: '熟铜甲', wrist: '铁鳞护腕', waist: '犀角带', boots: '铁皮战靴', token: '聚贤令' },
  world_10: { weapon: '玄铁棋剑', head: '逍遥巾', armor: '星辰道袍', wrist: '星纹护腕', waist: '银星腰带', boots: '凌云靴', token: '珍珑棋谱' },
}

// 纯函数：名字是 (worldId, slot) 的确定性函数；缺表返回 undefined 由调用方兜底
export const equipmentName = (worldId: string, slot: EquipmentSlot): string | undefined =>
  EQUIPMENT_NAMES_BY_WORLD[worldId]?.[slot]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/content/equipment-names.test.ts`
Expected: PASS（5 个用例全绿）。

- [ ] **Step 5: Commit**

```bash
git add src/content/equipment-names.ts src/content/equipment-names.test.ts
git commit -m "$(cat <<'EOF'
✨ feat(content): 新增前10大关装备命名表

- 70 件装备（10卷×7槽位）配金庸风手写名
- equipmentName 纯函数取值，缺表返回 undefined 由调用方兜底

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Task 2: 装备定义接入命名表

**Files:**
- Modify: `src/content/equipment.ts:1-2`（新增 import）、`:50`（name 字段）
- Test: `src/content/equipment-names.test.ts`（Task 1 已含接线断言）

**Interfaces:**
- Consumes: `equipmentName`（来自 `./equipment-names`）
- Produces: `EQUIPMENT_DEFINITIONS` 中前 10 卷装备 `name` 与命名表一致，不再输出「第N卷」占位名

- [ ] **Step 1: Run the existing wiring test to verify it fails**

Task 1 的 `EQUIPMENT_DEFINITIONS 前 10 卷装备名与命名表一致` 断言当前会失败（`definition.name` 目前是「第1卷兵刃」等占位名，与 `equipmentName` 返回值不等）。

Run: `npm test -- src/content/equipment-names.test.ts`
Expected: FAIL —— `名字未接命名表：world_01_weapon`。

- [ ] **Step 2: Implement the generator wiring**

在 `src/content/equipment.ts` 顶部新增 import：

```ts
import { equipmentName } from './equipment-names'
```

将生成器内 name 字段（当前第 50 行）：

```ts
    name: `第${worldIndex}卷${slotNames[slot]}`,
```

改为：

```ts
    name: equipmentName(worldId, slot) ?? `第${worldIndex}卷${slotNames[slot]}`,
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npm test -- src/content/equipment-names.test.ts`
Expected: PASS。

- [ ] **Step 4: Run full unit suite to catch regressions**

Run: `npm test`
Expected: PASS（`validate.test.ts` 的 `validateContent() === []`、`pages.test.ts` 的 mock fixture 等均不受影响）。

- [ ] **Step 5: Commit**

```bash
git add src/content/equipment.ts
git commit -m "$(cat <<'EOF'
✨ feat(content): 装备定义接入大关专属装备名

- EQUIPMENT_DEFINITIONS 从命名表取名字，缺表降级为原占位名

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Task 3: validate.ts 校验装备命名表

**Files:**
- Modify: `src/content/validate.ts:1-7`（新增 import）、`:44-51`（已开放卷分支内追加装备校验）、`:61-68`（Boss 去重循环后追加装备名全局去重）
- Test: `src/content/validate.test.ts`（既有 `validateContent() === []` 断言覆盖 happy path）

**Interfaces:**
- Consumes: `EQUIPMENT_NAMES_BY_WORLD`（来自 `./equipment-names`）、`EQUIPMENT_SLOTS`（来自 `./equipment`）
- Produces: `validateContent()` 对缺表、缺槽位名、装备名重复返回错误

- [ ] **Step 1: Implement validate checks**

在 `src/content/validate.ts` 顶部新增 import：

```ts
import { EQUIPMENT_SLOTS } from './equipment'
import { EQUIPMENT_NAMES_BY_WORLD } from './equipment-names'
```

在 `for (const world of WORLDS)` 的 `world.released` 分支内、敌人命名表 if/else（第 44~51 行）之后、`} else {`（第 52 行）之前追加：

```ts
      const equipmentNames = EQUIPMENT_NAMES_BY_WORLD[world.id]
      if (!equipmentNames) {
        errors.push(`${world.id} 缺少装备命名表`)
      } else {
        for (const slot of EQUIPMENT_SLOTS) {
          if (!equipmentNames[slot]?.trim()) errors.push(`${world.id} 缺少${slot}装备名`)
        }
      }
```

在文件末尾的 Boss 名去重循环之后（第 68 行 `}` 之后）追加装备名全局去重：

```ts
  const seenEquipmentNames = new Set<string>()
  for (const world of WORLDS) {
    if (!world.released) continue
    for (const slot of EQUIPMENT_SLOTS) {
      const name = EQUIPMENT_NAMES_BY_WORLD[world.id]?.[slot]
      if (!name) continue
      if (seenEquipmentNames.has(name)) errors.push(`装备名重复：${name}`)
      seenEquipmentNames.add(name)
    }
  }
```

- [ ] **Step 2: Run full unit suite to verify happy path**

Run: `npm test`
Expected: PASS（`validate.test.ts` 的 `validateContent() === []` 证明新增校验对有效内容零误报；数据不变量已由 Task 1 测试直接断言）。

- [ ] **Step 3: Commit**

```bash
git add src/content/validate.ts
git commit -m "$(cat <<'EOF'
✅ test(content): 校验装备命名表完整性

- 已开放卷须有 7 槽位非空装备名，且 70 名全局不重名

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### 完整验证

- [ ] Run: `npm test` —— 全绿
- [ ] Run: `npm run build` —— `tsc && vite build` 通过
- [ ] Run: `npm run test:e2e` —— e2e 无装备名断言，应通过
- [ ] Run: `git diff --check` —— 无空白错误
- [ ] 手动检查：启动游戏，进入牛家村/擂鼓山战斗，查看背包掉落装备名为对应大关的新名字；确认装备卡上「槽位名/名字/品质」三字段正常。
