# 武学与心法职业限制对接诸天职业体系发布记录

- 业务提交：`8ae2274`（职业对接）与 `cae7e58`（本地控制台测试脚本，不进产物）；前端 release：`20260914_cae7e58`，上一版本 `20260912_22ab00f`。
- 入口：`http://223.6.255.187:5174/`、`https://223.6.255.187/`。
- 发布内容：武学 `careerIds` 按原版机制改为技能类别匹配诸天职业（`job_1`～`job_41`，通用类别 1 不限职业），修复非通用技能对所有职业显示"职不符 · 不可传"的问题；势力心法按势力传承技能类别开放、城市通用心法面向全部职业；`equipHeartMethod` 复用统一兼容判断，修复空限制心法被拒；阵容页站位文案与新建页初始身份改为"拳系武者／白丁"。`LEGACY_CAREER_NAMES` 保留作旧存档残留职业键的显示兜底。
- 存档格式未变（v20，`careerIds` 不入档），云服务 validator 与数据库无需变更，本次仅切换前端。

## 验证

- 694 项单元测试通过；TypeScript / Vite 构建通过，保留既有大 chunk 提示。
- 部署归档 SHA256 上传前后一致：`bb86c9155c9e1c18cec4f9226918eb61230c5457ed6531dc7a7759517517dafa`；公网主 JS SHA256 与本地构建一致（`index-Cz1fBG_F.js`），线上 JS 含"初始身份为白丁／拳系武者"新标识。
- 公网 HTTP 5174 与 HTTPS 443 首页均 200，`/api/health` 返回 `{"ok":true}`。
- 浏览器冒烟：新建游戏页文案已更新，进入游戏控制台零错误；势力页技能"职业"栏此前已在本地 Playwright 验证显示诸天职业名（如类别 2 技能显示"护卫"），通用技能显示"通用"。
- `egg-jianghu`、`egg-cloud`、Nginx 均 active，`Result=success`、`NRestarts=0`；服务器上传临时包已清理。

## 备份与回滚边界

- 新 release 位于 `/var/www/egg-jianghu/releases/20260914_cae7e58`，`current` 已原子切换；`previous-release.txt` 指向 `20260912_22ab00f`。
- 无数据库、云服务、Nginx 或 SMTP 变更；如需回滚，将 `current` 切回上一 release 并重启 `egg-jianghu` 即可，无存档兼容风险（本次发布前后存档格式均为 v20）。
- 构建、部署临时包与测试存档不提交 Git。
