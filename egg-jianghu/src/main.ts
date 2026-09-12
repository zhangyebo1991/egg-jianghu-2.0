import { ORDINARY_POOL_HEROES, ORDINARY_POOL_RULES, isOrdinaryPoolHero } from './content/ordinary-hero-pool'
import { availableOrdinaryPoolHeroes, type OrdinaryPoolReward } from './domain/ordinary-hero-pool'
import { renderOrdinaryHeroPool, type OrdinaryPoolView } from './ui/ordinary-hero-pool'
import { createCloudAccess } from './cloud/bridge'
import { renderHeroSkins } from './ui/hero-skins'
import { heroAppearanceAsset } from './ui/hero-appearance-assets'
import { selectHeroSkin, upgradeHeroSkin } from './domain/hero-skins'
import './style.css'
import { GameSession, SaveConflictError } from './app/game-session'
import { RuntimeClock } from './app/runtime-clock'
import { createRng } from './combat/rng'
import { isCombatSpeed, type CombatSpeed } from './combat/scheduler'
import { buildAttributeMap, buildCombatStats } from './combat/stats'
import { COMBAT_TICK_MS } from './combat/timeline'
import type { CombatEvent, CombatRank, CombatUnit } from './combat/types'
import { createWave } from './combat/waves'
import { CAREERS, CAREER_GROWTH_FIELDS, STARTER_CAREER_ID, careerById, careerJobBookName, careerNameById, careerSkillTypeNames, careersInRank, formatGrowthCoeff, growthGrade } from './content/careers'
import {
  EQUIPMENT_QUALITIES,
  EQUIPMENT_SLOT_NAMES,
  EQUIPMENT_SLOTS,
  artifactSoulById,
  equipmentAffixGrade,
  equipmentAttributeValue,
  equipmentCoreRollPercent,
  equipmentDefinitionById,
  equipmentDisplayName,
  equipmentPoolForWorld,
  equipmentWearLevel,
  formatEquipmentAttributeValue,
  isEquipmentQuality,
  type EquipmentSlot,
} from './content/equipment'
import { ATTRIBUTE_BY_ID } from './content/attributes'
import { advanceCityIntro, replayCityIntro, appointCityShopWorker, CITY_SHOP_CAPACITY, cityShopAbility, cityShopProgressPerSecond, cityShopSalePrice, cityShopStaffCount, cityShopStatus, cityShopTile, cityShopWorkerReason, stockCityShop, unstockCityShop, toggleCityShop } from './domain/city-shop'
import { FACTIONS, factionById, factionByOriginalId } from './content/factions'
import { HEROES_V10, PLAYER_HERO_ID, TAVERN_HEROES, heroByIdV10, heroDisplayNameV10, heroMeridianCategory } from './content/heroes'
import { FACTION_MARTIALS, martialBuffChanceAtLevel, martialByIdV10, martialByOriginalId, martialEffectAtLevel, martialResourceCost, martialSpCost } from './content/martials'
import { buffById } from './content/buffs'
import { skillById } from './content/skills'
import { formatCombatResult } from './ui/combat-log'
import {
  ORIGINAL_DEITIES,
  ORIGINAL_INTERWORLD_DROP_ITEMS,
  ORIGINAL_INTERWORLD_ENEMIES,
  ORIGINAL_LARGE_DUNGEONS,
  ORIGINAL_SACRED_BEASTS,
  ORIGINAL_SACRED_UPGRADES,
} from './content/original-progression.generated'
import {
  originalFactionAgentContributionMultiplier,
  originalFactionAgentReputationMultiplier,
  originalFactionTaskDefinitionById,
  originalFactionTaskRequiredAmount,
  originalFactionTaskReward,
  originalFactionTaskTargetName,
  originalWorldReputationLevel,
  originalWorldReputationLevelName,
  originalWorldReputationThreshold,
} from './content/original-faction-rules.generated'
import { originalFactionExchangeByFaction } from './content/original-faction-exchange.generated'
import { originalFactionRecruitmentByFaction } from './content/original-faction-recruitment.generated'
import {
  ORIGINAL_CITY_CONSTANTS,
  ORIGINAL_CITY_PENDING_RULES,
  originalCityBuildingById,
} from './content/original-city.generated'
import { ORIGINAL_CITY_FOUNDATION, originalWorldTownByIndex } from './content/original-towns.generated'
import { WORLDS, planeRecommendedPower } from './content/worlds'
import { APT_DESC, STAT_DESC } from './content/stat-descriptions'
import { worldPresentation } from './content/world-presentations'
import { CAREER_MAX_LEVEL, changeCareer, careerExperienceForNextLevel, previewCareerChange } from './domain/careers'
import { backpackEquipment, discardEquipment, discardEquipmentByQuality, equipEquipment, equipBestEquipment, type EquipmentBuild, INVENTORY_CAPACITY, organizeInventory, sellEquipmentByQuality, switchEquipmentSet, toggleEquipmentLock, unequipEquipment, bindActiveEquipmentLoadout } from './domain/inventory'
import { buyJobBook, JOB_BOOK_SHOP_RANKS, JOB_BOOK_SHOP_TIER_LABELS, shopJobBooksForRank } from './domain/shop'
import { equipHeartMethod, equipMartial, forgetMartial, isMartialCareerCompatible, learnFactionMartial, unequipMartial, upgradeMartial } from './domain/martial-training'
import { acceptQuest, cancelQuest, claimQuest, factionQuestCurrentProgress, initializeQuestBoard } from './domain/quests'
import { appointFactionAgent, dismissFactionAgent, factionAgentAbilityLevel, factionAgentCandidateIds, heroAbilityAttributes, toggleFactionAgent } from './domain/faction-agent'
import {
  AGENT_CONCURRENT_TASK_LIMIT,
  factionAgentAutomationAvailable,
  isFactionAgentColumnExcluded,
  toggleFactionAgentFilterColumn,
} from './domain/faction-agent-automation'
import { originalAgentFilterQualityColumn, ORIGINAL_FACTION_RULES } from './content/original-faction-rules.generated'

const AGENT_FILTER = ORIGINAL_FACTION_RULES.stateLayout.agentFilter
/** 悬榜任务类型 1..5 的显示名，与 rw 表行 1..5 对应。 */
const AGENT_TASK_FILTER_NAMES = ['消灭', '筹措', '收集', '挑战', '寻宝'] as const
import { exchangeFactionItem, factionExchangeItemOwned, factionExchangeItemQuantity } from './domain/faction-exchange'
import { recruitFromFaction, recruitFromTavern } from './domain/recruitment'
import { clearedStageOf, difficultyLabel, highestUnlockedDifficulty, isDifficultyUnlocked, progressKey } from './domain/progression'
import { heroExperienceForNextLevel, settleCombatEvent } from './domain/rewards'
import {
  advanceSacredEquipment,
  BROKEN_DIVINITY_ITEM_ID,
  claimDeity,
  claimSacredBeastStageReward,
  clearSacredBeastStage,
  completeDivineLadderFloor,
  completeInfiniteTowerFloor,
  completeLargeDungeon,
  CREATION_ORIGIN_ITEM_ID,
  craftSacredEquipment,
  deityUpgradeCost,
  forgeImperialWeapon,
  interworldDropProbability,
  isDivineRealmUnlocked,
  isSacredBeastUnlocked,
  largeDungeonBattleDifficulty,
  largeDungeonDropProbability,
  learnSacredRecipe,
  recordShrineBossKill,
  recordShrineEnemyKill,
  rollInterworldDrops,
  sacredBeastBattleDifficulty,
  settleShrineSpawn,
  upgradeDeity,
  WORLD_TREE_LEAF_ITEM_ID,
} from './domain/original-progression'
import { clearSaveV10, hasLegacySave, hasSaveV10, SAVE_KEY_V10, importSaveV10, exportSaveV10 } from './domain/save-v10'
import { placeFormation, removeFormation } from './domain/formation'
import { normalizePlayerName } from './domain/state'
import {
  cityBaseMonthlyRent,
  cityDevelopment,
  cityEffectiveGrid,
  cityOwnedLandValue,
  cityTileById,
  cityTilePrice,
  cityTotals,
} from './domain/city'
import type { ActionResult, EquipmentInstance, EquipmentQuality, FormationColumn, FormationRow, GameStateV10 } from './domain/types'
import { renderCityPage, type CityPageSection, type CityPageViewModel } from './ui/city-page'
import { MARTIAL_LORE } from './content/martial-lore'
import { renderFactionsPage, withLore, type FactionMartialState, type FactionsPageViewModel } from './ui/factions-page'
import type { FactionExchangeViewModel } from './ui/faction-exchange'
import type { FactionRecruitmentViewModel } from './ui/faction-recruitment'
import { renderFormationPage, type FormationFilter, type FormationPageViewModel } from './ui/formation-page'
import { renderPremiumPanel, renderShopPage, type PremiumPanel } from './ui/premium-panel'
import { renderHeroesPage, type HeroesHeroView, type HeroesMainTab, type HeroesPageViewModel } from './ui/heroes-page'
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
import { STACK_ITEM_DEFINITIONS } from './content/campaign-loot.generated'
import { renderProgressionPage, type ProgressionPageViewModel, type ProgressionSection } from './ui/progression-page'
import { renderStageList, renderWorldOverview, type PlaneSelectViewModel, type StageListViewModel } from './ui/jianghu-page'
import { createDomPatcher } from './ui/dom-patch'
import { renderWelfareRewards } from './ui/welfare-rewards'
import { WELFARE_CODE_ID } from './domain/welfare-codes'
import { renderSettingsPage } from './ui/settings-page'
import { isJianghuSectionAvailable, isTabAvailable, renderShell, type JianghuSection, type TabId } from './ui/shell'
import { renderStartPage } from './ui/start-page'
import { renderTownsPage, type TownsPageViewModel } from './ui/towns-page'

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
let selectedPlaneId = 'world_01'
let selectedDifficulty = 1
let selectedStage = 1
let selectedHeroId: string | null = null
let inventorySlotFilter: EquipmentSlot | 'all' = 'all'
let inventoryCategory: 'all' | 'equipment' | 'material' | 'special' = 'all'
let inventoryQuery = ''
let selectedStackId: number | null = null
let selectedInventoryUid: string | null = null
let inventoryDetailOpen = false
let pendingInventoryDropUids: string[] = []
let shopRank: 2 | 3 | 4 | 5 | 6 = 2
let progressionSection: ProgressionSection = 'dungeons'
let progressionDungeonDifficulty = 1
let selectedProgressionEquipmentUid: string | null = null
let heroPackSlotFilter: EquipmentSlot | 'all' = 'all'
let heroPackQualityFilter: EquipmentQuality | 'all' = 'all'
let heroPackPage = 1
let heroPackDynamicPageSize = 48
let heroMainTab: HeroesMainTab = 'basic'
let heroAutoEquipBuild: EquipmentBuild = 'physical'
let heroMartialSlot: number | null = null
let heroMartialQuery = ''
let heroMartialCategory = 'all'
let highlightedHeroMartialId: string | null = null
let renderedLocationKey = ''
const pageScrollMemory = new Map<string, Array<{ selector: string; top: number; left: number }>>()
let heroSellOpen = false
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
let townFactionFunction: 'exchange' | 'recruitment' | 'agent' = 'exchange'
let cityPageSection: CityPageSection = 'overview'
let cityStockPage = 1
let cityHiringSlot: number | null = null
let selectedCityTileId = 172
let careerTreeOpen = false
let selectedTreeCareerId: string | null = null
let factionRosterOpen = false
let factionRosterQuery = ''
let combatSpeed: CombatSpeed = 1
let combatLogs: IdleCombatLogView[] = []
type ActiveCombatEffect = IdleCombatEffectView & { startsAtMs: number; expiresAtMs: number }
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
let factionExchangeFocusPending = false
let factionRecruitmentFocusPending = false
let factionAgentFocusPending = false
let factionContributionAnimation: FactionContributionAnimation | null = null
let factionMotionTimer: number | null = null

const EQUIPMENT_TOOLTIP_ANCHOR = '.hero-equipment-slot, .hero-inventory-item, .pack-row, .pd-slot, .pack-cell'
const EQUIPMENT_TOOLTIP_GAP = 10
const EQUIPMENT_TOOLTIP_VIEWPORT_PADDING = 12

