import './style.css'
import {
  BONDS,
  COMBOS,
  HEROES,
  MYSTERY_BLESSINGS,
  MYSTERY_ENCOUNTERS,
  REGIONS,
  enemyTraitById,
  heroById,
  martialById,
  mysteryBlessingById,
  nextRegionAfter,
  regionById,
} from './data'
import {
  COMBAT_STATUS_NAMES,
  abandonMystery,
  addToFormation,
  createInitialState,
  equipMartial,
  finishMystery,
  forgetMartial,
  getActiveBonds,
  getActiveCombos,
  getFormationSummary,
  getHeroStats,
  getMartialForgetPreview,
  getPartyPower,
  getPartySynergy,
  getSelectedRegion,
  getUpgradeCost,
  isRegionUnlocked,
  chooseMysteryBlessing,
  moveMartial,
  removeFromFormation,
  returnToIdle,
  setFormationRow,
  setPartySlot,
  startMystery,
  startIdleStage,
  startChallenge,
  stepCombat,
  swapFormationRows,
  unequipMartial,
  upgradeHero,
} from './game'
import { formatMartialPassive, getPassiveBonuses, MAX_LEARNED_MARTIALS } from './martials'
import { clearSave, exportSave, importSave, loadGame, saveGame } from './save'
import type { ActionResult, CombatEvent, CombatHeroState, CombatStatus, FormationRow, GameState, MysteryBlessingId, RegionId } from './types'

type TabId = 'idle' | 'heroes' | 'party' | 'battle' | 'mystery'
type LevelView = 'regions' | 'stages' | 'combat'

const appElement = document.querySelector<HTMLDivElement>('#app')
if (!appElement) throw new Error('缺少 #app 根节点')
const app = appElement

const loaded = loadGame(window.localStorage)
let state = loaded.state
let activeTab: TabId = 'idle'
let levelView: LevelView = 'regions'
let chapterRegionId: RegionId | null = null
let selectedHeroId: string | null = null
let toast = loaded.recoveredFromError ? '旧存档无法读取，已安全恢复为新档' : ''
let toastKind: 'success' | 'warning' = loaded.recoveredFromError ? 'warning' : 'success'
let toastTimer = 0
let lastRuntimeAt = Date.now()

const importInput = document.createElement('input')
importInput.type = 'file'
importInput.accept = 'application/json,.json'
importInput.hidden = true
document.body.append(importInput)

const escapeHtml = (value: string): string => value.replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
})[char] ?? char)

const formatNumber = (value: number): string => Math.floor(value).toLocaleString('zh-CN')
const getBuildUiLockMessage = (): string => {
  if (state.mystery.run) return '秘境探索期间侠客配置已锁定，请先完成或离开本轮秘境。'
  if (state.combat.mode === 'challenge' && state.combat.status === 'fighting') {
    return 'BOSS 挑战期间侠客配置已锁定，请先完成本场战斗。'
  }
  return ''
}
const isBuildUiLocked = (): boolean => Boolean(getBuildUiLockMessage())

const renderStatusChips = (statuses: CombatStatus[]): string => statuses.length
  ? `<div class="status-chips">${statuses.map((status) => `
      <span class="status-${status.id}" title="剩余 ${status.turns} 回合">${COMBAT_STATUS_NAMES[status.id]} · ${status.turns}</span>`).join('')}
    </div>`
  : ''

const notify = (result: ActionResult | string, kind: 'success' | 'warning' = 'success'): void => {
  if (typeof result === 'string') {
    toast = result
    toastKind = kind
  } else {
    toast = result.message
    toastKind = result.ok ? 'success' : 'warning'
  }
  toastTimer = window.setTimeout(() => {
    toast = ''
    if (!dragHeroId && !dragCandidatePressed) render()
  }, 2800)
}

const resourcePill = (label: string, value: number, mark: string): string => `
  <div class="resource-pill" title="${label}">
    <span class="resource-mark">${mark}</span>
    <span><small>${label}</small><strong>${formatNumber(value)}</strong></span>
  </div>`

const renderHeader = (): string => `
  <header class="topbar">
    <div class="brand-block">
      <span class="brand-seal" aria-hidden="true">蛋</span>
      <span><strong>蛋蛋江湖</strong><small>一盏江湖 · 单机存档</small></span>
    </div>
    <div class="resource-row" aria-label="当前资源">
      ${resourcePill('银两', state.resources.silver, '银')}
      ${resourcePill('阅历', state.resources.experience, '历')}
      ${resourcePill('残页', state.resources.pages, '卷')}
      ${resourcePill('声望', state.resources.reputation, '名')}
    </div>
    <div class="save-tools">
      <span class="save-state"><i></i> 已自动存档</span>
      <button class="text-button" data-action="export">导出</button>
      <button class="text-button" data-action="import">导入</button>
    </div>
  </header>`

const getTabItems = (): { id: TabId; label: string; note: string; ic: string }[] => [
  { id: 'idle', label: '关卡', ic: '🗺️', note: state.combat.mode === 'idle' && state.combat.status === 'fighting'
    ? `${getSelectedRegion(state).name} · 第 ${state.combat.stage ?? 1} 关`
    : '选择关卡' },
  { id: 'heroes', label: '侠客', ic: '🧑‍🤝‍🧑', note: `${HEROES.filter((hero) => state.heroes[hero.id].unlocked).length}/${HEROES.length}` },
  { id: 'party', label: '羁绊', ic: '🪢', note: '缘分合击' },
  { id: 'battle', label: '战斗', ic: '👹', note: `已破 ${state.defeatedBossIds.length}/${REGIONS.length}` },
  { id: 'mystery', label: '秘境', ic: '🏮', note: state.mystery.run ? `第 ${Math.min(state.mystery.run.floor + 1, MYSTERY_ENCOUNTERS.length)} 层` : `通关 ${state.mystery.runsCompleted}` },
]

const renderNav = (): string => `
  <nav class="game-nav" aria-label="游戏区域">
    ${getTabItems().map((item) => `
      <button class="nav-item ${activeTab === item.id ? 'active' : ''}" data-tab="${item.id}" aria-current="${activeTab === item.id ? 'page' : 'false'}">
        <span class="nav-ic" aria-hidden="true">${item.ic}</span><span class="nav-text"><span>${item.label}</span><small>${item.note}</small></span>
      </button>`).join('')}
  </nav>`

const getEquippedMartialView = (heroId: string) => state.heroes[heroId].equippedMartialIds
  .map((id, index) => id ? { martial: martialById(id), priority: index + 1 } : null)
  .filter((entry): entry is { martial: NonNullable<ReturnType<typeof martialById>>; priority: number } => Boolean(entry?.martial))

const getFighterMartialText = (heroId: string, member: CombatHeroState): string => {
  const equipped = getEquippedMartialView(heroId)
  const ready = equipped.find(({ martial }) => (member.martialCooldowns[martial.id] ?? 0) <= 0)
  if (ready) return `${ready.martial.skill.name} · 蓄势已成`
  const waiting = equipped
    .map(({ martial }) => ({ martial, cooldown: member.martialCooldowns[martial.id] ?? 0 }))
    .sort((left, right) => left.cooldown - right.cooldown)[0]
  return waiting ? `${waiting.martial.skill.name} · ${waiting.cooldown} 次行动后` : '普通攻击'
}

