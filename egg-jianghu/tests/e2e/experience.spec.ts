import { expect, test } from '@playwright/test'
import { SAVE_KEY_V10 } from '../../src/domain/save-v10'

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`经验门槛显示与旧档等级保留 ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.getByRole('button', { name: '新建游戏' }).click()
    await page.getByLabel('玩家姓名').fill('经验核验')
    await page.getByLabel('玩家姓名').press('Enter')
    await page.getByTestId('tab-heroes').click()
    const levelLine = page.locator('.hb-growline').filter({ hasText: '等级' })
    await expect(levelLine).toContainText('0 / 1,000')

    await page.evaluate((key) => {
      const state = window.__EGG_JIANGHU__.getState()
      state.heroes.hero_player.level = 44
      state.heroes.hero_player.experience = 4399
      state.heroes.hero_player.careers.job_1 = { level: 4, experience: 2000 }
      localStorage.setItem(key, JSON.stringify(state))
    }, SAVE_KEY_V10)
    await page.reload()
    await page.getByRole('button', { name: '继续游戏' }).click()
    await page.getByTestId('tab-heroes').click()
    await expect(levelLine).toContainText('Lv.44')
    await expect(levelLine).toContainText('4,399 / 1,835,334')
    const careerLine = page.locator('.hb-growline').filter({ hasText: '职业' })
    await expect(careerLine).toContainText('2,000 / 2,778')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('experience-thresholds.png'), fullPage: true })
  })
}
