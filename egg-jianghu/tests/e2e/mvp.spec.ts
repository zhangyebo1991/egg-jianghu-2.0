import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.__EGG_JIANGHU__.reset())
})

test('页面使用原型风格的高对比楷体与深色烫金配色', async ({ page }) => {
  const styleState = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    return {
      rootFamily: root.fontFamily,
      headingFamily: getComputedStyle(document.querySelector('h1')!).fontFamily,
      inkColor: root.color,
      appAreas: getComputedStyle(document.querySelector('#app')!).gridTemplateAreas,
    }
  })

  expect(styleState.rootFamily).toContain('KaiTi')
  expect(styleState.headingFamily).toContain('KaiTi')
  expect(styleState.inkColor).toBe('rgb(236, 227, 205)')
  expect(styleState.appAreas).toContain('nav main')
})

test('启动后先选择大关卡和小关卡，再开始挂机战斗', async ({ page }, testInfo) => {
  await expect(page).toHaveTitle(/蛋蛋江湖 2\.0/)
  await expect(page.locator('h1')).toHaveText('江湖关卡')
  await expect(page.getByTestId('battle-arena')).toHaveCount(0)
  await expect(page.locator('.region-card')).toHaveCount(3)
  await expect(page.getByTestId('region-card-blackwind_fort').getByRole('button')).toBeDisabled()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().combat.status)).toBe('ready')

  await page.getByRole('button', { name: '进入青石古道' }).click()
  await expect(page.getByTestId('stage-map').locator('.stage-card')).toHaveCount(10)
  await page.getByTestId('stage-card-1').getByRole('button', { name: '开始挂机' }).click()
  await expect(page.getByTestId('battle-arena')).toBeVisible()
  await expect(page.getByText(/第 1 关 · 挂机战斗中/)).toBeVisible()

  await page.getByRole('button', { name: /侠客/ }).click()
  await expect(page.getByTestId('hero-roster').locator('.hero-roster-card')).toHaveCount(3)
  await expect(page.getByTestId('martial-slots').locator('.martial-slot')).toHaveCount(4)
  await expect(page.locator('.martial-item')).toHaveCount(0)

  await page.getByRole('button', { name: /队伍/ }).click()
  await expect(page.locator('.party-slot')).toHaveCount(3)
  await page.getByRole('button', { name: /战斗/ }).click()
  await expect(page.getByRole('heading', { name: '青石古道问鼎' })).toBeVisible()
  await expect(page.getByTestId('boss-intel')).toContainText('破阵重击')

  await page.getByRole('button', { name: /关卡/ }).click()
  await page.screenshot({ path: testInfo.outputPath('desktop-idle.png'), fullPage: true })
})

test('可从其他页面通过悬浮入口返回正在进行的挂机战斗', async ({ page }) => {
  await page.getByRole('button', { name: '进入青石古道' }).click()
  await page.getByTestId('stage-card-3').getByRole('button', { name: '开始挂机' }).click()
  await expect(page.getByTestId('idle-combat-return')).toHaveCount(0)

  const defeatsBefore = await page.evaluate(() => window.__EGG_JIANGHU__.getState().statistics.idleEnemiesDefeated)
  await page.getByRole('button', { name: /侠客/ }).click()
  const returnButton = page.getByTestId('idle-combat-return')
  await expect(returnButton).toBeVisible()
  await expect(returnButton).toContainText('青石古道 · 第 3 关')
  expect(await returnButton.evaluate((element) => getComputedStyle(element).animationName)).toBe('none')

  await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(120))
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().statistics.idleEnemiesDefeated)).toBeGreaterThan(defeatsBefore)
  await expect(page.getByRole('heading', { name: '江湖名册' })).toBeVisible()

  await returnButton.click()
  await expect(page.getByRole('heading', { name: '青石古道 · 第 3 关' })).toBeVisible()
  await expect(page.getByTestId('battle-arena')).toBeVisible()
  await expect(page.getByTestId('idle-combat-return')).toHaveCount(0)
  expect(await page.evaluate(() => {
    const combat = window.__EGG_JIANGHU__.getState().combat
    return { mode: combat.mode, status: combat.status, regionId: combat.regionId, stage: combat.stage }
  })).toEqual({ mode: 'idle', status: 'fighting', regionId: 'bluestone_path', stage: 3 })
})

