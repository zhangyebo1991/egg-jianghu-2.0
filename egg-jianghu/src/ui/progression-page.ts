import { escapeHtml, formatNumber } from './html'

export type ProgressionSection = 'dungeons' | 'beasts' | 'divine' | 'forge' | 'interworld'

export interface ProgressionPageViewModel {
  section: ProgressionSection
  resources: {
    worldTreeLeaves: number
    creationOrigin: number
    brokenDivinity: number
    starSoul: number
  }
  dungeons: Array<{
    id: number
    name: string
    worldName: string
    clears: number
    difficulty: number
    stageNames: readonly string[]
    rewards: Array<{ name: string; kind: string; quality: number; probability: string }>
  }>
  beasts: Array<{
    id: number
    name: string
    worldName: string
    highestClearedStage: number
    nextStage: null | {
      stage: number
      equipmentName: string
      battleDifficulty: number
      reincarnationCleared: boolean
      cleared: boolean
      claimed: boolean
    }
  }>
  recipes: Array<{
    recipeId: number
    equipmentName: string
    blueprintCount: number
    unlocked: boolean
  }>
  divine: {
    unlocked: boolean
    infiniteTowerFloor: number
    divineLadderFloor: number
    divineRankLevel: number
    shrines: Array<{
      shrineId: number
      deityId: number
      shrineName: string
      bossName: string
      skillName: string
      imperialWeaponName: string
      unlockDivineLevel: number
      phaseLabel: string
      progress: number
      subdued: boolean
      deityLevel: number | null
      upgradeCost: number | null
    }>
  }
  forge: {
    selectedUid: string | null
    equipment: Array<{
      uid: string
      name: string
      slotName: string
      selected: boolean
      sacredTargetName: string | null
    }>
    imperialTargets: Array<{
      shrineId: number
      shrineName: string
      weaponName: string
      unlocked: boolean
    }>
  }
  interworld: Array<{
    enemyId: number
    name: string
    rank: string
    enabled: boolean
    drops: Array<{ name: string; probability: string }>
  }>
}

const sections: Array<{ id: ProgressionSection; label: string; mark: string }> = [
  { id: 'dungeons', label: '大型副本', mark: '副' },
  { id: 'beasts', label: '镇界圣兽', mark: '兽' },
  { id: 'divine', label: '神界神位', mark: '神' },
  { id: 'forge', label: '帝兵圣具', mark: '铸' },
  { id: 'interworld', label: '异界', mark: '异' },
]

const renderResources = (view: ProgressionPageViewModel): string => `<div class="progression-resources" aria-label="高阶资源">
  <span><small>世界树叶</small><b>${formatNumber(view.resources.worldTreeLeaves)}</b></span>
  <span><small>创世本源</small><b>${formatNumber(view.resources.creationOrigin)}</b></span>
  <span><small>破碎神格</small><b>${formatNumber(view.resources.brokenDivinity)}</b></span>
  <span><small>星魂</small><b>${formatNumber(view.resources.starSoul)}</b></span>
</div>`

const renderDungeons = (view: ProgressionPageViewModel): string => `<section class="progression-panel" data-testid="progression-dungeons">
  <header><div><span class="progression-kicker">QUALITY 7 · ARTIFACT SOUL I</span><h2>大型副本</h2></div><p>四阶段挑战完成后，30 个原版候选按各自万分比独立判定。</p></header>
  <div class="progression-card-grid dungeon-grid">${view.dungeons.map((dungeon) => `<article class="progression-card dungeon-card">
    <div class="progression-card-head"><span class="progression-card-seal">副</span><div><h3>${escapeHtml(dungeon.name)}</h3><p>${escapeHtml(dungeon.worldName)} · ${dungeon.stageNames.map(escapeHtml).join(' → ')}</p></div><b>通关 ${dungeon.clears}</b></div>
    <div class="dungeon-reward-list">${dungeon.rewards.map((reward) => `<span data-kind="${escapeHtml(reward.kind)}"><b>${escapeHtml(reward.name)}</b><small>品质 ${reward.quality} · ${escapeHtml(reward.probability)}</small></span>`).join('')}</div>
    <button type="button" class="progression-primary" data-action="progression-complete-dungeon" data-dungeon-id="${dungeon.id}">结算难度 ${dungeon.difficulty} 四阶段挑战</button>
  </article>`).join('')}</div>
</section>`

