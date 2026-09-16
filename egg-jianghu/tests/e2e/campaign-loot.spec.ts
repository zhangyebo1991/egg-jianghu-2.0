import { openFactionSection } from './ink-helpers'
import { expect, test } from '@playwright/test'
import { SAVE_KEY_V10 } from '../../src/domain/save-v10'

for (const [targetId, name, quality] of [[11, '初晶矿石', 2], [12, '灵耀矿砂', 3]] as const) {
  test(`${name}击杀入库、悬榜计数和提交保存`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width: 1536, height: 960 })
    await page.goto('/')
    await page.getByRole('button', { name: '新建游戏' }).click()
    await page.getByLabel('玩家姓名').fill('掉落核验')
    await page.getByLabel('玩家姓名').press('Enter')
    // 只固定悬榜目标；材料必须通过现有击杀结算入口取得。
    await page.evaluate(({ key, targetId, quality }) => {
      const state = window.__EGG_JIANGHU__.getState()
      state.clearedStageByWorldDifficulty['world_01:1'] = 3
      state.factionBoards.tieyi_school = { refreshRemainingMs: 3_600_000, slots: [
        { id: 'loot-audit', taskId: 3, quality, targetId, generatedAt: 0, acceptedRecordId: 0 }, null, null, null, null,
      ] }
      localStorage.setItem(key, JSON.stringify(state))
    }, { key: SAVE_KEY_V10, targetId, quality })
    await page.reload()
    await page.getByRole('button', { name: '继续游戏' }).click()
    await page.getByTestId('world-world_01').click()

    await openFactionSection(page, 'quests')
    await page.getByTestId('faction-plaque-tieyi_school').click()
    const card = page.getByTestId('quest-slot-0')
    await expect(card).toContainText(name)
    await card.getByRole('button', { name: '揭榜' }).click()
    const before = await page.evaluate(targetId => {
      const api = window.__EGG_JIANGHU__
      const required = Object.values(api.getState().acceptedFactionQuests)[0].requiredAmount
      for (let seed = 1; seed <= 2000 && (api.getState().materials[String(targetId)] ?? 0) < required; seed++) api.settleEnemy(seed, 'elite')
      return { count: api.getState().materials[String(targetId)], required }
    }, targetId)
    expect(before.count).toBeGreaterThanOrEqual(before.required)
    await expect(card.locator('[data-action="quest-claim"]')).toBeVisible()
    await card.screenshot({ path: testInfo.outputPath(`material-${targetId}-ready.png`), animations: 'disabled' })
    await card.locator('[data-action="quest-claim"]').click()
    const after = await page.evaluate(({ key, targetId }) => JSON.parse(localStorage.getItem(key)!).materials[String(targetId)], { key: SAVE_KEY_V10, targetId })
    expect(after).toBe(before.count - before.required)
    expect(errors).toEqual([])
  })
}
