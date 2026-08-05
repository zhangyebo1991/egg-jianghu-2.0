import { expect, test, type Locator, type Page } from '@playwright/test'

let pageErrors: string[]

test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('测试少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await expect(page.getByTestId('world-overview')).toBeVisible()
})

test.afterEach(() => {
  expect(pageErrors).toEqual([])
})

const prepareParty = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 'front', 0)
  })
}

const enterWorld = async (page: Page, worldId = 'world_01'): Promise<void> => {
  await page.getByTestId('tab-idle').click()
  await page.getByTestId(`world-${worldId}`).click()
}

const openWorldSection = async (page: Page, section: 'stages' | 'factions' | 'city'): Promise<void> => {
  await enterWorld(page)
  await page.getByTestId(`world-section-${section}`).click()
}

const expectTooltipInsideViewport = async (page: Page, tooltip: Locator): Promise<void> => {
  await expect.poll(() => tooltip.evaluate((element) => element.matches(':popover-open'))).toBe(true)
  const bounds = await tooltip.boundingBox()
  const viewport = page.viewportSize()
  expect(bounds).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height)
}

test('江湖按大关小关分层并在点击小关后立即驻守', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 'front', 0)
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

test('战场纵向排列且敌我前排在中线两侧相邻', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.evaluate(() => {
    const placements = [
      ['hero_mu_nianci', 'front', 1],
      ['hero_yang_tiexin', 'front', 2],
      ['hero_qingfeng_hall_01', 'back', 0],
      ['hero_tieyi_school_01', 'back', 1],
      ['hero_renxin_hall_01', 'back', 2],
    ] as const
    for (const [heroId, row, position] of placements) {
      window.__EGG_JIANGHU__.recruitHero(heroId)
      window.__EGG_JIANGHU__.placeHero(heroId, row, position)
    }
  })
  await page.getByTestId('world-world_01').click()
  await page.getByTestId('stage-1').click()

  const layout = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
    return {
      enemy: rect('.enemy-side'),
      divider: rect('.battle-divider'),
      party: rect('.party-side'),
      enemyBack: rect('[data-enemy-slot="back-0"]'),
      enemyFront: rect('[data-enemy-slot="front-0"]'),
      partyFront: rect('[data-formation-slot="front-0"]'),
      partyBack: rect('[data-formation-slot="back-0"]'),
    }
  })

  expect(layout.enemy.bottom).toBeLessThanOrEqual(layout.divider.top)
  expect(layout.divider.bottom).toBeLessThanOrEqual(layout.party.top)
  expect(layout.enemyBack.top).toBeLessThan(layout.enemyFront.top)
  expect(layout.partyFront.top).toBeLessThan(layout.partyBack.top)
})