const renderBeasts = (view: ProgressionPageViewModel): string => `<section class="progression-panel" data-testid="progression-beasts">
  <header><div><span class="progression-kicker">QUALITY 8 · ARTIFACT SOUL II</span><h2>镇界圣兽</h2></div><p>九阶段依次挑战；阶段奖励只可领取一次，图纸学习后永久解锁打造。</p></header>
  <div class="progression-card-grid beast-grid">${view.beasts.map((beast) => `<article class="progression-card beast-card">
    <div class="progression-card-head"><span class="progression-card-seal">兽</span><div><h3>${escapeHtml(beast.name)}</h3><p>${escapeHtml(beast.worldName)} · 已通关 ${beast.highestClearedStage}/9</p></div></div>
    ${beast.nextStage ? `<div class="beast-next-stage">
      <strong>第 ${beast.nextStage.stage} 阶 · ${escapeHtml(beast.nextStage.equipmentName)}</strong>
      <span>圣兽战斗难度 ${beast.nextStage.battleDifficulty}</span>
      <small>${escapeHtml(beast.worldName)} · 轮回难度${beast.nextStage.reincarnationCleared ? '已通关' : '未通关'}</small>
    </div>
    <div class="progression-action-row">
      <button type="button" data-action="progression-clear-beast" data-beast-id="${beast.id}" data-stage="${beast.nextStage.stage}" ${beast.nextStage.cleared ? 'disabled' : ''}>${beast.nextStage.cleared ? '已通关' : '挑战阶段'}</button>
      <button type="button" data-action="progression-claim-beast" data-beast-id="${beast.id}" data-stage="${beast.nextStage.stage}" ${!beast.nextStage.cleared || beast.nextStage.claimed ? 'disabled' : ''}>${beast.nextStage.claimed ? '已领取' : '领取奖励'}</button>
    </div>` : '<div class="progression-complete-note">九阶段全部完成</div>'}
  </article>`).join('')}</div>
  <div class="progression-subpanel"><h3>图纸与圣具打造</h3><div class="recipe-list">${view.recipes.length ? view.recipes.map((recipe) => `<article>
    <div><strong>${escapeHtml(recipe.equipmentName)}</strong><span>${recipe.unlocked ? '配方已永久解锁' : `图纸 ${recipe.blueprintCount}`}</span></div>
    ${recipe.unlocked
      ? `<button type="button" data-action="progression-craft-sacred" data-recipe-id="${recipe.recipeId}">打造圣具</button>`
      : `<button type="button" data-action="progression-learn-recipe" data-recipe-id="${recipe.recipeId}" ${recipe.blueprintCount < 1 ? 'disabled' : ''}>学习配方</button>`}
  </article>`).join('') : '<p class="progression-empty">尚未取得圣具图纸。</p>'}</div></div>
</section>`

const renderDivine = (view: ProgressionPageViewModel): string => `<section class="progression-panel" data-testid="progression-divine">
  <header><div><span class="progression-kicker">DIVINE REALM · 28 SHRINES</span><h2>神界与神位</h2></div><p>幻塔达到 301 层后开放；神殿三阶段均需 5000 进度与 Boss 刷新结算。</p></header>
  <div class="divine-overview">
    <article><small>无尽幻塔</small><strong>${view.divine.infiniteTowerFloor} 层</strong><button type="button" data-action="progression-complete-tower">完成一层</button></article>
    <article class="${view.divine.unlocked ? '' : 'locked'}"><small>通神天梯</small><strong>${view.divine.divineLadderFloor} 层 · 神位 Lv.${view.divine.divineRankLevel}</strong><button type="button" data-action="progression-complete-ladder" ${view.divine.unlocked ? '' : 'disabled'}>完成一层</button></article>
  </div>
  ${view.divine.unlocked ? `<div class="progression-card-grid shrine-grid">${view.divine.shrines.map((shrine) => `<article class="progression-card shrine-card ${shrine.subdued ? 'subdued' : ''}">
    <div class="progression-card-head"><span class="progression-card-seal">神</span><div><h3>${escapeHtml(shrine.shrineName)}</h3><p>${escapeHtml(shrine.bossName)} · ${escapeHtml(shrine.phaseLabel)}</p></div><b>${shrine.deityLevel ? `神位 Lv.${shrine.deityLevel}` : `需 Lv.${shrine.unlockDivineLevel}`}</b></div>
    <div class="shrine-progress"><span><i style="width:${Math.max(0, Math.min(100, shrine.progress / 50))}%"></i></span><small>${shrine.subdued ? '完全臣服' : `${Math.max(0, shrine.progress)} / 5000`}</small></div>
    <p class="shrine-reward">神位技能：${escapeHtml(shrine.skillName)}<br>帝兵：${escapeHtml(shrine.imperialWeaponName)}</p>
    <div class="progression-action-row shrine-actions">
      ${shrine.subdued
        ? shrine.deityLevel
          ? `<button type="button" data-action="progression-upgrade-deity" data-deity-id="${shrine.deityId}" ${shrine.deityLevel >= 100 ? 'disabled' : ''}>晋级${shrine.upgradeCost ? ` · ${shrine.upgradeCost} 神格` : ''}</button>`
          : `<button type="button" data-action="progression-claim-deity" data-deity-id="${shrine.deityId}">夺取神位 · 10 神格</button>`
        : shrine.progress < 0
          ? `<button type="button" data-action="progression-settle-shrine" data-shrine-id="${shrine.shrineId}">刷新结算阶段</button>`
          : `<button type="button" data-action="progression-shrine-kill" data-shrine-id="${shrine.shrineId}" ${shrine.progress >= 5000 ? 'disabled' : ''}>记录普通敌人击杀</button><button type="button" data-action="progression-shrine-boss" data-shrine-id="${shrine.shrineId}" ${shrine.progress !== 5000 ? 'disabled' : ''}>结算阶段 Boss</button>`}
    </div>
  </article>`).join('')}</div>` : '<div class="progression-lock-note"><strong>神界尚未开启</strong><span>无尽幻塔必须严格超过 300 层。</span></div>'}
</section>`

