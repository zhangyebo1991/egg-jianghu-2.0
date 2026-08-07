import { worldPresentation } from '../content/world-presentations'
import { escapeHtml, formatNumber } from './html'
import { worldSceneAsset } from './world-scene-assets'

export type WorldCardState = 'cleared' | 'current' | 'open' | 'locked'

export interface JianghuFactionView {
  name: string
  category?: string
}

export interface JianghuWorldCardView {
  id: string
  name: string
  index: number
  unlocked: boolean
  released: boolean
  difficulty: number
  recommendedPower: number
  clearedStages: number
  factionNames: string[]
  state?: WorldCardState
  factions?: JianghuFactionView[]
  latinName?: string
  flavor?: string
  currencyName?: string
  lockText?: string
}

export interface WorldOverviewViewModel {
  worlds: JianghuWorldCardView[]
  totalClearedStages?: number
  totalStageCount?: number
  currentWorldId?: string
  currentWorldName?: string
}

export interface StageListViewModel {
  worldId: string
  worldName: string
  worldIndex?: number
  worldLatinName?: string
  worldCurrency: number
  currencyName?: string
  difficulty?: number
  recommendedPower?: number
  clearedStages?: number
  flavor?: string
  factions?: JianghuFactionView[]
  stageNames?: readonly string[]
  stages: Array<{ stage: number; name?: string; unlocked: boolean; cleared: boolean }>
}

const CHINESE_NUMERALS = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾']
const LATIN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

const chineseNumber = (value: number): string => CHINESE_NUMERALS[value - 1] ?? String(value)

const stars = (difficulty: number, empty = false): string => {
  const filled = Math.max(0, Math.min(5, Math.round(difficulty)))
  return `${empty ? '☆'.repeat(filled) : '★'.repeat(filled)}${empty ? '' : '☆'.repeat(Math.max(0, 5 - filled))}`
}

const worldState = (world: JianghuWorldCardView): WorldCardState => {
  if (!world.released || !world.unlocked) return 'locked'
  if (world.state) return world.state
  if (world.clearedStages >= 10) return 'cleared'
  return 'open'
}

const renderWorldScene = (worldId: string, className = 'wc-scene'): string => {
  const scene = worldSceneAsset(worldId)
  return scene
    ? `<img class="${className}" src="${escapeHtml(scene)}" alt="" aria-hidden="true" draggable="false">`
    : ''
}

const renderWorldFactions = (world: JianghuWorldCardView): string => {
  const names = world.factions?.map((faction) => faction.name) ?? world.factionNames
  return names.map((name) => escapeHtml(name)).join(' · ')
}

const renderFlagWidget = (value: number, total: number, label: string, subLabel: string): string => `
  <div class="head-widget">
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <path d="M8 29 V7" stroke="#8f6f3a" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M8 8 C14 5 19 10 27 7 C25 11 25 14 27 18 C19 21 14 15 8 18 Z" fill="url(#jianghu-flag-gradient)" stroke="#8f6f3a" stroke-width="1"/>
      <defs><linearGradient id="jianghu-flag-gradient" x1="8" y1="6" x2="27" y2="20"><stop stop-color="#e6c67f"/><stop offset="1" stop-color="#a37e3f"/></linearGradient></defs>
    </svg>
    <div>
      <div class="hw-num"><b>${formatNumber(value)}</b><small> / ${formatNumber(total)} 关</small></div>
      <div class="hw-label">${escapeHtml(label)}</div>
      <div class="hw-sub">${escapeHtml(subLabel)}</div>
    </div>
  </div>`

const renderIngotWidget = (value: number, currencyName: string): string => `
  <div class="head-widget">
    <svg width="34" height="30" viewBox="0 0 34 30" fill="none" aria-hidden="true">
      <path d="M17 3 C10 3 5 8 4.5 14 C4 20 9 26 17 26 C25 26 30 20 29.5 14 C29 8 24 3 17 3 Z" fill="url(#jianghu-ingot-gradient)" stroke="#8f6f3a" stroke-width="1"/>
      <ellipse cx="17" cy="9.5" rx="5.5" ry="3" fill="#f2ddab" opacity="0.85"/>
      <defs><linearGradient id="jianghu-ingot-gradient" x1="4" y1="4" x2="30" y2="26"><stop stop-color="#e6c67f"/><stop offset="1" stop-color="#a37e3f"/></linearGradient></defs>
    </svg>
    <div>
      <div class="hw-num">${formatNumber(value)}</div>
      <div class="hw-label">本卷货币</div>
      <div class="hw-sub">${escapeHtml(currencyName)} · 驻守所获</div>
    </div>
  </div>`

