# 前 10 大关敌人命名（金庸风）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为前 10 大关（world_01~world_10）的小怪与 Boss 配上金庸风专属名字（每大关 10 个原著人物 Boss + 专属普通/精英名池），替换当前的「第N关首领/精英/敌手」占位名。

**Architecture:** 新增 `src/content/enemy-names.ts` 作为唯一名字数据源，导出 `enemyName(worldId, rank, stage, index)` 与 `enemyDisplayName(enemyId)` 两个纯函数。`waves.ts` 战斗生成时调用 `enemyName`，并对外 re-export `enemyDisplayName`（`main.ts` 导入路径不变）。名字由敌人 ID（大关+小关+品级+序号）确定性解析，保证战斗名牌与悬榜目标名一致。未开放卷（world_11+）回退到原通用占位名。

**Tech Stack:** TypeScript、Vitest。

## Global Constraints

- 敌人 ID 格式、战斗数值、Boss/精英出现规则（波次 10 出 Boss）一律不改。
- 悬榜目标选取逻辑不改，仍按 enemyId 反查名字显示。
- Boss 名不加门派/称号前缀（如「东邪·黄药师」）。
- 不处理未开放卷（world_11+）命名，其回退到通用占位名。
- 存档 schema、掉落规则、势力数据不变。
- 所有代码注释与提交信息使用中文。
- 提交信息格式：`<emoji> <type>(<scope>): <描述>`，祈使语气，单行 ≤150 字符。

---

### Task 1: 新增敌人命名表与解析纯函数

**Files:**
- Create: `src/content/enemy-names.ts`
- Test: `src/content/enemy-names.test.ts`

**Interfaces:**
- Consumes: `CombatRank` 类型（`src/combat/types.ts` 导出）、`WORLDS`（`src/content/worlds.ts` 导出，仅测试用）。
- Produces:
  - `interface WorldEnemyNames { normal: readonly string[]; elite: readonly string[]; bosses: readonly string[] }`
  - `const ENEMY_NAMES_BY_WORLD: Record<string, WorldEnemyNames>`（world_01~world_10）
  - `function enemyName(worldId: string, rank: CombatRank, stage: number, index: number): string` —— `index` 为 1 起始的敌人序号（对应 enemyId 末尾 `_N`），boss 忽略 `index`。
  - `function enemyDisplayName(enemyId: string): string` —— 解析 enemyId 后委托 `enemyName`。

- [ ] **Step 1: 写失败测试**

`src/content/enemy-names.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { WORLDS } from './worlds'
import { ENEMY_NAMES_BY_WORLD, enemyDisplayName, enemyName } from './enemy-names'

describe('敌人命名表', () => {
  it('已开放 10 卷各有 10 个 Boss、普通名 ≥6、精英名 ≥3', () => {
    for (const world of WORLDS) {
      if (!world.released) continue
      const names = ENEMY_NAMES_BY_WORLD[world.id]
      expect(names, `${world.id} 缺少命名表`).toBeDefined()
      expect(names!.bosses).toHaveLength(10)
      expect(names!.normal.length).toBeGreaterThanOrEqual(6)
      expect(names!.elite.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('跨大关 Boss 不重名', () => {
    const seen = new Set<string>()
    for (const world of WORLDS) {
      if (!world.released) continue
      for (const boss of ENEMY_NAMES_BY_WORLD[world.id].bosses) {
        expect(seen.has(boss)).toBe(false)
        seen.add(boss)
      }
    }
  })

  it('Boss 名随小关号取值', () => {
    expect(enemyName('world_01', 'boss', 1, 1)).toBe('段天德')
    expect(enemyName('world_10', 'boss', 10, 1)).toBe('无崖子')
    expect(enemyDisplayName('world_10_stage_10_boss')).toBe('无崖子')
  })

  it('普通名在名池内循环且同波次 5 个不重名', () => {
    const names = Array.from({ length: 5 }, (_, i) => enemyName('world_03', 'normal', 3, i + 1))
    expect(new Set(names).size).toBe(5)
  })

  it('未开放卷沿用通用占位名，坏 ID 返回未知目标', () => {
    expect(enemyDisplayName('world_11_stage_03_boss')).toBe('第3关首领')
    expect(enemyDisplayName('world_20_stage_05_elite_1')).toBe('第5关精英')
    expect(enemyDisplayName('broken_enemy_id')).toBe('未知目标')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/content/enemy-names.test.ts`
Expected: FAIL —— 模块 `./enemy-names` 不存在（Cannot find module）。

- [ ] **Step 3: 创建 `src/content/enemy-names.ts`**

