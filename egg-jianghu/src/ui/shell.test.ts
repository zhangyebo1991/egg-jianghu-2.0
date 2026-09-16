import { describe, expect, it } from 'vitest'
import { renderShell } from './shell'

describe('应用 Shell', () => {
  it('显示水墨战场、顶部资源和完整功能入口，未开放秘境仍隐藏', () => {
    const html = renderShell({
      activeTab: 'idle',
      worldContext: null,
      hasCombatReturn: false,
      showResetConfirmation: false,
      content: '<p>内容</p>',
    })

    expect(html).toContain('class="app-shell ink-shell"')
    expect(html).toContain('aria-label="江湖资源"')
    expect(html).toContain('data-testid="tab-idle"')
    expect(html).toContain('data-testid="tab-heroes"')
    expect(html).toContain('data-testid="tab-formation"')
    expect(html).toContain('data-testid="tab-inventory"')
    expect(html).toContain('data-testid="tab-settings"')
    expect(html).not.toContain('data-testid="tab-progression"')
    expect(html).toContain('data-testid="tab-city"')
    for (const panel of ['quests', 'exchange', 'recruit']) expect(html).toContain(`data-faction-panel="${panel}"`)
    expect(html).not.toContain('data-action="request-reset-save"')
  })

  it('册内位面导航保留关卡、势力、城市和返回战斗入口', () => {
    const html = renderShell({
      activeTab: 'idle',
      worldContext: { worldName: '东汉三国', activeSection: 'factions' },
      hasCombatReturn: true,
      showResetConfirmation: false,
      content: '<p>内容</p>',
    })

    expect(html).toContain('data-action="return-worlds"')
    expect(html).toContain('data-action="resume-combat"')
    expect(html).toContain('data-jianghu-section="stages"')
    expect(html).toContain('data-jianghu-section="factions"')
    expect(html).not.toContain('data-jianghu-section="towns"')
    expect(html).toContain('data-jianghu-section="city"')
    expect(html).toMatch(/class="world-section active"[^>]*data-jianghu-section="factions"/)
  })

  it('收起册页后保留战场，解除其交互锁定', () => {
    const html = renderShell({
      activeTab: 'idle',
      worldContext: null,
      hasCombatReturn: false,
      showResetConfirmation: false,
      panelOpen: false,
      battlefield: '<p>真实战斗</p>',
      content: '<p>内容</p>',
    })

    expect(html).toContain('真实战斗')
    expect(html).toContain('data-testid="tab-formation"')
    expect(html).not.toContain('data-testid="ink-panel"')
    expect(html).not.toContain('inert')
    expect(html).not.toContain('<p>内容</p>')
  })

  it('设置页危险区显示删档重开入口', () => {
    const html = renderShell({
      activeTab: 'settings',
      worldContext: null,
      hasCombatReturn: false,
      showResetConfirmation: false,
      content: '<p>内容</p>',
    })

    expect(html).toContain('class="ink-danger-zone"')
    expect(html).toContain('data-action="request-reset-save"')
    expect(html).toContain('删档重开')
    expect(html).not.toContain('data-testid="reset-save-confirmation"')
  })

  it('请求删档后显示永久删除警告与取消确认操作', () => {
    const html = renderShell({
      activeTab: 'settings',
      worldContext: null,
      hasCombatReturn: false,
      showResetConfirmation: true,
      content: '<p>内容</p>',
    })

    expect(html).not.toContain('data-action="request-reset-save"')
    expect(html).toContain('data-testid="reset-save-confirmation"')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="reset-save-title"')
    expect(html).toMatch(/id="reset-save-title"[^>]*>确认删档？/)
    expect(html).toMatch(/data-action="cancel-reset-save"[^>]*autofocus/)
    expect(html).toContain('永久删除')
    expect(html).toContain('data-action="cancel-reset-save"')
    expect(html).toContain('data-action="confirm-reset-save"')
    expect(html).toContain('取消')
    expect(html).toContain('确认删档')
  })
})
