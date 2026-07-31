import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.__EGG_JIANGHU__.reset())
})

test('正文和展示文字会加载内置思源宋体', async ({ page }) => {
  const fontState = await page.evaluate(async () => {
    const [boldFaces, heavyFaces] = await Promise.all([
      document.fonts.load('700 16px "Source Han Serif SC Game"', '蛋蛋江湖'),
      document.fonts.load('400 16px "Source Han Serif SC Game Heavy"', '江湖关卡'),
    ])

    return {
      boldFaces: boldFaces.length,
      heavyFaces: heavyFaces.length,
      rootFamily: getComputedStyle(document.documentElement).fontFamily,
      headingFamily: getComputedStyle(document.querySelector('h1')!).fontFamily,
    }
  })

  expect(fontState.boldFaces).toBe(1)
  expect(fontState.heavyFaces).toBe(1)
  expect(fontState.rootFamily).toContain('Source Han Serif SC Game')
  expect(fontState.headingFamily).toContain('Source Han Serif SC Game Heavy')
})

test('启动后先选择大关卡和小关卡，再开始挂机战斗', async ({ page }, testInfo) => {
  await expect(page).toHaveTitle(/蛋蛋江湖 2\.0/)
  await expect(page.locator('h1')).toHaveText('江湖关卡')
  await expect(page.getByTestId('battle-arena')).toHaveCount(0)
  await expect(page.locator('.region-card')).toHaveCount(3)
  await expect(page.getByTestId('region-card-blackwind_fort').getByRole('button')).toBeDisabled()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().combat.status)).toBe('ready')

  await page.getByRole('button', { name: '进入青石古道' }).click()
  await expect(page.getByTestId('stage-map').locator('.stage-card')).toHaveCount(10)
  await page.getByTestId('stage-card-1').getByRole('button', { name: '开始挂机' }).click()
  await expect(page.getByTestId('battle-arena')).toBeVisible()
  await expect(page.getByText(/第 1 关 · 挂机战斗中/)).toBeVisible()

  await page.getByRole('button', { name: /侠客/ }).click()
  await expect(page.locator('.hero-card')).toHaveCount(9)
  await expect(page.locator('.martial-item')).toHaveCount(5)

  await page.getByRole('button', { name: /队伍/ }).click()
  await expect(page.locator('.party-slot')).toHaveCount(3)
  await page.getByRole('button', { name: /战斗/ }).click()
  await expect(page.getByRole('heading', { name: '青石古道问鼎' })).toBeVisible()
  await expect(page.getByTestId('boss-intel')).toContainText('破阵重击')

  await page.getByRole('button', { name: /关卡/ }).click()
  await page.screenshot({ path: testInfo.outputPath('desktop-idle.png'), fullPage: true })
})

test('可从其他页面通过悬浮入口返回正在进行的挂机战斗', async ({ page }) => {
  await page.getByRole('button', { name: '进入青石古道' }).click()
  await page.getByTestId('stage-card-3').getByRole('button', { name: '开始挂机' }).click()
  await expect(page.getByTestId('idle-combat-return')).toHaveCount(0)

  const defeatsBefore = await page.evaluate(() => window.__EGG_JIANGHU__.getState().statistics.idleEnemiesDefeated)
  await page.getByRole('button', { name: /侠客/ }).click()
  const returnButton = page.getByTestId('idle-combat-return')
  await expect(returnButton).toBeVisible()
  await expect(returnButton).toContainText('青石古道 · 第 3 关')
  expect(await returnButton.evaluate((element) => getComputedStyle(element).animationName)).toBe('none')

  await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(120))
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().statistics.idleEnemiesDefeated)).toBeGreaterThan(defeatsBefore)
  await expect(page.getByRole('heading', { name: '江湖名册' })).toBeVisible()

  await returnButton.click()
  await expect(page.getByRole('heading', { name: '青石古道 · 第 3 关' })).toBeVisible()
  await expect(page.getByTestId('battle-arena')).toBeVisible()
  await expect(page.getByTestId('idle-combat-return')).toHaveCount(0)
  expect(await page.evaluate(() => {
    const combat = window.__EGG_JIANGHU__.getState().combat
    return { mode: combat.mode, status: combat.status, regionId: combat.regionId, stage: combat.stage }
  })).toEqual({ mode: 'idle', status: 'fighting', regionId: 'bluestone_path', stage: 3 })
})