test('桌面与移动端导航始终位于内容左侧', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const desktop = await page.evaluate(() => {
    const sidebar = document.querySelector('.game-sidebar')!.getBoundingClientRect()
    const main = document.querySelector('.game-main')!.getBoundingClientRect()
    return { sidebar: { x: sidebar.x, width: sidebar.width, height: sidebar.height }, mainX: main.x }
  })
  expect(desktop.sidebar.x).toBe(0)
  expect(desktop.sidebar.width).toBeGreaterThanOrEqual(140)
  expect(desktop.sidebar.height).toBe(800)
  expect(desktop.mainX).toBeGreaterThanOrEqual(desktop.sidebar.width)

  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = await page.evaluate(() => {
    const sidebar = document.querySelector('.game-sidebar')!.getBoundingClientRect()
    const main = document.querySelector('.game-main')!.getBoundingClientRect()
    return {
      sidebar: { x: sidebar.x, width: sidebar.width, height: sidebar.height },
      mainX: main.x,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
  expect(mobile.sidebar.x).toBe(0)
  expect(mobile.sidebar.width).toBeLessThanOrEqual(80)
  expect(mobile.sidebar.height).toBe(844)
  expect(mobile.mainX).toBeGreaterThanOrEqual(mobile.sidebar.width)
  expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.viewportWidth)
})

test('战斗中即时切换闯荡且不重置现场或收益', async ({ page }) => {
  await prepareParty(page)
  await enterWorld(page)
  await page.getByTestId('stage-1').click()
  const before = await page.evaluate(() => ({
    combat: window.__EGG_JIANGHU__.getCombat(),
    currency: window.__EGG_JIANGHU__.getState().worldCurrency.world_01,
    inventory: window.__EGG_JIANGHU__.getState().inventory.length,
  }))

  await page.getByTestId('mode-roam').click()

  const after = await page.evaluate(() => ({
    combat: window.__EGG_JIANGHU__.getCombat(),
    currency: window.__EGG_JIANGHU__.getState().worldCurrency.world_01,
    inventory: window.__EGG_JIANGHU__.getState().inventory.length,
  }))
  expect(after.combat?.mode).toBe('roam')
  expect(after.combat?.seed).toBe(before.combat?.seed)
  expect(after.combat?.worldId).toBe(before.combat?.worldId)
  expect(after.combat?.stage).toBe(before.combat?.stage)
  expect(after.combat?.elapsedMs).toBeGreaterThanOrEqual(before.combat?.elapsedMs ?? 0)
  expect(after.currency).toBeGreaterThanOrEqual(before.currency)
  expect(after.inventory).toBeGreaterThanOrEqual(before.inventory)
})

test('势力和城市只显示当前大关内容', async ({ page }) => {
  await openWorldSection(page, 'factions')
  await expect(page.getByText('全真教', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('陆家庄', { exact: true })).toHaveCount(0)

  await page.getByTestId('world-section-city').click()
  await expect(page.getByTestId('city-page')).toContainText('牛家村')
  await expect(page.getByTestId('city-page')).not.toContainText('嘉兴')
})

test('离页后恢复同一战斗并在停止后返回小关列表', async ({ page }) => {
  await prepareParty(page)
  await enterWorld(page)
  await page.getByTestId('stage-1').click()
  const seed = await page.evaluate(() => window.__EGG_JIANGHU__.getCombat()?.seed)

  await page.getByTestId('tab-heroes').click()
  await page.getByTestId('idle-combat-return').click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getCombat()?.seed)).toBe(seed)

  await page.getByTestId('stop-combat').click()
  await expect(page.getByTestId('stage-overview')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getCombat())).toBeNull()
})

test('返回总览隐藏二级导航且新大关默认进入关卡', async ({ page }) => {
  await enterWorld(page)
  await page.getByTestId('world-section-city').click()
  await page.locator('[data-action="return-worlds"]').click()
  await expect(page.locator('[data-jianghu-section]')).toHaveCount(0)

  await prepareParty(page)
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.setClearedStage('world_01', 9)
    window.__EGG_JIANGHU__.startStage('world_01', 10, 'roam', 23)
    window.__EGG_JIANGHU__.forceCombatResult('victory')
  })
  await page.getByTestId('tab-idle').click()
  await page.getByTestId('world-world_02').click()
  await expect(page.getByTestId('stage-overview')).toBeVisible()
  await expect(page.getByTestId('world-section-stages')).toHaveClass(/active/)
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
  await prepareParty(page)
  await enterWorld(page)
  await page.getByTestId('stage-1').click()

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

test('侠客页展示基础属性与实时战斗属性', async ({ page }) => {
  await page.setViewportSize({ width: 1676, height: 941 })
  await page.getByTestId('tab-heroes').click()

  const equipmentIcons = page.getByTestId('hero-equipment-slots').locator('img.equipment-art')
  await expect(equipmentIcons).toHaveCount(7)
  expect(await equipmentIcons.evaluateAll((icons) => icons.every((icon) => {
    const image = icon as HTMLImageElement
    return image.complete && image.naturalWidth === 256 && image.naturalHeight === 256
      && image.dataset.iconSource === 'slot'
  }))).toBe(true)

  const stats = page.getByTestId('hero-stats')
  await expect(stats).toContainText('基础属性')
  await expect(stats.locator('[data-stat-label="臂力"] dd')).toHaveText('8')
  await expect(stats).toContainText('战斗属性')
  await expect(stats.locator('[data-stat-label="气血"] dd')).toHaveText('240')
  await expect(stats.locator('[data-stat-label="外功"] dd')).toHaveText('63')
  await expect(stats.locator('[data-stat-label="命中修正"] dd')).toHaveText('6.7%')
})