const renderWorldCard = (world: JianghuWorldCardView): string => {
  const state = worldState(world)
  const locked = state === 'locked'
  const stateLabel = state === 'cleared' ? '已通关' : state === 'current' ? '进行中' : state === 'open' ? '可进入' : '未解锁'
  const seal = state === 'cleared'
    ? '<span class="wc-seal s-cleared">通</span>'
    : state === 'current'
      ? '<span class="wc-seal s-current">行</span>'
      : state === 'open'
        ? '<span class="wc-seal s-open">启</span>'
        : ''
  const lockText = world.lockText
    ?? (!world.released ? '尚未开放' : world.index > 1 ? '通关上一卷后开启' : '尚未开放')
  const progress = Math.max(0, Math.min(100, world.clearedStages * 10))
  const body = locked
    ? `<span class="wc-body"><span class="wc-name">${escapeHtml(world.name)}</span></span>`
    : `<span class="wc-body">
        <span class="wc-name">${escapeHtml(world.name)}</span>
        <span class="wc-meta"><span class="stars">${stars(world.difficulty)}</span><span class="power">推荐战力 <b>${formatNumber(world.recommendedPower)}</b></span></span>
        <span class="wc-progress${state === 'cleared' ? ' cleared' : ''}">
          <span class="track"><span class="fill" style="width:${progress}%"></span></span>
          <span class="ptext">${world.clearedStages}/10 · ${stateLabel}</span>
        </span>
        <span class="wc-factions">${renderWorldFactions(world)}</span>
      </span>`
  const lock = locked
    ? `<span class="wc-lock" aria-hidden="true"><span class="lock-ring">封</span><span class="lock-text">${escapeHtml(lockText)}</span></span>`
    : ''
  const classes = ['world-card', `is-${state}`].join(' ')
  const aria = `${state === 'locked' ? '未解锁' : stateLabel} · 第${chineseNumber(world.index)}卷 · ${world.name}`
  return `
    <button type="button" class="${classes}" data-action="enter-world" data-world-id="${escapeHtml(world.id)}"
      data-testid="world-${escapeHtml(world.id)}" style="--card-index:${Math.max(0, world.index - 1)}" aria-label="${escapeHtml(aria)}"${locked ? ' disabled' : ''}>
      ${renderWorldScene(world.id)}
      <span class="wc-shade" aria-hidden="true"></span>
      <span class="wc-top"><span class="wc-vol">第${chineseNumber(world.index)}卷</span>${seal}</span>
      ${body}
      ${lock}
    </button>`
}

export const renderWorldOverview = (view: WorldOverviewViewModel): string => {
  const totalCleared = view.totalClearedStages ?? view.worlds.reduce((sum, world) => sum + world.clearedStages, 0)
  const totalStages = view.totalStageCount ?? Math.max(10, view.worlds.filter((world) => world.released).length * 10)
  const currentWorld = view.currentWorldName
    ?? view.worlds.find((world) => world.id === view.currentWorldId)?.name
    ?? view.worlds.find((world) => worldState(world) === 'current')?.name
  const currentWorldIndex = view.worlds.find((world) => world.id === view.currentWorldId)?.index
    ?? view.worlds.find((world) => worldState(world) === 'current')?.index
  const journeySub = currentWorld
    ? `行至 · 第${chineseNumber(currentWorldIndex ?? 1)}卷 ${currentWorld}`
    : '十卷俱已踏遍'
  return `
    <div class="jianghu-page jianghu-overview-page" data-testid="jianghu-page" data-view="worlds">
      <span class="ghost-char" aria-hidden="true">江</span>
      <section class="jianghu-view active" data-testid="world-overview" aria-label="十卷总览">
        <header class="page-head">
          <div>
            <p class="crumb">江湖 · <b>十卷风云</b> · 择卷而行</p>
            <h1>江湖</h1>
            <p class="latin">Jianghu · Ten Volumes</p>
          </div>
          ${renderFlagWidget(totalCleared, totalStages, '关山总程', journeySub)}
        </header>
        <div class="world-grid">${view.worlds.map(renderWorldCard).join('')}</div>
        <footer class="page-foot">十卷风云 · 逐关而行 · 过关方启下卷</footer>
      </section>
    </div>`
}

const renderStageNode = (view: StageListViewModel, stage: StageListViewModel['stages'][number]): string => {
  const current = stage.unlocked && !stage.cleared
  const state = stage.cleared ? 'cleared' : current ? 'current' : 'locked'
  const stageName = stage.name ?? view.stageNames?.[stage.stage - 1] ?? `第${stage.stage}关`
  const stateLabel = stage.cleared ? '已通关 · 可驻守' : current ? '行至此处' : '尚未解锁'
  const aria = `第${chineseNumber(stage.stage)}关 · ${stageName} · ${stateLabel}`
  return `
    <button type="button" class="stage-node is-${state}" data-action="start-stage" data-stage="${stage.stage}"
      data-testid="stage-${stage.stage}" aria-label="${escapeHtml(aria)}"${stage.unlocked ? '' : ' disabled'}>
      <span class="sn-dot">${chineseNumber(stage.stage)}</span>
      <span class="sn-name">${escapeHtml(stageName)}</span>
      <span class="sn-state">${stateLabel}</span>
    </button>`
}

