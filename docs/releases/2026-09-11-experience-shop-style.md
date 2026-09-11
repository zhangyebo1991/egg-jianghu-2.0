# 经验修正与商城设置样式发布记录

- 日期：2026-09-11。
- 业务版本：`b778c15`，包含`f1e1df0`职业经验修正、`5fc2c87`战斗经验与升级门槛修正，以及商城／设置样式调整。
- 前端：`/var/www/egg-jianghu/releases/20260911_b778c15`。
- 云服务：`/opt/egg-jianghu-cloud/releases/20260911_b778c15`；随本次客户端重新构建validator.mjs，避免校验规则分叉。
- HTTPS：`https://223.6.255.187`；旧HTTP入口继续保留`http://223.6.255.187:5174`。
- 侠客分层与卡池名单仍是文档方案，未作为玩法上线。

## 验证

- 667项客户端单测、3项云服务集成测试、TypeScript与Vite生产构建通过。
- 4项浏览器回归通过：经验门槛与旧档等级保留（桌面／手机）、蛋蛋购卡及续期到期／阵容加成、设置持久化与战斗波次显示。
- 上传前后归档SHA256一致：前端`9ea67cd122183b7412579949494855a2633da857503967b657c98f6788eacb6d`，云服务`e27f6d5f4ca67013d22aa2f6f749149aa30ce92a9aaa908365a0751d64ac8744`。
- 远端直接调用新validator确认非零蛋蛋、周月卡有效期、尾数、旧档缺省初始化，以及44级角色经验4399／4级职业经验2000完整保留。仅使用合成测试存档，无线上账号或玩家云档写入。
- 公网HTTPS和旧HTTP的首页、主JS和CSS均HTTP200，SHA256与本地构建相同；TLS校验和公网`/api/health`通过。
- `egg-jianghu`、`egg-cloud`、`nginx`均active；两应用enabled，`NRestarts=0`、`Result=success`。

- 公网桌面1440与手机390宽度的新建游戏、商城和设置检查通过，无页面异常或横向溢出；四张截图已查看，位于`test-results/deploy-b778c15-{shop,settings}-{1440,390}.png`。使用隔离浏览器本地新档，未注册账号或上传云档。
- 首次公网截图因等待字体超过30秒而超时；延长至120秒后完成。原字体文件较大，本轮未改字体资源。

## 数据保护与回滚

- 切换前使用SQLite backup API生成`/var/backups/egg-jianghu-cloud/pre-20260911_b778c15.sqlite`，`PRAGMA quick_check`通过。
- 两个current分别原子切换。上一版本均为`20260911_eggs_38e0536`，各release内`previous-release.txt`保留原绝对路径。
- 保留原静态server.mjs；未变更数据库结构、SMTP配置、Nginx配置或5173服务。
- 如需回滚，将对应current原子切回上一release并重启该应用服务；数据库不随应用回滚覆盖，避免丢失发布后进度。
- 构建与上传包、备份准备脚本、验收临时文件均不提交Git。
