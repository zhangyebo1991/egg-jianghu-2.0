import { expect, test } from '@playwright/test'
import { FACTION_MARTIALS, martialByIdV10, martialEffectAtLevel } from '../../src/content/martials'
import { EQUIPMENT_DEFINITIONS } from '../../src/content/equipment'
import { SAVE_KEY_V10 } from '../../src/domain/save-v10'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('配招少侠')
  await page.getByLabel('玩家姓名').press('Enter')
})

test('传承研习对象不显示旧脉系，通用武馆六门技能对全部侠客显示可传', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci'))
  await page.getByTestId('world-world_01').click()
  await page.getByTestId('start-crossing').click()
  await page.getByTestId('world-section-factions').click()
  const firstFactionId = martialByIdV10('original_skill_42')!.factionId
  const martialIds = FACTION_MARTIALS.filter((martial) => martial.factionId === firstFactionId).map((martial) => martial.id)
  expect(martialIds).toHaveLength(6)
  for (const id of martialIds) {
    await page.locator(`[data-action="select-martial"][data-martial-id="${id}"]`).click()
    await page.locator('[data-action="toggle-faction-roster"]').click()
    const roster = page.getByTestId('faction-roster')
    await expect(roster).toBeVisible()
    await expect(roster.locator('.faction-roster-fit')).toHaveText(['可传', '可传'])
    await expect(page.locator('.faction-disciple')).not.toContainText('脉')
    await expect(roster.locator('.faction-roster-row.dim')).toHaveCount(0)
    await page.locator('[data-action="toggle-faction-roster"]').click()
  }
  await page.locator('[data-action="toggle-faction-roster"]').click()
  await page.getByTestId('faction-roster').screenshot({ path: testInfo.outputPath('faction-roster-universal.png'), animations: 'disabled' })
  await page.locator('[data-action="toggle-faction-roster"]').click()
  // 非通用技能仍按当前所选技能的职业限制显示，不能一律标记可传。
  const restricted = FACTION_MARTIALS.find((martial) => martial.worldId === 'world_01' && martial.skillCategory !== 1)!
  await page.evaluate((id) => window.__EGG_JIANGHU__.unlockFaction(id), restricted.factionId!)
  await page.getByTestId(`faction-plaque-${restricted.factionId}`).click()
  await page.locator(`[data-action="select-martial"][data-martial-id="${restricted.id}"]`).click()
  await page.locator('[data-action="toggle-faction-roster"]').click()
  await expect(page.getByTestId('faction-roster-hero_player')).toContainText('职不符')
})

test('武学装配替换卸下、筛选记忆、保存和战斗快照', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1920, height: 911 })
  await page.evaluate((skills) => {
    for (const skill of skills) window.__EGG_JIANGHU__.seedLearnedMartial('hero_player', skill.id, skill.level)
  }, Array.from({ length: 12 }, (_, index) => {
    const id = `original_skill_${42 + index}`
    return { id, level: Math.min(10, martialByIdV10(id)!.maxLevel) }
  }))
  await page.getByTestId('tab-heroes').click()
  await page.locator('[data-action="hero-main-tab"][data-main-tab="martials"]').click()
  await expect(page.locator('.hm-slot')).toHaveCount(4)
  await expect(page.locator('.hm-card')).toHaveCount(12)
  await expect(page.getByTestId('martial-library')).not.toContainText('[color=')
  await expect(page.getByTestId('martial-library')).not.toContainText('buff几率')
  await page.getByTestId('martial-slot-0').getByRole('button', { name: '装配', exact: true }).click()
  await page.getByTestId('learned-original_skill_42').getByRole('button').click()
  await expect(page.getByTestId('martial-slot-0')).toContainText('野球拳')
  await page.getByTestId('martial-slot-0').getByRole('button', { name: '替换' }).click()
  await page.getByTestId('learned-original_skill_43').getByRole('button').click()
  await expect(page.getByTestId('martial-slot-0')).toContainText('临战激励')
  await expect(page.getByTestId('learned-original_skill_42')).toBeVisible()
  await page.getByTestId('martial-slot-0').getByRole('button', { name: '卸下' }).click()
  await expect(page.getByTestId('martial-slot-0')).toContainText('空槽位')
  await page.getByTestId('martial-slot-2').getByRole('button', { name: '装配', exact: true }).click()
  await page.getByTestId('learned-original_skill_42').getByRole('button').click()
  await page.getByLabel('搜索已学武学').fill('野球')
  await expect(page.locator('.hm-card')).toHaveCount(1)
  await page.getByTestId('tab-inventory').click()
  await page.getByTestId('tab-heroes').click()
  await expect(page.getByLabel('搜索已学武学')).toHaveValue('野球')
  await page.getByLabel('搜索已学武学').fill('')
  await page.getByLabel('武学类型').selectOption('通用')
  expect(await page.locator('.hm-card').count()).toBeLessThan(12)
  await page.getByLabel('武学类型').selectOption('all')
  await page.getByLabel('搜索已学武学').fill('免伤')
  await expect(page.getByTestId('learned-original_skill_47')).toBeVisible()
  await page.getByLabel('搜索已学武学').fill('')
  await page.screenshot({ path: testInfo.outputPath('martials-desktop.png'), animations: 'disabled' })
  await page.locator('.hero-martials').evaluate((el) => { el.scrollTop = 180 })
  const scroll = await page.locator('.hero-martials').evaluate((el) => el.scrollTop)
  expect(scroll).toBeGreaterThan(0)
  await page.getByTestId('tab-inventory').click()
  await page.getByTestId('tab-heroes').click()
  await expect.poll(() => page.locator('.hero-martials').evaluate((el) => el.scrollTop)).toBe(scroll)
  for (const width of [1440, 640, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.screenshot({ path: testInfo.outputPath(`martials-${width}.png`), fullPage: true, animations: 'disabled' })
  }
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.equippedMartialIds)).toEqual([null, null, 'original_skill_42', null])
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.placeHero('hero_player', 0, 0)
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 13)
  })
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getCombat().party[0].skillIds)).toEqual([42])
  await page.getByTestId('tab-heroes').click()
  await page.locator('[data-action="hero-main-tab"][data-main-tab="martials"]').click()
  await expect(page.getByTestId('martial-slot-2').getByRole('button', { name: '卸下' })).toBeDisabled()
  await expect(page.getByTestId('idle-combat-return')).toBeVisible()
  expect(errors).toEqual([])
})

