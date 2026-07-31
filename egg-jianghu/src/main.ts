import './style.css'
import {
  BONDS,
  COMBOS,
  HEROES,
  MARTIALS,
  REGIONS,
  enemyTraitById,
  heroById,
  martialById,
  nextRegionAfter,
  regionById,
} from './data'
import {
  COMBAT_STATUS_NAMES,
  applyOfflineProgress,
  createInitialState,
  equipMartial,
  getActiveBonds,
  getActiveCombos,
  getFormationSummary,
  getHeroStats,
  getIdleRewardRates,
  getPartyPower,
  getPartySynergy,
  getSelectedRegion,
  getUpgradeCost,
  isRegionUnlocked,
  recruitHero,
  returnToIdle,
  selectRegion,
  setFormationRow,
  setPartySlot,
  startChallenge,
  stepCombat,
  trainMartial,
  unlockMartial,
  upgradeHero,
} from './game'
import { clearSave, exportSave, importSave, loadGame, saveGame } from './save'
import type { ActionResult, CombatHeroState, CombatStatus, FormationRow, GameState, OfflineSettlement, RegionId } from './types'

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

const renderStatusChips = (statuses: CombatStatus[]): string => statuses.length
  ? `<div class="status-chips">${statuses.map((status) => `
      <span class="status-${status.id}" title="剩余 ${status.turns} 回合">${COMBAT_STATUS_NAMES[status.id]} · ${status.turns}</span>`).join('')}
    </div>`
  : ''

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

const getTabItems = (): { id: TabId; label: string; note: string }[] => [
  { id: 'idle', label: '挂机', note: getSelectedRegion(state).name },
  { id: 'heroes', label: '侠客', note: `${HEROES.filter((hero) => state.heroes[hero.id].unlocked).length}/${HEROES.length}` },
  { id: 'party', label: '队伍', note: '前后列阵' },
  { id: 'battle', label: '战斗', note: `已破 ${state.defeatedBossIds.length}/${REGIONS.length}` },
]

const renderNav = (): string => `
  <nav class="game-nav" aria-label="游戏区域">
    ${getTabItems().map((item) => `
      <button class="nav-item ${activeTab === item.id ? 'active' : ''}" data-tab="${item.id}" aria-current="${activeTab === item.id ? 'page' : 'false'}">
        <span>${item.label}</span><small>${item.note}</small>
      </button>`).join('')}
  </nav>`

