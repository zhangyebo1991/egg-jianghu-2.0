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
    enemyVisible: true,
    party: [],
    enemies: [],
    settlement: null,
    timeline: { phase: 'accumulating', activeActorId: null, readyQueue: [] },
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

  it('战斗页显示波次、三路五列、气机、能量、回气与满仓警告', () => {
    const html = renderIdlePage(fixtureViewModel({
      inventoryCount: 300,
      combat: {
        mode: 'guard',
        wave: 10,
        party: [],
        enemies: [
          { id: 'boss', name: '首领', rank: 'boss', row: 1, col: 1, hp: 100, maxHp: 100, energy: 2, maxEnergy: 5, gauge: 500, cooldownMs: 2300, alive: true, skillName: '首领绝技' },
        ],
        timeline: { phase: 'accumulating', activeActorId: null, readyQueue: [] },
      },
    }))

    expect(html).toContain('第 <em>10</em> / 10 波')
    expect(html.match(/data-formation-slot=/g)).toHaveLength(15)
    expect(html.match(/data-enemy-slot=/g)).toHaveLength(15)
    expect(html).toContain('气机')
    expect(html).toContain('能量')
    expect(html).toContain('回气')
    expect(html).toContain('class="stat-chip warn"')
    expect(html).toContain('class="pack-meter full"')
  })

  it('仅为我方存活角色显示五格墨玉能量并标记满能量', () => {
    const unit = (id: string, energy: number, alive = true) => ({
      id, name: id, rank: 'normal' as const, row: 1 as const, col: 0 as const,
      hp: alive ? 100 : 0, maxHp: 100, energy, maxEnergy: 5, gauge: 0,
      cooldownMs: 0, alive, skillName: '蓄势待发',
    })
    const html = renderIdlePage(fixtureViewModel({
      combat: {
        mode: 'guard',
        wave: 1,
        party: [unit('party-partial', 3), { ...unit('party-full', 5), col: 1 }, { ...unit('party-fallen', 4, false), col: 2 }],
        enemies: [unit('enemy', 4)],
        timeline: { phase: 'accumulating', activeActorId: null, readyQueue: [] },
      },
    }))
    const energyMarkup = (id: string): string => html.match(
      new RegExp(`<span class="unit-energy-orbs[^"]*"[^>]*data-testid="unit-energy-${id}"[\\s\\S]*?</span>`),
    )?.[0] ?? ''
    const partial = energyMarkup('party-partial')
    const full = energyMarkup('party-full')

    expect(partial.match(/class="energy-orb(?: charged)?"/g)).toHaveLength(5)
    expect(partial.match(/energy-orb charged/g)).toHaveLength(3)
    expect(partial).toContain('aria-valuenow="3"')
    expect(full).toContain('class="unit-energy-orbs full"')
    expect(full.match(/energy-orb charged/g)).toHaveLength(5)
    expect(html).not.toContain('data-testid="unit-energy-enemy"')
    expect(html).not.toContain('data-testid="unit-energy-party-fallen"')
    expect(html).not.toContain('energy-meter')
  })

  it('按我左敌右展示战场，双方最前列贴中线镜像对峙', () => {
    const unit = (id: string, row: 0 | 1 | 2, col: 0 | 1 | 2 | 3 | 4) => ({
      id, name: id, rank: 'normal' as const, row, col, hp: 100, maxHp: 100,
      energy: 2, maxEnergy: 5, gauge: 0, cooldownMs: 0, alive: true, skillName: '蓄势待发',
    })
    const html = renderIdlePage(fixtureViewModel({
      combat: {
        mode: 'guard',
        wave: 1,
        enemies: [unit('敌后', 1, 4), unit('敌前', 1, 0)],
        party: [unit('我前', 1, 0), unit('我后', 1, 4)],
        timeline: { phase: 'accumulating', activeActorId: null, readyQueue: [] },
      },
    }))

    expect(html.indexOf('class="battle-half party"')).toBeLessThan(html.indexOf('class="battle-divider"'))
    expect(html.indexOf('class="battle-divider"')).toBeLessThan(html.indexOf('class="battle-half enemy"'))
    // 我方一行从左到右是 col 4→0（最前列贴中线），敌方镜像 col 0→4
    expect(html.indexOf('data-formation-slot="1-4"')).toBeLessThan(html.indexOf('data-formation-slot="1-0"'))
    expect(html.indexOf('data-enemy-slot="1-0"')).toBeLessThan(html.indexOf('data-enemy-slot="1-4"'))
    expect(html).toContain('data-rank="normal"')
    expect(html).toContain('<span class="unit-tag row-tag">中路</span>')
    expect(html.match(/data-combat-lane="party-\d"/g)).toHaveLength(3)
    expect(html.match(/data-combat-lane="enemy-\d"/g)).toHaveLength(3)
  })

  it('战斗控制暴露稳定 data-action 并标记当前模式', () => {
    const html = renderIdlePage(fixtureViewModel())

    for (const action of ['set-mode-guard', 'set-mode-roam', 'stop-combat', 'speed-1', 'speed-1.8', 'speed-2.6', 'speed-3.6']) {
      expect(html).toContain(`data-action="${action}"`)
    }
    expect(html).toMatch(/class="[^"]*active[^"]*"[^>]*data-action="set-mode-guard"/)
  })

  it('底部共用行动条按确定性队列显示行动者与待出手顺序', () => {
    const unit = (id: string, gauge: number) => ({
      id, name: id, rank: 'normal' as const, row: 1 as const, col: 0 as const,
      hp: 100, maxHp: 100, energy: 2, maxEnergy: 5, gauge,
      cooldownMs: 0, alive: true, skillName: '蓄势待发',
    })
    const html = renderIdlePage(fixtureViewModel({
      combat: {
        mode: 'guard',
        wave: 1,
        party: [unit('hero', 1000)],
        enemies: [unit('enemy', 1000)],
        timeline: {
          phase: 'acting',
          activeActorId: 'enemy',
          readyQueue: [{ actorId: 'hero', readySeq: 7 }],
        },
      },
    }))

    expect(html).toContain('data-testid="combat-action-timeline"')
    expect(html).not.toContain('gauge-meter')
    expect(html).toMatch(/class="action-marker party ready"[^>]*data-action-unit="hero"[^>]*data-ready-seq="7"/)
    expect(html).toMatch(/class="action-marker enemy active"[^>]*data-action-unit="enemy"/)
    expect(html).toContain('<small>行动锁定</small>')
  })

  it('我方阵亡只保留原版死亡形象，敌方阵亡释放阵位', () => {
    const dead = (id: string) => ({
      id, name: id, rank: 'normal' as const, row: 1 as const, col: 0 as const,
      hp: 0, maxHp: 100, energy: 0, maxEnergy: 5, gauge: 0,
      cooldownMs: 0, alive: false, skillName: '蓄势待发',
    })
    const html = renderIdlePage(fixtureViewModel({
      combat: {
        mode: 'guard',
        wave: 1,
        party: [dead('fallen-hero')],
        enemies: [dead('fallen-enemy')],
        timeline: { phase: 'accumulating', activeActorId: null, readyQueue: [] },
      },
    }))

    expect(html).toContain('data-testid="party-death-image-fallen-hero"')
    expect(html).not.toContain('data-testid="combat-unit-fallen-enemy"')
    expect(html).not.toContain('data-testid="party-death-image-fallen-enemy"')
    expect(html.match(/unit-cell-empty/g)?.length).toBeGreaterThanOrEqual(29)
  })

  it('我方复活后恢复正常单位形象并移除死亡形象', () => {
    const html = renderIdlePage(fixtureViewModel({
      combat: {
        mode: 'guard',
        wave: 1,
        party: [{
          id: 'revived-hero', name: '复起侠客', rank: 'normal', row: 1, col: 0,
          hp: 20, maxHp: 100, energy: 0, maxEnergy: 5, gauge: 0,
          cooldownMs: 0, alive: true, skillName: '蓄势待发',
        }],
        enemies: [],
        timeline: { phase: 'accumulating', activeActorId: null, readyQueue: [] },
      },
    }))

    expect(html).toContain('data-testid="combat-unit-revived-hero"')
    expect(html).not.toContain('party-death-image-revived-hero')
    expect(html).toContain('class="unit-body"')
  })

  it('首波刷新前隐藏已预创建的敌人，刷新后才显示敌阵', () => {
    const enemy = {
      id: 'hidden-enemy', name: '伏兵', rank: 'normal' as const, row: 1 as const, col: 0 as const,
      hp: 100, maxHp: 100, energy: 0, maxEnergy: 5, gauge: 0,
      cooldownMs: 0, alive: true, skillName: '伺机出手',
    }
    const hidden = renderIdlePage(fixtureViewModel({
      combat: {
        mode: 'guard', wave: 1, enemyVisible: false, party: [], enemies: [enemy], settlement: null,
        timeline: { phase: 'wave-transition', activeActorId: null, readyQueue: [] },
      },
    }))
    const visible = renderIdlePage(fixtureViewModel({
      combat: {
        mode: 'guard', wave: 1, enemyVisible: true, party: [], enemies: [enemy], settlement: null,
        timeline: { phase: 'wave-transition', activeActorId: null, readyQueue: [] },
      },
    }))

    expect(hidden).not.toContain('data-testid="combat-unit-hidden-enemy"')
    expect(hidden).toContain('data-testid="enemy-arrival"')
    expect(visible).toContain('data-testid="combat-unit-hidden-enemy"')
    expect(visible).not.toContain('data-testid="enemy-arrival"')
  })

  it('结算覆盖层显示胜败与原版自动重开倒计时', () => {
    const victory = renderIdlePage(fixtureViewModel({
      combat: {
        mode: 'guard', wave: 10, enemyVisible: true, party: [], enemies: [],
        settlement: { outcome: 'victory', countdownSeconds: 3, closing: false },
        timeline: { phase: 'ending', activeActorId: null, readyQueue: [] },
      },
    }))
    const defeat = renderIdlePage(fixtureViewModel({
      combat: {
        mode: 'guard', wave: 4, enemyVisible: true, party: [], enemies: [],
        settlement: { outcome: 'defeat', countdownSeconds: 0, closing: true },
        timeline: { phase: 'ending', activeActorId: null, readyQueue: [] },
      },
    }))

    expect(victory).toContain('data-testid="combat-settlement"')
    expect(victory).toContain('破阵告捷')
    expect(victory).toContain('3 秒后自动重新挑战')
    expect(defeat).toContain('败退重整')
    expect(defeat).toContain('重整战场中')
  })

  it('渲染十波进度、本场收益和真实战斗特效锚点', () => {
    const html = renderIdlePage(fixtureViewModel({
      stats: { copper: 128, equipment: 2, kills: 4, elapsedMs: 65_000 },
      combat: {
        mode: 'roam',
        wave: 7,
        party: [{
          id: 'hero', name: '少侠', rank: 'normal', row: 1, col: 0,
          hp: 25, maxHp: 100, energy: 5, maxEnergy: 5, gauge: 1000,
          cooldownMs: 1200, alive: true, skillName: '落英神剑',
        }],
        enemies: [],
        timeline: { phase: 'accumulating', activeActorId: null, readyQueue: [] },
      },
      effects: [
        { id: 1, kind: 'lunge-party', unitId: 'hero', durationMs: 200, elapsedMs: 50 },
        { id: 2, kind: 'critical', unitId: 'hero', text: '88', durationMs: 1500, elapsedMs: 100 },
        { id: 3, kind: 'wave-banner', text: '第 7 波', durationMs: 1800, elapsedMs: 300 },
      ],
    }))

    expect(html.match(/class="wave-bead(?: |")/g)).toHaveLength(10)
    expect(html).toContain('本场收益')
    expect(html).toContain('01:05')
    expect(html).toContain('lunge-party')
    expect(html).toContain('dmg-float crit')
    expect(html).toContain('--combat-effect-duration:1500ms;--combat-effect-delay:-100ms')
    expect(html).toContain('第 7 波')
  })
})