test('器魂增加技能等级后，武学说明显示超过学习上限的实际效果', async ({ page }, testInfo) => {
  const martial = martialByIdV10('original_skill_42')!
  const equipment = EQUIPMENT_DEFINITIONS.find(item => item.artifactSoulId === 26)!
  expect(equipment).toBeDefined()
  await page.evaluate(({ key, equipment, maxLevel }) => {
    window.__EGG_JIANGHU__.seedLearnedMartial('hero_player', 'original_skill_42', maxLevel, 0)
    const state = window.__EGG_JIANGHU__.getState()
    const hero = state.heroes.hero_player
    state.inventory.push({ uid: 'skill-level-soul', definitionId: equipment.id, level: 1, quality: 1, coreStats: [], affixes: [], locked: false })
    hero.equipmentBySlot[equipment.slot] = 'skill-level-soul'
    hero.equipmentSets[hero.activeEquipmentSetIndex][equipment.slot] = 'skill-level-soul'
    window.localStorage.setItem(key, JSON.stringify(state))
  }, { key: SAVE_KEY_V10, equipment, maxLevel: martial.maxLevel })
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await page.getByTestId('tab-heroes').click()
  await page.locator('[data-action="hero-main-tab"][data-main-tab="martials"]').click()
  const card = page.getByTestId('learned-original_skill_42')
  await expect(card).toContainText(`技能等级加成 +5 · 生效 Lv.${martial.maxLevel + 5}`)
  await expect(card.locator('p')).toContainText(`${martialEffectAtLevel(martial, martial.maxLevel + 5)}%`)
  await card.screenshot({ path: testInfo.outputPath('martial-effective-level.png'), animations: 'disabled' })
})

test('武学装配属性在实际基础面板生效，卸下恢复', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => window.__EGG_JIANGHU__.seedLearnedMartial('hero_player', 'original_skill_42', 10))
  await page.getByTestId('tab-heroes').click()
  const basicTab = page.locator('[data-action="hero-main-tab"][data-main-tab="basic"]')
  const martialTab = page.locator('[data-action="hero-main-tab"][data-main-tab="martials"]')
  const attack = page.locator('.attr2[data-stat-label="物攻"] .av')
  await basicTab.click()
  await expect(attack).toBeVisible()
  const baseline = Number(await attack.innerText())
  await martialTab.click()
  await page.getByTestId('martial-slot-0').getByRole('button', { name: '装配', exact: true }).click()
  await page.getByTestId('learned-original_skill_42').getByRole('button').click()
  await basicTab.click()
  expect(Number(await attack.innerText())).toBeGreaterThan(baseline)
  await martialTab.click()
  await page.getByTestId('martial-slot-0').getByRole('button', { name: '卸下' }).click()
  await basicTab.click()
  await expect(attack).toHaveText(String(baseline))
})

