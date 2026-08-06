import { expect, test } from '@playwright/test'

test('移除已结束的短效节点时不会重新插入仍在播放的伤害飘字', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const { createDomPatcher } = await import('/src/ui/dom-patch.ts')
    const root = document.createElement('div')
    document.body.append(root)
    const patch = createDomPatcher(root)

    patch(`
      <article data-testid="combat-unit-test">
        <span class="slash-arc" data-testid="combat-effect-slash"></span>
        <span class="dmg-float" data-testid="combat-effect-damage">39</span>
      </article>
    `)

    const originalDamage = root.querySelector('[data-testid="combat-effect-damage"]')
    let damageInsertions = 0
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node === originalDamage) damageInsertions += 1
        }
      }
    })
    observer.observe(root, { childList: true, subtree: true })

    patch(`
      <article data-testid="combat-unit-test">
        <span class="dmg-float" data-testid="combat-effect-damage">39</span>
      </article>
    `)
    observer.disconnect()

    return {
      damageInsertions,
      sameNode: root.querySelector('[data-testid="combat-effect-damage"]') === originalDamage,
    }
  })

  expect(result).toEqual({ damageInsertions: 0, sameNode: true })
})

test('一次伤害事件的飘字节点在真实战斗刷新中只插入一次', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建游戏' }).click()
  await page.getByLabel('玩家姓名').fill('飘字回归')
  await page.getByLabel('玩家姓名').press('Enter')

  await page.evaluate(() => {
    window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 47)
  })

  const duplicateDamageEffects = await page.evaluate(async () => {
    const insertions = new Map<string, number>()
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement) || !node.matches('.dmg-float[data-testid^="combat-effect-"]')) continue
          const id = node.dataset.testid ?? ''
          insertions.set(id, (insertions.get(id) ?? 0) + 1)
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    window.__EGG_JIANGHU__.advanceCombat(100)
    await new Promise((resolve) => window.setTimeout(resolve, 1_300))
    observer.disconnect()

    return [...insertions.entries()].filter(([, count]) => count > 1)
  })

  expect(duplicateDamageEffects).toEqual([])
})