const getSkillFlashName = (event: CombatEvent | null): string =>
  event?.abilityId ? martialById(event.abilityId)?.skill.name ?? '武学招式' : '武学招式'

const renderSkillPlanForHero = (heroId: string): string => `
  <span><b>${heroById(heroId)?.name ?? '侠客'}</b>
    ${getEquippedMartialView(heroId).map(({ martial, priority }) => `<i>${priority}. ${martial.skill.name}</i>`).join('') || '<i>普通攻击</i>'}
  </span>`

const renderHeroFighter = (member: CombatHeroState, index: number): string => {
  const hero = heroById(member.heroId)
  const progress = state.heroes[member.heroId]
  const lastEvent = state.combat.lastEvent
  const acting = lastEvent?.actorId === member.heroId && (lastEvent.kind === 'attack' || lastEvent.kind === 'skill')
  const targeted = lastEvent?.targetId === member.heroId && lastEvent.kind === 'enemy'
  const hpPercent = Math.max(0, Math.round((member.hp / member.maxHp) * 100))
  if (!hero || !progress) return ''
  const equipped = getEquippedMartialView(member.heroId)
  const martialText = getFighterMartialText(member.heroId, member)
  return `
    <article class="fighter-card hero-fighter ${acting ? 'is-acting' : ''} ${targeted ? 'is-targeted' : ''} ${member.hp <= 0 ? 'is-defeated' : ''}" style="--fighter-delay:${index * 80}ms" data-hero-id="${hero.id}">
      <span class="fighter-position">${member.row === 'front' ? '前排 · 减伤' : '后排 · 增伤'}</span>
      <div class="fighter-avatar element-${hero.element}">${hero.name.slice(-1)}</div>
      <div class="fighter-copy">
        <strong>${hero.name}</strong>
        <span>Lv.${progress.level} · ${equipped.length ? `${equipped.length} 门武功` : '拳脚'}</span>
      </div>
      <div class="fighter-health health-track"><i style="width:${hpPercent}%"></i></div>
      <small class="fighter-hp">${member.hp} / ${member.maxHp}</small>
      <small class="fighter-skill ${martialText.includes('蓄势已成') ? 'ready' : ''}">${martialText}</small>
      ${renderStatusChips(member.statuses)}
    </article>`
}

const renderCombatRow = (row: FormationRow): string => {
  const members = state.combat.partyMembers.filter((member) => member.row === row)
  return `
    <div class="combat-row ${row}" data-testid="combat-${row}-row">
      <span class="combat-row-label">${row === 'front' ? '前排' : '后排'}</span>
      <div class="fighter-stack">${members.map(renderHeroFighter).join('')}</div>
    </div>`
}

const renderCombatArena = (compact = false): string => {
  const combat = state.combat
  const partyHp = combat.partyMembers.reduce((total, member) => total + member.hp, 0)
  const partyMaxHp = combat.partyMembers.reduce((total, member) => total + member.maxHp, 0)
  const partyPercent = Math.max(0, Math.round((partyHp / partyMaxHp) * 100))
  const enemyPercent = Math.max(0, Math.round((combat.enemyHp / combat.enemyMaxHp) * 100))
  const hitEvent = combat.lastEvent
  const enemyHit = hitEvent && (hitEvent.kind === 'attack' || hitEvent.kind === 'skill' || hitEvent.kind === 'status' || hitEvent.kind === 'combo')
  const partyHit = hitEvent?.kind === 'enemy'
  const region = regionById(combat.regionId) ?? REGIONS[0]
  const trait = enemyTraitById(combat.enemyTraitId)
  const modeLabel = combat.mode === 'idle'
    ? `${region.name} · 第 ${combat.stage ?? 1} 关 · 挂机战斗中`
    : combat.mode === 'mystery'
      ? `无相秘境 · 第 ${(state.mystery.run?.floor ?? 0) + 1} 层交锋`
      : `${region.name} BOSS · ${combat.status === 'fighting' ? '交锋中' : combat.status === 'victory' ? '胜利' : '落败'}`

  return `
    <section class="battle-arena ${compact ? 'compact' : ''}" data-testid="battle-arena">
      <div class="arena-heading">
        <span class="live-dot"><i></i>${modeLabel}</span>
        <span class="arena-meta"><i class="enemy-trait-chip">${trait.name}</i>第 ${combat.round + 1} 回合</span>
      </div>
      <div class="battle-stage">
        <div class="side party-side ${partyHit ? 'takes-hit' : ''}">
          <div class="side-label"><span>我方</span><b>${partyHp} / ${partyMaxHp}</b></div>
          <div class="health-track"><i style="width:${partyPercent}%"></i></div>
          <div class="combat-formation">${renderCombatRow('back')}${renderCombatRow('front')}</div>
          ${partyHit ? `<b class="damage-float party-damage">-${hitEvent?.amount ?? 0}</b>` : ''}
        </div>
        <div class="versus-mark"><span>交</span><i></i><small>锋</small></div>
        <div class="side enemy-side ${enemyHit ? 'takes-hit' : ''}">
          <div class="side-label"><span>敌方</span><b>${combat.enemyHp} / ${combat.enemyMaxHp}</b></div>
          <div class="health-track enemy-health"><i style="width:${enemyPercent}%"></i></div>
          <div class="enemy-portrait"><span>敌</span><small>${escapeHtml(combat.enemyName)}</small></div>
          ${renderStatusChips(combat.enemyStatuses)}
          ${enemyHit ? `<b class="damage-float enemy-damage ${hitEvent?.kind === 'combo' ? 'combo-damage' : ''}">-${hitEvent?.amount ?? 0}</b>` : ''}
        </div>
        ${hitEvent?.kind === 'combo' ? `<div class="combo-flash"><span>合击</span><strong>${COMBOS.find((combo) => combo.id === hitEvent.abilityId)?.name ?? '联手武学'}</strong></div>` : ''}
        ${hitEvent?.kind === 'skill' ? `<div class="skill-flash"><span>绝技</span><strong>${getSkillFlashName(hitEvent)}</strong></div>` : ''}
      </div>
      ${combat.status !== 'fighting' ? `
        <div class="battle-result ${combat.status}">
          <span>${combat.status === 'victory' ? '破关' : '惜败'}</span>
          <strong>${combat.status === 'victory' ? '此役功成，江湖声名更进一步' : `破局建议：${trait.counterHint}`}</strong>
          <button class="primary-button" data-action="return-idle">返回关卡选择</button>
        </div>` : ''}
    </section>`
}

const renderLogs = (): string => `
  <aside class="battle-log">
    <div class="section-title"><span>江湖纪事</span><small>实时</small></div>
    <div class="log-list" aria-live="polite">
      ${state.combat.logs.length ? state.combat.logs.slice(-12).reverse().map((event) => `
        <p class="log-${event.kind}"><time>${String(event.id).padStart(2, '0')}</time><span>${escapeHtml(event.text)}</span></p>`).join('') : '<p class="empty-copy">风过古道，尚无战事。</p>'}
    </div>
  </aside>`

