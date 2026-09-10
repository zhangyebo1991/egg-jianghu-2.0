import { expect, test } from '@playwright/test'

test('伤口包扎实际施放与治疗结果写入札记', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('包扎少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  const found = await page.evaluate(() => {
    const api = window.__EGG_JIANGHU__
    api.seedLearnedMartial('hero_player', 'original_skill_44', 1, 0)
    api.startStage('world_01', 1, 'guard', 17)
    for (let i = 0; i < 1000; i++) {
      const events = api.advanceCombat(1)
      const heal = events.find(event => event.type === 'healing' && event.skillId === 44)
      if (heal?.type === 'healing') return heal.amount
    }
    return null
  })
  expect(found).not.toBeNull()
  const log = page.getByTestId('combat-log')
  await expect(log).toContainText('使出「伤口包扎」')
  await expect(log).toContainText(/使用「伤口包扎」，为.+恢复 [\d,]+ 点气血/)
})

test('战斗札记显示技能目标和伤害，窄屏可读', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('札记少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 1, 1)
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 17)
    window.__EGG_JIANGHU__.advanceCombat(200)
  })
  const log = page.getByTestId('combat-log')
  await expect(log).toContainText(/使用「.+」，对.+造成 [\d,]+ 点伤害/)
  await expect(log).not.toContainText(/恢复 \d+\.\d{6}/)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await log.scrollIntoViewIfNeeded()
    expect(await log.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    await log.screenshot({ path: testInfo.outputPath(`combat-log-${width}.png`) })
  }
  expect(errors).toEqual([])
})
