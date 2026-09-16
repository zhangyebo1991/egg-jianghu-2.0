import { escapeHtml } from './html'
import { EQUIPMENT_QUALITY_NAMES } from '../content/equipment'
import type { GameStateV10 } from '../domain/types'

export const renderSettingsPage = (settings: GameStateV10['settings'], welfareInput = '', welfareClaimed = false): string => `
  <section class="settings-page" data-testid="settings-page">
    <header><h1>设置</h1><p>调整游戏偏好，修改后自动保存。</p></header>
    <div class="settings-layout">
      <nav aria-label="设置分类"><a href="#settings-loot">战利品</a><a href="#settings-welfare">福利码</a><button type="button" data-action="open-cloud-account">账号与云存档</button></nav>
      <div class="settings-groups"><section class="settings-group" id="settings-loot" aria-labelledby="settings-loot-title">
        <h2 id="settings-loot-title">战利品</h2>
        <div class="settings-field">
          <div><label for="auto-sell-quality">自动出售低品质装备</label>
            <p id="auto-sell-help">只处理设置生效后战斗掉落的装备。低于所选品质自动按当前世界售价折算铜钱，同品质及以上保留进背包；已有装备不受影响。</p></div>
          <select id="auto-sell-quality" data-action="auto-sell-quality" aria-describedby="auto-sell-help">
            <option value="off" ${settings.autoSellBelowQuality === null ? 'selected' : ''}>关闭 · 全部保留</option>
            ${EQUIPMENT_QUALITY_NAMES.map((name, quality) => `<option value="${quality}" ${settings.autoSellBelowQuality === quality ? 'selected' : ''}>低于${name}</option>`).join('')}
          </select>
        </div>
        <p class="settings-status" role="status">${settings.autoSellBelowQuality === null || settings.autoSellBelowQuality === 0 ? '当前保留所有掉落装备' : `当前保留${EQUIPMENT_QUALITY_NAMES[settings.autoSellBelowQuality]}及以上品质装备，低品质自动出售`}</p>
      </section>
      <section class="settings-group" id="settings-welfare" aria-labelledby="settings-welfare-title">
        <h2 id="settings-welfare-title">福利码</h2><p>输入福利码领取奖励，每个存档限领一次，领取记录随存档保存。</p>
        <form data-action="redeem-welfare-code" class="welfare-form">
          <label for="welfare-code">输入福利码</label>
          <div><input id="welfare-code" name="code" data-action="welfare-code-input" value="${escapeHtml(welfareInput)}" maxlength="64" autocomplete="off" placeholder="请输入福利码" required><button type="submit">领取福利</button></div>
        </form>
        ${welfareClaimed ? '<p class="welfare-claimed">赵云福利已领取</p>' : ''}
      </section></div>
    </div>
  </section>`
