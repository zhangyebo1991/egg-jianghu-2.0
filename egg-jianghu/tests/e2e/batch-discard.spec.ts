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
  await page.getByTestId('tab-heroes').click()

  await expect(page.getByTestId('hero-inventory-panel')).toBeVisible()
  await expect(page.getByRole('button', { name: '按等阶售出' })).toBeVisible()

  // Hover first quality 3 item if present to inspect tooltip
  const q3Cell = page.locator('.pack-cell[data-quality="3"]').first()
  if (await q3Cell.count() > 0) {
    await q3Cell.hover()
  }

  await page.getByTestId('hero-inventory-panel').screenshot({ path: 'verification-q3-blue.png' })
})
