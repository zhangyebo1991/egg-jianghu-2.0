import { expect, test, type Page } from '@playwright/test'

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
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 1, 1)
  })
}

const enterWorld = async (page: Page, worldId = 'world_01'): Promise<void> => {
  await page.getByTestId('tab-idle').click()
  await page.getByTestId(`world-${worldId}`).click()
  await page.getByTestId('start-crossing').click()
}

const openWorldSection = async (page: Page, section: 'stages' | 'factions' | 'city'): Promise<void> => {
  await page.evaluate((nextSection) => window.__EGG_JIANGHU__.setJianghuSection(nextSection), section)
}

test('江湖按大关小关分层并在点击小关后立即驻守', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 1, 1)
  })
  await expect(page.getByTestId('world-overview')).toBeVisible()
  await expect(page.getByTestId('stage-1')).toHaveCount(0)

  await page.getByTestId('world-world_01').click()
  await page.getByTestId('start-crossing').click()
  await expect(page.getByTestId('stage-overview')).toBeVisible()
  await expect(page.locator('button[data-testid^="stage-"]')).toHaveCount(10)

  await page.getByTestId('stage-1').click()
  await expect(page.getByTestId('idle-page')).toBeVisible()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getSelection())).toEqual({
    worldId: 'world_01',
    difficulty: 1,
    stage: 1,
    mode: 'guard',
  })
})

test('战场左右对峙且敌我最前列在中线两侧相邻', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.evaluate(() => {
    const placements = [
      ['hero_mu_nianci', 0, 0],
      ['hero_yang_tiexin', 2, 0],
      ['hero_qingfeng_hall_01', 1, 1],
      ['hero_tieyi_school_01', 0, 2],
      ['hero_renxin_hall_01', 2, 2],
    ] as const
    for (const [heroId, row, col] of placements) {
      window.__EGG_JIANGHU__.recruitHero(heroId)
      window.__EGG_JIANGHU__.placeHero(heroId, row, col)
    }
  })
  await page.getByTestId('world-world_01').click()
  await page.getByTestId('start-crossing').click()
  await page.getByTestId('stage-1').click()

  const layout = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
    return {
      enemy: rect('.battle-half.enemy'),
      divider: rect('.battle-divider'),
      party: rect('.battle-half.party'),
      enemyFront: rect('[data-enemy-slot="1-0"]'),
      enemyBack: rect('[data-enemy-slot="1-4"]'),
      partyFront: rect('[data-formation-slot="1-0"]'),
      partyBack: rect('[data-formation-slot="1-4"]'),
    }
  })

  expect(layout.party.right).toBeLessThanOrEqual(layout.divider.left + 1)
  expect(layout.divider.right).toBeLessThanOrEqual(layout.enemy.left + 1)
  expect(layout.partyBack.left).toBeLessThan(layout.partyFront.left)
  expect(layout.partyFront.right).toBeLessThanOrEqual(layout.enemyFront.left)
  expect(layout.enemyFront.right).toBeLessThanOrEqual(layout.enemyBack.right)
})