const renderRegionCard = (regionId: RegionId, index: number): string => {
  const region = regionById(regionId)!
  const unlocked = isRegionUnlocked(state, region.id)
  const selected = state.combat.mode === 'idle' && state.combat.status === 'fighting' && state.combat.regionId === region.id
  const bossDefeated = state.defeatedBossIds.includes(region.boss.id)
  const requiredRegion = region.requiredBossId
    ? REGIONS.find((candidate) => candidate.boss.id === region.requiredBossId)
    : undefined
  const trait = enemyTraitById(region.boss.traitId)
  return `
    <article class="region-card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-testid="region-card-${region.id}">
      <div class="region-card-head"><span>其 ${String(index + 1).padStart(2, '0')}</span><b>${bossDefeated ? '已问鼎' : unlocked ? '可历练' : '未解锁'}</b></div>
      <h3>${region.name}</h3>
      <p>${region.description}</p>
      <div class="region-rewards">${region.rewardText}</div>
      <div class="region-boss"><small>BOSS 特性</small><strong>${trait.name}</strong><span>${trait.counterHint}</span></div>
      <button class="${selected ? 'secondary-button' : 'primary-button'} full" data-action="open-region" data-region-id="${region.id}" ${!unlocked ? 'disabled' : ''}>
        ${unlocked ? `进入${region.name}` : `击败${requiredRegion?.boss.name ?? '前一区域 BOSS'}后解锁`}
      </button>
    </article>`
}

const renderRegionList = (): string => `
  <section class="region-map panel">
    <div class="section-title"><span>大关卡</span><small>击败区域 BOSS 后解锁下一处江湖</small></div>
    <div class="region-grid">${REGIONS.map((candidate, index) => renderRegionCard(candidate.id, index)).join('')}</div>
  </section>`

const renderStageCard = (regionId: RegionId, stage: number): string => {
  const region = regionById(regionId)!
  const enemy = region.enemies[(stage - 1) % region.enemies.length]
  const trait = enemyTraitById(enemy.traitId)
  const active = state.combat.mode === 'idle' && state.combat.status === 'fighting'
    && state.combat.regionId === region.id && state.combat.stage === stage
  return `
    <article class="stage-card ${active ? 'active' : ''}" data-testid="stage-card-${stage}">
      <div class="stage-number"><small>STAGE</small><strong>${String(stage).padStart(2, '0')}</strong></div>
      <div class="stage-copy"><small>${trait.name}</small><strong>${enemy.name}</strong><span>敌人强度 ${100 + (stage - 1) * 8}% · ${region.rewardText}</span></div>
      <button class="${active ? 'secondary-button' : 'primary-button'}" data-action="start-stage" data-region-id="${region.id}" data-stage="${stage}">
        ${active ? '重新开始本关' : '开始挂机'}
      </button>
    </article>`
}

const renderStageList = (): string => {
  const region = regionById(chapterRegionId ?? '') ?? REGIONS[0]
  return `
    <div class="level-breadcrumb"><button class="text-button" data-action="back-regions">← 返回大关卡</button><span>江湖关卡 / ${region.name}</span></div>
    <section class="stage-map panel" data-testid="stage-map">
      <div class="section-title"><span>小关卡</span><small>点击后立即开始对应关卡的挂机战斗</small></div>
      <div class="stage-grid">${Array.from({ length: 10 }, (_, index) => renderStageCard(region.id, index + 1)).join('')}</div>
    </section>`
}

const renderStageCombat = (): string => {
  const region = getSelectedRegion(state)
  const stage = state.combat.stage ?? 1
  return `
    <div class="level-breadcrumb">
      <button class="text-button" data-action="back-stages">← 返回小关卡</button><span>${region.name} / 第 ${stage} 关</span>
      <span class="breadcrumb-actions">
        <span class="location-status"><i></i><span>队伍正在战斗<strong>${region.rewardText}</strong></span></span>
        <button class="secondary-button stop-idle-button" type="button" data-action="stop-idle">停止挂机</button>
      </span>
    </div>
    <div class="idle-layout">
      <div class="main-column">
        ${renderCombatArena()}
        <section class="yield-panel panel">
          <div class="section-title"><span>当前挂机信息</span><small>只结算在线战斗击败敌人获得的奖励</small></div>
          <div class="yield-grid">
            <div><small>当前小关卡</small><strong>${stage}/10</strong><span>${region.name}</span></div>
            <div><small>敌人强度</small><strong>${100 + (stage - 1) * 8}%</strong><span>随小关卡递增</span></div>
            <div><small>本章败敌</small><strong>${formatNumber(state.regionDefeats[region.id])}</strong><span>在线战斗累计</span></div>
            <div><small>队伍战力</small><strong>${formatNumber(getPartyPower(state))}</strong><span>羁绊已计入</span></div>
          </div>
        </section>
      </div>
      ${renderLogs()}
    </div>`
}

const renderIdle = (): string => {
  if (levelView === 'combat' && state.combat.mode === 'idle' && state.combat.status === 'fighting') return renderStageCombat()
  if (levelView === 'stages' && chapterRegionId) return renderStageList()
  return renderRegionList()
}

const getOwnedHeroes = () => HEROES.filter((hero) => state.heroes[hero.id]?.unlocked)

const getSelectedHeroId = (): string => {
  const owned = getOwnedHeroes()
  const fallback = state.formation.find((slot) => state.heroes[slot.heroId]?.unlocked)?.heroId ?? owned[0]?.id ?? ''
  if (!selectedHeroId || !state.heroes[selectedHeroId]?.unlocked) selectedHeroId = fallback
  return selectedHeroId
}

const renderHeroRosterCard = (heroId: string, activeHeroId: string): string => {
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  if (!hero || !progress?.unlocked) return ''
  const formationSlot = state.formation.find((slot) => slot.heroId === heroId)
  // 已出战的侠客不能再从名册拖动：换位/下阵请直接操作上方阵容格
  const draggable = !formationSlot && !isBuildUiLocked()
  return `
    <button type="button" class="hero-roster-card ${heroId === activeHeroId ? 'selected' : ''} ${formationSlot ? 'on-duty' : ''}"
      data-action="select-hero" data-hero-id="${heroId}" ${draggable ? `data-drag-hero="${heroId}" draggable="true"` : ''}
      aria-pressed="${heroId === activeHeroId}">
      ${formationSlot ? `<span class="roster-status">${formationSlot.row === 'front' ? '前排' : '后排'}</span>` : ''}
      <span class="roster-level">Lv.${progress.level}</span>
      <span class="roster-portrait element-${hero.element}">${hero.name.slice(-1)}</span>
      <strong>${hero.name}</strong>
      <small>${hero.sect} · ${hero.epithet}</small>
    </button>`
}

