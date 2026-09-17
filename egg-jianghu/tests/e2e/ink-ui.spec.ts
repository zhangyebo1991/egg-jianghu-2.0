import { expect, test } from '@playwright/test'
import { openPanel, openFactionSection } from './ink-helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('水墨少侠')
  await page.getByLabel('玩家姓名').press('Enter')
})

test('选关确认、后台战斗、关闭回焦与停止返回关卡', async ({ page }) => {
  await page.getByTestId('stage-1').click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getCombat())).toBeNull()
  await page.getByTestId('start-roam').click()
  await expect(page.getByTestId('ink-panel')).toHaveCount(0)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getSelection()?.mode)).toBe('roam')
  await page.getByTestId('mode-guard').click()
  await openPanel(page, 'heroes')
  const before = await page.evaluate(() => window.__EGG_JIANGHU__.getCombat()!.elapsedMs)
  await expect.poll(() => page.evaluate(() => window.__EGG_JIANGHU__.getCombat()!.elapsedMs)).toBeGreaterThan(before)
  await page.keyboard.press('Shift+Tab')
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.ink-leaf')))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('tab-heroes')).toBeFocused()
  await expect(page.getByTestId('ink-panel')).toHaveCount(0)
  const token = page.locator('[data-action="inspect-combat-hero"]').first()
  await token.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#ink-leaf-title')).toHaveText('侠客')
  await page.keyboard.press('Escape')
  await expect(token).toBeFocused()
  await page.getByTestId('stop-combat').click()
  await expect(page.locator('#ink-leaf-title')).toHaveText('关卡')
  await expect(page.getByTestId('stage-overview')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getCombat())).toBeNull()
})

test('侧停靠、遮罩关闭和职业树 Escape 各自返回上一层', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openPanel(page, 'heroes')
  await page.locator('[data-action="dock-ink-panel"]').click()
  const box = await page.getByTestId('ink-panel').boundingBox()
  expect(box!.x + box!.width).toBe(1440)
  expect(box!.width).toBe(580)
  await page.locator('[data-action="hero-main-tab"][data-main-tab="career"]').click()
  await page.getByTestId('open-career-tree').click()
  await expect(page.getByTestId('career-tree')).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.career-tree-dialog')))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('career-tree')).toHaveCount(0)
  await expect(page.getByTestId('ink-panel')).toBeVisible()
  await expect(page.getByTestId('open-career-tree')).toBeFocused()
  await page.locator('.ink-scrim').click({ position: { x: 4, y: 450 } })
  await expect(page.getByTestId('ink-panel')).toHaveCount(0)
})

for (const width of [1440, 390]) {
  test(`行囊选择侠客穿脱装备，物品与存档保持一致 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(6))
    await openPanel(page, 'inventory')
    const item = page.getByTestId('equipment-debug-equipment-5')
    await item.click()
    await page.locator('[data-action="inventory-equip"]').click()
    await expect(item).toHaveCount(0)
    const worn = page.locator('.ink-equipped button:not(:disabled)')
    await expect(worn).toHaveCount(1)
    if (width < 700) await page.getByRole('button', { name: '关闭详情', exact: true }).click()
    await worn.click()
    await expect(item).toBeVisible()
    await expect(worn).toHaveCount(0)
    await page.reload()
    await page.getByRole('button', { name: '继续游戏' }).click()
    await openPanel(page, 'inventory')
    await expect(item).toBeVisible()
  })
}

test('行囊品质、排序与部位筛选共同生效且不修改物品', async ({ page }) => {
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(30))
  const before = await page.evaluate(() => window.__EGG_JIANGHU__.getState().inventory)
  await openPanel(page, 'inventory')
  await page.locator('[data-action="inventory-quality"][data-quality="3"]').click()
  const cells = page.locator('.inventory-cell')
  await expect(cells).toHaveCount(3)
  expect(await cells.evaluateAll(elements => elements.every(element => element.getAttribute('data-rarity') === '3'))).toBe(true)
  await page.locator('[data-action="inventory-quality"][data-quality="all"]').click()
  await page.locator('[data-action="inventory-sort"][data-sort="quality"]').click()
  const qualities = await cells.evaluateAll(elements => elements.map(element => Number(element.getAttribute('data-rarity'))))
  expect(qualities).toEqual([...qualities].sort((a, b) => b - a))
  await page.locator('[data-action="inventory-filter"][data-inventory-slot="weapon"]').click()
  await expect(cells).toHaveCount(9)
  await page.locator('[data-action="inventory-sort"][data-sort="level"]').click()
  const levels = await cells.locator('.inventory-cell-level').allTextContents()
  const numbers = levels.map(level => Number(level.replace('Lv.', '')))
  expect(numbers).toEqual([...numbers].sort((a, b) => b - a))
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().inventory)).toEqual(before)
})

test('横屏三路与首领令牌避开气机和操作区，桌面手机均保持可读', async ({ page }, testInfo) => {
  for (const size of [
    { width: 1440, height: 900 }, { width: 390, height: 844 },
    { width: 844, height: 390 }, { width: 812, height: 375 }, { width: 740, height: 360 },
  ]) {
    await page.setViewportSize(size)
    for (const wave of [9, 10]) {
      const layout = await page.evaluate(wave => {
        const api = window.__EGG_JIANGHU__
        api.startStage('world_01', 1, 'guard', 19)
        api.showWave(wave, 19)
        const timeline = document.querySelector('.combat-action-timeline')!.getBoundingClientRect()
        const controls = document.querySelector('.battle-controls')!.getBoundingClientRect()
        return {
          enemies: document.querySelectorAll('.combat-unit.enemy').length,
          units: [...document.querySelectorAll('.combat-unit')].map(unit => {
            const rect = unit.getBoundingClientRect()
            return { top: rect.top, bottom: rect.bottom }
          }),
          timelineTop: timeline.top, timelineBottom: timeline.bottom, controlsTop: controls.top,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }
      }, wave)
      expect(layout.enemies).toBe(wave === 10 ? 6 : 5)
      expect(layout.overflow).toBe(false)
      for (const unit of layout.units) {
        expect(unit.top).toBeGreaterThan(60)
        expect(unit.bottom).toBeLessThan(layout.timelineTop - 8)
      }
      expect(layout.timelineBottom).toBeLessThan(layout.controlsTop)
      if (wave === 10) await page.screenshot({ path: testInfo.outputPath(`ink-battle-${size.width}.png`), animations: 'disabled' })
    }
  }
})

test('窄屏所有册页与四项势力事务均可操作，内容不横向溢出', async ({ page }) => {
  test.setTimeout(60_000)
  for (const width of [390, 360, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await openPanel(page, 'idle')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: '关闭册页', exact: true })).toBeFocused()
    for (const tab of ['idle', 'inventory', 'heroes', 'formation', 'shop', 'city', 'settings']) {
      await openPanel(page, tab)
      expect(await page.locator('.game-main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    for (const section of ['quests', 'exchange', 'recruit', 'martials'] as const) {
      await openFactionSection(page, section)
      expect(await page.locator('.game-main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    }
    await openPanel(page, 'heroes')
    await page.locator('[data-action="hero-main-tab"][data-main-tab="career"]').click()
    await page.getByTestId('open-career-tree').click()
    expect(await page.locator('.ct-scroll').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
    expect(await page.locator('.ct-node').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().width >= 50))).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.keyboard.press('Escape')
  }
})