```ts
import type { CombatRank } from '../combat/types'

export interface WorldEnemyNames {
  normal: readonly string[]
  elite: readonly string[]
  bosses: readonly string[]
}

export const ENEMY_NAMES_BY_WORLD: Record<string, WorldEnemyNames> = {
  world_01: {
    normal: ['村中泼皮', '无赖闲汉', '偷鸡贼', '地痞', '愣头青', '赶集莽汉'],
    elite: ['护院拳师', '金兵什长', '回乡兵痞'],
    bosses: ['段天德', '完颜洪烈', '梁子翁', '灵智上人', '侯通海', '沙通天', '彭连虎', '欧阳克', '梅超风', '曲灵风'],
  },
  world_02: {
    normal: ['市井闲汉', '茶楼伙计', '码头力工', '巡街差役', '鱼市恶霸', '无赖打手'],
    elite: ['醉仙楼护院', '武馆教头', '烟雨楼剑客'],
    bosses: ['张阿生', '韩小莹', '全金发', '南希仁', '韩宝驹', '朱聪', '柯镇恶', '丘处机', '王处一', '马钰'],
  },
  world_03: {
    normal: ['太湖水匪', '划船喽啰', '庄丁', '瞭哨水贼', '搬货苦力', '帮闲'],
    elite: ['水寨头目', '铁掌帮众', '太湖悍匪'],
    bosses: ['陆冠英', '陆乘风', '裘千丈', '陈玄风', '裘千仞', '傻姑', '黄蓉', '周伯通', '程英', '黄药师'],
  },
  world_04: {
    normal: ['巡城卫兵', '段府家丁', '街市闲汉', '白族猎户', '酒肆小二', '捕快'],
    elite: ['御林侍卫', '段家武士', '天龙寺武僧'],
    bosses: ['朱子柳', '武三通', '点苍渔隐', '樵子', '木婉清', '段正淳', '段延庆', '段正明', '枯荣大师', '段智兴'],
  },
  world_05: {
    normal: ['无量剑弟子', '采药人', '神农帮众', '猎户', '山贼', '樵夫'],
    elite: ['无量剑护法', '神农帮副帮主', '剑阵弟子'],
    bosses: ['左子穆', '辛双清', '干光豪', '葛光佩', '司空玄', '钟灵', '段誉', '秦红棉', '李秋水', '天山童姥'],
  },
  world_06: {
    normal: ['渡口船夫', '赶路镖客', '落魄刀客', '更夫', '江湖散人', '驿卒'],
    elite: ['万兽庄驯兽手', '蒙古斥候', '西山夜行客'],
    bosses: ['大头鬼', '催命鬼', '吊死鬼', '史伯威', '史仲猛', '史叔刚', '郭襄', '小龙女', '金轮法王', '神雕大侠'],
  },
  world_07: {
    normal: ['采药童子', '药圃花匠', '谷中仆役', '病愈游侠', '采蜜人', '杂役'],
    elite: ['毒王弟子', '药王侍童', '金花教众'],
    bosses: ['常遇春', '胡青牛', '王难姑', '殷离', '说不得', '周颠', '彭莹玉', '金花婆婆', '韦一笑', '张无忌'],
  },
  world_08: {
    normal: ['燕子坞家丁', '画舫船娘', '市井乞儿', '茶楼歌女', '琴师', '卖花郎'],
    elite: ['参合庄剑侍', '曼陀山庄侍女', '慕容家武士'],
    bosses: ['包不同', '风波恶', '阿碧', '阿朱', '公冶乾', '邓百川', '王语嫣', '王夫人', '鸠摩智', '慕容博'],
  },
  world_09: {
    normal: ['庄中客卿', '江湖豪客', '走镖镖师', '账房先生', '看门力士', '比武闲汉'],
    elite: ['聚贤庄护法', '游氏家将', '武林成名客'],
    bosses: ['谭婆', '谭公', '赵钱孙', '单正', '薛慕华', '游驹', '游骥', '全冠清', '徐长老', '萧峰'],
  },
  world_10: {
    normal: ['星宿派弟子', '守山力士', '持棋道童', '采芝人', '看棋老仆', '星宿小徒'],
    elite: ['星宿护法', '聪辩先生门人', '珍珑守阵人'],
    bosses: ['摘星子', '摩云子', '出尘子', '玄难', '玄寂', '虚竹', '苏星河', '丁春秋', '慕容复', '无崖子'],
  },
}

const fallbackName = (rank: CombatRank, stage: number): string => {
  if (rank === 'boss') return `第${stage}关首领`
  if (rank === 'elite') return `第${stage}关精英`
  return `第${stage}关敌手`
}

export const enemyName = (worldId: string, rank: CombatRank, stage: number, index: number): string => {
  const names = ENEMY_NAMES_BY_WORLD[worldId]
  if (!names) return fallbackName(rank, stage)
  if (rank === 'boss') {
    const bossIndex = Math.max(0, Math.min(stage - 1, names.bosses.length - 1))
    return names.bosses[bossIndex] ?? fallbackName(rank, stage)
  }
  const pool = rank === 'elite' ? names.elite : names.normal
  if (pool.length === 0) return fallbackName(rank, stage)
  return pool[(Math.max(1, index) - 1) % pool.length]
}

export const enemyDisplayName = (enemyId: string): string => {
  const match = enemyId.match(/^world_(\d+)_stage_(\d+)_(normal|elite|boss)(?:_(\d+))?$/)
  if (!match) return '未知目标'
  const worldId = `world_${match[1]}`
  const stage = Number(match[2])
  const rank = match[3] as CombatRank
  const index = rank === 'boss' ? 1 : Number(match[4] ?? '1')
  return enemyName(worldId, rank, stage, index)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/content/enemy-names.test.ts`
