import { describe, expect, it } from 'vitest'
import { renderShell } from './shell'

describe('应用 Shell', () => {
  it('仅显示三个全局入口且不显示顶部资源和自动存档', () => {
    const html = renderShell({
      activeTab: 'idle',
      worldContext: null,
      hasCombatReturn: false,
      content: '<p>内容</p>',
    })

    expect(html).toContain('class="game-sidebar"')
    expect(html).toContain('data-testid="tab-idle"')
    expect(html).toContain('data-testid="tab-heroes"')
    expect(html).toContain('data-testid="tab-inventory"')
    expect(html).not.toMatch(/tab-factions|tab-city|势力贡献|装备背包|自动存档|resource-strip/)
  })

  it('进入大关后在江湖下展开关卡势力城市', () => {
    const html = renderShell({
      activeTab: 'idle',
      worldContext: { worldName: '青石江湖', activeSection: 'factions' },
      hasCombatReturn: true,
      content: '<p>内容</p>',
    })

    expect(html).toContain('data-jianghu-section="stages"')
    expect(html).toContain('data-jianghu-section="factions"')
    expect(html).toContain('data-jianghu-section="city"')
    expect(html).toContain('data-action="return-worlds"')
    expect(html).toContain('data-action="resume-combat"')
  })
})