const combatEffectDuration: Record<IdleCombatEffectKind, number> = {
  'lunge-party': 200,
  'lunge-enemy': 200,
  'hit-shake': 200,
  'skill-aura': 760,
  'heal-aura': 760,
  damage: 1500,
  critical: 1500,
  healing: 1500,
  'skill-name': 1000,
  slash: 200,
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
  atMs: number,
  unitId?: string,
  text?: string,
): void => {
  combatEffects.push({
    id: nextCombatPresentationId++,
    kind,
    unitId,
    text,
    startsAtMs: atMs,
    expiresAtMs: atMs + combatEffectDuration[kind],
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
  addCombatLog('system', '战', '战斗开始，铜钱与随机装备将在击败敌人后即时入账。')
}

const activeCombatEffects = (simulatedNowMs: number): IdleCombatEffectView[] => {
  combatEffects = combatEffects.filter((effect) => effect.expiresAtMs > simulatedNowMs)
  return combatEffects
    .filter((effect) => effect.startsAtMs <= simulatedNowMs)
    .map(({ startsAtMs, expiresAtMs, ...effect }) => ({
      ...effect,
      durationMs: (expiresAtMs - startsAtMs) / combatSpeed,
      elapsedMs: (simulatedNowMs - startsAtMs) / combatSpeed,
    }))
}

const combatUnitName = (unitId: string): string => combatUnitCache.get(unitId)?.name ?? '无名侠客'

const presentCombatEvents = (events: CombatEvent[]): void => {
  for (const event of events) {
    if (event.type === 'skill-used') {
      const skill = skillById(event.skillId)
      if (skill) {
        addCombatEffect('skill-name', event.atMs, event.sourceId, skill.name)
        if (skill.behavior !== 'attack') {
          addCombatLog('skill', '绝', `${combatUnitName(event.sourceId)} 使出「${skill.name}」！`)
        }
      }
    } else if (event.type === 'skill-effect') {
      const skill = skillById(event.skillId)
      const actor = combatUnitCache.get(event.sourceId)
      if (actor && skill?.behavior === 'attack') {
        addCombatEffect(actor.side === 'party' ? 'lunge-party' : 'lunge-enemy', event.atMs, event.sourceId)
      }
      if (skill) addCombatEffect(skill.behavior === 'heal' ? 'heal-aura' : 'skill-aura', event.atMs, event.sourceId)
    } else if (event.type === 'damage') {
      addCombatEffect('hit-shake', event.atMs, event.targetId)
      addCombatEffect('slash', event.atMs, event.targetId)
      addCombatEffect(event.critical ? 'critical' : 'damage', event.atMs, event.targetId, String(event.amount))
      addCombatLog('skill', event.critical ? '暴' : '伤', formatCombatResult(event, combatUnitName))
    } else if (event.type === 'attack-missed') {
      addCombatLog('system', '避', formatCombatResult(event, combatUnitName))
    } else if (event.type === 'healing') {
      addCombatEffect('heal-aura', event.atMs, event.targetId)
      addCombatEffect('healing', event.atMs, event.targetId, String(event.amount))
      addCombatLog('heal', '愈', formatCombatResult(event, combatUnitName))
    } else if (event.type === 'shield-applied') {
      addCombatLog('heal', '盾', `${combatUnitName(event.sourceId)} 为 ${combatUnitName(event.targetId)} 加上 ${Math.round(event.amount).toLocaleString('zh-CN')} 点护盾。`)
    } else if (event.type === 'unit-revived') {
      addCombatLog('heal', '起', `${combatUnitName(event.sourceId)} 令 ${combatUnitName(event.targetId)} 重返战场。`)
    } else if (event.type === 'summoned') {
      addCombatLog('skill', '召', `${combatUnitName(event.sourceId)} 召来「${event.summonName}」。`)
    } else if (event.type === 'status-applied') {
      const buffName = buffById(event.buffId)?.name
      if (buffName) addCombatLog('system', '状', `${combatUnitName(event.targetId)} 获得「${buffName}」。`)
    } else if (event.type === 'enemy-defeated') {
      if (combatRunPresentation) combatRunPresentation.kills += 1
      const rank = event.rank === 'boss' ? '首领' : event.rank === 'captain' ? '头目' : event.rank === 'elite' ? '精英' : '敌人'
      addCombatLog('kill', '刃', `击败${rank}「${combatUnitName(event.enemyId)}」，收益已即时入账。`)
    } else if (event.type === 'wave-started') {
      addCombatEffect('wave-banner', event.atMs, undefined, event.wave === 10 ? '帅旗至 · 第 10 波' : `第 ${event.wave} 波`)
      addCombatLog('wave', '波', event.wave === 10 ? '敌首亲率众至，第 10 波！' : `敌势再起，进入第 ${event.wave} 波。`)
    } else if (event.type === 'stage-cleared') {
      addCombatLog('wave', '破', '本关十波尽破。')
    } else if (event.type === 'party-defeated') {
      addCombatLog('defeat', '退', '队伍败退，按当前模式重整旗鼓。')
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
  if (!hasSave && hasLegacySave(window.localStorage)) {
    startError = '检测到旧版存档；当前版本需要新建游戏，旧档保留但不可继续'
  }
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
  selectedPlaneId = selectedWorldId
  selectedDifficulty = 1
  selectedStage = Math.min(10, Math.max(1, clearedStageOf(session.state.clearedStageByWorldDifficulty, selectedWorldId, selectedDifficulty) + 1))
  progressionSection = 'dungeons'
  progressionDungeonDifficulty = 1
  selectedProgressionEquipmentUid = null
  selectedHeroId = Object.keys(session.state.heroes)[0] ?? null
  careerTreeOpen = false
  selectedTreeCareerId = null
  inventorySlotFilter = 'all'
  welfareInput = ''
  ordinaryPoolRulesOpen = false
  ordinaryPoolSelectedId = null
  ordinaryPoolRewards = []
  inventoryCategory = 'all'
  inventoryQuery = ''
  selectedStackId = null
  selectedInventoryUid = null
  inventoryDetailOpen = false
  pendingInventoryDropUids = []
  shopRank = 2
  heroPackSlotFilter = 'all'
  heroPackQualityFilter = 'all'
  heroPackPage = 1
  heroPackDynamicPageSize = 48
  heroMainTab = 'basic'
  heroMartialSlot = null
  heroMartialQuery = ''
  heroMartialCategory = 'all'
  highlightedHeroMartialId = null
  pageScrollMemory.clear()
  renderedLocationKey = ''
  heroSellOpen = false
  heroRosterQuery = ''
  heroRosterGradeFilter = 'all'
  heroRosterCategoryFilter = 'all'
  heroRosterLocatePending = false
  selectedFactionId = FACTIONS.find((faction) => session.state.unlockedFactionIds.includes(faction.id))?.id ?? ''
  selectedFactionMartialId = null
  townFactionFunction = 'exchange'
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

const CLOUD_BACKUP_KEY = 'egg-jianghu-before-cloud-download'
let voucherDetailsOpen = false
let ordinaryPoolRulesOpen = false
let ordinaryPoolSelectedId: string | null = null
let ordinaryPoolRewards: OrdinaryPoolReward[] = []
let welfareInput = ''
let premiumPanel: PremiumPanel | null = null
let premiumReturnFocus: HTMLElement | null = null
const closePremiumPanel = (): void => {
  premiumPanel = null
  render()
  premiumReturnFocus?.focus()
}
let voucherHovered = false
let voucherHoverTimer: ReturnType<typeof setTimeout> | undefined

const positionVoucherDetails = (): void => {
  const panel = app.querySelector<HTMLElement>('#voucher-details')
  const anchor = app.querySelector<HTMLElement>('.voucher-wallet-summary')
  if (!panel || !anchor) return
  const rect = anchor.getBoundingClientRect()
  panel.style.left = `clamp(8px, ${rect.right + 10}px, calc(100vw - ${panel.offsetWidth + 8}px))`
  panel.style.top = `clamp(8px, ${rect.top}px, calc(100dvh - ${panel.offsetHeight + 8}px))`
}
const installCloudSave = (json: string): void => {
  const validated = importSaveV10(json).state
  if (appScreen === 'playing' && !saveSession()) throw new Error('当前进度未能保存，请先解决本地存档问题')
  const previous = window.localStorage.getItem(SAVE_KEY_V10)
  if (previous !== null) window.localStorage.setItem(CLOUD_BACKUP_KEY, previous)
  window.localStorage.setItem(SAVE_KEY_V10, exportSaveV10(validated))
  if (appScreen === 'playing') session.stopCombat()
  appScreen = 'title'
  hasSave = true
  startError = null
  confirmOverwrite = false
  overwriteSaveSnapshot = null
  showResetConfirmation = false
  render()
}
const cloudAccount = createCloudAccess({
  localSave: () => {
    if (appScreen === 'playing' && !saveSession()) throw new Error('本地存档未能保存')
    const raw = window.localStorage.getItem(SAVE_KEY_V10)
    return raw ? JSON.parse(raw) : null
  },
  install: installCloudSave,
  hasBackup: () => { try { return window.localStorage.getItem(CLOUD_BACKUP_KEY) !== null } catch { return false } },
  restore: () => {
    const backup = window.localStorage.getItem(CLOUD_BACKUP_KEY)
    if (!backup) throw new Error('没有本地恢复备份')
    installCloudSave(backup)
  },
})

const commitAction = (result: ActionResult, successMessage?: string): void => {
  notify(result.ok ? successMessage ?? result.message : result.message, !result.ok)
  if (result.ok) saveSession()
}

const unitView = (unit: CombatUnit): IdleCombatUnitView => {
  const equipped = unit.skillIds
    .map((skillId) => skillById(skillId))
    .find((candidate) => candidate && candidate.behavior !== 'passive')
  const base = skillById(unit.baseAttackId)
  return {
    appearanceUrl: unit.side === 'party' && session.state.heroes[unit.id] ? heroAppearanceAsset(unit.id, session.state.heroes[unit.id], session.state.unlockedSkinIds) : undefined,
    id: unit.id,
    name: unit.name,
    rank: unit.rank,
    careerId: unit.careerId,
    row: unit.row,
    col: unit.col,
    hp: unit.hp,
    maxHp: unit.maxHp,
    energy: unit.energy,
    maxEnergy: unit.maxEnergy,
    gauge: unit.gauge,
    // 引擎冷却使用战斗时间；界面按当前倍率换算为等待秒数，避免再次加速结算。
    cooldownMs: Math.max(0, ...Object.values(unit.cooldowns), 0) / combatSpeed,
    alive: unit.alive,
    skillId: equipped?.id ?? base?.id,
    skillName: equipped?.name ?? base?.name ?? (unit.side === 'party' ? '蓄势待发' : '伺机出手'),
    shield: unit.shield,
    statuses: unit.statuses.flatMap((status) => {
      const definition = buffById(status.buffId)
      return definition ? [{ name: definition.name, stacks: status.stacks, polarity: definition.polarity }] : []
    }),
  }
}

const idleViewModel = (): IdlePageViewModel => {
  const combat = session.combat?.state
  if (!combat) throw new Error('战斗页面缺少进行中的战斗')
  if (!combatRunPresentation) beginCombatPresentation()
  const world = WORLDS.find((item) => item.id === combat.worldId) ?? WORLDS[0]
  const now = performance.now()
  const stats = combatRunPresentation!
  const initialTransition = combat.timeline.waveTransition?.kind === 'initial'
    ? combat.timeline.waveTransition
    : null
  const pendingRestart = session.pendingCombatRestart
  const countdownRemainingMs = pendingRestart
    ? Math.max(0, pendingRestart.countdownMs - pendingRestart.elapsedMs)
    : 0
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
      enemyVisible: !initialTransition || initialTransition.refreshed,
      party: [...combat.party, ...combat.summons.filter((summon) => summon.side === 'party')].map(unitView),
      enemies: [...combat.enemies, ...combat.summons.filter((summon) => summon.side === 'enemy')].map(unitView),
      settlement: pendingRestart ? {
        outcome: pendingRestart.outcome,
        countdownSeconds: Math.ceil(countdownRemainingMs / 1000),
        closing: pendingRestart.elapsedMs >= pendingRestart.countdownMs,
      } : null,
      timeline: {
        phase: combat.timeline.phase,
        activeActorId: combat.timeline.activeAction?.actorId ?? combat.timeline.pendingAction?.actorId ?? null,
        readyQueue: combat.timeline.readyQueue.map((entry) => ({ ...entry })),
      },
    },
    stats: {
      copper: Math.max(0, totalWorldCurrency() - stats.currencyStart),
      equipment: Math.max(0, backpackEquipment(session.state).length - stats.equipmentStart),
      kills: stats.kills,
      elapsedMs: Math.max(0, now - stats.startedAt),
    },
    logs: combatLogs,
    effects: activeCombatEffects(combat.elapsedMs),
  }
}

const worldOverviewViewModel = (): PlaneSelectViewModel => {
  const selected = WORLDS.find((world) => world.id === selectedPlaneId) ?? WORLDS[0]
  const unlocked = session.state.unlockedWorldIds.includes(selected.id)
  const highest = highestUnlockedDifficulty(
    session.state.unlockedWorldIds,
    session.state.clearedStageByWorldDifficulty,
    selected.id,
  )
  const difficulty = unlocked
    ? Math.min(Math.max(1, selectedDifficulty), Math.max(1, highest))
    : 1
  selectedDifficulty = difficulty
  const canTravel = unlocked && isDifficultyUnlocked(
    session.state.unlockedWorldIds,
    session.state.clearedStageByWorldDifficulty,
    selected.id,
    difficulty,
  )
  const previous = WORLDS[selected.index - 2]
  return {
    planes: WORLDS.map((world) => ({
      id: world.id,
      name: world.name,
      index: world.index,
      unlocked: session.state.unlockedWorldIds.includes(world.id),
      selected: world.id === selected.id,
    })),
    selected: {
      id: selected.id,
      name: selected.name,
      index: selected.index,
      unlocked,
      flavor: selected.flavor,
      latinName: selected.latinName,
      recommendedPower: planeRecommendedPower(selected.index, difficulty),
      selectedDifficulty: difficulty,
      canTravel,
      lockText: unlocked
        ? '开始穿越'
        : selected.index > 1
          ? `通关 ${previous?.name ?? '上一位面'} 基础难度后开启`
          : '尚未解锁',
      difficulties: Array.from({ length: 10 }, (_, offset) => {
        const value = offset + 1
        return {
          difficulty: value,
          label: difficultyLabel(value),
          unlocked: isDifficultyUnlocked(
            session.state.unlockedWorldIds,
            session.state.clearedStageByWorldDifficulty,
            selected.id,
            value,
          ),
          selected: value === difficulty,
          cleared: clearedStageOf(session.state.clearedStageByWorldDifficulty, selected.id, value),
        }
      }),
    },
  }
}

const stageListViewModel = (): StageListViewModel => {
  const world = WORLDS.find((item) => item.id === selectedWorldId) ?? WORLDS[0]
  const difficulty = selectedDifficulty
  const cleared = clearedStageOf(session.state.clearedStageByWorldDifficulty, world.id, difficulty)
  const presentation = worldPresentation(world.id)
  return {
    worldId: world.id,
    worldName: world.name,
    worldIndex: world.index,
    worldLatinName: presentation.latinName,
    worldCurrency: session.state.worldCurrency[world.id] ?? 0,
    currencyName: presentation.currencyName,
    difficulty,
    difficultyLabel: difficultyLabel(difficulty),
    recommendedPower: planeRecommendedPower(world.index, difficulty),
    clearedStages: cleared,
    flavor: presentation.flavor,
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

const careerGrowthView = (career: NonNullable<ReturnType<typeof careerById>>) =>
  CAREER_GROWTH_FIELDS.map((field) => ({
    id: field.id,
    label: field.label,
    grade: growthGrade(career.growth[field.id]),
    coeff: formatGrowthCoeff(career.growth[field.id]),
  }))

const computeHeroPackPageSize = (): number => {
  const grid = app.querySelector<HTMLElement>('.heroes-page .pack-grid')
  if (grid && grid.clientHeight > 0 && grid.clientWidth > 0) {
    const width = grid.clientWidth
    const height = grid.clientHeight
    const style = window.getComputedStyle(grid)
    const columns = style.gridTemplateColumns.split(/\s+/).length
    const columnGap = Number.parseFloat(style.columnGap) || 0
    const rowGap = Number.parseFloat(style.rowGap) || 0
    const cellWidth = (width - (columns - 1) * columnGap) / columns
    const rows = Math.max(1, Math.floor((height + rowGap) / (cellWidth + rowGap)))
    return rows * columns
  }
  // 离开侠客页时没有网格，沿用上次容量，避免返回时暂用估算值挤掉末页。
  return heroPackDynamicPageSize
}

const ordinaryPoolViewModel = (): OrdinaryPoolView => {
  const heroes = availableOrdinaryPoolHeroes(session.state)
  const { cost, heroRate, heroPity, materialIds } = ORDINARY_POOL_RULES
  const pityRemaining = heroPity - session.state.ordinaryPoolMisses
  return {
    heroes: heroes.map(hero => ({ hero, baseProbability: heroRate / heroes.length, nextProbability: (pityRemaining === 1 ? 1 : heroRate) / heroes.length })),
    rulesOpen: ordinaryPoolRulesOpen, selectedId: ordinaryPoolSelectedId, balance: session.state.idleVouchers.balance,
    cost, heroRate, pityRemaining,
    hasLockedHeroes: ORDINARY_POOL_HEROES.some(hero => !session.state.unlockedWorldIds.includes(hero.worldId) && !session.state.heroes[hero.id]?.recruited),
    results: ordinaryPoolRewards.map(reward => ({ name: reward.name, amount: reward.amount, hero: reward.kind === 'hero' })),
    materialNames: materialIds.map(id => STACK_ITEM_DEFINITIONS[id].name),
  }
}

const heroesViewModel = (): HeroesPageViewModel => {
  const selectedId = normalizeSelectedHero()
  const selectedProgress = selectedId ? session.state.heroes[selectedId] : undefined
  const inCombat = Boolean(session.combat)

  const buildHero = ({ definition, progress, name }: ReturnType<typeof recruitedHeroes>[number]): HeroesHeroView => {
    const career = careerById(progress.currentCareerId) ?? careerById(definition.baseCareerId)
    const record = progress.careers[progress.currentCareerId]
    const source = definition.source === 'starter'
      ? '本队主角'
      : definition.source === 'tavern'
        ? '酒馆相逢'
        : definition.source === 'welfare' ? '福利码结缘'
        : `${FACTIONS.find((faction) => faction.id === definition.factionId)?.name ?? '势力'}门人`
    const required = career
      ? careerExperienceForNextLevel(career.rank, record?.level ?? 1)
      : 1
    return {
      id: definition.id,
      name,
      grade: definition.source === 'starter' ? '主' : definition.grade,
      recruited: progress.recruited,
      level: progress.level,
      experience: progress.experience,
      experienceRequired: heroExperienceForNextLevel(progress.level),
      careerId: progress.currentCareerId,
      careerName: career?.name ?? progress.currentCareerId,
      careerLevel: record?.level ?? 1,
      careerTier: career?.tier ?? '初级',
      skillTypeNames: career ? careerSkillTypeNames(career) : ['通用'],
      growth: career ? careerGrowthView(career) : [],
      careerExperience: record?.experience ?? 0,
      careerExperienceRequired: required,
      careerMaxed: (record?.level ?? 1) >= CAREER_MAX_LEVEL,
      learnedCareers: Object.entries(progress.careers).map(([id, learned]) => ({
        id,
        name: careerNameById(id),
        level: learned.level,
        current: id === progress.currentCareerId,
      })),
      aptitudes: definition.aptitudes,
      appearanceUrl: heroAppearanceAsset(definition.id, progress, session.state.unlockedSkinIds),
      combatStats: buildCombatStats(definition, progress, session.state.inventory, session.state.unlockedSkinIds),
      abilityAttributes: heroAbilityAttributes(definition.sourceId, progress, session.state.inventory),
      category: heroMeridianCategory(definition),
      source,
      inFormation: session.state.formation.some((slot) => slot.heroId === definition.id),
    }
  }

  const heroes = recruitedHeroes().map(buildHero)
  const query = heroRosterQuery.trim().toLocaleLowerCase()
  const rosterHeroes = heroes.filter((hero) => {
    return (!query || hero.name.toLocaleLowerCase().includes(query))
      && (heroRosterGradeFilter === 'all' || hero.grade === heroRosterGradeFilter)
      && (heroRosterCategoryFilter === 'all' || hero.category === heroRosterCategoryFilter)
  })

  const treeCareerId = selectedTreeCareerId && CAREERS.some((career) => career.id === selectedTreeCareerId)
    ? selectedTreeCareerId
    : selectedProgress?.currentCareerId ?? STARTER_CAREER_ID
  const treeNodes = CAREERS.map((career) => {
    const siblings = careersInRank(career.rank)
    return {
      id: career.id,
      name: career.name,
      rank: career.rank,
      indexInRank: Math.max(0, siblings.findIndex((item) => item.id === career.id)),
      rankCount: Math.max(1, siblings.length),
      tier: career.tier,
      learned: Boolean(selectedProgress?.careers[career.id]),
      current: selectedProgress?.currentCareerId === career.id,
      selected: treeCareerId === career.id,
    }
  })
  const selectedCareer = careerById(treeCareerId)
  const preview = selectedProgress && selectedCareer
    ? previewCareerChange(selectedProgress, selectedCareer.id, session.state.jobBooks, inCombat)
    : null
  const treeDetail = selectedCareer && selectedProgress
    ? {
      id: selectedCareer.id,
      name: selectedCareer.name,
      description: selectedCareer.description,
      tier: selectedCareer.tier,
      skillTypeNames: careerSkillTypeNames(selectedCareer),
      growth: careerGrowthView(selectedCareer),
      requirements: selectedCareer.requirements.map((requirement) => ({
        name: careerNameById(requirement.careerId),
        requiredLevel: requirement.level,
        currentLevel: selectedProgress.careers[requirement.careerId]?.level ?? 0,
        met: (selectedProgress.careers[requirement.careerId]?.level ?? 0) >= requirement.level,
      })),
      bookName: careerJobBookName(selectedCareer),
      bookOwned: (session.state.jobBooks[selectedCareer.id] ?? 0) > 0,
      learned: Boolean(selectedProgress.careers[selectedCareer.id]),
      current: selectedProgress.currentCareerId === selectedCareer.id,
      actionLabel: preview?.kind === 'switch'
        ? '可直接转职'
        : preview?.kind === 'current'
          ? '当前职业'
          : preview?.ok ? '转职' : preview?.message ?? '不可转职',
      actionDisabled: !preview?.ok,
    }
    : null

  const selectedHero = selectedId ? session.state.heroes[selectedId] : undefined
  const loadout = selectedHero ? bindActiveEquipmentLoadout(selectedHero) : {}
  const equipment = selectedHero && selectedId
    ? {
      heroId: selectedId,
      setIndex: selectedHero.activeEquipmentSetIndex,
      autoEquipBuild: heroAutoEquipBuild,
      slots: EQUIPMENT_SLOTS.map((slot) => {
        const uid = loadout[slot]
        const instance = uid ? session.state.inventory.find((item) => item.uid === uid) : undefined
        return { slot, item: instance ? inventoryItemView(instance) : null }
      }),
    }
    : null

  // 行囊只陈列未穿戴装备（对齐原版：已装备不入行囊）
  const backpackAll = backpackEquipment(session.state)
  const packSource = backpackAll.filter((item) => {
    const view = inventoryItemView(item)
    if (heroPackSlotFilter !== 'all' && view.slot !== heroPackSlotFilter) return false
    if (heroPackQualityFilter !== 'all' && item.quality !== heroPackQualityFilter) return false
    return true
  })
  const packPageSize = computeHeroPackPageSize()
  heroPackDynamicPageSize = packPageSize
  const packPageCount = Math.max(1, Math.ceil(packSource.length / packPageSize))
  heroPackPage = Math.min(packPageCount, Math.max(1, heroPackPage))
  const packPageItems = packSource.slice((heroPackPage - 1) * packPageSize, heroPackPage * packPageSize)
  const pack = {
    capacity: INVENTORY_CAPACITY,
    itemCount: backpackAll.length,
    slotFilter: heroPackSlotFilter,
    qualityFilter: heroPackQualityFilter,
    page: heroPackPage,
    pageCount: packPageCount,
    items: packPageItems.map((item) => inventoryItemView(item)),
    sellOpen: heroSellOpen,
  }

  return {
    skinsHtml: selectedId ? renderHeroSkins(session.state, selectedId, Boolean(session.combat || session.pendingCombatRestart)) : '',
    selectedHeroId: selectedId,
    mainTab: heroMainTab,
    martials: selectedProgress ? {
      hero: selectedProgress,
      attributes: buildAttributeMap(heroByIdV10(selectedId!)!, selectedProgress, session.state.inventory, session.state.unlockedSkinIds),
      query: heroMartialQuery,
      category: heroMartialCategory,
      selectedSlot: heroMartialSlot,
      highlightedId: highlightedHeroMartialId,
      locked: Boolean(session.combat || session.pendingCombatRestart),
    } : undefined,
    returnLabel: jianghuView !== 'worlds'
      ? `${WORLDS.find((world) => world.id === selectedWorldId)?.name ?? '江湖'} / ${jianghuView === 'combat' && session.combat ? '战斗' : ({ stages: '关卡', factions: '势力', towns: '城镇', city: '城市' })[jianghuSection]}`
      : undefined,
    heroes,
    rosterHeroes,
    rosterQuery: heroRosterQuery,
    rosterGradeFilter: heroRosterGradeFilter,
    rosterCategoryFilter: heroRosterCategoryFilter,
    careerTreeOpen,
    treeNodes,
    treeLinks: CAREERS.flatMap((career) => career.requirements.map((requirement) => ({
      fromId: requirement.careerId,
      toId: career.id,
    }))),
    treeDetail,
    equipment,
    pack,
  }
}

const formationSourceLabel = (definition: (typeof HEROES_V10)[number]): string => {
  if (definition.source === 'starter') return '本队主角'
  if (definition.source === 'tavern') return '酒馆相逢'
  return `${FACTIONS.find((faction) => faction.id === definition.factionId)?.name ?? '势力'}门人`
}

const formationLocked = (): boolean => Boolean(session.combat || session.pendingCombatRestart)

const formationViewModel = (): FormationPageViewModel => {
  if (formationLocked()) formationSelectedHeroId = null
  const heroes = recruitedHeroes().map(({ definition, progress, name }) => {
    const currentCareer = careerById(progress.currentCareerId) ?? careerById(definition.baseCareerId)
    const careerRecord = progress.careers[progress.currentCareerId]
    const combatStats = buildCombatStats(definition, progress, session.state.inventory, session.state.unlockedSkinIds)
    return {
      id: definition.id,
      name,
      grade: definition.grade,
      level: progress.level,
      inFormation: session.state.formation.some((slot) => slot.heroId === definition.id),
      category: heroMeridianCategory(definition),
      source: formationSourceLabel(definition),
      careerName: currentCareer?.name ?? progress.currentCareerId,
      careerLevel: careerRecord?.level ?? 1,
      aptitudes: definition.aptitudes,
      combatStats: {
        maxHp: combatStats.maxHp,
        externalAttack: combatStats.externalAttack,
        internalAttack: combatStats.internalAttack,
        externalDefense: combatStats.externalDefense,
        internalDefense: combatStats.internalDefense,
        effectiveAgility: combatStats.effectiveAgility,
      },
      slot: session.state.formation.find((slot) => slot.heroId === definition.id) ?? null,
    }
  })
  const selectedHeroId = heroes.some((hero) => hero.id === formationDetailHeroId)
    ? formationDetailHeroId
    : session.state.formation[0]?.heroId ?? heroes[0]?.id ?? null
  formationDetailHeroId = selectedHeroId
  return { formation: session.state.formation, selectedHeroId, filter: formationFilter, heroes, locked: formationLocked() }
}

const formationFilterOptions: FormationFilter[] = ['all', '剑', '刀', '拳', '暗', '医', '内家']

const formationHeroCategory = (heroId: string): FormationFilter | null => {
  const definition = heroByIdV10(heroId)
  if (!definition || !session.state.heroes[heroId]) return null
  return heroMeridianCategory(definition)
}

// 自动列阵站位序：近战自中路前列铺开，远程/辅助居第三、四列
const AUTO_FRONT_SLOTS: Array<{ row: FormationRow; col: FormationColumn }> = [
  { row: 1, col: 0 }, { row: 0, col: 0 }, { row: 2, col: 0 },
  { row: 1, col: 1 }, { row: 0, col: 1 }, { row: 2, col: 1 },
]
const AUTO_BACK_SLOTS: Array<{ row: FormationRow; col: FormationColumn }> = [
  { row: 1, col: 2 }, { row: 0, col: 2 }, { row: 2, col: 2 },
  { row: 1, col: 3 }, { row: 0, col: 3 }, { row: 2, col: 3 },
]

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
      return category === '拳' || category === '刀' || category === '剑'
    })
    .sort((left, right) => stableCompare(left, right, constitutionOf))
  const others = placedIds
    .filter((heroId) => !frontPreferred.includes(heroId))
    .sort((left, right) => stableCompare(left, right, levelOf))

  session.state.formation = [
    ...frontPreferred.map((heroId, index) => ({ heroId, ...AUTO_FRONT_SLOTS[index] })),
    ...others.map((heroId, index) => ({ heroId, ...AUTO_BACK_SLOTS[index] })),
  ]
  return { ok: true, message: '自动列阵毕 · 近者居前 远者居后' }
}

const clearFormation = (): ActionResult => {
  if (!session.state.formation.length) return { ok: false, message: '阵中本就无人' }
  session.state.formation = []
  return { ok: true, message: '已悉数下阵' }
}

const factionExchangeViewModel = (factionId: string): FactionExchangeViewModel | null => {
  const faction = FACTIONS.find((candidate) => candidate.id === factionId)
  if (!faction || !session.state.unlockedFactionIds.includes(factionId)) return null

  const worldIndex = Number(faction.worldId.slice(-2))
  const reputation = session.state.worldReputation[faction.worldId] ?? 0
  const reputationLevel = originalWorldReputationLevel(reputation, worldIndex)
  const contribution = session.state.contribution[factionId] ?? 0
  return {
    factionId,
    factionName: faction.name,
    contribution,
    reputation,
    reputationLevel,
    reputationLevelName: originalWorldReputationLevelName(reputationLevel),
    reputationCurrentThreshold: originalWorldReputationThreshold(reputationLevel, worldIndex),
    reputationNextThreshold: reputationLevel < 5
      ? originalWorldReputationThreshold(reputationLevel + 1, worldIndex)
      : null,
    items: originalFactionExchangeByFaction(faction.originalId).map((item) => {
      const owned = factionExchangeItemOwned(session.state, item)
      const requiredReputationName = item.requiredReputationLevel === null
        ? null
        : originalWorldReputationLevelName(item.requiredReputationLevel)
      let actionReason: string | null = null
      if (item.requiredReputationLevel !== null && reputationLevel < item.requiredReputationLevel) {
        actionReason = `需${requiredReputationName}声望`
      } else if (owned) {
        actionReason = '已拥有'
      } else if (contribution < item.price) {
        actionReason = '贡献不足'
      }
      return {
        slot: item.slot,
        kind: item.kind,
        name: item.originalName,
        price: item.price,
        requiredReputationLevel: item.requiredReputationLevel,
        requiredReputationName,
        quantity: factionExchangeItemQuantity(session.state, item),
        owned,
        actionDisabled: actionReason !== null,
        actionReason,
      }
    }),
  }
}

const factionRecruitmentViewModel = (factionId: string): FactionRecruitmentViewModel | null => {
  const faction = FACTIONS.find((candidate) => candidate.id === factionId)
  if (!faction || !session.state.unlockedFactionIds.includes(factionId)) return null

  const worldIndex = Number(faction.worldId.slice(-2))
  const reputation = session.state.worldReputation[faction.worldId] ?? 0
  const reputationLevel = originalWorldReputationLevel(reputation, worldIndex)
  const resourceName = faction.currencyKind === 'contribution' ? '势力贡献' : '位面货币'
  const balance = faction.currencyKind === 'contribution'
    ? session.state.contribution[faction.id] ?? 0
    : session.state.worldCurrency[faction.worldId] ?? 0
  return {
    factionId,
    factionName: faction.name,
    resourceName,
    balance,
    reputationLevel,
    reputationLevelName: originalWorldReputationLevelName(reputationLevel),
    heroes: originalFactionRecruitmentByFaction(faction.originalId).map((hero) => {
      const heroId = `hero_orig_${hero.heroSourceId}`
      const recruited = Boolean(session.state.heroes[heroId]?.recruited)
      let actionReason: string | null = null
      if (recruited) actionReason = '已邀请'
      else if (isOrdinaryPoolHero(heroId)) actionReason = '普通池招募'
      else if (reputationLevel < hero.requiredReputationLevel) {
        actionReason = `需${hero.requiredReputationName}声望`
      } else if (balance < hero.price) {
        actionReason = `${resourceName}不足`
      }
      return {
        ordinaryPool: isOrdinaryPoolHero(heroId),
        heroSourceId: hero.heroSourceId,
        heroId,
        name: hero.name,
        requiredReputationLevel: hero.requiredReputationLevel,
        requiredReputationName: hero.requiredReputationName,
        price: hero.price,
        aptitudes: hero.aptitudes,
        actionReason,
      }
    }),
  }
}

const factionsViewModel = (): FactionsPageViewModel => {
  const world = WORLDS.find((item) => item.id === selectedWorldId) ?? WORLDS[0]
  const availableFactions = FACTIONS.filter((faction) =>
    faction.worldId === selectedWorldId
    && session.state.unlockedFactionIds.includes(faction.id))
  if (!availableFactions.some((faction) => faction.id === selectedFactionId)) selectedFactionId = availableFactions[0]?.id ?? ''
  const faction = availableFactions.find((item) => item.id === selectedFactionId) ?? availableFactions[0]
  const board = session.state.factionBoards[selectedFactionId]
  const normalizedHeroId = normalizeSelectedHero()
  const heroProgress = normalizedHeroId ? session.state.heroes[normalizedHeroId] : undefined
  const factionMartials = FACTION_MARTIALS.filter((martial) => martial.factionId === selectedFactionId)
  if (!factionMartials.some((martial) => martial.id === selectedFactionMartialId)) {
    selectedFactionMartialId = factionMartials[0]?.id ?? null
  }

  const martialViews = factionMartials.map((martial) => {
    const learnedRecord = heroProgress?.learnedMartials[martial.id]
    const learned = Boolean(learnedRecord)
    const level = learnedRecord?.level ?? 0
    const previous = martial.previousId ? martialByIdV10(martial.previousId) : undefined
    const previousReady = !martial.previousId
      || Boolean(previous && heroProgress?.learnedMartials[martial.previousId]?.level === previous.maxLevel)
    const state: FactionMartialState = learned ? 'learned' : previousReady ? 'next' : 'locked'
    const targetLevel = learned ? Math.min(martial.maxLevel, level + 1) : 1
    const resourceCost = martialResourceCost(martial.currencySource.kind, martial.difficulty, targetLevel)
    const spCost = martialSpCost(martial.difficulty, targetLevel)
    const resourceWallet = martial.currencySource.kind === 'contribution' ? session.state.contribution : session.state.worldCurrency
    const availableResource = resourceWallet[martial.currencySource.id] ?? 0
    const availableSp = heroProgress?.skillPoints ?? 0
    const careerCompatible = Boolean(heroProgress && isMartialCareerCompatible(heroProgress.currentCareerId, martial))
    let actionReason: string | null = null
    if (!normalizedHeroId) actionReason = '请先选择研习对象'
    else if (learned && level >= martial.maxLevel) actionReason = '已臻化境'
    else if (!learned && !previousReady) actionReason = `前置未满 · Lv.${previous?.maxLevel ?? 1}`
    else if (!careerCompatible) actionReason = '职不符 · 不可传'
    else if (Object.keys(heroProgress?.learnedMartials ?? {}).length >= 12 && !learned) actionReason = '已满 12 门'
    else if (availableSp < spCost) actionReason = `技能点不足 · 需 ${spCost} SP`
    else if (availableResource < resourceCost) actionReason = martial.currencySource.kind === 'contribution' ? '贡献不足' : '位面货币不足'

    return withLore({
      id: martial.id,
      name: martial.name,
      stage: martial.stage,
      rarity: martial.rarity,
      cost: resourceCost,
      upgradeCost: resourceCost,
      spCost,
      availableSp,
      resourceKind: martial.currencySource.kind,
      resourceName: martial.currencySource.kind === 'contribution' ? '势力贡献' : '位面货币',
      learned,
      level,
      maxLevel: martial.maxLevel,
      currentEffect: learned ? martialEffectAtLevel(martial, level) : null,
      nextEffect: level < martial.maxLevel ? martialEffectAtLevel(martial, targetLevel) : null,
      currentBuffChance: learned && martial.buffId ? martialBuffChanceAtLevel(martial, level) : null,
      nextBuffChance: level < martial.maxLevel && martial.buffId ? martialBuffChanceAtLevel(martial, targetLevel) : null,
      sourceName: faction?.name ?? '特殊来源',
      refundableSp: learnedRecord?.investedSp ?? 0,
      state,
      energyCost: martial.energyCost,
      cooldownMs: martial.cooldownMs,
      power: martial.power,
      previousName: previous?.name ?? null,
      previousMaxLevel: previous?.maxLevel ?? null,
      careerNames: [...new Set(martial.careerIds.map((careerId) => careerNameById(careerId)))],
      careerCompatible,
      affordable: availableSp >= spCost && availableResource >= resourceCost,
      actionDisabled: actionReason !== null,
      actionReason,
      selected: martial.id === selectedFactionMartialId,
    }, MARTIAL_LORE[martial.id])
  })
  const selectedMartial = martialViews.find((martial) => martial.id === selectedFactionMartialId) ?? null
  const selectedMartialDefinition = factionMartials.find((martial) => martial.id === selectedFactionMartialId)
  const recruited = recruitedHeroes()
  const rosterQuery = factionRosterQuery.trim()
  const roster = recruited
    .filter(({ name }) => !rosterQuery || name.includes(rosterQuery))
    .map(({ definition, progress, name }) => {
      const heroFaction = definition.factionId ? FACTIONS.find((item) => item.id === definition.factionId) : undefined
      return {
        id: definition.id,
        name,
        grade: definition.source === 'starter' ? '主' : definition.grade,
        factionName: heroFaction?.name ?? '江湖散人',
        compatible: Boolean(selectedMartialDefinition && isMartialCareerCompatible(progress.currentCareerId, selectedMartialDefinition)),
        selected: definition.id === normalizedHeroId,
        isPlayer: definition.source === 'starter',
      }
    })
  const selectedHero = roster.find((hero) => hero.id === normalizedHeroId) ?? null
  return {
    worldIndex: world.index,
    worldName: world.name,
    selectedFactionId,
    exchange: faction ? factionExchangeViewModel(faction.id) : null,
    recruitment: faction ? factionRecruitmentViewModel(faction.id) : null,
    factions: availableFactions.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      branchNames: [item.branchLabels[0], item.branchLabels[1]],
      contribution: session.state.contribution[item.id] ?? 0,
      selected: item.id === selectedFactionId,
    })),
    refreshRemainingMs: board?.refreshRemainingMs ?? 0,
    quests: Array.from({ length: 5 }, (_, slot) => {
      const quest = board?.slots[slot]
      if (!quest || !faction) return { slot, quest: null }
      const accepted = quest.acceptedRecordId > 0
        ? session.state.acceptedFactionQuests[String(quest.acceptedRecordId)]
        : undefined
      const targetCount = accepted?.requiredAmount
        ?? originalFactionTaskRequiredAmount(quest.taskId, quest.quality, world.index)
        ?? 0
      const progress = accepted ? factionQuestCurrentProgress(session.state, accepted) : 0
      const task = originalFactionTaskDefinitionById(quest.taskId)
      const reward = originalFactionTaskReward(quest.taskId, quest.quality, world.index)
      return {
        slot,
        quest: {
          id: quest.id,
          taskId: quest.taskId,
          taskName: task?.name ?? '未知任务',
          actionName: task?.actionName ?? '任务',
          targetKind: task?.targetKind ?? '目标',
          quality: quest.quality,
          targetName: originalFactionTaskTargetName(world.index, quest.taskId, quest.targetId),
          equipmentQuality: quest.taskId === 5 ? quest.targetId : undefined,
          progress,
          targetCount,
          rewardContribution: reward.contribution,
          rewardReputation: reward.reputation,
          accepted: Boolean(accepted),
          completed: Boolean(accepted && progress >= targetCount),
          settled: quest.acceptedRecordId < 0,
        },
      }
    }),
    branches: (faction?.branchLabels ?? []).map((branch) => ({
      name: branch,
      martials: martialViews.filter((martial) => factionMartials.find((definition) => definition.id === martial.id)?.branch === branch),
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

const tavernHeroesForWorld = (worldId: string): TownsPageViewModel['tavernHeroes'] =>
  TAVERN_HEROES.filter((hero) => hero.worldId === worldId).map((hero) => {
    const career = careerById(hero.baseCareerId)
    return {
      id: hero.id,
      name: hero.name,
      grade: hero.grade,
      category: heroMeridianCategory(hero),
      careerName: career?.name ?? '白丁',
      cost: hero.cost,
      recruited: Boolean(session.state.heroes[hero.id]?.recruited),
      line: hero.line ?? null,
    }
  })

const activeCombatHeroIds = (): Set<string> => session.combat?.state.result === 'fighting'
  ? new Set(session.combat.state.party.map((hero) => hero.id))
  : new Set()

const factionAgentViewModel = (worldId: string, worldName: string): NonNullable<TownsPageViewModel['factionAgent']> => {
  const agent = session.state.factionAgents[worldId] ?? { heroId: null, enabled: false }
  const fightingHeroIds = activeCombatHeroIds()
  const heroView = (heroId: string) => {
    const definition = heroByIdV10(heroId)
    const progress = session.state.heroes[heroId]
    if (!definition || !progress?.recruited) return null
    return {
      id: heroId,
      name: heroDisplayNameV10(definition, progress),
      grade: definition.grade,
      category: heroMeridianCategory(definition),
      level: progress.level,
      fighting: fightingHeroIds.has(heroId),
      selected: agent.heroId === heroId,
    }
  }
  const abilityLevel = factionAgentAbilityLevel(session.state, worldId)
  return {
    worldId,
    worldName,
    enabled: agent.enabled,
    currentAgent: agent.heroId ? heroView(agent.heroId) : null,
    candidates: factionAgentCandidateIds(session.state).flatMap((heroId) => {
      const candidate = heroView(heroId)
      return candidate ? [candidate] : []
    }),
    abilityLevel,
    contributionBonusPercent: Math.round((originalFactionAgentContributionMultiplier(abilityLevel) - 1) * 100),
    reputationBonusPercent: Math.round((originalFactionAgentReputationMultiplier(abilityLevel) - 1) * 100),
    taskAutomationAvailable: factionAgentAutomationAvailable(session.state, worldId),
    taskFilters: AGENT_TASK_FILTER_NAMES.map((name, offset) => {
      const taskId = offset + 1
      return {
        taskId,
        name,
        column: AGENT_FILTER.taskEnabledColumn,
        allowed: !isFactionAgentColumnExcluded(session.state, worldId, taskId, AGENT_FILTER.taskEnabledColumn),
        qualities: Array.from({ length: 6 }, (_, qualityOffset) => {
          const quality = qualityOffset + 1
          const column = originalAgentFilterQualityColumn(quality)
          return {
            quality,
            column: column ?? 0,
            allowed: !isFactionAgentColumnExcluded(session.state, worldId, taskId, column),
          }
        }),
      }
    }),
    acceptedTaskCount: Object.keys(session.state.acceptedFactionQuests).length,
    concurrentTaskLimit: AGENT_CONCURRENT_TASK_LIMIT,
  }
}

const townsViewModel = (): TownsPageViewModel => {
  const world = WORLDS.find((item) => item.id === selectedWorldId) ?? WORLDS[0]
  const town = originalWorldTownByIndex(world.index)
  const factionTowns = town?.factionTowns.map((factionTown) => {
    const faction = factionByOriginalId(factionTown.factionSourceId)
    return {
      name: factionTown.name,
      factionId: faction?.id ?? '',
      factionName: faction?.name ?? '未知势力',
      unlocked: Boolean(faction && session.state.unlockedFactionIds.includes(faction.id)),
      selected: false,
      functions: factionTown.functions.map((fn) => fn.name),
    }
  }) ?? []
  const selectedTownFactionId = factionTowns.find((candidate) =>
    candidate.unlocked && candidate.factionId === selectedFactionId)?.factionId
    ?? factionTowns.find((candidate) => candidate.unlocked)?.factionId
    ?? null
  return {
    worldIndex: world.index,
    worldName: world.name,
    mainCityName: town?.mainCity.name ?? world.name,
    worldCurrency: session.state.worldCurrency[world.id] ?? 0,
    publicLocations: town?.publicLocations.map((location) => ({
      name: location.name,
      npcTitle: location.npcTitle && location.npcTitle !== '无' ? location.npcTitle : null,
      functions: location.functions.map((fn) => fn.name),
      tavern: location.functions.some((fn) => fn.sourceId === 5),
      agent: location.functions.some((fn) => fn.sourceId === 35),
    })) ?? [],
    factionTowns: factionTowns.map((candidate) => ({
      ...candidate,
      selected: candidate.factionId === selectedTownFactionId,
    })),
    factionAgent: townFactionFunction === 'agent'
      ? factionAgentViewModel(world.id, world.name)
      : null,
    factionExchange: townFactionFunction === 'exchange' && selectedTownFactionId
      ? factionExchangeViewModel(selectedTownFactionId)
      : null,
    factionRecruitment: townFactionFunction === 'recruitment' && selectedTownFactionId
      ? factionRecruitmentViewModel(selectedTownFactionId)
      : null,
    tavernHeroes: tavernHeroesForWorld(world.id),
  }
}

const cityViewModel = (): CityPageViewModel => {
  const effectiveGrid = cityEffectiveGrid(session.state)
  const totals = cityTotals(session.state)
  const selectedTile = cityTileById(session.state, selectedCityTileId) ?? session.state.city.tiles[0]
  selectedCityTileId = selectedTile.tileId
  const selectedBuilding = originalCityBuildingById(selectedTile.buildingId)
  const specialPricePending = selectedTile.tileId === 48
  const finance = session.state.city.company.currentFinance
  const cleanOriginalText = (value: string): string => value.replace(/\[\/?color(?:=[^\]]+)?\]/gi, '')
  const shop = session.state.city.shop
  const available = backpackEquipment(session.state).filter(item => !item.locked)
  const pageCount = Math.max(1, Math.ceil(available.length / 6))
  cityStockPage = Math.min(pageCount, Math.max(1, cityStockPage))
  const itemView = (item: typeof session.state.inventory[number]) => ({
    uid: item.uid, name: equipmentDisplayName(equipmentDefinitionById(item.definitionId)!, item.affixes),
    level: item.level, quality: item.quality, price: cityShopSalePrice(session.state, item),
  })
  return {
    section: cityPageSection,
    shop: {
      tileId: shop.tileId, level: cityShopTile(session.state)?.buildingLevel ?? 1,
      enabled: shop.enabled, status: cityShopStatus(session.state), introStep: shop.introStep,
      cash: session.state.city.company.cash, revenue: shop.revenue, soldCount: shop.soldCount,
      experience: shop.experience, customers: shop.customers, capacity: CITY_SHOP_CAPACITY,
      stock: shop.stock.map(itemView), availableItems: available.slice((cityStockPage - 1) * 6, cityStockPage * 6).map(itemView),
      availableCount: available.length, page: cityStockPage, pageCount, hiringSlot: cityHiringSlot,
      staff: shop.staff.slice(0, cityShopStaffCount(session.state)).map((worker, slot) => ({
        slot, heroId: worker.heroId, name: worker.heroId ? heroDisplayNameV10(heroByIdV10(worker.heroId)!, session.state.heroes[worker.heroId]) : '虚位以待',
        ability: worker.heroId ? cityShopAbility(session.state, worker.heroId) : 0,
        progress: worker.progress / 10, serving: worker.serving,
        seconds: worker.heroId ? Math.ceil(1000 / cityShopProgressPerSecond(session.state, worker.heroId)) : 0,
      })),
      candidates: HEROES_V10.filter(hero => session.state.heroes[hero.id]?.recruited).map(hero => ({
        id: hero.id, name: heroDisplayNameV10(hero, session.state.heroes[hero.id]), ability: cityShopAbility(session.state, hero.id),
        reason: shop.staff.some(worker => worker.heroId === hero.id) ? '已在店中任职' : cityShopWorkerReason(session.state, hero.id, activeCombatHeroIds()),
      })),
      receipts: shop.receipts.map(receipt => ({ sequence: receipt.sequence, name: equipmentDefinitionById(receipt.definitionId)?.name ?? '装备', amount: receipt.amount })),
    },
    gridColumns: ORIGINAL_CITY_FOUNDATION.gridColumns,
    gridRows: ORIGINAL_CITY_FOUNDATION.gridRows,
    effectiveColumns: effectiveGrid.columns,
    effectiveRows: effectiveGrid.rows,
    buildingCount: ORIGINAL_CITY_FOUNDATION.buildings,
    technologyCount: ORIGINAL_CITY_FOUNDATION.technologies,
    cityLevel: session.state.city.level,
    development: cityDevelopment(session.state),
    ...totals,
    tiles: session.state.city.tiles.map((tile) => {
      const building = originalCityBuildingById(tile.buildingId)
      return {
        tileId: tile.tileId,
        buildingName: building?.name ?? '空地',
        buildingType: building?.buildingType ?? '无',
        buildingLevel: tile.buildingLevel,
        owned: tile.owned,
        buildable: tile.buildable,
        locked: tile.gridX >= effectiveGrid.columns || tile.gridY >= effectiveGrid.rows,
        selected: tile.tileId === selectedTile.tileId,
      }
    }),
    selectedTile: {
      tileId: selectedTile.tileId,
      coordinates: `${selectedTile.gridX + 1} 行 · ${selectedTile.gridY + 1} 列`,
      buildingName: selectedBuilding?.name ?? '空地',
      buildingType: selectedBuilding?.buildingType ?? '无',
      buildingLevel: selectedTile.buildingLevel,
      description: cleanOriginalText(selectedBuilding?.description ?? '可开发的建设用地。'),
      owned: selectedTile.owned,
      buildable: selectedTile.buildable,
      landPriceTier: selectedTile.landPriceTier,
      population: selectedTile.population,
      commerce: selectedTile.commerce,
      industry: selectedTile.industry,
      purchasePrice: specialPricePending ? null : cityTilePrice(session.state, selectedTile, 'buy'),
      salePrice: specialPricePending ? null : cityTilePrice(session.state, selectedTile, 'sell'),
      priceNote: specialPricePending ? ORIGINAL_CITY_PENDING_RULES.specialTile48Unlock : null,
    },
    company: {
      name: session.state.city.company.name,
      cash: session.state.city.company.cash,
      ownedLandCount: session.state.city.tiles.filter((tile) => tile.owned).length,
      ownedLandValue: cityOwnedLandValue(session.state),
      baseMonthlyRent: cityBaseMonthlyRent(session.state),
      previousNetIncome: session.state.city.company.previousNetIncome,
      finance: [
        { name: '销售收入', amount: finance.销售收入, expense: false },
        { name: '租金收入', amount: finance.租金收入, expense: false },
        { name: '门票收入', amount: finance.门票收入, expense: false },
        { name: '其他收入', amount: finance.其他收入, expense: false },
        { name: '科研支出', amount: finance.科研支出, expense: true },
        { name: '建造支出', amount: finance.建造支出, expense: true },
        { name: '其他支出', amount: finance.其他支出, expense: true },
      ],
      registrationCost: ORIGINAL_CITY_CONSTANTS.companyRegistrationCost,
      nameRuleReason: ORIGINAL_CITY_PENDING_RULES.companyNameValidation,
      positionRuleReason: ORIGINAL_CITY_PENDING_RULES.companyPositionBonuses,
    },
  }
}

const inventorySlotNames = EQUIPMENT_SLOT_NAMES

const inventoryItemView = (item: EquipmentInstance): InventoryItemView => {
  const definition = equipmentDefinitionById(item.definitionId)
  const slot = definition?.slot ?? 'weapon'
  const artifactSoul = artifactSoulById(definition?.artifactSoulId)
  const manualSkill = definition?.grantSkillId ? martialByOriginalId(definition.grantSkillId) : undefined
  const sourceItemKey = String(definition?.sourceItemId ?? definition?.id ?? '')
  const plainOriginalText = (value: string): string => value
    .replace(/\[color=[^\]]+\]/gi, '')
    .replace(/\[\/color\]/gi, '')
  return {
    uid: item.uid,
    definitionId: item.definitionId,
    name: definition ? equipmentDisplayName(definition, item.affixes) : '无名装备',
    slot,
    slotName: inventorySlotNames[slot],
    level: item.level,
    equipmentLevel: item.equipmentLevel ?? equipmentWearLevel(item.level, item.quality),
    quality: item.quality,
    locked: item.locked,
    weaponTypeName: definition?.weaponTypeName,
    equipmentKindLabel: definition?.equipmentKind === 'artifact-soul'
      ? `固定器魂装备 · ${artifactSoul?.tier ?? item.quality - 6} 阶`
      : definition?.equipmentKind === 'treasure-manual'
        ? '至宝秘籍'
        : definition?.equipmentKind === 'treasure'
          ? '诸天至宝'
          : undefined,
    description: definition?.description,
    fixedEffects: definition?.fixedEffects?.map((effect) => ({
      attributeId: effect.attributeId,
      name: ATTRIBUTE_BY_ID[effect.attributeId]?.name ?? `属性 ${effect.attributeId}`,
      value: effect.value,
      formattedValue: formatEquipmentAttributeValue(effect.attributeId, effect.value),
    })),
    artifactSoul: artifactSoul ? {
      name: artifactSoul.name,
      tier: artifactSoul.tier,
      description: plainOriginalText(artifactSoul.description).replace('词条名', artifactSoul.name).replace('数值', String(artifactSoul.value)),
      formattedValue: formatEquipmentAttributeValue(artifactSoul.attributeId, artifactSoul.value),
    } : undefined,
    manualSkill: manualSkill ? {
      name: manualSkill.name,
      learned: Boolean(session.state.treasureManualGrants[sourceItemKey]),
    } : undefined,
    coreStats: item.coreStats.map((core, index) => {
      const template = definition?.coreStats[index]
      const value = equipmentAttributeValue(core.attributeId, item.level, core.coefficient, 100)
      return {
        attributeId: core.attributeId,
        name: ATTRIBUTE_BY_ID[core.attributeId]?.name ?? `属性 ${core.attributeId}`,
        value,
        formattedValue: formatEquipmentAttributeValue(core.attributeId, value),
        rollPercent: template ? equipmentCoreRollPercent(core.coefficient, template.baseCoefficient) : 100,
      }
    }),
    affixes: item.affixes.map((affix) => {
      const value = equipmentAttributeValue(affix.attributeId, item.level, affix.coefficient, 50)
      return {
        attributeId: affix.attributeId,
        name: ATTRIBUTE_BY_ID[affix.attributeId]?.name ?? `属性 ${affix.attributeId}`,
        value,
        formattedValue: formatEquipmentAttributeValue(affix.attributeId, value),
        grade: equipmentAffixGrade(affix.coefficient),
      }
    }),
  }
}

const inventoryViewModel = (): InventoryPageViewModel => {
  const allItems = backpackEquipment(session.state).map(inventoryItemView)
  const allStacks = Object.entries(session.state.materials).filter(([, quantity]) => quantity > 0).map(([key, quantity]) => {
    const id = Number(key)
    const definition = STACK_ITEM_DEFINITIONS[id]
    return { id, quantity, name: definition?.name ?? `未知物品 ${key}`, kind: definition?.kind ?? 'special' as const,
      quality: definition?.quality ?? 0, description: definition?.description ?? '' }
  }).sort((a, b) => a.id - b.id)
  const query = inventoryQuery.trim().toLocaleLowerCase()
  const visibleItems = allItems.filter(item => (inventoryCategory === 'all' || inventoryCategory === 'equipment')
    && (inventorySlotFilter === 'all' || item.slot === inventorySlotFilter) && item.name.toLocaleLowerCase().includes(query))
  const stacks = allStacks.filter(item => (inventoryCategory === 'all' || item.kind === inventoryCategory)
    && item.name.toLocaleLowerCase().includes(query))
  let selectedStack = stacks.find(item => item.id === selectedStackId) ?? null
  let selectedItem = selectedStack ? null : visibleItems.find(item => item.uid === selectedInventoryUid) ?? null
  if (!selectedStack && !selectedItem) {
    selectedItem = visibleItems[0] ?? null
    selectedStack = selectedItem ? null : stacks[0] ?? null
  }
  selectedInventoryUid = selectedItem?.uid ?? null
  selectedStackId = selectedStack?.id ?? null
  const slotTabs = [
    { id: 'all' as const, name: '全部', count: allItems.length },
    ...EQUIPMENT_SLOTS.map((slot) => ({ id: slot, name: inventorySlotNames[slot], count: allItems.filter((item) => item.slot === slot).length })),
  ]
  const qualityCounts = EQUIPMENT_QUALITIES.reduce((counts, quality) => {
    counts[quality] = allItems.filter((item) => item.quality === quality).length
    return counts
  }, {} as Record<EquipmentQuality, number>)
  const world = WORLDS.find((item) => item.id === selectedWorldId) ?? WORLDS[0]
  const currency = session.state.worldCurrency[world.id] ?? 0
  return {
    worldName: world.name,
    category: inventoryCategory,
    query: inventoryQuery,
    categoryCounts: { all: allItems.length + allStacks.length, equipment: allItems.length,
      material: allStacks.filter(item => item.kind === 'material').length,
      special: allStacks.filter(item => item.kind === 'special').length },
    stacks,
    selectedStack,
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
    shop: {
      worldName: world.name,
      currencyName: world.currencyName,
      currency,
      rank: shopRank,
      ranks: JOB_BOOK_SHOP_RANKS.map((rank) => ({ id: rank, name: JOB_BOOK_SHOP_TIER_LABELS[rank] })),
      items: shopJobBooksForRank(shopRank).map((item) => ({
        ...item,
        owned: session.state.jobBooks[item.careerId] ?? 0,
        affordable: currency >= item.price,
      })),
    },
  }
}

const originalMaterialCount = (itemId: number): number => session.state.materials[String(itemId)] ?? 0

const originalWorldName = (worldIndex: number): string =>
  WORLDS.find((world) => world.index === worldIndex)?.name ?? `第${worldIndex}位面`

const progressionItemLevel = (): number => Math.max(
  1,
  ...Object.values(session.state.heroes).filter((hero) => hero.recruited).map((hero) => hero.level),
)

const percentText = (probability: number): string => `${(probability * 100).toFixed(2)}%`

const shrinePhaseLabel: Record<string, string> = {
  raid: '突袭',
  siege: '包围',
  occupation: '占领',
  subdued: '完全臣服',
}

const progressionViewModel = (): ProgressionPageViewModel => {
  const dungeonDifficulty = Math.max(1, progressionDungeonDifficulty)
  const dungeons = ORIGINAL_LARGE_DUNGEONS.map((dungeon) => {
    const battleDifficulty = largeDungeonBattleDifficulty(dungeonDifficulty, dungeon.id, 4)
    return {
      id: dungeon.id,
      name: dungeon.name,
      worldName: originalWorldName(dungeon.worldIndex),
      clears: session.state.largeDungeonClears[String(dungeon.id)] ?? 0,
      difficulty: dungeonDifficulty,
      stageNames: dungeon.stageNames,
      rewards: dungeon.rewards.map((reward) => ({
        name: reward.item.name,
        kind: reward.kind === 'equipment' ? '装备' : '物品',
        quality: reward.item.quality,
        probability: percentText(largeDungeonDropProbability(reward.baseRoll, battleDifficulty)),
      })),
    }
  })

  const beasts = ORIGINAL_SACRED_BEASTS.map((beast) => {
    const progress = session.state.sacredBeasts[String(beast.id)]
      ?? { highestClearedStage: 0, claimedStages: [] }
    const unclaimed = beast.stages.find((stage) =>
      stage.stage <= progress.highestClearedStage && !progress.claimedStages.includes(stage.stage))
    const focus = unclaimed ?? beast.stages.find((stage) => stage.stage === progress.highestClearedStage + 1)
    return {
      id: beast.id,
      name: beast.name,
      worldName: originalWorldName(beast.worldIndex),
      highestClearedStage: progress.highestClearedStage,
      nextStage: focus ? {
        stage: focus.stage,
        equipmentName: focus.equipment.name,
        battleDifficulty: sacredBeastBattleDifficulty(beast.id, focus.stage),
        reincarnationCleared: isSacredBeastUnlocked(session.state, beast.id),
        cleared: focus.stage <= progress.highestClearedStage,
        claimed: progress.claimedStages.includes(focus.stage),
      } : null,
    }
  })

  const sacredStages: Array<{ equipment: { recipeId: number | null; name: string } }> = []
  for (const beast of ORIGINAL_SACRED_BEASTS) sacredStages.push(...beast.stages)
  const recipes = sacredStages
    .filter((stage) => {
      const recipeId = stage.equipment.recipeId
      return recipeId && ((session.state.blueprints[String(recipeId)] ?? 0) > 0 || session.state.unlockedRecipeIds.includes(recipeId))
    })
    .map((stage) => ({
      recipeId: stage.equipment.recipeId!,
      equipmentName: stage.equipment.name,
      blueprintCount: session.state.blueprints[String(stage.equipment.recipeId)] ?? 0,
      unlocked: session.state.unlockedRecipeIds.includes(stage.equipment.recipeId!),
    }))

  const divineUnlocked = isDivineRealmUnlocked(session.state.infiniteTowerFloor)
  const shrines = ORIGINAL_DEITIES.map((deity) => {
    const shrine = session.state.shrines[String(deity.shrineId)] ?? { phase: 'raid' as const, progress: 0 }
    const progress = session.state.deities[String(deity.id)]
    return {
      shrineId: deity.shrineId,
      deityId: deity.id,
      shrineName: deity.shrineName,
      bossName: deity.bossName,
      skillName: martialByOriginalId(deity.skillId)?.name ?? '未知神技',
      imperialWeaponName: deity.imperialWeapon.name,
      unlockDivineLevel: deity.unlockDivineLevel,
      phaseLabel: shrinePhaseLabel[shrine.phase] ?? shrine.phase,
      progress: shrine.progress,
      subdued: shrine.phase === 'subdued',
      deityLevel: progress?.level ?? null,
      upgradeCost: progress ? deityUpgradeCost(progress.level) : null,
    }
  })

  const forgeEquipment = session.state.inventory.flatMap((equipment) => {
    if (equipment.quality !== 8) return []
    const definition = equipmentDefinitionById(equipment.definitionId)
    if (!definition) return []
    const sourceItemId = Number(equipment.definitionId.replace(/\D/g, ''))
    const upgrade = ORIGINAL_SACRED_UPGRADES.find((candidate) => candidate.source.itemId === sourceItemId)
    return [{
      uid: equipment.uid,
      name: equipmentDisplayName(definition, equipment.affixes),
      slotName: EQUIPMENT_SLOT_NAMES[definition.slot],
      selected: equipment.uid === selectedProgressionEquipmentUid,
      sacredTargetName: upgrade?.target.name ?? null,
    }]
  })
  if (!forgeEquipment.some((equipment) => equipment.uid === selectedProgressionEquipmentUid)) {
    selectedProgressionEquipmentUid = forgeEquipment[0]?.uid ?? null
    if (forgeEquipment[0]) forgeEquipment[0].selected = true
  }

  return {
    section: progressionSection,
    resources: {
      worldTreeLeaves: originalMaterialCount(WORLD_TREE_LEAF_ITEM_ID),
      creationOrigin: originalMaterialCount(CREATION_ORIGIN_ITEM_ID),
      brokenDivinity: originalMaterialCount(BROKEN_DIVINITY_ITEM_ID),
      starSoul: session.state.starSoul,
    },
    dungeons,
    beasts,
    recipes,
    divine: {
      unlocked: divineUnlocked,
      infiniteTowerFloor: session.state.infiniteTowerFloor,
      divineLadderFloor: session.state.divineLadderFloor,
      divineRankLevel: session.state.divineRankLevel,
      shrines,
    },
    forge: {
      selectedUid: selectedProgressionEquipmentUid,
      equipment: forgeEquipment,
      imperialTargets: ORIGINAL_DEITIES.map((deity) => ({
        shrineId: deity.shrineId,
        shrineName: deity.shrineName,
        weaponName: deity.imperialWeapon.name,
        unlocked: session.state.shrines[String(deity.shrineId)]?.phase === 'subdued',
      })),
    },
    interworld: ORIGINAL_INTERWORLD_ENEMIES.map((enemy) => ({
      enemyId: enemy.enemyId,
      name: enemy.name,
      rank: enemy.rank,
      enabled: divineUnlocked,
      drops: enemy.itemIds.flatMap((itemId) => {
        const item = ORIGINAL_INTERWORLD_DROP_ITEMS.find((candidate) => candidate.itemId === itemId)
        return item ? [{ name: item.name, probability: percentText(interworldDropProbability(item.baseRoll, 0)) }] : []
      }),
    })),
  }
}

const normalizeSelectedWorld = (): void => {
  if (!WORLDS.some((world) => world.id === selectedPlaneId)) selectedPlaneId = WORLDS[0].id
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
  if (jianghuSection === 'towns') return renderTownsPage(townsViewModel())
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

// 每个页面保留独立滚动位置；切换栏目、侠客或资料页签也有各自的位置。
const navigationLocationKey = (): string => activeTab === 'idle'
  ? `idle:${jianghuView}:${selectedWorldId}:${jianghuSection}:${selectedDifficulty}`
  : activeTab === 'heroes' ? `heroes:${selectedHeroId}:${heroMainTab}` : activeTab

const rememberPageScroll = (): void => {
  if (!renderedLocationKey) return
  const positions = [{ selector: 'document', top: window.scrollY, left: window.scrollX }]
  const main = app.querySelector<HTMLElement>('.game-main')
  if (main) for (const element of [main, ...main.querySelectorAll<HTMLElement>('*')]) {
    if (element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth) continue
    const path: string[] = []
    let node: Element = element
    while (node !== main && node.parentElement) {
      path.unshift(`${node.tagName.toLowerCase()}:nth-child(${Array.from(node.parentElement.children).indexOf(node) + 1})`)
      node = node.parentElement
    }
    positions.push({ selector: ['.game-main', ...path].join(' > '), top: element.scrollTop, left: element.scrollLeft })
  }
  pageScrollMemory.set(renderedLocationKey, positions)
}

const restorePageScroll = (key: string): void => {
  for (const position of pageScrollMemory.get(key) ?? [{ selector: 'document', top: 0, left: 0 }, { selector: '.game-main', top: 0, left: 0 }]) {
    if (position.selector === 'document') window.scrollTo({ top: position.top, left: position.left, behavior: 'instant' })
    else app.querySelector<HTMLElement>(position.selector)?.scrollTo({ top: position.top, left: position.left, behavior: 'instant' })
  }
}

const render = (): void => {
  if (!isTabAvailable(activeTab)) activeTab = 'idle'
  if (!isJianghuSectionAvailable(jianghuSection)) jianghuSection = 'stages'
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
  const locationKey = navigationLocationKey()
  const locationChanged = locationKey !== renderedLocationKey
  if (locationChanged) rememberPageScroll()
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
      : activeTab === 'inventory'
        ? renderInventoryPage(inventoryViewModel())
        : activeTab === 'shop'
          ? renderShopPage(session.state, Date.now(), renderOrdinaryHeroPool(ordinaryPoolViewModel()))
        : activeTab === 'settings'
          ? renderSettingsPage(session.state.settings, welfareInput, session.state.redeemedWelfareCodes.includes(WELFARE_CODE_ID))
          : renderProgressionPage(progressionViewModel())
  patchApp(renderShell({
    premiumPanel: premiumPanel ? renderPremiumPanel(session.state, premiumPanel) : '',
    idleVouchers: session.state.idleVouchers,
    voucherDetailsOpen: voucherDetailsOpen || voucherHovered,
    offlineVoucherReward: session.offlineVoucherReward,
    activeTab,
    worldContext: activeTab === 'idle' && jianghuView !== 'worlds'
      ? { worldName: world.name, activeSection: jianghuSection }
      : null,
    hasCombatReturn: Boolean(session.combat && !(activeTab === 'idle' && jianghuView === 'combat')),
    showResetConfirmation,
    jianghuChrome: activeTab === 'idle' && jianghuView !== 'combat',
    content,
  }))
  renderedLocationKey = locationKey
  positionVoucherDetails()
  if (locationChanged) {
    restorePageScroll(locationKey)
    window.requestAnimationFrame(() => {
      if (renderedLocationKey === locationKey) restorePageScroll(locationKey)
    })
  }
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
  if (factionExchangeFocusPending) {
    factionExchangeFocusPending = false
    window.requestAnimationFrame(() => {
      app.querySelector<HTMLElement>('[data-testid="faction-exchange"]')?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    })
  }
  if (factionRecruitmentFocusPending) {
    factionRecruitmentFocusPending = false
    window.requestAnimationFrame(() => {
      app.querySelector<HTMLElement>('[data-testid="faction-recruitment"]')?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    })
  }
  if (factionAgentFocusPending) {
    factionAgentFocusPending = false
    window.requestAnimationFrame(() => {
      app.querySelector<HTMLElement>('[data-testid="faction-agent"]')?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    })
  }
  updateFactionContributionAnimation()
  positionOpenEquipmentTooltip()
  toast.classList.toggle('inventory-toast', activeTab === 'inventory')
  syncInventoryDetailScrollLock()
  playInventoryDropMotion()
  if (activeTab === 'heroes') {
    const nextPageSize = computeHeroPackPageSize()
    if (nextPageSize !== heroPackDynamicPageSize) {
      heroPackDynamicPageSize = nextPageSize
      window.requestAnimationFrame(() => render())
    }
  }
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
  const result = session.startStage({
    worldId: selectedWorldId,
    difficulty: selectedDifficulty,
    stage: selectedStage,
    mode,
    seed,
  })
  notify(result.message, !result.ok)
  if (result.ok) {
    beginCombatPresentation()
    if (!saveSession()) return
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
  const chip = target.closest<HTMLElement>('[data-stat-label]')
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
  const anchor = target.closest<HTMLElement>('[data-stat-label], [data-apt-label]')
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
  if (formationLocked()) { event.preventDefault(); return }
  const source = (event.target as HTMLElement).closest<HTMLElement>('[data-hero-id]')
  if (!source) return
  dragHeroId = dragCandidateHeroId ?? source.dataset.heroId ?? null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    if (dragHeroId) event.dataTransfer.setData('text/plain', dragHeroId)
  }
})

app.addEventListener('dragover', (event) => {
  if (formationLocked()) return
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
  if (formationLocked()) {
    event.preventDefault()
    dragHeroId = dragCandidateHeroId = null
    clearDragOver()
    return
  }
  const droppedHeroId = dragHeroId ?? event.dataTransfer?.getData('text/plain') ?? null
  if (!droppedHeroId) return
  const target = event.target as HTMLElement
  const slot = target.closest<HTMLElement>('.formation-slot')
  if (slot) {
    event.preventDefault()
    const row = dataNumber(slot, 'row') as FormationRow
    const col = dataNumber(slot, 'col') as FormationColumn
    commitAction(placeFormation(session.state, droppedHeroId, row, col))
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
  if (['martial-equip', 'martial-unequip'].includes(action ?? '') && (session.combat || session.pendingCombatRestart)) {
    notify('战斗进行中，结束或退出战斗后可调整武学', true)
    return
  }
  if (['formation-remove', 'formation-auto-arrange', 'formation-clear'].includes(action ?? '') && formationLocked()) {
    notify('战斗进行中，结束或退出战斗后可调整阵容', true)
    return
  }
  if (action === 'formation-remove') commitAction(removeFormation(session.state, heroId))
  else if (action === 'formation-select') {
    formationDetailHeroId = heroId
    formationSelectedHeroId = formationLocked() ? null : heroId
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
    if (formationSelectedHeroId && !formationLocked()) {
      commitAction(placeFormation(session.state, formationSelectedHeroId, dataNumber(button, 'row') as FormationRow, dataNumber(button, 'col') as FormationColumn))
      formationDetailHeroId = formationSelectedHeroId
      formationSelectedHeroId = null
    } else if (slotHeroId) {
      formationDetailHeroId = slotHeroId
    }
  }
  else if (action === 'career-change') {
    const hero = session.state.heroes[heroId]
    if (!hero) notify('侠客尚未加入', true)
    else {
      const result = changeCareer(hero, button.dataset.careerId ?? '', session.state.jobBooks, Boolean(session.combat))
      commitAction(result)
      if (result.ok) careerTreeOpen = false
    }
  } else if (action === 'open-career-tree') {
    careerTreeOpen = true
    selectedTreeCareerId = session.state.heroes[heroId]?.currentCareerId ?? STARTER_CAREER_ID
  } else if (action === 'close-career-tree') {
    careerTreeOpen = false
  } else if (action === 'select-career-node') {
    selectedTreeCareerId = button.dataset.careerId ?? selectedTreeCareerId
  }
  else if (action === 'martial-learn') commitAction(learnFactionMartial(session.state, heroId, button.dataset.martialId ?? ''))
  else if (action === 'martial-upgrade') commitAction(upgradeMartial(session.state, heroId, button.dataset.martialId ?? ''))
  else if (action === 'martial-equip') {
    const result = equipMartial(session.state, heroId, button.dataset.martialId ?? '', dataNumber(button, 'slot'))
    commitAction(result)
    if (result.ok) heroMartialSlot = null
  }
  else if (action === 'martial-unequip') commitAction(unequipMartial(session.state, heroId, dataNumber(button, 'slot')))
  else if (action === 'martial-forget') commitAction(forgetMartial(session.state, heroId, button.dataset.martialId ?? ''))
  else if (action === 'toggle-faction-roster') {
    factionRosterOpen = !factionRosterOpen
    if (!factionRosterOpen) factionRosterQuery = ''
  } else if (action === 'select-faction-hero') {
    selectedHeroId = button.dataset.heroId ?? selectedHeroId
    factionRosterOpen = false
    factionRosterQuery = ''
  }   else if (action === 'select-martial') selectedFactionMartialId = button.dataset.martialId ?? selectedFactionMartialId
  else if (action === 'heart-method-equip') commitAction(equipHeartMethod(session.state, heroId, button.dataset.heartMethodId ?? ''))
  else if (action === 'quest-accept') commitAction(acceptQuest(session.state, button.dataset.factionId ?? '', dataNumber(button, 'slot')))
  else if (action === 'quest-cancel') commitAction(cancelQuest(session.state, button.dataset.factionId ?? '', dataNumber(button, 'slot')))
  else if (action === 'quest-claim') commitAction(claimQuest(session.state, button.dataset.factionId ?? '', dataNumber(button, 'slot')))
  else if (action === 'faction-exchange') {
    const factionId = button.dataset.factionId ?? ''
    selectedFactionId = factionId
    const result = exchangeFactionItem(session.state, factionId, dataNumber(button, 'slot'))
    if (result.ok) startFactionContributionAnimation(session.state.contribution[factionId] ?? 0)
    commitAction(result)
  }
  else if (action === 'ordinary-pool-rules') {
    ordinaryPoolRulesOpen = !ordinaryPoolRulesOpen
  } else if (action === 'ordinary-pool-preview') {
    if (availableOrdinaryPoolHeroes(session.state).some(hero => hero.id === heroId)) ordinaryPoolSelectedId = heroId
  } else if (action === 'ordinary-pool-draw') {
    ordinaryPoolRewards = []
    try {
      const result = session.drawOrdinaryPool(dataNumber(button, 'count'))
      if (result.ok) ordinaryPoolRewards = result.rewards
      notify(result.message, !result.ok)
    } catch (error) { handleSessionSaveError(error) }
  } else if (action === 'open-ordinary-pool') {
    activeTab = 'shop'
  }
  else if (action === 'tavern-recruit') {
    const result = recruitFromTavern(session.state, heroId)
    if (result.ok) {
      selectedHeroId = result.heroId
      if (saveSession()) notify('邀请成功')
    } else notify(result.message, true)
  } else if (action === 'faction-recruit') {
    const factionId = button.dataset.factionId ?? ''
    const result = recruitFromFaction(session.state, factionId, heroId)
    if (result.ok) {
      selectedHeroId = heroId
      if (factionById(factionId)?.currencyKind === 'contribution') {
        startFactionContributionAnimation(session.state.contribution[factionId] ?? 0)
      }
    }
    commitAction(result)
  }
  else if (action === 'inventory-select') {
    selectedStackId = null
    selectedInventoryUid = button.dataset.equipmentUid ?? null
    inventoryDetailOpen = true
  } else if (action === 'inventory-stack-select') {
    selectedStackId = Number(button.dataset.itemId)
    selectedInventoryUid = null
    inventoryDetailOpen = true
  } else if (action === 'inventory-category') {
    const category = button.dataset.category
    if (category === 'all' || category === 'equipment' || category === 'material' || category === 'special') inventoryCategory = category
    inventorySlotFilter = 'all'
  } else if (action === 'inventory-close-detail') {
    inventoryDetailOpen = false
  } else if (action === 'inventory-filter') {
    inventoryCategory = 'equipment'
    selectedStackId = null
    const nextFilter = button.dataset.inventorySlot ?? 'all'
    inventorySlotFilter = nextFilter === 'all' || EQUIPMENT_SLOTS.includes(nextFilter as EquipmentSlot)
      ? nextFilter as EquipmentSlot | 'all'
      : 'all'
    const visibleItems = backpackEquipment(session.state).filter((item) =>
      inventorySlotFilter === 'all' || equipmentDefinitionById(item.definitionId)?.slot === inventorySlotFilter)
    if (!visibleItems.some((item) => item.uid === selectedInventoryUid)) selectedInventoryUid = visibleItems[0]?.uid ?? null
  } else if (action === 'inventory-organize') commitAction(organizeInventory(session.state))
  else if (action === 'inventory-discard-common') {
    const result = discardEquipmentByQuality(session.state, 0)
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
  else if (action === 'shop-rank') {
    const rank = Number(button.dataset.rank)
    if (rank === 2 || rank === 3 || rank === 4 || rank === 5 || rank === 6) shopRank = rank
  } else if (action === 'shop-buy') {
    commitAction(buyJobBook(session.state, button.dataset.careerId ?? '', selectedWorldId || selectedPlaneId))
  } else if (action === 'hero-pack-slot') {
    const nextFilter = button.dataset.inventorySlot ?? 'all'
    heroPackSlotFilter = nextFilter === 'all' || EQUIPMENT_SLOTS.includes(nextFilter as EquipmentSlot)
      ? nextFilter as EquipmentSlot | 'all'
      : 'all'
    heroPackPage = 1
  } else if (action === 'hero-pack-quality') {
    const value = button.dataset.filterValue ?? 'all'
    const quality = Number(value)
    heroPackQualityFilter = value === 'all' ? 'all' : isEquipmentQuality(quality) ? quality : 'all'
    heroPackPage = 1
  } else if (action === 'hero-pack-page') {
    heroPackPage = Math.max(1, dataNumber(button, 'page'))
  }
  else if (action === 'skin-select' || action === 'skin-upgrade') {
    if (session.combat || session.pendingCombatRestart) { notify('战斗期间不能更换或升级皮肤', true); return }
    commitAction((action === 'skin-select' ? selectHeroSkin : upgradeHeroSkin)(session.state, heroId, dataNumber(button, 'skinId')))
  }
  else if (action === 'equipment-build-toggle') heroAutoEquipBuild = heroAutoEquipBuild === 'physical' ? 'magical' : 'physical'
  else if (action === 'equipment-auto-equip') commitAction(equipBestEquipment(session.state, heroId, heroAutoEquipBuild))
  else if (action === 'equipment-equip') commitAction(equipEquipment(session.state, heroId, button.dataset.equipmentUid ?? ''))
  else if (action === 'equipment-unequip') commitAction(unequipEquipment(session.state, heroId, button.dataset.slot ?? ''))
  else if (action === 'equipment-set-switch') commitAction(switchEquipmentSet(session.state, heroId, dataNumber(button, 'setIndex')))
  else if (action === 'equipment-lock') commitAction(toggleEquipmentLock(session.state, button.dataset.equipmentUid ?? ''))
  else if (action === 'organize-hero-inventory') commitAction(organizeInventory(session.state))
  else if (action === 'hero-main-tab') {
    const tab = button.dataset.mainTab
    if (tab === 'basic' || tab === 'equipment' || tab === 'martials' || tab === 'career' || tab === 'skins') heroMainTab = tab
  }
  else if (action === 'hero-martial-slot') {
    const slot = dataNumber(button, 'slot')
    if (slot >= 0 && slot < 4) heroMartialSlot = slot
  }
  else if (action === 'hero-martial-cancel') heroMartialSlot = null
  else if (action === 'open-hero-martials') {
    const martialId = button.dataset.martialId ?? ''
    const hero = session.state.heroes[heroId]
    if (!hero?.recruited || !hero.learnedMartials[martialId]) return
    selectedHeroId = heroId
    heroMainTab = 'martials'
    heroMartialQuery = ''
    heroMartialCategory = 'all'
    highlightedHeroMartialId = martialId
    const emptySlot = hero.equippedMartialIds.indexOf(null)
    heroMartialSlot = emptySlot >= 0 ? emptySlot : null
    activeTab = 'heroes'
  }
  else if (action === 'hero-sell-toggle') {
    heroSellOpen = !heroSellOpen
  }
  else if (action === 'hero-sell-quality') {
    const quality = Number(button.dataset.quality)
    if (isEquipmentQuality(quality)) {
      commitAction(sellEquipmentByQuality(session.state, quality, selectedWorldId || selectedPlaneId))
    }
    heroSellOpen = false
  } else if (action === 'progression-section') {
    const section = button.dataset.section as ProgressionSection
    if (['dungeons', 'beasts', 'divine', 'forge', 'interworld'].includes(section)) progressionSection = section
  } else if (action === 'progression-complete-dungeon') {
    const dungeonId = dataNumber(button, 'dungeonId')
    const clearCount = session.state.largeDungeonClears[String(dungeonId)] ?? 0
    const result = completeLargeDungeon(
      session.state,
      dungeonId,
      progressionDungeonDifficulty,
      progressionItemLevel(),
      `large-dungeon-${dungeonId}-${clearCount + 1}-${Date.now()}`,
      createRng(Date.now() + dungeonId * 97 + clearCount),
    )
    queueInventoryDropAnimations(result.addedEquipmentUids)
    commitAction(result)
  } else if (action === 'progression-clear-beast') {
    const beastId = dataNumber(button, 'beastId')
    const stage = dataNumber(button, 'stage')
    commitAction(clearSacredBeastStage(session.state, beastId, stage))
  } else if (action === 'progression-claim-beast') {
    commitAction(claimSacredBeastStageReward(session.state, dataNumber(button, 'beastId'), dataNumber(button, 'stage')))
  } else if (action === 'progression-learn-recipe') {
    commitAction(learnSacredRecipe(session.state, dataNumber(button, 'recipeId')))
  } else if (action === 'progression-craft-sacred') {
    const recipeId = dataNumber(button, 'recipeId')
    const uid = `sacred-craft-${recipeId}-${Date.now()}`
    const result = craftSacredEquipment(session.state, recipeId, progressionItemLevel(), uid, createRng(Date.now() + recipeId))
    if (result.ok) queueInventoryDropAnimations([uid])
    commitAction(result)
  } else if (action === 'progression-complete-tower') {
    commitAction(completeInfiniteTowerFloor(session.state))
  } else if (action === 'progression-complete-ladder') {
    commitAction(completeDivineLadderFloor(session.state))
  } else if (action === 'progression-shrine-kill') {
    commitAction(recordShrineEnemyKill(session.state, dataNumber(button, 'shrineId')))
  } else if (action === 'progression-shrine-boss') {
    commitAction(recordShrineBossKill(session.state, dataNumber(button, 'shrineId')))
  } else if (action === 'progression-settle-shrine') {
    commitAction(settleShrineSpawn(session.state, dataNumber(button, 'shrineId')))
  } else if (action === 'progression-claim-deity') {
    commitAction(claimDeity(session.state, dataNumber(button, 'deityId'), PLAYER_HERO_ID))
  } else if (action === 'progression-upgrade-deity') {
    commitAction(upgradeDeity(session.state, dataNumber(button, 'deityId')))
  } else if (action === 'progression-select-forge') {
    selectedProgressionEquipmentUid = button.dataset.equipmentUid ?? null
  } else if (action === 'progression-advance-sacred') {
    const uid = button.dataset.equipmentUid ?? ''
    const result = advanceSacredEquipment(session.state, uid)
    if (result.ok && selectedProgressionEquipmentUid === uid) selectedProgressionEquipmentUid = null
    commitAction(result)
  } else if (action === 'progression-forge-imperial') {
    const uid = selectedProgressionEquipmentUid ?? ''
    const result = forgeImperialWeapon(session.state, dataNumber(button, 'shrineId'), uid)
    if (result.ok) selectedProgressionEquipmentUid = null
    commitAction(result)
  } else if (action === 'progression-roll-interworld') {
    const enemyId = dataNumber(button, 'enemyId')
    const droppedIds = rollInterworldDrops(session.state, enemyId, 0, createRng(Date.now() + enemyId))
    const names = droppedIds.flatMap((itemId) => {
      const item = ORIGINAL_INTERWORLD_DROP_ITEMS.find((candidate) => candidate.itemId === itemId)
      return item ? [item.name] : []
    })
    commitAction({
      ok: true,
      message: names.length ? `异界挑战完成，获得 ${names.join('、')}` : '异界挑战完成，本次没有掉落',
    })
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
  const discardSelect = target.closest<HTMLSelectElement>('[data-action="auto-discard-quality"]')
  if (discardSelect && appScreen === 'playing') {
    const value = discardSelect.value === 'off' ? null : Number(discardSelect.value)
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 9)) return
    session.state.settings.autoDiscardBelowQuality = value as EquipmentQuality | null
    saveSession()
    render()
    return
  }
  const category = target.closest<HTMLSelectElement>('[data-action="hero-martial-category"]')
  if (category) {
    heroMartialCategory = category.value
    render()
    return
  }
  const select = target.closest<HTMLSelectElement>('[data-action="select-hero-input"]')
  if (select) selectedHeroId = select.value || null
  if (!select) return
  render()
})

app.addEventListener('input', (event) => {
  const target = event.target as HTMLElement
  const inventoryInput = target.closest<HTMLInputElement>('[data-action="inventory-search"]')
  if (inventoryInput) {
    inventoryQuery = inventoryInput.value
    render()
    return
  }
  const martialInput = target.closest<HTMLInputElement>('[data-action="hero-martial-search"]')
  if (martialInput) {
    heroMartialQuery = martialInput.value
    render()
    return
  }
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
      if (nextSession.offlineVoucherReward > 0) notify(`离线挂机获得 ${nextSession.offlineVoucherReward} 蛋蛋`)
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

app.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'mouse' || !(event.target instanceof Element) || !event.target.closest('.voucher-wallet')) return
  clearTimeout(voucherHoverTimer)
  if (!voucherHovered) { voucherHovered = true; render() }
})
app.addEventListener('pointerout', (event) => {
  if (event.pointerType !== 'mouse' || !(event.target instanceof Element) || !event.target.closest('.voucher-wallet')) return
  if (event.relatedTarget instanceof Element && event.relatedTarget.closest('.voucher-wallet')) return
  clearTimeout(voucherHoverTimer)
  voucherHoverTimer = setTimeout(() => { voucherHovered = false; render() }, 150)
})
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element) || event.target.closest('.voucher-wallet')) return
  if (voucherDetailsOpen || voucherHovered) {
    clearTimeout(voucherHoverTimer)
    voucherDetailsOpen = false; voucherHovered = false; render()
  }
})
document.addEventListener('keydown', (event) => {
  if (premiumPanel && event.key === 'Escape') { closePremiumPanel(); return }
  if (premiumPanel && event.key === 'Tab') {
    const buttons = [...app.querySelectorAll<HTMLButtonElement>('.premium-panel button:not(:disabled)')]
    const first = buttons[0], last = buttons.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  if (event.key === 'Escape' && (voucherDetailsOpen || voucherHovered)) {
    clearTimeout(voucherHoverTimer)
    voucherDetailsOpen = false; voucherHovered = false; render()
  }
})
window.addEventListener('resize', positionVoucherDetails)
app.addEventListener('scroll', positionVoucherDetails, true)

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  if (target.closest('.premium-overlay')) {
    const action = target.closest<HTMLButtonElement>('button[data-action]')?.dataset.action
    if (target.classList.contains('premium-overlay') || action === 'close-premium-panel') closePremiumPanel()
    else if (action === 'open-premium-shop') {
      premiumPanel = null
      activeTab = 'shop'
      render()
      app.querySelector<HTMLButtonElement>('[data-testid="tab-shop"]')?.focus()
    }
    return
  }
  if (target.closest('[data-action="open-formation-bonuses"]')) {
    premiumReturnFocus = target.closest<HTMLElement>('button')
    premiumPanel = 'bonuses'
    voucherDetailsOpen = false; voucherHovered = false
    render()
    app.querySelector<HTMLButtonElement>('.premium-panel button')?.focus()
    return
  }
  if (factionRosterOpen && !target.closest('.faction-disciple')) {
    factionRosterOpen = false
    factionRosterQuery = ''
  }
  // 按等阶售出下拉：点弹窗与触发按钮以外的区域即收起
  if (heroSellOpen && !target.closest('.sellpop') && !target.closest('[data-action="hero-sell-toggle"]')) {
    heroSellOpen = false
  }
  const tab = target.closest<HTMLElement>('[data-tab]')?.dataset.tab as TabId | undefined
  if (tab) {
    if (!isTabAvailable(tab)) return
    activeTab = tab
    if (tab !== 'inventory') inventoryDetailOpen = false
    render()
    return
  }
  const worldSection = target.closest<HTMLElement>('[data-jianghu-section]')
    ?.dataset.jianghuSection as JianghuSection | undefined
  if (worldSection) {
    if (!isJianghuSectionAvailable(worldSection)) return
    activeTab = 'idle'
    jianghuView = 'world'
    jianghuSection = worldSection
    jianghuMotionPending = worldSection === 'stages' ? 'stage' : null
    render()
    return
  }
  const button = target.closest<HTMLButtonElement>('[data-action]')
  if (!button || button.disabled) return
  const { action } = button.dataset
  if (action === 'buy-premium-card' && activeTab === 'shop') {
    try {
      const result = session.buyPremiumCard(button.dataset.cardId ?? '')
      notify(result.message, !result.ok)
    } catch (error) { handleSessionSaveError(error) }
    render()
    return
  }
  if (action === 'toggle-voucher-details') {
    voucherDetailsOpen = !voucherDetailsOpen
    if (!voucherDetailsOpen) voucherHovered = false
    render(); return
  }
  if (action === 'open-cloud-account') { cloudAccount.open(); return }
  if (action?.startsWith('progression-')) return
  if (action?.startsWith('select-town-') || action === 'tavern-recruit' || action === 'city-to-towns') return
  if (handleStartOrResetAction(action)) return
  if (appScreen !== 'playing') return
  if (action === 'select-city-section') {
    const section = button.dataset.citySection
    if (section === 'overview' || section === 'map' || section === 'company') cityPageSection = section
  } else if (action === 'city-intro-next' || action === 'city-intro-skip') {
    commitAction(advanceCityIntro(session.state, action === 'city-intro-skip'))
  } else if (action === 'city-intro-replay') {
    commitAction(replayCityIntro(session.state))
  } else if (action === 'city-stock' || action === 'city-unstock') {
    const uid = button.dataset.equipmentUid ?? ''
    commitAction(action === 'city-stock' ? stockCityShop(session.state, uid) : unstockCityShop(session.state, uid))
  } else if (action === 'city-toggle') {
    commitAction(toggleCityShop(session.state))
  } else if (action === 'city-hire-open') {
    cityHiringSlot = Number(button.dataset.slot)
  } else if (action === 'city-hire-close') {
    cityHiringSlot = null
  } else if (action === 'city-hire' || action === 'city-dismiss') {
    const result = appointCityShopWorker(session.state, Number(button.dataset.slot), action === 'city-dismiss' ? null : button.dataset.heroId ?? null, activeCombatHeroIds())
    commitAction(result)
    if (result.ok) cityHiringSlot = null
  } else if (action === 'city-stock-prev' || action === 'city-stock-next') {
    cityStockPage += action === 'city-stock-prev' ? -1 : 1
  } else if (action === 'city-locate') {
    selectedCityTileId = session.state.city.shop.tileId
    cityPageSection = 'map'
  } else if (action === 'city-to-stages' || action === 'city-to-factions') {
    jianghuSection = action === 'city-to-stages' ? 'stages' : 'factions'
    jianghuView = 'world'
  } else if (action === 'select-city-tile') {
    const tileId = Number(button.dataset.cityTileId)
    const tile = cityTileById(session.state, tileId)
    const effectiveGrid = cityEffectiveGrid(session.state)
    if (tile && tile.gridX < effectiveGrid.columns && tile.gridY < effectiveGrid.rows) selectedCityTileId = tileId
  } else if (action === 'select-plane' && button.dataset.worldId) {
    selectedPlaneId = button.dataset.worldId
    const highest = highestUnlockedDifficulty(
      session.state.unlockedWorldIds,
      session.state.clearedStageByWorldDifficulty,
      selectedPlaneId,
    )
    selectedDifficulty = session.state.unlockedWorldIds.includes(selectedPlaneId) ? Math.max(1, highest) : 1
  } else if (action === 'prev-plane' || action === 'next-plane') {
    const currentIndex = WORLDS.findIndex((world) => world.id === selectedPlaneId)
    const nextIndex = action === 'prev-plane'
      ? (currentIndex <= 0 ? WORLDS.length - 1 : currentIndex - 1)
      : (currentIndex >= WORLDS.length - 1 ? 0 : currentIndex + 1)
    selectedPlaneId = WORLDS[nextIndex]?.id ?? selectedPlaneId
    const highest = highestUnlockedDifficulty(
      session.state.unlockedWorldIds,
      session.state.clearedStageByWorldDifficulty,
      selectedPlaneId,
    )
    selectedDifficulty = session.state.unlockedWorldIds.includes(selectedPlaneId) ? Math.max(1, highest) : 1
  } else if (action === 'select-difficulty') {
    const difficulty = Number(button.dataset.difficulty) || 1
    if (isDifficultyUnlocked(
      session.state.unlockedWorldIds,
      session.state.clearedStageByWorldDifficulty,
      selectedPlaneId,
      difficulty,
    )) {
      selectedDifficulty = difficulty
    }
  } else if (action === 'start-crossing') {
    if (!session.state.unlockedWorldIds.includes(selectedPlaneId)) {
      notify('位面尚未解锁', true)
      return
    }
    if (!isDifficultyUnlocked(
      session.state.unlockedWorldIds,
      session.state.clearedStageByWorldDifficulty,
      selectedPlaneId,
      selectedDifficulty,
    )) {
      notify('难度尚未解锁', true)
      return
    }
    selectedWorldId = selectedPlaneId
    selectedStage = Math.min(10, Math.max(1, clearedStageOf(
      session.state.clearedStageByWorldDifficulty,
      selectedWorldId,
      selectedDifficulty,
    ) + 1))
    jianghuView = 'world'
    jianghuSection = 'stages'
    jianghuMotionPending = 'stage'
  } else if (action === 'enter-world' && button.dataset.worldId) {
    selectedPlaneId = button.dataset.worldId
  } else if (action === 'start-stage') {
    selectedStage = Number(button.dataset.stage) || 1
    startSelectedStage('guard')
    return
  } else if (action === 'select-hero') {
    selectedHeroId = button.dataset.heroId ?? null
    heroMartialSlot = null
    heroMartialQuery = ''
    heroMartialCategory = 'all'
    highlightedHeroMartialId = null
    careerTreeOpen = false
    selectedTreeCareerId = null
  }
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
  else if (action === 'select-town-exchange') {
    const nextFactionId = button.dataset.factionId ?? ''
    if (!session.state.unlockedFactionIds.includes(nextFactionId)) {
      notify('此势力尚未解锁', true)
    } else {
      selectedFactionId = nextFactionId
      townFactionFunction = 'exchange'
      factionExchangeFocusPending = true
    }
  }
  else if (action === 'select-town-recruitment') {
    const nextFactionId = button.dataset.factionId ?? ''
    if (!session.state.unlockedFactionIds.includes(nextFactionId)) {
      notify('此势力尚未解锁', true)
    } else {
      selectedFactionId = nextFactionId
      townFactionFunction = 'recruitment'
      factionRecruitmentFocusPending = true
    }
  }
  else if (action === 'select-town-agent') {
    townFactionFunction = 'agent'
    factionAgentFocusPending = true
  }
  else if (action === 'appoint-faction-agent') {
    commitAction(appointFactionAgent(
      session.state,
      button.dataset.worldId ?? selectedWorldId,
      button.dataset.heroId ?? '',
      activeCombatHeroIds(),
    ))
  }
  else if (action === 'dismiss-faction-agent') {
    commitAction(dismissFactionAgent(session.state, button.dataset.worldId ?? selectedWorldId))
  }
  else if (action === 'toggle-faction-agent') {
    commitAction(toggleFactionAgent(session.state, button.dataset.worldId ?? selectedWorldId))
  }
  else if (action === 'toggle-agent-task-filter') {
    const worldId = button.dataset.worldId ?? selectedWorldId
    const taskId = Number(button.dataset.taskId)
    const column = Number(button.dataset.column)
    if (!Number.isInteger(taskId) || !Number.isInteger(column) || column <= 0) {
      notify('筛选项无效', true)
    } else {
      const excluded = toggleFactionAgentFilterColumn(session.state, worldId, taskId, column)
      commitAction({ ok: true, message: excluded ? '已排除该筛选项' : '已恢复该筛选项' })
    }
  }
  else if (action === 'open-faction-town') {
    const nextFactionId = button.dataset.factionId ?? ''
    if (!session.state.unlockedFactionIds.includes(nextFactionId)) {
      notify('此势力尚未解锁', true)
    } else {
      selectedFactionId = nextFactionId
      selectedFactionMartialId = null
      factionRosterOpen = false
      factionRosterQuery = ''
      factionSwitchAnimationPending = true
      jianghuSection = 'factions'
      startFactionContributionAnimation(session.state.contribution[nextFactionId] ?? 0)
    }
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
    if (result.ok && !saveSession()) return
    notify(result.message, !result.ok)
    if (result.ok) addCombatLog('system', mode === 'guard' ? '守' : '闯', mode === 'guard' ? '转为驻守：原地迎敌，败退自动重整。' : '转为闯荡：破阵后自动深入。')
  } else if (action === 'stop-combat') {
    session.stopCombat()
    if (!saveSession()) return
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
    selectedDifficulty = session.combat.state.difficulty
    selectedStage = session.combat.state.stage
    jianghuView = 'combat'
    jianghuSection = 'stages'
  } else if (action === 'return-worlds') {
    selectedPlaneId = selectedWorldId || selectedPlaneId
    jianghuView = 'worlds'
    jianghuSection = 'stages'
    jianghuMotionPending = 'overview'
  } else if (action?.startsWith('speed-')) {
    const speed = Number(action.slice('speed-'.length))
    if (isCombatSpeed(speed)) {
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
  let combatElapsedMs = 0
  if (session.combat) {
    if (session.combat !== trackedCombat) combatClock.reset(now)
    trackedCombat = session.combat
    const combatPulse = combatClock.consume(now, MAX_COMBAT_REALTIME_TICKS_PER_PULSE)
    combatElapsedMs = combatPulse.elapsedMs * combatSpeed
  } else {
    combatClock.reset(now)
    trackedCombat = null
  }
  if (runtimePulse.tickCount === 0 && combatElapsedMs === 0) return
  try {
    if (combatElapsedMs > 0) {
      session.settleVoucherTime()
      const inventoryBefore = new Set(session.state.inventory.map((item) => item.uid))
      cacheCombatUnits()
      const events = session.advanceCombatTime(combatElapsedMs)
      cacheCombatUnits()
      presentCombatEvents(events)
      queueInventoryDropAnimations(session.state.inventory
        .filter((item) => !inventoryBefore.has(item.uid))
        .map((item) => item.uid))
      trackedCombat = session.combat
    }
    session.advanceRuntime(runtimePulse.elapsedMs, selectedWorldId || null)
    if (!session.combat) session.settleVoucherTime()
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

window.addEventListener('pagehide', () => {
  if (appScreen === 'playing') saveSession(true)
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
    const faction = factionById(definition.factionId!)
    if (faction?.currencyKind === 'worldCurrency') {
      session.state.worldCurrency[definition.worldId] = Math.max(session.state.worldCurrency[definition.worldId] ?? 0, definition.cost)
    } else {
      session.state.contribution[definition.factionId!] = Math.max(session.state.contribution[definition.factionId!] ?? 0, definition.cost)
    }
    const result = recruitFromFaction(session.state, definition.factionId!, heroId)
    if (!result.ok) throw new Error(result.message)
  }
  selectedHeroId = heroId
  saveSession()
  render()
}

const debugFillInventory = (count: number): void => {
  ensurePlaying()
  const pool = equipmentPoolForWorld('world_01')
  session.state.inventory = Array.from({ length: Math.max(0, Math.min(INVENTORY_CAPACITY, Math.floor(count))) }, (_, index): EquipmentInstance => {
    const definition = pool[index % pool.length] ?? pool[0]
    const level = 1 + (index % 5)
    const quality = EQUIPMENT_QUALITIES[index % EQUIPMENT_QUALITIES.length]
    return {
      uid: `debug-equipment-${index}`,
      definitionId: definition.id,
      level,
      equipmentLevel: equipmentWearLevel(level, quality),
      quality,
      coreStats: definition.coreStats.map((core) => ({
        attributeId: core.attributeId,
        coefficient: core.baseCoefficient,
      })),
      affixes: [],
      locked: false,
    }
  })
  saveSession()
  render()
}

const debugSettleEnemy = (seed: number, rank: CombatRank = 'normal'): string[] => {
  ensurePlaying()
  const result = settleCombatEvent(session.state, {
    type: 'enemy-defeated',
    atMs: 0,
    enemyId: `world_01_stage_01_${rank === 'boss' ? 'boss' : 'mob_1'}`,
    enemyLevel: (selectedDifficulty - 1) * 20 + 1,
    rank,
    worldId: 'world_01',
    difficulty: selectedDifficulty,
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
      setJianghuSection: (section: JianghuSection) => void
      startStage: (worldId: string, stage: number, mode: 'guard' | 'roam', seed: number) => void
      setCombatMode: (mode: 'guard' | 'roam') => void
      setClearedStage: (worldId: string, stage: number) => void
      advanceCombat: (ticks: number) => CombatEvent[]
      advanceRuntime: (elapsedMs: number) => void
      grantWorldCurrency: (worldId: string, amount: number) => void
      grantContribution: (factionId: string, amount: number) => void
      grantWorldReputation: (worldId: string, amount: number) => void
      unlockFaction: (factionId: string) => void
      recruitHero: (heroId: string) => void
      placeHero: (heroId: string, row: FormationRow, col: FormationColumn) => void
      setHeroCareerLevel: (heroId: string, careerId: string, level: number) => void
      grantJobBook: (careerId: string, count?: number) => void
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
    render()
  },
  setJianghuSection: (section) => {
    ensurePlaying()
    activeTab = 'idle'
    selectedWorldId = selectedWorldId || session.state.unlockedWorldIds[0] || 'world_01'
    jianghuView = 'world'
    jianghuSection = section
    jianghuMotionPending = section === 'stages' ? 'stage' : null
    render()
  },
  startStage: (worldId, stage, mode, seed) => {
    ensurePlaying()
    selectedWorldId = worldId
    selectedPlaneId = worldId
    selectedStage = stage
    startSelectedStage(mode, seed)
  },
  setCombatMode: (mode) => { ensurePlaying(); commitAction(session.setCombatMode(mode)); render() },
  setClearedStage: (worldId, stage) => {
    ensurePlaying()
    session.state.clearedStageByWorldDifficulty[progressKey(worldId, selectedDifficulty)] = Math.max(0, Math.min(10, Math.floor(stage)))
    render()
  },
  advanceCombat: (ticks) => {
    ensurePlaying()
    const inventoryBefore = new Set(session.state.inventory.map((item) => item.uid))
    cacheCombatUnits()
    const events = session.advanceTicks(ticks)
    cacheCombatUnits()
    presentCombatEvents(events)
    queueInventoryDropAnimations(session.state.inventory
      .filter((item) => !inventoryBefore.has(item.uid))
      .map((item) => item.uid))
    render()
    return events
  },
  advanceRuntime: (elapsedMs) => { ensurePlaying(); session.advanceRuntime(elapsedMs); render() },
  grantWorldCurrency: (worldId, amount) => { ensurePlaying(); session.state.worldCurrency[worldId] = amount; saveSession(); render() },
  grantContribution: (factionId, amount) => { ensurePlaying(); session.state.contribution[factionId] = amount; saveSession(); render() },
  grantWorldReputation: (worldId, amount) => { ensurePlaying(); session.state.worldReputation[worldId] = amount; saveSession(); render() },
  unlockFaction: (factionId) => {
    ensurePlaying()
    const faction = FACTIONS.find((item) => item.id === factionId)
    if (!faction) throw new Error('势力不存在')
    if (!session.state.unlockedFactionIds.includes(factionId)) session.state.unlockedFactionIds.push(factionId)
    session.state.contribution[factionId] ??= 0
    if (faction.currencyKind === 'contribution' && !session.state.factionBoards[factionId]) {
      initializeQuestBoard(session.state, factionId, createRng(session.state.lastSavedAt), 0)
    }
    saveSession()
    render()
  },
  recruitHero: debugRecruit,
  placeHero: (heroId, row, col) => { ensurePlaying(); commitAction(placeFormation(session.state, heroId, row, col)); render() },
  setHeroCareerLevel: (heroId, careerId, level) => {
    ensurePlaying()
    const hero = session.state.heroes[heroId]
    if (!hero) throw new Error('侠客尚未加入')
    hero.careers[careerId] = { level, experience: 0 }
    hero.currentCareerId = careerId
    saveSession()
    render()
  },
  grantJobBook: (careerId, count = 1) => {
    ensurePlaying()
    session.state.jobBooks[careerId] = (session.state.jobBooks[careerId] ?? 0) + Math.max(0, Math.floor(count))
    saveSession()
    render()
  },
  seedLearnedMartial: (heroId, martialId, level, slot) => {
    ensurePlaying()
    const hero = session.state.heroes[heroId]
    const martial = martialByIdV10(martialId)
    if (!hero || !martial) throw new Error('侠客或武功不存在')
    hero.learnedMartials[martialId] = { level, investedSp: 0, invested: { worldCurrency: {}, contribution: {} } }
    if (slot !== undefined && slot >= 0 && slot < 4) hero.equippedMartialIds[slot] = martialId
    saveSession()
    render()
  },
  setHeroCooldown: (heroId, martialId, remainingMs) => {
    ensurePlaying()
    const hero = session.combat?.state.party.find((unit) => unit.id === heroId)
    if (!hero) throw new Error('出战侠客不存在')
    const skillId = Number(martialId)
    if (Number.isFinite(skillId)) hero.cooldowns[skillId] = Math.max(0, remainingMs)
    render()
  },
  fillInventory: debugFillInventory,
  settleEnemy: debugSettleEnemy,
  showWave: (wave, seed) => {
    ensurePlaying()
    if (!session.combat) throw new Error('战斗尚未开始')
    session.combat.state.wave = wave
    session.combat.state.enemies = createWave(
      session.combat.state.worldId,
      session.combat.state.stage,
      wave,
      seed,
      session.combat.state.difficulty,
    ).enemies
    session.combat.state.timeline.phase = 'accumulating'
    session.combat.state.timeline.waveTransition = null
    render()
  },
  forceCombatResult: (result) => {
    ensurePlaying()
    if (!session.combat) throw new Error('战斗尚未开始')
    session.combat.state.result = result
    presentCombatEvents(session.advanceTicks(0))
    render()
  },
  prepareQuestBoard: (factionId, seed) => {
    ensurePlaying()
    const faction = FACTIONS.find((item) => item.id === factionId)
    if (!faction) throw new Error('势力不存在')
    const normalId = `${faction.worldId}_stage_01_mob_1`
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

app.addEventListener('input', event => {
  const input = event.target as HTMLInputElement
  if (input.dataset.action === 'welfare-code-input') welfareInput = input.value
})
app.addEventListener('submit', event => {
  const form = event.target as HTMLFormElement
  if (form.dataset.action !== 'redeem-welfare-code') return
  event.preventDefault()
  if (appScreen !== 'playing' || activeTab !== 'settings') return
  try {
    const result = session.redeemWelfareCode(String(new FormData(form).get('code') ?? ''))
    if (!result.ok) { notify(result.message, true); return }
    welfareInput = ''
    toast.hidden = true
    render()
    const host = document.createElement('div')
    host.innerHTML = renderWelfareRewards(result.rewards)
    const dialog = host.firstElementChild as HTMLDialogElement
    document.body.append(dialog)
    dialog.addEventListener('click', event => {
      if ((event.target as HTMLElement).closest('[data-action="close-welfare-rewards"]')) dialog.close()
    })
    dialog.addEventListener('close', () => { dialog.remove(); app.querySelector<HTMLInputElement>('#welfare-code')?.focus() }, { once: true })
    dialog.showModal()
  } catch (error) { handleSessionSaveError(error) }
})
