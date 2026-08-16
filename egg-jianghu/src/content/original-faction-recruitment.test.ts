import { describe, expect, it } from 'vitest'
import { FACTIONS } from './factions'
import {
  ORIGINAL_FACTION_RECRUITMENT,
  ORIGINAL_FACTION_RECRUITMENT_COUNTS,
  originalFactionRecruitmentByFaction,
} from './original-faction-recruitment.generated'
import { originalFactionRecruitPrice } from './original-faction-rules.generated'

describe('原版势力招募目录', () => {
  it('覆盖 42 个势力与 131 名角色', () => {
    expect(ORIGINAL_FACTION_RECRUITMENT).toHaveLength(131)
    expect(ORIGINAL_FACTION_RECRUITMENT_COUNTS).toEqual({
      total: 131,
      factions: 42,
      byReputationLevel: { 1: 27, 2: 26, 3: 26, 4: 26, 5: 26 },
    })

    const factionSourceIds = new Set(ORIGINAL_FACTION_RECRUITMENT.map((entry) => entry.factionSourceId))
    expect(factionSourceIds).toEqual(new Set(FACTIONS.map((faction) => faction.originalId)))
    for (const faction of FACTIONS) {
      expect(originalFactionRecruitmentByFaction(faction.originalId).length).toBeGreaterThan(0)
    }
  })

  it('保留原版声望、价格与特殊条件', () => {
    expect(ORIGINAL_FACTION_RECRUITMENT.every((entry) => entry.specialRequirement === 0)).toBe(true)
    expect(ORIGINAL_FACTION_RECRUITMENT.every((entry) => (
      entry.price === originalFactionRecruitPrice(entry.basePrice, entry.worldIndex, entry.resourceKind)
    ))).toBe(true)

    expect(ORIGINAL_FACTION_RECRUITMENT.find((entry) => entry.name === '甄宓')).toMatchObject({
      heroSourceId: 6,
      factionName: '魏国',
      requiredReputationLevel: 2,
      requiredReputationName: '友好',
      basePrice: 400_000,
      price: 20_000,
      resourceKind: '贡献',
    })
    expect(ORIGINAL_FACTION_RECRUITMENT.find((entry) => entry.name === '关羽')).toMatchObject({
      factionName: '蜀国',
      requiredReputationLevel: 5,
      requiredReputationName: '信仰',
      basePrice: 3_200_000,
      price: 160_000,
    })
  })
})
