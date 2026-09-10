import { describe, expect, it } from 'vitest'
import { equipMartial } from '../domain/martial-training'
import { recruitFromTavern } from '../domain/recruitment'
import { SAVE_KEY_V10, saveGameV10, type StorageLike } from '../domain/save-v10'
import { createNewGameStateV10 } from '../domain/state'
import { buildCombatParty, GameSession } from './game-session'
import { selectLowestHealthPrimary } from '../combat/targeting'
import { panelToAttributeMap } from '../combat/stats'

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
  session.state.formation = [{ heroId: 'hero_mu_nianci', row: 1, col: 0 }]
  session.save(1000)
  return session
}

const makePartyOverwhelming = (session: GameSession): void => {
  const party = session.combat!.state.party
  for (const hero of party) {
    hero.hp = hero.maxHp = 1_000_000_000_000
    hero.externalAttack = hero.internalAttack = 1_000_000_000_000
    hero.externalDefense = hero.internalDefense = 1_000_000_000_000
    hero.effectiveAgility = 10_000
    hero.accuracy = 1
    hero.careerCoefficients = {
      physicalAttack: 1,
      physicalDefense: 1,
      magicAttack: 1,
      magicDefense: 1,
      heal: 1,
    }
    hero.attributes = panelToAttributeMap({
      ...hero,
      initialEnergy: hero.energy,
      energyRecovery: 0,
      cooldownRate: 0,
      lifeSteal: 0,
    })
  }
}

