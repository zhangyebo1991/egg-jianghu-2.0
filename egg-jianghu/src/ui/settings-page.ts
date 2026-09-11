import { EQUIPMENT_QUALITY_NAMES } from '../content/equipment'
import type { GameStateV10 } from '../domain/types'

export const renderSettingsPage = (settings: GameStateV10['settings']): string => `
  <section class="settings-page" data-testid="settings-page">
    <header><h1>设置</h1><p>调整游戏偏好，修改后自动保存。</p></header>
    <div class="settings-layout">
      <nav aria-label="设置分类"><a href="#settings-loot" aria-current="page">战利品</a><button type="button" data-action="open-cloud-account">账号与云存档</button></nav>
      <section class="settings-group" id="settings-loot" aria-labelledby="settings-loot-title">
        <h2 id="settings-loot-title">战利品</h2>
        <div class="settings-field">
          <div><label for="auto-discard-quality">自动丢弃低品质装备</label>
            <p id="auto-discard-help">只处理设置生效后战斗掉落的装备。低于所选品质直接丢弃，同品质及以上保留；丢弃不获得铜钱或材料，已有装备不受影响。</p></div>
          <select id="auto-discard-quality" data-action="auto-discard-quality" aria-describedby="auto-discard-help">
            <option value="off" ${settings.autoDiscardBelowQuality === null ? 'selected' : ''}>关闭 · 全部保留</option>
            ${EQUIPMENT_QUALITY_NAMES.map((name, quality) => `<option value="${quality}" ${settings.autoDiscardBelowQuality === quality ? 'selected' : ''}>低于${name}</option>`).join('')}
          </select>
        </div>
        <p class="settings-status" role="status">${settings.autoDiscardBelowQuality === null || settings.autoDiscardBelowQuality === 0 ? '当前保留所有掉落装备' : `当前保留${EQUIPMENT_QUALITY_NAMES[settings.autoDiscardBelowQuality]}及以上品质装备`}</p>
      </section>
    </div>
  </section>`
