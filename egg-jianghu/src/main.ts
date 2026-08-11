import './style.css'
import { GameSession, SaveConflictError } from './app/game-session'
import { RuntimeClock } from './app/runtime-clock'
import { createRng } from './combat/rng'
import { buildCombatStats } from './combat/stats'
import { COMBAT_TICK_MS } from './combat/timeline'
import type { CombatEvent, CombatRank, CombatUnit } from './combat/types'
import { createWave, enemyDisplayName } from './combat/waves'
import { CAREERS, careerById } from './content/careers'
import {
  EQUIPMENT_AFFIXES,
  EQUIPMENT_QUALITIES,
  EQUIPMENT_SLOTS,
  equipmentAffixRange,
  equipmentBaseStatValue,
  equipmentDefinitionById,
  type EquipmentSlot,
} from './content/equipment'
import { FACTIONS } from './content/factions'
import { FACTION_HEROES, HEROES_V10, TAVERN_HEROES, heroByIdV10, heroDisplayNameV10 } from './content/heroes'
import { CITY_HEART_METHODS, CITY_MARTIALS, FACTION_HEART_METHODS, FACTION_MARTIALS, heartMethodByIdV10, martialByIdV10 } from './content/martials'
import { WORLDS } from './content/worlds'
import { APT_DESC, STAT_DESC } from './content/stat-descriptions'
import { worldPresentation } from './content/world-presentations'
import { changeCareer, perfectCareer } from './domain/careers'
import { buyCareerToken, learnCityMartial } from './domain/city'
import { backpackEquipment, discardEquipment, discardEquipmentByQuality, equipEquipment, equipmentOwnerId, INVENTORY_CAPACITY, organizeInventory, toggleEquipmentLock, unequipEquipment } from './domain/inventory'
import { MAX_MARTIAL_LEVEL, equipHeartMethod, equipMartial, forgetMartial, learnFactionMartial, unequipMartial, upgradeMartial } from './domain/martial-training'
import { acceptQuest, cancelQuest, claimQuest, initializeQuestBoard } from './domain/quests'
import { recruitFromFaction, recruitFromTavern } from './domain/recruitment'
import { settleCombatEvent } from './domain/rewards'
import { clearSaveV10, hasSaveV10, SAVE_KEY_V10 } from './domain/save-v10'
import { placeFormation, removeFormation } from './domain/formation'
import { normalizePlayerName } from './domain/state'
import type { ActionResult, EquipmentInstance, EquipmentQuality, FormationPosition, FormationRow, GameStateV10 } from './domain/types'
import { renderCityPage, type CityPageViewModel } from './ui/city-page'
import { MARTIAL_LORE } from './content/martial-lore'
import { renderFactionsPage, withLore, type FactionMartialState, type FactionsPageViewModel } from './ui/factions-page'
import { renderFormationPage, type FormationFilter, type FormationPageViewModel } from './ui/formation-page'
import { renderHeroesPage, type HeroesEquipmentView, type HeroesHeroView, type HeroesPageViewModel } from './ui/heroes-page'
import {
  renderIdlePage,
  type IdleCombatEffectKind,
  type IdleCombatEffectView,
  type IdleCombatLogKind,
  type IdleCombatLogView,
  type IdleCombatUnitView,
  type IdlePageViewModel,
} from './ui/idle-page'
import { renderInventoryPage, type InventoryItemView, type InventoryPageViewModel } from './ui/inventory-page'
import { renderStageList, renderWorldOverview, type StageListViewModel, type WorldOverviewViewModel } from './ui/jianghu-page'
import { createDomPatcher } from './ui/dom-patch'
import { renderShell, type JianghuSection, type TabId } from './ui/shell'
import { renderStartPage } from './ui/start-page'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('缺少 #app 根节点')
const patchApp = createDomPatcher(app)
const MAX_COMBAT_REALTIME_TICKS_PER_PULSE = 600
const runtimeClock = new RuntimeClock(COMBAT_TICK_MS, performance.now())
const combatClock = new RuntimeClock(COMBAT_TICK_MS, performance.now())

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
let jianghuMotionPending: 'overview' | 'stage' | null = null
let selectedWorldId = ''
let selectedStage = 1
let selectedHeroId: string | null = null
let inventorySlotFilter: EquipmentSlot | 'all' = 'all'
let selectedInventoryUid: string | null = null
let inventoryDetailOpen = false
let pendingInventoryDropUids: string[] = []
let heroInventorySlotFilter: EquipmentSlot | 'all' = 'all'
let heroInventoryQualityFilter: EquipmentQuality | 'all' = 'all'
let heroInventoryPage = 1
let heroBatchDiscardQuality: EquipmentQuality | 'all' = 'all'
let showBatchDiscardConfirm = false
let heroRosterQuery = ''
let heroRosterGradeFilter = 'all'
let heroRosterCategoryFilter = 'all'
let heroRosterLocatePending = false
let formationSelectedHeroId: string | null = null
let formationDetailHeroId: string | null = null
let formationFilter: FormationFilter = 'all'
let dragHeroId: string | null = null
let dragCandidateHeroId: string | null = null
let selectedFactionId = ''
let selectedFactionMartialId: string | null = null
let selectedCityMartialId: string | null = null
let factionRosterOpen = false
let factionRosterQuery = ''
let combatSpeed: 1 | 2 | 4 = 1
let combatLogs: IdleCombatLogView[] = []
type ActiveCombatEffect = IdleCombatEffectView & { expiresAt: number }
type CombatRunPresentation = {
  startedAt: number
  currencyStart: number
  equipmentStart: number
  kills: number
}
let combatEffects: ActiveCombatEffect[] = []
let combatRunPresentation: CombatRunPresentation | null = null
let nextCombatPresentationId = 1
const combatUnitCache = new Map<string, { name: string; side: 'party' | 'enemy' }>()
let hasSave = false
let startPlayerName = ''
let startError: string | null = null
let confirmOverwrite = false
let overwriteSaveSnapshot: string | null = null
let startBusy = false
let showResetConfirmation = false
let openEquipmentTooltip: HTMLDivElement | null = null
let openEquipmentTooltipAnchor: HTMLElement | null = null
let trackedCombat: GameSession['combat'] = null
type FactionContributionAnimation = {
  from: number
  to: number
  startedAt: number
  framePending: boolean
}

let factionSwitchAnimationPending = false
let factionContributionAnimation: FactionContributionAnimation | null = null
let factionMotionTimer: number | null = null

const EQUIPMENT_TOOLTIP_ANCHOR = '.hero-equipment-slot, .hero-inventory-item, .pack-row'
const EQUIPMENT_TOOLTIP_GAP = 10
const EQUIPMENT_TOOLTIP_VIEWPORT_PADDING = 12

const combatEffectDuration: Record<IdleCombatEffectKind, number> = {
  'lunge-party': 420,
  'lunge-enemy': 420,
  'hit-shake': 380,
  'skill-aura': 760,
  'heal-aura': 760,
  damage: 1050,
  critical: 1050,
  healing: 1050,
  'skill-name': 1050,
  slash: 420,
  'wave-banner': 1800,
}

const totalWorldCurrency = (): number => Object.values(session.state.worldCurrency)
  .reduce((total, value) => total + value, 0)

const cacheCombatUnits = (): void => {
  const combat = session.combat?.state
  if (!combat) return
  for (const unit of [...combat.party, ...combat.summons, ...combat.enemies]) {
    combatUnitCache.set(unit.id, { name: unit.name, side: unit.side })
  }
}

const addCombatLog = (kind: IdleCombatLogKind, mark: string, text: string): void => {
  combatLogs.push({ id: nextCombatPresentationId++, kind, mark, text })
  combatLogs = combatLogs.slice(-60)
}

const addCombatEffect = (
  kind: IdleCombatEffectKind,
  now: number,
  unitId?: string,
  text?: string,
): void => {
  combatEffects.push({
    id: nextCombatPresentationId++,
    kind,
    unitId,
    text,
    expiresAt: now + combatEffectDuration[kind],
  })
  combatEffects = combatEffects.slice(-100)
}

const beginCombatPresentation = (): void => {
  const now = performance.now()
  combatLogs = []
  combatEffects = []
  combatUnitCache.clear()
  combatRunPresentation = {
    startedAt: now,
    currencyStart: totalWorldCurrency(),
    equipmentStart: backpackEquipment(session.state).length,
    kills: 0,
  }
  cacheCombatUnits()
  addCombatEffect('wave-banner', now, undefined, '第 1 波')
  addCombatLog('system', '战', '战斗开始，铜钱与随机装备将在击败敌人后即时入账。')
}

const activeCombatEffects = (now: number): IdleCombatEffectView[] => {
  combatEffects = combatEffects.filter((effect) => effect.expiresAt > now)
  return combatEffects.map(({ expiresAt: _expiresAt, ...effect }) => effect)
}

const combatUnitName = (unitId: string): string => combatUnitCache.get(unitId)?.name ?? '无名侠客'

