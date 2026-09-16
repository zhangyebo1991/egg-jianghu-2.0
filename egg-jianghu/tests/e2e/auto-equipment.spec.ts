import { openPanel } from './ink-helpers'
import { expect, test } from '@playwright/test'
import { equipmentDefinitionById } from '../../src/content/equipment'
import { SAVE_KEY_V10 } from '../../src/domain/save-v10'

test('一键穿戴按所选方向换装并保存，桌面和手机按钮正常显示', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('换装少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  const inventory = ['wp_101', 'wp_103', 'wp_106'].map((definitionId) => ({
    uid: definitionId, definitionId, level: 10, equipmentLevel: 1, quality: 0, locked: false,
    coreStats: equipmentDefinitionById(definitionId)!.coreStats.map((core) => ({ attributeId: core.attributeId, coefficient: core.baseCoefficient })),
    affixes: [],
  }))
  await page.evaluate(({ key, inventory }) => {
    const state = window.__EGG_JIANGHU__.getState()
    state.inventory = inventory as typeof state.inventory
    window.localStorage.setItem(key, JSON.stringify(state))
  }, { key: SAVE_KEY_V10, inventory })
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await openPanel(page, 'heroes')
  await page.locator('[data-action="hero-main-tab"][data-main-tab="equipment"]').click()
  const equip = page.getByRole('button', { name: '一键穿戴', exact: true })
  const direction = page.getByRole('button', { name: '切换一键穿戴方向' })
  await expect(direction).toHaveText('物理 ↔')
  await equip.click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.equipmentBySlot.weapon)).toBe('wp_101')
  await direction.click()
  await expect(direction).toHaveText('法术 ↔')
  await equip.click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.equipmentBySlot)).toMatchObject({ weapon: 'wp_103', offhand: 'wp_106' })
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await equip.scrollIntoViewIfNeeded()
    await expect(equip).toBeInViewport()
    await expect(direction).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`auto-equipment-${width}.png`) })
  }
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.equipmentBySlot.weapon)).toBe('wp_103')
})