Expected: PASS（5 个测试全部通过）。

- [ ] **Step 5: 提交**

```bash
git add egg-jianghu/src/content/enemy-names.ts egg-jianghu/src/content/enemy-names.test.ts
git commit -m "✨ feat(content): 新增前10大关敌人命名表"
```

---

### Task 2: 战斗与悬榜接入大关专属敌人名

**Files:**
- Modify: `src/combat/waves.ts:17-27,46`（本地 `enemyName`/`enemyDisplayName` 改为委托新模块，`createEnemy` 传 `worldId` 与 `index + 1`）
- Test: `src/combat/waves.test.ts`（更新断言）
- Modify: `src/ui/pages.test.ts:29,83`（顺手统一旧占位名 fixture）

**Interfaces:**
- Consumes: `enemyName`、`enemyDisplayName`（Task 1 产物）。
- Produces: `waves.ts` 仍从 `./waves` 导出 `enemyDisplayName`（re-export），`main.ts:294` 的 `import { createWave, enemyDisplayName } from './combat/waves'` 不变。

- [ ] **Step 1: 更新 `src/combat/waves.test.ts` 为真实名字**

将现有 3 条断言与新增回退断言替换为：

```ts
import { describe, expect, it } from 'vitest'
import { enemyDisplayName } from './waves'

describe('敌人显示名称', () => {
  it('将战斗内部 ID 转换为悬榜可读名称', () => {
    expect(enemyDisplayName('world_01_stage_01_normal_1')).toBe('村中泼皮')
    expect(enemyDisplayName('world_03_stage_06_elite_2')).toBe('铁掌帮众')
    expect(enemyDisplayName('world_10_stage_10_boss')).toBe('无崖子')
  })

  it('未开放卷沿用通用占位名', () => {
    expect(enemyDisplayName('world_11_stage_03_boss')).toBe('第3关首领')
  })

  it('不向玩家暴露无法识别的内部 ID', () => {
    expect(enemyDisplayName('broken_enemy_id')).toBe('未知目标')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/combat/waves.test.ts`
Expected: FAIL —— 断言值仍为旧占位名（`第1关敌手` 等）。

- [ ] **Step 3: 修改 `src/combat/waves.ts`**

删除本地 `enemyName` 函数（当前第 17-21 行）与 `enemyDisplayName` 函数（当前第 23-27 行），文件头部改为：

```ts
import { createRng } from './rng'
import { enemyName } from '../content/enemy-names'
import type { CombatRank, CombatSnapshot, CombatUnit } from './types'

export { enemyDisplayName } from '../content/enemy-names'
```

在 `createEnemy` 中把 `name` 生成改为（`index` 为 0 起始的波次位置，`index + 1` 与 enemyId 末尾序号一致）：

```ts
    name: enemyName(worldId, rank, stage, index + 1),
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/combat/waves.test.ts`
Expected: PASS。

再跑一遍全部单元测试确认无回归：
Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 5: 统一 `src/ui/pages.test.ts` 旧 fixture**

将第 29 行 `targetName: '第1关敌手',` 改为 `targetName: '村中泼皮',`，第 83 行 `expect(html).toContain('第1关敌手')` 改为 `expect(html).toContain('村中泼皮')`。

Run: `npx vitest run src/ui/pages.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add egg-jianghu/src/combat/waves.ts egg-jianghu/src/combat/waves.test.ts egg-jianghu/src/ui/pages.test.ts
git commit -m "✨ feat(combat): 战斗与悬榜接入大关专属敌人名"
```

---

### Task 3: 内容完整性校验