test('可进入秘境、选择临时祝福并完成首层探索', async ({ page }) => {
  await page.getByRole('button', { name: /秘境/ }).click()
  await expect(page.getByTestId('idle-combat-return')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '无相秘境' })).toBeVisible()
  await expect(page.getByTestId('mystery-route').locator(':scope > span')).toHaveCount(5)
  await page.getByRole('button', { name: '踏入无相秘境' }).click()
  await expect(page.getByTestId('mystery-choices').locator('.mystery-choice-grid > button')).toHaveCount(2)

  await page.getByTestId('mystery-choices').locator('.mystery-choice-grid > button').first().click()
  await expect(page.getByTestId('battle-arena')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().combat.mode)).toBe('mystery')
  await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(240))

  await expect(page.getByTestId('mystery-choices')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().mystery.run?.floor)).toBe(1)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '离开秘境' }).click()
  await expect(page.getByRole('button', { name: '踏入无相秘境' })).toBeVisible()
})

test('挂机所得可用于招募同门并激活羁绊', async ({ page }) => {
  await page.getByRole('button', { name: '进入青石古道' }).click()
  await page.getByTestId('stage-card-1').getByRole('button', { name: '开始挂机' }).click()
  await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(160))
  await page.getByRole('button', { name: /侠客/ }).click()
  await page.getByRole('button', { name: /以 220 银两结识/ }).click()
  await expect(page.getByText('燕秋声应邀加入江湖名册')).toBeVisible()

  await page.getByRole('button', { name: /队伍/ }).click()
  await page.locator('select[data-action="party-slot"][data-slot="1"]').selectOption('yan_qiusheng')
  await expect(page.getByText('丐帮共鸣')).toBeVisible()
  await expect(page.getByText(/门派攻势 \+12%/)).toBeVisible()
  await expect(page.getByTestId('bond-atlas').locator('.bond-card')).toHaveCount(5)
  await expect(page.locator('[data-bond-id="green_hill_iron_oath"]')).toHaveClass(/active/)
  await expect(page.locator('[data-bond-id="green_hill_iron_oath"]')).toContainText('并肩生效')

  await page.getByRole('button', { name: /侠客/ }).click()
  await page.getByRole('button', { name: /以 360 银两结识/ }).click()
  await page.getByRole('button', { name: /队伍/ }).click()
  await page.locator('select[data-action="party-slot"][data-slot="1"]').selectOption('jiang_wan')
  await expect(page.getByTestId('combo-codex').locator('.combo-card')).toHaveCount(4)
  await expect(page.locator('[data-combo-id="mountain_river_reflection"]')).toHaveClass(/active/)
  await expect(page.locator('[data-combo-id="mountain_river_reflection"]')).toContainText('当前阵容已激活')
})

test('武学招式会展示预案并在自动战斗中施展', async ({ page }) => {
  await page.getByRole('button', { name: /侠客/ }).click()
  await expect(page.locator('.skill-summary')).toHaveCount(3)
  await expect(page.locator('.martial-item').first()).toContainText('赤浪断岳')

  await page.getByRole('button', { name: /战斗/ }).click()
  await expect(page.getByTestId('skill-plan').locator('.skill-plan-grid > span')).toHaveCount(3)
  await page.getByRole('button', { name: /挑战断碑手/ }).click()
  await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(4))

  await expect(page.locator('.log-skill').first()).toBeVisible()
  await expect(page.locator('.fighter-skill')).toHaveCount(3)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().combat.logs.some((event) => event.kind === 'skill'))).toBe(true)
})