test('侠客页物品栏支持筛选整理、双击或右键装备及同部位对比', async ({ page }) => {
  await page.setViewportSize({ width: 1676, height: 941 })
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(2))
  await page.getByTestId('tab-heroes').click()

  const panel = page.getByTestId('hero-inventory-panel')
  await expect(panel).toBeVisible()
  await expect(panel.locator('[data-equipment-uid]')).toHaveCount(2)
  expect(await panel.locator('img.equipment-art').evaluateAll((icons) => icons.every((icon) => {
    const image = icon as HTMLImageElement
    return image.complete && image.naturalWidth === 256 && image.naturalHeight === 256
  }))).toBe(true)
  const columnOrder = await page.evaluate(() => {
    const roster = document.querySelector('.hero-roster')!.getBoundingClientRect()
    const detail = document.querySelector('.hero-workbench')!.getBoundingClientRect()
    const inventory = document.querySelector('.hero-inventory-panel')!.getBoundingClientRect()
    return { rosterRight: roster.right, detailLeft: detail.left, detailRight: detail.right, inventoryLeft: inventory.left }
  })
  expect(columnOrder.rosterRight).toBeLessThanOrEqual(columnOrder.detailLeft)
  expect(columnOrder.detailRight).toBeLessThanOrEqual(columnOrder.inventoryLeft)

  await page.getByTestId('hero-inventory-item-debug-equipment-0').dblclick()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.equipmentBySlot.weapon))
    .toBe('debug-equipment-0')
  await expect(page.getByTestId('hero-inventory-item-debug-equipment-0')).toHaveCount(0)
  await expect(panel.locator('[data-equipment-uid]')).toHaveCount(1)
  await expect(panel).toContainText('1 / 300')

  const slot = page.getByTestId('hero-equipment-slot-weapon')
  await expect(slot).toContainText('柴刀')
  await slot.hover()
  const equippedTooltip = slot.locator(':scope > .equipment-tooltip')
  await expect(equippedTooltip).toBeVisible()
  await expectTooltipInsideViewport(page, equippedTooltip)
  await slot.click({ position: { x: 8, y: 8 } })
  await page.getByTestId('selected-hero').locator(':scope > header').hover()
  await expect(slot.locator(':scope > .equipment-tooltip')).toBeHidden()

  const replacement = page.getByTestId('hero-inventory-item-debug-equipment-1')
  await replacement.hover()
  const comparison = replacement.locator(':scope > .equipment-tooltip')
  await expect(comparison).toBeVisible()
  await expectTooltipInsideViewport(page, comparison)
  await expect(comparison).toContainText('当前查看')
  await expect(comparison).toContainText('当前穿戴')
  await replacement.click()
  await page.getByTestId('selected-hero').locator(':scope > header').hover()
  await expect(comparison).toBeHidden()

  await replacement.click({ button: 'right' })
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.equipmentBySlot.weapon))
    .toBe('debug-equipment-1')
  await expect(page.getByTestId('hero-inventory-item-debug-equipment-1')).toHaveCount(0)
  await expect(page.getByTestId('hero-inventory-item-debug-equipment-0')).toBeVisible()

  await panel.locator('[data-hero-inventory-filter="slot"]').selectOption('head')
  await expect(panel.locator('[data-equipment-uid]')).toHaveCount(0)
  await panel.locator('[data-hero-inventory-filter="slot"]').selectOption('weapon')
  await expect(panel.locator('[data-equipment-uid]')).toHaveCount(1)
  await panel.getByRole('button', { name: '整理' }).click()
  await expect(page.getByRole('status')).toHaveText('物品已按部位、品质和等级整理')

  await slot.getByRole('button', { name: '卸下' }).click()
  await expect(slot).toContainText('未装备')
  await expect(panel.locator('[data-equipment-uid]')).toHaveCount(2)
  await expect(page.getByTestId('hero-inventory-item-debug-equipment-1')).toBeVisible()

  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(300))
  await expect(panel.locator('[data-equipment-uid]')).toHaveCount(200)
  await expect(panel).toContainText('第 1 / 2 页 · 本页 200 件')
  const inventoryGrid = await panel.locator('.hero-inventory-list').evaluate((element) => {
    const style = getComputedStyle(element)
    return { columns: style.gridTemplateColumns.split(' ').length, overflow: style.overflow }
  })
  expect(inventoryGrid).toEqual({ columns: 10, overflow: 'visible' })
  await panel.getByRole('button', { name: '下一页' }).click()
  await expect(panel.locator('[data-equipment-uid]')).toHaveCount(100)
  await expect(panel).toContainText('第 2 / 2 页 · 本页 100 件')

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('从酒馆邀请侠客后在阵容页拖拽上阵', async ({ page }) => {
  await openWorldSection(page, 'city')
  await page.getByTestId('tavern-hero_mu_nianci').getByRole('button', { name: '直接邀请' }).click()
  await page.getByTestId('tavern-hero_yang_tiexin').getByRole('button', { name: '直接邀请' }).click()

  await page.getByTestId('tab-formation').click()
  await expect(page.getByTestId('formation-page')).toBeVisible()

  await page.dragAndDrop('[data-testid="formation-hero-hero_mu_nianci"]', '[data-row="front"][data-position="0"]')
  await page.dragAndDrop('[data-testid="formation-hero-hero_yang_tiexin"]', '[data-row="back"][data-position="0"]')

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual(expect.arrayContaining([
    { heroId: 'hero_mu_nianci', row: 'front', position: 0 },
    { heroId: 'hero_yang_tiexin', row: 'back', position: 0 },
  ]))
})

