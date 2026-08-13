import { escapeHtml } from './html'

export interface StartPageViewModel {
  screen: 'title' | 'new-game'
  hasSave: boolean
  playerName: string
  error: string | null
  confirmOverwrite: boolean
  busy: boolean
}

const disabled = (value: boolean): string => value ? ' disabled' : ''

const renderTitlePage = (view: StartPageViewModel): string => `
  <main class="start-page" data-testid="title-page">
    <section class="start-hero" aria-labelledby="game-title">
      <p class="start-kicker"><span>江湖卷首</span></p>
      <div class="start-title-wrap">
        <h1 id="game-title">蛋蛋江湖 2.0</h1>
        <span class="start-seal" aria-hidden="true">蛋</span>
      </div>
      <span class="start-tagline">十三位面 · 择面穿越</span>
      <div class="start-divider" aria-hidden="true"></div>
      <div class="start-actions">
        <button type="button" class="primary" data-action="new-game"${disabled(view.busy)}>新建游戏</button>
        <button type="button" data-action="continue-game"${disabled(!view.hasSave || view.busy)}>继续游戏</button>
      </div>
    </section>
    <footer class="start-foot" aria-hidden="true">闭关挂机 · 亦可问鼎江湖</footer>
  </main>`

const renderOverwriteConfirmation = (view: StartPageViewModel): string => `
  <main class="start-page" data-testid="new-game-page">
    <section class="start-card panel danger-confirm" data-testid="overwrite-confirmation" aria-labelledby="overwrite-title">
      <span class="start-seal" aria-hidden="true">覆</span>
      <header class="start-heading">
        <p>覆写存档</p>
        <h1 id="overwrite-title">现有进度将被永久覆盖</h1>
        <span>此操作无法撤销。</span>
      </header>
      <div class="start-actions">
        <button type="button" data-action="cancel-overwrite"${disabled(view.busy)}>取消</button>
        <button type="button" class="danger" data-action="confirm-overwrite"${disabled(view.busy)}>确认覆盖并开始</button>
      </div>
    </section>
  </main>`

const renderNewGamePage = (view: StartPageViewModel): string => `
  <main class="start-page" data-testid="new-game-page">
    <section class="start-card panel" aria-labelledby="new-game-title">
      <span class="start-seal" aria-hidden="true">启</span>
      <header class="start-heading">
        <p>江湖卷首</p>
        <h1 id="new-game-title">新建游戏</h1>
      </header>
      <form class="start-form" data-action="create-game">
        <label for="player-name">玩家姓名</label>
        <input id="player-name" name="playerName" type="text" value="${escapeHtml(view.playerName)}" autocomplete="off" autofocus${disabled(view.busy)}>
        <p class="start-hint">1～8 个字符，初始身份为丙级剑客。</p>
        ${view.error ? `<p class="start-error" role="alert">${escapeHtml(view.error)}</p>` : ''}
        <div class="start-actions">
          <button type="button" data-action="back-title"${disabled(view.busy)}>返回</button>
          <button type="submit" class="primary"${disabled(view.busy)}>踏入江湖</button>
        </div>
      </form>
    </section>
  </main>`

export const renderStartPage = (view: StartPageViewModel): string => {
  if (view.screen === 'title') return renderTitlePage(view)
  return view.confirmOverwrite ? renderOverwriteConfirmation(view) : renderNewGamePage(view)
}