const renderMartialSlots = (heroId: string): string => {
  const progress = state.heroes[heroId]
  const locked = isBuildUiLocked()
  return `
    <section class="martial-slot-section">
      <div class="section-title"><span>出战武功</span><small>按 1 → 4 的优先级自动施展</small></div>
      <div class="martial-slots" data-testid="martial-slots">
        ${progress.equippedMartialIds.map((martialId, slot) => {
          const martial = martialId ? martialById(martialId) : undefined
          const learned = martialId ? progress.learnedMartials[martialId] : undefined
          return `
            <article class="martial-slot ${martial ? 'filled' : 'empty'}" data-testid="martial-slot-${slot}">
              <span class="slot-priority">${slot + 1}</span>
              ${martial && learned ? `
                <div class="slot-martial-copy">
                  <small>${martial.element}行 · ${martial.style}劲 · ${martial.rankNames[learned.rank - 1]}</small>
                  <strong>${martial.name}</strong>
                  <span>${martial.skill.name} · 冷却 ${martial.skill.cooldown}</span>
                </div>
                <div class="slot-controls">
                  <button type="button" class="text-button" data-action="move-martial" data-hero-id="${heroId}" data-slot="${slot}" data-direction="-1" aria-label="上移" ${locked || slot === 0 ? 'disabled' : ''}>↑</button>
                  <button type="button" class="text-button" data-action="move-martial" data-hero-id="${heroId}" data-slot="${slot}" data-direction="1" aria-label="下移" ${locked || slot === 3 ? 'disabled' : ''}>↓</button>
                  <button type="button" class="text-button danger" data-action="unequip-martial" data-hero-id="${heroId}" data-slot="${slot}" ${locked ? 'disabled' : ''}>卸下</button>
                </div>` : '<em>空槽位<small>从下方已学武功中装备</small></em>'}
            </article>`
        }).join('')}
      </div>
    </section>`
}

const renderLearnedMartials = (heroId: string): string => {
  const progress = state.heroes[heroId]
  const learnedEntries = Object.entries(progress.learnedMartials)
    .map(([martialId, learned]) => ({ martial: martialById(martialId), learned }))
    .filter((entry): entry is { martial: NonNullable<ReturnType<typeof martialById>>; learned: typeof entry.learned } => Boolean(entry.martial))
  const locked = isBuildUiLocked()
  return `
    <section class="learned-martials" data-testid="learned-martials">
      <div class="section-title"><span>已学武功</span><small>${learnedEntries.length} / ${MAX_LEARNED_MARTIALS} · 全部被动永久叠加</small></div>
      <div class="learned-martial-list">
        ${learnedEntries.map(({ martial, learned }) => {
          const equippedSlot = progress.equippedMartialIds.indexOf(martial.id)
          const canEquip = equippedSlot < 0 && progress.equippedMartialIds.includes(null)
          return `
            <article class="learned-martial-row" data-testid="learned-${martial.id}">
              <span class="martial-glyph element-${martial.element}">${martial.element}</span>
              <div class="learned-martial-copy">
                <div><strong>${martial.name}</strong><small>${martial.rankNames[learned.rank - 1]} · ${martial.style}劲</small></div>
                <p>${martial.skill.name}：${martial.skill.description}</p>
                <em>被动 · ${formatMartialPassive(martial.id, learned.rank)}</em>
              </div>
              <div class="learned-martial-actions">
                ${equippedSlot >= 0
                  ? `<span>槽位 ${equippedSlot + 1}</span>`
                  : `<button type="button" class="secondary-button" data-action="equip-martial" data-hero-id="${heroId}" data-martial-id="${martial.id}" ${locked || !canEquip ? 'disabled' : ''}>${canEquip ? '装备' : '槽位已满'}</button>`}
                <button type="button" class="text-button danger" data-action="forget-martial" data-hero-id="${heroId}" data-martial-id="${martial.id}" ${locked ? 'disabled' : ''}>遗忘</button>
              </div>
            </article>`
        }).join('') || '<div class="empty-martial-state">尚未学会武功；武功获取方式将在后续玩法中开放。</div>'}
      </div>
    </section>`
}

const renderHeroDetail = (heroId: string): string => {
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  if (!hero || !progress?.unlocked) return '<section class="hero-detail panel">暂无已拥有侠客</section>'
  const stats = getHeroStats(state, heroId)
  const passives = getPassiveBonuses(progress.learnedMartials)
  const upgradeCost = getUpgradeCost(progress.level)
  const inFormation = state.formation.some((slot) => slot.heroId === heroId)
  return `
    <section class="hero-detail panel" data-testid="hero-detail">
      <div class="hero-detail-head">
        <span class="hero-detail-portrait element-${hero.element}">${hero.name.slice(-1)}</span>
        <div class="hero-detail-identity">
          <small>${hero.sect} · ${hero.epithet}</small>
          <h2>${hero.name}<span>Lv.${progress.level}</span></h2>
          <p>${hero.description}</p>
          <div class="tag-row"><span>${hero.element}行</span><span>${hero.style}劲</span><span class="affinity">${stats.affinityText}</span></div>
        </div>
        <div class="hero-head-side">
          <b class="power-number">${stats.power}<small>战力</small></b>
          <button type="button" class="secondary-button formation-toggle" data-action="toggle-formation" data-hero-id="${hero.id}"
            ${isBuildUiLocked() ? 'disabled' : ''} data-testid="formation-toggle">${inFormation ? '下阵休整' : '邀其上阵'}</button>
        </div>
      </div>
      <div class="hero-detail-stats">
        <span><small>攻击</small><strong>${stats.attack}</strong></span>
        <span><small>防御</small><strong>${stats.defense}</strong></span>
        <span><small>气血</small><strong>${stats.hp}</strong></span>
        <span class="passive-total"><small>已学被动</small><strong>攻 +${Math.round(passives.attack * 100)}% · 御 +${Math.round(passives.defense * 100)}% · 气血 +${Math.round(passives.hp * 100)}%</strong></span>
        <button type="button" class="secondary-button realm-upgrade" data-action="upgrade" data-hero-id="${hero.id}" ${isBuildUiLocked() ? 'disabled' : ''}>提升境界 <small>${upgradeCost.silver} 银两 / ${upgradeCost.experience} 阅历</small></button>
      </div>
      ${renderMartialSlots(heroId)}
      ${renderLearnedMartials(heroId)}
    </section>`
}

