import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.__EGG_JIANGHU__.reset())
})

test('启动后可见挂机战斗并能访问四个核心 Tab', async ({ page }, testInfo) => {
  await expect(page).toHaveTitle(/蛋蛋江湖 2\.0/)
  await expect(page.locator('h1')).toHaveText('青石古道')
  await expect(page.getByTestId('battle-arena')).toBeVisible()
  await expect(page.getByText('自动历练中')).toBeVisible()
  await expect(page.locator('.region-card')).toHaveCount(3)
  await expect(page.getByTestId('region-card-blackwind_fort').getByRole('button')).toBeDisabled()

  await page.getByRole('button', { name: /侠客/ }).click()
  await expect(page.locator('.hero-card')).toHaveCount(9)
  await expect(page.locator('.martial-item')).toHaveCount(5)

  await page.getByRole('button', { name: /队伍/ }).click()
  await expect(page.locator('.party-slot')).toHaveCount(3)
  await page.getByRole('button', { name: /战斗/ }).click()
  await expect(page.getByRole('heading', { name: '青石古道问鼎' })).toBeVisible()
  await expect(page.getByTestId('boss-intel')).toContainText('破阵重击')

  await page.getByRole('button', { name: /挂机/ }).click()
  await page.screenshot({ path: testInfo.outputPath('desktop-idle.png'), fullPage: true })
})

test('挂机所得可用于招募同门并激活羁绊', async ({ page }) => {
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

  await page.getByRole('button', { name: /挂机/ }).click()
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
  await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(120))
  await expect(page.locator('.battle-result.victory')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().defeatedBossIds)).toContain('boss_stonebreaker')

  await page.reload()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().defeatedBossIds)).toContain('boss_stonebreaker')
  await expect(page.getByRole('button', { name: /战斗/ })).toContainText('已破 1/3')

  await page.getByRole('button', { name: /挂机/ }).click()
  await page.getByRole('button', { name: '前往黑风寨' }).click()
  await expect(page.locator('h1')).toHaveText('黑风寨')
  await expect(page.getByTestId('battle-arena')).toContainText('黑铁重甲')
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().selectedRegionId)).toBe('blackwind_fort')
  await page.locator('.region-map').screenshot({ path: testInfo.outputPath('desktop-regions-unlocked.png') })

  await page.getByRole('button', { name: /战斗/ }).click()
  await expect(page.getByRole('heading', { name: '黑风寨问鼎' })).toBeVisible()
  await expect(page.getByTestId('boss-intel')).toContainText('雁行阵')
  await page.getByTestId('boss-intel').screenshot({ path: testInfo.outputPath('desktop-blackwind-boss.png') })
})

test('可从界面导出 JSON，并导入旧存档触发离线结算', async ({ page }) => {
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

  await expect(page.getByRole('heading', { name: '古道未曾停歇' })).toBeVisible()
  await expect(page.getByText(/离开江湖的 1时/)).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().resources.silver)).toBeGreaterThan(4_321)
  await page.getByRole('button', { name: '收下历练所得' }).click()
  await expect(page.getByRole('heading', { name: '古道未曾停歇' })).toBeHidden()
})

test('移动端布局保持可操作', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(() => window.__EGG_JIANGHU__.reset())
  await expect(page.getByRole('button', { name: /挂机/ })).toBeVisible()
  await expect(page.getByTestId('battle-arena')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('mobile-idle.png'), fullPage: true })
  await page.getByRole('button', { name: /战斗/ }).click()
  await expect(page.getByTestId('boss-intel')).toBeVisible()
  await page.getByTestId('boss-intel').screenshot({ path: testInfo.outputPath('mobile-boss-intel.png') })
  await page.getByRole('button', { name: /队伍/ }).click()
  await expect(page.locator('.party-slot').first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('mobile-party.png'), fullPage: true })
})