describe('GameSession', () => {
  it('主角在后排仍按原版角色编号创建，治疗同值不被前排自创角色抢先', () => {
    const state = createNewGameStateV10('燕七', 1000)
    recruitFromTavern(state, 'hero_mu_nianci')
    state.formation = [
      { heroId: 'hero_mu_nianci', row: 0, col: 0 },
      { heroId: 'hero_player', row: 2, col: 4 },
    ]
    const party = buildCombatParty(state)
    expect(party).toHaveLength(2)
    expect(selectLowestHealthPrimary(party)?.id).toBe('hero_player')
  })
  it.each(['create', 'continue'] as const)('%s 载入旧档时补齐基础难度已达到的势力且可以保存', (entry) => {
    const storage = memoryStorage()
    const state = createNewGameStateV10('燕七', 1000)
    state.clearedStageByWorldDifficulty['world_01:1'] = 3
    saveGameV10(storage, state, 1000)
    const session = GameSession[entry](storage, 2000)
    expect(session.state.unlockedFactionIds).toEqual(['qingfeng_hall', 'tieyi_school'])
    session.save(2000)
    expect(GameSession.continue(storage, 3000).state.unlockedFactionIds)
      .toEqual(['qingfeng_hall', 'tieyi_school'])
  })

  it('新建游戏立即保存玩家角色和默认阵型', () => {
    const storage = memoryStorage()

    const session = GameSession.createNew(storage, '燕七', 1000)
    const saved = JSON.parse(storage.getItem(SAVE_KEY_V10)!)

    expect(session.state.heroes.hero_player?.customName).toBe('燕七')
    expect(saved.heroes.hero_player.customName).toBe('燕七')
    expect(saved.formation).toEqual([{ heroId: 'hero_player', row: 1, col: 0 }])
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

  it('战斗快照携带当前主手的原版 wp[7] 武器类型', () => {
    const session = GameSession.createNew(memoryStorage(), '燕七', 1000)
    session.state.inventory.push({
      uid: 'weapon_1',
      definitionId: 'wp_101',
      level: 1,
      quality: 0,
      coreStats: [],
      affixes: [],
      locked: false,
    })
    session.state.heroes.hero_player.equipmentBySlot.weapon = 'weapon_1'

    expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 1 }).ok).toBe(true)
    expect(session.combat?.state.party[0]?.mainhandWeaponType).toBe(1)
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

  it('实时补帧跨越战斗胜利后继续挂机', () => {
    const session = sessionWithParty()
    expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 11 }).ok).toBe(true)
    makePartyOverwhelming(session)

    // 首战强化仅修改战斗快照；聚焦跨胜利边界，避免重开后普通队伍的强弱干扰此测试。
    for (let tick = 0; tick < 5_000 && session.combat?.state.result === 'fighting'; tick += 1) {
      session.advanceRealtimeTicks(1)
    }
    expect(session.combat?.state.result).toBe('victory')
    session.advanceRealtimeTicks(40)

    expect(session.state.clearedStageByWorldDifficulty['world_01:1']).toBeGreaterThanOrEqual(1)
    expect(session.selection).toEqual({ worldId: 'world_01', difficulty: 1, stage: 1, mode: 'guard' })
    expect(session.combat?.state.result).toBe('fighting')
    expect(session.combat?.state.elapsedMs).toBeGreaterThan(0)
  })

  it('驻守胜利保留结算 3.3 秒后才重新挑战当前关卡', () => {
    const session = sessionWithParty()
    expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 31 }).ok).toBe(true)
    const completedCombat = session.combat
    completedCombat!.state.result = 'victory'

    session.advanceCombatTime(0)
    expect(session.combat).toBe(completedCombat)
    expect(session.pendingCombatRestart).toMatchObject({
      outcome: 'victory',
      selection: { worldId: 'world_01', difficulty: 1, stage: 1, mode: 'guard' },
      elapsedMs: 0,
      durationMs: 3300,
    })
    session.advanceCombatTime(3299)
    expect(session.combat).toBe(completedCombat)

    session.advanceCombatTime(1)
    expect(session.pendingCombatRestart).toBeNull()
    expect(session.combat).not.toBe(completedCombat)
    expect(session.combat?.state).toMatchObject({ result: 'fighting', elapsedMs: 0 })
  })

  it('闯荡胜利在 Engine 的 0.8 秒结束过渡后立即创建下一关', () => {
    const session = sessionWithParty()
    expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'roam', seed: 37 }).ok).toBe(true)
    const completedCombat = session.combat
    completedCombat!.state.result = 'victory'

    session.advanceCombatTime(0)

    expect(session.pendingCombatRestart).toBeNull()
    expect(session.combat).not.toBe(completedCombat)
    expect(session.selection).toEqual({ worldId: 'world_01', difficulty: 1, stage: 2, mode: 'roam' })
    expect(session.combat?.state.timeline).toMatchObject({
      phase: 'wave-transition',
      waveTransition: { kind: 'initial' },
    })
  })

  it('失败结算保留 3.3 秒后按失败规则重开', () => {
    const session = sessionWithParty()
    session.state.clearedStageByWorldDifficulty['world_01:1'] = 3
    expect(session.startStage({ worldId: 'world_01', stage: 4, mode: 'roam', seed: 41 }).ok).toBe(true)
    const completedCombat = session.combat
    completedCombat!.state.result = 'defeat'

    session.advanceCombatTime(0)
    expect(session.combat).toBe(completedCombat)
    expect(session.pendingCombatRestart).toMatchObject({
      outcome: 'defeat',
      selection: { worldId: 'world_01', difficulty: 1, stage: 3, mode: 'guard' },
      elapsedMs: 0,
      durationMs: 3300,
    })
    session.advanceCombatTime(3300)
    expect(session.pendingCombatRestart).toBeNull()
    expect(session.combat).not.toBe(completedCombat)
    expect(session.selection).toEqual({ worldId: 'world_01', difficulty: 1, stage: 3, mode: 'guard' })
  })

  it('跨结算的大步长与 100ms 小步长推进得到同一战斗快照', () => {
    const createCompletedSession = () => {
      const session = sessionWithParty()
      expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 43 }).ok).toBe(true)
      session.combat!.state.result = 'victory'
      return session
    }
    const largeStep = createCompletedSession()
    const smallSteps = createCompletedSession()

    largeStep.advanceCombatTime(5000)
    for (let index = 0; index < 50; index += 1) smallSteps.advanceCombatTime(100)

    expect(largeStep.selection).toEqual(smallSteps.selection)
    expect(largeStep.pendingCombatRestart).toEqual(smallSteps.pendingCombatRestart)
    expect(largeStep.combat?.state).toEqual(smallSteps.combat?.state)
  })

  it('两分钟挂机用单次补算或 100ms 逐步推进时收益与战斗现场一致', () => {
    const createRunningSession = () => {
      const session = sessionWithParty()
      expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 47 }).ok).toBe(true)
      makePartyOverwhelming(session)
      return session
    }
    const largeStep = createRunningSession()
    const smallSteps = createRunningSession()

    largeStep.advanceCombatTime(120_000)
    for (let index = 0; index < 1200; index += 1) smallSteps.advanceCombatTime(100)

    expect(largeStep.state.worldCurrency).toEqual(smallSteps.state.worldCurrency)
    expect(largeStep.state.clearedStageByWorldDifficulty).toEqual(smallSteps.state.clearedStageByWorldDifficulty)
    expect(largeStep.selection).toEqual(smallSteps.selection)
    expect(largeStep.pendingCombatRestart).toEqual(smallSteps.pendingCombatRestart)
    const largeCombat = structuredClone(largeStep.combat?.state)
    const smallCombat = structuredClone(smallSteps.combat?.state)
    // 连续dt积分的浮点加法顺序可能有末位误差；只容许行动条数值误差，其余状态仍精确比较。
    if (largeCombat && smallCombat) for (const side of ['party', 'enemies', 'summons'] as const) {
      expect(largeCombat[side]).toHaveLength(smallCombat[side].length)
      largeCombat[side].forEach((unit, index) => {
        expect(unit.gauge).toBeCloseTo(smallCombat[side][index].gauge, 10)
        unit.gauge = smallCombat[side][index].gauge
      })
    }
    expect(largeCombat).toEqual(smallCombat)
    expect(largeStep.state.inventory).toEqual(smallSteps.state.inventory)
  })

  it('闯荡失败自动切驻守并重新创建回退关卡', () => {
    const session = sessionWithParty()
    session.state.clearedStageByWorldDifficulty['world_01:1'] = 3
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

    // 原版调度下敌人依次完成行动链，不再在同一满条节点集体瞬时结算。
    session.advanceTicks(100)

    expect(session.selection).toEqual({ worldId: 'world_01', difficulty: 1, stage: 3, mode: 'guard' })
    expect(session.combat?.state.wave).toBe(1)
    expect(session.combat?.state.result).toBe('fighting')
  })

  it('闯荡通关第十关时解锁下一位面但停在本难度', () => {
    const session = sessionWithParty()
    session.state.clearedStageByWorldDifficulty['world_01:1'] = 9
    expect(session.startStage({ worldId: 'world_01', stage: 10, mode: 'roam', seed: 22 }).ok).toBe(true)
    makePartyOverwhelming(session)

    session.advanceTicks(5000)

    expect(session.state.unlockedWorldIds).toContain('world_02')
    expect(session.selection).toEqual({ worldId: 'world_01', difficulty: 1, stage: 10, mode: 'guard' })
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
    expect(session.selection).toEqual({ worldId: 'world_01', difficulty: 1, stage: 1, mode: 'roam' })
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

  it('闯荡打完最后一面基础第十关后停在本难度', () => {
    const session = sessionWithParty()
    session.state.unlockedWorldIds.push('world_13')
    session.state.clearedStageByWorldDifficulty['world_13:1'] = 9
    expect(session.startStage({ worldId: 'world_13', difficulty: 1, stage: 10, mode: 'roam', seed: 22 }).ok).toBe(true)
    makePartyOverwhelming(session)
    session.advanceTicks(5000)
    expect(session.selection).toEqual({ worldId: 'world_13', difficulty: 1, stage: 10, mode: 'guard' })
    expect(session.state.unlockedWorldIds).not.toContain('world_14')
  })

  it('未解锁位面与未知位面不能进入', () => {
    const session = sessionWithParty()
    expect(session.startStage({ worldId: 'world_02', stage: 1, mode: 'guard', seed: 1 }).ok).toBe(false)
    session.state.unlockedWorldIds.push('world_99')
    expect(session.startStage({ worldId: 'world_99', stage: 1, mode: 'guard', seed: 1 }).ok).toBe(false)
  })

  it('未通关基础难度不能进入难度2', () => {
    const session = sessionWithParty()
    expect(session.startStage({ worldId: 'world_01', difficulty: 2, stage: 1, mode: 'guard', seed: 1 }))
      .toEqual({ ok: false, message: '难度尚未解锁' })
  })
})