/* ---- 出战阵容面板（前 3 后 3，拖拽布阵） ---- */
const renderFormationPanel = (): string => {
  const locked = isBuildUiLocked()
  const formation = getFormationSummary(state)
  const synergy = getPartySynergy(state)
  const activeBonds = getActiveBonds(state)
  const activeCombos = getActiveCombos(state)
  const renderRow = (row: FormationRow): string => {
    const members = state.formation.filter((slot) => slot.row === row)
    const slots = [0, 1, 2].map((index) => {
      const member = members[index]
      if (!member) return '<div class="formation-slot empty"><em>＋<small>拖入侠客</small></em></div>'
      const hero = heroById(member.heroId)!
      const progress = state.heroes[member.heroId]
      const stats = getHeroStats(state, member.heroId)
      const targetRow: FormationRow = row === 'front' ? 'back' : 'front'
      return `
        <article class="formation-slot filled row-${row}" data-drag-hero="${hero.id}" draggable="${locked ? 'false' : 'true'}" data-testid="formation-slot-${hero.id}">
          <button type="button" class="slot-remove text-button danger" data-action="remove-formation" data-hero-id="${hero.id}"
            ${locked ? 'disabled' : ''} aria-label="让${hero.name}下阵" title="下阵">✕</button>
          <div class="portrait element-${hero.element}">${hero.name.slice(-1)}</div>
          <strong>${hero.name}</strong>
          <small>Lv.${progress.level} · 战力 ${stats.power}</small>
          <button type="button" class="slot-move text-button" data-action="set-row" data-hero-id="${hero.id}" data-row="${targetRow}" ${locked ? 'disabled' : ''}>
            调至${targetRow === 'front' ? '前排' : '后排'}
          </button>
        </article>`
    })
    return `
      <div class="formation-row ${row}" data-drop-row="${row}" data-testid="formation-${row}-row">
        <div class="formation-row-heading">
          <span>${row === 'front' ? '前排' : '后排'}</span>
          <small>${row === 'front' ? '优先承伤 · 受到伤害 -20% · 造成伤害 -10%' : '受前排保护 · 造成伤害 +15%'}</small>
        </div>
        <div class="formation-slots">${slots.join('')}</div>
      </div>`
  }
  return `
    <section class="formation-panel panel" data-testid="formation-panel">
      <div class="section-title"><span>出战阵容</span><small>总战力 ${formatNumber(getPartyPower(state))} · 拖入侠客上阵</small></div>
      <div class="formation-rows">${renderRow('front')}${renderRow('back')}</div>
      <div class="synergy-strip" data-testid="synergy-strip">
        <span class="active"><b>阵</b>${formation.name}</span>
        <span class="${synergy.sectName ? 'active' : ''}"><b>门</b>${synergy.sectName ? `${synergy.sectName} ×${synergy.sectCount}` : '未共鸣'}</span>
        <span class="${activeBonds.length ? 'active' : ''}"><b>缘</b>${activeBonds.length ? `${activeBonds.length} 条羁绊` : '无羁绊'}</span>
        <span class="${activeCombos.length ? 'active' : ''}"><b>合</b>${activeCombos.length ? activeCombos.map((combo) => combo.name).join('、') : '无合击'}</span>
      </div>
    </section>`
}

const renderHeroes = (): string => {
  const owned = getOwnedHeroes()
  const heroId = getSelectedHeroId()
  const lockMessage = getBuildUiLockMessage()
  return `
    ${lockMessage ? `<aside class="hero-build-lock" data-testid="hero-build-lock"><b>配置锁定</b><span>${lockMessage}</span></aside>` : ''}
    <div class="heroes-workbench">
      <div class="heroes-side">
        ${renderFormationPanel()}
        <aside class="hero-roster-panel panel" data-drop-roster>
          <div class="section-title"><span>侠客名册</span><small>已拥有 ${owned.length} 人 · 点击配置武功 · 未出战者可拖入上方阵容</small></div>
          <div class="hero-roster" data-testid="hero-roster">${owned.map((hero) => renderHeroRosterCard(hero.id, heroId)).join('')}</div>
        </aside>
      </div>
      ${renderHeroDetail(heroId)}
    </div>`
}

const renderParty = (): string => {
  const synergy = getPartySynergy(state)
  const activeBonds = getActiveBonds(state)
  const activeCombos = getActiveCombos(state)
  const formation = getFormationSummary(state)
  return `
    <section class="party-board panel">
      <div class="section-title"><span>阵势与共鸣</span><small>列阵调整请前往「侠客」页拖拽完成</small></div>
      <div class="synergy-grid">
        <article class="synergy-card active formation"><span class="seal-icon">阵</span><div><small>当前阵势</small><strong>${formation.name}</strong><p>${formation.effectText}</p></div></article>
        <article class="synergy-card ${synergy.sectName ? 'active' : ''}"><span class="seal-icon">门</span><div><small>门派羁绊</small><strong>${synergy.sectName ? `${synergy.sectName}共鸣` : '尚未激活'}</strong><p>${synergy.sectText}</p></div></article>
        <article class="synergy-card ${activeBonds.length ? 'active' : ''}"><span class="seal-icon">缘</span><div><small>关系羁绊</small><strong>${activeBonds.length ? `${activeBonds.length} 条生效` : '尚未激活'}</strong><p>${activeBonds.length ? activeBonds.map((bond) => bond.name).join(' · ') : '按下方图谱安排有故事关联的侠客同队。'}</p></div></article>
        <article class="synergy-card ${activeCombos.length ? 'active combo' : ''}"><span class="seal-icon">合</span><div><small>联手武学</small><strong>${activeCombos.length ? activeCombos.map((combo) => combo.name).join(' · ') : '尚未激活'}</strong><p>${activeCombos.length ? '每三回合轮换施展已激活的合击。' : '集齐合击所需的两位侠客并安排同队。'}</p></div></article>
      </div>
    </section>
    <section class="bond-atlas panel" data-testid="bond-atlas">
      <div class="section-title"><span>江湖羁绊图谱</span><small>${BONDS.filter((bond) => bond.heroIds.every((heroId) => state.heroes[heroId]?.unlocked)).length}/${BONDS.length} 条关系已结识</small></div>
      <div class="bond-grid">${BONDS.map((bond) => {
        const active = synergy.activeBondIds.includes(bond.id)
        const known = bond.heroIds.every((heroId) => state.heroes[heroId]?.unlocked)
        const missing = bond.heroIds.filter((heroId) => !state.heroes[heroId]?.unlocked).map((heroId) => heroById(heroId)?.name).join('、')
        return `<article class="bond-card ${active ? 'active' : known ? 'known' : 'locked'}" data-bond-id="${bond.id}">
          <span>${bond.type}</span><strong>${bond.name}</strong><small>${bond.heroIds.map((heroId) => heroById(heroId)?.name).join(' × ')}</small>
          <p>${bond.story}</p><em>${bond.effectText}</em><b>${active ? '并肩生效' : known ? '已结识 · 安排同队可激活' : `尚缺 ${missing}`}</b>
        </article>`
      }).join('')}</div>
    </section>
    <section class="combo-codex panel" data-testid="combo-codex">
      <div class="section-title"><span>联手武学录</span><small>${COMBOS.filter((combo) => combo.heroIds.every((heroId) => state.heroes[heroId]?.unlocked)).length}/${COMBOS.length} 式已收集</small></div>
      <div class="combo-grid">${COMBOS.map((combo) => {
        const active = synergy.activeComboIds.includes(combo.id)
        const known = combo.heroIds.every((heroId) => state.heroes[heroId]?.unlocked)
        return `<article class="combo-card ${active ? 'active' : known ? 'known' : 'locked'}" data-combo-id="${combo.id}">
          <span>合</span><div><strong>${combo.name}</strong><small>${combo.heroIds.map((heroId) => heroById(heroId)?.name).join(' × ')}</small><p>${combo.description}</p><b>${active ? '当前阵容已激活' : known ? '侠客已齐 · 待同队' : '尚未集齐所需侠客'}</b></div>
        </article>`
      }).join('')}</div>
    </section>
    <section class="decision-note panel">
      <span>取舍</span><p>关系羁绊可能让数值较低的侠客成为关键拼图；阵型、武学、门派、关系与合击共同决定最终 build。</p>
    </section>`
}