const presentCombatEvents = (events: CombatEvent[], now: number): void => {
  for (const event of events) {
    if (event.type === 'skill-used') {
      const martial = martialByIdV10(event.skillId)
      const actor = combatUnitCache.get(event.sourceId)
      if (actor && martial?.damageRoute !== 'healing') {
        addCombatEffect(actor.side === 'party' ? 'lunge-party' : 'lunge-enemy', now, event.sourceId)
      }
      if (martial) {
        addCombatEffect('skill-aura', now, event.sourceId)
        addCombatEffect('skill-name', now, event.sourceId, martial.name)
        addCombatLog('skill', '绝', `${combatUnitName(event.sourceId)} 使出「${martial.name}」！`)
      }
    } else if (event.type === 'damage') {
      addCombatEffect('hit-shake', now, event.targetId)
      addCombatEffect('slash', now, event.targetId)
      addCombatEffect(event.critical ? 'critical' : 'damage', now, event.targetId, String(event.amount))
    } else if (event.type === 'healing') {
      addCombatEffect('heal-aura', now, event.targetId)
      addCombatEffect('healing', now, event.targetId, String(event.amount))
      addCombatLog('heal', '愈', `${combatUnitName(event.sourceId)} 为 ${combatUnitName(event.targetId)} 恢复 ${event.amount} 气血。`)
    } else if (event.type === 'enemy-defeated') {
      if (combatRunPresentation) combatRunPresentation.kills += 1
      const rank = event.rank === 'boss' ? '首领' : event.rank === 'elite' ? '精英' : '敌人'
      addCombatLog('kill', '刃', `击败${rank}「${combatUnitName(event.enemyId)}」，收益已即时入账。`)
    } else if (event.type === 'wave-started') {
      addCombatEffect('wave-banner', now, undefined, event.wave === 10 ? '帅旗至 · 第 10 波' : `第 ${event.wave} 波`)
      addCombatLog('wave', '波', event.wave === 10 ? '敌首亲率众至，第 10 波！' : `敌势再起，进入第 ${event.wave} 波。`)
    } else if (event.type === 'stage-cleared') {
      addCombatLog('wave', '破', '本关十波尽破。')
    } else if (event.type === 'party-defeated') {
      addCombatLog('defeat', '退', '队伍败退，按当前模式重整旗鼓。')
    } else if (event.type === 'skill-skipped') {
      const martialName = martialByIdV10(event.skillId)?.name ?? '当前招式'
      addCombatLog('system', '止', `${combatUnitName(event.sourceId)} 的「${martialName}」未能施展：${event.reason}。`)
    }
  }
}

const hideEquipmentTooltip = (): void => {
  const tooltip = openEquipmentTooltip
  openEquipmentTooltip = null
  openEquipmentTooltipAnchor = null
  if (!tooltip) return
  if (tooltip.isConnected && tooltip.matches(':popover-open')) tooltip.hidePopover()
  tooltip.style.removeProperty('left')
  tooltip.style.removeProperty('top')
  delete tooltip.dataset.placement
}

const positionOpenEquipmentTooltip = (): void => {
  const tooltip = openEquipmentTooltip
  const anchor = openEquipmentTooltipAnchor
  if (!tooltip?.isConnected || !anchor?.isConnected || !tooltip.matches(':popover-open')) {
    openEquipmentTooltip = null
    openEquipmentTooltipAnchor = null
    return
  }

  const anchorRect = anchor.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  const viewportWidth = document.documentElement.clientWidth
  const viewportHeight = document.documentElement.clientHeight
  const padding = EQUIPMENT_TOOLTIP_VIEWPORT_PADDING
  const gap = EQUIPMENT_TOOLTIP_GAP
  const clamp = (value: number, minimum: number, maximum: number): number =>
    Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
  const roomRight = viewportWidth - anchorRect.right - padding
  const roomLeft = anchorRect.left - padding
  const roomAbove = anchorRect.top - padding
  const roomBelow = viewportHeight - anchorRect.bottom - padding
  let left: number
  let top: number
  let placement: 'left' | 'right' | 'above' | 'below'

  if (roomRight >= tooltipRect.width + gap || roomLeft >= tooltipRect.width + gap) {
    const useRight = roomRight >= tooltipRect.width + gap
      && (roomLeft < tooltipRect.width + gap || roomRight >= roomLeft)
    placement = useRight ? 'right' : 'left'
    left = useRight ? anchorRect.right + gap : anchorRect.left - tooltipRect.width - gap
    top = clamp(
      anchorRect.top + (anchorRect.height - tooltipRect.height) / 2,
      padding,
      viewportHeight - tooltipRect.height - padding,
    )
  } else {
    const useBelow = roomBelow >= tooltipRect.height + gap
      && (roomAbove < tooltipRect.height + gap || roomBelow >= roomAbove)
    placement = useBelow ? 'below' : 'above'
    left = clamp(
      anchorRect.left + (anchorRect.width - tooltipRect.width) / 2,
      padding,
      viewportWidth - tooltipRect.width - padding,
    )
    top = useBelow ? anchorRect.bottom + gap : anchorRect.top - tooltipRect.height - gap
    top = clamp(top, padding, viewportHeight - tooltipRect.height - padding)
  }

  tooltip.style.left = `${Math.round(left)}px`
  tooltip.style.top = `${Math.round(top)}px`
  tooltip.dataset.placement = placement
}

const showEquipmentTooltip = (anchor: HTMLElement): void => {
  const tooltip = [...anchor.children].find((child): child is HTMLDivElement =>
    child instanceof HTMLDivElement && child.classList.contains('equipment-tooltip'))
  if (!tooltip) return
  if (openEquipmentTooltip === tooltip && tooltip.matches(':popover-open')) {
    positionOpenEquipmentTooltip()
    return
  }

  hideEquipmentTooltip()
  openEquipmentTooltip = tooltip
  openEquipmentTooltipAnchor = anchor
  tooltip.style.left = '0px'
  tooltip.style.top = '0px'
  try {
    tooltip.showPopover()
    positionOpenEquipmentTooltip()
  } catch {
    openEquipmentTooltip = null
    openEquipmentTooltipAnchor = null
  }
}
/* ---------- 属性释义浮动卡片（根骨资质 / 战斗属性 / 雷达轴） ---------- */
let statTooltip: HTMLDivElement | null = null
let statTooltipAnchor: HTMLElement | null = null
const STAT_TOOLTIP_GAP = 10
const STAT_TOOLTIP_VIEWPORT_PADDING = 8

const ensureStatTooltip = (): HTMLDivElement => {
  if (statTooltip?.isConnected) return statTooltip
  const el = document.createElement('div')
  el.className = 'stat-tooltip'
  el.setAttribute('popover', 'manual')
  el.setAttribute('role', 'tooltip')
  document.body.append(el)
  statTooltip = el
  return el
}

const positionStatTooltip = (): void => {
  const tooltip = statTooltip
  const anchor = statTooltipAnchor
  if (!tooltip?.isConnected || !anchor?.isConnected) return
  const anchorRect = anchor.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  const viewportWidth = document.documentElement.clientWidth
  const viewportHeight = document.documentElement.clientHeight
  const pad = STAT_TOOLTIP_VIEWPORT_PADDING
  const gap = STAT_TOOLTIP_GAP
  const roomAbove = anchorRect.top - pad
  const roomBelow = viewportHeight - anchorRect.bottom - pad
  const useBelow = roomAbove < tooltipRect.height + gap && roomBelow >= tooltipRect.height + gap
  const top = useBelow
    ? anchorRect.bottom + gap
    : Math.max(pad, anchorRect.top - tooltipRect.height - gap)
  const left = Math.min(
    Math.max(pad, anchorRect.left + (anchorRect.width - tooltipRect.width) / 2),
    viewportWidth - tooltipRect.width - pad,
  )
  tooltip.style.left = `${Math.round(left)}px`
  tooltip.style.top = `${Math.round(top)}px`
  tooltip.dataset.placement = useBelow ? 'below' : 'above'
}

const showStatTooltip = (anchor: HTMLElement, label: string, desc: string): void => {
  const tooltip = ensureStatTooltip()
  tooltip.innerHTML =
    `<header><small>属性释义</small><strong>${label}</strong></header><div class="stat-tip-body">${desc}</div>`
  statTooltipAnchor = anchor
  tooltip.style.left = '0px'
  tooltip.style.top = '0px'
  try {
    tooltip.showPopover()
  } catch {
    tooltip.style.display = 'block'
  }
  positionStatTooltip()
}

const hideStatTooltip = (): void => {
  const tooltip = statTooltip
  if (!tooltip?.isConnected) return
  statTooltipAnchor = null
  if (tooltip.matches(':popover-open')) {
    try {
      tooltip.hidePopover()
    } catch {
      tooltip.style.display = 'none'
    }
  } else {
    tooltip.style.display = 'none'
  }
}

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
  jianghuMotionPending = 'overview'
  selectedWorldId = session.state.unlockedWorldIds[0] ?? 'world_01'
  selectedStage = Math.min(10, Math.max(1, (session.state.clearedStageByWorld[selectedWorldId] ?? 0) + 1))
  selectedHeroId = Object.keys(session.state.heroes)[0] ?? null
  inventorySlotFilter = 'all'
  selectedInventoryUid = null
  inventoryDetailOpen = false
  pendingInventoryDropUids = []
  heroInventorySlotFilter = 'all'
  heroInventoryQualityFilter = 'all'
  heroInventoryPage = 1
  heroBatchDiscardQuality = 'all'
  showBatchDiscardConfirm = false
  heroRosterQuery = ''
  heroRosterGradeFilter = 'all'
  heroRosterCategoryFilter = 'all'
  heroRosterLocatePending = false
  selectedFactionId = FACTIONS.find((faction) => session.state.unlockedWorldIds.includes(faction.worldId))?.id ?? ''
  selectedFactionMartialId = null
  factionRosterOpen = false
  factionRosterQuery = ''
  combatSpeed = 1
  combatLogs = []
  combatEffects = []
  combatRunPresentation = null
  combatUnitCache.clear()
  showResetConfirmation = false
  overwriteSaveSnapshot = null
  const now = performance.now()
  runtimeClock.reset(now)
  combatClock.reset(now)
  trackedCombat = session.combat
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

