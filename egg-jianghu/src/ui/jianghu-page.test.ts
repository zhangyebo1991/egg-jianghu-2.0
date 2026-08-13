import { describe, expect, it } from 'vitest'
import { renderStageList, renderWorldOverview } from './jianghu-page'

const overviewFixture = () => ({
  planes: [
    { id: 'world_01', name: '东汉三国', index: 1, unlocked: true, selected: true },
    { id: 'world_02', name: '武侠江湖', index: 2, unlocked: false, selected: false },
  ],
  selected: {
    id: 'world_01',
    name: '东汉三国',
    index: 1,
    unlocked: true,
    flavor: '烽火燃天地，英雄乱世争。三国风云起。',
    latinName: 'Eastern Han',
    recommendedPower: 4000,
    selectedDifficulty: 1,
    canTravel: true,
    lockText: '开始穿越',
    difficulties: Array.from({ length: 10 }, (_, offset) => ({
      difficulty: offset + 1,
      label: offset === 0 ? '基础' : `难度${offset + 1}`,
      unlocked: offset === 0,
      selected: offset === 0,
      cleared: offset === 0 ? 3 : 0,
    })),
  },
})

describe('江湖位面页', () => {
  it('总览显示当前位面的十个难度且不提前显示小关或战斗', () => {
    const html = renderWorldOverview(overviewFixture())

    expect(html).toContain('data-testid="world-world_01"')
    expect(html).toContain('data-action="select-plane"')
    expect(html).toContain('data-action="start-crossing"')
    expect(html).toContain('data-testid="difficulty-1"')
    expect(html).toContain('东汉三国')
    expect(html).not.toContain('data-testid="stage-1"')
    expect(html).not.toContain('data-testid="idle-page"')
  })

  it('大关内显示十个小关且锁定关不可点击', () => {
    const html = renderStageList({
      worldId: 'world_01',
      worldName: '东汉三国',
      worldCurrency: 120,
      difficulty: 1,
      stages: Array.from({ length: 10 }, (_, index) => ({
        stage: index + 1,
        unlocked: index < 4,
        cleared: index < 3,
      })),
    })

    expect(html.match(/data-testid="stage-\d+"/g)).toHaveLength(10)
    expect(html).toContain('data-action="start-stage"')
    expect(html).toContain('黄巾起义')
    expect(html).toMatch(/data-testid="stage-5"[^>]*disabled/)
  })

  it('未解锁位面仍可浏览但开始穿越不可用', () => {
    const html = renderWorldOverview({
      planes: [{ id: 'world_02', name: '武侠江湖', index: 2, unlocked: false, selected: true }],
      selected: {
        id: 'world_02',
        name: '武侠江湖',
        index: 2,
        unlocked: false,
        flavor: '江湖侠客影，仗剑走天涯。恩怨随风去。',
        latinName: 'Wuxia Jianghu',
        recommendedPower: 5400,
        selectedDifficulty: 1,
        canTravel: false,
        lockText: '通关 东汉三国 基础难度后开启',
        difficulties: Array.from({ length: 10 }, (_, offset) => ({
          difficulty: offset + 1,
          label: offset === 0 ? '基础' : `难度${offset + 1}`,
          unlocked: false,
          selected: offset === 0,
          cleared: 0,
        })),
      },
    })

    expect(html).toContain('通关 东汉三国 基础难度后开启')
    expect(html).toMatch(/data-testid="start-crossing"[^>]*disabled/)
    expect(html).toMatch(/data-testid="difficulty-1"[^>]*disabled/)
  })
})
