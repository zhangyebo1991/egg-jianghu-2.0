import { describe, expect, it } from 'vitest'
import {
  ORIGINAL_FACTION_EXCHANGE,
  ORIGINAL_FACTION_EXCHANGE_COUNTS,
  ORIGINAL_FACTION_EXCHANGE_PRICE_CONSTANTS,
  originalFactionExchangeByFaction,
} from './original-faction-exchange.generated'

describe('原版势力贡献兑换目录', () => {
  it('完整包含 29 个正式势力的 396 条商品', () => {
    expect(ORIGINAL_FACTION_EXCHANGE_COUNTS).toEqual({
      total: 396,
      factions: 29,
      jobBooks: 29,
      blueprints: 290,
      secretRealmTickets: 29,
      skins: 48,
    })
    expect(ORIGINAL_FACTION_EXCHANGE).toHaveLength(396)
    expect(new Set(ORIGINAL_FACTION_EXCHANGE.map((item) => item.factionSourceId)).size).toBe(29)

    for (const factionSourceId of new Set(ORIGINAL_FACTION_EXCHANGE.map((item) => item.factionSourceId))) {
      const items = originalFactionExchangeByFaction(factionSourceId)
      expect(items.filter((item) => item.kind === 'job-book')).toHaveLength(1)
      expect(items.filter((item) => item.kind === 'blueprint')).toHaveLength(10)
      expect(items.filter((item) => item.kind === 'secret-realm-ticket')).toHaveLength(1)
    }
  })

  it('逐条复算原版贡献价格公式', () => {
    const { contributionCurrencyRatio, qualityPriceIndex, worldPriceStep } = ORIGINAL_FACTION_EXCHANGE_PRICE_CONSTANTS

    for (const item of ORIGINAL_FACTION_EXCHANGE) {
      const expectedWorldMultiplier = 1 + worldPriceStep * (item.worldIndex - 1)
      const contributionCorrection = item.categoryCorrection
        * expectedWorldMultiplier
        / contributionCurrencyRatio
      const expectedPrice = Math.max(1, Math.round(
        (contributionCorrection * 10)
        * (10 + item.priceItemLevel)
        * qualityPriceIndex ** item.priceQuality,
      ))

      expect(item.worldPriceMultiplier).toBeCloseTo(expectedWorldMultiplier, 10)
      expect(item.price).toBe(expectedPrice)
      if (item.kind === 'skin') {
        expect([item.priceItemLevel, item.priceQuality]).toEqual([0, 0])
      } else {
        expect(item.priceItemLevel).toBe(Math.max((item.priceQuality - 1) * 25, 5))
      }
    }
  })

  it('保留魏国首组商品的原版名称、门槛与项目状态键', () => {
    const wei = originalFactionExchangeByFaction(2)
    const jobBook = wei.find((item) => item.slot === 1)
    const blueprint = wei.find((item) => item.slot === 2)
    const ticket = wei.find((item) => item.slot === 12)
    const skin = wei.find((item) => item.slot === 13)

    expect(jobBook).toMatchObject({
      kind: 'job-book',
      itemId: 3,
      specificId: 2,
      originalName: '护卫转职书',
      price: 4688,
      requiredReputationLevel: null,
      target: { kind: 'job', sourceId: 2, name: '护卫', stateKey: 'job_2' },
    })
    expect(blueprint).toMatchObject({
      kind: 'blueprint',
      itemId: 4,
      specificId: 5,
      originalName: '虎豹之头盔图纸',
      price: 21484,
      requiredReputationLevel: 2,
      target: {
        kind: 'blueprint',
        recipeId: 5,
        stateKey: '5',
        itemId: 410,
        itemName: '头盔',
        setId: 12,
        setName: '虎豹',
      },
    })
    expect(ticket).toMatchObject({
      kind: 'secret-realm-ticket',
      originalName: '秘境门票',
      price: 32959,
      requiredReputationLevel: 4,
      target: { kind: 'material', stateKey: '5' },
    })
    expect(skin).toMatchObject({
      kind: 'skin',
      specificId: 124,
      originalName: '甄宓 · 幻型 - 稀有',
      price: 500000,
      requiredReputationLevel: 5,
      target: {
        kind: 'skin',
        sourceId: 124,
        heroSourceId: 6,
        heroName: '甄宓',
        skinType: 3,
        skinTypeName: '稀有',
      },
    })
  })
})
