import { difficultyLabel } from '../domain/progression'
import { worldPresentation } from '../content/world-presentations'
import { escapeHtml, formatNumber } from './html'
import { worldSceneAsset } from './world-scene-assets'

export interface PlaneThumbView {
  id: string
  name: string
  index: number
  unlocked: boolean
  selected: boolean
}

export interface PlaneDifficultyView {
  difficulty: number
  label: string
  unlocked: boolean
  selected: boolean
  cleared: number
}

export interface PlaneSelectViewModel {
  planes: PlaneThumbView[]
  selected: {
    id: string
    name: string
    index: number
    unlocked: boolean
    flavor: string
    latinName: string
    recommendedPower: number
    selectedDifficulty: number
    canTravel: boolean
    lockText: string
    difficulties: PlaneDifficultyView[]
  }
}

export interface StageListViewModel {
  worldId: string
  worldName: string
  worldIndex?: number
  worldLatinName?: string
  worldCurrency: number
  currencyName?: string
  difficulty?: number
  difficultyLabel?: string
  recommendedPower?: number
  clearedStages?: number
  flavor?: string
  stageNames?: readonly string[]
  stages: Array<{ stage: number; name?: string; unlocked: boolean; cleared: boolean }>
}

const CHINESE_NUMERALS = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾']
const LATIN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

const chineseNumber = (value: number): string => CHINESE_NUMERALS[value - 1] ?? String(value)

const planeIndexLabel = (index: number): string => `No.${String(index).padStart(3, '0')}`

const renderFlagWidget = (value: number, total: number, label: string, subLabel: string): string => `
  <div class="head-widget">
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <path d="M8 29 V7" stroke="#8f6f3a" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M8 8 C14 5 19 10 27 7 C25 11 25 14 27 18 C19 21 14 15 8 18 Z" fill="url(#jianghu-flag-gradient)" stroke="#8f6f3a" stroke-width="1"/>
      <defs><linearGradient id="jianghu-flag-gradient" x1="8" y1="6" x2="27" y2="20"><stop stop-color="#e6c67f"/><stop offset="1" stop-color="#a37e3f"/></linearGradient></defs>
    </svg>
    <div>
      <div class="hw-num"><b>${formatNumber(value)}</b><small> / ${formatNumber(total)} 面</small></div>
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
      <div class="hw-label">本面货币</div>
      <div class="hw-sub">${escapeHtml(currencyName)} · 驻守所获</div>
    </div>
  </div>`

const renderDifficultyBar = (item: PlaneDifficultyView): string => {
  const locked = !item.unlocked
  const classes = [
    'plane-diff',
    item.selected ? 'is-selected' : '',
    locked ? 'is-locked' : '',
    item.cleared >= 10 ? 'is-cleared' : '',
  ].filter(Boolean).join(' ')
  const aria = `${item.label}${locked ? ' · 未解锁' : item.cleared >= 10 ? ' · 已通关' : ` · ${item.cleared}/10`}`
  return `
    <button type="button" class="${classes}" data-action="select-difficulty" data-difficulty="${item.difficulty}"
      data-testid="difficulty-${item.difficulty}" aria-label="${escapeHtml(aria)}" aria-pressed="${item.selected}"
      ${locked ? ' disabled' : ''}>
      <span class="pd-bar" data-diff="${item.difficulty}"></span>
      <span class="pd-label">${locked ? '锁' : escapeHtml(item.label)}</span>
    </button>`
}

const renderPlaneThumb = (plane: PlaneThumbView): string => {
  const scene = worldSceneAsset(plane.id)
  const classes = [
    'plane-thumb',
    plane.selected ? 'is-selected' : '',
    plane.unlocked ? '' : 'is-locked',
  ].filter(Boolean).join(' ')
  const aria = `${plane.unlocked ? '' : '未解锁 · '}${plane.name}`
  return `
    <button type="button" class="${classes}" data-action="select-plane" data-world-id="${escapeHtml(plane.id)}"
      data-testid="world-${escapeHtml(plane.id)}" aria-label="${escapeHtml(aria)}" aria-pressed="${plane.selected}">
      ${scene
        ? `<img src="${escapeHtml(scene)}" alt="" aria-hidden="true" draggable="false">`
        : `<span class="pt-letter">${escapeHtml(plane.name.slice(0, 1))}</span>`}
      ${plane.unlocked ? '' : '<span class="pt-lock">未解锁</span>'}
      <span class="pt-name">${escapeHtml(plane.name)}</span>
    </button>`
}