const renderBattle = (): string => {
  const inChallenge = state.combat.mode === 'challenge'
  const activeBonds = getActiveBonds(state)
  const activeCombos = getActiveCombos(state)
  const region = getSelectedRegion(state)
  const boss = region.boss
  const trait = enemyTraitById(boss.traitId)
  const defeated = state.defeatedBossIds.includes(boss.id)
  const unlocks = nextRegionAfter(region.id)
  return `
    <div class="battle-page-layout">
      <div class="main-column">
        <section class="boss-intel panel" data-testid="boss-intel">
          <div class="boss-intel-title"><span class="seal-icon">敌</span><div><small>${region.name}镇守强敌</small><strong>${boss.name}</strong></div></div>
          <div class="trait-dossier"><small>敌人特性</small><strong>${trait.name}</strong><p>${trait.description}</p></div>
          <div class="counter-dossier"><small>破局提示</small><strong>${trait.counterHint}</strong><p>首胜奖励：${boss.rewards.silver} 银两 · ${boss.rewards.experience} 阅历 · ${boss.rewards.pages} 残页 · ${boss.rewards.reputation} 声望${unlocks ? `；并解锁「${unlocks.name}」` : ''}</p></div>
        </section>
        <section class="challenge-command panel">
          <div><span class="seal-icon">令</span><div><small>${region.name} · ${trait.name}</small><strong>${inChallenge && state.combat.status === 'fighting' ? '本场交锋进行中' : defeated ? '可再次切磋' : '强敌候战'}</strong></div></div>
          ${inChallenge && state.combat.status === 'fighting'
            ? '<button class="secondary-button" data-action="return-idle">退出挑战</button>'
            : `<button class="primary-button" data-action="challenge">${defeated ? '再次挑战' : '挑战'}${boss.name}</button>`}
        </section>
        <section class="skill-plan panel" data-testid="skill-plan">
          <div class="section-title"><span>本阵招式预案</span><small>${activeBonds.length} 条关系羁绊 · ${activeCombos.length} 式合击</small></div>
          <div class="skill-plan-grid">${state.formation.map(({ heroId }) => renderSkillPlanForHero(heroId)).join('')}</div>
          <p class="battle-bond-summary">${activeBonds.length ? `羁绊：${activeBonds.map((bond) => `${bond.name}（${bond.effectText}）`).join('；')}` : '当前没有关系羁绊生效'}${activeCombos.length ? ` · 合击：${activeCombos.map((combo) => combo.name).join('、')}` : ''}</p>
        </section>
        ${inChallenge ? renderCombatArena() : `<section class="boss-preview panel"><span>战</span><strong>${boss.name}</strong><p>整备完成后发出挑战，战斗不会损失资源。</p></section>`}
        <div class="combat-hints">
          <span><i>一</i>查看敌人特性</span><span><i>二</i>按提示调整 build</span><span><i>三</i>首胜解锁新区域</span>
        </div>
      </div>
      ${renderLogs()}
    </div>`
}

const renderMystery = (): string => {
  const run = state.mystery.run
  const route = `
    <div class="mystery-route" data-testid="mystery-route">
      ${MYSTERY_ENCOUNTERS.map((encounter, index) => `<span class="${run && index < run.floor ? 'cleared' : run && index === run.floor && run.status !== 'completed' ? 'active' : ''}">
        <i>${index + 1}</i><b>${encounter.name}</b><small>${encounter.boss ? '秘境之主' : enemyTraitById(encounter.traitId).name}</small>
      </span>`).join('')}
    </div>`
  const heading = ''

  if (!run) {
    return `${heading}
      <section class="mystery-entry panel" data-testid="mystery-page">
        <span class="mystery-seal">秘</span><small>五层连续探索</small><h2>雾门之后，机缘与杀机并存</h2>
        <p>每次进入都会重新排列祝福选项。战败会结束本轮，但已经取得的银两、阅历、残页与声望不会丢失。</p>
        <button class="primary-button" data-action="start-mystery">踏入无相秘境</button>
      </section>${route}`
  }

  const blessingSummary = MYSTERY_BLESSINGS.map((blessing) => ({
    blessing,
    count: run.blessingIds.filter((id) => id === blessing.id).length,
  })).filter(({ count }) => count > 0)
  const encounter = MYSTERY_ENCOUNTERS[Math.min(run.floor, MYSTERY_ENCOUNTERS.length - 1)]
  const runHeader = `
    <section class="mystery-run-head panel">
      <div><small>本轮进度</small><strong>${run.status === 'completed' ? '秘境问鼎' : run.status === 'failed' ? `止步第 ${run.floor + 1} 层` : `第 ${run.floor + 1} / ${MYSTERY_ENCOUNTERS.length} 层`}</strong></div>
      <div class="mystery-earned"><span>银 ${run.earned.silver}</span><span>历 ${run.earned.experience}</span><span>卷 ${run.earned.pages}</span><span>名 ${run.earned.reputation}</span></div>
      <button class="text-button danger" data-action="abandon-mystery" ${run.status === 'completed' || run.status === 'failed' ? 'hidden' : ''}>离开秘境</button>
    </section>
    <section class="blessing-stack panel">
      <div class="section-title"><span>本轮祝福</span><small>${run.blessingIds.length} 层加持，可重复叠加</small></div>
      <div>${blessingSummary.length ? blessingSummary.map(({ blessing, count }) => `<span><b>${blessing.name}${count > 1 ? ` ×${count}` : ''}</b><small>${blessing.effectText}</small></span>`).join('') : '<p>尚未取得祝福。</p>'}</div>
    </section>`

  if (run.status === 'choosing') {
    return `${heading}${route}${runHeader}
      <section class="mystery-choice-panel panel" data-testid="mystery-choices">
        <div class="section-title"><span>前方岔路</span><small>选择后立即进入第 ${run.floor + 1} 层战斗</small></div>
        <div class="next-encounter"><span>敌</span><div><small>${enemyTraitById(encounter.traitId).name}</small><strong>${encounter.name}</strong><p>${encounter.description}</p></div></div>
        <div class="mystery-choice-grid">${run.choiceIds.map((id) => {
          const blessing = mysteryBlessingById(id)!
          return `<button data-action="choose-mystery" data-blessing-id="${blessing.id}">
            <span>择</span><div><strong>${blessing.name}</strong><p>${blessing.description}</p><b>${blessing.effectText}</b></div>
          </button>`
        }).join('')}</div>
      </section>`
  }

  if (run.status === 'fighting') {
    return `${heading}${route}${runHeader}
      <div class="battle-page-layout mystery-battle-layout">
        <div class="main-column">
          <section class="mystery-encounter panel"><span>战</span><div><small>第 ${run.floor + 1} 层 · ${enemyTraitById(encounter.traitId).name}</small><strong>${encounter.name}</strong><p>${encounter.description}</p></div></section>
          ${renderCombatArena()}
        </div>
        ${renderLogs()}
      </div>`
  }

  const completed = run.status === 'completed'
  return `${heading}${route}${runHeader}
    <section class="mystery-result panel ${completed ? 'completed' : 'failed'}" data-testid="mystery-result">
      <span>${completed ? '问鼎' : '归来'}</span>
      <h2>${completed ? '无相秘境已经贯通' : '此轮探索止步于此'}</h2>
      <p>${completed ? '五层守关者尽数落败，所有祝福化作一段新的江湖传闻。' : '重新调整阵型、武学与羁绊，再来时或许能走得更远。'}本轮战利品已经永久收入存档。</p>
      <div class="settlement-grid">
        <div><span>银</span><strong>+${run.earned.silver}</strong><small>银两</small></div>
        <div><span>历</span><strong>+${run.earned.experience}</strong><small>阅历</small></div>
        <div><span>卷</span><strong>+${run.earned.pages}</strong><small>残页</small></div>
        <div><span>名</span><strong>+${run.earned.reputation}</strong><small>声望</small></div>
      </div>
      <button class="primary-button" data-action="finish-mystery">收下战利品并离开</button>
    </section>`
}

