import './style.css'
import { GameSession, SaveConflictError } from './app/game-session'
import { createRng } from './combat/rng'
import { COMBAT_TICK_MS } from './combat/timeline'
import type { CombatEvent, CombatRank, CombatUnit } from './combat/types'
import { createWave } from './combat/waves'
import { CAREERS, careerById } from './content/careers'
import { EQUIPMENT_AFFIXES, equipmentDefinitionById } from './content/equipment'
import { FACTIONS } from './content/factions'
import { FACTION_HEROES, HEROES_V10, TAVERN_HEROES, heroByIdV10, heroDisplayNameV10 } from './content/heroes'
import { CITY_HEART_METHODS, CITY_MARTIALS, FACTION_HEART_METHODS, FACTION_MARTIALS, martialByIdV10 } from './content/martials'
import { WORLDS } from './content/worlds'
import { changeCareer, perfectCareer } from './domain/careers'
import { buyCareerToken, learnCityMartial } from './domain/city'
import { equipEquipment, INVENTORY_CAPACITY, toggleEquipmentLock } from './domain/inventory'
import { equipHeartMethod, equipMartial, forgetMartial, learnFactionMartial, unequipMartial, upgradeMartial } from './domain/martial-training'
import { acceptQuest, cancelQuest, claimQuest, initializeQuestBoard } from './domain/quests'
import { recruitFromFaction, recruitFromTavern } from './domain/recruitment'
import { settleCombatEvent } from './domain/rewards'
import { clearSaveV10, hasSaveV10, SAVE_KEY_V10 } from './domain/save-v10'
import { normalizePlayerName } from './domain/state'
import type { ActionResult, EquipmentInstance, FormationPosition, FormationRow, GameStateV10 } from './domain/types'
import { renderCityPage, type CityPageViewModel } from './ui/city-page'
import { renderFactionsPage, type FactionsPageViewModel } from './ui/factions-page'
import { renderHeroesPage, type HeroesPageViewModel } from './ui/heroes-page'
import { renderIdlePage, type IdleCombatUnitView, type IdlePageViewModel } from './ui/idle-page'
import { renderInventoryPage, type InventoryPageViewModel } from './ui/inventory-page'
import { renderStageList, renderWorldOverview, type StageListViewModel, type WorldOverviewViewModel } from './ui/jianghu-page'
import { createDomPatcher } from './ui/dom-patch'
import { renderShell, type JianghuSection, type TabId } from './ui/shell'
import { renderStartPage } from './ui/start-page'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('缺少 #app 根节点')
const patchApp = createDomPatcher(app)

const toast = document.createElement('div')
toast.className = 'toast'
toast.hidden = true
toast.setAttribute('role', 'status')
document.body.append(toast)

type AppScreen = 'title' | 'new-game' | 'playing'
type JianghuView = 'worlds' | 'world' | 'combat'

let appScreen: AppScreen = 'title'
let session: GameSession
let activeTab: TabId = 'idle'
let jianghuView: JianghuView = 'worlds'
let jianghuSection: JianghuSection = 'stages'
let selectedWorldId = ''
let selectedStage = 1
let selectedHeroId: string | null = null
let selectedFactionId = ''
let combatSpeed: 1 | 2 | 4 = 1
let combatLogs: string[] = []
let hasSave = false
let startPlayerName = ''
let startError: string | null = null
let confirmOverwrite = false
let overwriteSaveSnapshot: string | null = null
let startBusy = false
let showResetConfirmation = false
let toastTimer = 0

try {
  hasSave = hasSaveV10(window.localStorage)
} catch {
  startError = '无法访问本地存储，请检查浏览器设置'
}

const notify = (message: string, warning = false): void => {
  toast.textContent = message
  toast.classList.toggle('warning', warning)
  toast.hidden = false
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.hidden = true }, 2400)
}

const enterPlaying = (nextSession: GameSession): void => {
  session = nextSession
  appScreen = 'playing'
  activeTab = 'idle'
  jianghuView = 'worlds'
  jianghuSection = 'stages'
  selectedWorldId = session.state.unlockedWorldIds[0] ?? 'world_01'
  selectedStage = Math.min(10, Math.max(1, (session.state.clearedStageByWorld[selectedWorldId] ?? 0) + 1))
  selectedHeroId = Object.keys(session.state.heroes)[0] ?? null
  selectedFactionId = FACTIONS.find((faction) => session.state.unlockedWorldIds.includes(faction.worldId))?.id ?? ''
  combatSpeed = 1
  combatLogs = []
  showResetConfirmation = false
  overwriteSaveSnapshot = null
}

const ensurePlaying = (): GameSession => {
  if (appScreen !== 'playing') throw new Error('游戏尚未开始')
  return session
}

const externalSaveChangeMessage = '存档已在其他窗口发生变化，请重新选择继续或新建游戏'

