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

test('行囊页按等阶出售下拉按当前世界结算铜钱', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 960 })
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(30))
  await openPanel(page, 'inventory')

  await page.getByRole('button', { name: '按等阶出售' }).click()
  await expect(page.locator('.inventory-sellpop')).toBeVisible()
  await expect(page.locator('.inventory-sellpop .sp-opt')).toHaveCount(10)
  await expect(page.locator('.inventory-sellpop .sp-opt').first()).toContainText('粗糙及以下')

  // fillInventory 按品质 0-9 循环填充，粗糙（0）恰有 3 件，等级均为 1，单件售价 44。
  await page.locator('[data-action="inventory-sell-quality"][data-quality="0"]').click()
  await expect(page.locator('.inventory-sellpop')).toHaveCount(0)
  const after = await page.evaluate(() => {
    const state = window.__EGG_JIANGHU__.getState()
    return { currency: state.worldCurrency.world_01, count: state.inventory.length }
  })
  expect(after.count).toBe(27)
  expect(after.currency).toBe(1132)

  await page.getByRole('button', { name: '按等阶出售' }).click()
  await expect(page.locator('.inventory-sellpop')).toBeVisible()
  await page.getByRole('button', { name: '整理囊袋' }).click()
  await expect(page.locator('.inventory-sellpop')).toHaveCount(0)
})

test('侠客页移除行囊面板后在多种宽度下版式不溢出', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 911 })
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(300))
  await openPanel(page, 'heroes')

  // 行囊面板已移除，穿戴与出售都在行囊页办理
  await expect(page.getByTestId('hero-inventory-panel')).toHaveCount(0)

  for (const tab of ['basic', 'equipment', 'career']) {
    await page.locator(`[data-action="hero-main-tab"][data-main-tab="${tab}"]`).click()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920)
    await page.screenshot({ path: testInfo.outputPath(`heroes-wide-${tab}.png`) })
  }
  for (const width of [1440, 1180, 640, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const tab of ['basic', 'equipment', 'career']) {
      await page.locator(`[data-action="hero-main-tab"][data-main-tab="${tab}"]`).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    }
    await page.screenshot({ path: testInfo.outputPath(`heroes-${width}.png`), fullPage: true })
  }
})
