# 原版现世城市初始地块矩阵

`cscz.json` 是一张压缩存放的 18×18 城市地块初始矩阵。初始化事件只处理 `CurX ≤ 17`、`CurY ≤ 17`，并把每个地块写入 `save` 的 depth 10。

## 坐标

- 源表第 0～17 列对应地块 x 坐标；第 18～19 列是当前快照全空的保留列。
- 每段源表行以 `CurX` 表示地块 y 坐标。
- 存档第 11 列保存 x（`cscz.CurY()`），第 12 列保存 y（`cscz.CurX()`）。

## 压缩行段

| 源表行 | 逻辑字段 | save 列 | 运行时证据 |
|---|---|---:|---|
| 0～17 | `buildingId` | 1 | 后续通过 `jz` 表读取建筑名称、类型与场景 |
| 20～37 | `buildingLevel` | 2 | 建筑界面以 Lv 显示并在升级时递增 |
| 34～51 | `landPriceTier` | 45 | `土地价格function` 以该值三次方参与地价计算 |

第 34～37 行同时属于两个偏移读取窗口，这是原表压缩布局和初始化表达式的直接结果，不应在生成阶段自行去重或改写。

## 地块存档字段

| save 列 | 字段 |
|---:|---|
| 0 | `tileId` |
| 1 | `buildingId` |
| 2 | `buildingLevel` |
| 11 | `gridX` |
| 12 | `gridY` |
| 45 | `landPriceTier` |

`field-usage-index.json` 的 `targetedCitySaveUsages` 保留这些字段在初始化、建筑、土地、公司和城市属性链中的逐次读写表达式，共 547 条。
