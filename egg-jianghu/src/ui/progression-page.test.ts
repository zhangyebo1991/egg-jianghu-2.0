import { describe, expect, it } from 'vitest'
import { renderProgressionPage, type ProgressionPageViewModel } from './progression-page'

const baseView = (): ProgressionPageViewModel => ({
  section: 'dungeons',
  resources: { worldTreeLeaves: 2, creationOrigin: 30, brokenDivinity: 10, starSoul: 20 },
  dungeons: [{
    id: 1,
    name: '火烧赤壁',
    worldName: '东汉三国',
    clears: 3,
    difficulty: 1,
    stageNames: ['博望坡', '借东风', '连环船', '华容道'],
    rewards: [{ name: '祝融灵珠', kind: '装备', quality: 7, probability: '1.03%' }],
  }],
  beasts: [{
    id: 1,
    name: '昊天青龙',
    worldName: '东汉三国',
    highestClearedStage: 0,
    nextStage: {
      stage: 1,
      equipmentName: '太平要术',
      battleDifficulty: 1100,
      reincarnationCleared: false,
      cleared: false,
      claimed: false,
    },
  }],
  recipes: [],
  divine: {
    unlocked: true,
    infiniteTowerFloor: 301,
    divineLadderFloor: 2,
    divineRankLevel: 2,
    shrines: [{
      shrineId: 131,
      deityId: 1,
      shrineName: '轮回神殿',
      bossName: '阎摩',
      skillName: '还春术',
      imperialWeaponName: '寂灭终章',
      unlockDivineLevel: 2,
      phaseLabel: '突袭',
      progress: -1,
      subdued: false,
      deityLevel: null,
      upgradeCost: null,
    }],
  },
  forge: {
    selectedUid: null,
    equipment: [],
    imperialTargets: [{ shrineId: 131, shrineName: '轮回神殿', weaponName: '寂灭终章', unlocked: false }],
  },
  interworld: [{
    enemyId: 410,
    name: '阎摩',
    rank: '首领',
    enabled: true,
    drops: [{ name: '破碎神格', probability: '0.20%' }],
  }],
})

describe('秘境与神界页面', () => {
  it('展示大型副本原版四阶段、逐项概率和结算入口', () => {
    const html = renderProgressionPage(baseView())

    expect(html).toContain('data-testid="progression-page"')
    expect(html).toContain('火烧赤壁')
    expect(html).toContain('博望坡 → 借东风 → 连环船 → 华容道')
    expect(html).toContain('祝融灵珠')
    expect(html).toContain('1.03%')
    expect(html).toContain('data-action="progression-complete-dungeon"')
    expect(html).not.toMatch(/wp_|original_skill_/)
  })

  it('圣兽分别展示位面轮回门槛和自身战斗难度', () => {
    const view = baseView()
    view.section = 'beasts'
    const html = renderProgressionPage(view)

    expect(html).toContain('圣兽战斗难度 1100')
    expect(html).toContain('东汉三国 · 轮回难度未通关')
    expect(html).not.toContain('当前可用难度 10')
  })

  it('神殿 Boss 的内部 -1 状态只显示刷新结算操作', () => {
    const view = baseView()
    view.section = 'divine'
    const html = renderProgressionPage(view)

    expect(html).toContain('轮回神殿')
    expect(html).toContain('还春术')
    expect(html).toContain('寂灭终章')
    expect(html).toContain('data-action="progression-settle-shrine"')
    expect(html).not.toContain('> -1 <')
  })

  it('五个高阶子页都提供明确导航且异界逐项展示候选概率', () => {
    const view = baseView()
    view.section = 'interworld'
    const html = renderProgressionPage(view)

    expect(html.match(/data-action="progression-section"/g)).toHaveLength(5)
    expect(html).toContain('48 ENEMIES · 7 INDEPENDENT ROLLS')
    expect(html).toContain('破碎神格')
    expect(html).toContain('0.20%')
    expect(html).toContain('data-action="progression-roll-interworld"')
  })
})
