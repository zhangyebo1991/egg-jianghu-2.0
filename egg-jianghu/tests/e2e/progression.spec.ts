import { expect, test, type Page, type TestInfo } from '@playwright/test'

const createGame = async (page: Page): Promise<void> => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('秘境验收')
  await page.getByLabel('玩家姓名').press('Enter')
  await page.getByTestId('tab-progression').click()
  await expect(page.getByTestId('progression-page')).toBeVisible()
}

const expectNoPageOverflow = async (page: Page): Promise<void> => {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1)
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1)
}

const capture = async (page: Page, testInfo: TestInfo, name: string): Promise<void> => {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled' })
}

test.describe('秘境高阶玩法页面', () => {
  let pageErrors: string[]
  let consoleErrors: string[]

  test.beforeEach(async ({ page }) => {
    pageErrors = []
    consoleErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
  })

  test.afterEach(() => {
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('桌面端可浏览五个子页且超长内容由主区滚动', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await createGame(page)

    await expect(page.locator('.game-nav .nav-item')).toHaveCount(5)
    await expect(page.locator('.dungeon-card')).toHaveCount(7)
    await expect(page.locator('.dungeon-card').first().locator('.dungeon-reward-list > span')).toHaveCount(30)
    const mainScroll = await page.locator('.game-main').evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }))
    expect(mainScroll.scrollHeight).toBeGreaterThan(mainScroll.clientHeight)
    expect(mainScroll.overflowY).toMatch(/auto|scroll/)
    const navBottom = await page.locator('.game-nav .nav-item').last().evaluate((element) => element.getBoundingClientRect().bottom)
    const dangerTop = await page.locator('.sidebar-danger-zone').evaluate((element) => element.getBoundingClientRect().top)
    expect(navBottom).toBeLessThan(dangerTop)
    await expectNoPageOverflow(page)
    await capture(page, testInfo, 'desktop-dungeons')

    await page.locator('.game-main').evaluate((element) => { element.scrollTop = element.scrollHeight })
    await expect(page.locator('.progression-page-foot')).toBeInViewport()
    await page.locator('.game-main').evaluate((element) => { element.scrollTop = 0 })
    const firstDungeon = page.locator('.dungeon-card').first()
    await firstDungeon.locator('[data-action="progression-complete-dungeon"]').click()
    await expect(firstDungeon).toContainText('通关 1')

    await page.locator('[data-action="progression-section"][data-section="beasts"]').click()
    await expect(page.getByTestId('progression-beasts')).toBeVisible()
    await expect(page.locator('.beast-card').first()).toContainText('圣兽战斗难度 1100')
    await expect(page.locator('.beast-card').first()).toContainText('轮回难度未通关')
    await page.locator('[data-action="progression-clear-beast"]').first().click()
    await expect(page.locator('.toast')).toContainText('需通关东汉三国轮回难度')
    await capture(page, testInfo, 'desktop-beasts')
    await expect(page.locator('.toast')).toBeHidden({ timeout: 3_000 })

    await page.locator('[data-action="progression-section"][data-section="divine"]').click()
    await expect(page.getByTestId('progression-divine')).toContainText('神界尚未开启')
    await expect(page.getByTestId('progression-divine')).not.toContainText('-1')
    await capture(page, testInfo, 'desktop-divine')

    await page.locator('[data-action="progression-section"][data-section="forge"]').click()
    await expect(page.getByTestId('progression-forge')).toBeVisible()
    await capture(page, testInfo, 'desktop-forge')

    await page.locator('[data-action="progression-section"][data-section="interworld"]').click()
    await expect(page.locator('.interworld-card')).toHaveCount(48)
    await capture(page, testInfo, 'desktop-interworld')
  })

  test.describe('移动端', () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

    test('五个子页签可横向滚动且页面不产生横向溢出', async ({ page }, testInfo) => {
      await createGame(page)

      const tabs = page.locator('.progression-tabs')
      await expect(tabs.locator('button')).toHaveCount(5)
      const tabMetrics = await tabs.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflowX: getComputedStyle(element).overflowX,
      }))
      expect(tabMetrics.scrollWidth).toBeGreaterThan(tabMetrics.clientWidth)
      expect(tabMetrics.overflowX).toMatch(/auto|scroll/)
      const navBottom = await page.locator('.game-nav .nav-item').last().evaluate((element) => element.getBoundingClientRect().bottom)
      const dangerTop = await page.locator('.sidebar-danger-zone').evaluate((element) => element.getBoundingClientRect().top)
      expect(navBottom).toBeLessThan(dangerTop)
      await expectNoPageOverflow(page)
      await capture(page, testInfo, 'mobile-dungeons')

      await tabs.locator('[data-section="interworld"]').scrollIntoViewIfNeeded()
      await tabs.locator('[data-section="interworld"]').click()
      await expect(page.getByTestId('progression-interworld')).toBeVisible()
      await expect(page.locator('.interworld-card')).toHaveCount(48)
      await expectNoPageOverflow(page)
      await capture(page, testInfo, 'mobile-interworld')
    })
  })
})