describe('复活刷新永久属性', () => {
  it('战斗中升级后召唤重读永久生命，但不刷新主人本场战斗属性', () => {
    const session = GameSession.createNew(memoryStorage(), '召唤测试', 1000)
    session.state.formation = [{ heroId: 'hero_player', row: 0, col: 0 }]
    expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 19 }).ok).toBe(true)
    const engine = session.combat!
    engine.advance(1500)
    const actor = engine.state.party[0]
    const originalHp = actor.maxHp
    const progress = session.state.heroes.hero_player
    progress.careers[progress.currentCareerId].level = 10
    const current = buildCombatParty(session.state)[0]
    actor.skillIds = [72]
    actor.energy = 5
    actor.gauge = 1000
    engine.state.enemies.forEach(enemy => { enemy.gauge = 0 })
    engine.advance(100)
    const summon = engine.state.summons[0]
    expect(summon.maxHp).toBe(Math.round(current.maxHp * 1.3))
    expect(summon.attributes[6]).toBeCloseTo(originalHp * 1.3, 8)
    expect(actor.maxHp).toBe(originalHp)
    expect(current.maxHp).toBeGreaterThan(originalHp)
  })

  it('战斗中升级并装配武学后，复活按当前面板恢复并携带新技能', () => {
    const session = GameSession.createNew(memoryStorage(), '复活测试', 1000)
    recruitFromTavern(session.state, 'hero_mu_nianci')
    session.state.formation = [
      { heroId: 'hero_player', row: 0, col: 0 },
      { heroId: 'hero_mu_nianci', row: 1, col: 0 },
    ]
    expect(session.startStage({ worldId: 'world_01', stage: 1, mode: 'guard', seed: 19 }).ok).toBe(true)
    const engine = session.combat!
    engine.advance(1500)
    const fallen = engine.state.party.find(unit => unit.id === 'hero_player')!
    const healer = engine.state.party.find(unit => unit.id === 'hero_mu_nianci')!
    const previousAttack = fallen.externalAttack
    fallen.alive = false
    fallen.hp = 0
    healer.gauge = 1000
    healer.energy = 5
    healer.skillIds = [64]
    engine.state.enemies.forEach(enemy => { enemy.gauge = 0 })
    const progress = session.state.heroes.hero_player
    progress.level = 10
    progress.learnedMartials.original_skill_42 = { level: 10, investedSp: 0, invested: { worldCurrency: {}, contribution: {} } }
    expect(equipMartial(session.state, 'hero_player', 'original_skill_42', 0).ok).toBe(true)
    const current = buildCombatParty(session.state).find(unit => unit.id === fallen.id)!
    expect(fallen.externalAttack).toBe(previousAttack)
    const events = engine.advance(400)
    expect(events).toContainEqual(expect.objectContaining({ type: 'unit-revived', targetId: fallen.id }))
    expect(fallen.hp).toBe(Math.round(current.maxHp * 0.2))
    expect(fallen.externalAttack).toBe(current.externalAttack)
    expect(fallen.externalAttack).toBeGreaterThan(previousAttack)
    expect(fallen.skillIds).toEqual(current.skillIds)
    expect(fallen.skillLevels?.[42]).toBe(10)
    expect(fallen.attributes).toEqual(current.attributes)
  })
})