export const renderWorldOverview = (view: PlaneSelectViewModel): string => {
  const unlockedCount = view.planes.filter((plane) => plane.unlocked).length
  const selected = view.selected
  const scene = worldSceneAsset(selected.id)
  const travelDisabled = !selected.canTravel
  return `
    <div class="jianghu-page jianghu-overview-page jianghu-plane-page" data-testid="jianghu-page" data-view="worlds">
      <span class="ghost-char" aria-hidden="true">${escapeHtml(selected.name.slice(0, 1))}</span>
      <section class="jianghu-view active" data-testid="world-overview" aria-label="位面选择">
        <header class="page-head">
          <div>
            <p class="crumb">江湖 · <b>十三位面</b> · 择面穿越</p>
            <h1>${escapeHtml(selected.name)}</h1>
            <p class="latin">${escapeHtml(selected.latinName)} · ${planeIndexLabel(selected.index)}</p>
          </div>
          ${renderFlagWidget(unlockedCount, view.planes.length, '已开位面', selected.unlocked ? '可选择难度穿越' : selected.lockText)}
        </header>

        <div class="plane-stage">
          <div class="plane-hero">
            ${scene
              ? `<img class="plane-hero-scene" src="${escapeHtml(scene)}" alt="" aria-hidden="true" draggable="false">`
              : `<span class="plane-hero-empty">${escapeHtml(selected.name.slice(0, 1))}</span>`}
            <div class="plane-hero-shade"></div>
            <p class="plane-flavor">${escapeHtml(selected.flavor)}</p>
          </div>

          <aside class="plane-panel">
            <p class="plane-no">${planeIndexLabel(selected.index)}</p>
            <h2>${escapeHtml(selected.name)}</h2>
            <p class="plane-meta">推荐战力 <b>${formatNumber(selected.recommendedPower)}</b></p>
            <div class="plane-diffs" role="listbox" aria-label="难度">
              ${selected.difficulties.map(renderDifficultyBar).join('')}
            </div>
            <button type="button" class="plane-travel" data-action="start-crossing" data-testid="start-crossing"
              ${travelDisabled ? ' disabled' : ''}>${selected.unlocked ? '开始穿越' : escapeHtml(selected.lockText)}</button>
          </aside>
        </div>

        <nav class="plane-strip" aria-label="位面列表">
          <button type="button" class="plane-nav" data-action="prev-plane" data-testid="prev-plane" aria-label="上一位面">‹</button>
          <div class="plane-thumbs">${view.planes.map(renderPlaneThumb).join('')}</div>
          <button type="button" class="plane-nav" data-action="next-plane" data-testid="next-plane" aria-label="下一位面">›</button>
        </nav>
        <footer class="page-foot">左右切面 · 点选难度 · 开始穿越</footer>
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
  const presentation = worldPresentation(view.worldId)
  const difficulty = view.difficulty ?? 1
  const worldIndex = view.worldIndex ?? 1
  const cleared = view.clearedStages ?? view.stages.filter((stage) => stage.cleared).length
  const progress = Math.max(0, Math.min(100, cleared * 10))
  const latinName = view.worldLatinName ?? presentation.latinName
  const currencyName = view.currencyName ?? presentation.currencyName
  const flavor = view.flavor ?? presentation.flavor
  const stageNames = view.stageNames ?? presentation.stageNames
  const stages = view.stages.map((stage) => ({ ...stage, name: stage.name ?? stageNames[stage.stage - 1] }))
  const label = view.difficultyLabel ?? difficultyLabel(difficulty)
  return `
    <div class="jianghu-page jianghu-stage-page" data-testid="jianghu-page" data-view="world" data-world-id="${escapeHtml(view.worldId)}">
      <span class="ghost-char" aria-hidden="true">${escapeHtml(view.worldName.slice(0, 1))}</span>
      <section class="jianghu-view active" data-testid="stage-overview" data-world-id="${escapeHtml(view.worldId)}" aria-label="面内选关">
        <header class="page-head">
          <div>
            <button type="button" class="back-btn" data-action="return-worlds">← 返回位面</button>
            <p class="crumb">江湖 · <b>第${chineseNumber(worldIndex)}面</b> · ${escapeHtml(label)}</p>
            <h1>${escapeHtml(view.worldName)}</h1>
            <p class="latin">${escapeHtml(latinName)} · ${LATIN_NUMERALS[worldIndex - 1] ?? worldIndex}</p>
          </div>
          ${renderIngotWidget(view.worldCurrency, currencyName)}
        </header>

        <div class="stage-layout">
          <aside class="scroll-panel">
            <div class="sp-scene">
              ${renderStageScene(view.worldId, view.worldName)}
              <span class="sp-vol">${escapeHtml(label)} · 第${chineseNumber(worldIndex)}面</span>
            </div>
            <div class="sp-body">
              <div class="sp-row"><span class="k">难 度</span><span class="v">${escapeHtml(label)}</span></div>
              <div class="sp-row"><span class="k">推荐战力</span><span class="v">${formatNumber(view.recommendedPower ?? 0)}</span></div>
              <div class="sp-progress">
                <div class="track"><div class="fill" style="width:${progress}%"></div></div>
                <div class="ptext"><span>本难度进度</span><span>已历 ${cleared} / 10 关</span></div>
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
              <span>Esc 返回位面</span>
            </footer>
          </div>
        </div>
        <footer class="page-foot">逐关而行 · 驻守生息</footer>
      </section>
    </div>`
}
