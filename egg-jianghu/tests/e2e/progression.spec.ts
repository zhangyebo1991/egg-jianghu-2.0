import { expect, test } from '@playwright/test'

test('秘境与神界入口关闭，直接路由和伪造结算按钮均不发放奖励', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('边界核验')
  await page.getByLabel('玩家姓名').press('Enter')
  await expect(page.getByTestId('tab-progression')).toHaveCount(0)
  await page.evaluate(() => window.__EGG_JIANGHU__.setTab('progression'))
  await expect(page.getByTestId('progression-page')).toHaveCount(0)
  await expect(page.getByTestId('world-overview')).toBeVisible()
  const result = await page.evaluate(() => {
    const api = window.__EGG_JIANGHU__
    const before = api.getState()
    const host = document.querySelector('.game-main')!
    for (const action of [
      'progression-complete-dungeon', 'progression-clear-beast', 'progression-claim-beast',
      'progression-learn-recipe', 'progression-craft-sacred', 'progression-complete-tower',
      'progression-complete-ladder', 'progression-shrine-kill', 'progression-shrine-boss',
      'progression-settle-shrine', 'progression-claim-deity', 'progression-upgrade-deity',
      'progression-advance-sacred', 'progression-forge-imperial', 'progression-roll-interworld',
    ]) {
      const button = document.createElement('button')
      Object.assign(button.dataset, { action, dungeonId: '1', difficulty: '1', beastId: '1', stage: '1', recipeId: '1', shrineId: '1', deityId: '1', enemyId: '1' })
      host.append(button)
      button.click()
      button.remove()
    }
    const nav = document.createElement('button')
    nav.dataset.tab = 'progression'
    host.append(nav)
    nav.click()
    nav.remove()
    return { before, after: api.getState() }
  })
  expect(result.after).toEqual(result.before)
  await expect(page.getByTestId('progression-page')).toHaveCount(0)
})
