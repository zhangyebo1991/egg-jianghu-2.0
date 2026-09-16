import { openPanel } from './ink-helpers'
import { expect, test } from '@playwright/test'
import { PRE_V20_SAVE_BACKUP_KEY, SAVE_KEY_V10 } from '../../src/domain/save-v10'

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`v20 经验门槛显示与等级保留 ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.getByRole('button', { name: '新建游戏' }).click()
    await page.getByLabel('玩家姓名').fill('经验核验')
    await page.getByLabel('玩家姓名').press('Enter')
    await openPanel(page, 'heroes')
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
    await openPanel(page, 'heroes')
    await expect(levelLine).toContainText('Lv.44')
    await expect(levelLine).toContainText('4,399 / 1,835,334')
    const careerLine = page.locator('.hb-growline').filter({ hasText: '职业' })
    await expect(careerLine).toContainText('2,000 / 2,778')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('experience-thresholds.png'), fullPage: true })
  })

  test(`v19 迁移与备份，刷新后不重复降级 ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.getByRole('button', { name: '新建游戏' }).click()
    await page.getByLabel('玩家姓名').fill('迁移核验')
    await page.getByLabel('玩家姓名').press('Enter')
    const original = await page.evaluate((key) => {
      const state = { ...window.__EGG_JIANGHU__.getState(), version: 19 }
      state.heroes.hero_player.level = 99
      state.heroes.hero_player.experience = 25522
      state.heroes.hero_player.careers.job_1 = { level: 4, experience: 486857 }
      state.heroes.hero_player.skillPoints = 567358
      const json = JSON.stringify(state)
      localStorage.setItem(key, json)
      return json
    }, SAVE_KEY_V10)
    await page.reload()
    await page.getByRole('button', { name: '继续游戏' }).click()
    await openPanel(page, 'heroes')
    await expect(page.locator('.hb-growline').filter({ hasText: '等级' })).toContainText('Lv.19')
    await expect(page.locator('.hb-growline').filter({ hasText: '等级' })).toContainText('61,645')
    await expect(page.locator('.hb-growline').filter({ hasText: '职业' })).toContainText('Lv.10')
    expect(await page.evaluate(key => localStorage.getItem(key), PRE_V20_SAVE_BACKUP_KEY)).toBe(original)
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).version, SAVE_KEY_V10)).toBe(20)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('migration-v20.png'), fullPage: true })
    await page.reload()
    await page.getByRole('button', { name: '继续游戏' }).click()
    expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.level)).toBe(19)
    expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.skillPoints)).toBe(567358)
    expect(await page.evaluate(key => localStorage.getItem(key), PRE_V20_SAVE_BACKUP_KEY)).toBe(original)
  })
}