const renderFooter = (): string => `
  <footer class="game-footer"><span>蛋蛋江湖 2.0 · 迭代 6</span><button class="text-button danger" data-action="reset">重开存档</button></footer>`

const isViewingIdleCombat = (): boolean => activeTab === 'idle'
  && levelView === 'combat'
  && state.combat.mode === 'idle'
  && state.combat.status === 'fighting'

const renderIdleCombatReturn = (): string => {
  if (state.combat.mode !== 'idle' || state.combat.status !== 'fighting' || isViewingIdleCombat()) return ''
  const region = regionById(state.combat.regionId) ?? REGIONS[0]
  const stage = state.combat.stage ?? 1
  return `
    <button class="idle-combat-return" type="button" data-action="return-idle-combat" data-testid="idle-combat-return"
      aria-label="返回${region.name}第 ${stage} 关挂机界面">
      <span class="idle-combat-return-status"><i></i>挂机战斗中</span>
      <strong>${region.name} · 第 ${stage} 关</strong>
      <small>返回战斗 <b aria-hidden="true">→</b></small>
    </button>`
}

function render(): void {
  const content = activeTab === 'idle'
    ? renderIdle()
    : activeTab === 'heroes'
      ? renderHeroes()
      : activeTab === 'party'
        ? renderParty()
        : activeTab === 'battle'
          ? renderBattle()
          : renderMystery()
  app.innerHTML = `
    ${renderHeader()}
    ${renderNav()}
    <main class="game-main">${content}</main>
    ${renderFooter()}
    ${renderIdleCombatReturn()}
    ${toast ? `<div class="toast ${toastKind}" role="status">${escapeHtml(toast)}</div>` : ''}`
}

