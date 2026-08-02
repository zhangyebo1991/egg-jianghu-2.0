import { expect, test } from '@playwright/test'

let pageErrors: string[]

test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.evaluate(() => window.__EGG_JIANGHU__.reset())
})

test.afterEach(() => {
  expect(pageErrors).toEqual([])
})

test('江湖按大关小关分层并在点击小关后立即驻守', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_shen_yanqiu')
    window.__EGG_JIANGHU__.placeHero('hero_shen_yanqiu', 'front', 0)
  })
  await expect(page.getByTestId('world-overview')).toBeVisible()
  await expect(page.getByTestId('stage-1')).toHaveCount(0)

  await page.getByTestId('world-world_01').click()
  await expect(page.getByTestId('stage-overview')).toBeVisible()
  await expect(page.locator('button[data-testid^="stage-"]')).toHaveCount(10)

  await page.getByTestId('stage-1').click()
  await expect(page.getByTestId('idle-page')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getSelection())).toEqual({
    worldId: 'world_01',
    stage: 1,
    mode: 'guard',
  })
})

test('连续 tick 保持页签按钮节点并支持慢速点击', async ({ page }) => {
  const stableAcrossTicks = await page.getByTestId('tab-heroes').evaluate(async (button) => {
    await new Promise((resolve) => setTimeout(resolve, 350))
    return button === document.querySelector('[data-testid="tab-heroes"]')
  })
  expect(stableAcrossTicks).toBe(true)

  const button = page.getByTestId('tab-heroes')
  const box = await button.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(250)
  await page.mouse.up()
  await expect(page.locator('[data-page="heroes"]')).toBeVisible()
})

test('战斗刷新保持页签和战斗控制按钮节点', async ({ page }) => {
  await page.getByTestId('start-guard').click()

  const stableAcrossCombatTicks = await page.evaluate(async () => {
    const tab = document.querySelector('[data-testid="tab-idle"]')
    const stop = document.querySelector('[data-testid="stop-combat"]')
    await new Promise((resolve) => setTimeout(resolve, 350))
    return {
      tab: tab === document.querySelector('[data-testid="tab-idle"]'),
      stop: stop === document.querySelector('[data-testid="stop-combat"]'),
    }
  })

  expect(stableAcrossCombatTicks).toEqual({ tab: true, stop: true })
})

test('从酒馆明确名单直接邀请并放入前后三格阵容', async ({ page }) => {
  await page.getByTestId('tab-city').click()
  await page.getByTestId('tavern-hero_shen_yanqiu').getByRole('button', { name: '直接邀请' }).click()
  await page.getByTestId('tavern-hero_huo_chuan').getByRole('button', { name: '直接邀请' }).click()

  await page.getByTestId('tab-heroes').click()
  await page.locator('[data-action="formation-place"][data-target-row="back"][data-position="0"]').click()
  await page.getByTestId('hero-hero_shen_yanqiu').click()
  await page.locator('[data-action="formation-place"][data-target-row="front"][data-position="0"]').click()

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual(expect.arrayContaining([
    { heroId: 'hero_shen_yanqiu', row: 'front', position: 0 },
    { heroId: 'hero_huo_chuan', row: 'back', position: 0 },
  ]))
})

test('职业 Lv.10 转职且侠客等级保持不变', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_shen_yanqiu')
    window.__EGG_JIANGHU__.setHeroCareerLevel('hero_shen_yanqiu', 'sword', 10)
  })
  const heroLevel = await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_shen_yanqiu.level)

  await page.getByTestId('tab-city').click()
  await page.locator('[data-action="career-buy-token"][data-token-id="token_sword_swift_mid"]').click()
  await page.getByTestId('tab-heroes').click()
  await page.locator('[data-action="career-change"][data-career-id="sword_swift_mid"]').click()

  const hero = await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_shen_yanqiu)
  expect(hero.level).toBe(heroLevel)
  expect(hero.currentCareerId).toBe('sword_swift_mid')
  expect(hero.careers.sword.level).toBe(10)
  expect(hero.careers.sword_swift_mid.level).toBe(1)
})

test('四槽按优先级跳过不满足条件的武功', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_shen_yanqiu')
    window.__EGG_JIANGHU__.placeHero('hero_shen_yanqiu', 'front', 0)
    window.__EGG_JIANGHU__.seedLearnedMartial('hero_shen_yanqiu', 'qingfeng_hall_d1', 1, 0)
    window.__EGG_JIANGHU__.seedLearnedMartial('hero_shen_yanqiu', 'qingfeng_hall_a1', 1, 1)
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 73)
    window.__EGG_JIANGHU__.setHeroCooldown('hero_shen_yanqiu', 'qingfeng_hall_d1', 10_000)
  })
  const events = await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(100))
  expect(events).toContainEqual(expect.objectContaining({ type: 'skill-skipped', skillId: 'qingfeng_hall_d1', reason: '武功尚在回气' }))
  expect(events).toContainEqual(expect.objectContaining({ type: 'skill-used', skillId: 'qingfeng_hall_a1' }))
})

