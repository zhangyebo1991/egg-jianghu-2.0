import { describe, expect, it } from 'vitest'
import { recruitFromTavern } from '../domain/recruitment'
import { SAVE_KEY_V10, saveGameV10, type StorageLike } from '../domain/save-v10'
import { createNewGameStateV10 } from '../domain/state'
import { GameSession } from './game-session'

const memoryStorage = (): StorageLike & { values: Map<string, string> } => {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
    values,
  }
}

const sessionWithParty = (storage = memoryStorage()): GameSession => {
  const session = GameSession.create(storage, 1000)
  recruitFromTavern(session.state, 'hero_mu_nianci')
  session.state.formation = [{ heroId: 'hero_mu_nianci', row: 'front', position: 0 }]
  session.save(1000)
  return session
}

const makePartyOverwhelming = (session: GameSession): void => {
  const party = session.combat!.state.party
  for (const hero of party) {
    hero.hp = hero.maxHp = 50_000
    hero.externalAttack = hero.internalAttack = 50_000
    hero.externalDefense = hero.internalDefense = 5000
    hero.effectiveAgility = 10_000
    hero.accuracy = 1
  }
}

describe('GameSession', () => {
  it('新建游戏立即保存玩家角色和默认阵型', () => {
    const storage = memoryStorage()

    const session = GameSession.createNew(storage, '燕七', 1000)
    const saved = JSON.parse(storage.getItem(SAVE_KEY_V10)!)

    expect(session.state.heroes.hero_player?.customName).toBe('燕七')
    expect(saved.heroes.hero_player.customName).toBe('燕七')
    expect(saved.formation).toEqual([{ heroId: 'hero_player', row: 'front', position: 0 }])
  })

  it('继续旧的有效空角色存档时不补玩家角色', () => {
    const storage = memoryStorage()
    saveGameV10(storage, {
      ...createNewGameStateV10('燕七', 1000),
      heroes: {},
      formation: [],
    }, 1000)

    const session = GameSession.continue(storage, 2000)

    expect(session.state.heroes.hero_player).toBeUndefined()
    expect(session.state.formation).toEqual([])
  })

  it('没有存档时拒绝继续游戏', () => {
    expect(() => GameSession.continue(memoryStorage(), 1000)).toThrowError('没有可继续的存档')
  })

  it('坏 JSON 存档时拒绝继续游戏', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY_V10, '{坏 JSON')

    expect(() => GameSession.continue(storage, 1000)).toThrowError('存档无法读取')
  })

  it('空字符串存档时拒绝继续游戏', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY_V10, '')

    expect(() => GameSession.continue(storage, 1000)).toThrowError('存档无法读取')
  })

  it('继续游戏只读取一次存档并使用同一次读取到的有效内容', () => {
    const source = memoryStorage()
    saveGameV10(source, createNewGameStateV10('燕七', 1000), 1000)
    const serialized = source.getItem(SAVE_KEY_V10)!
    let getItemCalls = 0
    const storage: StorageLike = {
      getItem: () => {
        getItemCalls += 1
        return getItemCalls === 1 ? serialized : null
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    }

    const session = GameSession.continue(storage, 2000)

    expect(getItemCalls).toBe(1)
    expect(session.state.heroes.hero_player?.customName).toBe('燕七')
  })

  it('新建游戏保存失败时抛出且不返回 session', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('写入失败') },
      removeItem: () => undefined,
    }

    expect(() => GameSession.createNew(storage, '燕七', 1000)).toThrowError('写入失败')
  })

  it('两个会话继续同一存档后拒绝较旧会话覆盖较新进度', () => {
    const storage = memoryStorage()
    GameSession.createNew(storage, '燕七', 1000)
    const sessionA = GameSession.continue(storage, 2000)
    const sessionB = GameSession.continue(storage, 2000)

    sessionA.state.worldCurrency.world_01 = 1234
    sessionA.save(3000)
    const savedByA = storage.getItem(SAVE_KEY_V10)
    sessionB.state.worldCurrency.world_01 = 5678

    expect(() => sessionB.save(4000)).toThrowError('存档已在其他窗口发生变化')
    expect(storage.getItem(SAVE_KEY_V10)).toBe(savedByA)
  })

  it('外部删除存档后旧会话保存不能复活存档', () => {
    const storage = memoryStorage()
    GameSession.createNew(storage, '燕七', 1000)
    const staleSession = GameSession.continue(storage, 2000)
    storage.removeItem(SAVE_KEY_V10)

    expect(() => staleSession.save(3000)).toThrowError('存档已在其他窗口发生变化')
    expect(storage.getItem(SAVE_KEY_V10)).toBeNull()
  })

  it('新建游戏时已验证的存档快照发生变化则拒绝覆盖', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY_V10, 'newer-save')

    expect(() => GameSession.createNew(storage, '燕七', 1000, 'older-save')).toThrowError('存档已在其他窗口发生变化')
    expect(storage.getItem(SAVE_KEY_V10)).toBe('newer-save')
  })

  it('继续游戏时读取异常不会伪装成空新档', () => {
    const storage: StorageLike = {
      getItem: () => { throw new Error('读取失败') },
      setItem: () => undefined,
      removeItem: () => undefined,
    }

    expect(() => GameSession.continue(storage, 1000)).toThrowError('读取失败')
  })

  it('新建玩家角色在战斗中显示自定义姓名', () => {
    const storage = memoryStorage()
    saveGameV10(storage, createNewGameStateV10('燕七', 1000), 1000)
    const session = GameSession.create(storage, 1000)

    expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 1 }).ok).toBe(true)
    expect(session.combat?.state.party[0]?.name).toBe('燕七')
  })

  it('保存长期收益但不保存进行中的战斗', () => {
    const storage = memoryStorage()
    const session = sessionWithParty(storage)
    expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 11 }).ok).toBe(true)
    makePartyOverwhelming(session)

    session.advanceTicks(5000)
    const earned = structuredClone(session.state.worldCurrency)
    const reopened = GameSession.create(storage, 2000)

    expect(reopened.combat).toBeNull()
    expect(reopened.state.worldCurrency).toEqual(earned)
    expect(JSON.parse(storage.getItem(SAVE_KEY_V10)!).combat).toBeUndefined()
  })

  it('闯荡失败自动切驻守并重新创建回退关卡', () => {
    const session = sessionWithParty()
    session.state.clearedStageByWorld.world_01 = 3
    expect(session.startStage({ worldId: 'world_01', stage: 4, mode: 'roam', seed: 9 }).ok).toBe(true)
    for (const hero of session.combat!.state.party) {
      hero.hp = hero.maxHp = 1
      hero.gauge = 0
    }
    for (const enemy of session.combat!.state.enemies) {
      enemy.gauge = 1000
      enemy.externalAttack = 100_000
      enemy.accuracy = 1
    }

    session.advanceTicks(1)

    expect(session.selection).toEqual({ worldId: 'world_01', stage: 3, mode: 'guard' })
    expect(session.combat?.state.wave).toBe(1)
    expect(session.combat?.state.result).toBe('fighting')
  })

  it('闯荡通关第十关时解锁下一卷并从第一关继续', () => {
    const session = sessionWithParty()
    session.state.clearedStageByWorld.world_01 = 9
    expect(session.startStage({ worldId: 'world_01', stage: 10, mode: 'roam', seed: 22 }).ok).toBe(true)
    makePartyOverwhelming(session)

    session.advanceTicks(5000)

    expect(session.state.unlockedWorldIds).toContain('world_02')
    expect(session.selection).toEqual({ worldId: 'world_02', stage: 1, mode: 'roam' })
    expect(session.combat?.state.wave).toBe(1)
  })

  it('空阵容和未解锁关卡不能启动战斗', () => {
    const session = GameSession.create(memoryStorage(), 1000)

    expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 1 }).ok).toBe(false)
    expect(session.startStage({ worldId: 'world_02', stage: 1, mode: 'guard', seed: 1 }).ok).toBe(false)
    expect(session.combat).toBeNull()
  })

  it('即时切换模式但不重建或重置当前战斗', () => {
    const session = sessionWithParty()
    expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 17 }).ok).toBe(true)
    session.advanceTicks(3)
    const engine = session.combat
    const before = structuredClone(session.combat!.state)

    expect(session.setCombatMode('roam')).toEqual({ ok: true, message: '已切换为闯荡' })

    expect(session.combat).toBe(engine)
    expect(session.selection).toEqual({ worldId: 'world_01', stage: 1, mode: 'roam' })
    expect(session.combat!.state).toEqual({ ...before, mode: 'roam' })
  })

  it('没有进行中战斗时拒绝切换模式', () => {
    const session = sessionWithParty()

    expect(session.setCombatMode('roam')).toEqual({ ok: false, message: '当前没有进行中的战斗' })
    expect(session.combat).toBeNull()
  })

  it('拒绝绕过界面进入尚未解锁的小关', () => {
    const session = sessionWithParty()

    expect(session.startStage({ worldId: 'world_01', stage: 2, mode: 'guard', seed: 1 }))
      .toEqual({ ok: false, message: '小关尚未解锁' })
    expect(session.combat).toBeNull()
  })

  it('通关世界十不会解锁未开放的世界十一', () => {
    const session = sessionWithParty()
    session.state.unlockedWorldIds.push('world_10')
    session.state.clearedStageByWorld.world_10 = 9
    expect(session.startStage({ worldId: 'world_10', stage: 10, mode: 'roam', seed: 22 }).ok).toBe(true)
    makePartyOverwhelming(session)
    session.advanceTicks(5000)
    expect(session.selection).toEqual({ worldId: 'world_10', stage: 10, mode: 'guard' })
    expect(session.state.unlockedWorldIds).not.toContain('world_11')
  })

  it('未开放世界即使被写入解锁也不可进入', () => {
    const session = sessionWithParty()
    session.state.unlockedWorldIds.push('world_11')
    expect(session.startStage({ worldId: 'world_11', stage: 1, mode: 'guard', seed: 1 }).ok).toBe(false)
  })
})