const leavePlayingForSaveChange = (serialized: string | null): void => {
  if (appScreen === 'playing') session.stopCombat()
  appScreen = 'title'
  hasSave = serialized !== null
  startPlayerName = ''
  startError = externalSaveChangeMessage
  confirmOverwrite = false
  overwriteSaveSnapshot = null
  startBusy = false
  showResetConfirmation = false
  render()
  notify(externalSaveChangeMessage, true)
}

const handleSessionSaveError = (error: unknown, silent = false): void => {
  if (error instanceof SaveConflictError) {
    leavePlayingForSaveChange(error.actualSnapshot)
    return
  }
  if (!silent) notify('存档保存失败，当前进度尚未写入', true)
}

const saveSession = (silent = false): boolean => {
  try {
    session.save()
    return true
  } catch (error) {
    handleSessionSaveError(error, silent)
    return false
  }
}

const commitAction = (result: ActionResult, successMessage?: string): void => {
  notify(result.ok ? successMessage ?? result.message : result.message, !result.ok)
  if (result.ok) saveSession()
}

const unitView = (unit: CombatUnit): IdleCombatUnitView => ({
  id: unit.id,
  name: unit.name,
  rank: unit.rank,
  row: unit.row,
  position: unit.position,
  hp: unit.hp,
  maxHp: unit.maxHp,
  energy: unit.energy,
  maxEnergy: unit.maxEnergy,
  gauge: unit.gauge,
  cooldownMs: Math.max(0, ...Object.values(unit.cooldowns), 0),
  alive: unit.alive,
})

const idleViewModel = (): IdlePageViewModel => {
  const combat = session.combat?.state
  if (!combat) throw new Error('战斗页面缺少进行中的战斗')
  const world = WORLDS.find((item) => item.id === combat.worldId) ?? WORLDS[0]
  return {
    worldName: world.name,
    selectedStage: combat.stage,
    inventoryCount: session.state.inventory.length,
    inventoryCapacity: INVENTORY_CAPACITY,
    combatSpeed,
    combat: {
      mode: combat.mode,
      wave: combat.wave,
      party: combat.party.map(unitView),
      enemies: combat.enemies.map(unitView),
    },
    logs: combatLogs,
  }
}

const worldOverviewViewModel = (): WorldOverviewViewModel => ({
  worlds: WORLDS.map((world) => ({
    id: world.id,
    name: world.name,
    index: world.index,
    unlocked: session.state.unlockedWorldIds.includes(world.id),
    difficulty: Math.min(5, Math.ceil(world.index / 2)),
    recommendedPower: Math.round(4000 * 1.65 ** (world.index - 1)),
    clearedStages: session.state.clearedStageByWorld[world.id] ?? 0,
    factionNames: FACTIONS.filter((faction) => faction.worldId === world.id).map((faction) => faction.name),
  })),
})

const stageListViewModel = (): StageListViewModel => {
  const world = WORLDS.find((item) => item.id === selectedWorldId) ?? WORLDS[0]
  const cleared = session.state.clearedStageByWorld[world.id] ?? 0
  return {
    worldId: world.id,
    worldName: world.name,
    worldCurrency: session.state.worldCurrency[world.id] ?? 0,
    stages: Array.from({ length: 10 }, (_, index) => ({
      stage: index + 1,
      unlocked: index + 1 <= Math.min(10, Math.max(1, cleared + 1)),
      cleared: index + 1 <= cleared,
    })),
  }
}

const recruitedHeroes = () => HEROES_V10.flatMap((definition) => {
  const progress = session.state.heroes[definition.id]
  return progress?.recruited ? [{ definition, progress, name: heroDisplayNameV10(definition, progress) }] : []
})

const normalizeSelectedHero = (): string | null => {
  const recruited = recruitedHeroes()
  if (!selectedHeroId || !session.state.heroes[selectedHeroId]?.recruited) selectedHeroId = recruited[0]?.definition.id ?? null
  return selectedHeroId
}

