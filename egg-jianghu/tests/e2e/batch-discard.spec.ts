import { openPanel } from './ink-helpers'
import { expect, test } from '@playwright/test'

let pageErrors: string[]

test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('测试少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await expect(page.getByTestId('world-overview')).toBeVisible()
})

test.afterEach(() => {
  expect(pageErrors).toEqual([])
})

test('侠客页提供行囊与按等阶售出', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(60))
  await openPanel(page, 'heroes')

  await expect(page.getByTestId('hero-inventory-panel')).toBeVisible()
  await expect(page.getByRole('button', { name: '按等阶售出' })).toBeVisible()

  // Hover first quality 3 item if present to inspect tooltip
  const q3Cell = page.locator('.pack-cell[data-quality="3"]').first()
  if (await q3Cell.count() > 0) {
    await q3Cell.hover()
  }

  await page.getByTestId('hero-inventory-panel').screenshot({ path: 'verification-q3-blue.png' })
})

test('侠客册行囊独立滚动且分页完整覆盖装备', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 911 })
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(300))
  await openPanel(page, 'heroes')
  const grid = page.locator('.pack-grid')
  await expect.poll(() => grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(/\s+/).length)).toBeGreaterThanOrEqual(4)
  for (const tab of ['basic', 'equipment', 'career']) {
    await page.locator(`[data-action="hero-main-tab"][data-main-tab="${tab}"]`).click()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920)
    await page.screenshot({ path: testInfo.outputPath(`heroes-wide-${tab}.png`) })
  }
  const packBounds = await grid.boundingBox()
  const pagerBounds = await page.locator('.pack-page').boundingBox()
  expect(packBounds!.y + packBounds!.height).toBeLessThanOrEqual(pagerBounds!.y + 1)
  const seen = new Set<string>()
  for (;;) {
    const ids = await grid.locator('.pack-cell').evaluateAll((cells) => cells.map((cell) => (cell as HTMLElement).dataset.equipmentUid!))
    for (const id of ids) {
      expect(seen.has(id)).toBe(false)
      seen.add(id)
    }
    const next = page.locator('.pack-page .pg-btn').last()
    if (await next.isDisabled()) break
    await next.click()
  }
  expect(seen.size).toBe(300)
  for (const width of [1440, 1180, 640, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const tab of ['basic', 'equipment', 'career']) {
      await page.locator(`[data-action="hero-main-tab"][data-main-tab="${tab}"]`).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    }
    await page.screenshot({ path: testInfo.outputPath(`heroes-${width}.png`), fullPage: true })
  }
})