test('桌面与移动端均使用统一左侧栏', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const desktop = await page.evaluate(() => {
    const sidebar = document.querySelector('.game-sidebar')!.getBoundingClientRect()
    const main = document.querySelector('.game-main')!.getBoundingClientRect()
    return { sidebar: { x: sidebar.x, width: sidebar.width, height: sidebar.height }, mainX: main.x }
  })
  expect(desktop.sidebar.x).toBe(0)
  expect(desktop.sidebar.width).toBe(212)
  expect(desktop.sidebar.height).toBe(800)
  expect(desktop.mainX).toBeGreaterThanOrEqual(desktop.sidebar.width)

  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = await page.evaluate(() => {
    const sidebar = document.querySelector('.game-sidebar')!
    const main = document.querySelector('.game-main')!.getBoundingClientRect()
    return {
      sidebarDisplay: getComputedStyle(sidebar).display,
      sidebarWidth: sidebar.getBoundingClientRect().width,
      mainX: main.x,
      mainTop: main.y,
      topbarCount: document.querySelectorAll('.jianghu-mobile-topbar').length,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
  expect(mobile.sidebarDisplay).toBe('flex')
  expect(mobile.sidebarWidth).toBe(64)
  expect(mobile.mainX).toBe(64)
  expect(mobile.mainTop).toBe(0)
  expect(mobile.topbarCount).toBe(0)
  expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.viewportWidth)
})

test('三个全局入口共享同一套侧栏外观', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const metrics = []
  for (const tab of ['idle', 'heroes', 'formation'] as const) {
    await page.getByTestId(`tab-${tab}`).click()
    metrics.push(await page.evaluate(() => {
      const sidebar = document.querySelector<HTMLElement>('.game-sidebar')!
      const seal = document.querySelector<HTMLElement>('.brand-seal')!
      const navItem = document.querySelector<HTMLElement>('.nav-item')!
      const navMark = document.querySelector<HTMLElement>('.nav-mark')!
      const sealStyle = getComputedStyle(seal)
      const navStyle = getComputedStyle(navItem)
      const markStyle = getComputedStyle(navMark)
      return {
        sidebarWidth: sidebar.getBoundingClientRect().width,
        sidebarPadding: getComputedStyle(sidebar).padding,
        sealRadius: sealStyle.borderRadius,
        sealFont: sealStyle.fontFamily,
        navHeight: navItem.getBoundingClientRect().height,
        navRadius: navStyle.borderRadius,
        markRadius: markStyle.borderRadius,
        markFont: markStyle.fontFamily,
        topbarCount: document.querySelectorAll('.jianghu-mobile-topbar').length,
      }
    }))
  }

  expect(new Set(metrics.map((item) => JSON.stringify(item))).size).toBe(1)
  expect(metrics[0]).toMatchObject({
    sidebarWidth: 212,
    sidebarPadding: '26px 20px 20px',
    sealRadius: '6px',
    navHeight: 50,
    navRadius: '6px',
    markRadius: '5px',
    topbarCount: 0,
  })
})