const renderHeroFighter = (member: CombatHeroState, index: number): string => {
  const hero = heroById(member.heroId)
  const progress = state.heroes[member.heroId]
  const lastEvent = state.combat.lastEvent
  const acting = lastEvent?.actorId === member.heroId && (lastEvent.kind === 'attack' || lastEvent.kind === 'skill')
  const targeted = lastEvent?.targetId === member.heroId && lastEvent.kind === 'enemy'
  const hpPercent = Math.max(0, Math.round((member.hp / member.maxHp) * 100))
  if (!hero || !progress) return ''
  const martial = martialById(progress.equippedMartialId ?? '')
  return `
    <article class="fighter-card hero-fighter ${acting ? 'is-acting' : ''} ${targeted ? 'is-targeted' : ''} ${member.hp <= 0 ? 'is-defeated' : ''}" style="--fighter-delay:${index * 80}ms" data-hero-id="${hero.id}">
      <span class="fighter-position">${member.row === 'front' ? '前排 · 减伤' : '后排 · 增伤'}</span>
      <div class="fighter-avatar element-${hero.element}">${hero.name.slice(-1)}</div>
      <div class="fighter-copy">
        <strong>${hero.name}</strong>
        <span>Lv.${progress.level} · ${martial?.name ?? '拳脚'}</span>
      </div>
      <div class="fighter-health health-track"><i style="width:${hpPercent}%"></i></div>
      <small class="fighter-hp">${member.hp} / ${member.maxHp}</small>
      ${martial ? `<small class="fighter-skill ${member.skillCooldown <= 0 ? 'ready' : ''}">${martial.skill.name} · ${member.skillCooldown <= 0 ? '蓄势已成' : `${member.skillCooldown} 次行动后`}</small>` : ''}
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
    ? `${region.name} · 自动历练中`
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
        ${hitEvent?.kind === 'skill' ? `<div class="skill-flash"><span>绝技</span><strong>${martialById(state.heroes[hitEvent.actorId ?? '']?.equippedMartialId ?? '')?.skill.name ?? '武学招式'}</strong></div>` : ''}
      </div>
      ${combat.status !== 'fighting' ? `
        <div class="battle-result ${combat.status}">
          <span>${combat.status === 'victory' ? '破关' : '惜败'}</span>
          <strong>${combat.status === 'victory' ? '此役功成，江湖声名更进一步' : `破局建议：${trait.counterHint}`}</strong>
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

const renderRegionCard = (regionId: RegionId, index: number): string => {
  const region = regionById(regionId)!
  const unlocked = isRegionUnlocked(state, region.id)
  const selected = state.selectedRegionId === region.id
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
      <button class="${selected ? 'secondary-button' : 'primary-button'} full" data-action="select-region" data-region-id="${region.id}" ${selected || !unlocked ? 'disabled' : ''}>
        ${selected ? '正在此地历练' : unlocked ? `前往${region.name}` : `击败${requiredRegion?.boss.name ?? '前一区域 BOSS'}后解锁`}
      </button>
    </article>`
}

const renderIdle = (): string => {
  const region = getSelectedRegion(state)
  const rates = getIdleRewardRates(state)
  return `
    <div class="page-heading">
      <div><span class="eyebrow">Jianghu Journey</span><h1>${region.name}</h1><p>${region.description}</p></div>
      <div class="location-status"><i></i><span>队伍正在历练<strong>${region.rewardText}</strong></span></div>
    </div>
    <div class="idle-layout">
      <div class="main-column">
        ${state.combat.mode === 'idle' ? renderCombatArena() : `
          <section class="challenge-away panel">
            <span class="seal-icon">战</span>
            <div><strong>队伍正在闯关</strong><p>前往「战斗」查看本场挑战。</p></div>
            <button class="secondary-button" data-tab="battle">查看战况</button>
          </section>`}
        <section class="region-map panel">
          <div class="section-title"><span>江湖行图</span><small>击败区域 BOSS 后解锁下一处历练地</small></div>
          <div class="region-grid">${REGIONS.map((candidate, index) => renderRegionCard(candidate.id, index)).join('')}</div>
        </section>
        <section class="yield-panel panel">
          <div class="section-title"><span>${region.name}收益</span><small>在线与离线均按本区域倍率结算 · 离线最多 12 小时</small></div>
          <div class="yield-grid">
            <div><small>每分钟银两</small><strong>+${formatNumber(rates.silver * 60)}</strong><span>${region.rewardMultipliers.silver}× 区域倍率</span></div>
            <div><small>每分钟阅历</small><strong>+${formatNumber(rates.experience * 60)}</strong><span>${region.rewardMultipliers.experience}× 区域倍率</span></div>
            <div><small>每小时残页</small><strong>+${formatNumber(rates.pages * 3600)}</strong><span>${region.rewardMultipliers.pages}× 区域倍率</span></div>
            <div><small>本地败敌</small><strong>${formatNumber(state.regionDefeats[region.id])}</strong><span>决定敌人历练强度</span></div>
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
      ${martial ? `<div class="skill-summary"><small>自动招式 · ${martial.skill.cooldown} 次行动冷却</small><strong>${martial.skill.name}</strong><p>${martial.skill.description}</p></div>` : ''}
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
          <div><strong>${martial.name}</strong><small>${martial.element}行 · ${martial.style}劲</small><p>${martial.description}</p><em>${martial.skill.name}：${martial.skill.description}</em></div>
          ${unlocked ? '<b class="learned">已参悟</b>' : `<button class="text-button" data-action="unlock-martial" data-martial-id="${martial.id}">${martial.unlockCost} 残页</button>`}
        </article>`
      }).join('')}
    </div>
  </section>
  <section class="hero-grid">${HEROES.map((hero) => renderHeroCard(hero.id)).join('')}</section>`

const renderParty = (): string => {
  const synergy = getPartySynergy(state)
  const activeBonds = getActiveBonds(state)
  const activeCombos = getActiveCombos(state)
  const formation = getFormationSummary(state)
  const unlocked = HEROES.filter((hero) => state.heroes[hero.id].unlocked)
  const challengeActive = state.combat.mode === 'challenge' && state.combat.status === 'fighting'
  const renderFormationRow = (row: FormationRow): string => {
    const rowSlots = state.formation
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.row === row)
    return `
      <section class="formation-editor-row ${row}" data-testid="formation-${row}-row">
        <div class="formation-row-heading">
          <span>${row === 'front' ? '前排' : '后排'}</span>
          <small>${row === 'front' ? '优先承伤 · 受到伤害 -20% · 造成伤害 -10%' : '受前排保护 · 造成伤害 +15%'}</small>
        </div>
        <div class="party-slots">
          ${rowSlots.map(({ slot, index }) => {
            const hero = heroById(slot.heroId)!
            const stats = getHeroStats(state, slot.heroId)
            const targetRow: FormationRow = row === 'front' ? 'back' : 'front'
            const lastInRow = rowSlots.length === 1
            return `<article class="party-slot row-${row}" data-slot="${index}">
              <span class="slot-index">第 ${index + 1} 位 · ${row === 'front' ? '前排' : '后排'}</span>
              <div class="portrait large element-${hero.element}">${hero.name.slice(-1)}</div>
              <strong>${hero.name}</strong><small>${hero.sect} · ${hero.epithet}</small>
              <div class="slot-power">攻 ${stats.attack} · 战力 ${stats.power}</div>
              <select data-action="party-slot" data-slot="${index}" ${challengeActive ? 'disabled' : ''} aria-label="第 ${index + 1} 位侠客">
                ${unlocked.map((candidate) => `<option value="${candidate.id}" ${candidate.id === hero.id ? 'selected' : ''}>${candidate.name} · ${candidate.sect}</option>`).join('')}
              </select>
              <button class="position-button secondary-button" data-action="set-row" data-slot="${index}" data-row="${targetRow}" ${challengeActive || lastInRow ? 'disabled' : ''}>
                ${challengeActive ? '交锋中不可换位' : lastInRow ? `需保留${row === 'front' ? '前排' : '后排'}` : `调至${targetRow === 'front' ? '前排' : '后排'}`}
              </button>
            </article>`
          }).join('')}
        </div>
      </section>`
  }
  return `
    <div class="page-heading compact-heading">
      <div><span class="eyebrow">Formation &amp; Bonds</span><h1>列阵与羁绊</h1><p>站位决定攻守，侠客关系提供被动增益，特定二人同队还会自动施展联手武学。</p></div>
      <div class="power-plaque"><small>当前队伍战力</small><strong>${formatNumber(getPartyPower(state))}</strong></div>
    </div>
    <section class="party-board panel">
      <div class="formation-editor">${renderFormationRow('back')}${renderFormationRow('front')}</div>
      <div class="synergy-line" aria-hidden="true"><i></i><span></span><i></i></div>
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
    <div class="page-heading compact-heading">
      <div><span class="eyebrow">Regional Boss</span><h1>${region.name}问鼎</h1><p>区域 BOSS 具有明确克制规则。读懂敌情、调整阵型或武学，比单纯堆战力更重要。</p></div>
      <div class="stage-plaque"><small>区域进度</small><strong>${state.defeatedBossIds.length}/${REGIONS.length}</strong><span>${defeated ? '此地已问鼎' : '首胜解锁后续区域'}</span></div>
    </div>
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
          <div class="skill-plan-grid">${state.formation.map(({ heroId }) => {
            const hero = heroById(heroId)
            const martial = martialById(state.heroes[heroId]?.equippedMartialId ?? '')
            return martial ? `<span><b>${hero?.name}</b><i>${martial.skill.name}</i><small>${martial.skill.description}</small></span>` : ''
          }).join('')}</div>
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

const renderOfflineModal = (): string => {
  if (!offlineSettlement) return ''
  const region = regionById(offlineSettlement.regionId) ?? REGIONS[0]
  return `
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="offline-title">
      <section class="offline-modal">
        <span class="modal-seal">归</span>
        <small>少侠归来</small><h2 id="offline-title">古道未曾停歇</h2>
        <p>离开江湖的 ${formatDuration(offlineSettlement.seconds)} 里，队伍仍在${region.name}自行历练${offlineSettlement.capped ? '（已按 12 小时上限结算）' : ''}。</p>
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
  <footer class="game-footer"><span>蛋蛋江湖 2.0 · 迭代 5</span><button class="text-button danger" data-action="reset">重开存档</button></footer>`

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
  const { action, heroId, martialId, regionId, row, slot } = button.dataset
  if (toastTimer) window.clearTimeout(toastTimer)

  switch (action) {
    case 'upgrade': notify(upgradeHero(state, heroId ?? '')); break
    case 'recruit': notify(recruitHero(state, heroId ?? '')); break
    case 'train': notify(trainMartial(state, heroId ?? '')); break
    case 'unlock-martial': notify(unlockMartial(state, martialId ?? '')); break
    case 'select-region': {
      if (!REGIONS.some((region) => region.id === regionId)) return
      notify(selectRegion(state, regionId as RegionId))
      break
    }
    case 'set-row': {
      if (row !== 'front' && row !== 'back') return
      notify(setFormationRow(state, Number(slot), row))
      break
    }
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
