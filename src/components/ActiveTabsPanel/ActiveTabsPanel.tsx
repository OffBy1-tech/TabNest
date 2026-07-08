import React from 'react'
import type { Workspace } from '../../lib/schema'
import { useActiveTabs } from './useActiveTabs'
import { WindowSection } from './WindowSection'

// ---------------------------------------------------------------------------
// ActiveTabsPanel
// ---------------------------------------------------------------------------

export interface ActiveTabsPanelProps {
  onSaveTab: (
    tab: chrome.tabs.Tab,
    groupName: string,
    categoryId: string,
    workspaceId: string,
    groupId: string | null,
  ) => void
  onSaveWindowTabs: (
    tabs: chrome.tabs.Tab[],
    groupName: string,
    categoryId: string,
    workspaceId: string,
    groupId: string | null,
  ) => void
  onCloseTab: (tabId: number) => void
  workspaces: Workspace[]
  showFavicons?: boolean
  activeWorkspaceId?: string | undefined
  activeCategoryId?: string | null
}

export function ActiveTabsPanel({
  onSaveTab,
  onSaveWindowTabs,
  onCloseTab,
  workspaces,
  showFavicons = true,
  activeWorkspaceId,
  activeCategoryId,
}: ActiveTabsPanelProps): React.JSX.Element {
  const windows = useActiveTabs()

  const totalTabs = windows.reduce((sum, win) => sum + win.tabs.length, 0)

  function handleCloseDuplicates(): void {
    const seen = new Set<string>()
    for (const win of windows) {
      for (const tab of win.tabs) {
        if (tab.id == null || !tab.url) continue
        if (seen.has(tab.url)) {
          onCloseTab(tab.id)
        } else {
          seen.add(tab.url)
        }
      }
    }
  }

  return (
    <aside
      role="complementary"
      aria-label="Active browser tabs"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: 'var(--space-4)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            flex: 1,
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Active Tabs
          <span
            aria-label={`${totalTabs} total tabs`}
            style={{
              marginLeft: 'var(--space-2)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-full)',
              padding: '1px 6px',
              fontWeight: 600,
            }}
          >
            {totalTabs}
          </span>
        </h2>

        <button
          type="button"
          aria-label="Close duplicate tabs"
          title="Close Duplicates"
          onClick={handleCloseDuplicates}
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-warning)',
            backgroundColor: 'transparent',
            border: '1px solid var(--color-warning)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px var(--space-2)',
            cursor: 'pointer',
            fontWeight: 500,
            outline: 'none',
          }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
            ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
          }}
        >
          Close Duplicates
        </button>
      </div>

      {/* Window sections */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {windows.length === 0 ? (
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              textAlign: 'center',
              marginTop: 'var(--space-8)',
            }}
          >
            No open browser windows detected.
          </p>
        ) : (
          windows.map((win, idx) => (
            <WindowSection
              key={win.windowId}
              tabs={win.tabs}
              windowId={win.windowId}
              windowIndex={idx}
              workspaces={workspaces}
              onSaveTab={onSaveTab}
              onSaveWindowTabs={onSaveWindowTabs}
              onCloseTab={onCloseTab}
              showFavicons={showFavicons}
              defaultWorkspaceId={activeWorkspaceId}
              defaultCategoryId={activeCategoryId ?? undefined}
            />
          ))
        )}
      </div>
    </aside>
  )
}
