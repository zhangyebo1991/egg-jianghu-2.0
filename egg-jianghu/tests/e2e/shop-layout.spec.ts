import { expect, test } from '@playwright/test'

test('商城栏目分开展示，商城背包阵容设置共享宽屏与手机内容边界', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('页面布局核验')
  await page.getByLabel('玩家姓名').press('Enter')
  await page.getByTestId('tab-shop').click()
  await expect(page.getByTestId('ordinary-hero-pool')).toBeVisible()
  await expect(page.getByTestId('premium-card-monthly')).toHaveCount(0)
  await page.getByRole('button', { name: '收益特权', exact: true }).click()
  await expect(page.getByTestId('ordinary-hero-pool')).toHaveCount(0)
  await expect(page.getByTestId('premium-card-monthly')).toBeVisible()
  await page.getByRole('button', { name: '侠客招募', exact: true }).click()
  await expect(page.getByTestId('ordinary-hero-pool')).toBeVisible()
  for (const width of [2560, 1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    const edges: Array<{ x: number; width: number }> = []
    for (const tab of ['shop', 'inventory', 'formation', 'settings']) {
      await page.getByTestId(`tab-${tab}`).click()
      const bounds = await page.locator(`.${tab}-page`).boundingBox()
      expect(bounds).not.toBeNull()
      edges.push(bounds!)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`${tab}-${width}.png`) })
    }
    for (const edge of edges.slice(1)) {
      expect(Math.abs(edge.x - edges[0]!.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(edge.width - edges[0]!.width)).toBeLessThanOrEqual(1)
    }
  }
})
