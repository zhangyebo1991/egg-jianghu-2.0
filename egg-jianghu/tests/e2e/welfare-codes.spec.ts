import { openPanel } from './ink-helpers'
import { expect, test } from '@playwright/test'

test('福利码限领、赵云上阵与桌面手机奖励弹窗', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('结缘少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await openPanel(page, 'settings')
  await page.getByLabel('输入福利码', { exact: true }).fill('错误福利码')
  await page.getByRole('button', { name: '领取福利' }).click()
  await expect(page.locator('.toast')).toContainText('福利码无效')
  await expect(page.getByTestId('welfare-rewards')).toHaveCount(0)
  await page.getByLabel('输入福利码', { exact: true }).fill('花花蛋无敌')
  await page.getByLabel('输入福利码', { exact: true }).press('Enter')
  await expect(page.getByTestId('welfare-rewards')).toContainText('赵云 × 1')
  await expect(page.getByRole('button', { name: '收下福利' })).toBeFocused()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    const dialog = page.getByTestId('welfare-rewards')
    const box = await dialog.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    expect(await dialog.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`welfare-reward-${width}.png`) })
  }
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('welfare-rewards')).toHaveCount(0)
  await expect(page.getByLabel('输入福利码', { exact: true })).toBeFocused()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`welfare-settings-${width}.png`) })
  }
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await openPanel(page, 'settings')
  await page.getByLabel('输入福利码', { exact: true }).fill('花花蛋无敌')
  await page.getByRole('button', { name: '领取福利' }).click()
  await expect(page.locator('.toast')).toContainText('已领取')
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await openPanel(page, 'heroes')
  await expect(page.getByTestId('hero-hero_orig_165')).toContainText('赵云')
  await page.getByTestId('hero-hero_orig_165').click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_orig_165.recruited)).toBe(true)
  // 使用既有阵容 API 验证新增角色可被真实战斗队伍使用。
  await page.evaluate(() => window.__EGG_JIANGHU__.placeHero('hero_orig_165', 0, 1))
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation.some(slot => slot.heroId === 'hero_orig_165'))).toBe(true)
  await openPanel(page, 'formation')
  await expect(page.getByTestId('welfare-rewards')).toHaveCount(0)
  expect(errors).toEqual([])
})
