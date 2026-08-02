import { expect, test, type Page } from '@playwright/test'

let pageErrors: string[]

test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
})

test.afterEach(() => {
  expect(pageErrors).toEqual([])
})

const createGame = async (page: Page, playerName: string): Promise<void> => {
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill(playerName)
  await page.getByLabel('玩家姓名').press('Enter')
}

test('首次进入可新建角色并以玩家姓名直接开始第一关战斗', async ({ page }) => {
  await expect(page.getByTestId('title-page')).toBeVisible()
  await expect(page.getByRole('button', { name: '继续游戏' })).toBeDisabled()

  await createGame(page, '燕七')
  await page.getByTestId('tab-heroes').click()
  await expect(page.getByTestId('hero-hero_player')).toContainText('燕七')

  await page.getByTestId('tab-idle').click()
  await page.getByTestId('world-world_01').click()
  await page.getByTestId('stage-1').click()
  await expect(page.locator('.combat-unit.party[data-unit-id="hero_player"]')).toContainText('燕七')
})

test('空白姓名保留在新建页并显示精确错误', async ({ page }) => {
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').press('Enter')

  await expect(page.getByTestId('new-game-page')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveText('请输入玩家姓名')
})

test('重载后可继续并保留姓名与初始阵型', async ({ page }) => {
  await createGame(page, '燕七')
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()

  const state = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  expect(state.heroes.hero_player.customName).toBe('燕七')
  expect(state.formation).toContainEqual({ heroId: 'hero_player', row: 'front', position: 0 })
})

test('覆盖存档可取消保留旧角色，也可确认创建新角色', async ({ page }) => {
  await createGame(page, '旧少侠')
  await page.reload()
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('新少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await expect(page.getByTestId('overwrite-confirmation')).toBeVisible()

  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByTestId('title-page')).toBeVisible()
  await page.getByRole('button', { name: '继续游戏' }).click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.customName)).toBe('旧少侠')

  await page.reload()
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('新少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await page.getByRole('button', { name: '确认覆盖并开始' }).click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.customName)).toBe('新少侠')
})

test('确认删档后回到新建页且标题页不可继续', async ({ page }) => {
  await createGame(page, '燕七')
  await page.locator('[data-action="request-reset-save"]').click()
  await expect(page.getByTestId('reset-save-confirmation')).toBeVisible()
  await page.locator('[data-action="confirm-reset-save"]').click()

  await expect(page.getByTestId('new-game-page')).toBeVisible()
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page.getByTestId('title-page')).toBeVisible()
  await expect(page.getByRole('button', { name: '继续游戏' })).toBeDisabled()
})

test('未请求删档时忽略伪造的确认操作并保留当前进度', async ({ page }) => {
  await createGame(page, '燕七')

  await page.evaluate(() => {
    const button = document.createElement('button')
    button.dataset.action = 'confirm-reset-save'
    document.querySelector('#app')?.append(button)
    button.click()
  })

  await expect(page.getByTestId('world-overview')).toBeVisible()
  expect(await page.evaluate(() => window.localStorage.getItem('egg-jianghu-2-save-v10'))).not.toBeNull()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.customName)).toBe('燕七')
})

test('覆盖前重新检查存档并在存档变化后要求再次确认', async ({ page }) => {
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('燕七')
  await page.evaluate(() => window.localStorage.setItem('egg-jianghu-2-save-v10', 'marker-1'))
  await page.getByLabel('玩家姓名').press('Enter')

  await expect(page.getByTestId('overwrite-confirmation')).toBeVisible()
  expect(await page.evaluate(() => window.localStorage.getItem('egg-jianghu-2-save-v10'))).toBe('marker-1')

  await page.evaluate(() => window.localStorage.setItem('egg-jianghu-2-save-v10', 'marker-2'))
  await page.getByRole('button', { name: '确认覆盖并开始' }).click()
  await expect(page.getByTestId('overwrite-confirmation')).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('存档已发生变化，请重新确认覆盖')
  expect(await page.evaluate(() => window.localStorage.getItem('egg-jianghu-2-save-v10'))).toBe('marker-2')

  await page.getByRole('button', { name: '确认覆盖并开始' }).click()
  await expect(page.getByTestId('world-overview')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.customName)).toBe('燕七')
})

test('移动端删档确认使用可读且可操作的居中面板', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await createGame(page, '燕七')
  await page.locator('[data-action="request-reset-save"]').click()

  const confirmation = page.getByTestId('reset-save-confirmation')
  await expect(confirmation).toBeVisible()
  const box = await confirmation.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(300)
  const buttonHeights = await confirmation.getByRole('button').evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height))
  expect(buttonHeights).toHaveLength(2)
  expect(buttonHeights.every((height) => height >= 44)).toBe(true)

  await confirmation.getByRole('button', { name: '取消' }).click()
  await expect(confirmation).toHaveCount(0)
})

test('多标签页同步存档状态且旧会话不能覆盖外部删档或新档', async ({ page, context }) => {
  const secondPage = await context.newPage()
  const secondPageErrors: string[] = []
  secondPage.on('pageerror', (error) => secondPageErrors.push(error.message))
  await secondPage.clock.install({ time: new Date('2026-08-02T12:00:00Z') })
  await secondPage.goto('/')
  await secondPage.clock.pauseAt(new Date('2026-08-02T12:00:01Z'))
  await expect(secondPage.getByRole('button', { name: '继续游戏' })).toBeDisabled()

  await createGame(page, '甲少侠')
  await expect(secondPage.getByRole('button', { name: '继续游戏' })).toBeEnabled()
  await secondPage.getByRole('button', { name: '继续游戏' }).click()
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[data-action="request-reset-save"]')?.click()
    document.querySelector<HTMLButtonElement>('[data-action="confirm-reset-save"]')?.click()
  })
  await expect(secondPage.getByTestId('title-page')).toBeVisible()
  await expect(secondPage.getByRole('status')).toHaveText('存档已在其他窗口发生变化，请重新选择继续或新建游戏')
  await expect(secondPage.getByRole('button', { name: '继续游戏' })).toBeDisabled()
  await secondPage.waitForTimeout(600)
  expect(await page.evaluate(() => window.localStorage.getItem('egg-jianghu-2-save-v10'))).toBeNull()

  await page.getByLabel('玩家姓名').fill('新少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await expect(secondPage.getByRole('button', { name: '继续游戏' })).toBeEnabled()
  await secondPage.waitForTimeout(600)
  expect(await page.evaluate(() => {
    const raw = window.localStorage.getItem('egg-jianghu-2-save-v10')
    return raw ? JSON.parse(raw).heroes.hero_player.customName : null
  })).toBe('新少侠')
  expect(secondPageErrors).toEqual([])
  await secondPage.close()
})

test('损坏的玩家姓名存档拒绝继续且不会被当前会话覆盖', async ({ page }) => {
  await createGame(page, '燕七')
  const corruptedSave = await page.evaluate(() => {
    const key = 'egg-jianghu-2-save-v10'
    const raw = JSON.parse(window.localStorage.getItem(key)!)
    raw.heroes.hero_player.customName = 42
    const serialized = JSON.stringify(raw)
    window.localStorage.setItem(key, serialized)
    return serialized
  })

  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await expect(page.getByTestId('title-page')).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('存档无法读取')
  expect(await page.evaluate(() => window.localStorage.getItem('egg-jianghu-2-save-v10'))).toBe(corruptedSave)
  await page.waitForTimeout(350)
})