test('可切换前后排阵型且战斗按阵位展示', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: /队伍/ }).click()
  await expect(page.getByRole('heading', { name: '列阵与羁绊' })).toBeVisible()
  await expect(page.getByTestId('formation-front-row').locator('.party-slot')).toHaveCount(2)
  await expect(page.getByTestId('formation-back-row').locator('.party-slot')).toHaveCount(1)
  await expect(page.getByText('磐石阵', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '调至后排' }).first().click()
  await expect(page.getByText('雁行阵', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation.map((slot) => slot.row)))
    .toEqual(['back', 'front', 'back'])
  await page.locator('.party-board').screenshot({ path: testInfo.outputPath('desktop-formation.png') })

  await page.getByRole('button', { name: /关卡/ }).click()
  await page.getByRole('button', { name: '进入青石古道' }).click()
  await page.getByTestId('stage-card-1').getByRole('button', { name: '开始挂机' }).click()
  await expect(page.getByTestId('combat-front-row').locator('.fighter-card')).toHaveCount(1)
  await expect(page.getByTestId('combat-back-row').locator('.fighter-card')).toHaveCount(2)

  await page.getByRole('button', { name: /战斗/ }).click()
  await page.getByRole('button', { name: /挑战断碑手/ }).click()
  await page.getByRole('button', { name: /队伍/ }).click()
  await expect(page.locator('.position-button:not([disabled])')).toHaveCount(0)
})

test('击败克制型 BOSS 后解锁区域并能在刷新后恢复', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: /战斗/ }).click()
  await expect(page.getByTestId('boss-intel')).toContainText('磐石阵')
  await page.getByRole('button', { name: /挑战断碑手/ }).click()
  await expect(page.getByTestId('idle-combat-return')).toHaveCount(0)
  await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(120))
  await expect(page.locator('.battle-result.victory')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().defeatedBossIds)).toContain('boss_stonebreaker')

  await page.reload()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().defeatedBossIds)).toContain('boss_stonebreaker')
  await expect(page.getByRole('button', { name: /战斗/ })).toContainText('已破 1/3')

  await page.getByRole('button', { name: /关卡/ }).click()
  await page.getByRole('button', { name: '进入黑风寨' }).click()
  await expect(page.getByTestId('stage-map').locator('.stage-card')).toHaveCount(10)
  await page.getByTestId('stage-map').screenshot({ path: testInfo.outputPath('desktop-regions-unlocked.png') })
  await page.getByTestId('stage-card-1').getByRole('button', { name: '开始挂机' }).click()
  await expect(page.locator('h1')).toHaveText('黑风寨 · 第 1 关')
  await expect(page.getByTestId('battle-arena')).toContainText('黑铁重甲')
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().selectedRegionId)).toBe('blackwind_fort')

  await page.getByRole('button', { name: /战斗/ }).click()
  await expect(page.getByRole('heading', { name: '黑风寨问鼎' })).toBeVisible()
  await expect(page.getByTestId('boss-intel')).toContainText('雁行阵')
  await page.getByTestId('boss-intel').screenshot({ path: testInfo.outputPath('desktop-blackwind-boss.png') })
})

test('可从界面导出 JSON，导入旧存档时不产生离线收益', async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^蛋蛋江湖存档-\d{4}-\d{2}-\d{2}\.json$/)

  const importedState = await page.evaluate(() => {
    const next = window.__EGG_JIANGHU__.getState()
    next.resources.silver = 4_321
    next.lastTickAt = Date.now() - 60 * 60 * 1000
    next.lastSavedAt = next.lastTickAt
    return next
  })
  await page.locator('body > input[type="file"]').setInputFiles({
    name: '江湖旧档.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(importedState)),
  })

  await expect(page.getByRole('heading', { name: '古道未曾停歇' })).toHaveCount(0)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().resources.silver)).toBe(4_321)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().combat.status)).toBe('ready')
})

test('移动端布局保持可操作', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(() => window.__EGG_JIANGHU__.reset())
  await expect(page.getByRole('button', { name: /关卡/ })).toBeVisible()
  await expect(page.getByTestId('battle-arena')).toHaveCount(0)
  await page.getByRole('button', { name: '进入青石古道' }).click()
  await expect(page.getByTestId('stage-map').locator('.stage-card')).toHaveCount(10)
  await page.getByTestId('stage-card-1').getByRole('button', { name: '开始挂机' }).click()
  await expect(page.getByTestId('battle-arena')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('mobile-idle.png'), fullPage: true })
  await page.getByRole('button', { name: /战斗/ }).click()
  await expect(page.getByTestId('boss-intel')).toBeVisible()
  await page.getByTestId('boss-intel').screenshot({ path: testInfo.outputPath('mobile-boss-intel.png') })
  await page.getByRole('button', { name: /队伍/ }).click()
  await expect(page.locator('.party-slot').first()).toBeVisible()
  await expect(page.getByTestId('idle-combat-return')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('mobile-party.png'), fullPage: true })
})