const unitView = (unit: CombatUnit): IdleCombatUnitView => {
  const martial = unit.skillIds
    .map((skillId) => skillId ? martialByIdV10(skillId) : undefined)
    .find((candidate) => candidate !== undefined)
  return {
    id: unit.id,
    name: unit.name,
    rank: unit.rank,
    careerId: unit.careerId,
    row: unit.row,
    position: unit.position,
    hp: unit.hp,
    maxHp: unit.maxHp,
    energy: unit.energy,
    maxEnergy: unit.maxEnergy,
    gauge: unit.gauge,
    cooldownMs: Math.max(0, ...Object.values(unit.cooldowns), 0),
    alive: unit.alive,
    skillName: martial?.name ?? (unit.side === 'party' ? '蓄势待发' : '伺机出手'),
  }
}

const idleViewModel = (): IdlePageViewModel => {
  const combat = session.combat?.state
  if (!combat) throw new Error('战斗页面缺少进行中的战斗')
  if (!combatRunPresentation) beginCombatPresentation()
  const world = WORLDS.find((item) => item.id === combat.worldId) ?? WORLDS[0]
  const now = performance.now()
  const stats = combatRunPresentation!
  return {
    worldId: world.id,
    worldName: world.name,
    selectedStage: combat.stage,
    inventoryCount: backpackEquipment(session.state).length,
    inventoryCapacity: INVENTORY_CAPACITY,
    combatSpeed,
    combat: {
      mode: combat.mode,
      wave: combat.wave,
      party: combat.party.map(unitView),
      enemies: combat.enemies.map(unitView),
    },
    stats: {
      copper: Math.max(0, totalWorldCurrency() - stats.currencyStart),
      equipment: Math.max(0, backpackEquipment(session.state).length - stats.equipmentStart),
      kills: stats.kills,
      elapsedMs: Math.max(0, now - stats.startedAt),
    },
    logs: combatLogs,
    effects: activeCombatEffects(now),
  }
}

const worldOverviewViewModel = (): WorldOverviewViewModel => {
  const currentWorld = WORLDS.find((world) => world.released
    && session.state.unlockedWorldIds.includes(world.id)
    && (session.state.clearedStageByWorld[world.id] ?? 0) < 10)
  const worlds = WORLDS.map((world) => {
    const unlocked = session.state.unlockedWorldIds.includes(world.id)
    const clearedStages = world.released ? (session.state.clearedStageByWorld[world.id] ?? 0) : 0
    const state = !world.released || !unlocked
      ? 'locked' as const
      : clearedStages >= 10
        ? 'cleared' as const
        : world.id === currentWorld?.id
          ? 'current' as const
          : 'open' as const
    const factions = FACTIONS.filter((faction) => faction.worldId === world.id)
    const presentation = worldPresentation(world.id)
    return {
      id: world.id,
      name: world.name,
      index: world.index,
      released: world.released,
      unlocked,
      difficulty: world.released ? Math.min(5, Math.ceil(world.index / 2)) : 0,
      recommendedPower: world.released ? Math.round(4000 * 1.65 ** (world.index - 1)) : 0,
      clearedStages,
      factionNames: world.released ? factions.map((faction) => faction.name) : [],
      factions: world.released ? factions.map((faction) => ({ name: faction.name, category: faction.category })) : [],
      state,
      latinName: presentation.latinName,
      flavor: presentation.flavor,
      currencyName: presentation.currencyName,
      lockText: !world.released ? '尚未开放' : world.index > 1 ? `通关 ${WORLDS[world.index - 2]?.name ?? '上一卷'} 后开启` : '尚未开放',
    }
  })
  return {
    worlds,
    totalClearedStages: worlds.reduce((total, world) => total + world.clearedStages, 0),
    totalStageCount: WORLDS.filter((world) => world.released).length * 10,
    currentWorldId: currentWorld?.id,
    currentWorldName: currentWorld?.name,
  }
}

