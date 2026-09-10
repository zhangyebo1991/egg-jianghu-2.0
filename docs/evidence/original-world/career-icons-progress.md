# 原版职业图标接入

- 从本机原包 `_analysis/data.json` 的「职业标识」动画及 `zy.json` 第 2 列匹配，提取 41 个职业的第 0 帧，无缺失；41 张图片哈希均不同。
- `node egg-jianghu/scripts/generate-career-icons.mjs` 重建无损 WebP 和 `career-icons-assets.json`，保留透明通道、处理图集旋转，缺失时直接报错。
- `careerIconAsset` 按职业 `zyId` 取图，职业树节点、详情及其他复用该函数的职业入口同步替换；心法和类别图保留现有用途。
- 验证：4 项资源单测、1 项职业树浏览器测试、TypeScript / Vite 构建通过；职业树截图已查看，全部图标加载正常。构建仍有既有大 chunk 提示。
