// 蛋蛋江湖 2.0 · 浏览器控制台一键升级脚本
//
// 用法：
//   1. 打开游戏页面，建议退到标题界面执行（游戏运行中会定期用内存数据覆盖存档）
//   2. F12 打开控制台（Console），粘贴本脚本回车
//   3. 页面自动刷新，点「继续游戏」即可看到效果
//
// 适用存档：v20（key 为 egg-jianghu-2-save-v19 的明文 JSON）。
// 若提示版本不符，先点一次「继续游戏」让旧档自动迁移保存，回到标题后再执行。

;(async () => {
  const KEY = 'egg-jianghu-2-save-v19'
  const TARGET_LEVEL = 99   // 目标等级
  const ONLY_PLAYER = false // true = 只升主角；false = 全部已招募侠客

  const raw = localStorage.getItem(KEY)
  if (!raw) { console.error('❌ 未找到存档：请先新建游戏'); return }
  const save = JSON.parse(raw)
  if (save.version !== 20) {
    console.error(`❌ 存档版本为 v${save.version}，脚本适配 v20。请先点一次「继续游戏」完成迁移，回到标题后再执行。`)
    return
  }

  let touched = 0
  for (const [id, hero] of Object.entries(save.heroes ?? {})) {
    if (!hero || hero.recruited !== true) continue
    if (ONLY_PLAYER && id !== 'hero_player') continue
    hero.level = TARGET_LEVEL
    hero.experience = 0
    // 按需打开以下注释：送 10 万技能点（学技能测试用）
    // hero.skillPoints = 100000
    // 按需打开以下注释：已解锁职业全部拉满 10 级（转职测试用）
    // for (const record of Object.values(hero.careers ?? {})) { record.level = 10; record.experience = 0 }
    touched++
  }
  if (!touched) { console.error('❌ 没有已招募的侠客'); return }

  localStorage.setItem(KEY, JSON.stringify(save))
  console.log(`✅ 已将 ${touched} 名侠客升至 Lv.${TARGET_LEVEL}（经验清零），即将刷新页面…`)
  setTimeout(() => location.reload(), 300)
})()