const heroesViewModel = (): HeroesPageViewModel => {
  const selectedId = normalizeSelectedHero()
  const selectedProgress = selectedId ? session.state.heroes[selectedId] : undefined
  const currentCareer = selectedProgress ? careerById(selectedProgress.currentCareerId) : undefined
  const learned = selectedProgress ? Object.entries(selectedProgress.learnedMartials).map(([id, record]) => {
    const martial = martialByIdV10(id)
    return { id, name: martial?.name ?? id, rarity: martial?.rarity ?? '粗浅', level: record.level }
  }) : []
  const compatibleCareers = currentCareer
    ? CAREERS.filter((career) => career.category === currentCareer.category && career.id !== currentCareer.id)
    : []
  const compatibleHeartMethods = selectedProgress
    ? [...FACTION_HEART_METHODS, ...CITY_HEART_METHODS].filter((method) =>
      session.state.unlockedWorldIds.includes(method.worldId) && method.careerIds.includes(selectedProgress.currentCareerId))
    : []

  return {
    selectedHeroId: selectedId,
    formation: session.state.formation,
    heroes: recruitedHeroes().map(({ definition, progress, name }) => {
      const career = careerById(progress.currentCareerId)
      const record = progress.careers[progress.currentCareerId]
      return {
        id: definition.id,
        name,
        grade: definition.grade,
        recruited: progress.recruited,
        level: progress.level,
        careerId: progress.currentCareerId,
        careerName: career?.name ?? progress.currentCareerId,
        careerLevel: record?.level ?? 1,
        careerPerfected: record?.perfected ?? false,
        availableCareerIds: compatibleCareers.map((item) => item.id),
        learnedMartials: Object.entries(progress.learnedMartials).map(([id, learnedRecord]) => {
          const martial = martialByIdV10(id)
          return { id, name: martial?.name ?? id, rarity: martial?.rarity ?? '粗浅', level: learnedRecord.level }
        }),
        equippedMartialIds: progress.equippedMartialIds,
        heartMethodId: progress.heartMethodId,
      }
    }),
    careers: compatibleCareers.map((career) => ({
      id: career.id,
      name: career.name,
      tier: career.tier,
      owned: Boolean(selectedProgress?.careers[career.id]),
      tokenOwned: session.state.careerTokens.includes(`token_${career.id}`),
    })),
    martials: learned.map((martial) => ({ ...martial, learned: true })),
    heartMethods: compatibleHeartMethods.map((method) => ({
      id: method.id,
      name: method.name,
      equipped: selectedProgress?.heartMethodId === method.id,
    })),
  }
}

const factionsViewModel = (): FactionsPageViewModel => {
  const availableFactions = FACTIONS.filter((faction) =>
    faction.worldId === selectedWorldId
    && session.state.unlockedWorldIds.includes(faction.worldId))
  if (!availableFactions.some((faction) => faction.id === selectedFactionId)) selectedFactionId = availableFactions[0]?.id ?? ''
  const faction = availableFactions.find((item) => item.id === selectedFactionId) ?? availableFactions[0]
  const board = session.state.factionBoards[selectedFactionId]
  const heroProgress = selectedHeroId ? session.state.heroes[selectedHeroId] : undefined
  const factionMartials = FACTION_MARTIALS.filter((martial) => martial.factionId === selectedFactionId)
  const factionHero = FACTION_HEROES.find((hero) => hero.factionId === selectedFactionId)
  return {
    selectedFactionId,
    factions: availableFactions.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      contribution: session.state.contribution[item.id] ?? 0,
      selected: item.id === selectedFactionId,
    })),
    refreshRemainingMs: board?.refreshRemainingMs ?? 0,
    quests: Array.from({ length: 6 }, (_, slot) => ({ slot, quest: board?.slots[slot] ?? null })),
    branches: (faction?.branchLabels ?? []).map((branch) => ({
      name: branch,
      martials: factionMartials.filter((martial) => martial.branch === branch).map((martial) => ({
        id: martial.id,
        name: martial.name,
        stage: martial.stage,
        rarity: martial.rarity,
        cost: martial.currencySource.amount,
        learned: Boolean(heroProgress?.learnedMartials[martial.id]),
        level: heroProgress?.learnedMartials[martial.id]?.level ?? 0,
      })),
    })),
    factionHero: factionHero ? {
      id: factionHero.id,
      name: factionHero.name,
      grade: factionHero.grade,
      cost: factionHero.cost,
      recruited: Boolean(session.state.heroes[factionHero.id]?.recruited),
    } : null,
    selectedHeroId: normalizeSelectedHero(),
  }
}

const tokenCost = (tier: string): number => tier === '中级' ? 300 : tier === '高级' ? 800 : tier === '顶级' ? 2000 : 0

const cityViewModel = (): CityPageViewModel => {
  const world = WORLDS.find((item) => item.id === selectedWorldId) ?? WORLDS[0]
  const selectedId = normalizeSelectedHero()
  const selectedProgress = selectedId ? session.state.heroes[selectedId] : undefined
  const selectedCareer = selectedProgress ? careerById(selectedProgress.currentCareerId) : undefined
  const worldIndex = Number(world.id.slice(-2)) || 1
  const tierAvailable = (tier: string): boolean => tier === '中级' || tier === '高级' && worldIndex >= 4 || tier === '顶级' && worldIndex >= 7
  return {
    worldId: world.id,
    worldName: world.name,
    worldCurrency: session.state.worldCurrency[world.id] ?? 0,
    selectedHeroId: selectedId,
    heroes: recruitedHeroes().map(({ definition, name }) => ({ id: definition.id, name })),
    tavernHeroes: TAVERN_HEROES.filter((hero) => hero.worldId === world.id).map((hero) => ({
      id: hero.id,
      name: hero.name,
      grade: hero.grade,
      cost: hero.cost,
      recruited: Boolean(session.state.heroes[hero.id]?.recruited),
    })),
    martials: CITY_MARTIALS.filter((martial) => martial.worldId === world.id).map((martial) => ({
      id: martial.id,
      name: martial.name.replace(world.id, world.name),
      rarity: martial.rarity,
      cost: martial.currencySource.amount,
      learned: Boolean(selectedProgress?.learnedMartials[martial.id]),
    })),
    careerTokens: CAREERS.filter((career) => career.previousId && tierAvailable(career.tier) && (!selectedCareer || career.category === selectedCareer.category)).map((career) => ({
      id: `token_${career.id}`,
      name: `${career.name}信物`,
      tier: career.tier,
      cost: tokenCost(career.tier),
      owned: session.state.careerTokens.includes(`token_${career.id}`),
    })),
  }
}