const persistAndRender = (): void => {
  saveGame(window.localStorage, state)
  render()
}

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  const tabButton = target.closest<HTMLElement>('[data-tab]')
  if (tabButton?.dataset.tab) {
    activeTab = tabButton.dataset.tab as TabId
    if (activeTab === 'idle') {
      levelView = 'regions'
      chapterRegionId = null
    }
    render()
    return
  }
  const button = target.closest<HTMLButtonElement>('button[data-action]')
  if (!button) return
  const { action, blessingId, direction, heroId, martialId, regionId, row, slot, stage } = button.dataset
  if (toastTimer) window.clearTimeout(toastTimer)

  switch (action) {
    case 'select-hero': selectedHeroId = heroId ?? null; break
    case 'upgrade': notify(upgradeHero(state, heroId ?? '')); break
    case 'equip-martial': notify(equipMartial(state, heroId ?? '', martialId ?? '')); break
    case 'unequip-martial': notify(unequipMartial(state, heroId ?? '', Number(slot))); break
    case 'move-martial': {
      const offset = Number(direction)
      if (offset !== -1 && offset !== 1) return
      notify(moveMartial(state, heroId ?? '', Number(slot), offset))
      break
    }
    case 'forget-martial': {
      const targetHeroId = heroId ?? ''
      const targetMartialId = martialId ?? ''
      const preview = getMartialForgetPreview(state, targetHeroId, targetMartialId)
      if (!preview) {
        notify('没有可遗忘的武功', 'warning')
        break
      }
      const equipped = state.heroes[targetHeroId]?.equippedMartialIds.includes(targetMartialId)
      const refund = preview.refund
      const confirmed = window.confirm([
        `确定遗忘「${preview.martial.name}」？`,
        `当前重数：${preview.martial.rankNames[preview.rank - 1]}`,
        `消失被动：${preview.passiveText}`,
        equipped ? '该武功已装备，确认后将自动卸下。' : '',
        `返还：${refund.silver} 银两、${refund.experience} 阅历、${refund.pages} 残页、${refund.reputation} 声望`,
        '遗忘后无法撤销。',
      ].filter(Boolean).join('\n'))
      if (!confirmed) return
      notify(forgetMartial(state, targetHeroId, targetMartialId))
      break
    }
    case 'open-region': {
      if (!REGIONS.some((region) => region.id === regionId)) return
      chapterRegionId = regionId as RegionId
      levelView = 'stages'
      break
    }
    case 'back-regions': chapterRegionId = null; levelView = 'regions'; break
    case 'back-stages': chapterRegionId = state.combat.regionId; levelView = 'stages'; break
    case 'start-stage': {
      if (!REGIONS.some((region) => region.id === regionId)) return
      const result = startIdleStage(state, regionId as RegionId, Number(stage))
      notify(result)
      if (result.ok) {
        chapterRegionId = regionId as RegionId
        levelView = 'combat'
      }
      break
    }
    case 'return-idle-combat': {
      if (state.combat.mode !== 'idle' || state.combat.status !== 'fighting') break
      activeTab = 'idle'
      chapterRegionId = state.combat.regionId
      levelView = 'combat'
      break
    }
    case 'stop-idle': {
      if (state.combat.mode !== 'idle' || state.combat.status !== 'fighting') break
      const combatRegionId = state.combat.regionId
      notify(returnToIdle(state))
      activeTab = 'idle'
      chapterRegionId = combatRegionId
      levelView = 'stages'
      break
    }
    case 'set-row': {
      if (row !== 'front' && row !== 'back') return
      const slotIndex = state.formation.findIndex((candidate) => candidate.heroId === heroId)
      if (slotIndex < 0) return
      notify(setFormationRow(state, slotIndex, row))
      break
    }
    case 'toggle-formation': {
      const targetId = heroId ?? ''
      if (state.formation.some((candidate) => candidate.heroId === targetId)) {
        notify(removeFromFormation(state, targetId))
        break
      }
      const frontCount = state.formation.filter((candidate) => candidate.row === 'front').length
      const targetRow: FormationRow = state.formation.length - frontCount <= frontCount ? 'back' : 'front'
      notify(addToFormation(state, targetId, targetRow))
      break
    }
    case 'remove-formation': notify(removeFromFormation(state, heroId ?? '')); break
    case 'challenge': notify(startChallenge(state)); activeTab = 'battle'; break
    case 'start-mystery': notify(startMystery(state)); activeTab = 'mystery'; break
    case 'choose-mystery': {
      if (!MYSTERY_BLESSINGS.some((blessing) => blessing.id === blessingId)) return
      notify(chooseMysteryBlessing(state, blessingId as MysteryBlessingId))
      activeTab = 'mystery'
      break
    }
    case 'abandon-mystery': {
      if (!window.confirm('确定离开秘境？本轮祝福与路线进度会清空，已获得的战利品仍会保留。')) return
      notify(abandonMystery(state))
      break
    }
    case 'finish-mystery': notify(finishMystery(state)); break
    case 'return-idle': notify(returnToIdle(state)); levelView = 'regions'; chapterRegionId = null; break
    case 'export': {
      const blob = new Blob([exportSave(state)], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `蛋蛋江湖存档-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(link.href)
      notify('存档已导出为 JSON 文件')
      break
    }
    case 'import': importInput.click(); return
    case 'reset': {
      if (!window.confirm('确定重开存档？当前本地进度将被清除，建议先导出备份。')) return
      clearSave(window.localStorage)
      state = createInitialState()
      activeTab = 'idle'
      levelView = 'regions'
      chapterRegionId = null
      selectedHeroId = null
      lastRuntimeAt = Date.now()
      notify('江湖已重开')
      break
    }
    default: return
  }
  persistAndRender()
})

/* ---- 阵容拖拽（侠客页：名册 ⇄ 阵容格，前 3 后 3） ---- */
let dragHeroId: string | null = null
let dragFromFormation = false
let dragCandidatePressed = false   // 按下可拖拽元素期间同样暂停重绘，保护 mousedown → dragstart 窗口

const clearFormationDrag = (): void => {
  dragHeroId = null
  dragFromFormation = false
  app.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'))
}

app.addEventListener('pointerdown', (event) => {
  dragCandidatePressed = Boolean((event.target as HTMLElement).closest('[data-drag-hero]'))
})
app.addEventListener('pointerup', () => { dragCandidatePressed = false })
app.addEventListener('pointercancel', () => { dragCandidatePressed = false })

const placeHeroOnFormation = (heroId: string, row: FormationRow, occupantId?: string): ActionResult => {
  const slotIndex = state.formation.findIndex((candidate) => candidate.heroId === heroId)
  if (occupantId && occupantId !== heroId) {
    // 落到已占用的格子：阵容内互换前后排；阵容外直接替换该格侠客
    if (slotIndex >= 0) return swapFormationRows(state, heroId, occupantId)
    return setPartySlot(state, state.formation.findIndex((candidate) => candidate.heroId === occupantId), heroId)
  }
  if (slotIndex >= 0) {
    if (state.formation[slotIndex].row === row) return { ok: true, message: '侠客已在这一排' }
    return setFormationRow(state, slotIndex, row)
  }
  return addToFormation(state, heroId, row)
}

app.addEventListener('dragstart', (event) => {
  const el = (event.target as HTMLElement).closest<HTMLElement>('[data-drag-hero]')
  if (!el || !event.dataTransfer) return
  dragHeroId = el.dataset.dragHero ?? null
  dragFromFormation = Boolean(el.closest('.formation-slot'))
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', dragHeroId ?? '')
  el.classList.add('dragging')
})

app.addEventListener('dragover', (event) => {
  if (!dragHeroId || !event.dataTransfer) return
  const target = event.target as HTMLElement
  const rowEl = target.closest<HTMLElement>('[data-drop-row]')
  if (rowEl) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    rowEl.classList.add('drag-over')
    return
  }
  const rosterEl = target.closest<HTMLElement>('[data-drop-roster]')
  if (rosterEl && dragFromFormation) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    rosterEl.classList.add('drag-over')
  }
})

app.addEventListener('dragleave', (event) => {
  const related = event.relatedTarget as Node | null
  const target = event.target as HTMLElement
  const rowEl = target.closest<HTMLElement>('[data-drop-row]')
  if (rowEl && !rowEl.contains(related)) rowEl.classList.remove('drag-over')
  const rosterEl = target.closest<HTMLElement>('[data-drop-roster]')
  if (rosterEl && !rosterEl.contains(related)) rosterEl.classList.remove('drag-over')
})

app.addEventListener('drop', (event) => {
  if (!dragHeroId) return
  const target = event.target as HTMLElement
  const rowEl = target.closest<HTMLElement>('[data-drop-row]')
  const rosterEl = target.closest<HTMLElement>('[data-drop-roster]')
  if (!rowEl && !(rosterEl && dragFromFormation)) return
  event.preventDefault()
  const heroId = dragHeroId
  clearFormationDrag()
  if (!rowEl) {
    notify(removeFromFormation(state, heroId))
    persistAndRender()
    return
  }
  const row = rowEl.dataset.dropRow as FormationRow
  const occupantId = target.closest<HTMLElement>('.formation-slot.filled')?.dataset.dragHero
  notify(placeHeroOnFormation(heroId, row, occupantId))
  persistAndRender()
})

app.addEventListener('dragend', () => { clearFormationDrag() })

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0]
  if (!file) return
  try {
    const imported = importSave(await file.text())
    state = imported.state
    levelView = 'regions'
    chapterRegionId = null
    selectedHeroId = null
    lastRuntimeAt = Date.now()
    saveGame(window.localStorage, state)
    notify('存档导入成功')
  } catch (error) {
    notify(error instanceof Error ? `导入失败：${error.message}` : '导入失败：文件格式无效', 'warning')
  }
  importInput.value = ''
  render()
})

window.setInterval(() => {
  const now = Date.now()
  const elapsed = Math.floor((now - lastRuntimeAt) / 1000)
  if (elapsed <= 0) return
  if (elapsed > 10) {
    lastRuntimeAt = now
    state.lastTickAt = now
  } else {
    for (let index = 0; index < elapsed; index += 1) stepCombat(state)
    lastRuntimeAt += elapsed * 1000
    state.lastTickAt = now
  }
  if (!dragHeroId && !dragCandidatePressed) render()   // 拖拽布阵期间跳过整树重绘，避免拖源被销毁
}, 500)

window.setInterval(() => saveGame(window.localStorage, state), 5000)
window.addEventListener('beforeunload', () => saveGame(window.localStorage, state))

declare global {
  interface Window {
    __EGG_JIANGHU__: {
      getState: () => GameState
      setTab: (tab: TabId) => void
      advanceCombat: (steps: number) => void
      reset: () => void
    }
  }
}

window.__EGG_JIANGHU__ = {
  getState: () => structuredClone(state),
  setTab: (tab) => { activeTab = tab; render() },
  advanceCombat: (steps) => { for (let index = 0; index < steps; index += 1) stepCombat(state); persistAndRender() },
  reset: () => {
    clearSave(window.localStorage)
    state = createInitialState()
    levelView = 'regions'
    chapterRegionId = null
    selectedHeroId = null
    lastRuntimeAt = Date.now()
    render()
  },
}

render()
