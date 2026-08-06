import { describe, expect, it } from 'vitest'
import { renderIdlePage, type IdlePageViewModel } from './idle-page'

const fixtureViewModel = (overrides: Partial<IdlePageViewModel> = {}): IdlePageViewModel => ({
  worldId: 'world_01',
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
  stats: { copper: 0, equipment: 0, kills: 0, elapsedMs: 0 },
  logs: [],
  effects: [],
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
          { id: 'boss', name: '首领', rank: 'boss', row: 'front', position: 0, hp: 100, maxHp: 100, energy: 20, maxEnergy: 100, gauge: 500, cooldownMs: 2300, alive: true, skillName: '首领绝技' },
        ],
      },
    }))

    expect(html).toContain('第 <em>10</em> / 10 波')
    expect(html.match(/data-formation-slot=/g)).toHaveLength(6)
    expect(html).toContain('气机')
    expect(html).toContain('真气')
    expect(html).toContain('回气')
    expect(html).toContain('class="stat-chip warn"')
    expect(html).toContain('class="pack-meter full"')
  })

  it('按敌上我下展示战场，且双方前排在中线两侧相邻', () => {
    const unit = (id: string, row: 'front' | 'back', position: 0 | 1 | 2) => ({
      id, name: id, rank: 'normal' as const, row, position, hp: 100, maxHp: 100,
      energy: 20, maxEnergy: 100, gauge: 0, cooldownMs: 0, alive: true, skillName: '蓄势待发',
    })
    const html = renderIdlePage(fixtureViewModel({
      combat: {
        mode: 'guard',
        wave: 1,
        enemies: [unit('敌后', 'back', 0), unit('敌前', 'front', 0)],
        party: [unit('我前', 'front', 0), unit('我后', 'back', 0)],
      },
    }))

    expect(html.indexOf('class="battle-half enemy"')).toBeLessThan(html.indexOf('class="battle-divider"'))
    expect(html.indexOf('class="battle-divider"')).toBeLessThan(html.indexOf('class="battle-half party"'))
    expect(html.indexOf('data-enemy-slot="back-0"')).toBeLessThan(html.indexOf('data-enemy-slot="front-0"'))
    expect(html.indexOf('data-formation-slot="front-0"')).toBeLessThan(html.indexOf('data-formation-slot="back-0"'))
    expect(html).toContain('data-rank="normal"')
    expect(html).toContain('<span class="unit-tag row-tag">前排</span>')
  })

  it('战斗控制暴露稳定 data-action 并标记当前模式', () => {
    const html = renderIdlePage(fixtureViewModel())

    for (const action of ['set-mode-guard', 'set-mode-roam', 'stop-combat', 'speed-1', 'speed-2', 'speed-4']) {
      expect(html).toContain(`data-action="${action}"`)
    }
    expect(html).toMatch(/class="[^"]*active[^"]*"[^>]*data-action="set-mode-guard"/)
  })

  it('渲染十波进度、本场收益和真实战斗特效锚点', () => {
    const html = renderIdlePage(fixtureViewModel({
      stats: { copper: 128, equipment: 2, kills: 4, elapsedMs: 65_000 },
      combat: {
        mode: 'roam',
        wave: 7,
        party: [{
          id: 'hero', name: '少侠', rank: 'normal', row: 'front', position: 0,
          hp: 25, maxHp: 100, energy: 100, maxEnergy: 100, gauge: 1000,
          cooldownMs: 1200, alive: true, skillName: '落英神剑',
        }],
        enemies: [],
      },
      effects: [
        { id: 1, kind: 'lunge-party', unitId: 'hero' },
        { id: 2, kind: 'critical', unitId: 'hero', text: '88' },
        { id: 3, kind: 'wave-banner', text: '第 7 波' },
      ],
    }))

    expect(html.match(/class="wave-bead(?: |")/g)).toHaveLength(10)
    expect(html).toContain('本场收益')
    expect(html).toContain('01:05')
    expect(html).toContain('lunge-party')
    expect(html).toContain('dmg-float crit')
    expect(html).toContain('第 7 波')
  })
})
