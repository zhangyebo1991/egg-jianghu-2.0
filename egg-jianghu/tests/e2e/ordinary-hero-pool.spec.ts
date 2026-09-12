import { expect, test, type Page } from '@playwright/test'
import { SAVE_KEY_V10 } from '../../src/domain/save-v10'
import { createHeroProgress } from '../../src/domain/state'
import type { GameStateV10 } from '../../src/domain/types'

const loadTestSave = async (page: Page, state: GameStateV10, tag: string) => {
  await page.goto('about:blank')
  await page.addInitScript(({ state, key, tag }) => {
    if (location.protocol !== 'http:') return
    if (!sessionStorage.getItem(tag)) {
      localStorage.setItem(key, JSON.stringify(state))
      sessionStorage.setItem(tag, '1')
    }
  }, { state, key: SAVE_KEY_V10, tag })
  await page.goto('/')
  await page.getByRole('button', { name: '继续游戏' }).click()
}
const start = async (page: Page) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('普通池核验')
  await page.getByLabel('玩家姓名').press('Enter')
}
const setRandom = async (page: Page, value: number) => page.evaluate(value => { Math.random = () => value }, value)
const candidates = (page: Page) => page.locator('[data-testid^="ordinary-pool-hero-"]')

test('商城统一池、逐人概率与属性、无重复抽空、世界解锁补入和存档恢复', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await start(page)
  await page.getByTestId('tab-shop').click()
  await expect(page.getByTestId('ordinary-hero-pool')).toBeVisible()
  const rules = page.locator('[data-action="ordinary-pool-rules"]')
  await expect(rules).toHaveAttribute('aria-expanded', 'false')
  await rules.click()
  await expect(page.locator('#ordinary-pool-rule-content')).toBeVisible()
  await page.getByTestId('ordinary-pool-hero-hero_orig_9').click()
  await expect(rules).toHaveAttribute('aria-expanded', 'true')
  await rules.click()
  await expect(page.locator('#ordinary-pool-rule-content')).toBeHidden()
  await expect(candidates(page)).toHaveCount(3)
  await expect(candidates(page)).toHaveText([/王异.*本次 0.4%.*基础 0.4%/s, /关羽.*本次 0.4%.*基础 0.4%/s, /孙尚香.*本次 0.4%.*基础 0.4%/s])
  await expect(page.locator('[data-action="ordinary-pool-draw"]')).toHaveCount(2)
  await expect(page.locator('[data-action="ordinary-pool-draw"][data-count="1"]')).toBeDisabled()
  const state = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  state.idleVouchers.balance = 2000
  await loadTestSave(page, state, 'ordinary-funded')
  await page.getByTestId('tab-shop').click()
  await page.getByTestId('ordinary-pool-hero-hero_orig_9').click()
  const preview = page.getByTestId('ordinary-pool-preview')
  await expect(preview).toContainText('关羽')
  await expect(preview).toContainText('战斗属性')
  await expect(preview).toContainText('计略')
  await expect(preview.locator('dl > div')).toHaveCount(21)
  expect(await preview.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('ordinary-pool-desktop.png') })
  const single = page.locator('[data-action="ordinary-pool-draw"][data-count="1"]')
  const ten = page.locator('[data-action="ordinary-pool-draw"][data-count="10"]')
  await setRandom(page, 0.5)
  await single.click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().ordinaryPoolMisses)).toBe(1)
  await expect(page.locator('.ordinary-pool-results')).toContainText('× 2')
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await page.getByTestId('tab-shop').click()
  await expect(page.getByTestId('ordinary-hero-pool')).toContainText('再抽 69 次')
  await setRandom(page, 0)
  await single.click()
  await expect(candidates(page)).toHaveCount(2)
  await expect(candidates(page).first()).toContainText('本次 0.6%')
  await expect(page.locator('.ordinary-pool-results')).toContainText('王异 × 1')
  await ten.click()
  await expect(page.getByTestId('ordinary-pool-empty')).toContainText('暂无可抽取角色')
  await expect(single).toBeDisabled()
  await expect(ten).toBeDisabled()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().idleVouchers.balance)).toBe(1600)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('ordinary-pool-empty.png') })
  const unlocked = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  unlocked.unlockedWorldIds.push('world_02')
  await loadTestSave(page, unlocked, 'ordinary-second-world')
  await page.getByTestId('tab-shop').click()
  await expect(candidates(page)).toHaveCount(3)
  await expect(candidates(page)).toHaveText([/扫地僧/s, /令狐少侠/s, /张三丰/s])
  await page.setViewportSize({ width: 390, height: 960 })
  const actionBox = await single.boundingBox()
  const previewBox = await preview.boundingBox()
  expect(actionBox!.y + actionBox!.height).toBeLessThan(previewBox!.y)
  await page.getByTestId('ordinary-pool-hero-hero_orig_21').click()
  await expect(preview).toContainText('张三丰')
  await preview.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('ordinary-pool-mobile.png') })
  const all = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  all.unlockedWorldIds = Array.from({ length: 13 }, (_, i) => `world_${String(i + 1).padStart(2, '0')}`)
  await loadTestSave(page, all, 'ordinary-all-worlds')
  await page.setViewportSize({ width: 320, height: 960 })
  await page.getByTestId('tab-shop').click()
  await expect(candidates(page)).toHaveCount(26)
  await candidates(page).last().click()
  await expect(preview).toContainText('紫霞')
  for (const img of await candidates(page).locator('img').all()) {
    expect((await img.boundingBox())!.width).toBeGreaterThanOrEqual(40)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('ordinary-pool-all-worlds-320.png') })
  expect(errors).toEqual([])
})