const inventoryViewModel = (): InventoryPageViewModel => {
  const selectedId = normalizeSelectedHero()
  const heroes = recruitedHeroes().map(({ definition, name }) => ({ id: definition.id, name }))
  const equippedBy = (uid: string): string | null => Object.entries(session.state.heroes)
    .find(([, progress]) => Object.values(progress.equipmentBySlot).includes(uid))?.[0] ?? null
  return {
    selectedHeroId: selectedId,
    heroes,
    capacity: INVENTORY_CAPACITY,
    items: session.state.inventory.map((item) => {
      const definition = equipmentDefinitionById(item.definitionId)
      return {
        uid: item.uid,
        name: definition?.name ?? item.definitionId,
        slot: definition?.slot ?? 'weapon',
        slotName: definition?.slot === 'weapon' ? '兵刃' : definition?.slot === 'head' ? '冠巾' : definition?.slot === 'armor' ? '衣甲' : definition?.slot === 'wrist' ? '护腕' : definition?.slot === 'waist' ? '腰佩' : definition?.slot === 'boots' ? '履靴' : '信物',
        level: item.level,
        quality: item.quality,
        locked: item.locked,
        equippedByHeroId: equippedBy(item.uid),
        affixes: item.affixes.map((affix) => ({
          name: EQUIPMENT_AFFIXES.find((definitionAffix) => definitionAffix.id === affix.id)?.name ?? affix.id,
          value: affix.value,
        })),
      }
    }),
  }
}

const normalizeSelectedWorld = (): void => {
  if (session.state.unlockedWorldIds.includes(selectedWorldId)) return
  selectedWorldId = session.state.unlockedWorldIds[0] ?? 'world_01'
  selectedStage = 1
  jianghuView = 'worlds'
  jianghuSection = 'stages'
}

const renderJianghuContent = (): string => {
  if (jianghuView === 'worlds') return renderWorldOverview(worldOverviewViewModel())
  if (jianghuView === 'combat' && session.combat) return renderIdlePage(idleViewModel())
  if (jianghuView === 'combat') {
    jianghuView = 'world'
    jianghuSection = 'stages'
  }
  if (jianghuSection === 'factions') return renderFactionsPage(factionsViewModel())
  if (jianghuSection === 'city') return renderCityPage(cityViewModel())
  return renderStageList(stageListViewModel())
}

const render = (): void => {
  if (appScreen !== 'playing') {
    patchApp(renderStartPage({
      screen: appScreen,
      hasSave,
      playerName: startPlayerName,
      error: startError,
      confirmOverwrite,
      busy: startBusy,
    }))
    return
  }
  normalizeSelectedWorld()
  const world = WORLDS.find((item) => item.id === selectedWorldId) ?? WORLDS[0]
  const content = activeTab === 'idle'
    ? renderJianghuContent()
    : activeTab === 'heroes'
      ? renderHeroesPage(heroesViewModel())
      : renderInventoryPage(inventoryViewModel())
  patchApp(renderShell({
    activeTab,
    worldContext: activeTab === 'idle' && jianghuView !== 'worlds'
      ? { worldName: world.name, activeSection: jianghuSection }
      : null,
    hasCombatReturn: Boolean(session.combat && !(activeTab === 'idle' && jianghuView === 'combat')),
    showResetConfirmation,
    content,
  }))
}

const createAndEnter = (playerName: string, expectedSnapshot: string | null): void => {
  if (startBusy) return
  startBusy = true
  startError = null
  render()
  try {
    const nextSession = GameSession.createNew(window.localStorage, playerName, Date.now(), expectedSnapshot)
    hasSave = true
    startBusy = false
    confirmOverwrite = false
    enterPlaying(nextSession)
  } catch (error) {
    appScreen = 'new-game'
    startBusy = false
    if (error instanceof SaveConflictError) {
      hasSave = error.actualSnapshot !== null
      confirmOverwrite = true
      overwriteSaveSnapshot = error.actualSnapshot
      startError = '存档已发生变化，请重新确认覆盖'
      notify(startError, true)
    } else {
      confirmOverwrite = false
      overwriteSaveSnapshot = null
      startError = error instanceof Error ? error.message : '新建游戏失败'
    }
  }
  render()
}

