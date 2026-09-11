import { expect, test } from '@playwright/test'
import { SAVE_KEY_V10 } from '../../src/domain/save-v10'

test('福利码限领、赵云上阵、分层筛选；仅福利出现奖励弹窗', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('结缘少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await page.getByTestId('tab-settings').click()
  await page.getByLabel('输入福利码', { exact: true }).fill('错误福利码')
  await page.getByRole('button', { name: '领取福利' }).click()
  await expect(page.locator('.toast')).toContainText('福利码无效')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('输入福利码', { exact: true }).fill('花花蛋无敌')
  await page.getByLabel('输入福利码', { exact: true }).press('Enter')
  await expect(page.getByRole('dialog')).toContainText('赵云 × 1')
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
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByLabel('输入福利码', { exact: true })).toBeFocused()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`welfare-settings-${width}.png`) })
  }
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await page.getByTestId('tab-settings').click()
  await page.getByLabel('输入福利码', { exact: true }).fill('花花蛋无敌')
  await page.getByRole('button', { name: '领取福利' }).click()
  await expect(page.locator('.toast')).toContainText('已领取')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByTestId('tab-heroes').click()
  await page.locator('[data-filter-kind="tier"][data-filter-value="传奇"]').click()
  await expect(page.getByTestId('hero-hero_orig_165')).toContainText('传奇')
  await page.getByTestId('hero-hero_orig_165').click()
  await expect(page.locator('.hb-idtags')).toContainText('传奇')
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_orig_165.recruited)).toBe(true)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const radar = await page.locator('.hb-radar .radar-box').boundingBox()
    const aptitudes = await page.locator('.hb-aptlist').boundingBox()
    const overlapX = Math.min(radar!.x + radar!.width, aptitudes!.x + aptitudes!.width) - Math.max(radar!.x, aptitudes!.x)
    const overlapY = Math.min(radar!.y + radar!.height, aptitudes!.y + aptitudes!.height) - Math.max(radar!.y, aptitudes!.y)
    expect(overlapX <= 0 || overlapY <= 0).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`hero-tier-${width}.png`) })
  }
  // 使用既有阵容 API 验证新增角色可被真实战斗队伍使用。
  await page.evaluate(() => window.__EGG_JIANGHU__.placeHero('hero_orig_165', 0, 1))
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation.some(slot => slot.heroId === 'hero_orig_165'))).toBe(true)
  await page.getByTestId('tab-formation').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('章节招募桌面手机、十连、心愿切换和读档保底持久化', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('招募少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  const data = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY_V10)
  data.idleVouchers.balance = 10_000
  data.heroSummoning = { chapters: { world_01: { sinceHero: 69, sinceLegendary: 279, sinceTarget: 559, targetId: 'hero_orig_9' } } }
  await page.goto('about:blank')
  await page.addInitScript(({ key, data }) => {
    if (!sessionStorage.getItem('summon-funded')) {
      localStorage.setItem(key, JSON.stringify(data))
      sessionStorage.setItem('summon-funded', '1')
    }
  }, { key: SAVE_KEY_V10, data })
  await page.goto('/')
  await page.getByRole('button', { name: '继续游戏' }).click()
  await page.getByTestId('tab-shop').click()
  await page.setViewportSize({ width: 320, height: 960 })
  for (let chapter = 1; chapter <= 13; chapter++) {
    await page.getByLabel('招募章节').selectOption(`world_${String(chapter).padStart(2, '0')}`)
    expect(await page.locator('.summon-hero').count()).toBeGreaterThanOrEqual(3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByLabel('招募章节').selectOption('world_02')
  await expect(page.getByRole('button', { name: '招募一次' })).toBeDisabled()
  await page.getByLabel('招募章节').selectOption('world_01')
  await page.getByRole('button', { name: '招募一次' }).click()
  await expect(page.getByRole('region', { name: '最近招募结果' })).toContainText('关羽 × 1')
  await expect(page.getByRole('region', { name: '最近招募结果' })).toContainText('心愿保障')
  await expect(page.getByTestId('voucher-balance')).toHaveText('9,900')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('心愿传奇', { exact: true }).selectOption('hero_orig_12')
  await page.getByRole('button', { name: '招募十次' }).click()
  await expect(page.getByRole('region', { name: '最近招募结果' }).locator('li')).toHaveCount(10)
  const state = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    await page.getByRole('heading', { name: '章节招募', exact: true }).scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`summoning-${width}.png`) })
    await page.getByTestId('summon-pity').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`summoning-results-${width}.png`) })
  }
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  const restored = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  expect(restored.heroSummoning).toEqual(state.heroSummoning)
  expect(restored.heroes.hero_orig_9).toEqual(state.heroes.hero_orig_9)
  expect(restored.idleVouchers.balance).toBe(state.idleVouchers.balance)
  expect(errors).toEqual([])
})
