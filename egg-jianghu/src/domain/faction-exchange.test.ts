import { describe, expect, it } from 'vitest'
import { originalFactionExchangeByFaction } from '../content/original-faction-exchange.generated'
import { factionByOriginalId } from '../content/factions'
import { originalWorldReputationThreshold } from '../content/original-faction-rules.generated'
import { createInitialStateV10 } from './state'
import { exchangeFactionItem, factionExchangeItemOwned, factionExchangeItemQuantity } from './faction-exchange'

const unlockedFactionState = (factionSourceId = 2) => {
  const state = createInitialStateV10(0)
  const faction = factionByOriginalId(factionSourceId)
  if (!faction) throw new Error(`测试势力不存在：${factionSourceId}`)
  state.unlockedFactionIds.push(faction.id)
  return { state, faction }
}

describe('原版势力贡献兑换', () => {
  it('只允许已解锁的正式贡献势力兑换目录内商品', () => {
    const { state, faction } = unlockedFactionState()
    state.unlockedFactionIds = []
    expect(exchangeFactionItem(state, faction.id, 1)).toEqual({ ok: false, message: '势力尚未解锁' })
    expect(exchangeFactionItem(state, 'missing', 1)).toEqual({ ok: false, message: '势力不存在' })

    const militia = factionByOriginalId(1)
    expect(militia).toBeDefined()
    state.unlockedFactionIds.push(militia!.id)
    expect(exchangeFactionItem(state, militia!.id, 1)).toEqual({ ok: false, message: '此势力不使用贡献兑换' })

    state.unlockedFactionIds.push(faction.id)
    expect(exchangeFactionItem(state, faction.id, 999)).toEqual({ ok: false, message: '兑换商品不存在' })
  })

  it('先校验声望和贡献，再原子发放图纸并防止重复拥有', () => {
    const { state, faction } = unlockedFactionState()
    const item = originalFactionExchangeByFaction(2).find((candidate) => candidate.slot === 2)!
    state.contribution[faction.id] = item.price
    state.worldReputation[faction.worldId] = originalWorldReputationThreshold(2, 1) - 1

    expect(exchangeFactionItem(state, faction.id, item.slot)).toEqual({
      ok: false,
      message: '声望等级不足，需达到友好',
    })
    expect(state.contribution[faction.id]).toBe(item.price)
    expect(state.blueprints[item.target.kind === 'blueprint' ? item.target.stateKey : '']).toBeUndefined()

    state.worldReputation[faction.worldId] += 1
    state.contribution[faction.id] -= 1
    expect(exchangeFactionItem(state, faction.id, item.slot)).toEqual({ ok: false, message: '势力贡献不足' })
    expect(state.contribution[faction.id]).toBe(item.price - 1)
    expect(factionExchangeItemQuantity(state, item)).toBe(0)

    state.contribution[faction.id] += 1
    expect(exchangeFactionItem(state, faction.id, item.slot)).toEqual({
      ok: true,
      message: `兑换成功：${item.originalName}`,
    })
    expect(state.contribution[faction.id]).toBe(0)
    expect(factionExchangeItemQuantity(state, item)).toBe(1)
    expect(factionExchangeItemOwned(state, item)).toBe(true)

    state.contribution[faction.id] = item.price
    expect(exchangeFactionItem(state, faction.id, item.slot)).toEqual({ ok: false, message: '该图纸已经拥有' })
    expect(state.contribution[faction.id]).toBe(item.price)

    if (item.target.kind !== 'blueprint') throw new Error('测试商品不是图纸')
    state.blueprints[item.target.stateKey] = 0
    state.unlockedRecipeIds.push(item.target.recipeId)
    expect(factionExchangeItemOwned(state, item)).toBe(true)
  })

  it('转职书和秘境门票可以重复兑换并叠加', () => {
    const { state, faction } = unlockedFactionState()
    const items = originalFactionExchangeByFaction(2)
    const jobBook = items.find((item) => item.slot === 1)!
    const ticket = items.find((item) => item.slot === 12)!
    state.contribution[faction.id] = jobBook.price * 2 + ticket.price * 2
    state.worldReputation[faction.worldId] = originalWorldReputationThreshold(4, 1)

    expect(exchangeFactionItem(state, faction.id, jobBook.slot).ok).toBe(true)
    expect(exchangeFactionItem(state, faction.id, jobBook.slot).ok).toBe(true)
    expect(exchangeFactionItem(state, faction.id, ticket.slot).ok).toBe(true)
    expect(exchangeFactionItem(state, faction.id, ticket.slot).ok).toBe(true)
    expect(factionExchangeItemQuantity(state, jobBook)).toBe(2)
    expect(factionExchangeItemQuantity(state, ticket)).toBe(2)
    expect(state.contribution[faction.id]).toBe(0)
  })

  it('幻型兑换永久解锁且不可重复购买', () => {
    const { state, faction } = unlockedFactionState()
    const skin = originalFactionExchangeByFaction(2).find((item) => item.kind === 'skin')!
    state.contribution[faction.id] = skin.price * 2
    state.worldReputation[faction.worldId] = originalWorldReputationThreshold(5, 1)

    expect(exchangeFactionItem(state, faction.id, skin.slot).ok).toBe(true)
    expect(factionExchangeItemQuantity(state, skin)).toBe(1)
    expect(exchangeFactionItem(state, faction.id, skin.slot)).toEqual({ ok: false, message: '该幻型已经拥有' })
    expect(state.contribution[faction.id]).toBe(skin.price)
  })
})