**Files:**
- Modify: `src/content/validate.ts`（新增敌人命名表校验）
- Test: `src/content/validate.test.ts`（新增命名表断言）

**Interfaces:**
- Consumes: `ENEMY_NAMES_BY_WORLD`（Task 1 产物）、`WORLDS`。
- Produces: `validateContent(): string[]` 返回值新增命名表错误检查（不改变现有返回结构）。

- [ ] **Step 1: 在 `src/content/validate.test.ts` 新增失败测试**

在 describe 内追加：

```ts
it('每个已开放卷具备完整敌人命名表且 Boss 不重名', () => {
  for (const world of WORLDS) {
    if (!world.released) continue
    const names = ENEMY_NAMES_BY_WORLD[world.id]
    expect(names).toBeDefined()
    expect(names!.bosses).toHaveLength(10)
    expect(names!.normal.length).toBeGreaterThanOrEqual(6)
    expect(names!.elite.length).toBeGreaterThanOrEqual(3)
  }
  expect(validateContent()).toEqual([])
})
```

并将文件头 import 追加：`import { ENEMY_NAMES_BY_WORLD } from './enemy-names'`。

- [ ] **Step 2: 运行测试确认基线**

Run: `npx vitest run src/content/validate.test.ts`
Expected: 因 Task 1 数据已完整，新增的计数断言直接通过；`validateContent()` 在加入新检查前也返回 `[]`，故本步骤仅建立基线。真正的回归防线是计数断言本身（数据一旦被删减即失败），validate.ts 的新检查属于对后续内容编辑的防御性守卫，靠 `validateContent() === []` 验证其不误报。

- [ ] **Step 3: 修改 `src/content/validate.ts`**

文件头追加 `import { ENEMY_NAMES_BY_WORLD } from './enemy-names'`。在 `for (const world of WORLDS)` 循环的 `world.released` 分支内追加：

```ts
      const names = ENEMY_NAMES_BY_WORLD[world.id]
      if (!names) {
        errors.push(`${world.id} 缺少敌人命名表`)
      } else {
        if (names.bosses.length !== 10) errors.push(`${world.id} Boss 数不是 10`)
        if (names.normal.length < 6) errors.push(`${world.id} 普通小怪名少于 6`)
        if (names.elite.length < 3) errors.push(`${world.id} 精英名少于 3`)
      }
```

在循环结束后追加跨大关 Boss 重名校验：

```ts
  const seenBosses = new Set<string>()
  for (const world of WORLDS) {
    if (!world.released) continue
    for (const boss of ENEMY_NAMES_BY_WORLD[world.id]?.bosses ?? []) {
      if (seenBosses.has(boss)) errors.push(`Boss 名重复：${boss}`)
      seenBosses.add(boss)
    }
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/content/validate.test.ts`
Expected: PASS（含既有的「所有内容 id 和交叉引用唯一有效」）。

- [ ] **Step 5: 提交**

```bash
git add egg-jianghu/src/content/validate.ts egg-jianghu/src/content/validate.test.ts
git commit -m "✅ test(content): 校验敌人命名表完整性"
```

---

### Task 4: 完整验证

**Files:** 无（只运行命令）

- [ ] **Step 1: 全量单元测试**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 2: 类型检查与构建**

Run: `npm run build`
Expected: `tsc` 无错误、Vite 构建成功。

- [ ] **Step 3: 端到端测试**

Run: `npm run test:e2e`
Expected: 全部 PASS。

- [ ] **Step 4: 空白检查**

Run: `git diff --check`
Expected: 无输出。

- [ ] **Step 5: 手动抽查（可选）**

Run: `npm run dev`，进入牛家村（world_01）与擂鼓山（world_10）战斗，确认第 10 波 Boss 名牌分别为「曲灵风」「无崖子」，普通小怪为对应大关名池；在势力页悬榜确认 Boss 悬赏目标名与战斗一致。

---

## 自审结果

- **Spec 覆盖**：设计文档的「数据模型」（enemy-names.ts 接口与解析表）→ Task 1；「代码改动」（waves.ts）→ Task 2；「测试调整」（waves.test.ts 断言、validate 校验、pages fixture）→ Task 2/Task 3；「完整验证」→ Task 4。100 个 Boss 名与普通/精英名池全部落在 Task 1 的 `ENEMY_NAMES_BY_WORLD`。
- **占位扫描**：无 TBD/TODO；每个代码步骤均含可直接粘贴的实现。
- **类型一致性**：`enemyName(worldId, rank, stage, index)` 与 `enemyDisplayName(enemyId)` 在 Task 1 定义、Task 2/3 引用，签名一致；`index` 统一为 1 起始序号（Task 2 传 `index + 1`）。