const stageListViewModel = (): StageListViewModel => {
  const world = WORLDS.find((item) => item.id === selectedWorldId) ?? WORLDS[0]
  const cleared = session.state.clearedStageByWorld[world.id] ?? 0
  const presentation = worldPresentation(world.id)
  const factions = FACTIONS.filter((faction) => faction.worldId === world.id)
  return {
    worldId: world.id,
    worldName: world.name,
    worldIndex: world.index,
    worldLatinName: presentation.latinName,
    worldCurrency: session.state.worldCurrency[world.id] ?? 0,
    currencyName: presentation.currencyName,
    difficulty: world.released ? Math.min(5, Math.ceil(world.index / 2)) : 0,
    recommendedPower: world.released ? Math.round(4000 * 1.65 ** (world.index - 1)) : 0,
    clearedStages: cleared,
    flavor: presentation.flavor,
    factions: factions.map((faction) => ({ name: faction.name, category: faction.category })),
    stageNames: presentation.stageNames,
    stages: Array.from({ length: 10 }, (_, index) => ({
      stage: index + 1,
      name: presentation.stageNames[index] ?? `第${index + 1}关`,
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

const equipmentSlotNames: Record<EquipmentSlot, string> = {
  weapon: '兵刃',
  head: '冠巾',
  armor: '衣甲',
  wrist: '护腕',
  waist: '腰佩',
  boots: '履靴',
  token: '信物',
}

const equipmentStatNames: Record<string, string> = {
  attack: '外功 / 内功',
  externalAttack: '外功',
  internalAttack: '内功',
  maxHp: '气血',
  externalDefense: '外防',
  internalDefense: '内防',
  agility: '身法',
  effectiveAgility: '有效身法',
  accuracy: '命中修正',
  energyRecovery: '真气回复',
  cooldownRate: '冷却缩减',
  criticalChance: '暴击',
  controlResistance: '控制抗性',
}

const percentEquipmentStats = new Set(['accuracy', 'cooldownRate', 'criticalChance', 'controlResistance'])

const heroEquipmentView = (item: EquipmentInstance): HeroesEquipmentView => {
  const definition = equipmentDefinitionById(item.definitionId)
  const ownerId = equipmentOwnerId(session.state, item.uid)
  const ownerDefinition = ownerId ? heroByIdV10(ownerId) : undefined
  const ownerProgress = ownerId ? session.state.heroes[ownerId] : undefined
  const slot = definition?.slot ?? 'weapon'
  const baseStatId = definition?.baseStatId ?? 'attack'
  return {
    uid: item.uid,
    definitionId: item.definitionId,
    name: definition?.name ?? item.definitionId,
    slot,
    slotName: equipmentSlotNames[slot],
    level: item.level,
    quality: item.quality,
    locked: item.locked,
    equippedByHeroId: ownerId,
    equippedByHeroName: ownerDefinition && ownerProgress ? heroDisplayNameV10(ownerDefinition, ownerProgress) : null,
    baseStat: {
      name: equipmentStatNames[baseStatId] ?? baseStatId,
      value: definition ? equipmentBaseStatValue(definition, item) : 0,
      percent: percentEquipmentStats.has(baseStatId),
    },
    affixes: item.affixes.map((affix) => ({
      name: EQUIPMENT_AFFIXES.find((definitionAffix) => definitionAffix.id === affix.id)?.name
        ?? equipmentStatNames[affix.id]
        ?? affix.id,
      value: affix.value,
      percent: percentEquipmentStats.has(affix.id),
    })),
  }
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
  const allEquipmentItems = session.state.inventory.map(heroEquipmentView)
  const inventoryItems = allEquipmentItems.filter((item) => !item.equippedByHeroId)

  const buildCareerPath = (currentCareerId: string): Array<{ name: string; state: 'done' | 'current' | 'future'; tier?: string }> => {
    const current = careerById(currentCareerId)
    if (!current) return []
    const base = CAREERS.find((career) => career.category === current.category && career.branch === null)
    const branchName = current.branch ?? CAREERS.find((career) => career.category === current.category && career.branch !== null)?.branch
    const tierOrder: Record<string, number> = { 初级: 0, 中级: 1, 高级: 2, 顶级: 3 }
    const branch = CAREERS
      .filter((career) => career.category === current.category && career.branch === branchName)
      .sort((left, right) => tierOrder[left.tier] - tierOrder[right.tier])
    const path = base ? [base, ...branch] : [current, ...branch.filter((career) => career.id !== current.id)]
    const currentIndex = Math.max(0, path.findIndex((career) => career.id === current.id))
    return path.map((career, index) => ({
      name: career.name,
      tier: career.tier,
      state: career.id === current.id ? 'current' : index < currentIndex ? 'done' : 'future',
    }))
  }

  const buildHero = ({ definition, progress, name }: ReturnType<typeof recruitedHeroes>[number]): HeroesHeroView => {
    const career = careerById(progress.currentCareerId) ?? careerById(definition.baseCareerId)
    const record = progress.careers[progress.currentCareerId]
    const heroCompatibleCareers = career
      ? CAREERS.filter((item) => item.category === career.category && item.id !== career.id)
      : []
    const category = career?.category ?? '剑'
    const source = definition.source === 'starter'
      ? '本队主角'
      : definition.source === 'tavern'
        ? '酒馆相逢'
        : `${FACTIONS.find((faction) => faction.id === definition.factionId)?.name ?? '势力'}门人`
    return {
      id: definition.id,
      name,
      grade: definition.source === 'starter' ? '主' : definition.grade,
      recruited: progress.recruited,
      level: progress.level,
      careerId: progress.currentCareerId,
      careerName: career?.name ?? progress.currentCareerId,
      careerLevel: record?.level ?? 1,
      careerPerfected: record?.perfected ?? false,
      availableCareerIds: heroCompatibleCareers.map((item) => item.id),
      aptitudes: definition.aptitudes,
      combatStats: buildCombatStats(definition, progress, session.state.inventory),
      equipmentSlots: EQUIPMENT_SLOTS.map((slot) => ({
        id: slot,
        name: equipmentSlotNames[slot],
        equipment: allEquipmentItems.find((item) => item.uid === progress.equipmentBySlot[slot]) ?? null,
      })),
      learnedMartials: Object.entries(progress.learnedMartials).map(([id, learnedRecord]) => {
        const martial = martialByIdV10(id)
        return { id, name: martial?.name ?? id, rarity: martial?.rarity ?? '粗浅', level: learnedRecord.level }
      }),
      equippedMartialIds: progress.equippedMartialIds,
      heartMethodId: progress.heartMethodId,
      category,
      source,
      inFormation: session.state.formation.some((slot) => slot.heroId === definition.id),
      careerPath: buildCareerPath(progress.currentCareerId),
    }
  }

  const heroes = recruitedHeroes().map(buildHero)
  const query = heroRosterQuery.trim().toLocaleLowerCase()
  const rosterHeroes = heroes.filter((hero) =>
    (!query || hero.name.toLocaleLowerCase().includes(query))
    && (heroRosterGradeFilter === 'all' || hero.grade === heroRosterGradeFilter)
    && (heroRosterCategoryFilter === 'all' || hero.category === heroRosterCategoryFilter))

  return {
    selectedHeroId: selectedId,
    heroes,
    rosterHeroes,
    rosterQuery: heroRosterQuery,
    rosterGradeFilter: heroRosterGradeFilter,
    rosterCategoryFilter: heroRosterCategoryFilter,
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
    inventoryItems,
    inventoryCapacity: INVENTORY_CAPACITY,
    inventorySlotFilter: heroInventorySlotFilter,
    inventoryQualityFilter: heroInventoryQualityFilter,
    inventoryPage: heroInventoryPage,
    batchDiscardQuality: heroBatchDiscardQuality,
    batchDiscardConfirm: showBatchDiscardConfirm,
  }
}

const formationCareerPath = (currentCareerId: string): FormationPageViewModel['heroes'][number]['careerPath'] => {
  const current = careerById(currentCareerId)
  if (!current) return []
  const base = CAREERS.find((career) => career.category === current.category && career.branch === null)
  const branchName = current.branch ?? CAREERS.find((career) => career.category === current.category && career.branch !== null)?.branch
  const tierOrder: Record<string, number> = { 初级: 0, 中级: 1, 高级: 2, 顶级: 3 }
  const branch = CAREERS
    .filter((career) => career.category === current.category && career.branch === branchName)
    .sort((left, right) => tierOrder[left.tier] - tierOrder[right.tier])
  const path = base ? [base, ...branch] : [current, ...branch.filter((career) => career.id !== current.id)]
  const currentIndex = Math.max(0, path.findIndex((career) => career.id === current.id))
  return path.map((career, index) => ({
    name: career.name,
    state: career.id === current.id ? 'current' : index < currentIndex ? 'done' : 'future',
  }))
}

const formationSourceLabel = (definition: (typeof HEROES_V10)[number]): string => {
  if (definition.source === 'starter') return '本队主角'
  if (definition.source === 'tavern') return '酒馆相逢'
  return `${FACTIONS.find((faction) => faction.id === definition.factionId)?.name ?? '势力'}门人`
}

const formationViewModel = (): FormationPageViewModel => {
  const heroes = recruitedHeroes().map(({ definition, progress, name }) => {
    const currentCareer = careerById(progress.currentCareerId) ?? careerById(definition.baseCareerId)
    const careerRecord = progress.careers[progress.currentCareerId]
    const combatStats = buildCombatStats(definition, progress, session.state.inventory)
    return {
      id: definition.id,
      name,
      grade: definition.grade,
      level: progress.level,
      inFormation: session.state.formation.some((slot) => slot.heroId === definition.id),
      category: currentCareer?.category ?? '剑',
      source: formationSourceLabel(definition),
      careerName: currentCareer?.name ?? progress.currentCareerId,
      careerLevel: careerRecord?.level ?? 1,
      careerPath: formationCareerPath(progress.currentCareerId),
      aptitudes: definition.aptitudes,
      combatStats: {
        maxHp: combatStats.maxHp,
        externalAttack: combatStats.externalAttack,
        internalAttack: combatStats.internalAttack,
        externalDefense: combatStats.externalDefense,
        internalDefense: combatStats.internalDefense,
        effectiveAgility: combatStats.effectiveAgility,
      },
      equippedMartials: progress.equippedMartialIds.map((martialId) => {
        if (!martialId) return null
        const martial = martialByIdV10(martialId)
        return martial
          ? { name: martial.name, rarity: martial.rarity, level: progress.learnedMartials[martialId]?.level ?? 1 }
          : null
      }),
      heartMethodName: progress.heartMethodId ? heartMethodByIdV10(progress.heartMethodId)?.name ?? null : null,
      slot: session.state.formation.find((slot) => slot.heroId === definition.id) ?? null,
    }
  })
  const selectedHeroId = heroes.some((hero) => hero.id === formationDetailHeroId)
    ? formationDetailHeroId
    : session.state.formation[0]?.heroId ?? heroes[0]?.id ?? null
  formationDetailHeroId = selectedHeroId
  return { formation: session.state.formation, selectedHeroId, filter: formationFilter, heroes }
}

const formationFilterOptions: FormationFilter[] = ['all', '剑', '刀', '拳', '暗', '医', '内家']

const formationHeroCategory = (heroId: string): FormationFilter | null => {
  const definition = heroByIdV10(heroId)
  const progress = session.state.heroes[heroId]
  if (!definition || !progress) return null
  return careerById(progress.currentCareerId)?.category ?? careerById(definition.baseCareerId)?.category ?? null
}

const autoArrangeFormation = (): ActionResult => {
  const placedIds = session.state.formation
    .map((slot) => slot.heroId)
    .filter((heroId, index, ids) => ids.indexOf(heroId) === index)
  if (!placedIds.length) return { ok: false, message: '阵中无人 · 先从名册点将' }

  const originalOrder = new Map(placedIds.map((heroId, index) => [heroId, index]))
  const constitutionOf = (heroId: string): number => heroByIdV10(heroId)?.aptitudes.constitution ?? 0
  const levelOf = (heroId: string): number => session.state.heroes[heroId]?.level ?? 0
  const stableCompare = (left: string, right: string, value: (heroId: string) => number): number =>
    value(right) - value(left) || (originalOrder.get(left) ?? 0) - (originalOrder.get(right) ?? 0)

  const frontPreferred = placedIds
    .filter((heroId) => {
      const category = formationHeroCategory(heroId)
      return category === '拳' || category === '内家'
    })
    .sort((left, right) => stableCompare(left, right, constitutionOf))
  const others = placedIds
    .filter((heroId) => !frontPreferred.includes(heroId))
    .sort((left, right) => stableCompare(left, right, levelOf))
  const front = frontPreferred.slice(0, 3)
  const pool = [...frontPreferred.slice(3), ...others]
  while (front.length < 3 && pool.length) front.push(pool.shift()!)
  const back = pool.slice(0, 3)

  session.state.formation = [
    ...front.map((heroId, position) => ({ heroId, row: 'front' as const, position: position as FormationPosition })),
    ...back.map((heroId, position) => ({ heroId, row: 'back' as const, position: position as FormationPosition })),
  ]
  return { ok: true, message: '自动列阵毕 · 拳内居前承伤' }
}

const clearFormation = (): ActionResult => {
  if (!session.state.formation.length) return { ok: false, message: '阵中本就无人' }
  session.state.formation = []
  return { ok: true, message: '已悉数下阵' }
}

const factionsViewModel = (): FactionsPageViewModel => {
  const world = WORLDS.find((item) => item.id === selectedWorldId) ?? WORLDS[0]
  const availableFactions = FACTIONS.filter((faction) =>
    faction.worldId === selectedWorldId
    && session.state.unlockedWorldIds.includes(faction.worldId))
  if (!availableFactions.some((faction) => faction.id === selectedFactionId)) selectedFactionId = availableFactions[0]?.id ?? ''
  const faction = availableFactions.find((item) => item.id === selectedFactionId) ?? availableFactions[0]
  const board = session.state.factionBoards[selectedFactionId]
  const normalizedHeroId = normalizeSelectedHero()
  const heroProgress = normalizedHeroId ? session.state.heroes[normalizedHeroId] : undefined
  const factionMartials = FACTION_MARTIALS.filter((martial) => martial.factionId === selectedFactionId)
  const factionHeroes = FACTION_HEROES.filter((hero) => hero.factionId === selectedFactionId)
  if (!factionMartials.some((martial) => martial.id === selectedFactionMartialId)) {
    selectedFactionMartialId = factionMartials[0]?.id ?? null
  }

  const contribution = session.state.contribution[selectedFactionId] ?? 0
  const martialViews = factionMartials.map((martial) => {
    const learnedRecord = heroProgress?.learnedMartials[martial.id]
    const learned = Boolean(learnedRecord)
    const level = learnedRecord?.level ?? 0
    const previous = martial.previousId ? martialByIdV10(martial.previousId) : undefined
    const previousReady = !martial.previousId
      || heroProgress?.learnedMartials[martial.previousId]?.level === MAX_MARTIAL_LEVEL
    const state: FactionMartialState = learned ? 'learned' : previousReady ? 'next' : 'locked'
    const actionCost = learned
      ? Math.ceil(martial.currencySource.amount * (1 + level * 0.2))
      : martial.currencySource.amount
    const careerCompatible = Boolean(heroProgress && martial.careerIds.includes(heroProgress.currentCareerId))
    let actionReason: string | null = null
    if (!normalizedHeroId) actionReason = '请先选择研习对象'
    else if (learned && level >= MAX_MARTIAL_LEVEL) actionReason = '已臻化境'
    else if (!learned && !previousReady) actionReason = '前穴未满 · Lv.20'
    else if (!careerCompatible) actionReason = '职不符 · 不可传'
    else if (Object.keys(heroProgress?.learnedMartials ?? {}).length >= 20 && !learned) actionReason = '已满 20 门'
    else if (contribution < actionCost) actionReason = '贡献不足'

    return withLore({
      id: martial.id,
      name: martial.name,
      stage: martial.stage,
      rarity: martial.rarity,
      cost: martial.currencySource.amount,
      upgradeCost: actionCost,
      learned,
      level,
      state,
      energyCost: martial.energyCost,
      cooldownMs: martial.cooldownMs,
      power: martial.power,
      previousName: previous?.name ?? null,
      careerNames: [...new Set(martial.careerIds.map((careerId) => careerById(careerId)?.name ?? careerId))],
      careerCompatible,
      affordable: contribution >= actionCost,
      actionDisabled: actionReason !== null,
      actionReason,
      selected: martial.id === selectedFactionMartialId,
    }, MARTIAL_LORE[martial.id])
  })
  const selectedMartial = martialViews.find((martial) => martial.id === selectedFactionMartialId) ?? null
  const recruited = recruitedHeroes()
  const careerCategoryOf = (heroId: string): string => {
    const progress = session.state.heroes[heroId]
    return careerById(progress?.currentCareerId ?? '')?.category ?? '未知'
  }
  const rosterQuery = factionRosterQuery.trim()
  const roster = recruited
    .filter(({ name }) => !rosterQuery || name.includes(rosterQuery))
    .map(({ definition, name }) => {
      const category = careerCategoryOf(definition.id)
      const heroFaction = definition.factionId ? FACTIONS.find((item) => item.id === definition.factionId) : undefined
      return {
        id: definition.id,
        name,
        grade: definition.source === 'starter' ? '主' : definition.grade,
        category,
        factionName: heroFaction?.name ?? '江湖散人',
        compatible: Boolean(faction && category === faction.category),
        selected: definition.id === normalizedHeroId,
        isPlayer: definition.source === 'starter',
      }
    })
  const selectedHero = roster.find((hero) => hero.id === normalizedHeroId) ?? null
  return {
    worldIndex: world.index,
    worldName: world.name,
    selectedFactionId,
    factions: availableFactions.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      branchNames: [item.branchLabels[0], item.branchLabels[1]],
      contribution: session.state.contribution[item.id] ?? 0,
      selected: item.id === selectedFactionId,
    })),
    refreshRemainingMs: board?.refreshRemainingMs ?? 0,
    quests: Array.from({ length: 6 }, (_, slot) => {
      const quest = board?.slots[slot]
      return { slot, quest: quest ? { ...quest, targetName: enemyDisplayName(quest.targetId) } : null }
    }),
    branches: (faction?.branchLabels ?? []).map((branch) => ({
      name: branch,
      martials: martialViews.filter((martial) => factionMartials.find((definition) => definition.id === martial.id)?.branch === branch),
    })),
    factionHeroes: factionHeroes.map((factionHero) => ({
      id: factionHero.id,
      name: factionHero.name,
      grade: factionHero.grade,
      cost: factionHero.cost,
      recruited: Boolean(session.state.heroes[factionHero.id]?.recruited),
    })),
    selectedHeroId: normalizedHeroId,
    selectedHero,
    roster,
    rosterCount: roster.length,
    rosterOpen: factionRosterOpen,
    rosterQuery: factionRosterQuery,
    selectedMartialId: selectedFactionMartialId,
    selectedMartial,
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
  const cityMartials = CITY_MARTIALS.filter((martial) => martial.worldId === world.id)
  if (!cityMartials.some((martial) => martial.id === selectedCityMartialId)) {
    selectedCityMartialId = cityMartials[0]?.id ?? null
  }
  const recruited = recruitedHeroes()
  const martials = cityMartials.map((martial) => ({
    id: martial.id,
    name: martial.name,
    rarity: martial.rarity,
    category: martial.category as string,
    cost: martial.currencySource.amount,
    energyCost: martial.energyCost,
    cooldownMs: martial.cooldownMs,
    power: martial.power,
    learned: Boolean(selectedProgress?.learnedMartials[martial.id]),
    compatible: selectedProgress ? martial.careerIds.includes(selectedProgress.currentCareerId) : false,
    selected: martial.id === selectedCityMartialId,
  }))
  return {
    worldId: world.id,
    worldIndex,
    worldName: world.name,
    worldCurrency: session.state.worldCurrency[world.id] ?? 0,
    selectedHeroId: selectedId,
    selectedHeroName: recruited.find((hero) => hero.definition.id === selectedId)?.name ?? null,
    heroes: recruited.map(({ definition, name }) => ({ id: definition.id, name })),
    tavernHeroes: TAVERN_HEROES.filter((hero) => hero.worldId === world.id).map((hero) => {
      const baseCareer = careerById(hero.baseCareerId)
      return {
        id: hero.id,
        name: hero.name,
        grade: hero.grade,
        category: baseCareer?.category ?? '剑',
        careerName: baseCareer?.name ?? '侠客',
        cost: hero.cost,
        recruited: Boolean(session.state.heroes[hero.id]?.recruited),
        line: hero.line ?? null,
      }
    }),
    martials,
    fitCount: martials.filter((martial) => martial.compatible).length,
    careerTokens: CAREERS.filter((career) => career.previousId && tierAvailable(career.tier) && (!selectedCareer || career.category === selectedCareer.category)).map((career) => ({
      id: `token_${career.id}`,
      name: `${career.name}信物`,
      tier: career.tier,
      category: career.category as string,
      cost: tokenCost(career.tier),
      owned: session.state.careerTokens.includes(`token_${career.id}`),
    })),
    lockedTiers: (['高级', '顶级'] as const)
      .filter((tier) => !tierAvailable(tier))
      .map((tier) => ({ tier, cost: tokenCost(tier), minWorld: tier === '高级' ? 4 : 7 })),
  }
}

const inventorySlotNames: Record<EquipmentSlot, string> = {
  weapon: '兵刃',
  head: '冠巾',
  armor: '衣甲',
  wrist: '护腕',
  waist: '腰佩',
  boots: '履靴',
  token: '信物',
}

const inventoryBaseStatNames: Record<string, string> = {
  attack: '攻击',
  internalDefense: '内防',
  externalDefense: '外防',
  accuracy: '命中',
  maxHp: '气血',
  agility: '身法',
  energyRecovery: '行气',
}

const inventoryItemView = (item: EquipmentInstance): InventoryItemView => {
  const definition = equipmentDefinitionById(item.definitionId)
  const slot = definition?.slot ?? 'weapon'
  return {
    uid: item.uid,
    name: definition?.name ?? '无名装备',
    slot,
    slotName: inventorySlotNames[slot],
    level: item.level,
    quality: item.quality,
    locked: item.locked,
    baseStat: {
      name: inventoryBaseStatNames[definition?.baseStatId ?? ''] ?? '基础属性',
      value: definition ? equipmentBaseStatValue(definition, item) : item.level,
    },
    affixes: item.affixes.map((affix) => {
      const definitionAffix = EQUIPMENT_AFFIXES.find((candidate) => candidate.id === affix.id)
      const range = definitionAffix
        ? equipmentAffixRange(definitionAffix, item.level)
        : { min: affix.value, max: affix.value + 1 }
      const ratio = range.max > range.min
        ? Math.min(100, Math.max(0, Math.round((affix.value - range.min) / (range.max - range.min) * 100)))
        : 100
      return {
        name: definitionAffix?.name ?? '词缀',
        value: affix.value,
        min: range.min,
        max: range.max,
        ratio,
      }
    }),
  }
}

const inventoryViewModel = (): InventoryPageViewModel => {
  const allItems = backpackEquipment(session.state).map(inventoryItemView)
  const selectedItem = allItems.find((item) => item.uid === selectedInventoryUid) ?? allItems[0] ?? null
  if (selectedItem && selectedInventoryUid !== selectedItem.uid) selectedInventoryUid = selectedItem.uid
  if (!selectedItem) selectedInventoryUid = null
  const visibleItems = inventorySlotFilter === 'all'
    ? allItems
    : allItems.filter((item) => item.slot === inventorySlotFilter)
  const slotTabs = [
    { id: 'all' as const, name: '全部', count: allItems.length },
    ...EQUIPMENT_SLOTS.map((slot) => ({ id: slot, name: inventorySlotNames[slot], count: allItems.filter((item) => item.slot === slot).length })),
  ]
  const qualityCounts = EQUIPMENT_QUALITIES.reduce((counts, quality) => {
    counts[quality] = allItems.filter((item) => item.quality === quality).length
    return counts
  }, {} as Record<EquipmentQuality, number>)
  const world = WORLDS.find((item) => item.id === selectedWorldId) ?? WORLDS[0]
  return {
    worldName: world.name,
    capacity: INVENTORY_CAPACITY,
    itemCount: allItems.length,
    capacityRatio: Math.max(2, Math.min(100, allItems.length / INVENTORY_CAPACITY * 100)),
    qualityCounts,
    slotFilter: inventorySlotFilter,
    slotTabs,
    selectedUid: selectedInventoryUid,
    detailOpen: inventoryDetailOpen,
    items: visibleItems,
    selectedItem,
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

const playPendingJianghuMotion = (): void => {
  if (!jianghuMotionPending) return
  const page = app.querySelector<HTMLElement>('.jianghu-page')
  if (!page) return
  page.classList.remove('is-entering')
  void page.offsetWidth
  page.classList.add('is-entering')
  const animatedPage = page
  const cardCount = page.querySelectorAll('.world-card').length
  const motionDuration = cardCount > 0 ? 650 + Math.max(0, cardCount - 1) * 45 : 1100
  window.setTimeout(() => animatedPage.classList.remove('is-entering'), motionDuration)
  jianghuMotionPending = null
}

const render = (): void => {
  if (appScreen !== 'playing') {
    toast.classList.remove('inventory-toast')
    patchApp(renderStartPage({
      screen: appScreen,
      hasSave,
      playerName: startPlayerName,
      error: startError,
      confirmOverwrite,
      busy: startBusy,
    }))
    positionOpenEquipmentTooltip()
    syncInventoryDetailScrollLock()
    return
  }
  normalizeSelectedWorld()
  const shouldPlayFactionSwitch = factionSwitchAnimationPending
    && activeTab === 'idle'
    && jianghuView === 'world'
    && jianghuSection === 'factions'
  const world = WORLDS.find((item) => item.id === selectedWorldId) ?? WORLDS[0]
  const content = activeTab === 'idle'
    ? renderJianghuContent()
    : activeTab === 'heroes'
      ? renderHeroesPage(heroesViewModel())
      : activeTab === 'formation'
        ? renderFormationPage(formationViewModel())
        : renderInventoryPage(inventoryViewModel())
  patchApp(renderShell({
    activeTab,
    worldContext: activeTab === 'idle' && jianghuView !== 'worlds'
      ? { worldName: world.name, activeSection: jianghuSection }
      : null,
    hasCombatReturn: Boolean(session.combat && !(activeTab === 'idle' && jianghuView === 'combat')),
    showResetConfirmation,
    jianghuChrome: activeTab === 'idle' && jianghuView !== 'combat',
    content,
  }))
  if (activeTab === 'idle' && jianghuView !== 'combat') playPendingJianghuMotion()
  if (heroRosterLocatePending && activeTab === 'heroes') {
    heroRosterLocatePending = false
    window.requestAnimationFrame(() => {
      const heroRow = selectedHeroId
        ? app.querySelector<HTMLElement>(`[data-testid="hero-${selectedHeroId}"]`)
        : null
      heroRow?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      heroRow?.animate([
        { filter: 'brightness(1.8)', transform: 'translateX(4px)' },
        { filter: 'brightness(1)', transform: 'translateX(0)' },
      ], { duration: 650, easing: 'cubic-bezier(.22, 1, .36, 1)' })
    })
  }
  if (shouldPlayFactionSwitch) {
    factionSwitchAnimationPending = false
    playFactionSwitchMotion()
  }
  updateFactionContributionAnimation()
  positionOpenEquipmentTooltip()
  toast.classList.toggle('inventory-toast', activeTab === 'inventory')
  syncInventoryDetailScrollLock()
  playInventoryDropMotion()
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

const startSelectedStage = (mode: 'guard' | 'roam', seed = Date.now()): void => {
  const result = session.startStage({ worldId: selectedWorldId, stage: selectedStage, mode, seed })
  notify(result.message, !result.ok)
  if (result.ok) {
    beginCombatPresentation()
    jianghuView = 'combat'
    jianghuSection = 'stages'
  }
  render()
}

const dataNumber = (button: HTMLElement, key: string): number => Number(button.dataset[key])

const formatFactionContribution = (value: number): string => Math.max(0, Math.round(value)).toLocaleString('zh-CN')

const readFactionContribution = (): number | null => {
  const node = app.querySelector<HTMLElement>('[data-testid="faction-purse"] strong')
  if (!node) return null
  const value = Number(node.textContent?.replace(/[^\d.-]/g, '') ?? '')
  return Number.isFinite(value) ? value : null
}

const scheduleFactionContributionFrame = (): void => {
  const animation = factionContributionAnimation
  if (!animation || animation.framePending) return
  animation.framePending = true
  window.requestAnimationFrame(() => {
    const current = factionContributionAnimation
    if (!current) return
    current.framePending = false
    updateFactionContributionAnimation()
  })
}

const updateFactionContributionAnimation = (): void => {
  const animation = factionContributionAnimation
  const node = app.querySelector<HTMLElement>('[data-testid="faction-purse"] strong')
  if (!animation || !node) {
    factionContributionAnimation = null
    return
  }
  const progress = Math.min(1, (performance.now() - animation.startedAt) / 600)
  const eased = 1 - Math.pow(1 - progress, 3)
  node.textContent = formatFactionContribution(animation.from + (animation.to - animation.from) * eased)
  if (progress >= 1) {
    node.textContent = formatFactionContribution(animation.to)
    factionContributionAnimation = null
    return
  }
  scheduleFactionContributionFrame()
}

const startFactionContributionAnimation = (to: number): void => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    factionContributionAnimation = null
    return
  }
  const from = readFactionContribution() ?? session.state.contribution[selectedFactionId] ?? to
  if (from === to) {
    factionContributionAnimation = null
    return
  }
  factionContributionAnimation = { from, to, startedAt: performance.now(), framePending: false }
}

const playFactionSwitchMotion = (): void => {
  const page = app.querySelector<HTMLElement>('[data-testid="factions-page"].faction-page')
  if (!page || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (factionMotionTimer !== null) window.clearTimeout(factionMotionTimer)

  const purse = page.querySelector<HTMLElement>('[data-testid="faction-purse"]')
  if (purse) {
    purse.getAnimations().forEach((animation) => animation.cancel())
    const animation = purse.animate([
      { opacity: 0.58, transform: 'translateY(-5px) scale(.98)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], {
      duration: 500,
      easing: 'cubic-bezier(.22, 1, .36, 1)',
      fill: 'both',
    })
    animation.onfinish = () => animation.cancel()
  }

  const cards = [...page.querySelectorAll<HTMLElement>('.faction-notice')]
  cards.forEach((card, index) => {
    card.getAnimations().forEach((animation) => animation.cancel())
    const rotation = getComputedStyle(card).getPropertyValue('--faction-rotation').trim() || '0deg'
    const animation = card.animate([
      { opacity: 0, transform: `rotate(${rotation}) translateY(14px)` },
      { opacity: 1, transform: `rotate(${rotation}) translateY(-2px)`, offset: 0.72 },
      { opacity: 1, transform: `rotate(${rotation}) translateY(0)` },
    ], {
      duration: 600,
      delay: index * 70,
      easing: 'cubic-bezier(.77, 0, .175, 1)',
      fill: 'both',
    })
    animation.onfinish = () => animation.cancel()
  })

  factionMotionTimer = window.setTimeout(() => {
    factionMotionTimer = null
  }, 1_100)
}

const queueInventoryDropAnimations = (uids: string[]): void => {
  pendingInventoryDropUids = [...new Set([...pendingInventoryDropUids, ...uids])].slice(-24)
}

const syncInventoryDetailScrollLock = (): void => {
  const mobile = typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 980px)').matches
  document.body.style.overflow = activeTab === 'inventory' && inventoryDetailOpen && mobile ? 'hidden' : ''
}

const playInventoryDropMotion = (): void => {
  if (activeTab !== 'inventory' || pendingInventoryDropUids.length === 0) return
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    pendingInventoryDropUids = []
    return
  }

  const cells = [...app.querySelectorAll<HTMLElement>('[data-action="inventory-select"][data-equipment-uid]')]
  const targets = pendingInventoryDropUids
    .map((uid) => cells.find((cell) => cell.dataset.equipmentUid === uid))
    .filter((cell): cell is HTMLElement => Boolean(cell))
  if (targets.length === 0) return
  const targetIds = new Set(targets.map((target) => target.dataset.equipmentUid))
  pendingInventoryDropUids = pendingInventoryDropUids.filter((uid) => !targetIds.has(uid))

  targets.forEach((target, index) => {
    target.getAnimations().forEach((animation) => animation.cancel())
    const color = getComputedStyle(target).getPropertyValue('--rarity').trim() || '#c9a35c'
    const animation = target.animate([
      {
        opacity: 0,
        filter: 'blur(4px)',
        transform: 'translateY(-28px) scale(.72) rotate(-6deg)',
        boxShadow: `0 0 0 0 transparent`,
      },
      {
        opacity: 1,
        filter: 'blur(0)',
        transform: 'translateY(7px) scale(1.08) rotate(2deg)',
        boxShadow: `0 0 0 4px ${color}, 0 0 28px ${color}`,
        offset: .58,
      },
      {
        opacity: 1,
        filter: 'blur(0)',
        transform: 'translateY(0) scale(1) rotate(0)',
        boxShadow: `0 0 0 1px ${color}, 0 10px 22px rgb(0 0 0 / 38%)`,
      },
    ], {
      duration: 760,
      delay: index * 90,
      easing: 'cubic-bezier(.22, 1, .36, 1)',
      fill: 'both',
    })
    animation.onfinish = () => animation.cancel()
  })
}

window.addEventListener('resize', syncInventoryDetailScrollLock)

const clearDragOver = (): void => {
  app.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'))
}

app.addEventListener('pointerover', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const anchor = target.closest<HTMLElement>(EQUIPMENT_TOOLTIP_ANCHOR)
  if (anchor) showEquipmentTooltip(anchor)
})

app.addEventListener('pointerout', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const anchor = target.closest<HTMLElement>(EQUIPMENT_TOOLTIP_ANCHOR)
  if (!anchor || anchor !== openEquipmentTooltipAnchor) return
  if (event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget)) return
  hideEquipmentTooltip()
})

app.addEventListener('scroll', positionOpenEquipmentTooltip, true)
window.addEventListener('resize', positionOpenEquipmentTooltip)

// 属性释义浮动卡片：hover 属性 chip / 雷达轴时显示
app.addEventListener('pointerover', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const chip = target.closest<HTMLElement>('.st-chip[data-stat-label]')
  if (chip) {
    const label = chip.dataset.statLabel ?? ''
    const desc = STAT_DESC[label]
    if (desc) showStatTooltip(chip, label, desc)
    return
  }
  const apt = target.closest<HTMLElement>('[data-apt-label]')
  if (apt) {
    const label = apt.dataset.aptLabel ?? ''
    const desc = APT_DESC[label]
    if (desc) showStatTooltip(apt, label, desc)
  }
})

