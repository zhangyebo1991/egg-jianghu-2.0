import { describe, expect, it } from 'vitest'
import { renderStageList, renderWorldOverview } from './jianghu-page'

describe('江湖层级页', () => {
  it('总览显示大关卡但不提前显示小关或战斗', () => {
    const html = renderWorldOverview({ worlds: [{
      id: 'world_01',
      name: '牛家村',
      index: 1,
      released: true,
      unlocked: true,
      difficulty: 1,
      recommendedPower: 4000,
      clearedStages: 3,
      factionNames: ['全真教', '丐帮', '桃花岛'],
    }] })

    expect(html).toContain('data-testid="world-world_01"')
    expect(html).toContain('data-action="enter-world"')
    expect(html).not.toContain('data-testid="stage-1"')
    expect(html).not.toContain('data-testid="idle-page"')
  })

  it('大关内显示十个小关且锁定关不可点击', () => {
    const html = renderStageList({
      worldId: 'world_01',
      worldName: '牛家村',
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

  it('未开放世界显示无法进入且不带难度进度势力', () => {
    const html = renderWorldOverview({ worlds: [{
      id: 'world_11', name: '恒山', index: 11,
      released: false, unlocked: false,
      difficulty: 0, recommendedPower: 0, clearedStages: 0, factionNames: [],
    }] })

    expect(html).toMatch(/data-testid="world-world_11"[^>]*disabled/)
    expect(html).toContain('未开放 · 无法进入')
    expect(html).not.toContain('world-progress')
    expect(html).not.toContain('推荐战力')
    expect(html).not.toContain('本地势力')
  })

  it('已开放未解锁世界提示通关上一卷', () => {
    const html = renderWorldOverview({ worlds: [{
      id: 'world_02', name: '嘉兴', index: 2,
      released: true, unlocked: false,
      difficulty: 1, recommendedPower: 6600, clearedStages: 0, factionNames: [],
    }] })

    expect(html).toContain('尚未解锁 · 通关上一卷开放')
    expect(html).not.toContain('推荐战力')
  })
})