const logEvents = (events: CombatEvent[]): void => {
  for (const event of events) {
    if (event.type === 'enemy-defeated') combatLogs.push(`击败${event.rank === 'boss' ? ' Boss' : event.rank === 'elite' ? '精英' : '敌人'}，收益即时入账`)
    if (event.type === 'wave-started') combatLogs.push(`敌势再起，进入第 ${event.wave} 波`)
    if (event.type === 'stage-cleared') combatLogs.push('本关十波尽破')
    if (event.type === 'party-defeated') combatLogs.push('队伍败退，按规则回到驻守')
    if (event.type === 'skill-skipped') combatLogs.push(`${event.skillId}跳过：${event.reason}`)
  }
  combatLogs = combatLogs.slice(-40)
}

const startSelectedStage = (mode: 'guard' | 'roam', seed = Date.now()): void => {
  const result = session.startStage({ worldId: selectedWorldId, stage: selectedStage, mode, seed })
  notify(result.message, !result.ok)
  if (result.ok) {
    jianghuView = 'combat'
    jianghuSection = 'stages'
  }
  render()
}

const placeFormation = (heroId: string, row: FormationRow, position: FormationPosition): ActionResult => {
  if (!session.state.heroes[heroId]?.recruited) return { ok: false, message: '请先选择已加入的侠客' }
  session.state.formation = session.state.formation.filter((slot) => slot.heroId !== heroId && !(slot.row === row && slot.position === position))
  session.state.formation.push({ heroId, row, position })
  return { ok: true, message: '侠客已入阵' }
}

const removeFormation = (heroId: string): ActionResult => {
  const before = session.state.formation.length
  session.state.formation = session.state.formation.filter((slot) => slot.heroId !== heroId)
  return session.state.formation.length < before ? { ok: true, message: '侠客已下阵' } : { ok: false, message: '侠客不在阵中' }
}

const dataNumber = (button: HTMLElement, key: string): number => Number(button.dataset[key])

const performAction = (button: HTMLButtonElement): void => {
  const action = button.dataset.action
  const heroId = button.dataset.heroId ?? selectedHeroId ?? ''
  if (action === 'formation-place') commitAction(placeFormation(heroId, button.dataset.targetRow as FormationRow, dataNumber(button, 'position') as FormationPosition))
  else if (action === 'formation-remove') commitAction(removeFormation(heroId))
  else if (action === 'career-change') commitAction(changeCareer(session.state.heroes[heroId], button.dataset.careerId ?? '', session.state.careerTokens))
  else if (action === 'career-perfect') commitAction(perfectCareer(session.state.heroes[heroId], button.dataset.careerId ?? ''))
  else if (action === 'career-buy-token') commitAction(buyCareerToken(session.state, button.dataset.worldId ?? selectedWorldId, button.dataset.tokenId ?? ''))
  else if (action === 'martial-learn') commitAction(learnFactionMartial(session.state, heroId, button.dataset.martialId ?? ''))
  else if (action === 'martial-upgrade') commitAction(upgradeMartial(session.state, heroId, button.dataset.martialId ?? ''))
  else if (action === 'martial-equip') commitAction(equipMartial(session.state, heroId, button.dataset.martialId ?? '', dataNumber(button, 'slot')))
  else if (action === 'martial-unequip') commitAction(unequipMartial(session.state, heroId, dataNumber(button, 'slot')))
  else if (action === 'martial-forget') commitAction(forgetMartial(session.state, heroId, button.dataset.martialId ?? ''))
  else if (action === 'heart-method-equip') commitAction(equipHeartMethod(session.state, heroId, button.dataset.heartMethodId ?? ''))
  else if (action === 'quest-accept') commitAction(acceptQuest(session.state, button.dataset.factionId ?? '', dataNumber(button, 'slot')))
  else if (action === 'quest-cancel') commitAction(cancelQuest(session.state, button.dataset.factionId ?? '', dataNumber(button, 'slot')))
  else if (action === 'quest-claim') commitAction(claimQuest(session.state, button.dataset.factionId ?? '', dataNumber(button, 'slot')))
  else if (action === 'tavern-recruit') {
    const result = recruitFromTavern(session.state, heroId)
    if (result.ok) {
      selectedHeroId = result.heroId
      if (saveSession()) notify('邀请成功')
    } else notify(result.message, true)
  } else if (action === 'faction-recruit') commitAction(recruitFromFaction(session.state, button.dataset.factionId ?? '', heroId))
  else if (action === 'city-martial-learn') commitAction(learnCityMartial(session.state, heroId, button.dataset.martialId ?? ''))
  else if (action === 'equipment-equip') commitAction(equipEquipment(session.state, heroId, button.dataset.equipmentUid ?? ''))
  else if (action === 'equipment-lock') commitAction(toggleEquipmentLock(session.state, button.dataset.equipmentUid ?? ''))
}

