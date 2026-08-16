import { describe, expect, it } from 'vitest'
import { renderStartPage } from './start-page'

describe('标题与新建游戏页面', () => {
  it('没有存档时显示标题页，新建游戏可用而继续游戏禁用', () => {
    const html = renderStartPage({
      screen: 'title', hasSave: false, playerName: '', error: null, confirmOverwrite: false, busy: false,
    })

    expect(html).toContain('data-testid="title-page"')
    expect(html).toContain('data-action="new-game"')
    expect(html).toMatch(/data-action="continue-game"[^>]*disabled/)
    expect(html).toContain('蛋蛋江湖 2.0')
    expect(html).toContain('十三位面 · 择面穿越')
  })

  it('有存档时只在未忙碌状态允许继续游戏', () => {
    const ready = renderStartPage({
      screen: 'title', hasSave: true, playerName: '', error: null, confirmOverwrite: false, busy: false,
    })
    const busy = renderStartPage({
      screen: 'title', hasSave: true, playerName: '', error: null, confirmOverwrite: false, busy: true,
    })

    expect(ready).toMatch(/data-action="continue-game"(?![^>]*disabled)/)
    expect(busy).toMatch(/data-action="continue-game"[^>]*disabled/)
  })

  it('标题页安全展示旧档提示', () => {
    const html = renderStartPage({
      screen: 'title', hasSave: false, playerName: '', error: '<version 17 旧档>', confirmOverwrite: false, busy: false,
    })

    expect(html).toContain('role="alert"')
    expect(html).toContain('&lt;version 17 旧档&gt;')
    expect(html).not.toContain('<version 17 旧档>')
  })

  it('新建游戏表单安全展示输入和错误', () => {
    const html = renderStartPage({
      screen: 'new-game', hasSave: false, playerName: '<燕七>"', error: '<姓名无效>', confirmOverwrite: false, busy: false,
    })

    expect(html).toContain('data-testid="new-game-page"')
    expect(html).toMatch(/<form[^>]*data-action="create-game"/)
    expect(html).toContain('name="playerName"')
    expect(html).toContain('autocomplete="off"')
    expect(html).toContain('autofocus')
    expect(html).toContain('踏入江湖')
    expect(html).toContain('value="&lt;燕七&gt;&quot;"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('&lt;姓名无效&gt;')
    expect(html).not.toContain('<姓名无效>')
  })

  it('确认覆盖时仅显示覆盖确认操作', () => {
    const html = renderStartPage({
      screen: 'new-game', hasSave: true, playerName: '燕七', error: null, confirmOverwrite: true, busy: false,
    })

    expect(html).toContain('data-testid="overwrite-confirmation"')
    expect(html).toContain('data-action="cancel-overwrite"')
    expect(html).toContain('data-action="confirm-overwrite"')
    expect(html).toContain('现有进度将被永久覆盖')
    expect(html).toContain('此操作无法撤销。')
    expect(html).not.toContain('data-action="back-title"')
    expect(html).not.toContain('data-action="create-game"')
  })

  it('未确认覆盖时显示返回和提交操作', () => {
    const html = renderStartPage({
      screen: 'new-game', hasSave: true, playerName: '燕七', error: null, confirmOverwrite: false, busy: true,
    })

    expect(html).toContain('data-action="back-title"')
    expect(html).toContain('data-action="create-game"')
    expect(html).toMatch(/name="playerName"[^>]*disabled/)
    expect(html).toMatch(/type="submit"[^>]*disabled/)
  })
})