app.addEventListener('pointerout', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const anchor = target.closest<HTMLElement>('.st-chip[data-stat-label], [data-apt-label]')
  if (!anchor || anchor !== statTooltipAnchor) return
  if (event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget)) return
  hideStatTooltip()
})

app.addEventListener('scroll', hideStatTooltip, true)
window.addEventListener('resize', () => {
  if (statTooltip?.matches(':popover-open')) positionStatTooltip()
})

app.addEventListener('pointerdown', (event) => {
  const target = event.target as HTMLElement
  dragCandidateHeroId = target.closest<HTMLElement>('.formation-roster-row')?.dataset.heroId ?? null
})

app.addEventListener('dragstart', (event) => {
  const source = (event.target as HTMLElement).closest<HTMLElement>('[data-hero-id]')
  if (!source) return
  dragHeroId = dragCandidateHeroId ?? source.dataset.heroId ?? null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    if (dragHeroId) event.dataTransfer.setData('text/plain', dragHeroId)
  }
})

app.addEventListener('dragover', (event) => {
  const target = event.target as HTMLElement
  const transferHeroId = dragHeroId ?? event.dataTransfer?.getData('text/plain') ?? null
  if (!transferHeroId || !target.closest('[data-testid="formation-page"]')) return
  dragHeroId = transferHeroId
  const slot = target.closest<HTMLElement>('.formation-slot')
  const roster = target.closest<HTMLElement>('.formation-roster')
  if (slot || roster) {
    event.preventDefault()
    clearDragOver()
    ;(slot ?? roster)!.classList.add('drag-over')
  }
})

