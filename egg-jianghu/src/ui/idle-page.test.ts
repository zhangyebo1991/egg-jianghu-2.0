import { describe, expect, it } from 'vitest'
import { renderIdlePage, type IdlePageViewModel } from './idle-page'

const fixtureViewModel = (overrides: Partial<IdlePageViewModel> = {}): IdlePageViewModel => ({
  worldName: '牛家村',
  selectedStage: 1,
  inventoryCount: 0,
  inventoryCapacity: 300,
  combatSpeed: 1,
  combat: {
    mode: 'guard',
    wave: 1,
    party: [],
    enemies: [],
  },
  logs: [],
  ...overrides,
})

describe('江湖战斗页', () => {
  it('战斗页显示驻守/闯荡且不出现叩关和首次奖励', () => {
    const html = renderIdlePage(fixtureViewModel())

    expect(html).toContain('驻守')
    expect(html).toContain('闯荡')
    expect(html).not.toContain('叩关')
    expect(html).not.toContain('首次通关')
  })

  it('战斗页显示波次、六侠两排、气机、真气、回气与满仓警告', () => {
    const html = renderIdlePage(fixtureViewModel({
      inventoryCount: 300,
      combat: {
        mode: 'guard',
        wave: 10,
        party: [],
        enemies: [
          { id: 'boss', name: '首领', rank: 'boss', row: 'front', position: 0, hp: 100, maxHp: 100, energy: 20, maxEnergy: 100, gauge: 500, cooldownMs: 2300, alive: true },
        ],
      },
    }))

    expect(html).toContain('第 10 / 10 波')
    expect(html.match(/data-formation-slot=/g)).toHaveLength(6)
    expect(html).toContain('气机')
    expect(html).toContain('真气')
    expect(html).toContain('回气')
    expect(html).toContain('背包已满')
  })

  it('按敌上我下展示战场，且双方前排在中线两侧相邻', () => {
    const unit = (id: string, row: 'front' | 'back', position: 0 | 1 | 2) => ({
      id, name: id, rank: 'normal' as const, row, position, hp: 100, maxHp: 100,
      energy: 20, maxEnergy: 100, gauge: 0, cooldownMs: 0, alive: true,
    })
    const html = renderIdlePage(fixtureViewModel({
      combat: {
        mode: 'guard',
        wave: 1,
        enemies: [unit('敌后', 'back', 0), unit('敌前', 'front', 0)],
        party: [unit('我前', 'front', 0), unit('我后', 'back', 0)],
      },
    }))

    expect(html.indexOf('class="battle-side enemy-side"')).toBeLessThan(html.indexOf('class="battle-divider"'))
    expect(html.indexOf('class="battle-divider"')).toBeLessThan(html.indexOf('class="battle-side party-side"'))
    expect(html.indexOf('data-enemy-slot="back-0"')).toBeLessThan(html.indexOf('data-enemy-slot="front-0"'))
    expect(html.indexOf('data-formation-slot="front-0"')).toBeLessThan(html.indexOf('data-formation-slot="back-0"'))
    expect(html).toContain('前排 · 小怪')
  })

  it('战斗控制暴露稳定 data-action 并标记当前模式', () => {
    const html = renderIdlePage(fixtureViewModel())

    for (const action of ['set-mode-guard', 'set-mode-roam', 'stop-combat', 'speed-1', 'speed-2', 'speed-4']) {
      expect(html).toContain(`data-action="${action}"`)
    }
    expect(html).toMatch(/class="[^"]*active[^"]*"[^>]*data-action="set-mode-guard"/)
  })
})