test('可从挂机战斗页立即停止挂机并返回当前章节', async ({ page }) => {
  await page.getByRole('button', { name: '进入青石古道' }).click()
  await page.getByTestId('stage-card-2').getByRole('button', { name: '开始挂机' }).click()

  const stopButton = page.getByRole('button', { name: '停止挂机' })
  await expect(stopButton).toBeVisible()
  await stopButton.click()

  await expect(page.getByTestId('stage-map')).toBeVisible()
  await expect(page.getByRole('heading', { name: '青石古道', exact: true })).toBeVisible()
  await expect(page.getByTestId('battle-arena')).toHaveCount(0)
  await expect(page.getByTestId('idle-combat-return')).toHaveCount(0)
  expect(await page.evaluate(() => {
    const combat = window.__EGG_JIANGHU__.getState().combat
    return { mode: combat.mode, status: combat.status, stage: combat.stage }
  })).toEqual({ mode: 'idle', status: 'ready', stage: null })
})

test('可进入秘境、选择临时祝福并完成首层探索', async ({ page }) => {
  await page.getByRole('button', { name: /秘境/ }).click()
  await expect(page.getByTestId('idle-combat-return')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '无相秘境' })).toBeVisible()
  await expect(page.getByTestId('mystery-route').locator(':scope > span')).toHaveCount(5)
  await page.getByRole('button', { name: '踏入无相秘境' }).click()
  await expect(page.getByTestId('mystery-choices').locator('.mystery-choice-grid > button')).toHaveCount(2)

  await page.getByTestId('mystery-choices').locator('.mystery-choice-grid > button').first().click()
  await expect(page.getByTestId('battle-arena')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().combat.mode)).toBe('mystery')
  await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(240))

  await expect(page.getByTestId('mystery-choices')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().mystery.run?.floor)).toBe(1)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '离开秘境' }).click()
  await expect(page.getByRole('button', { name: '踏入无相秘境' })).toBeVisible()
})

test('侠客页只显示已拥有侠客并提供四槽武功工作台', async ({ page }) => {
  await page.getByRole('button', { name: /侠客/ }).click()
  await expect(page.getByTestId('hero-roster').locator('.hero-roster-card')).toHaveCount(3)
  await expect(page.getByText('藏经阁 · 五门武学')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /银两结识/ })).toHaveCount(0)
  await expect(page.getByTestId('martial-slots').locator('.martial-slot')).toHaveCount(4)
  await expect(page.getByTestId('learned-martials')).toContainText('已学武功')

  const cards = page.getByTestId('hero-roster').locator('.hero-roster-card')
  expect(await cards.count()).toBe(3)
  await cards.nth(1).click()
  await expect(page.getByTestId('hero-detail')).toContainText('Lv.1')
})

