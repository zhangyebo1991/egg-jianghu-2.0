import { describe, expect, it } from 'vitest'
import {
  ORIGINAL_FACTION_RULES,
  originalFactionAgentContributionMultiplier,
  originalFactionAgentReputationMultiplier,
  originalFactionRecruitPrice,
  originalFactionSkillUpgradeCost,
  originalFactionTaskRefreshSeconds,
  originalFactionTaskRequiredAmount,
  originalFactionTaskReward,
  originalFactionTaskTargetName,
  originalFactionTaskTargetPool,
  originalFactionUnlocksAtProgress,
  originalFactionWorldPriceMultiplier,
  originalWorldReputationBase,
  originalWorldReputationLevel,
  originalWorldReputationThreshold,
} from './original-faction-rules.generated'

describe('原版势力规则契约', () => {
  it('复算位面声望等级、阈值与代理人倍率', () => {
    expect(originalWorldReputationBase(1)).toBe(200)
    expect(originalWorldReputationBase(13)).toBe(440)
    expect(originalWorldReputationLevel(0, 1)).toBe(1)
    expect(originalWorldReputationLevel(199, 1)).toBe(1)
    expect(originalWorldReputationLevel(200, 1)).toBe(2)
    expect(originalWorldReputationLevel(799, 1)).toBe(2)
    expect(originalWorldReputationLevel(800, 1)).toBe(3)
    expect(originalWorldReputationLevel(1_000_000, 1)).toBe(5)
    expect(originalWorldReputationThreshold(1, 13)).toBe(0)
    expect(originalWorldReputationThreshold(2, 13)).toBe(440)
    expect(originalWorldReputationThreshold(5, 13)).toBe(7040)
    expect(originalWorldReputationThreshold(99, 13)).toBe(7040)

    expect(originalFactionAgentContributionMultiplier(0)).toBe(1)
    expect(originalFactionAgentContributionMultiplier(10)).toBe(1.5)
    expect(originalFactionAgentReputationMultiplier(0)).toBe(1)
    expect(originalFactionAgentReputationMultiplier(10)).toBe(1.2)
  })

  it('保留原版五格悬榜、品质权重和任务 6 禁用状态', () => {
    expect(ORIGINAL_FACTION_RULES.stateLayout.taskBoard).toMatchObject({
      slotCount: 5,
      slotRowStart: 11,
      slotRowEnd: 15,
      completedRecordId: -1,
    })
    expect(ORIGINAL_FACTION_RULES.tasks.qualityWeights).toEqual([
      { value: 1, weight: 24 },
      { value: 2, weight: 24 },
      { value: 3, weight: 20 },
      { value: 4, weight: 18 },
      { value: 5, weight: 6 },
      { value: 6, weight: 3 },
    ])
    expect(ORIGINAL_FACTION_RULES.tasks.qualityWeights.reduce((sum, entry) => sum + entry.weight, 0)).toBe(95)
    expect(ORIGINAL_FACTION_RULES.tasks.typeWeights).toEqual([
      {
        qualityMin: 1,
        qualityMax: 1,
        weights: [{ value: 1, weight: 1 }, { value: 2, weight: 1 }, { value: 3, weight: 1 }],
      },
      {
        qualityMin: 2,
        qualityMax: 3,
        weights: [
          { value: 1, weight: 1 },
          { value: 2, weight: 1 },
          { value: 3, weight: 1 },
          { value: 4, weight: 1 },
        ],
      },
      {
        qualityMin: 4,
        qualityMax: 6,
        weights: [
          { value: 1, weight: 1 },
          { value: 2, weight: 1 },
          { value: 3, weight: 1 },
          { value: 4, weight: 2 },
          { value: 5, weight: 2 },
        ],
      },
    ])
    expect(ORIGINAL_FACTION_RULES.tasks.definitions).toHaveLength(6)
    expect(ORIGINAL_FACTION_RULES.tasks.definitions.find((task) => task.id === 6)).toMatchObject({
      name: '捕捉目标灵兽',
      enabledInRandomPool: false,
    })
    expect(ORIGINAL_FACTION_RULES.tasks.reservedTaskIds).toEqual([6])
  })

  it('复算五类已启用任务的需求量与奖励', () => {
    expect(originalFactionTaskRequiredAmount(1, 1, 1)).toBe(5)
    expect(originalFactionTaskRequiredAmount(1, 6, 1)).toBe(160)
    expect(originalFactionTaskRequiredAmount(2, 1, 1)).toBe(10_000)
    expect(originalFactionTaskRequiredAmount(2, 6, 13)).toBe(3_390_000)
    expect(originalFactionTaskRequiredAmount(3, 1, 1)).toBe(8)
    expect(originalFactionTaskRequiredAmount(3, 6, 1)).toBe(16)
    expect(originalFactionTaskRequiredAmount(4, 1, 1)).toBe(1)
    expect(originalFactionTaskRequiredAmount(4, 6, 1)).toBe(16)
    expect(originalFactionTaskRequiredAmount(5, 6, 1)).toBe(1)
    expect(originalFactionTaskRequiredAmount(6, 6, 1)).toBeNull()

    expect(originalFactionTaskReward(1, 1, 1)).toEqual({
      currency: 0,
      contribution: 450,
      reputation: 4,
    })
    expect(originalFactionTaskReward(5, 6, 2, 0.25, 0.5)).toEqual({
      currency: 0,
      contribution: 64_800,
      reputation: 54,
    })
  })

  it('保留五类任务的原版目标池与首领回退规则', () => {
    expect(ORIGINAL_FACTION_RULES.tasks.targetPools).toHaveLength(13)
    expect(ORIGINAL_FACTION_RULES.tasks.targetPools.every((world) => world.normalEnemies.length === 10)).toBe(true)
    expect(ORIGINAL_FACTION_RULES.tasks.targetPools.every((world) => world.bossEnemies.length === 10)).toBe(true)

    expect(originalFactionTaskTargetPool(1, 1, 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(originalFactionTaskTargetPool(1, 2, 1)).toEqual([2])
    expect(originalFactionTaskTargetPool(1, 3, 1)).toEqual([11, 20, 29])
    expect(originalFactionTaskTargetPool(1, 3, 6)).toEqual([13, 22, 31])
    expect(originalFactionTaskTargetPool(1, 4, 1, [18, 13])).toEqual([13, 18])
    expect(originalFactionTaskTargetPool(1, 4, 1)).toEqual([11])
    expect(originalFactionTaskTargetPool(1, 5, 6)).toEqual([6])
    expect(originalFactionTaskTargetPool(1, 5, 99)).toEqual([9])
    expect(originalFactionTaskTargetPool(1, 6, 1)).toEqual([])

    expect(originalFactionTaskTargetName(1, 1, 1)).toBe('黄巾战士')
    expect(originalFactionTaskTargetName(1, 2, 2)).toBe('铜钱')
    expect(originalFactionTaskTargetName(1, 3, 11)).toBe('初晶矿石')
    expect(originalFactionTaskTargetName(1, 4, 11)).toBe('张角')
    expect(originalFactionTaskTargetName(1, 5, 6)).toBe('品质 6 装备')
  })

  it('复算刷新、解锁、招募与技能价格边界', () => {
    expect(originalFactionTaskRefreshSeconds(3600, 0)).toBe(3600)
    expect(originalFactionTaskRefreshSeconds(3600, 5)).toBe(3100)
    expect(originalFactionTaskRefreshSeconds(3600, 100)).toBe(100)
    expect(originalFactionUnlocksAtProgress(9, 10)).toBe(false)
    expect(originalFactionUnlocksAtProgress(10, 10)).toBe(true)

    expect(originalFactionWorldPriceMultiplier(2)).toBe(1.8)
    expect(originalFactionRecruitPrice(9999, 2, '货币')).toBe(17_998)
    expect(originalFactionRecruitPrice(10_000, 2, '货币')).toBe(20_000)
    expect(originalFactionRecruitPrice(2_000_000, 2, '贡献')).toBe(180_000)
    expect(originalFactionSkillUpgradeCost(1, 1, '贡献')).toBe(69)
    expect(originalFactionSkillUpgradeCost(1, 1, '货币')).toBe(1069)
  })
})