test('江湖总览展示十三位面缩略图且未解锁面仍可点选', async ({ page }) => {
  await expect(page.locator('.plane-thumb')).toHaveCount(13)
  await expect(page.getByTestId('world-overview')).toBeVisible()
  await expect(page.getByTestId('start-crossing')).toBeEnabled()
  await page.getByTestId('world-world_02').click()
  await expect(page.getByTestId('start-crossing')).toBeDisabled()
  await expect(page.getByTestId('world-overview')).toContainText('武侠江湖')
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

test('江湖关卡页不显示势力和城市入口', async ({ page }) => {
  await enterWorld(page)
  await expect(page.getByTestId('stage-overview')).toBeVisible()
  await expect(page.locator('[data-jianghu-section]')).toHaveCount(0)
  await expect(page.getByTestId('world-section-factions')).toHaveCount(0)
  await expect(page.getByTestId('world-section-city')).toHaveCount(0)
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

test('返回总览隐藏二级导航且通关基础后可穿越下一位面', async ({ page }) => {
  await enterWorld(page)
  await page.getByRole('button', { name: '← 返回位面' }).click()
  await expect(page.locator('[data-jianghu-section]')).toHaveCount(0)

  await prepareParty(page)
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.setClearedStage('world_01', 9)
    window.__EGG_JIANGHU__.startStage('world_01', 10, 'roam', 23)
    window.__EGG_JIANGHU__.forceCombatResult('victory')
  })
  await page.getByTestId('tab-idle').click()
  await page.getByTestId('world-world_02').click()
  await page.getByTestId('start-crossing').click()
  await expect(page.getByTestId('stage-overview')).toBeVisible()
  await expect(page.getByTestId('stage-overview')).toContainText('武侠江湖')
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

test('侠客页展示当前职业与诸天属性', async ({ page }) => {
  await page.setViewportSize({ width: 1676, height: 941 })
  await page.getByTestId('tab-heroes').click()

  const rosterList = page.getByTestId('hero-roster-list')
  await expect(rosterList).toHaveCSS('overflow-x', 'hidden')

  const career = page.getByTestId('hero-career-panel')
  await expect(career).toBeVisible()
  await expect(career).toContainText('白丁')
  await expect(career).toContainText('职业')
  await expect(career).toContainText('Lv.1')
  await expect(career).toContainText('可用技能类型')
  await expect(page.getByTestId('hero-equipment-slots')).toHaveCount(0)
  await expect(page.locator('.heroes-page .martial-slots')).toHaveCount(0)

  const stats = page.getByTestId('hero-stats')
  await expect(stats).toContainText('诸天属性')
  await expect(stats.locator('[data-stat-label="臂力"] dd')).toHaveText('10')
  await expect(stats.locator('[data-stat-label="生命"] dd')).not.toHaveText('0')
  await expect(stats.locator('[data-stat-label="物攻"] dd')).not.toHaveText('0')
  await expect(stats.locator('[data-stat-label="命中修正"] dd')).toHaveText('0%')

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('侠客页不再展示装备栏与行囊', async ({ page }) => {
  await page.setViewportSize({ width: 1676, height: 941 })
  await page.evaluate(() => window.__EGG_JIANGHU__.fillInventory(2))
  await page.getByTestId('tab-heroes').click()

  await expect(page.getByTestId('hero-inventory-panel')).toHaveCount(0)
  await expect(page.getByTestId('hero-equipment-slots')).toHaveCount(0)
  await expect(page.getByTestId('hero-career-panel')).toBeVisible()
  await expect(page.getByTestId('open-career-tree')).toBeVisible()

  const columnOrder = await page.evaluate(() => {
    const roster = document.querySelector('.hero-roster')!.getBoundingClientRect()
    const detail = document.querySelector('.hero-workbench')!.getBoundingClientRect()
    return { rosterRight: roster.right, detailLeft: detail.left }
  })
  expect(columnOrder.rosterRight).toBeLessThanOrEqual(columnOrder.detailLeft)

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('侠客页打开转职树可查看职业节点与转职书', async ({ page }) => {
  await page.getByTestId('tab-heroes').click()
  await page.getByTestId('open-career-tree').click()
  await expect(page.getByTestId('career-tree')).toBeVisible()
  await expect(page.getByTestId('career-node-job_1')).toBeVisible()
  await page.getByTestId('career-node-job_5').click()
  await expect(page.getByTestId('career-tree-detail')).toContainText('弓手')
  await expect(page.getByTestId('career-tree-detail')).toContainText('弓手转职书')
  await expect(page.getByTestId('career-change')).toBeDisabled()
})

test('从酒馆邀请侠客后在阵容页拖拽上阵', async ({ page }) => {
  await openWorldSection(page, 'city')
  await page.getByTestId('tavern-hero_mu_nianci').getByRole('button', { name: '直接邀请' }).click()
  await page.getByTestId('tavern-hero_yang_tiexin').getByRole('button', { name: '直接邀请' }).click()

  await page.getByTestId('tab-formation').click()
  await expect(page.getByTestId('formation-page')).toBeVisible()

  await page.dragAndDrop('[data-testid="formation-hero-hero_mu_nianci"]', '.formation-slot[data-row="0"][data-col="0"]')
  await page.dragAndDrop('[data-testid="formation-hero-hero_yang_tiexin"]', '.formation-slot[data-row="2"][data-col="3"]')

  const formation = await page.evaluate(() => window.__EGG_JIANGHU__.getState().formation)
  expect(formation).toEqual(expect.arrayContaining([
    { heroId: 'hero_mu_nianci', row: 0, col: 0 },
    { heroId: 'hero_yang_tiexin', row: 2, col: 3 },
  ]))
})

test('白丁 Lv.5 持弓手转职书可转职且侠客等级保持不变', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.setHeroCareerLevel('hero_mu_nianci', 'job_1', 5)
    window.__EGG_JIANGHU__.grantJobBook('job_5', 1)
  })
  const heroLevel = await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_mu_nianci.level)

  await page.getByTestId('tab-heroes').click()
  await page.getByTestId('hero-hero_mu_nianci').click()
  await page.getByTestId('open-career-tree').click()
  await page.getByTestId('career-node-job_5').click()
  await expect(page.getByTestId('career-change')).toBeEnabled()
  await page.getByTestId('career-change').click()

  const hero = await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_mu_nianci)
  expect(hero.level).toBe(heroLevel)
  expect(hero.currentCareerId).toBe('job_5')
  expect(hero.careers.job_1.level).toBe(5)
  expect(hero.careers.job_5.level).toBe(1)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().jobBooks.job_5 ?? 0)).toBe(0)
})

test('战斗使用当前职业普攻', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 1, 1)
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 73)
  })
  const events = await page.evaluate(() => window.__EGG_JIANGHU__.advanceCombat(100))
  expect(events).toContainEqual(expect.objectContaining({ type: 'skill-used', skillId: 'base_job_1' }))
})

