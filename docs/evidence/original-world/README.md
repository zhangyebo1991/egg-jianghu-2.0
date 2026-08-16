# 原版势力、城镇与城市经营真值包

本目录由 `npm run evidence:world` 从本机《诸天刷宝录》`_analysis` 生成。生成结果不作为运行时依赖，业务代码不得直接读取本目录中的原始表。

## 原版快照

- 版本：1.2.2.0
- 势力：42（民团 13、正式势力 29）
- 位面主城：13
- 主城公共场所：65
- 正式势力城镇：29
- 势力贡献兑换：396（转职书 29、图纸 290、秘境门票 29、幻型 48）
- 非空建筑：25
- 科技：75

## 文件

- `manifest.json`：原版记录、跨表关系、原始城市表、源文件指纹与运行时索引。
- `field-dictionary.md`：逐列字段状态；未知列保留原始值，不猜测语义。
- `field-usage-index.json`：从事件树和运行时表达式函数提取的逐次字段读写证据。
- `field-usage-index.md`：按表和固定列汇总的人工审阅索引。
- `city-layout.md`：`cscz` 的 18×18 城市地块压缩布局与存档字段。
- `formula-index.md`：从原版事件表和 `_all_func_names.txt` 定位的相关函数入口。
- `faction-runtime-evidence.json`：势力资源、声望、兑换、任务与解锁函数的逐表达式证据。
- `faction-runtime-evidence.md`：上述函数的人工审阅版索引。
- `faction-exchange-catalog.json`：完整贡献兑换商品、名称、价格输入、声望门槛和目标映射。
- `faction-exchange-catalog.md`：上述 396 条兑换商品的人工审阅表。
- `save-contract.md`：新存档共享状态边界。
- `verification-checklist.md`：开发前仍需完成的运行时与实机核验。
- `egg-jianghu/src/content/original-towns.generated.ts`：运行时使用的主城、公共场所与势力城镇快照。
- `egg-jianghu/src/content/original-faction-exchange.generated.ts`：运行时使用的完整势力贡献兑换目录。

## 证据规则

- “已确认”可直接进入后续生成器。
- “待运行时复核”只能作为检索线索，复核前不得进入公式或存档。
- “待解码”只保留原始列和值。
- 源文件 SHA-256 变化时必须重新生成并审阅差异。
