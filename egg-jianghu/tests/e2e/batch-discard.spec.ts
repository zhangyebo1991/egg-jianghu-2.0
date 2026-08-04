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

test('侠客页按稀有度批量丢弃并释放背包空间', async ({ page }) => {
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(5))
  await page.getByTestId('tab-heroes').click()

  const panel = page.getByTestId('hero-inventory-panel')
  await expect(panel.locator('[data-equipment-uid]')).toHaveCount(5)

  await panel.locator('[data-batch-discard-quality]').selectOption('凡品')
  await panel.getByRole('button', { name: '批量丢弃' }).click()
  await expect(panel).toContainText('确认丢弃 5 件装备')

  await panel.getByRole('button', { name: '确认丢弃' }).click()
  await expect(page.getByRole('status')).toHaveText('已丢弃 5 件凡品及以下装备')
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().inventory)).toHaveLength(0)
})

test('批量丢弃确认条可取消且不改变库存', async ({ page }) => {
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(3))
  await page.getByTestId('tab-heroes').click()

  const panel = page.getByTestId('hero-inventory-panel')
  await panel.locator('[data-batch-discard-quality]').selectOption('凡品')
  await panel.getByRole('button', { name: '批量丢弃' }).click()
  await panel.getByRole('button', { name: '取消' }).click()

  await expect(panel.locator('[data-batch-discard-quality]')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().inventory)).toHaveLength(3)
})
