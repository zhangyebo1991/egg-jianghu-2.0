import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('测试少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await expect(page.getByTestId('world-overview')).toBeVisible()
})

test('头像品级角标叠在头像右上角且名册不产生横向滚动', async ({ page }) => {
  await page.getByTestId('tab-formation').click()

  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) return null
      const box = element.getBoundingClientRect()
      return { left: box.left, top: box.top, right: box.right, width: box.width }
    }
    const rosterList = document.querySelector<HTMLElement>('.formation-roster-list')
    return {
      rosterOverflowX: rosterList ? getComputedStyle(rosterList).overflowX : null,
      rosterScrollWidth: rosterList?.scrollWidth ?? null,
      rosterClientWidth: rosterList?.clientWidth ?? null,
      rosterFrame: rect('.formation-roster-row .formation-portrait-frame'),
      rosterSeal: rect('.formation-roster-row .formation-portrait-frame > .formation-grade-seal'),
      detailFrame: rect('.formation-hero-card .formation-portrait-frame'),
      detailSeal: rect('.formation-hero-card .formation-portrait-frame > .formation-grade-seal'),
      detailName: rect('.formation-hero-card h2'),
    }
  })

  expect(metrics.rosterOverflowX).toBe('hidden')
  expect(metrics.rosterScrollWidth).toBe(metrics.rosterClientWidth)
  expect(metrics.rosterSeal?.left).toBeLessThan(metrics.rosterFrame?.right ?? 0)
  expect(metrics.rosterSeal?.top).toBeLessThan(metrics.rosterFrame?.top ?? 0)
  expect(metrics.detailSeal?.left).toBeLessThan(metrics.detailFrame?.right ?? 0)
  expect(metrics.detailSeal?.top).toBeLessThan(metrics.detailFrame?.top ?? 0)
  expect(metrics.detailName?.width).toBeGreaterThan(0)
})

const dragToSlot = async (page: Page, source: string, target: string): Promise<void> => {
  const found = await page.evaluate(({ source, target }) => {
    const from = document.querySelector(source)
    const to = document.querySelector(target)
    if (!from || !to) return false
    const dataTransfer = new DataTransfer()
    from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }))
    to.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }))
    to.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }))
    return true
  }, { source, target })
  if (!found) await page.dragAndDrop(source, target)
}

test('桌面拖拽：已占格拖到另一已占格交换位置', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_guo_jing')
    window.__EGG_JIANGHU__.placeHero('hero_guo_jing', 'back', 0)
  })
  await page.getByTestId('tab-formation').click()

  await dragToSlot(page, '[data-row="front"][data-position="0"]', '[data-row="back"][data-position="0"]')

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual(expect.arrayContaining([
    { heroId: 'hero_player', row: 'back', position: 0 },
    { heroId: 'hero_guo_jing', row: 'front', position: 0 },
  ]))
})

test('桌面拖拽：已占格拖到名单区下阵', async ({ page }) => {
  await page.getByTestId('tab-formation').click()
  await dragToSlot(page, '[data-row="front"][data-position="0"]', '.formation-roster')

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual([])
})

test('桌面点击已占格不产生任何阵容变化', async ({ page }) => {
  await page.getByTestId('tab-formation').click()
  await page.locator('[data-row="front"][data-position="0"]').click()

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual([{ heroId: 'hero_player', row: 'front', position: 0 }])
})

test.describe('触屏视口', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

  test('触屏点击流：点选侠客后点空格置入，点角落×下阵', async ({ page }) => {
    await page.evaluate(() => {
      window.__EGG_JIANGHU__.recruitHero('hero_guo_jing')
    })
    await page.getByTestId('tab-formation').click()

    await page.getByTestId('formation-hero-hero_guo_jing').click()
    await page.locator('[data-row="back"][data-position="1"]').click()

    let formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
    expect(formation).toEqual(expect.arrayContaining([
      { heroId: 'hero_player', row: 'front', position: 0 },
      { heroId: 'hero_guo_jing', row: 'back', position: 1 },
    ]))

    await page.locator('.formation-slot-remove[data-hero-id="hero_guo_jing"]').click()
    formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
    expect(formation).toEqual([{ heroId: 'hero_player', row: 'front', position: 0 }])
  })
})