test('世界与势力往返保留位置，已学武学可直达装配', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate((key) => {
    const state = window.__EGG_JIANGHU__.getState()
    state.heroes.hero_player.skillPoints = 1000
    state.worldCurrency.world_01 = 10000
    window.localStorage.setItem(key, JSON.stringify(state))
  }, SAVE_KEY_V10)
  await page.reload()
  await page.getByRole('button', { name: '继续游戏' }).click()
  await page.getByTestId('world-world_01').click()
  await page.getByTestId('start-crossing').click()
  await page.getByTestId('world-section-factions').click()
  await page.locator('.game-main').evaluate((el) => { el.scrollTop = 100 })
  await page.locator('[data-action="select-martial"][data-martial-id="original_skill_42"]').click()
  await page.locator('[data-action="martial-learn"]').click()
  expect(await page.evaluate(() => window.__EGG_JIANGHU__.getState().heroes.hero_player.learnedMartials.original_skill_42.level)).toBe(1)
  await page.getByRole('button', { name: '前往装配', exact: true }).click()
  await expect(page.getByTestId('hero-martials')).toBeVisible()
  await expect(page.getByTestId('learned-original_skill_42')).toHaveClass(/highlighted/)
  await expect(page.getByTestId('hero-world-return')).toContainText('势力')
  await page.screenshot({ path: testInfo.outputPath('martials-return-to-world.png'), animations: 'disabled' })
  await page.getByTestId('learned-original_skill_42').getByRole('button').click()
  await page.getByTestId('hero-world-return').click()
  await expect(page.getByTestId('factions-page')).toBeVisible()
  await expect(page.getByTestId('faction-martial-detail')).toContainText('野球拳')
  await page.getByTestId('tab-heroes').click()
  await page.getByTestId('tab-idle').click()
  await expect(page.getByTestId('factions-page')).toBeVisible()
  await expect(page.getByTestId('world-overview')).toHaveCount(0)
  await page.locator('.world-subnav [data-action="return-worlds"]').click()
  await expect(page.getByTestId('world-overview')).toBeVisible()
})

test('行囊末页与侠客选择在离页后保留', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 })
  await page.evaluate(() => {
    window.__EGG_JIANGHU__.fillInventory(300)
    window.__EGG_JIANGHU__.recruitHero('hero_mu_nianci')
  })
  await page.getByTestId('tab-heroes').click()
  await page.getByTestId('hero-hero_mu_nianci').click()
  await page.locator('[data-action="hero-main-tab"][data-main-tab="martials"]').click()
  for (let index = 0; index < 30; index++) {
    const next = page.locator('.pack-page .pg-btn').last()
    if (await next.isDisabled()) break
    await next.click()
  }
  const status = await page.locator('.pack-page-status').innerText()
  const firstUid = await page.locator('.pack-cell').first().getAttribute('data-equipment-uid')
  await page.getByTestId('tab-inventory').click()
  await page.getByTestId('tab-heroes').click()
  await expect(page.locator('.pack-page-status')).toHaveText(status)
  await expect(page.locator('.pack-cell').first()).toHaveAttribute('data-equipment-uid', firstUid!)
  await expect(page.locator('[data-action="hero-main-tab"][data-main-tab="martials"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('hero-hero_mu_nianci')).toHaveClass(/active/)
})

test('同类武学使用各自原版图标，携带槽位与列表一致', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    for (const [slot, id] of [42, 43, 44].entries()) window.__EGG_JIANGHU__.seedLearnedMartial('hero_player', `original_skill_${id}`, 1, slot)
  })
  await page.getByTestId('tab-heroes').click()
  await page.locator('[data-action="hero-main-tab"][data-main-tab="martials"]').click()
  for (const [slot, id] of [42, 43, 44].entries()) {
    const icon = page.getByTestId(`learned-original_skill_${id}`).locator('header img')
    await expect(icon).toHaveAttribute('src', new RegExp(`skill_${id}\\.webp`))
    expect(await icon.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
    await expect(page.getByTestId(`martial-slot-${slot}`).locator('img')).toHaveAttribute('src', await icon.getAttribute('src') as string)
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.locator('.hero-martials').screenshot({ path: testInfo.outputPath(`original-skill-icons-${width}.png`) })
  }
})
