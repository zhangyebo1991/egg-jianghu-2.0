import { expect, type Page } from '@playwright/test'

/** 模拟玩家收起当前册页，再从战场顶部打开目标页。 */
export async function openPanel(page: Page, tab: string): Promise<void> {
  const close = page.getByRole('button', { name: '关闭册页', exact: true })
  if (await close.count()) await close.click()
  await page.getByTestId(`tab-${tab}`).click()
  await expect(page.getByTestId('ink-panel')).toBeVisible()
}

export async function openFactionSection(page: Page, section: 'quests' | 'exchange' | 'recruit' | 'martials'): Promise<void> {
  const close = page.getByRole('button', { name: '关闭册页', exact: true })
  if (await close.count()) await close.click()
  await page.locator(`.ink-iconbar [data-faction-panel="${section === 'martials' ? 'quests' : section}"]`).click()
  if (section === 'martials') await page.locator('.ink-faction-tabs [data-faction-panel="martials"]').click()
}
