import { openPanel } from './ink-helpers'
import { expect, test } from '@playwright/test'
import { equipmentDefinitionById } from '../../src/content/equipment'
import { SAVE_KEY_V10 } from '../../src/domain/save-v10'

test('行囊页悬停对比身上装备，宽窄屏均可读，并可一键穿戴', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('对比少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  const makeItem = (uid: string, level: number) => ({
    uid, definitionId: 'wp_101', level, equipmentLevel: 1, quality: 2, locked: false,
    coreStats: equipmentDefinitionById('wp_101')!.coreStats.map((core) => ({ attributeId: core.attributeId, coefficient: core.baseCoefficient })),
    affixes: [],
  })
  await page.evaluate(({ key, items }) => {
    const state = window.__EGG_JIANGHU__.getState()
    state.heroes.hero_player.level = 50
    state.inventory = items as typeof state.inventory
    // 装备归属由活动套装 equipmentSets 决定，equipmentBySlot 只是镜像
    state.heroes.hero_player.equipmentSets[0].weapon = 'equipped'
    state.heroes.hero_player.equipmentBySlot = state.heroes.hero_player.equipmentSets[0]
    window.localStorage.setItem(key, JSON.stringify(state))
  }, { key: SAVE_KEY_V10, items: [makeItem('equipped', 10), makeItem('candidate', 20)] })
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await openPanel(page, 'inventory')

  const anchor = page.getByTestId('equipment-candidate')
  const tooltip = page.locator('.equipment-tooltip.has-compare')
  await anchor.hover()
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('行囊物品')
  await expect(tooltip).toContainText('身上装备')
  // 行囊物品等级更高，核心词条应标出上升箭头
  await expect(tooltip).toContainText(/▲/)
  await expect(tooltip).not.toContainText(/恢复 \d+\.\d{6}/)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await anchor.hover()
    await expect(tooltip).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(await tooltip.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`pack-compare-${width}.png`) })
  }

  // 行囊页一键穿戴：物理方向换上更强的 candidate
  await page.locator('[data-action="equipment-auto-equip"][data-hero-id="hero_player"]').click()
  const loadout = await page.evaluate(() => {
    const hero = window.__EGG_JIANGHU__.getState().heroes.hero_player
    return hero.equipmentSets[hero.activeEquipmentSetIndex ?? 0].weapon
  })
  expect(loadout).toBe('candidate')
})
