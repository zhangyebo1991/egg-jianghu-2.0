import { expect, test } from '@playwright/test'

for (const size of [
  { width: 1440, height: 900 }, { width: 1920, height: 1080 },
  { width: 390, height: 844 }, { width: 320, height: 844 },
  { width: 844, height: 390 }, { width: 740, height: 360 },
]) {
  test(`三路五列镜像居中，增减角色与换波不移动阵位 ${size.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(size)
    await page.goto('/')
    await page.getByRole('button', { name: '新建游戏', exact: true }).click()
    await page.getByLabel('玩家姓名').fill('阵位验收')
    await page.getByLabel('玩家姓名').press('Enter')

    const layouts = await page.evaluate(() => {
      const api = window.__EGG_JIANGHU__
      const capture = () => [...document.querySelectorAll<HTMLElement>('.unit-cell')].map(cell => {
        const box = cell.getBoundingClientRect()
        const portrait = cell.querySelector('.unit-portrait')?.getBoundingClientRect()
        return {
          side: cell.hasAttribute('data-formation-slot') ? 'party' : 'enemy',
          row: Number(cell.dataset.row), col: Number(cell.dataset.col),
          x: box.x, y: box.y, width: box.width, height: box.height,
          portrait: portrait ? { x: portrait.x + portrait.width / 2, y: portrait.y } : null,
        }
      })
      api.startStage('world_01', 1, 'guard', 19)
      api.showWave(1, 19)
      const alone = capture()
      for (const [id, row, col] of [
        ['hero_mu_nianci', 0, 0], ['hero_yang_tiexin', 2, 0],
        ['hero_orig_2', 1, 1], ['hero_orig_3', 0, 2], ['hero_orig_4', 2, 4],
      ] as const) {
        api.recruitHero(id)
        api.placeHero(id, row, col)
      }
      api.startStage('world_01', 1, 'guard', 19)
      api.showWave(9, 19)
      const sixHeroes = capture()
      api.showWave(10, 19)
      const bossWave = capture()
      api.advanceCombat(200)
      return [alone, sixHeroes, bossWave, capture()]
    })

    for (const layout of layouts) {
      expect(layout).toHaveLength(30)
      for (const party of layout.filter(cell => cell.side === 'party')) {
        const enemy = layout.find(cell => cell.side === 'enemy' && cell.row === party.row && cell.col === party.col)!
        expect(party.x + party.width / 2 + enemy.x + enemy.width / 2).toBeCloseTo(size.width, 0)
        expect(party.y).toBeCloseTo(enemy.y, 1)
        expect(party.height).toBeCloseTo(enemy.height, 1)
        expect(party.width).toBeCloseTo(enemy.width, 1)
        if (size.width >= 1440) expect(party.width).toBeLessThanOrEqual(86.1)
      }
      for (const [index, cell] of layout.entries()) {
        const original = layouts[0][index]
        for (const dimension of ['x', 'y', 'width', 'height'] as const) {
          expect(cell[dimension]).toBeCloseTo(original[dimension], 1)
        }
        if (cell.portrait && original.portrait && layout !== layouts.at(-1)) {
          expect(cell.portrait.x).toBeCloseTo(original.portrait.x, 1)
          expect(cell.portrait.y).toBeCloseTo(original.portrait.y, 1)
        }
      }
    }
    await page.evaluate(() => {
      window.__EGG_JIANGHU__.startStage('world_01', 1, 'guard', 19)
      window.__EGG_JIANGHU__.showWave(9, 19)
    })
    await page.screenshot({ path: testInfo.outputPath(`fixed-grid-${size.width}.png`), animations: 'disabled' })
  })
}
