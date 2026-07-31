import { describe, expect, it } from 'vitest'
import { BONDS, COMBOS, HEROES, MARTIALS, MYSTERY_BLESSINGS, MYSTERY_ENCOUNTERS, REGIONS } from './data'
import {
  BACK_ATTACK_MULTIPLIER,
  abandonMystery,
  chooseMysteryBlessing,
  FRONT_ATTACK_MULTIPLIER,
  FRONT_DAMAGE_TAKEN_MULTIPLIER,
  createInitialState,
  equipMartial,
  finishMystery,
  forgetMartial,
  getActiveBonds,
  getActiveCombos,
  getFormationSummary,
  getHeroStats,
  getMysteryChoices,
  getPartySynergy,
  isRegionUnlocked,
  moveMartial,
  recruitHero,
  returnToIdle,
  selectRegion,
  setFormationRow,
  setPartySlot,
  startChallenge,
  startIdleStage,
  startMystery,
  stepCombat,
  unequipMartial,
} from './game'

describe('蛋蛋江湖 MVP 核心循环', () => {
  it('按 MVP 规格提供九名侠客、五门武学与三人初始队伍', () => {
    const state = createInitialState(1_000)
    expect(HEROES).toHaveLength(9)
    expect(MARTIALS).toHaveLength(5)
    expect(REGIONS).toHaveLength(3)
    expect(BONDS).toHaveLength(5)
    expect(COMBOS).toHaveLength(4)
    expect(MYSTERY_BLESSINGS).toHaveLength(6)
    expect(MYSTERY_ENCOUNTERS).toHaveLength(5)
    expect(state.formation).toHaveLength(3)
    expect(state.formation.map((slot) => slot.row)).toEqual(['front', 'front', 'back'])
    expect(state.formation.every((slot) => state.heroes[slot.heroId].unlocked)).toBe(true)
    expect(state.combat.status).toBe('ready')
  })

  it('选择小关卡后挂机战斗会自动击败敌人并产出银两与阅历', () => {
    const state = createInitialState()
    const beforeSilver = state.resources.silver
    const beforeExperience = state.resources.experience
    expect(startIdleStage(state, 'bluestone_path', 3)).toEqual({ ok: true, message: '已开始青石古道第 3 关挂机战斗' })
    expect(state.combat.stage).toBe(3)
    for (let index = 0; index < 20; index += 1) stepCombat(state)
    expect(state.statistics.idleEnemiesDefeated).toBeGreaterThan(0)
    expect(state.resources.silver).toBeGreaterThan(beforeSilver)
    expect(state.resources.experience).toBeGreaterThan(beforeExperience)
    expect(state.combat.logs.some((event) => event.kind === 'reward')).toBe(true)
  })

  it('停止挂机会保留既得收益且不会结算当前敌人', () => {
    const state = createInitialState()
    expect(startIdleStage(state, 'bluestone_path', 2).ok).toBe(true)
    for (let index = 0; index < 100 && state.statistics.idleEnemiesDefeated === 0; index += 1) stepCombat(state)

    const resourcesAfterVictory = { ...state.resources }
    const defeatsAfterVictory = state.statistics.idleEnemiesDefeated
    expect(defeatsAfterVictory).toBe(1)
    expect(returnToIdle(state)).toEqual({ ok: true, message: '已停止战斗并返回关卡选择' })
    expect(state.combat.status).toBe('ready')
    expect(state.combat.stage).toBeNull()

    for (let index = 0; index < 100; index += 1) stepCombat(state)
    expect(state.resources).toEqual(resourcesAfterVictory)
    expect(state.statistics.idleEnemiesDefeated).toBe(defeatsAfterVictory)
  })

  it('未点击小关卡时不会战斗，并拒绝未解锁或不存在的关卡', () => {
    const state = createInitialState()
    const beforeResources = { ...state.resources }
    for (let index = 0; index < 100; index += 1) stepCombat(state)

    expect(state.resources).toEqual(beforeResources)
    expect(state.statistics.idleEnemiesDefeated).toBe(0)
    expect(startIdleStage(state, 'blackwind_fort', 1)).toEqual({ ok: false, message: '尚未击败前一区域 BOSS' })
    expect(startIdleStage(state, 'bluestone_path', 11)).toEqual({ ok: false, message: '小关卡不存在' })
  })

  it('调整同门阵容会激活门派羁绊', () => {
    const state = createInitialState()
    state.resources.silver = 1_000
    expect(recruitHero(state, 'yan_qiusheng').ok).toBe(true)
    expect(setPartySlot(state, 1, 'yan_qiusheng').ok).toBe(true)
    const synergy = getPartySynergy(state)
    expect(synergy.sectName).toBe('丐帮')
    expect(synergy.sectCount).toBe(2)
    expect(synergy.attackMultiplier).toBe(1.12)
  })

  it('可在磐石阵与雁行阵之间换位，但前后排都必须保留侠客', () => {
    const state = createInitialState()
    expect(getFormationSummary(state).name).toBe('磐石阵')

    expect(setFormationRow(state, 0, 'back')).toEqual({ ok: true, message: expect.stringContaining('后排') })
    expect(state.formation.map((slot) => slot.row)).toEqual(['back', 'front', 'back'])
    expect(getFormationSummary(state).name).toBe('雁行阵')
    expect(setFormationRow(state, 1, 'back')).toEqual({ ok: false, message: '前后排都至少需要一位侠客' })
  })

  it('前排优先承受反击，前排减伤且后排提高伤害', () => {
    const frontState = createInitialState()
    expect(startChallenge(frontState).ok).toBe(true)
    stepCombat(frontState)
    const frontAttack = frontState.combat.logs.at(-1)

    const backState = createInitialState()
    expect(setFormationRow(backState, 0, 'back').ok).toBe(true)
    expect(startChallenge(backState).ok).toBe(true)
    stepCombat(backState)
    const backAttack = backState.combat.logs.at(-1)

    expect(frontAttack?.kind).toBe('skill')
    expect(backAttack?.kind).toBe('skill')
    expect(backAttack?.amount).toBeGreaterThan(frontAttack?.amount ?? 0)
    expect((backAttack?.amount ?? 0) / (frontAttack?.amount ?? 1)).toBeCloseTo(BACK_ATTACK_MULTIPLIER / FRONT_ATTACK_MULTIPLIER, 1)

    stepCombat(frontState)
    stepCombat(frontState)
    const enemyEvent = frontState.combat.logs.at(-1)
    expect(enemyEvent?.kind).toBe('enemy')
    expect(frontState.combat.partyMembers.find((member) => member.heroId === enemyEvent?.targetId)?.row).toBe('front')
    expect(frontState.combat.partyMembers.find((member) => member.row === 'back')?.hp)
      .toBe(frontState.combat.partyMembers.find((member) => member.row === 'back')?.maxHp)
  })

  it('同一侠客在前排承受的伤害按规则降低 20%', () => {
    const frontState = createInitialState()
    const heroId = frontState.formation[0].heroId
    expect(startChallenge(frontState).ok).toBe(true)
    frontState.combat.enemyTraitId = 'none'
    for (const member of frontState.combat.partyMembers) {
      if (member.heroId !== heroId) member.hp = 0
    }
    const rawDamage = frontState.combat.enemyAttack - getHeroStats(frontState, heroId).defense * 0.45
    stepCombat(frontState)
    const frontDamage = frontState.combat.logs.at(-1)?.amount

    const backState = createInitialState()
    expect(setFormationRow(backState, 0, 'back').ok).toBe(true)
    expect(startChallenge(backState).ok).toBe(true)
    backState.combat.enemyTraitId = 'none'
    for (const member of backState.combat.partyMembers) {
      if (member.heroId !== heroId) member.hp = 0
    }
    stepCombat(backState)
    const backDamage = backState.combat.logs.at(-1)?.amount

    expect(frontDamage).toBe(Math.max(5, Math.round(rawDamage * FRONT_DAMAGE_TAKEN_MULTIPLIER)))
    expect(backDamage).toBe(Math.max(5, Math.round(rawDamage)))
    expect(frontDamage).toBeLessThan(backDamage ?? 0)
  })

  it('挑战交锋期间不可调整前后排', () => {
    const state = createInitialState()
    expect(startChallenge(state).ok).toBe(true)
    expect(setFormationRow(state, 0, 'back')).toEqual({ ok: false, message: expect.stringContaining('挑战中不可换位') })
  })

  it('陆青山与江晚同队时按轮次施展山河照影', () => {
    const state = createInitialState()
    state.resources.silver = 1_000
    expect(recruitHero(state, 'jiang_wan').ok).toBe(true)
    expect(setPartySlot(state, 1, 'jiang_wan').ok).toBe(true)
    expect(getPartySynergy(state).activeComboIds).toContain('mountain_river_reflection')
    expect(startChallenge(state).ok).toBe(true)
    for (let index = 0; index < 45 && state.combat.status === 'fighting'; index += 1) stepCombat(state)
    expect(state.combat.logs.some((event) => event.kind === 'combo' && event.text.includes(COMBOS[0].name))).toBe(true)
  })

  it('关系羁绊会按当前阵容激活并汇总不同被动效果', () => {
    const state = createInitialState()
    state.resources.silver = 5_000
    expect(recruitHero(state, 'yan_qiusheng').ok).toBe(true)
    expect(setPartySlot(state, 1, 'yan_qiusheng').ok).toBe(true)

    expect(getActiveBonds(state).map((bond) => bond.id)).toContain('green_hill_iron_oath')
    expect(getPartySynergy(state).damageTakenMultiplier).toBeCloseTo(0.9)

    expect(recruitHero(state, 'qi_rumo').ok).toBe(true)
    expect(setPartySlot(state, 2, 'qi_rumo').ok).toBe(true)
    const synergy = getPartySynergy(state)
    expect(synergy.activeBondIds).toEqual(expect.arrayContaining(['green_hill_iron_oath', 'drunken_road_companions']))
    expect(synergy.attackMultiplier).toBeGreaterThan(1.25)
  })

  it('青山铁衣会实际降低敌方反击伤害', () => {
    const prepare = (withBond: boolean) => {
      const state = createInitialState()
      state.resources.silver = 1_000
      if (withBond) {
        expect(recruitHero(state, 'yan_qiusheng').ok).toBe(true)
        expect(setPartySlot(state, 1, 'yan_qiusheng').ok).toBe(true)
      }
      expect(startChallenge(state).ok).toBe(true)
      for (const member of state.combat.partyMembers) {
        member.maxHp = 9_999
        member.hp = member.heroId === 'lu_qingshan' ? 9_999 : 0
      }
      stepCombat(state)
      return state.combat.logs.findLast((event) => event.kind === 'enemy')?.amount ?? 0
    }

    expect(prepare(true)).toBeLessThan(prepare(false))
  })

  it('归一传薪会缩短武学冷却，寒江和鸣会在合击时回复全队', () => {
    const hasteState = createInitialState()
    hasteState.resources.silver = 5_000
    expect(recruitHero(hasteState, 'zhou_xuanyi').ok).toBe(true)
    expect(setPartySlot(hasteState, 1, 'zhou_xuanyi').ok).toBe(true)
    expect(getPartySynergy(hasteState).skillCooldownReduction).toBe(1)
    expect(startChallenge(hasteState).ok).toBe(true)
    for (let index = 0; index < 3; index += 1) stepCombat(hasteState)
    expect(hasteState.combat.partyMembers.find((member) => member.heroId === 'gu_changfeng')?.skillCooldown).toBe(2)

    const restoreState = createInitialState()
    restoreState.resources.silver = 5_000
    expect(recruitHero(restoreState, 'ning_suyin').ok).toBe(true)
    expect(setPartySlot(restoreState, 0, 'shen_zhaoxue').ok).toBe(true)
    expect(setPartySlot(restoreState, 1, 'ning_suyin').ok).toBe(true)
    expect(getActiveCombos(restoreState).map((combo) => combo.id)).toEqual(['cold_river_harmony'])
    expect(startChallenge(restoreState).ok).toBe(true)
    for (const member of restoreState.combat.partyMembers) {
      member.maxHp = 9_999
      member.hp = 8_000
    }
    restoreState.combat.enemyHp = 100_000
    restoreState.combat.enemyMaxHp = 100_000
    for (let index = 0; index < 15; index += 1) stepCombat(restoreState)
    expect(restoreState.combat.logs.some((event) => event.kind === 'combo' && event.abilityId === 'cold_river_harmony' && event.text.includes('回复'))).toBe(true)
  })

  it('同时激活多式合击时会按顺序轮换施展', () => {
    const state = createInitialState()
    state.resources.silver = 5_000
    expect(recruitHero(state, 'jiang_wan').ok).toBe(true)
    expect(recruitHero(state, 'bai_weishuang').ok).toBe(true)
    expect(setPartySlot(state, 1, 'jiang_wan').ok).toBe(true)
    expect(setPartySlot(state, 2, 'bai_weishuang').ok).toBe(true)
    expect(getActiveCombos(state).map((combo) => combo.id)).toEqual([
      'mountain_river_reflection',
      'twin_blades_resonance',
    ])
    expect(startChallenge(state).ok).toBe(true)
    state.combat.enemyHp = 100_000
    state.combat.enemyMaxHp = 100_000
    state.combat.enemyAttack = 0
    for (const member of state.combat.partyMembers) {
      member.hp = 9_999
      member.maxHp = 9_999
    }
    for (let index = 0; index < 30; index += 1) stepCombat(state)

    const comboIds = state.combat.logs.filter((event) => event.kind === 'combo').map((event) => event.abilityId)
    expect(comboIds).toEqual(expect.arrayContaining(['mountain_river_reflection', 'twin_blades_resonance']))
  })

  it('只允许装备已学武功并按最小空槽放入，且同一武功不可重复', () => {
    const state = createInitialState()
    const heroId = state.formation[0].heroId
    state.heroes[heroId].learnedMartials.frost_sword = {
      rank: 1,
      invested: { silver: 0, experience: 0, pages: 0, reputation: 0 },
    }
    expect(equipMartial(state, heroId, 'frost_sword').ok).toBe(true)
    expect(state.heroes[heroId].equippedMartialIds[1]).toBe('frost_sword')
    expect(equipMartial(state, heroId, 'frost_sword').ok).toBe(false)
    expect(equipMartial(state, heroId, 'vajra_staff').ok).toBe(false)

    for (const martialId of ['taiji_breath', 'vajra_staff', 'earth_origin']) {
      state.heroes[heroId].learnedMartials[martialId] = {
        rank: 1,
        invested: { silver: 0, experience: 0, pages: 0, reputation: 0 },
      }
    }
    expect(equipMartial(state, heroId, 'taiji_breath').ok).toBe(true)
    expect(equipMartial(state, heroId, 'vajra_staff').ok).toBe(true)
    expect(equipMartial(state, heroId, 'earth_origin').ok).toBe(false)
  })

  it('可与相邻空槽交换并卸下指定槽位', () => {
    const state = createInitialState()
    const heroId = state.formation[0].heroId
    expect(moveMartial(state, heroId, 0, 1).ok).toBe(true)
    expect(state.heroes[heroId].equippedMartialIds).toEqual([null, expect.any(String), null, null])
    expect(unequipMartial(state, heroId, 1).ok).toBe(true)
    expect(state.heroes[heroId].equippedMartialIds).toEqual([null, null, null, null])
  })

  it('全部已学被动影响属性，卸下不失效，遗忘后失效并退款 80%', () => {
    const state = createInitialState()
    const heroId = state.formation[0].heroId
    const before = getHeroStats(state, heroId)
    state.heroes[heroId].learnedMartials.vajra_staff = {
      rank: 2,
      invested: { silver: 101, experience: 9, pages: 11, reputation: 1 },
    }
    state.heroes[heroId].learnedMartials.frost_sword = {
      rank: 1,
      invested: { silver: 0, experience: 0, pages: 0, reputation: 0 },
    }
    expect(equipMartial(state, heroId, 'vajra_staff').ok).toBe(true)
    expect(equipMartial(state, heroId, 'frost_sword').ok).toBe(true)
    const learned = getHeroStats(state, heroId)
    expect(learned.attack).toBeGreaterThan(before.attack)
    expect(unequipMartial(state, heroId, 1).ok).toBe(true)
    expect(getHeroStats(state, heroId).attack).toBe(learned.attack)
    expect(equipMartial(state, heroId, 'vajra_staff').ok).toBe(true)
    expect(forgetMartial(state, heroId, 'vajra_staff').ok).toBe(true)
    expect(state.resources).toEqual({ silver: 260, experience: 97, pages: 23, reputation: 0 })
    expect(state.heroes[heroId].learnedMartials.vajra_staff).toBeUndefined()
    expect(state.heroes[heroId].equippedMartialIds).toEqual([expect.any(String), null, 'frost_sword', null])
  })

  it('挑战和秘境锁定期间拒绝装备、排序、卸下和遗忘', () => {
    const state = createInitialState()
    const heroId = state.formation[0].heroId
    expect(startChallenge(state).ok).toBe(true)
    expect(moveMartial(state, heroId, 0, 1).ok).toBe(false)
    expect(unequipMartial(state, heroId, 0).ok).toBe(false)
    expect(forgetMartial(state, heroId, state.heroes[heroId].equippedMartialIds[0]!).ok).toBe(false)

    const mystery = createInitialState()
    expect(startMystery(mystery, 4).ok).toBe(true)
    expect(moveMartial(mystery, heroId, 0, 1).ok).toBe(false)
    expect(unequipMartial(mystery, heroId, 0).ok).toBe(false)
    expect(forgetMartial(mystery, heroId, mystery.heroes[heroId].equippedMartialIds[0]!).ok).toBe(false)
  })

  it.each([
    ['dragon_palm', 'burn', 'enemy'],
    ['frost_sword', 'slow', 'enemy'],
    ['taiji_breath', 'guard', 'hero'],
    ['vajra_staff', 'sunder', 'enemy'],
    ['earth_origin', 'guard', 'party'],
  ] as const)('%s 会释放专属招式并施加 %s 状态', (martialId, statusId, target) => {
    const state = createInitialState()
    if (!state.unlockedMartials.includes(martialId)) state.unlockedMartials.push(martialId)
    const actorId = state.formation[0].heroId
    state.heroes[actorId].learnedMartials[martialId] ??= {
      rank: 1,
      invested: { silver: 0, experience: 0, pages: 0, reputation: 0 },
    }
    expect(unequipMartial(state, actorId, 0).ok).toBe(true)
    expect(equipMartial(state, actorId, martialId).ok).toBe(true)
    expect(startChallenge(state).ok).toBe(true)

    stepCombat(state)

    expect(state.combat.logs.at(-1)?.kind).toBe('skill')
    expect(state.combat.partyMembers[0].skillCooldown).toBe(MARTIALS.find((martial) => martial.id === martialId)?.skill.cooldown)
    if (target === 'enemy') expect(state.combat.enemyStatuses.some((status) => status.id === statusId)).toBe(true)
    if (target === 'hero') expect(state.combat.partyMembers.some((member) => member.statuses.some((status) => status.id === statusId))).toBe(true)
    if (target === 'party') expect(state.combat.partyMembers.every((member) => member.statuses.some((status) => status.id === statusId))).toBe(true)
  })

  it('灼伤会在敌方回合结算，护体与迟滞会降低反击损失', () => {
    const state = createInitialState()
    expect(startChallenge(state).ok).toBe(true)
    state.combat.partyMembers[1].hp -= 1
    for (let index = 0; index < 3; index += 1) stepCombat(state)

    expect(state.combat.logs.some((event) => event.kind === 'status' && event.text.includes('灼伤'))).toBe(true)
    const enemyEvent = state.combat.logs.findLast((event) => event.kind === 'enemy')
    expect(enemyEvent?.text).toContain('迟滞削弱攻势')
    expect(enemyEvent?.text).toContain('护体化解')
  })

  it('击败区域 BOSS 后解锁下一处江湖区域', () => {
    const state = createInitialState()
    expect(isRegionUnlocked(state, 'blackwind_fort')).toBe(false)
    expect(selectRegion(state, 'blackwind_fort')).toEqual({ ok: false, message: expect.stringContaining('尚未击败') })
    expect(startChallenge(state).ok).toBe(true)
    for (let index = 0; index < 200 && state.combat.status === 'fighting'; index += 1) stepCombat(state)
    expect(state.combat.status).toBe('victory')
    expect(state.defeatedBossIds).toContain('boss_stonebreaker')
    expect(isRegionUnlocked(state, 'blackwind_fort')).toBe(true)
    expect(isRegionUnlocked(state, 'frost_temple')).toBe(false)
    expect(selectRegion(state, 'blackwind_fort')).toEqual({ ok: true, message: '已前往黑风寨' })
    expect(state.selectedRegionId).toBe('blackwind_fort')
    expect(state.combat.regionId).toBe('blackwind_fort')
    expect(state.combat.enemyTraitId).toBe('iron_armor')
  })

  it('破阵重击会惩罚单前排，而双前排能降低 BOSS 反击', () => {
    const stable = createInitialState()
    expect(startChallenge(stable).ok).toBe(true)
    for (let index = 0; index < 3; index += 1) stepCombat(stable)
    const stableDamage = stable.combat.logs.at(-1)?.amount ?? 0

    const exposed = createInitialState()
    expect(setFormationRow(exposed, 0, 'back').ok).toBe(true)
    expect(startChallenge(exposed).ok).toBe(true)
    for (let index = 0; index < 3; index += 1) stepCombat(exposed)
    const exposedDamage = exposed.combat.logs.at(-1)?.amount ?? 0

    expect(stable.combat.logs.at(-1)?.text).toContain('双前排化解破阵')
    expect(exposed.combat.logs.at(-1)?.text).toContain('单前排遭受重击')
    expect(exposedDamage).toBeGreaterThan(stableDamage)
  })

  it('黑铁重甲压制前排强攻，但后排侠客能攻击薄弱处', () => {
    const frontState = createInitialState()
    frontState.defeatedBossIds.push('boss_stonebreaker')
    expect(selectRegion(frontState, 'blackwind_fort').ok).toBe(true)
    expect(startChallenge(frontState).ok).toBe(true)
    stepCombat(frontState)
    const frontDamage = frontState.combat.logs.at(-1)?.amount ?? 0

    const backState = createInitialState()
    backState.defeatedBossIds.push('boss_stonebreaker')
    expect(setFormationRow(backState, 0, 'back').ok).toBe(true)
    expect(selectRegion(backState, 'blackwind_fort').ok).toBe(true)
    expect(startChallenge(backState).ok).toBe(true)
    stepCombat(backState)
    const backDamage = backState.combat.logs.at(-1)?.amount ?? 0

    expect(frontState.combat.logs.at(-1)?.text).toContain('压制')
    expect(backState.combat.logs.at(-1)?.text).toContain('克制生效')
    expect(backDamage).toBeGreaterThan(frontDamage * 2)
  })

  it('寒罡护体压制非火系武学，火系武学可造成克制伤害', () => {
    const fireState = createInitialState()
    fireState.defeatedBossIds.push('boss_stonebreaker', 'boss_blackwind_chief')
    expect(selectRegion(fireState, 'frost_temple').ok).toBe(true)
    expect(startChallenge(fireState).ok).toBe(true)
    stepCombat(fireState)
    const fireDamage = fireState.combat.logs.at(-1)?.amount ?? 0

    const frostState = createInitialState()
    frostState.defeatedBossIds.push('boss_stonebreaker', 'boss_blackwind_chief')
    const frostHeroId = frostState.formation[0].heroId
    frostState.heroes[frostHeroId].learnedMartials.frost_sword = {
      rank: 1,
      invested: { silver: 0, experience: 0, pages: 0, reputation: 0 },
    }
    expect(unequipMartial(frostState, frostHeroId, 0).ok).toBe(true)
    expect(equipMartial(frostState, frostHeroId, 'frost_sword').ok).toBe(true)
    expect(selectRegion(frostState, 'frost_temple').ok).toBe(true)
    expect(startChallenge(frostState).ok).toBe(true)
    stepCombat(frostState)
    const frostDamage = frostState.combat.logs.at(-1)?.amount ?? 0

    expect(fireState.combat.logs.at(-1)?.text).toContain('克制生效')
    expect(frostState.combat.logs.at(-1)?.text).toContain('压制')
    expect(fireDamage).toBeGreaterThan(frostDamage * 2)
  })

  it('按区域提示调整 build 后可以依次问鼎三个区域', () => {
    const state = createInitialState()
    expect(startChallenge(state).ok).toBe(true)
    for (let index = 0; index < 300 && state.combat.status === 'fighting'; index += 1) stepCombat(state)
    expect(state.combat.status).toBe('victory')

    expect(setFormationRow(state, 0, 'back').ok).toBe(true)
    for (const { heroId } of state.formation) state.heroes[heroId].level = 6
    expect(selectRegion(state, 'blackwind_fort').ok).toBe(true)
    expect(startChallenge(state).ok).toBe(true)
    for (let index = 0; index < 500 && state.combat.status === 'fighting'; index += 1) stepCombat(state)
    expect(state.combat.status).toBe('victory')

    for (const { heroId } of state.formation) {
      state.heroes[heroId].level = 12
      state.heroes[heroId].learnedMartials.dragon_palm ??= {
        rank: 1,
        invested: { silver: 0, experience: 0, pages: 0, reputation: 0 },
      }
      if (!state.heroes[heroId].equippedMartialIds.includes('dragon_palm')) {
        expect(equipMartial(state, heroId, 'dragon_palm').ok).toBe(true)
      }
    }
    expect(selectRegion(state, 'frost_temple').ok).toBe(true)
    expect(startChallenge(state).ok).toBe(true)
    for (let index = 0; index < 800 && state.combat.status === 'fighting'; index += 1) stepCombat(state)

    expect(state.combat.status).toBe('victory')
    expect(state.defeatedBossIds).toEqual([
      'boss_stonebreaker',
      'boss_blackwind_chief',
      'boss_frost_arbiter',
    ])
  })

  it('相同秘境种子会生成稳定且互不相同的双岔路选择', () => {
    expect(getMysteryChoices(42, 0)).toEqual(getMysteryChoices(42, 0))
    expect(getMysteryChoices(42, 0)).toHaveLength(2)
    expect(new Set(getMysteryChoices(42, 0)).size).toBe(2)
    expect(getMysteryChoices(42, 1)).not.toEqual(getMysteryChoices(42, 0))
  })

  it('进入秘境后选择祝福会创建专属战斗并锁定本轮 build', () => {
    const state = createInitialState()
    expect(startMystery(state, 4).ok).toBe(true)
    expect(state.mystery.run?.choiceIds[0]).toBe('mountain_body')
    expect(setFormationRow(state, 0, 'back')).toEqual({ ok: false, message: '秘境探索期间不可换位' })

    expect(chooseMysteryBlessing(state, 'mountain_body').ok).toBe(true)
    expect(state.combat.mode).toBe('mystery')
    expect(state.mystery.run?.status).toBe('fighting')
    for (const member of state.combat.partyMembers) {
      expect(member.maxHp).toBeGreaterThan(getHeroStats(state, member.heroId).hp)
    }
  })

  it('寻珍灵印会提高秘境层奖励，离开时保留已经获得的战利品', () => {
    const state = createInitialState()
    const beforeSilver = state.resources.silver
    expect(startMystery(state, 5).ok).toBe(true)
    expect(state.mystery.run?.choiceIds[0]).toBe('fortune_seal')
    expect(chooseMysteryBlessing(state, 'fortune_seal').ok).toBe(true)
    state.combat.enemyHp = 1
    stepCombat(state)

    expect(state.mystery.run?.earned.silver).toBe(Math.round(MYSTERY_ENCOUNTERS[0].rewards.silver * 1.3))
    expect(state.resources.silver).toBe(beforeSilver + (state.mystery.run?.earned.silver ?? 0))
    expect(abandonMystery(state).ok).toBe(true)
    expect(state.mystery.run).toBeNull()
    expect(state.combat.mode).toBe('idle')
  })

  it('秘境战败会结束本轮并允许结算离开', () => {
    const state = createInitialState()
    expect(startMystery(state, 1).ok).toBe(true)
    expect(chooseMysteryBlessing(state, state.mystery.run!.choiceIds[0]).ok).toBe(true)
    for (const [index, member] of state.combat.partyMembers.entries()) member.hp = index === 0 ? 1 : 0
    state.combat.enemyHp = 100_000
    state.combat.enemyMaxHp = 100_000
    state.combat.enemyAttack = 999
    stepCombat(state)

    expect(state.mystery.run?.status).toBe('failed')
    expect(state.combat.status).toBe('defeat')
    expect(finishMystery(state).ok).toBe(true)
    expect(state.mystery.run).toBeNull()
    expect(state.combat.mode).toBe('idle')
  })

  it('高阶队伍可以连续选择祝福并贯通五层秘境', () => {
    const state = createInitialState()
    for (const { heroId } of state.formation) state.heroes[heroId].level = 50
    expect(startMystery(state, 17).ok).toBe(true)

    for (let guard = 0; guard < 10_000 && state.mystery.run?.status !== 'completed'; guard += 1) {
      const run = state.mystery.run
      if (!run) break
      if (run.status === 'choosing') {
        expect(chooseMysteryBlessing(state, run.choiceIds[0]).ok).toBe(true)
      } else if (run.status === 'fighting') {
        stepCombat(state)
      } else {
        break
      }
    }

    expect(state.mystery.run?.status).toBe('completed')
    expect(state.mystery.run?.floor).toBe(MYSTERY_ENCOUNTERS.length)
    expect(state.mystery.runsCompleted).toBe(1)
    expect(state.mystery.bestFloor).toBe(MYSTERY_ENCOUNTERS.length)
    expect(state.mystery.run?.earned.reputation).toBeGreaterThan(0)
  })
})
