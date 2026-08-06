/* 素材接入视觉验证：逐页截图到 ../tmp/asset-verify/ */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:4173'
const OUT = path.resolve(__dirname, '../../tmp/asset-verify')

const shot = async (page, name) => {
  await page.waitForTimeout(450)
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  console.log('shot:', name)
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (error) => console.error('PAGE ERROR:', error.message))

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.click('[data-action="new-game"]')
  await page.fill('#player-name', '验证侠客')
  await page.keyboard.press('Enter')
  await page.waitForSelector('.app-shell', { timeout: 8000 })

  // 1. 江湖总览：世界卡场景图
  await shot(page, '01-worlds')

  // 2. 进入世界 → 关卡列表
  await page.click('[data-testid="world-world_01"]')
  await shot(page, '02-stages')

  // 3. 开战：战斗单位头像 + 战场背景
  await page.click('[data-testid="stage-1"]')
  await page.waitForSelector('.combat-unit', { timeout: 8000 })
  await page.waitForTimeout(1600)
  await shot(page, '03-combat')

  // 4. 城市（酒馆头像 / 武功图标 / 信物图标）
  await page.click('[data-testid="world-section-city"]')
  await shot(page, '04-city')

  // 5. 势力（牌匾图标 / 拜帖头像 / 武功详情图标）
  await page.click('[data-testid="world-section-factions"]')
  await shot(page, '05-factions')
  await page.click('.faction-node-button')
  await shot(page, '06-faction-martial')

  // 6. 侠客页（名册头像 / 列传大头照 / 职业武功图标）
  await page.click('[data-testid="tab-heroes"]')
  await shot(page, '07-heroes')

  // 7. 阵容页（名册 / 令牌 / 身手帖头像）
  await page.click('[data-testid="tab-formation"]')
  await page.click('[data-testid="formation-hero-hero_player"]').catch(() => {})
  await shot(page, '08-formation')

  await browser.close()
  console.log('DONE')
})().catch((error) => { console.error(error); process.exit(1) })
