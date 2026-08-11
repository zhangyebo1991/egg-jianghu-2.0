import { useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { padCount } from '../lib/status'

export type TabItem = {
  id: string
  label: string
  eyebrow?: string
  count?: number
  /** CSS 变量名，如 '--gold'。注入为 --tab-accent。 */
  accent?: string
}

type Props = {
  tabs: TabItem[]
  activeId: string
  onSelect: (id: string) => void
  /** tablist 的 aria-label。 */
  label: string
  /** 派生 tab 与 tabpanel id 的单一来源。 */
  panelId: string
  variant: 'subject' | 'section'
}

export function tabId(panelId: string, id: string) {
  return `${panelId}-tab-${id}`
}

export function tabPanelId(panelId: string, id: string) {
  return `${panelId}-panel-${id}`
}

export default function TabList({ tabs, activeId, onSelect, label, panelId, variant }: Props) {
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())

  const focusTab = (id: string) => {
    onSelect(id)
    const node = tabRefs.current.get(id)
    node?.focus()
    // 820px 以下 tablist 变横向滚动条，焦点项可能被裁出视口
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = (offset: number) => {
      event.preventDefault()
      focusTab(tabs[(index + offset + tabs.length) % tabs.length].id)
    }

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        step(1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        step(-1)
        break
      case 'Home':
        event.preventDefault()
        focusTab(tabs[0].id)
        break
      case 'End':
        event.preventDefault()
        focusTab(tabs[tabs.length - 1].id)
        break
    }
  }

  return (
    <div
      className={`tablist tablist-${variant}`}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId

        return (
          <button
            className={`tab ${isActive ? 'is-active' : ''}`}
            role="tab"
            type="button"
            key={tab.id}
            id={tabId(panelId, tab.id)}
            aria-selected={isActive}
            aria-controls={tabPanelId(panelId, tab.id)}
            tabIndex={isActive ? 0 : -1}
            ref={(node) => {
              if (node) {
                tabRefs.current.set(tab.id, node)
              } else {
                tabRefs.current.delete(tab.id)
              }
            }}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            style={tab.accent ? ({ '--tab-accent': `var(${tab.accent})` } as CSSProperties) : undefined}
          >
            {tab.eyebrow && <small className="tab-eyebrow">{tab.eyebrow}</small>}
            <span className="tab-label">{tab.label}</span>
            {tab.count !== undefined && <span className="tab-count">{padCount(tab.count)}</span>}
          </button>
        )
      })}
    </div>
  )
}