app.addEventListener('drop', (event) => {
  const droppedHeroId = dragHeroId ?? event.dataTransfer?.getData('text/plain') ?? null
  if (!droppedHeroId) return
  const target = event.target as HTMLElement
  const slot = target.closest<HTMLElement>('.formation-slot')
  if (slot) {
    event.preventDefault()
    const row = slot.dataset.row as FormationRow
    const position = dataNumber(slot, 'position') as FormationPosition
    commitAction(placeFormation(session.state, droppedHeroId, row, position))
  } else if (target.closest('.formation-roster')) {
    event.preventDefault()
    commitAction(removeFormation(session.state, droppedHeroId))
  }
  dragHeroId = null
  dragCandidateHeroId = null
  clearDragOver()
  render()
})

app.addEventListener('dragend', () => {
  dragHeroId = null
  dragCandidateHeroId = null
  clearDragOver()
})

const performAction = (button: HTMLButtonElement): void => {
  const action = button.dataset.action
  const heroId = button.dataset.heroId ?? selectedHeroId ?? ''
  if (action === 'formation-remove') commitAction(removeFormation(session.state, heroId))
  else if (action === 'formation-select') {
    formationDetailHeroId = heroId
    formationSelectedHeroId = heroId
  } else if (action === 'formation-filter') {
    const nextFilter = button.dataset.filter as FormationFilter
    if (formationFilterOptions.includes(nextFilter)) formationFilter = nextFilter
  } else if (action === 'formation-auto-arrange') {
    formationSelectedHeroId = null
    commitAction(autoArrangeFormation())
  } else if (action === 'formation-clear') {
    formationSelectedHeroId = null
    commitAction(clearFormation())
  } else if (action === 'formation-slot-tap') {
    const slotHeroId = button.dataset.heroId ?? null
    if (formationSelectedHeroId) {
      commitAction(placeFormation(session.state, formationSelectedHeroId, button.dataset.row as FormationRow, dataNumber(button, 'position') as FormationPosition))
      formationDetailHeroId = formationSelectedHeroId
      formationSelectedHeroId = null
    } else if (slotHeroId) {
      formationDetailHeroId = slotHeroId
    }
  }
  else if (action === 'career-change') commitAction(changeCareer(session.state.heroes[heroId], button.dataset.careerId ?? '', session.state.careerTokens))
  else if (action === 'career-perfect') commitAction(perfectCareer(session.state.heroes[heroId], button.dataset.careerId ?? ''))
  else if (action === 'career-buy-token') commitAction(buyCareerToken(session.state, button.dataset.worldId ?? selectedWorldId, button.dataset.tokenId ?? ''))
  else if (action === 'martial-learn') commitAction(learnFactionMartial(session.state, heroId, button.dataset.martialId ?? ''))
  else if (action === 'martial-upgrade') commitAction(upgradeMartial(session.state, heroId, button.dataset.martialId ?? ''))
  else if (action === 'martial-equip') commitAction(equipMartial(session.state, heroId, button.dataset.martialId ?? '', dataNumber(button, 'slot')))
  else if (action === 'martial-unequip') commitAction(unequipMartial(session.state, heroId, dataNumber(button, 'slot')))
  else if (action === 'martial-forget') commitAction(forgetMartial(session.state, heroId, button.dataset.martialId ?? ''))
  else if (action === 'toggle-faction-roster') {
    factionRosterOpen = !factionRosterOpen
    if (!factionRosterOpen) factionRosterQuery = ''
  } else if (action === 'select-faction-hero') {
    selectedHeroId = button.dataset.heroId ?? selectedHeroId
    factionRosterOpen = false
    factionRosterQuery = ''
  } else if (action === 'select-martial') selectedFactionMartialId = button.dataset.martialId ?? selectedFactionMartialId
  else if (action === 'select-city-martial') selectedCityMartialId = button.dataset.martialId ?? selectedCityMartialId
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
  else if (action === 'inventory-select') {
    selectedInventoryUid = button.dataset.equipmentUid ?? null
    inventoryDetailOpen = true
  } else if (action === 'inventory-close-detail') {
    inventoryDetailOpen = false
  } else if (action === 'inventory-filter') {
    const nextFilter = button.dataset.inventorySlot ?? 'all'
    inventorySlotFilter = nextFilter === 'all' || EQUIPMENT_SLOTS.includes(nextFilter as EquipmentSlot)
      ? nextFilter as EquipmentSlot | 'all'
      : 'all'
    const visibleItems = backpackEquipment(session.state).filter((item) =>
      inventorySlotFilter === 'all' || equipmentDefinitionById(item.definitionId)?.slot === inventorySlotFilter)
    if (!visibleItems.some((item) => item.uid === selectedInventoryUid)) selectedInventoryUid = visibleItems[0]?.uid ?? null
  } else if (action === 'inventory-organize') commitAction(organizeInventory(session.state))
  else if (action === 'inventory-discard-common') {
    const result = discardEquipmentByQuality(session.state, '凡品')
    if (selectedInventoryUid && !session.state.inventory.some((item) => item.uid === selectedInventoryUid)) {
      selectedInventoryUid = null
      inventoryDetailOpen = false
    }
    commitAction(result)
  } else if (action === 'inventory-toggle-lock') commitAction(toggleEquipmentLock(session.state, button.dataset.equipmentUid ?? ''))
  else if (action === 'inventory-discard') {
    const result = discardEquipment(session.state, button.dataset.equipmentUid ?? '')
    if (result.ok) {
      selectedInventoryUid = null
      inventoryDetailOpen = false
    }
    commitAction(result)
  }
  else if (action === 'equipment-equip') commitAction(equipEquipment(session.state, heroId, button.dataset.equipmentUid ?? ''))
  else if (action === 'equipment-unequip') commitAction(unequipEquipment(session.state, heroId, button.dataset.slot ?? ''))
  else if (action === 'equipment-lock') commitAction(toggleEquipmentLock(session.state, button.dataset.equipmentUid ?? ''))
  else if (action === 'hero-inventory-filter') {
    const kind = button.dataset.filterKind
    const value = button.dataset.filterValue ?? 'all'
    if (kind === 'slot') {
      heroInventorySlotFilter = value === 'all' || EQUIPMENT_SLOTS.includes(value as EquipmentSlot) ? value as EquipmentSlot | 'all' : 'all'
    } else if (kind === 'quality') {
      heroInventoryQualityFilter = value === 'all' || EQUIPMENT_QUALITIES.includes(value as EquipmentQuality) ? value as EquipmentQuality | 'all' : 'all'
    }
    heroInventoryPage = 1
  } else if (action === 'hero-batch-discard-filter') {
    const value = button.dataset.filterValue as EquipmentQuality | undefined
    heroBatchDiscardQuality = value && EQUIPMENT_QUALITIES.includes(value) ? value : 'all'
    showBatchDiscardConfirm = heroBatchDiscardQuality !== 'all'
    heroInventoryPage = 1
  }
  else if (action === 'organize-hero-inventory') commitAction(organizeInventory(session.state))
  else if (action === 'hero-inventory-page') heroInventoryPage = Math.max(1, dataNumber(button, 'page'))
  else if (action === 'request-batch-discard') {
    showBatchDiscardConfirm = !showBatchDiscardConfirm
    heroBatchDiscardQuality = 'all'
  } else if (action === 'cancel-batch-discard') {
    showBatchDiscardConfirm = false
    heroBatchDiscardQuality = 'all'
  } else if (action === 'confirm-batch-discard') {
    if (heroBatchDiscardQuality !== 'all') {
      commitAction(discardEquipmentByQuality(session.state, heroBatchDiscardQuality))
      showBatchDiscardConfirm = false
      heroBatchDiscardQuality = 'all'
      heroInventoryPage = 1
    }
  }
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
  const target = event.target as HTMLElement
  const select = target.closest<HTMLSelectElement>('[data-action="select-hero-input"]')
  if (select) selectedHeroId = select.value || null
  const inventoryFilter = target.closest<HTMLSelectElement>('[data-hero-inventory-filter]')
  if (inventoryFilter?.dataset.heroInventoryFilter === 'slot') {
    const value = inventoryFilter.value as EquipmentSlot | 'all'
    heroInventorySlotFilter = value === 'all' || EQUIPMENT_SLOTS.includes(value as EquipmentSlot) ? value : 'all'
    heroInventoryPage = 1
  }
  if (inventoryFilter?.dataset.heroInventoryFilter === 'quality') {
    const value = inventoryFilter.value as EquipmentQuality | 'all'
    heroInventoryQualityFilter = value === 'all' || EQUIPMENT_QUALITIES.includes(value as EquipmentQuality) ? value : 'all'
    heroInventoryPage = 1
  }
  const batchDiscardSelect = target.closest<HTMLSelectElement>('[data-batch-discard-quality]')
  if (batchDiscardSelect) {
    const value = batchDiscardSelect.value as EquipmentQuality | 'all'
    heroBatchDiscardQuality = value === 'all' || EQUIPMENT_QUALITIES.includes(value as EquipmentQuality) ? value : 'all'
    showBatchDiscardConfirm = false
    heroInventoryPage = 1
  }
  if (!select && !inventoryFilter && !batchDiscardSelect) return
  render()
})