test('旧拥有角色排除、保底概率透明，势力入口指向商城且不能旧兑换', async ({ page }, testInfo) => {
  await start(page)
  const state = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  state.idleVouchers.balance = 2000
  state.ordinaryPoolMisses = 69
  state.heroes.hero_orig_11 = createHeroProgress('job_1')
  state.heroes.hero_orig_11.level = 23
  await loadTestSave(page, state, 'ordinary-old-owned')
  await page.getByTestId('tab-shop').click()
  await expect(candidates(page)).toHaveCount(2)
  for (const candidate of await candidates(page).all()) {
    await expect(candidate).toContainText('本次 50%')
    await expect(candidate).toContainText('基础 0.6%')
  }
  await setRandom(page, 0.999)
  await page.locator('[data-action="ordinary-pool-draw"][data-count="1"]').click()
  await expect(page.locator('.ordinary-pool-results')).toContainText('孙尚香 × 1')
  await expect(candidates(page)).toHaveCount(1)
  await expect(candidates(page)).toContainText('本次 1.2%')
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_orig_11.level)).toBe(23)
  await page.evaluate(() => {
    const api = window.__EGG_JIANGHU__
    api.unlockFaction('renxin_hall')
    api.grantContribution('renxin_hall', 1_000_000)
    api.grantWorldReputation('world_01', 10_000)
    api.setJianghuSection('factions')
  })
  await page.getByTestId('faction-plaque-renxin_hall').click()
  const guanYu = page.getByTestId('faction-recruitment-hero-9')
  await expect(guanYu).not.toContainText('聘资')
  await expect(guanYu.getByRole('button', { name: '前往普通池' })).toBeEnabled()
  // 同门并列的第二人诸葛亮继续原兑换，华佗也保留。
  await expect(page.getByTestId('faction-recruitment-hero-12').getByRole('button', { name: '邀请入队' })).toBeEnabled()
  await expect(page.getByTestId('faction-recruitment-hero-8').getByRole('button', { name: '邀请入队' })).toBeEnabled()
  await guanYu.scrollIntoViewIfNeeded()
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('ordinary-pool-faction-entry.png') })
  await guanYu.getByRole('button', { name: '前往普通池' }).click()
  await expect(page.getByTestId('ordinary-hero-pool')).toBeVisible()
})