const renderStageScene = (worldId: string, worldName: string): string => {
  const scene = worldSceneAsset(worldId)
  return scene
    ? `<img src="${escapeHtml(scene)}" alt="${escapeHtml(worldName)}风物" draggable="false">`
    : `<span class="sp-scene-empty" aria-hidden="true">${escapeHtml(worldName.slice(0, 1))}</span>`
}

export const renderStageList = (view: StageListViewModel): string => {
  const worldPresentation = worldPresentationFor(view)
  const difficulty = view.difficulty ?? 1
  const worldIndex = view.worldIndex ?? 1
  const factionViews = view.factions ?? []
  const cleared = view.clearedStages ?? view.stages.filter((stage) => stage.cleared).length
  const progress = Math.max(0, Math.min(100, cleared * 10))
  const latinName = view.worldLatinName ?? worldPresentation.latinName
  const currencyName = view.currencyName ?? worldPresentation.currencyName
  const flavor = view.flavor ?? worldPresentation.flavor
  const stageNames = view.stageNames ?? worldPresentation.stageNames
  const stages = view.stages.map((stage) => ({ ...stage, name: stage.name ?? stageNames[stage.stage - 1] }))
  return `
    <div class="jianghu-page jianghu-stage-page" data-testid="jianghu-page" data-view="world" data-world-id="${escapeHtml(view.worldId)}">
      <span class="ghost-char" aria-hidden="true">${escapeHtml(view.worldName.slice(0, 1))}</span>
      <section class="jianghu-view active" data-testid="stage-overview" data-world-id="${escapeHtml(view.worldId)}" aria-label="卷内选关">
        <header class="page-head">
          <div>
            <button type="button" class="back-btn" data-action="return-worlds">← 返回江湖</button>
            <p class="crumb">江湖 · <b>第${chineseNumber(worldIndex)}卷</b> · 卷内拾关</p>
            <h1>${escapeHtml(view.worldName)}</h1>
            <p class="latin">${escapeHtml(latinName)} · Volume ${LATIN_NUMERALS[worldIndex - 1] ?? worldIndex}</p>
          </div>
          ${renderIngotWidget(view.worldCurrency, currencyName)}
        </header>

        <div class="stage-layout">
          <aside class="scroll-panel">
            <div class="sp-scene">
              ${renderStageScene(view.worldId, view.worldName)}
              <span class="sp-vol">第${chineseNumber(worldIndex)}卷 · 卷档</span>
            </div>
            <div class="sp-body">
              <div class="sp-row"><span class="k">难 度</span><span class="v stars">${stars(difficulty)}</span></div>
              <div class="sp-row"><span class="k">推荐战力</span><span class="v">${formatNumber(view.recommendedPower ?? 0)}</span></div>
              <div class="sp-row"><span class="k">本地势力</span><span class="sp-factions">${factionViews.map((faction) => `<span class="sp-fchip">${escapeHtml(faction.name)}${faction.category ? `<small>${escapeHtml(faction.category)}</small>` : ''}</span>`).join('')}</span></div>
              <div class="sp-progress">
                <div class="track"><div class="fill" style="width:${progress}%"></div></div>
                <div class="ptext"><span>卷内进度</span><span>已历 ${cleared} / 10 关</span></div>
              </div>
              <p class="sp-flavor">${escapeHtml(flavor)}</p>
            </div>
          </aside>

          <div class="path-panel">
            <header class="path-head">
              <span class="ph-title">闯关路径<small>拾关连行 · 过关驻守</small></span>
              <span class="path-coin">通关驻守 · 持续产出 <b>${formatNumber(view.worldCurrency)}</b></span>
            </header>
            <div class="path-scroll">
              <div class="path-lane lane-a">${stages.slice(0, 5).map((stage) => renderStageNode(view, stage)).join('')}</div>
              <div class="path-turn" aria-hidden="true"></div>
              <div class="path-lane lane-b">${stages.slice(5, 10).map((stage) => renderStageNode(view, stage)).join('')}</div>
            </div>
            <footer class="path-foot">
              <span class="legend"><i class="lg-cleared">已通关 · 可驻守</i><i class="lg-current">当前关 · 可挑战</i><i class="lg-locked">未解锁</i></span>
              <span>Esc 返回江湖</span>
            </footer>
          </div>
        </div>
        <footer class="page-foot">逐关而行 · 驻守生息</footer>
      </section>
    </div>`
}

const worldPresentationFor = (view: StageListViewModel) => worldPresentation(view.worldId)