test('每个小关第十波显示 Boss 精英和小怪', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 1, 1)
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 19)
    window.__EGG_JIANGHU__.showWave(10, 19)
  })
  await expect(page.getByRole('heading', { name: '第 10 / 10 波' })).toBeVisible()
  const enemyBoard = page.getByRole('region', { name: '敌方阵容' })
  await expect(enemyBoard.locator('[data-rank="boss"]')).toHaveCount(1)
  await expect(enemyBoard.locator('[data-rank="elite"]')).toHaveCount(1)
  await expect(enemyBoard.locator('[data-rank="normal"]')).toHaveCount(1)
})

test('闯荡失败回退上一小关并切换驻守', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 1, 1)
    window.__EGG_JIANGHU__.setClearedStage('world_01', 3)
    window.__EGG_JIANGHU__.startStage('world_01', 4, 'roam', 31)
    window.__EGG_JIANGHU__.forceCombatResult('defeat')
  })
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getSelection())).toEqual({ worldId: 'world_01', difficulty: 1, stage: 3, mode: 'guard' })
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getCombat()?.wave)).toBe(1)
})

test('敌人死亡时货币立即入账且本阶段不掉装备', async ({ page }) => {
  const before = await page.evaluate(() => window.__EGG_JIANGHU__.getState().worldCurrency.world_01 ?? 0)
  const added = await page.evaluate(() => window.__EGG_JIANGHU__.settleEnemy(101, 'boss'))
  const after = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  expect(added).toEqual([])
  expect(after.inventory).toHaveLength(0)
  expect(after.worldCurrency.world_01).toBeGreaterThan(before)
})

test('击杀不因背包容量中断战斗', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 1, 1)
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 103)
    window.__EGG_JIANGHU__.fillInventory(300)
  })
  const added = await page.evaluate(() => window.__EGG_JIANGHU__.settleEnemy(103, 'boss'))
  const state = await page.evaluate(() => window.__EGG_JIANGHU__.getState())
  expect(added).toEqual([])
  expect(state.inventory).toHaveLength(300)
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getCombat()?.result)).toBe('fighting')
})

