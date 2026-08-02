import { describe, expect, it } from 'vitest'
import { renderStageList, renderWorldOverview } from './jianghu-page'

describe('江湖层级页', () => {
  it('总览显示大关卡但不提前显示小关或战斗', () => {
    const html = renderWorldOverview({ worlds: [{
      id: 'world_01',
      name: '青石江湖',
      index: 1,
      unlocked: true,
      difficulty: 1,
      recommendedPower: 4000,
      clearedStages: 3,
      factionNames: ['青锋馆', '铁衣武馆', '仁心堂'],
    }] })

    expect(html).toContain('data-testid="world-world_01"')
    expect(html).toContain('data-action="enter-world"')
    expect(html).not.toContain('data-testid="stage-1"')
    expect(html).not.toContain('data-testid="idle-page"')
  })

  it('大关内显示十个小关且锁定关不可点击', () => {
    const html = renderStageList({
      worldId: 'world_01',
      worldName: '青石江湖',
      worldCurrency: 120,
      stages: Array.from({ length: 10 }, (_, index) => ({
        stage: index + 1,
        unlocked: index < 4,
        cleared: index < 3,
      })),
    })

    expect(html.match(/data-testid="stage-\d+"/g)).toHaveLength(10)
    expect(html).toContain('data-action="start-stage"')
    expect(html).toMatch(/data-testid="stage-5"[^>]*disabled/)
  })
})
