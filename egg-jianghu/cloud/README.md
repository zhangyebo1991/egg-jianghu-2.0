# 蛋蛋江湖云服务

每个已验证邮箱账号只有一份当前云存档，上传下载由用户主动触发。游戏仍在本地运行。

## 本地验证

需要 Node.js 24 或更新版本。从 `egg-jianghu/cloud` 执行：

```sh
npm ci
npm test
```

`npm run build` 把客户端的存档校验打包成服务端模块，避免两端版本规则分叉。测试只使用内存邮件接收器和临时数据库，不向真实邮箱发信。

从 `egg-jianghu` 执行：

```sh
npm test
npm run build
npm run test:e2e -- tests/e2e/cloud.spec.ts
```

浏览器测试需要先运行云服务测试生成 validator。第二个浏览器场景使用生产构建，验证 HTTP/HTTPS 双窗口存档传递。

## 配置

复制 `.env.example` 的字段到服务器受保护的 EnvironmentFile。应用不自动读取 `.env` 文件，由 systemd 注入。不要将真实密码或授权码写入源码、构建环境变量或命令行。

```text
SMTP_USER=专用QQ邮箱
SMTP_PASS=该邮箱的SMTP授权码
DB_PATH=/var/lib/egg-jianghu-cloud/cloud.sqlite
PORT=8787
ALLOWED_ORIGINS=https://223.6.255.187,null
```

`null` 用于 Electron 的 file 页面来源；API 仍要求有效的 Bearer 会话。登录令牌不会写入游戏存档、本地存储或日志。

## 部署

配置模板在 `deploy/`。首次部署应检查端口 80、443、8787，保留既有 5173/5174 服务。配置 nginx 的 ACME webroot 后申请 IP 证书，再安装正式 HTTPS 配置。短期证书必须启用续期定时器及 nginx reload hook。

云服务发布目录包含 `server.mjs`、`validator.mjs`、`package.json`、`package-lock.json` 和 `deploy/`；运行 `npm ci --omit=dev --ignore-scripts`，再原子切换 `current` 并重启 `egg-cloud.service`。数据库和 SMTP 配置放在发布目录外。

前端仍使用原 release/current 结构。保留旧 HTTP 地址：其本地存档属于旧浏览器 origin，不能直接重定向后当作存档丢失。HTTPS 账号弹窗验证来源、窗口和随机标记，只传输存档；每次上传都重新读取原窗口最新进度，关闭后回到原游戏。

参考：[Certbot IP 证书和续期](https://letsencrypt.org/2026/03/11/shorter-certs-certbot)。当前服务器路径、验证证据与回滚版本见根目录 `docs/cloud-save-implementation.md`。

## API

- `POST /api/auth/code`：邮箱和 register/reset 用途；验证码统一提示，避免暴露注册状态。
- `POST /api/auth/register`、`POST /api/auth/reset`：邮箱、密码、验证码。
- `POST /api/auth/login`：返回短期会话；`POST /api/auth/logout`：注销当前会话。
- `GET /api/save/meta`、`GET /api/save`：只读取当前会话账号的云档。
- `PUT /api/save`：`{ revision, data }`，初次 revision 为 0，冲突返回 409。
- `GET /api/health`：不包含账号、配置或存档数据的健康检查。

数据库每日通过 SQLite backup API 备份，保留七份运维快照；它们不作为玩家可选的多存档槽位。恢复数据库前应停止云服务并保留当前数据库副本，不能只复制运行中的主文件而忽略 WAL。