app.addEventListener('submit', (event) => {
  const form = (event.target as HTMLElement).closest<HTMLFormElement>('form[data-action="create-game"]')
  if (!form) return
  event.preventDefault()
  if (startBusy || appScreen !== 'new-game') return

  const rawPlayerName = String(new FormData(form).get('playerName') ?? '')
  startPlayerName = rawPlayerName
  startError = null
  try {
    startPlayerName = normalizePlayerName(rawPlayerName)
  } catch (error) {
    startError = error instanceof Error ? error.message : '玩家姓名无效'
    confirmOverwrite = false
    render()
    return
  }

  try {
    const currentSave = window.localStorage.getItem(SAVE_KEY_V10)
    hasSave = currentSave !== null
    if (currentSave !== null) {
      overwriteSaveSnapshot = currentSave
      confirmOverwrite = true
      render()
      return
    }
  } catch {
    overwriteSaveSnapshot = null
    confirmOverwrite = false
    startError = '无法访问本地存储，请检查浏览器设置'
    render()
    return
  }
  overwriteSaveSnapshot = null
  createAndEnter(startPlayerName, null)
})

app.addEventListener('change', (event) => {
  const select = (event.target as HTMLElement).closest<HTMLSelectElement>('[data-action="select-hero-input"]')
  if (!select) return
  selectedHeroId = select.value || null
  render()
})

const handleStartOrResetAction = (action: string | undefined): boolean => {
  if (action === 'new-game') {
    if (startBusy) return true
    appScreen = 'new-game'
    startPlayerName = ''
    startError = null
    confirmOverwrite = false
    overwriteSaveSnapshot = null
    render()
    return true
  }
  if (action === 'back-title') {
    if (startBusy) return true
    appScreen = 'title'
    startPlayerName = ''
    startError = null
    confirmOverwrite = false
    overwriteSaveSnapshot = null
    render()
    return true
  }
  if (action === 'continue-game') {
    if (startBusy || !hasSave) return true
    startBusy = true
    startError = null
    render()
    try {
      const nextSession = GameSession.continue(window.localStorage)
      startBusy = false
      enterPlaying(nextSession)
    } catch (error) {
      appScreen = 'title'
      startBusy = false
      startError = error instanceof Error ? error.message : '继续游戏失败'
      notify(startError, true)
    }
    render()
    return true
  }
  if (action === 'cancel-overwrite') {
    if (startBusy) return true
    appScreen = 'title'
    startPlayerName = ''
    startError = null
    confirmOverwrite = false
    overwriteSaveSnapshot = null
    render()
    return true
  }
  if (action === 'confirm-overwrite') {
    if (startBusy || appScreen !== 'new-game' || !confirmOverwrite) return true
    let currentSave: string | null
    try {
      currentSave = window.localStorage.getItem(SAVE_KEY_V10)
    } catch {
      startError = '无法访问本地存储，请检查浏览器设置'
      notify(startError, true)
      render()
      return true
    }
    if (currentSave !== overwriteSaveSnapshot) {
      overwriteSaveSnapshot = currentSave
      hasSave = currentSave !== null
      startError = '存档已发生变化，请重新确认覆盖'
      notify(startError, true)
      render()
      return true
    }
    createAndEnter(startPlayerName, currentSave)
    return true
  }
  if (action === 'request-reset-save') {
    if (appScreen === 'playing') showResetConfirmation = true
    render()
    app.querySelector<HTMLButtonElement>('[data-action="cancel-reset-save"]')?.focus()
    return true
  }
  if (action === 'cancel-reset-save') {
    if (appScreen === 'playing') showResetConfirmation = false
    render()
    return true
  }
  if (action === 'confirm-reset-save') {
    if (appScreen !== 'playing' || !showResetConfirmation) return true
    try {
      clearSaveV10(window.localStorage)
    } catch {
      notify('删档失败，当前进度仍已保留', true)
      return true
    }
    session.stopCombat()
    hasSave = false
    appScreen = 'new-game'
    startPlayerName = ''
    startError = null
    confirmOverwrite = false
    overwriteSaveSnapshot = null
    startBusy = false
    showResetConfirmation = false
    render()
    return true
  }
  return false
}

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  const tab = target.closest<HTMLElement>('[data-tab]')?.dataset.tab as TabId | undefined
  if (tab) {
    activeTab = tab
    if (tab === 'idle') {
      jianghuView = 'worlds'
      jianghuSection = 'stages'
    }
    render()
    return
  }
  const worldSection = target.closest<HTMLElement>('[data-jianghu-section]')
    ?.dataset.jianghuSection as JianghuSection | undefined
  if (worldSection) {
    activeTab = 'idle'
    jianghuView = 'world'
    jianghuSection = worldSection
    render()
    return
  }
  const button = target.closest<HTMLButtonElement>('[data-action]')
  if (!button || button.disabled) return
  const { action } = button.dataset
  if (handleStartOrResetAction(action)) return
  if (appScreen !== 'playing') return
  if (action === 'enter-world' && button.dataset.worldId) {
    if (!session.state.unlockedWorldIds.includes(button.dataset.worldId)) {
      notify('江湖卷尚未解锁', true)
      return
    }
    selectedWorldId = button.dataset.worldId
    selectedStage = Math.min(10, Math.max(1, (session.state.clearedStageByWorld[selectedWorldId] ?? 0) + 1))
    selectedFactionId = FACTIONS.find((faction) => faction.worldId === selectedWorldId)?.id ?? ''
    jianghuView = 'world'
    jianghuSection = 'stages'
  } else if (action === 'start-stage') {
    selectedStage = Number(button.dataset.stage) || 1
    startSelectedStage('guard')
    return
  } else if (action === 'select-hero') selectedHeroId = button.dataset.heroId ?? null
  else if (action === 'select-faction') selectedFactionId = button.dataset.factionId ?? selectedFactionId
  else if (action === 'set-mode-guard' || action === 'set-mode-roam') {
    const result = session.setCombatMode(action === 'set-mode-guard' ? 'guard' : 'roam')
    notify(result.message, !result.ok)
  } else if (action === 'stop-combat') {
    session.stopCombat()
    combatLogs.push('主动停止战斗，临时战斗状态已清除')
    notify('已停止战斗')
    jianghuView = 'world'
    jianghuSection = 'stages'
  } else if (action === 'resume-combat' && session.combat) {
    activeTab = 'idle'
    selectedWorldId = session.combat.state.worldId
    selectedStage = session.combat.state.stage
    jianghuView = 'combat'
    jianghuSection = 'stages'
  } else if (action === 'return-worlds') {
    jianghuView = 'worlds'
    jianghuSection = 'stages'
  } else if (action?.startsWith('speed-')) {
    const speed = Number(action.slice(-1))
    if (speed === 1 || speed === 2 || speed === 4) combatSpeed = speed
  } else performAction(button)
  render()
})

