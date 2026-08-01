# 蛋蛋江湖 2.0

一款基于 Vite、TypeScript 与 Electron 的单机武侠自动刷宝游戏。当前版本使用全新的 version 10 规则与存档。

## 核心规则

- 最多六名侠客组成前后两排、每排三格的阵容。
- 侠客等级与职业等级相互独立；职业按分支转职，武功使用四个主动槽与一个心法槽。
- 每个小关包含十波敌人，第十波由 Boss、精英和小怪组成。
- `驻守` 通关后重复当前关；`闯荡` 通关后推进，失败时回退上一关并切换为驻守。
- 敌人死亡时装备即时进入 300 格背包；背包满后拒绝新装备，但战斗继续。
- 十卷江湖包含独立货币、城市酒馆与武馆；三十个势力提供六格悬榜、侠客邀请和双线武功传承。
- 不包含离线收益、抽卡、秘籍残页、首次通关礼包、铁匠铺或战斗中途恢复。

完整规则见[武侠自动刷宝重铸设计规格](../docs/superpowers/specs/2026-08-01-wuxia-atb-loot-rebuild-design.md)。

## 存档说明

- version 10 使用独立的浏览器 `localStorage` key：`egg-jianghu-2-save-v10`。
- version 10 不读取或迁移 version 1～9 旧档，会从全新存档开始。
- 只保存长期成长、资源、任务和背包；当前战斗不会写入存档。
- 关闭或重载游戏后长期收益保留，但必须重新选择关卡。
- 关闭期间不会推进悬榜倒计时，也不会结算离线收益。

如需彻底重置，在浏览器开发者工具中删除上述 key，或使用游戏提供的重置入口。

## 本地运行

需要 Node.js 与 npm。首次运行先安装依赖：

```powershell
npm install
```

启动浏览器开发版：

```powershell
npm run dev
```

启动 Electron 桌面版：

```powershell
npm run desktop
```

## 自动化验收

```powershell
npm test
npm run build
npm run test:e2e
```

当前重铸验收基线为 69 个 unit tests 与 10 个 Playwright E2E tests；交付时仍应以本机最新命令输出为准。

## Windows 打包

```powershell
npm run desktop:dist
```

成功后主要产物位于 `release/`：

- `蛋蛋江湖2.0-Setup-2.0.0-x64.exe`：Windows 安装版。
- `蛋蛋江湖2.0-Portable-2.0.0-x64.zip`：解压即用版。
- `win-unpacked/蛋蛋江湖2.0.exe`：未打包目录中的启动程序，供冒烟测试使用。

`release/` 已被 Git 忽略，不应提交二进制产物。