app.addEventListener('input', (event) => {
  const target = event.target as HTMLElement
  const heroRosterInput = target.closest<HTMLInputElement>('[data-action="hero-roster-search"]')
  if (heroRosterInput) {
    heroRosterQuery = heroRosterInput.value
    render()
    return
  }
  const factionRosterInput = target.closest<HTMLInputElement>('[data-action="faction-roster-search"]')
  if (!factionRosterInput) return
  factionRosterQuery = factionRosterInput.value
  factionRosterOpen = true
  render()
})

app.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !factionRosterOpen) return
  factionRosterOpen = false
  factionRosterQuery = ''
  render()
})

const equipHeroInventoryItem = (target: HTMLElement): boolean => {
  const item = target.closest<HTMLElement>('[data-testid="hero-inventory-panel"] [data-equipment-uid]')
  if (!item || appScreen !== 'playing') return false
  const heroId = normalizeSelectedHero()
  if (!heroId) {
    notify('请先选择侠客', true)
    return true
  }
  commitAction(equipEquipment(session.state, heroId, item.dataset.equipmentUid ?? ''))
  render()
  return true
}

app.addEventListener('dblclick', (event) => {
  equipHeroInventoryItem(event.target as HTMLElement)
})

app.addEventListener('contextmenu', (event) => {
  if (!equipHeroInventoryItem(event.target as HTMLElement)) return
  event.preventDefault()
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
  if (factionRosterOpen && !target.closest('.faction-disciple')) {
    factionRosterOpen = false
    factionRosterQuery = ''
  }
  const tab = target.closest<HTMLElement>('[data-tab]')?.dataset.tab as TabId | undefined
  if (tab) {
    activeTab = tab
    if (tab !== 'inventory') inventoryDetailOpen = false
    if (tab === 'idle') {
      jianghuView = 'worlds'
      jianghuSection = 'stages'
      jianghuMotionPending = 'overview'
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
    if (worldSection === 'stages') jianghuMotionPending = 'stage'
    render()
    return
  }
  const button = target.closest<HTMLButtonElement>('[data-action]')
  if (!button || button.disabled) return
  const { action } = button.dataset
  if (handleStartOrResetAction(action)) return
  if (appScreen !== 'playing') return
  if (action === 'enter-world' && button.dataset.worldId) {
    const targetWorld = WORLDS.find((item) => item.id === button.dataset.worldId)
    if (!targetWorld?.released) {
      notify('该江湖尚未开放', true)
      return
    }
    if (!session.state.unlockedWorldIds.includes(button.dataset.worldId)) {
      notify('江湖卷尚未解锁', true)
      return
    }
    selectedWorldId = button.dataset.worldId
    selectedStage = Math.min(10, Math.max(1, (session.state.clearedStageByWorld[selectedWorldId] ?? 0) + 1))
    selectedFactionId = FACTIONS.find((faction) => faction.worldId === selectedWorldId)?.id ?? ''
    selectedFactionMartialId = null
    factionRosterOpen = false
    factionRosterQuery = ''
    jianghuView = 'world'
    jianghuSection = 'stages'
    jianghuMotionPending = 'stage'
  } else if (action === 'start-stage') {
    selectedStage = Number(button.dataset.stage) || 1
    startSelectedStage('guard')
    return
  } else if (action === 'select-hero') selectedHeroId = button.dataset.heroId ?? null
  else if (action === 'hero-roster-filter') {
    const kind = button.dataset.filterKind
    const value = button.dataset.filterValue ?? 'all'
    if (kind === 'grade' && ['all', '丙', '乙', '甲', '地', '天'].includes(value)) heroRosterGradeFilter = value
    if (kind === 'category' && ['all', '剑', '刀', '拳', '暗', '医', '内家'].includes(value)) heroRosterCategoryFilter = value
  } else if (action === 'locate-hero') {
    normalizeSelectedHero()
    heroRosterQuery = ''
    heroRosterGradeFilter = 'all'
    heroRosterCategoryFilter = 'all'
    heroRosterLocatePending = Boolean(selectedHeroId)
  }
  else if (action === 'select-faction') {
    const nextFactionId = button.dataset.factionId ?? selectedFactionId
    if (nextFactionId !== selectedFactionId) {
      selectedFactionMartialId = null
      factionSwitchAnimationPending = true
      startFactionContributionAnimation(session.state.contribution[nextFactionId] ?? 0)
    }
    selectedFactionId = nextFactionId
    factionRosterOpen = false
    factionRosterQuery = ''
  }
  else if (action === 'set-mode-guard' || action === 'set-mode-roam') {
    const mode = action === 'set-mode-guard' ? 'guard' : 'roam'
    const result = session.setCombatMode(mode)
    notify(result.message, !result.ok)
    if (result.ok) addCombatLog('system', mode === 'guard' ? '守' : '闯', mode === 'guard' ? '转为驻守：原地迎敌，败退自动重整。' : '转为闯荡：破阵后自动深入。')
  } else if (action === 'stop-combat') {
    session.stopCombat()
    notify('已停止战斗')
    jianghuView = 'world'
    jianghuSection = 'stages'
    combatEffects = []
    combatRunPresentation = null
    combatUnitCache.clear()
    jianghuMotionPending = 'stage'
  } else if (action === 'resume-combat' && session.combat) {
    activeTab = 'idle'
    selectedWorldId = session.combat.state.worldId
    selectedStage = session.combat.state.stage
    jianghuView = 'combat'
    jianghuSection = 'stages'
  } else if (action === 'return-worlds') {
    jianghuView = 'worlds'
    jianghuSection = 'stages'
    jianghuMotionPending = 'overview'
  } else if (action?.startsWith('speed-')) {
    const speed = Number(action.slice(-1))
    if (speed === 1 || speed === 2 || speed === 4) {
      combatSpeed = speed
      addCombatLog('system', '速', `战斗节奏调至 ${speed}×。`)
    }
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

const runGameLoop = (): void => {
  const now = performance.now()
  if (appScreen !== 'playing') {
    runtimeClock.reset(now)
    combatClock.reset(now)
    trackedCombat = null
    return
  }
  const runtimePulse = runtimeClock.consume(now, Number.MAX_SAFE_INTEGER)
  let combatTickCount = 0
  if (session.combat) {
    if (session.combat !== trackedCombat) combatClock.reset(now)
    trackedCombat = session.combat
    const combatPulse = combatClock.consume(now, MAX_COMBAT_REALTIME_TICKS_PER_PULSE)
    combatTickCount = combatPulse.tickCount * combatSpeed
  } else {
    combatClock.reset(now)
    trackedCombat = null
  }
  if (runtimePulse.tickCount === 0 && combatTickCount === 0) return
  try {
    if (combatTickCount > 0) {
      const inventoryBefore = new Set(session.state.inventory.map((item) => item.uid))
      cacheCombatUnits()
      const events = session.advanceRealtimeTicks(combatTickCount)
      cacheCombatUnits()
      presentCombatEvents(events, now)
      queueInventoryDropAnimations(session.state.inventory
        .filter((item) => !inventoryBefore.has(item.uid))
        .map((item) => item.uid))
      trackedCombat = session.combat
    }
    session.advanceRuntime(runtimePulse.elapsedMs)
  } catch (error) {
    handleSessionSaveError(error)
    return
  }
  render()
}

window.setInterval(runGameLoop, COMBAT_TICK_MS)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) runGameLoop()
})

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
  queueInventoryDropAnimations(result.addedEquipmentUids)
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
      jianghuMotionPending = 'overview'
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
    const inventoryBefore = new Set(session.state.inventory.map((item) => item.uid))
    cacheCombatUnits()
    const events = session.advanceTicks(ticks)
    cacheCombatUnits()
    presentCombatEvents(events, performance.now())
    queueInventoryDropAnimations(session.state.inventory
      .filter((item) => !inventoryBefore.has(item.uid))
      .map((item) => item.uid))
    render()
    return events
  },
  advanceRuntime: (elapsedMs) => { ensurePlaying(); session.advanceRuntime(elapsedMs); render() },
  grantWorldCurrency: (worldId, amount) => { ensurePlaying(); session.state.worldCurrency[worldId] = amount; saveSession(); render() },
  grantContribution: (factionId, amount) => { ensurePlaying(); session.state.contribution[factionId] = amount; saveSession(); render() },
  recruitHero: debugRecruit,
  placeHero: (heroId, row, position) => { ensurePlaying(); commitAction(placeFormation(session.state, heroId, row, position)); render() },
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
    presentCombatEvents(session.advanceTicks(0), performance.now())
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