test('每个小关第十波显示 Boss 精英和小怪', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_shen_yanqiu')
    window.__EGG_JIANGHU__.placeHero('hero_shen_yanqiu', 'front', 0)
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 19)
    window.__EGG_JIANGHU__.showWave(10, 19)
  })
  await expect(page.getByRole('heading', { name: '第 10 / 10 波' })).toBeVisible()
  await expect(page.getByTestId('enemy-board').locator('[data-rank="boss"]')).toHaveCount(1)
  await expect(page.getByTestId('enemy-board').locator('[data-rank="elite"]')).toHaveCount(1)
  await expect(page.getByTestId('enemy-board').locator('[data-rank="normal"]')).toHaveCount(1)
})

test('闯荡失败回退上一小关并切换驻守', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_shen_yanqiu')
    window.__EGG_JIANGHU__.placeHero('hero_shen_yanqiu', 'front', 0)
    window.__EGG_JIANGHU__.startStage('world_01', 4, 'roam', 31)
    window.__EGG_JIANGHU__.forceCombatResult('defeat')
  })
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getSelection())).toEqual({ worldId: 'world_01', stage: 3, mode: 'guard' })
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getCombat()?.wave)).toBe(1)
})

test('敌人死亡时装备立即进入背包', async ({ page }) => {
  const added = await page.evaluate(() => window.__EGG_JIANGHU__.settleEnemy(101, 'boss'))
  expect(added.length).toBeGreaterThanOrEqual(2)
  await page.getByTestId('tab-inventory').click()
  await expect(page.locator('[data-testid^="equipment-"]')).toHaveCount(added.length)
})

test('第 301 件装备被拒绝且战斗继续', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_shen_yanqiu')
    window.__EGG_JIANGHU__.placeHero('hero_shen_yanqiu', 'front', 0)
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 103)
    window.__EGG_JIANGHU__.fillInventory(300)
  })
  const added = await page.evaluate(() => window.__EGG_JIANGHU__.settleEnemy(103, 'boss'))
  const state = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  expect(added).toEqual([])
  expect(state.inventory).toHaveLength(300)
  expect(state.statistics.equipmentMissedAtCapacity).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getCombat()?.result)).toBe('fighting')
})

test('势力六格悬榜锁定已接任务并刷新未接任务', async ({ page }) => {
  await page.evaluate(() => window.__EGG_JIANGHU__.prepareQuestBoard('qingfeng_hall', 211))
  await page.getByTestId('tab-factions').click()
  await expect(page.locator('[data-quest-slot]')).toHaveCount(6)
  const before = await page.evaluate(() => window.__EGG_JIANGHU__.getState().factionBoards.qingfeng_hall.slots.map((slot) => slot?.id ?? null))
  await page.getByTestId('quest-slot-0').getByRole('button', { name: '接受' }).click()
  await page.evaluate(() => window.__EGG_JIANGHU__.advanceRuntime(3_600_000))
  const after = await page.evaluate(() => window.__EGG_JIANGHU__.getState().factionBoards.qingfeng_hall.slots.map((slot) => slot?.id ?? null))
  expect(after[0]).toBe(before[0])
  expect(after.slice(1)).not.toEqual(before.slice(1))
})

test('重载页面后长期收益保留但必须重新选择关卡', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_shen_yanqiu')
    window.__EGG_JIANGHU__.placeHero('hero_shen_yanqiu', 'front', 0)
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 307)
    window.__EGG_JIANGHU__.settleEnemy(307, 'boss')
  })
  const before = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  await page.reload()
  const after = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  expect(after.worldCurrency).toEqual(before.worldCurrency)
  expect(after.inventory).toEqual(before.inventory)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getCombat())).toBeNull()
  await expect(page.getByRole('heading', { name: '整备阵容，择关而行' })).toBeVisible()
})

test('页面不出现离线收益抽卡残页铁匠铺和首次奖励', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const tab of ['idle', 'heroes', 'factions', 'city', 'inventory'] as const) {
    await page.getByTestId(`tab-${tab}`).click()
    await expect(page.getByTestId(`tab-${tab}`)).toHaveAttribute('aria-current', 'page')
  }
  await page.getByTestId('tab-idle').click()
  await expect(page.getByTestId('stop-combat')).toBeVisible()
  expect(await page.locator('body').innerText()).not.toMatch(/离线收益|十连|保底|秘籍残页|铁匠铺|强化|淬炼|重铸|拆解|首次通关|首次奖励|叩关/)
})
