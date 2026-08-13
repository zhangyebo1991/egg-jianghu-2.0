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

test('侠客页本阶段不提供行囊与批量丢弃', async ({ page }) => {
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(5))
  await page.getByTestId('tab-heroes').click()

  await expect(page.getByTestId('hero-inventory-panel')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '批量丢弃' })).toHaveCount(0)
  await expect(page.getByTestId('hero-career-panel')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().inventory)).toHaveLength(5)
})