window.addEventListener('storage', (event) => {
  if (event.key !== SAVE_KEY_V10 || event.storageArea !== window.localStorage) return
  if (appScreen === 'playing') {
    leavePlayingForSaveChange(event.newValue)
    return
  }
  hasSave = event.newValue !== null
  render()
})

window.setInterval(() => {
  if (appScreen !== 'playing') return
  try {
    if (session.combat) logEvents(session.advanceTicks(combatSpeed))
    session.advanceRuntime(COMBAT_TICK_MS)
  } catch (error) {
    handleSessionSaveError(error)
    return
  }
  render()
}, COMBAT_TICK_MS)

window.addEventListener('beforeunload', () => {
  if (appScreen !== 'playing') return
  try {
    session.save()
  } catch {
    // 页面关闭时仅阻止旧会话覆盖外部存档，不再打扰用户。
  }
})

const debugRecruit = (heroId: string): void => {
  ensurePlaying()
  const definition = heroByIdV10(heroId)
  if (!definition) throw new Error('侠客不存在')
  if (definition.source === 'starter') {
    if (!session.state.heroes[heroId]?.recruited) throw new Error('初始侠客只能在新建游戏时加入')
    selectedHeroId = heroId
    render()
    return
  } else if (definition.source === 'tavern') {
    session.state.worldCurrency[definition.worldId] = Math.max(session.state.worldCurrency[definition.worldId] ?? 0, definition.cost)
    const result = recruitFromTavern(session.state, heroId)
    if (!result.ok) throw new Error(result.message)
  } else {
    session.state.contribution[definition.factionId!] = Math.max(session.state.contribution[definition.factionId!] ?? 0, definition.cost)
    const result = recruitFromFaction(session.state, definition.factionId!, heroId)
    if (!result.ok) throw new Error(result.message)
  }
  selectedHeroId = heroId
  saveSession()
  render()
}

const debugFillInventory = (count: number): void => {
  ensurePlaying()
  session.state.inventory = Array.from({ length: Math.max(0, Math.min(INVENTORY_CAPACITY, Math.floor(count))) }, (_, index): EquipmentInstance => ({
    uid: `debug-equipment-${index}`,
    definitionId: 'world_01_weapon',
    level: 1,
    quality: '凡品',
    affixes: [],
    locked: false,
  }))
  saveSession()
  render()
}

const debugSettleEnemy = (seed: number, rank: CombatRank = 'normal'): string[] => {
  ensurePlaying()
  const result = settleCombatEvent(session.state, {
    type: 'enemy-defeated',
    atMs: 0,
    enemyId: `world_01_stage_01_${rank === 'boss' ? 'boss' : rank === 'elite' ? 'elite_1' : 'normal_1'}`,
    rank,
    worldId: 'world_01',
    stage: 1,
    seed,
  })
  saveSession()
  render()
  return result.addedEquipmentUids
}

declare global {
  interface Window {
    __EGG_JIANGHU__: {
      getState: () => GameStateV10
      getCombat: () => ReturnType<typeof structuredClone>
      getSelection: () => ReturnType<typeof structuredClone>
      setTab: (tab: TabId) => void
      startStage: (worldId: string, stage: number, mode: 'guard' | 'roam', seed: number) => void
      setCombatMode: (mode: 'guard' | 'roam') => void
      setClearedStage: (worldId: string, stage: number) => void
      advanceCombat: (ticks: number) => CombatEvent[]
      advanceRuntime: (elapsedMs: number) => void
      grantWorldCurrency: (worldId: string, amount: number) => void
      grantContribution: (factionId: string, amount: number) => void
      recruitHero: (heroId: string) => void
      placeHero: (heroId: string, row: FormationRow, position: FormationPosition) => void
      setHeroCareerLevel: (heroId: string, careerId: string, level: number) => void
      seedLearnedMartial: (heroId: string, martialId: string, level: number, slot?: number) => void
      setHeroCooldown: (heroId: string, martialId: string, remainingMs: number) => void
      fillInventory: (count: number) => void
      settleEnemy: (seed: number, rank?: CombatRank) => string[]
      showWave: (wave: number, seed: number) => void
      forceCombatResult: (result: 'victory' | 'defeat') => void
      prepareQuestBoard: (factionId: string, seed: number) => void
      reset: () => void
    }
  }
}

