# 云账号与云存档实施记录

目标：本地游戏保持现状，邮箱验证注册、登录、密码重置；每个账号仅一份当前云存档，手动上传/下载。

## 接入与部署

- 服务端：`egg-jianghu/cloud`，Node 24、SQLite、Nodemailer。复用 `src/cloud/validator.ts` 导出的本地 v19 校验；不接受旧版本。
- 账号密码用 scrypt（N=32768/r=8/p=3）加盐哈希；登录令牌仅内存保存，服务端保存令牌哈希，24 小时有效。刷新/关闭页面需重新登录。
- 注册/找回验证码：6 位，10 分钟，单次使用，5 次错误失效；邮箱 60 秒冷却、每小时最多 5 次；IP 与登录频率限流。重置密码注销所有旧会话。
- 云档按账号 ID 唯一；修订号比较和写入在同一数据库事务完成。账号归属由会话确定。
- 客户端：开始页、设置页均有账号入口。上传明确覆盖云端，下载先获取与校验再确认，确认时再检查云档修订号。下载保留一份本机恢复备份、退出战斗并回到开始页。
- HTTP 旧地址通过 HTTPS 弹窗进行账号操作，仅使用来源、窗口对象和随机标记均匹配的 `postMessage` 传递存档。密码与令牌不跨窗口发送。桌面端直接连接 HTTPS API。
- 用户提供的 `docs/qq邮箱授权码.txt` 已加入 Git 忽略；授权码仅写入服务器 root 可读配置，不随前端或仓库分发。

## 服务端位置

- HTTPS：`https://223.6.255.187`；原游戏：`http://223.6.255.187:5174`，原有 5173 服务不变。
- 云接口：Nginx `/api/` → `127.0.0.1:8787`；`egg-cloud.service` 使用独立系统用户。
- 云服务：`/opt/egg-jianghu-cloud/current`，数据 `/var/lib/egg-jianghu-cloud/cloud.sqlite`。
- 私密配置：`/etc/egg-jianghu-cloud/environment`，权限 600 root。
- Node：`/opt/egg-cloud-runtime/node-v24.18.0-linux-x64`，独立于原静态服务 Node 18。
- 证书：`/etc/letsencrypt/live/egg-cloud-ip`；`egg-cloud-cert.timer` 每六小时检查续期并重载 Nginx。
- 数据库运维备份：`egg-cloud-backup.timer` 每日执行，SQLite backup API，`/var/backups/egg-jianghu-cloud` 保留七份。这些不是用户多存档槽位。

## 验证进度

- 已通过：617 项原有单测、云服务三个集成场景、两个浏览器场景（真实 API 注册/上传/下载/备份恢复及 HTTP/HTTPS 双窗口）、桌面与手机截图、生产构建。
- 已通过：公网 TLS/API、真实 QQ 注册验证码收件、注册登录、线上云档上传下载与冲突、真实密码重置收件及旧会话注销。
- 已通过：旧 HTTP 到 HTTPS 弹窗的线上下载回写、备份与退出。测试环境续期两次遇到证书机构 secondary validation RPC 错误；正式环境真实续期与 nginx reload 成功，定时服务执行正常。验收账号已清理。
- 已通过：弹窗每次上传重新读取原窗口最新快照，关闭弹窗返回原游戏；对应生产构建浏览器回归已通过，并部署到前端 cloud_2。
- 当前前端与云服务 release：`20260911_eggs_38e0536`；上一版本均为 `20260911_cloud_2`。新增蛋蛋与周月卡存档字段，发布验证及兼容回滚要求见 [蛋蛋商城发布记录](releases/2026-09-11-eggs-shop.md)。数据库不随 release 回滚。

验收使用专用临时账号完成真实收发邮件，随后定向清理该账号及其验收存档、会话。用户提供的原始授权码文件保留在本机且 Git 忽略；生成的临时登录凭据已删除。
