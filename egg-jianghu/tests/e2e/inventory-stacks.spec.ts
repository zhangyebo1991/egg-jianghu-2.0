import { openPanel } from './ink-helpers'
import { expect, test } from '@playwright/test'
import { SAVE_KEY_V10 } from '../../src/domain/save-v10'

test('背包展示堆叠数量、分类搜索、物品详情与实时入库', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1536, height: 960 })
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('背包核验')
  await page.getByLabel('玩家姓名').press('Enter')
  await page.evaluate(key => {
    const api = window.__EGG_JIANGHU__
    api.fillInventory(2)
    const state = api.getState()
    state.materials = { '11': 12, '12': 3, '5': 2, '6': 1, '7': 0 }
    localStorage.setItem(key, JSON.stringify(state))
  }, SAVE_KEY_V10)
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await openPanel(page, 'inventory')
  await expect(page.getByRole('heading', { name: '行囊', exact: true })).toBeVisible()
  await expect(page.locator('[data-action="inventory-stack-select"]')).toHaveCount(4)
  await expect(page.getByTestId('stack-item-11')).toContainText('×12')
  await expect(page.getByTestId('stack-item-7')).toHaveCount(0)
  await page.locator('[data-action="inventory-category"][data-category="material"]').click()
  await expect(page.locator('[data-action="inventory-select"]')).toHaveCount(0)
  await expect(page.locator('[data-action="inventory-stack-select"]')).toHaveCount(2)
  const search = page.getByRole('searchbox', { name: '搜索背包物品' })
  await search.pressSequentially('灵耀')
  await expect(search).toHaveValue('灵耀')
  await expect(page.locator('[data-action="inventory-stack-select"]')).toHaveCount(1)
  await page.getByTestId('stack-item-12').click()
  await expect(page.getByTestId('inventory-detail')).toContainText('持有数量：3')
  await expect(page.getByTestId('inventory-detail').locator('[data-action="inventory-discard"]')).toHaveCount(0)
  await search.fill('不存在的物品')
  await expect(page.locator('.inventory-empty')).toBeVisible()
  await expect(page.getByTestId('inventory-detail')).not.toContainText('灵耀矿砂')
  await search.fill('')
  await page.locator('[data-action="inventory-category"][data-category="special"]').click()
  await expect(page.locator('[data-action="inventory-stack-select"]')).toHaveCount(2)
  await page.getByTestId('stack-item-5').click()
  await expect(page.getByTestId('inventory-detail')).toContainText('秘境门票')
  await expect(page.getByRole('navigation', { name: '部位筛选' })).toHaveCount(0)
  await page.locator('[data-action="inventory-category"][data-category="equipment"]').click()
  await expect(page.locator('[data-action="inventory-stack-select"]')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: '部位筛选' })).toBeVisible()
  await expect(page.locator('[data-action="inventory-select"]')).toHaveCount(2)
  await page.locator('[data-action="inventory-category"][data-category="material"]').click()
  await page.evaluate(() => {
    const api = window.__EGG_JIANGHU__
    for (let seed = 1; seed <= 100 && api.getState().materials['11'] === 12; seed++) api.settleEnemy(seed)
  })
  const count = await page.evaluate(() => window.__EGG_JIANGHU__.getState().materials['11'])
  expect(count).toBeGreaterThan(12)
  await expect(page.getByTestId('stack-item-11')).toContainText(`×${count}`)
  await page.screenshot({ path: testInfo.outputPath('backpack-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '关闭详情' }).click()
  await page.getByTestId('stack-item-11').click()
  await expect(page.getByTestId('inventory-detail')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('backpack-mobile.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('居中桌面行囊按三栏空间动态分页，内容区不推动整页滚动', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1536, height: 960 })
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('动态分页验收')
  await page.getByLabel('玩家姓名').press('Enter')
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(300))
  await openPanel(page, 'inventory')

  await page.waitForFunction(() => {
    const pager = document.querySelector<HTMLElement>('[data-testid="inventory-pager"]')
    return Boolean(pager?.dataset.gridColumns && pager.dataset.gridRows && pager.dataset.cellSize)
  })
  const firstMetrics = await page.evaluate(() => {
    const layout = document.querySelector<HTMLElement>('.inventory-layout')!
    const main = document.querySelector<HTMLElement>('.game-main')!
    const gridWrap = document.querySelector<HTMLElement>('.inventory-grid-wrap')!
    const grid = document.querySelector<HTMLElement>('.inventory-grid')!
    const cell = document.querySelector<HTMLElement>('.inventory-cell')!
    const pager = document.querySelector<HTMLElement>('[data-testid="inventory-pager"]')!
    const boxes = [...layout.children].map(element => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    })
    const columns = Number(pager.dataset.gridColumns)
    const rows = Number(pager.dataset.gridRows)
    return {
      boxes,
      pageSize: Number(pager.dataset.pageSize),
      columns,
      rows,
      cellSize: Number(pager.dataset.cellSize),
      actualCellSize: Math.round(cell.getBoundingClientRect().width),
      gridColumns: getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length,
      mainClientHeight: main.clientHeight,
      mainScrollHeight: main.scrollHeight,
      scrollModes: {
        roster: getComputedStyle(document.querySelector('.ink-bag-roster')!).overflowY,
        grid: getComputedStyle(gridWrap).overflowY,
        side: getComputedStyle(document.querySelector('.ink-bag-side')!).overflowY,
      },
    }
  })
  expect(firstMetrics.boxes).toHaveLength(3)
  expect(firstMetrics.boxes.every(box => Math.abs(box.y - firstMetrics.boxes[0].y) < 1)).toBe(true)
  expect(firstMetrics.boxes[0].x).toBeLessThan(firstMetrics.boxes[1].x)
  expect(firstMetrics.boxes[1].x).toBeLessThan(firstMetrics.boxes[2].x)
  expect(firstMetrics.pageSize).toBe(firstMetrics.columns * firstMetrics.rows)
  expect(firstMetrics.gridColumns).toBe(firstMetrics.columns)
  expect(firstMetrics.cellSize).toBe(firstMetrics.actualCellSize)
  expect(firstMetrics.mainScrollHeight).toBe(firstMetrics.mainClientHeight)
  expect(firstMetrics.scrollModes).toEqual({ roster: 'auto', grid: 'auto', side: 'auto' })
  await expect(page.getByTestId('inventory-pager')).toContainText(`/ ${Math.ceil(300 / firstMetrics.pageSize)} 页`)
  await page.screenshot({ path: testInfo.outputPath('inventory-centered-1536.png') })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForFunction((initialPageSize) => {
    const pager = document.querySelector<HTMLElement>('[data-testid="inventory-pager"]')
    const columns = Number(pager?.dataset.gridColumns)
    const rows = Number(pager?.dataset.gridRows)
    const pageSize = Number(pager?.dataset.pageSize)
    return columns > 0 && rows > 0 && pageSize === columns * rows && pageSize !== initialPageSize
  }, firstMetrics.pageSize)
  const resizedPageSize = await page.getByTestId('inventory-pager').getAttribute('data-page-size')
  expect(Number(resizedPageSize)).toBeGreaterThan(0)
  expect(Number(resizedPageSize)).not.toBe(firstMetrics.pageSize)
  expect(errors).toEqual([])
})
