import { describe, expect, it } from 'vitest'
import { renderShell } from './shell'

describe('应用 Shell', () => {
  it('仅显示三个全局入口且不显示顶部资源和自动存档', () => {
    const html = renderShell({
      activeTab: 'idle',
      worldContext: null,
      hasCombatReturn: false,
      showResetConfirmation: false,
      content: '<p>内容</p>',
    })

    expect(html).toContain('class="game-sidebar"')
    expect(html).toContain('data-testid="tab-idle"')
    expect(html).toContain('data-testid="tab-heroes"')
    expect(html).toContain('data-testid="tab-formation"')
    expect(html).not.toContain('data-testid="tab-inventory"')
    expect(html).toContain('class="nav-mark"')
    expect(html).toContain('class="sidebar-landscape"')
    expect(html).toContain('十万里一剑 · 不负侠者行')
    expect(html).not.toMatch(/tab-factions|tab-city|势力贡献|装备背包|自动存档|resource-strip/)
  })

  it('进入大关后在江湖下展开关卡势力城市', () => {
    const html = renderShell({
      activeTab: 'idle',
      worldContext: { worldName: '牛家村', activeSection: 'factions' },
      hasCombatReturn: true,
      showResetConfirmation: false,
      content: '<p>内容</p>',
    })

    expect(html).toContain('data-jianghu-section="stages"')
    expect(html).toContain('data-jianghu-section="factions"')
    expect(html).toContain('data-jianghu-section="city"')
    expect(html).toContain('data-action="return-worlds"')
    expect(html).toContain('data-action="resume-combat"')
  })

  it('江湖页面不额外创建第二套导航，统一复用阵容式左侧栏', () => {
    const html = renderShell({
      activeTab: 'idle',
      worldContext: null,
      hasCombatReturn: false,
      showResetConfirmation: false,
      jianghuChrome: true,
      content: '<p>内容</p>',
    })

    expect(html).toContain('class="app-shell jianghu-shell"')
    expect(html).toContain('data-testid="tab-formation"')
    expect(html).not.toContain('jianghu-mobile-topbar')
    expect(html).not.toContain('mobile-tab-')
  })

  it('默认在侧栏底部显示删档重开入口', () => {
    const html = renderShell({
      activeTab: 'idle',
      worldContext: null,
      hasCombatReturn: false,
      showResetConfirmation: false,
      content: '<p>内容</p>',
    })

    expect(html).toContain('class="sidebar-danger-zone"')
    expect(html).toContain('data-action="request-reset-save"')
    expect(html).toContain('删档重开')
    expect(html).not.toContain('data-testid="reset-save-confirmation"')
  })

  it('请求删档后显示永久删除警告与取消确认操作', () => {
    const html = renderShell({
      activeTab: 'idle',
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