test('势力六格悬榜锁定已接任务并刷新未接任务', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.grantContribution('qingfeng_hall', 1_000)
    window.__EGG_JIANGHU__.grantContribution('tieyi_school', 400)
    window.__EGG_JIANGHU__.prepareQuestBoard('qingfeng_hall', 211)
  })
  await openWorldSection(page, 'factions')
  await expect(page.locator('[data-quest-slot]')).toHaveCount(6)
  await expect(page.locator('.faction-quest-grid')).not.toContainText('world_01_stage_01')
  await expect(page.locator('.faction-notice h3').first()).toContainText(/^(?:黄巾战士|张角)$/)
  await page.getByTestId('faction-page-title').hover()
  await page.waitForTimeout(750)
  const questCard = page.getByTestId('quest-slot-0')
  const restingTransform = await questCard.evaluate((element) => getComputedStyle(element).transform)
  await questCard.hover()
  await expect.poll(() => questCard.evaluate((element) => getComputedStyle(element).transform)).not.toBe(restingTransform)
  await page.getByTestId('faction-page-title').hover()
  await expect.poll(() => questCard.evaluate((element) => getComputedStyle(element).transform)).toBe(restingTransform)

  const purse = page.getByTestId('faction-purse').locator('strong')
  await page.getByTestId('faction-plaque-tieyi_school').click()
  const cardMotionPlaying = await page.getByTestId('quest-slot-0').evaluate((element) =>
    element.getAnimations().some((animation) => animation.playState === 'running'))
  const purseMotionPlaying = await page.getByTestId('faction-purse').evaluate((element) =>
    element.getAnimations().some((animation) => animation.playState === 'running'))
  expect(cardMotionPlaying).toBe(true)
  expect(purseMotionPlaying).toBe(true)
  await page.waitForTimeout(120)
  const tieyiContribution = await page.evaluate(() => window.__EGG_JIANGHU__.getState().contribution.tieyi_school ?? 0)
  expect(await purse.textContent()).not.toBe(tieyiContribution.toLocaleString('zh-CN'))
  await expect(purse).toHaveText(tieyiContribution.toLocaleString('zh-CN'), { timeout: 1_000 })
  await page.getByTestId('faction-plaque-qingfeng_hall').click()
  await expect(page.getByTestId('faction-plaque-qingfeng_hall')).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(750)

  const before = await page.evaluate(() => window.__EGG_JIANGHU__.getState().factionBoards.qingfeng_hall.slots.map((slot) => slot?.id ?? null))
  await page.getByTestId('quest-slot-0').getByRole('button', { name: '揭榜' }).click()
  await page.evaluate(() => window.__EGG_JIANGHU__.advanceRuntime(3_600_000))
  const after = await page.evaluate(() => window.__EGG_JIANGHU__.getState().factionBoards.qingfeng_hall.slots.map((slot) => slot?.id ?? null))
  expect(after[0]).toBe(before[0])
  expect(after.slice(1)).not.toEqual(before.slice(1))
})

test('势力页支持切换匾额和门人拜帖', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.grantContribution('qingfeng_hall', 1000)
  })
  await openWorldSection(page, 'factions')

  await page.getByTestId('faction-plaque-tieyi_school').click()
  await expect(page.getByTestId('faction-plaque-tieyi_school')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('faction-page-title')).toBeVisible()
  await page.getByTestId('faction-plaque-qingfeng_hall').click()
  await expect(page.getByTestId('faction-plaque-qingfeng_hall')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('faction-invite-panel')).toBeVisible()
  await expect(page.getByTestId('faction-hero-hero_qingfeng_hall_01')).toContainText('孙不二')
  await expect(page.getByTestId('faction-meridian')).toHaveCount(0)
})

test('势力页主区可滚动查看悬榜与门人拜帖', async ({ page }) => {
  await openWorldSection(page, 'factions')
  const main = page.locator('.game-main')
  await expect(page.getByTestId('faction-quest-board')).toBeAttached()
  await expect(page.getByTestId('faction-invite-panel')).toBeAttached()

  const metrics = await main.evaluate((element) => ({
    overflowY: getComputedStyle(element).overflowY,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(metrics.overflowY).toBe('auto')
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)

  await main.evaluate((element) => { element.scrollTop = element.scrollHeight })
  const panelBottom = await page.getByTestId('faction-invite-panel').evaluate((element) => element.getBoundingClientRect().bottom)
  expect(panelBottom).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) + 1)
})

test('重载页面后长期收益保留但必须重新选择关卡', async ({ page }) => {
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
    window.__EGG_JIANGHU__.placeHero('hero_mu_nianci', 1, 1)
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
  await expect(page.getByTestId('tab-idle')).toHaveAttribute('aria-current', 'page')
  await page.getByTestId('tab-heroes').click()
  await expect(page.getByTestId('tab-heroes')).toHaveAttribute('aria-current', 'page')
  await page.getByTestId('tab-idle').click()
  await expect(page.getByTestId('tab-idle')).toHaveAttribute('aria-current', 'page')
  await page.getByTestId('tab-formation').click()
  await expect(page.getByTestId('tab-formation')).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.world-subnav')).toHaveCount(0)
  expect(await page.locator('body').innerText()).not.toMatch(/离线收益|十连|保底|秘籍残页|铁匠铺|强化|淬炼|重铸|拆解|首次通关|首次奖励|叩关/)
})