const renderForge = (view: ProgressionPageViewModel): string => `<section class="progression-panel" data-testid="progression-forge">
  <header><div><span class="progression-kicker">QUALITY 9 · ARTIFACT SOUL III</span><h2>帝兵改造与圣具进阶</h2></div><p>选中任意品质 8 装备：可按臣服神殿改造成帝兵，或按固定映射进阶为三阶圣具。</p></header>
  <div class="forge-layout">
    <div class="progression-subpanel"><h3>品质 8 装备</h3><div class="forge-equipment-list">${view.forge.equipment.length ? view.forge.equipment.map((item) => `<article class="${item.selected ? 'selected' : ''}">
      <button type="button" data-action="progression-select-forge" data-equipment-uid="${escapeHtml(item.uid)}"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.slotName)} · 品质 8</span></button>
      ${item.sacredTargetName ? `<button type="button" class="forge-advance" data-action="progression-advance-sacred" data-equipment-uid="${escapeHtml(item.uid)}">进阶为 ${escapeHtml(item.sacredTargetName)}</button>` : ''}
    </article>`).join('') : '<p class="progression-empty">背包与已装备物品中没有品质 8 装备。</p>'}</div></div>
    <div class="progression-subpanel"><h3>帝兵目标</h3><div class="imperial-target-list">${view.forge.imperialTargets.map((target) => `<article class="${target.unlocked ? '' : 'locked'}"><div><strong>${escapeHtml(target.weaponName)}</strong><span>${escapeHtml(target.shrineName)}</span></div><button type="button" data-action="progression-forge-imperial" data-shrine-id="${target.shrineId}" ${!target.unlocked || !view.forge.selectedUid ? 'disabled' : ''}>改造选中装备</button></article>`).join('')}</div></div>
  </div>
</section>`

const renderInterworld = (view: ProgressionPageViewModel): string => `<section class="progression-panel" data-testid="progression-interworld">
  <header><div><span class="progression-kicker">48 ENEMIES · 7 INDEPENDENT ROLLS</span><h2>异界掉落</h2></div><p>每名敌人的七个候选逐项独立判定；成功项固定获得 1 个。</p></header>
  <div class="progression-card-grid interworld-grid">${view.interworld.map((enemy) => `<article class="progression-card interworld-card">
    <div class="progression-card-head"><span class="progression-card-seal">异</span><div><h3>${escapeHtml(enemy.name)}</h3><p>${escapeHtml(enemy.rank)}</p></div></div>
    <div class="interworld-drops">${enemy.drops.map((drop) => `<span><b>${escapeHtml(drop.name)}</b><small>${escapeHtml(drop.probability)}</small></span>`).join('')}</div>
    <button type="button" class="progression-primary" data-action="progression-roll-interworld" data-enemy-id="${enemy.enemyId}" ${enemy.enabled ? '' : 'disabled'}>结算异界挑战</button>
  </article>`).join('')}</div>
</section>`

const renderSection = (view: ProgressionPageViewModel): string => {
  if (view.section === 'dungeons') return renderDungeons(view)
  if (view.section === 'beasts') return renderBeasts(view)
  if (view.section === 'divine') return renderDivine(view)
  if (view.section === 'forge') return renderForge(view)
  return renderInterworld(view)
}

export const renderProgressionPage = (view: ProgressionPageViewModel): string => `<section class="progression-page" data-testid="progression-page">
  <span class="progression-ghost" aria-hidden="true">界</span>
  <header class="progression-page-head"><div><p>诸天原版获取链 · 固定映射</p><h1>秘境与神界</h1><span>REALMS · TREASURES · ARTIFACT SOULS</span></div>${renderResources(view)}</header>
  <nav class="progression-tabs" aria-label="高阶玩法">${sections.map((section) => `<button type="button" class="${view.section === section.id ? 'active' : ''}" data-action="progression-section" data-section="${section.id}" aria-pressed="${view.section === section.id}"><span>${section.mark}</span><b>${section.label}</b></button>`).join('')}</nav>
  ${renderSection(view)}
  <footer class="progression-page-foot">蛋蛋江湖 2.0 · 原版高阶获取链 · 固定掉落 / 固定器魂 / 固定进阶</footer>
</section>`
