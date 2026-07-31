import './style.css'
import { COMBO, HEROES, IDLE_LOCATION, MARTIALS, heroById, martialById } from './data'
import {
  applyOfflineProgress,
  createInitialState,
  equipMartial,
  getHeroStats,
  getPartyPower,
  getPartySynergy,
  getUpgradeCost,
  recruitHero,
  returnToIdle,
  setPartySlot,
  startChallenge,
  stepCombat,
  trainMartial,
  unlockMartial,
  upgradeHero,
} from './game'
import { clearSave, exportSave, importSave, loadGame, saveGame } from './save'
import type { ActionResult, GameState, OfflineSettlement } from './types'

type TabId = 'idle' | 'heroes' | 'party' | 'battle'

const appElement = document.querySelector<HTMLDivElement>('#app')
if (!appElement) throw new Error('缺少 #app 根节点')
const app = appElement

const loaded = loadGame(window.localStorage)
let state = loaded.state
let activeTab: TabId = 'idle'
let offlineSettlement: OfflineSettlement | null = loaded.settlement && loaded.settlement.seconds >= 30
  ? loaded.settlement
  : null
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

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours) return `${hours}时 ${minutes}分`
  if (minutes) return `${minutes}分 ${secs}秒`
  return `${secs}秒`
}

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
    render()
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

const tabItems: { id: TabId; label: string; note: string }[] = [
  { id: 'idle', label: '挂机', note: '青石古道' },
  { id: 'heroes', label: '侠客', note: `${HEROES.filter((hero) => state.heroes[hero.id].unlocked).length}/${HEROES.length}` },
  { id: 'party', label: '队伍', note: '三人同行' },
  { id: 'battle', label: '战斗', note: `已破 ${state.clearedStage} 关` },
]

const renderNav = (): string => `
  <nav class="game-nav" aria-label="游戏区域">
    ${tabItems.map((item) => `
      <button class="nav-item ${activeTab === item.id ? 'active' : ''}" data-tab="${item.id}" aria-current="${activeTab === item.id ? 'page' : 'false'}">
        <span>${item.label}</span><small>${item.note}</small>
      </button>`).join('')}
  </nav>`

const renderHeroFighter = (heroId: string, index: number): string => {
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  const lastEvent = state.combat.lastEvent
  const acting = lastEvent?.actorId === heroId && lastEvent.kind === 'attack'
  if (!hero || !progress) return ''
  return `
    <article class="fighter-card hero-fighter ${acting ? 'is-acting' : ''}" style="--fighter-delay:${index * 80}ms">
      <div class="fighter-avatar element-${hero.element}">${hero.name.slice(-1)}</div>
      <div class="fighter-copy">
        <strong>${hero.name}</strong>
        <span>Lv.${progress.level} · ${martialById(progress.equippedMartialId ?? '')?.name ?? '拳脚'}</span>
      </div>
    </article>`
}

