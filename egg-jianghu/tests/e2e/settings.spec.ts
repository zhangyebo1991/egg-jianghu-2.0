import { expect, test } from '@playwright/test'

test('设置保存品质门槛且战斗第九波横排清晰，桌面和手机无溢出', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('设置少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await page.getByTestId('tab-settings').click()
  const quality = page.getByLabel('自动丢弃低品质装备')
  await expect(quality).toHaveValue('off')
  await quality.selectOption('3')
  await expect(page.getByRole('status')).toContainText('优秀及以上')
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await page.getByTestId('tab-settings').click()
  await expect(quality).toHaveValue('3')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`settings-${width}.png`) })
  }
  await quality.selectOption('off')
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().settings.autoDiscardBelowQuality)).toBeNull()
  await page.evaluate(() => {
    const api = window.__EGG_JIANGHU__
    api.startStage('world_01', 1, 'guard', 19)
    api.showWave(9, 19)
  })
  await page.getByTestId('idle-combat-return').click()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    const progress = page.getByLabel('战斗进度')
    await expect(progress).toContainText('第 9 / 10 波')
    await expect(progress.locator('.divider-status').first()).toBeVisible()
    expect(await progress.locator('.divider-status').first().evaluate(el => getComputedStyle(el).writingMode)).toBe('horizontal-tb')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`combat-wave-9-${width}.png`) })
  }
  expect(errors).toEqual([])
})
