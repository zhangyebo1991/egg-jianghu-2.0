import { expect, test } from '@playwright/test'
import { martialByIdV10 } from '../../src/content/martials'
import { SAVE_KEY_V10 } from '../../src/domain/save-v10'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('配招少侠')
  await page.getByLabel('玩家姓名').press('Enter')
})

test('武学装配替换卸下、筛选记忆、保存和战斗快照', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1920, height: 911 })
  await page.evaluate((skills) => {
    for (const skill of skills) window.__EGG_JIANGHU__.seedLearnedMartial('hero_player', skill.id, skill.level)
  }, Array.from({ length: 12 }, (_, index) => {
    const id = `original_skill_${42 + index}`
    return { id, level: Math.min(10, martialByIdV10(id)!.maxLevel) }
  }))
  await page.getByTestId('tab-heroes').click()
  await page.locator('[data-action="hero-main-tab"][data-main-tab="martials"]').click()
  await expect(page.locator('.hm-slot')).toHaveCount(4)
  await expect(page.locator('.hm-card')).toHaveCount(12)
  await expect(page.getByTestId('martial-library')).not.toContainText('[color=')
  await page.getByTestId('martial-slot-0').getByRole('button', { name: '装配', exact: true }).click()
  await page.getByTestId('learned-original_skill_42').getByRole('button').click()
  await expect(page.getByTestId('martial-slot-0')).toContainText('野球拳')
  await page.getByTestId('martial-slot-0').getByRole('button', { name: '替换' }).click()
  await page.getByTestId('learned-original_skill_43').getByRole('button').click()
  await expect(page.getByTestId('martial-slot-0')).toContainText('临战激励')
  await expect(page.getByTestId('learned-original_skill_42')).toBeVisible()
  await page.getByTestId('martial-slot-0').getByRole('button', { name: '卸下' }).click()
  await expect(page.getByTestId('martial-slot-0')).toContainText('空槽位')
  await page.getByTestId('martial-slot-2').getByRole('button', { name: '装配', exact: true }).click()
  await page.getByTestId('learned-original_skill_42').getByRole('button').click()
  await page.getByLabel('搜索已学武学').fill('野球')
  await expect(page.locator('.hm-card')).toHaveCount(1)
  await page.getByTestId('tab-inventory').click()
  await page.getByTestId('tab-heroes').click()
  await expect(page.getByLabel('搜索已学武学')).toHaveValue('野球')
  await page.getByLabel('搜索已学武学').fill('')
  await page.getByLabel('武学类型').selectOption('通用')
  expect(await page.locator('.hm-card').count()).toBeLessThan(12)
  await page.getByLabel('武学类型').selectOption('all')
  await page.getByLabel('搜索已学武学').fill('免伤')
  await expect(page.getByTestId('learned-original_skill_47')).toBeVisible()
  await page.getByLabel('搜索已学武学').fill('')
  await page.screenshot({ path: testInfo.outputPath('martials-desktop.png'), animations: 'disabled' })
  await page.locator('.hero-martials').evaluate((el) => { el.scrollTop = 180 })
  const scroll = await page.locator('.hero-martials').evaluate((el) => el.scrollTop)
  expect(scroll).toBeGreaterThan(0)
  await page.getByTestId('tab-inventory').click()
  await page.getByTestId('tab-heroes').click()
  await expect.poll(() => page.locator('.hero-martials').evaluate((el) => el.scrollTop)).toBe(scroll)
  for (const width of [1440, 640, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.screenshot({ path: testInfo.outputPath(`martials-${width}.png`), fullPage: true, animations: 'disabled' })
  }
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.equippedMartialIds)).toEqual([null, null, 'original_skill_42', null])
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.placeHero('hero_player', 0, 0)
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 13)
  })
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getCombat().party[0].skillIds)).toEqual([42])
  await page.getByTestId('tab-heroes').click()
  await page.locator('[data-action="hero-main-tab"][data-main-tab="martials"]').click()
  await expect(page.getByTestId('martial-slot-2').getByRole('button', { name: '卸下' })).toBeDisabled()
  await expect(page.getByTestId('idle-combat-return')).toBeVisible()
  expect(errors).toEqual([])
})

test('世界与势力往返保留位置，已学武学可直达装配', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate((key) => {
    const state = window.__EGG_JIANGHU__.getState()
    state.heroes.hero_player.skillPoints = 1000
    state.worldCurrency.world_01 = 10000
    window.localStorage.setItem(key, JSON.stringify(state))
  }, SAVE_KEY_V10)
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await page.getByTestId('world-world_01').click()
  await page.getByTestId('start-crossing').click()
  await page.getByTestId('world-section-factions').click()
  await page.locator('.game-main').evaluate((el) => { el.scrollTop = 100 })
  await page.locator('[data-action="select-martial"][data-martial-id="original_skill_42"]').click()
  await page.locator('[data-action="martial-learn"]').click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.learnedMartials.original_skill_42.level)).toBe(1)
  await page.getByRole('button', { name: '前往装配', exact: true }).click()
  await expect(page.getByTestId('hero-martials')).toBeVisible()
  await expect(page.getByTestId('learned-original_skill_42')).toHaveClass(/highlighted/)
  await expect(page.getByTestId('hero-world-return')).toContainText('势力')
  await page.screenshot({ path: testInfo.outputPath('martials-return-to-world.png'), animations: 'disabled' })
  await page.getByTestId('learned-original_skill_42').getByRole('button').click()
  await page.getByTestId('hero-world-return').click()
  await expect(page.getByTestId('factions-page')).toBeVisible()
  await expect(page.getByTestId('faction-martial-detail')).toContainText('野球拳')
  await page.getByTestId('tab-heroes').click()
  await page.getByTestId('tab-idle').click()
  await expect(page.getByTestId('factions-page')).toBeVisible()
  await expect(page.getByTestId('world-overview')).toHaveCount(0)
  await page.locator('.world-subnav [data-action="return-worlds"]').click()
  await expect(page.getByTestId('world-overview')).toBeVisible()
})

test('行囊末页与侠客选择在离页后保留', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 })
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.fillInventory(300)
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
  })
  await page.getByTestId('tab-heroes').click()
  await page.getByTestId('hero-hero_mu_nianci').click()
  await page.locator('[data-action="hero-main-tab"][data-main-tab="martials"]').click()
  for (let index = 0; index < 30; index++) {
    const next = page.locator('.pack-page .pg-btn').last()
    if (await next.isDisabled()) break
    await next.click()
  }
  const status = await page.locator('.pack-page-status').innerText()
  const firstUid = await page.locator('.pack-cell').first().getAttribute('data-equipment-uid')
  await page.getByTestId('tab-inventory').click()
  await page.getByTestId('tab-heroes').click()
  await expect(page.locator('.pack-page-status')).toHaveText(status)
  await expect(page.locator('.pack-cell').first()).toHaveAttribute('data-equipment-uid', firstUid!)
  await expect(page.locator('[data-action="hero-main-tab"][data-main-tab="martials"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('hero-hero_mu_nianci')).toHaveClass(/active/)
})
