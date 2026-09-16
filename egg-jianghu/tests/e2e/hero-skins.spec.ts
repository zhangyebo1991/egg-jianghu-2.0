import { openPanel } from './ink-helpers'
import { createHeroProgress } from '../../src/domain/state'
import { expect, test } from '@playwright/test'
import { SAVE_KEY_V10 } from '../../src/domain/save-v10'
import { HEROES_V10 } from '../../src/content/heroes'

const originalHero = HEROES_V10.find(hero => hero.sourceId === 2)!
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('幻型少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await page.evaluate(({ key, originalHero, progress }) => {
    window.__EGG_JIANGHU__.recruitHero('hero_guo_jing')
    const state = window.__EGG_JIANGHU__.getState()
    state.materials['10'] = 100
    state.heroes[originalHero.id] = { ...progress, recruited: true }
    window.localStorage.setItem(key, JSON.stringify(state))
  }, { key: SAVE_KEY_V10, originalHero, progress: createHeroProgress(originalHero.baseCareerId) })
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await openPanel(page, 'heroes')
})

test('装备页按角色显示原版立绘，自创侠客使用自己的图', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator('[data-action="hero-main-tab"][data-main-tab="equipment"]').first().click()
  await expect(page.getByTestId('hero-appearance')).toHaveAttribute('src', /hero_1\.webp/)
  await page.locator(`[data-action="select-hero"][data-hero-id="${originalHero.id}"]`).click()
  await expect(page.getByTestId('hero-appearance')).toHaveAttribute('src', /hero_2\.webp/)
  expect(await page.getByTestId('hero-appearance').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await page.getByTestId('hero-equipment-slots').screenshot({ path: testInfo.outputPath('original-hero-equipment.png') })
  await page.locator('[data-action="select-hero"][data-hero-id="hero_guo_jing"]').click()
  await expect(page.getByTestId('hero-appearance')).toHaveAttribute('src', /hero_guo_jing/)
})

test('免费皮肤切换、升星扣材料、刷新保留及窄屏展示', async ({ page }, testInfo) => {
  await page.locator('[data-action="hero-main-tab"][data-main-tab="skins"]').first().click()
  const card = page.getByTestId('skin-212')
  await card.getByRole('button', { name: '使用外观' }).click()
  await card.getByRole('button', { name: '升星 · 4 幻化石' }).click()
  await expect(card).toContainText('2 / 10 星')
  await expect(page.getByTestId('skin-213')).toContainText('2 / 10 星')
  await expect(page.getByTestId('skin-stones')).toHaveText('96')
  await expect(page.getByTestId('skin-214').getByRole('button', { name: '使用外观' })).toBeDisabled()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(card.getByRole('button', { name: '使用中' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByTestId('hero-skins').screenshot({ path: testInfo.outputPath(`skins-${width}.png`) })
  }
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await openPanel(page, 'heroes')
  await page.locator('[data-action="hero-main-tab"][data-main-tab="equipment"]').first().click()
  await expect(page.getByTestId('hero-appearance')).toHaveAttribute('src', /skin_212\.webp/)
  await expect(page.getByTestId('hero-appearance')).toBeVisible()
  await page.getByTestId('hero-equipment-slots').screenshot({ path: testInfo.outputPath('skin-equipment-390.png') })
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.skinStars?.['2'])).toBe(2)
})

test('战斗期间不能通过按钮切换和升星', async ({ page }) => {
  await page.evaluate(() => window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 13))
  await openPanel(page, 'heroes')
  await page.locator('[data-action="hero-main-tab"][data-main-tab="skins"]').first().click()
  const card = page.getByTestId('skin-212')
  await expect(card.getByRole('button', { name: '使用外观' })).toBeDisabled()
  const upgrade = card.getByRole('button', { name: '升星 · 4 幻化石' })
  await expect(upgrade).toBeDisabled()
  await upgrade.evaluate(button => { (button as HTMLButtonElement).disabled = false })
  await upgrade.click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().materials['10'])).toBe(100)
})

test('不同宽高比立绘的可见角色高度一致，并保持原图比例', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.locator('[data-action="hero-main-tab"][data-main-tab="skins"]').first().click()
  await page.getByTestId('skin-213').getByRole('button', { name: '使用外观' }).click()
  await page.locator('[data-action="hero-main-tab"][data-main-tab="equipment"]').first().click()
  const visibleBounds = async () => page.getByTestId('hero-appearance').evaluate(async (image: HTMLImageElement) => {
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let top = canvas.height, bottom = -1
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 16) { top = Math.min(top, y); bottom = Math.max(bottom, y) }
    }
    const rect = image.getBoundingClientRect()
    return { top: rect.top + top / canvas.height * rect.height, bottom: rect.top + (bottom + 1) / canvas.height * rect.height, scaleX: rect.width / canvas.width, scaleY: rect.height / canvas.height }
  })
  const first = await visibleBounds()
  await page.getByTestId('hero-equipment-slots').screenshot({ path: testInfo.outputPath('height-skin-213.png') })
  await page.locator(`[data-action="select-hero"][data-hero-id="${originalHero.id}"]`).click()
  const second = await visibleBounds()
  expect(Math.abs(first.top - second.top)).toBeLessThan(1)
  expect(Math.abs(first.bottom - second.bottom)).toBeLessThan(1)
  for (const bounds of [first, second]) expect(Math.abs(bounds.scaleX - bounds.scaleY)).toBeLessThan(0.01)
  await page.getByTestId('hero-equipment-slots').screenshot({ path: testInfo.outputPath('height-hero-2.png') })
})