test('侠客可卸下、重新装备并确认遗忘返还 80% 资源', async ({ page }) => {
  const seeded = await page.evaluate(() => {
    const state = window.__EGG_JIANGHU__.getState()
    const heroId = state.formation[0].heroId
    const martialId = state.heroes[heroId].equippedMartialIds[0]!
    state.heroes[heroId].learnedMartials[martialId].invested = {
      silver: 101,
      experience: 9,
      pages: 11,
      reputation: 1,
    }
    return { heroId, martialId, silver: state.resources.silver, serialized: JSON.stringify(state) }
  })
  await page.locator('body > input[type="file"]').setInputFiles({
    name: '侠客测试存档.json',
    mimeType: 'application/json',
    buffer: Buffer.from(seeded.serialized),
  })
  await page.getByRole('button', { name: /侠客/ }).click()

  await page.getByTestId('martial-slot-0').getByRole('button', { name: '卸下' }).click()
  await page.getByTestId(`learned-${seeded.martialId}`).getByRole('button', { name: '装备' }).click()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByTestId(`learned-${seeded.martialId}`).getByRole('button', { name: '遗忘' }).click()
  await expect(page.getByTestId(`learned-${seeded.martialId}`)).toHaveCount(1)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().resources.silver)).toBe(seeded.silver)

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('返还：80 银两、7 阅历、8 残页、0 声望')
    await dialog.accept()
  })
  await page.getByTestId(`learned-${seeded.martialId}`).getByRole('button', { name: '遗忘' }).click()

  await expect(page.getByTestId(`learned-${seeded.martialId}`)).toHaveCount(0)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().resources.silver)).toBe(seeded.silver + 80)
})

test('BOSS 挑战期间侠客配置会锁定并说明原因', async ({ page }) => {
  await page.getByRole('button', { name: /战斗/ }).click()
  await page.getByRole('button', { name: /挑战断碑手/ }).click()
  await page.getByRole('button', { name: /侠客/ }).click()

  await expect(page.getByTestId('hero-build-lock')).toContainText('BOSS 挑战期间')
  await expect(page.getByTestId('martial-slot-0').getByRole('button', { name: '卸下' })).toBeDisabled()
})

test('四槽武功会展示预案并按优先级在自动战斗中施展', async ({ page }) => {
  await page.getByRole('button', { name: /侠客/ }).click()
  await expect(page.getByTestId('martial-slots').locator('.martial-slot')).toHaveCount(4)
  await expect(page.getByTestId('learned-martials').locator('.learned-martial-row')).toHaveCount(1)

  await page.getByRole('button', { name: /战斗/ }).click()
  const plans = page.getByTestId('skill-plan').locator('.skill-plan-grid > span')
  await expect(plans).toHaveCount(3)
  await expect(plans.nth(0)).toContainText('1. 赤浪断岳')
  await expect(plans.nth(1)).toContainText('1. 寒江听雪')
  await expect(plans.nth(2)).toContainText('1. 抱元守一')
  await page.getByRole('button', { name: /挑战断碑手/ }).click()
  await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(4))

  await expect(page.locator('.log-skill').first()).toBeVisible()
  await expect(page.locator('.fighter-skill')).toHaveCount(3)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().combat.logs
    .filter((event) => event.kind === 'skill')
    .every((event) => Boolean(event.abilityId)))).toBe(true)
})

test('可切换前后排阵型且战斗按阵位展示', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: /队伍/ }).click()
  await expect(page.getByRole('heading', { name: '列阵与羁绊' })).toBeVisible()
  await expect(page.getByTestId('formation-front-row').locator('.party-slot')).toHaveCount(2)
  await expect(page.getByTestId('formation-back-row').locator('.party-slot')).toHaveCount(1)
  await expect(page.getByText('磐石阵', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '调至后排' }).first().click()
  await expect(page.getByText('雁行阵', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation.map((slot) => slot.row)))
    .toEqual(['back', 'front', 'back'])
  await page.locator('.party-board').screenshot({ path: testInfo.outputPath('desktop-formation.png') })

  await page.getByRole('button', { name: /关卡/ }).click()
  await page.getByRole('button', { name: '进入青石古道' }).click()
  await page.getByTestId('stage-card-1').getByRole('button', { name: '开始挂机' }).click()
  await expect(page.getByTestId('combat-front-row').locator('.fighter-card')).toHaveCount(1)
  await expect(page.getByTestId('combat-back-row').locator('.fighter-card')).toHaveCount(2)

  await page.getByRole('button', { name: /战斗/ }).click()
  await page.getByRole('button', { name: /挑战断碑手/ }).click()
  await page.getByRole('button', { name: /队伍/ }).click()
  await expect(page.locator('.position-button:not([disabled])')).toHaveCount(0)
})

