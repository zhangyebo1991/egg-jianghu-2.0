import { openPanel } from './ink-helpers'
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('测试少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await expect(page.getByTestId('world-overview')).toBeVisible()
})

test('头像品级角标叠在头像右下角且名册不产生横向滚动', async ({ page }) => {
  await openPanel(page, 'formation')

  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) return null
      const box = element.getBoundingClientRect()
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width }
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
  expect(metrics.rosterSeal?.bottom).toBeGreaterThan(metrics.rosterFrame?.bottom ?? 0)
  expect(metrics.detailSeal?.left).toBeLessThan(metrics.detailFrame?.right ?? 0)
  expect(metrics.detailSeal?.bottom).toBeGreaterThan(metrics.detailFrame?.bottom ?? 0)
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
    window.__EGG_JIANGHU__.placeHero('hero_guo_jing', 0, 2)
  })
  await openPanel(page, 'formation')

  await dragToSlot(page, '.formation-slot[data-row="1"][data-col="0"]', '.formation-slot[data-row="0"][data-col="2"]')

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual(expect.arrayContaining([
    { heroId: 'hero_player', row: 0, col: 2 },
    { heroId: 'hero_guo_jing', row: 1, col: 0 },
  ]))
})

test('桌面拖拽：已占格拖到名单区下阵', async ({ page }) => {
  await openPanel(page, 'formation')
  await dragToSlot(page, '.formation-slot[data-row="1"][data-col="0"]', '.formation-roster')

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual([])
})

test('桌面点击已占格不产生任何阵容变化', async ({ page }) => {
  await openPanel(page, 'formation')
  await page.locator('.formation-slot[data-row="1"][data-col="0"]').click()

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual([{ heroId: 'hero_player', row: 1, col: 0 }])
})

test.describe('触屏视口', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

  test('触屏点击流：点选侠客后点空格置入，点角落×下阵', async ({ page }) => {
    await page.evaluate(() => {
      window.__EGG_JIANGHU__.recruitHero('hero_guo_jing')
    })
    await openPanel(page, 'formation')

    await page.getByTestId('formation-hero-hero_guo_jing').click()
    await page.locator('.formation-slot[data-row="2"][data-col="1"]').click()

    let formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
    expect(formation).toEqual(expect.arrayContaining([
      { heroId: 'hero_player', row: 1, col: 0 },
      { heroId: 'hero_guo_jing', row: 2, col: 1 },
    ]))

    await page.locator('.formation-slot-remove[data-hero-id="hero_guo_jing"]').click()
    formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
    expect(formation).toEqual([{ heroId: 'hero_player', row: 1, col: 0 }])
  })
})


test('战斗期间可查看阵容但不能点击或拖拽改阵，退出后恢复', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_guo_jing')
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 13)
  })
  const before = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  await openPanel(page, 'formation')
  await expect(page.locator('.formation-field-head')).toContainText('战斗进行中')
  for (const action of ['formation-remove', 'formation-auto-arrange', 'formation-clear']) {
    const buttons = page.locator(`[data-action="${action}"]`)
    for (const button of await buttons.all()) await expect(button).toBeDisabled()
  }
  await expect(page.locator('[data-testid="formation-page"] [draggable="true"]')).toHaveCount(0)
  await page.getByTestId('formation-hero-hero_guo_jing').click()
  await expect(page.getByTestId('formation-hero-card')).toContainText('郭靖')
  await page.getByTestId('formation-slot-0-4').click()
  await dragToSlot(page, '[data-testid="formation-hero-hero_guo_jing"]', '[data-testid="formation-slot-0-4"]')
  await dragToSlot(page, '.formation-token', '.formation-roster')
  // 即使DOM中移除disabled，处理器仍应保护战斗编队。
  for (const action of ['formation-remove', 'formation-auto-arrange', 'formation-clear']) {
    await page.locator(`[data-action="${action}"]`).first().evaluate(element => {
      element.removeAttribute('disabled')
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)).toEqual(before)
  await openPanel(page, 'heroes')
  await openPanel(page, 'formation')
  await page.screenshot({ path: testInfo.outputPath('formation-battle-locked.png'), fullPage: true, animations: 'disabled' })
  await page.getByTestId('idle-combat-return').click()
  await page.locator('[data-action="stop-combat"]').click()
  await openPanel(page, 'formation')
  await expect(page.locator('[data-action="formation-auto-arrange"]')).toBeEnabled()
  await page.getByTestId('formation-hero-hero_guo_jing').click()
  await page.getByTestId('formation-slot-0-4').click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)).toContainEqual({ heroId: 'hero_guo_jing', row: 0, col: 4 })
})