test('职业 Lv.10 转职且侠客等级保持不变', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.setHeroCareerLevel('hero_mu_nianci', 'sword', 10)
  })
  const heroLevel = await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_mu_nianci.level)

  await openWorldSection(page, 'city')
  await page.locator('[data-action="career-buy-token"][data-token-id="token_sword_swift_mid"]').click()
  await page.getByTestId('tab-heroes').click()
  await page.locator('[data-action="career-change"][data-career-id="sword_swift_mid"]').click()

  const hero = await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_mu_nianci)
  expect(hero.level).toBe(heroLevel)
  expect(hero.currentCareerId).toBe('sword_swift_mid')
  expect(hero.careers.sword.level).toBe(10)
  expect(hero.careers.sword_swift_mid.level).toBe(1)
})

test('四槽按优先级跳过不满足条件的武功', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 'front', 0)
    window.__EGG_JIANGHU__.seedLearnedMartial('hero_mu_nianci', 'qingfeng_hall_d1', 1, 0)
    window.__EGG_JIANGHU__.seedLearnedMartial('hero_mu_nianci', 'qingfeng_hall_a1', 1, 1)
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 73)
    window.__EGG_JIANGHU__.setHeroCooldown('hero_mu_nianci', 'qingfeng_hall_d1', 10_000)
  })
  const events = await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(100))
  expect(events).toContainEqual(expect.objectContaining({ type: 'skill-skipped', skillId: 'qingfeng_hall_d1', reason: '武功尚在回气' }))
  expect(events).toContainEqual(expect.objectContaining({ type: 'skill-used', skillId: 'qingfeng_hall_a1' }))
})

test('每个小关第十波显示 Boss 精英和小怪', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 'front', 0)
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
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 'front', 0)
    window.__EGG_JIANGHU__.setClearedStage('world_01', 3)
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
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 'front', 0)
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
  await openWorldSection(page, 'factions')
  await expect(page.locator('[data-quest-slot]')).toHaveCount(6)
  await expect(page.locator('.quest-grid')).not.toContainText('world_01_stage_01')
  await expect(page.locator('.quest-card p').first()).toContainText(/^(?:村中泼皮|段天德)$/)
  const before = await page.evaluate(() => window.__EGG_JIANGHU__.getState().factionBoards.qingfeng_hall.slots.map((slot) => slot?.id ?? null))
  await page.getByTestId('quest-slot-0').getByRole('button', { name: '接受' }).click()
  await page.evaluate(() => window.__EGG_JIANGHU__.advanceRuntime(3_600_000))
  const after = await page.evaluate(() => window.__EGG_JIANGHU__.getState().factionBoards.qingfeng_hall.slots.map((slot) => slot?.id ?? null))
  expect(after[0]).toBe(before[0])
  expect(after.slice(1)).not.toEqual(before.slice(1))
})

test('重载页面后长期收益保留但必须重新选择关卡', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 'front', 0)
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 307)
    window.__EGG_JIANGHU__.settleEnemy(307, 'boss')
  })
  const before = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  await page.reload()
  await expect(page.getByTestId('title-page')).toBeVisible()
  await page.getByRole('button', { name: '继续游戏' }).click()
  const after = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  expect(after.worldCurrency).toEqual(before.worldCurrency)
  expect(after.inventory).toEqual(before.inventory)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getCombat())).toBeNull()
  await expect(page.getByTestId('world-overview')).toBeVisible()
})

test('页面不出现离线收益抽卡残页铁匠铺和首次奖励', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const tab of ['idle', 'heroes', 'inventory'] as const) {
    await page.getByTestId(`tab-${tab}`).click()
    await expect(page.getByTestId(`tab-${tab}`)).toHaveAttribute('aria-current', 'page')
  }
  await page.getByTestId('tab-idle').click()
  await expect(page.getByTestId('world-overview')).toBeVisible()
  expect(await page.locator('body').innerText()).not.toMatch(/离线收益|十连|保底|秘籍残页|铁匠铺|强化|淬炼|重铸|拆解|首次通关|首次奖励|叩关/)
})