test('击败克制型 BOSS 后解锁区域并能在刷新后恢复', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: /战斗/ }).click()
  await expect(page.getByTestId('boss-intel')).toContainText('磐石阵')
  await page.getByRole('button', { name: /挑战断碑手/ }).click()
  await expect(page.getByTestId('idle-combat-return')).toHaveCount(0)
  await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(120))
  await expect(page.locator('.battle-result.victory')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().defeatedBossIds)).toContain('boss_stonebreaker')

  await page.reload()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().defeatedBossIds)).toContain('boss_stonebreaker')
  await expect(page.getByRole('button', { name: /战斗/ })).toContainText('已破 1/3')

  await page.getByRole('button', { name: /关卡/ }).click()
  await page.getByRole('button', { name: '进入黑风寨' }).click()
  await expect(page.getByTestId('stage-map').locator('.stage-card')).toHaveCount(10)
  await page.getByTestId('stage-map').screenshot({ path: testInfo.outputPath('desktop-regions-unlocked.png') })
  await page.getByTestId('stage-card-1').getByRole('button', { name: '开始挂机' }).click()
  await expect(page.locator('h1')).toHaveText('黑风寨 · 第 1 关')
  await expect(page.getByTestId('battle-arena')).toContainText('黑铁重甲')
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().selectedRegionId)).toBe('blackwind_fort')

  await page.getByRole('button', { name: /战斗/ }).click()
  await expect(page.getByRole('heading', { name: '黑风寨问鼎' })).toBeVisible()
  await expect(page.getByTestId('boss-intel')).toContainText('雁行阵')
  await page.getByTestId('boss-intel').screenshot({ path: testInfo.outputPath('desktop-blackwind-boss.png') })
})

test('可从界面导出 JSON，导入旧存档时不产生离线收益', async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^蛋蛋江湖存档-\d{4}-\d{2}-\d{2}\.json$/)

  const importedState = await page.evaluate(() => {
    const next = window.__EGG_JIANGHU__.getState()
    next.resources.silver = 4_321
    next.lastTickAt = Date.now() - 60 * 60 * 1000
    next.lastSavedAt = next.lastTickAt
    return next
  })
  await page.locator('body > input[type="file"]').setInputFiles({
    name: '江湖旧档.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(importedState)),
  })

  await expect(page.getByRole('heading', { name: '古道未曾停歇' })).toHaveCount(0)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().resources.silver)).toBe(4_321)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().combat.status)).toBe('ready')
})

test('移动端布局保持可操作', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(() => window.__EGG_JIANGHU__.reset())
  await expect(page.getByRole('button', { name: /关卡/ })).toBeVisible()
  await expect(page.getByTestId('battle-arena')).toHaveCount(0)
  await page.getByRole('button', { name: '进入青石古道' }).click()
  await expect(page.getByTestId('stage-map').locator('.stage-card')).toHaveCount(10)
  await page.getByTestId('stage-card-1').getByRole('button', { name: '开始挂机' }).click()
  await expect(page.getByTestId('battle-arena')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('mobile-idle.png'), fullPage: true })
  await page.getByRole('button', { name: /战斗/ }).click()
  await expect(page.getByTestId('boss-intel')).toBeVisible()
  await page.getByTestId('boss-intel').screenshot({ path: testInfo.outputPath('mobile-boss-intel.png') })
  await page.getByRole('button', { name: /队伍/ }).click()
  await expect(page.locator('.party-slot').first()).toBeVisible()
  await expect(page.getByTestId('idle-combat-return')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('mobile-party.png'), fullPage: true })
  await page.getByRole('button', { name: /侠客/ }).click()
  await expect(page.getByTestId('hero-roster')).toBeVisible()
  await expect(page.getByTestId('martial-slots').locator('.martial-slot')).toHaveCount(4)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('mobile-heroes.png'), fullPage: true })
})