if (import.meta.env.DEV) window.__EGG_JIANGHU__ = {
  getState: () => structuredClone(ensurePlaying().state),
  getCombat: () => structuredClone(ensurePlaying().combat?.state ?? null),
  getSelection: () => structuredClone(ensurePlaying().selection),
  setTab: (tab) => {
    ensurePlaying()
    activeTab = tab
    if (tab === 'idle') {
      jianghuView = 'worlds'
      jianghuSection = 'stages'
    }
    render()
  },
  startStage: (worldId, stage, mode, seed) => {
    ensurePlaying()
    selectedWorldId = worldId
    selectedStage = stage
    startSelectedStage(mode, seed)
  },
  setCombatMode: (mode) => { ensurePlaying(); commitAction(session.setCombatMode(mode)); render() },
  setClearedStage: (worldId, stage) => {
    ensurePlaying()
    session.state.clearedStageByWorld[worldId] = Math.max(0, Math.min(10, Math.floor(stage)))
    render()
  },
  advanceCombat: (ticks) => {
    ensurePlaying()
    const events = session.advanceTicks(ticks)
    logEvents(events)
    render()
    return events
  },
  advanceRuntime: (elapsedMs) => { ensurePlaying(); session.advanceRuntime(elapsedMs); render() },
  grantWorldCurrency: (worldId, amount) => { ensurePlaying(); session.state.worldCurrency[worldId] = amount; saveSession(); render() },
  grantContribution: (factionId, amount) => { ensurePlaying(); session.state.contribution[factionId] = amount; saveSession(); render() },
  recruitHero: debugRecruit,
  placeHero: (heroId, row, position) => { ensurePlaying(); commitAction(placeFormation(heroId, row, position)); render() },
  setHeroCareerLevel: (heroId, careerId, level) => {
    ensurePlaying()
    const hero = session.state.heroes[heroId]
    if (!hero) throw new Error('侠客尚未加入')
    hero.careers[careerId] = { level, experience: 0, perfected: false }
    hero.currentCareerId = careerId
    saveSession()
    render()
  },
  seedLearnedMartial: (heroId, martialId, level, slot) => {
    ensurePlaying()
    const hero = session.state.heroes[heroId]
    const martial = martialByIdV10(martialId)
    if (!hero || !martial) throw new Error('侠客或武功不存在')
    hero.learnedMartials[martialId] = { level, invested: { worldCurrency: {}, contribution: {} } }
    if (slot !== undefined && slot >= 0 && slot < 4) hero.equippedMartialIds[slot] = martialId
    saveSession()
    render()
  },
  setHeroCooldown: (heroId, martialId, remainingMs) => {
    ensurePlaying()
    const hero = session.combat?.state.party.find((unit) => unit.id === heroId)
    if (!hero) throw new Error('出战侠客不存在')
    hero.cooldowns[martialId] = Math.max(0, remainingMs)
    render()
  },
  fillInventory: debugFillInventory,
  settleEnemy: debugSettleEnemy,
  showWave: (wave, seed) => {
    ensurePlaying()
    if (!session.combat) throw new Error('战斗尚未开始')
    session.combat.state.wave = wave
    session.combat.state.enemies = createWave(session.combat.state.worldId, session.combat.state.stage, wave, seed).enemies
    render()
  },
  forceCombatResult: (result) => {
    ensurePlaying()
    if (!session.combat) throw new Error('战斗尚未开始')
    session.combat.state.result = result
    logEvents(session.advanceTicks(0))
    render()
  },
  prepareQuestBoard: (factionId, seed) => {
    ensurePlaying()
    const faction = FACTIONS.find((item) => item.id === factionId)
    if (!faction) throw new Error('势力不存在')
    const normalId = `${faction.worldId}_stage_01_normal_1`
    const bossId = `${faction.worldId}_stage_01_boss`
    session.state.encounteredEnemyIds = [...new Set([...session.state.encounteredEnemyIds, normalId, bossId])]
    initializeQuestBoard(session.state, factionId, createRng(seed), 0)
    saveSession()
    render()
  },
  reset: () => {
    window.localStorage.removeItem(SAVE_KEY_V10)
    enterPlaying(GameSession.createNew(window.localStorage, '测试少侠', 1000, null))
    hasSave = true
    render()
  },
}

render()
if (startError) notify(startError, true)
