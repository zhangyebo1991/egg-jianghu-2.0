import { expect, test } from '@playwright/test'

test('冷却显示随倍率即时换算，实际冷却按倍率扣减且切换不重置', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-10T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-09-10T00:00:01Z'))
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('冷却少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 17)
    window.__EGG_JIANGHU__.advanceCombat(15)
  })
  // 让主循环绑定本场战斗的时钟，再设定可跨越全部倍率的冷却。
  await page.clock.runFor(100)
  await page.evaluate(() => window.__EGG_JIANGHU__.setHeroCooldown('hero_player', '1', 36000))
  const remaining = () => page.evaluate(() => window.__EGG_JIANGHU__.getCombat().party.find((unit: { id: string }) => unit.id === 'hero_player').cooldowns[1] as number)
  const display = page.getByTestId('combat-unit-hero_player').locator('.cool-num')
  for (const speed of [1, 1.8, 2.6, 3.6, 1]) {
    const before = await remaining()
    await page.locator(`[data-action="speed-${speed}"]`).click()
    expect(await remaining()).toBe(before)
    await expect(display).toHaveText(`${(before / speed / 1000).toFixed(1)}s`)
    await page.clock.runFor(100)
    const after = await remaining()
    expect(before - after).toBeCloseTo(100 * speed, 5)
    await expect(display).toHaveText(`${(after / speed / 1000).toFixed(1)}s`)
  }
})