const renderCombatArena = (compact = false): string => {
  const combat = state.combat
  const partyPercent = Math.max(0, Math.round((combat.partyHp / combat.partyMaxHp) * 100))
  const enemyPercent = Math.max(0, Math.round((combat.enemyHp / combat.enemyMaxHp) * 100))
  const hitEvent = combat.lastEvent
  const enemyHit = hitEvent && (hitEvent.kind === 'attack' || hitEvent.kind === 'combo')
  const partyHit = hitEvent?.kind === 'enemy'
  const modeLabel = combat.mode === 'idle' ? '自动历练中' : `第 ${combat.stage} 关 · ${combat.status === 'fighting' ? '交锋中' : combat.status === 'victory' ? '胜利' : '落败'}`

  return `
    <section class="battle-arena ${compact ? 'compact' : ''}" data-testid="battle-arena">
      <div class="arena-heading">
        <span class="live-dot"><i></i>${modeLabel}</span>
        <span>第 ${combat.round + 1} 回合</span>
      </div>
      <div class="battle-stage">
        <div class="side party-side ${partyHit ? 'takes-hit' : ''}">
          <div class="side-label"><span>我方</span><b>${combat.partyHp} / ${combat.partyMaxHp}</b></div>
          <div class="health-track"><i style="width:${partyPercent}%"></i></div>
          <div class="fighter-stack">${state.party.map(renderHeroFighter).join('')}</div>
          ${partyHit ? `<b class="damage-float party-damage">-${hitEvent?.amount ?? 0}</b>` : ''}
        </div>
        <div class="versus-mark"><span>交</span><i></i><small>锋</small></div>
        <div class="side enemy-side ${enemyHit ? 'takes-hit' : ''}">
          <div class="side-label"><span>敌方</span><b>${combat.enemyHp} / ${combat.enemyMaxHp}</b></div>
          <div class="health-track enemy-health"><i style="width:${enemyPercent}%"></i></div>
          <div class="enemy-portrait"><span>敌</span><small>${escapeHtml(combat.enemyName)}</small></div>
          ${enemyHit ? `<b class="damage-float enemy-damage ${hitEvent?.kind === 'combo' ? 'combo-damage' : ''}">-${hitEvent?.amount ?? 0}</b>` : ''}
        </div>
        ${hitEvent?.kind === 'combo' ? `<div class="combo-flash"><span>合击</span><strong>${COMBO.name}</strong></div>` : ''}
      </div>
      ${combat.status !== 'fighting' ? `
        <div class="battle-result ${combat.status}">
          <span>${combat.status === 'victory' ? '破关' : '惜败'}</span>
          <strong>${combat.status === 'victory' ? '此役功成，江湖声名更进一步' : '整备武学与阵容，再战未迟'}</strong>
          <button class="primary-button" data-action="return-idle">返回青石古道</button>
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

const renderIdle = (): string => {
  const perMinute = { silver: 60 * 1.35, experience: 60 * 0.82 }
  return `
    <div class="page-heading">
      <div><span class="eyebrow">Jianghu Journey</span><h1>${IDLE_LOCATION.name}</h1><p>${IDLE_LOCATION.description}</p></div>
      <div class="location-status"><i></i><span>队伍正在历练<strong>${IDLE_LOCATION.rewardText}</strong></span></div>
    </div>
    <div class="idle-layout">
      <div class="main-column">
        ${state.combat.mode === 'idle' ? renderCombatArena() : `
          <section class="challenge-away panel">
            <span class="seal-icon">战</span>
            <div><strong>队伍正在闯关</strong><p>前往「战斗」查看本场挑战。</p></div>
            <button class="secondary-button" data-tab="battle">查看战况</button>
          </section>`}
        <section class="yield-panel panel">
          <div class="section-title"><span>历练收益</span><small>离线最多结算 12 小时</small></div>
          <div class="yield-grid">
            <div><small>每分钟银两</small><strong>+${formatNumber(perMinute.silver)}</strong><span>稳定产出</span></div>
            <div><small>每分钟阅历</small><strong>+${formatNumber(perMinute.experience)}</strong><span>用于提升侠客</span></div>
            <div><small>古道败敌</small><strong>${formatNumber(state.statistics.idleEnemiesDefeated)}</strong><span>每 4 敌额外残页</span></div>
            <div><small>队伍战力</small><strong>${formatNumber(getPartyPower(state))}</strong><span>羁绊已计入</span></div>
          </div>
        </section>
      </div>
      ${renderLogs()}
    </div>`
}

const renderMartialSelect = (heroId: string): string => {
  const equipped = state.heroes[heroId].equippedMartialId
  return `
    <label class="field-label">所习武学
      <select data-action="equip-martial" data-hero-id="${heroId}">
        ${state.unlockedMartials.map((martialId) => {
          const martial = martialById(martialId)
          return martial ? `<option value="${martial.id}" ${equipped === martial.id ? 'selected' : ''}>${martial.name}</option>` : ''
        }).join('')}
      </select>
    </label>`
}

const renderHeroCard = (heroId: string): string => {
  const hero = heroById(heroId)
  const progress = state.heroes[heroId]
  if (!hero || !progress) return ''
  const stats = getHeroStats(state, heroId)
  if (!progress.unlocked) {
    return `
      <article class="hero-card locked">
        <div class="hero-card-head"><div class="portrait muted">?</div><div><span>${hero.sect} · ${hero.epithet}</span><h3>${hero.name}</h3></div></div>
        <p>${hero.description}</p>
        <div class="tag-row"><span>${hero.element}行</span><span>${hero.style}劲</span></div>
        <button class="primary-button full" data-action="recruit" data-hero-id="${hero.id}">以 ${hero.recruitCost} 银两结识</button>
      </article>`
  }
  const martial = progress.equippedMartialId ? martialById(progress.equippedMartialId) : undefined
  const rank = martial ? progress.martialRanks[martial.id] ?? 1 : 0
  const upgradeCost = getUpgradeCost(progress.level)
  const trainSilver = rank * 55
  const trainPages = rank * 12
  return `
    <article class="hero-card unlocked">
      <div class="hero-card-head">
        <div class="portrait element-${hero.element}">${hero.name.slice(-1)}</div>
        <div><span>${hero.sect} · ${hero.epithet}</span><h3>${hero.name}<small>Lv.${progress.level}</small></h3></div>
        <b class="power-number">${stats.power}<small>战力</small></b>
      </div>
      <p>${hero.description}</p>
      <div class="stat-line"><span>攻 <b>${stats.attack}</b></span><span>御 <b>${stats.defense}</b></span><span>气血 <b>${stats.hp}</b></span></div>
      <div class="tag-row"><span>${hero.element}行</span><span>${hero.style}劲</span><span class="affinity">${stats.affinityText}</span></div>
      ${renderMartialSelect(heroId)}
      <div class="card-actions">
        <button class="secondary-button" data-action="upgrade" data-hero-id="${hero.id}">升级 <small>${upgradeCost.silver}银 / ${upgradeCost.experience}历</small></button>
        <button class="secondary-button" data-action="train" data-hero-id="${hero.id}" ${rank >= 3 ? 'disabled' : ''}>${rank >= 3 ? '武学圆满' : `武学进阶 · ${trainSilver}银/${trainPages}卷`}</button>
      </div>
    </article>`
}

const renderHeroes = (): string => `
  <div class="page-heading compact-heading">
    <div><span class="eyebrow">Heroes &amp; Martial Arts</span><h1>江湖名册</h1><p>阅历用于精进境界；武学与侠客五行、刚柔相合时，威力更盛。</p></div>
  </div>
  <section class="martial-library panel">
    <div class="section-title"><span>藏经阁 · 五门武学</span><small>残页可参悟，单侠客可修至三重</small></div>
    <div class="martial-strip">
      ${MARTIALS.map((martial) => {
        const unlocked = state.unlockedMartials.includes(martial.id)
        return `<article class="martial-item ${unlocked ? '' : 'locked'}">
          <span class="martial-glyph element-${martial.element}">${martial.element}</span>
          <div><strong>${martial.name}</strong><small>${martial.element}行 · ${martial.style}劲</small><p>${martial.description}</p></div>
          ${unlocked ? '<b class="learned">已参悟</b>' : `<button class="text-button" data-action="unlock-martial" data-martial-id="${martial.id}">${martial.unlockCost} 残页</button>`}
        </article>`
      }).join('')}
    </div>
  </section>
  <section class="hero-grid">${HEROES.map((hero) => renderHeroCard(hero.id)).join('')}</section>`

const renderParty = (): string => {
  const synergy = getPartySynergy(state)
  const unlocked = HEROES.filter((hero) => state.heroes[hero.id].unlocked)
  return `
    <div class="page-heading compact-heading">
      <div><span class="eyebrow">Formation &amp; Bonds</span><h1>三人同行</h1><p>选择三位侠客出战。同门可激活门派共鸣，特定侠客则能施展合击。</p></div>
      <div class="power-plaque"><small>当前队伍战力</small><strong>${formatNumber(getPartyPower(state))}</strong></div>
    </div>
    <section class="party-board panel">
      <div class="party-slots">
        ${state.party.map((heroId, index) => {
          const hero = heroById(heroId)!
          const stats = getHeroStats(state, heroId)
          return `<article class="party-slot">
            <span class="slot-index">第 ${index + 1} 位</span>
            <div class="portrait large element-${hero.element}">${hero.name.slice(-1)}</div>
            <strong>${hero.name}</strong><small>${hero.sect} · ${hero.epithet}</small>
            <div class="slot-power">攻 ${stats.attack} · 战力 ${stats.power}</div>
            <select data-action="party-slot" data-slot="${index}" ${state.combat.mode === 'challenge' && state.combat.status === 'fighting' ? 'disabled' : ''}>
              ${unlocked.map((candidate) => `<option value="${candidate.id}" ${candidate.id === heroId ? 'selected' : ''}>${candidate.name} · ${candidate.sect}</option>`).join('')}
            </select>
          </article>`
        }).join('')}
      </div>
      <div class="synergy-line" aria-hidden="true"><i></i><span></span><i></i></div>
      <div class="synergy-grid">
        <article class="synergy-card ${synergy.sectName ? 'active' : ''}"><span class="seal-icon">门</span><div><small>门派羁绊</small><strong>${synergy.sectName ? `${synergy.sectName}共鸣` : '尚未激活'}</strong><p>${synergy.sectText}</p></div></article>
        <article class="synergy-card ${synergy.comboActive ? 'active combo' : ''}"><span class="seal-icon">合</span><div><small>联手武学</small><strong>${COMBO.name}</strong><p>${synergy.comboActive ? '已激活：每三回合自动施展一次强力合击。' : `需 ${COMBO.heroIds.map((id) => heroById(id)?.name).join(' + ')} 同队。`}</p></div></article>
      </div>
    </section>
    <section class="decision-note panel">
      <span>取舍</span><p>招募同门可以稳定提升全队攻势；招募江晚并与陆青山同队，则会换来爆发更高的「${COMBO.name}」。同一位置无法兼得，正是配队的第一道江湖题。</p>
    </section>`
}

const renderBattle = (): string => {
  const inChallenge = state.combat.mode === 'challenge'
  const nextStage = state.clearedStage + 1
  return `
    <div class="page-heading compact-heading">
      <div><span class="eyebrow">Challenge</span><h1>古道破关</h1><p>挑战强敌以检验当前 build。落败不损失资源，调整队伍后可随时再来。</p></div>
      <div class="stage-plaque"><small>下一关</small><strong>${nextStage}</strong><span>推荐战力 ${formatNumber(360 + (nextStage - 1) * 430)}</span></div>
    </div>
    <div class="battle-page-layout">
      <div class="main-column">
        <section class="challenge-command panel">
          <div><span class="seal-icon">令</span><div><small>青石古道 · 第 ${nextStage} 关</small><strong>${inChallenge ? '本场交锋进行中' : '强敌候战'}</strong></div></div>
          ${inChallenge && state.combat.status === 'fighting'
            ? '<button class="secondary-button" data-action="return-idle">退出挑战</button>'
            : `<button class="primary-button" data-action="challenge">挑战第 ${nextStage} 关</button>`}
        </section>
        ${renderCombatArena()}
        <div class="combat-hints">
          <span><i>一</i>提升侠客等级</span><span><i>二</i>匹配武学相性</span><span><i>三</i>激活羁绊或合击</span>
        </div>
      </div>
      ${renderLogs()}
    </div>`
}

const renderOfflineModal = (): string => {
  if (!offlineSettlement) return ''
  return `
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="offline-title">
      <section class="offline-modal">
        <span class="modal-seal">归</span>
        <small>少侠归来</small><h2 id="offline-title">古道未曾停歇</h2>
        <p>离开江湖的 ${formatDuration(offlineSettlement.seconds)} 里，队伍仍在自行历练${offlineSettlement.capped ? '（已按 12 小时上限结算）' : ''}。</p>
        <div class="settlement-grid">
          <div><span>银</span><strong>+${formatNumber(offlineSettlement.silver)}</strong><small>银两</small></div>
          <div><span>历</span><strong>+${formatNumber(offlineSettlement.experience)}</strong><small>阅历</small></div>
          <div><span>卷</span><strong>+${formatNumber(offlineSettlement.pages)}</strong><small>残页</small></div>
          <div><span>敌</span><strong>${formatNumber(offlineSettlement.enemies)}</strong><small>败敌</small></div>
        </div>
        <button class="primary-button full" data-action="close-offline">收下历练所得</button>
      </section>
    </div>`
}

const renderFooter = (): string => `
  <footer class="game-footer"><span>蛋蛋江湖 2.0 · MVP</span><button class="text-button danger" data-action="reset">重开存档</button></footer>`

function render(): void {
  const focused = document.activeElement
  if (focused instanceof HTMLSelectElement) return
  const content = activeTab === 'idle' ? renderIdle() : activeTab === 'heroes' ? renderHeroes() : activeTab === 'party' ? renderParty() : renderBattle()
  app.innerHTML = `
    ${renderHeader()}
    ${renderNav()}
    <main class="game-main">${content}</main>
    ${renderFooter()}
    ${toast ? `<div class="toast ${toastKind}" role="status">${escapeHtml(toast)}</div>` : ''}
    ${renderOfflineModal()}`
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
    render()
    return
  }
  const button = target.closest<HTMLButtonElement>('button[data-action]')
  if (!button) return
  const { action, heroId, martialId } = button.dataset
  if (toastTimer) window.clearTimeout(toastTimer)

  switch (action) {
    case 'upgrade': notify(upgradeHero(state, heroId ?? '')); break
    case 'recruit': notify(recruitHero(state, heroId ?? '')); break
    case 'train': notify(trainMartial(state, heroId ?? '')); break
    case 'unlock-martial': notify(unlockMartial(state, martialId ?? '')); break
    case 'challenge': notify(startChallenge(state)); activeTab = 'battle'; break
    case 'return-idle': notify(returnToIdle(state)); break
    case 'close-offline': offlineSettlement = null; notify('离线收益已收入囊中'); break
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
      offlineSettlement = null
      activeTab = 'idle'
      lastRuntimeAt = Date.now()
      notify('江湖已重开')
      break
    }
    default: return
  }
  persistAndRender()
})

app.addEventListener('change', (event) => {
  const select = event.target as HTMLSelectElement
  if (!(select instanceof HTMLSelectElement)) return
  const action = select.dataset.action
  if (action === 'equip-martial') notify(equipMartial(state, select.dataset.heroId ?? '', select.value))
  else if (action === 'party-slot') notify(setPartySlot(state, Number(select.dataset.slot), select.value))
  else return
  persistAndRender()
})

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0]
  if (!file) return
  try {
    const imported = importSave(await file.text())
    state = imported.state
    offlineSettlement = imported.settlement.seconds >= 30 ? imported.settlement : null
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
    state.lastTickAt = lastRuntimeAt
    const settlement = applyOfflineProgress(state, now)
    if (settlement.seconds >= 30) offlineSettlement = settlement
    lastRuntimeAt = now
  } else {
    for (let index = 0; index < elapsed; index += 1) stepCombat(state)
    lastRuntimeAt += elapsed * 1000
    state.lastTickAt = now
  }
  render()
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
  reset: () => { clearSave(window.localStorage); state = createInitialState(); lastRuntimeAt = Date.now(); render() },
}

render()
