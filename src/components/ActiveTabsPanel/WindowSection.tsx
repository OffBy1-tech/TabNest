import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, BookmarkPlus, GripVertical, X } from 'lucide-react'
import { FaviconImage } from '../GroupCard/FaviconImage'
import type { Workspace } from '../../lib/schema'
import { SavePopover } from './SavePopover'
import { WindowSavePopover } from './WindowSavePopover'

// Re-exported from the shared drag contract so existing imports keep working.
export { ACTIVE_TAB_DRAG_TYPE, type ActiveTabDragPayload } from '../GroupCard/dragTypes'
import { ACTIVE_TAB_DRAG_TYPE, type ActiveTabDragPayload } from '../GroupCard/dragTypes'

export interface WindowSectionProps {
  tabs: chrome.tabs.Tab[]
  windowId: number
  windowIndex: number
  workspaces: Workspace[]
  onSaveTab: (tab: chrome.tabs.Tab, groupName: string, categoryId: string, workspaceId: string, groupId: string | null) => void
  onSaveWindowTabs: (tabs: chrome.tabs.Tab[], groupName: string, categoryId: string, workspaceId: string, groupId: string | null) => void
  onCloseTab: (tabId: number) => void
  showFavicons?: boolean
  defaultWorkspaceId?: string | undefined
  defaultCategoryId?: string | undefined
  /** Drag-to-reorder only makes sense in browser order — off while sorted. */
  allowReorder?: boolean
}

/** A collapsible section listing one browser window's tabs, with per-tab and
 *  whole-window save actions and intra-window drag reordering. */
export function WindowSection({
  tabs,
  windowId,
  windowIndex,
  workspaces,
  onSaveTab,
  onSaveWindowTabs,
  onCloseTab,
  showFavicons = true,
  defaultWorkspaceId,
  defaultCategoryId,
  allowReorder = true,
}: WindowSectionProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [savePopoverTabId, setSavePopoverTabId] = useState<number | null>(null)

  const savedUrls = useMemo(() => {
    const urls = new Set<string>()
    for (const ws of workspaces) {
      for (const cat of ws.categories) {
        for (const grp of cat.groups) {
          for (const t of grp.tabs) {
            if (t.url) urls.add(t.url)
          }
        }
      }
    }
    return urls
  }, [workspaces])
  const [saveAllOpen, setSaveAllOpen] = useState(false)
  const [draggedTabId, setDraggedTabId] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  // Multi-select for bulk save (spec §4.2)
  const [selectedTabIds, setSelectedTabIds] = useState<ReadonlySet<number>>(new Set())
  const [saveSelectedOpen, setSaveSelectedOpen] = useState(false)

  const selectedTabs = tabs.filter((t) => t.id != null && selectedTabIds.has(t.id))

  function toggleSelected(tabId: number): void {
    setSelectedTabIds((prev) => {
      const next = new Set(prev)
      if (next.has(tabId)) next.delete(tabId)
      else next.add(tabId)
      return next
    })
  }

  function handleTabDragStart(e: React.DragEvent, tab: chrome.tabs.Tab): void {
    if (tab.id == null) return
    // url/title/favicon ride along so drops outside the panel (group cards,
    // sidebar categories) can save the tab without a tabs API lookup.
    const payload: ActiveTabDragPayload = {
      tabId: tab.id,
      windowId,
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
    }
    e.dataTransfer.setData(ACTIVE_TAB_DRAG_TYPE, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
    setDraggedTabId(tab.id)
  }

  function handleTabDragOver(e: React.DragEvent, idx: number): void {
    if (!allowReorder) return
    if (!e.dataTransfer.types.includes(ACTIVE_TAB_DRAG_TYPE)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDropIndex(e.clientY < rect.top + rect.height / 2 ? idx : idx + 1)
  }

  function handleTabDrop(e: React.DragEvent): void {
    e.preventDefault()
    const raw = e.dataTransfer.getData(ACTIVE_TAB_DRAG_TYPE)
    if (!raw || dropIndex === null) { clearDrag(); return }
    try {
      const { tabId, windowId: srcWindowId } = JSON.parse(raw) as ActiveTabDragPayload
      if (srcWindowId !== windowId) { clearDrag(); return }
      const fromIdx = tabs.findIndex((t) => t.id === tabId)
      if (fromIdx === -1) { clearDrag(); return }
      const insertAt = dropIndex > fromIdx ? dropIndex - 1 : dropIndex
      if (insertAt === fromIdx) { clearDrag(); return }
      try {
        chrome.tabs.move(tabId, { index: insertAt })
      } catch {
        // Non-extension context
      }
    } catch {
      // Malformed payload
    }
    clearDrag()
  }

  function clearDrag(): void {
    setDraggedTabId(null)
    setDropIndex(null)
  }

  function showIndicatorAt(idx: number): boolean {
    if (draggedTabId === null || dropIndex !== idx) return false
    const fromIdx = tabs.findIndex((t) => t.id === draggedTabId)
    return idx !== fromIdx && idx !== fromIdx + 1
  }

  return (
    <div
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'visible',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      {/* Window header */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        aria-label={`Window ${windowIndex + 1}, ${tabs.length} tabs. ${collapsed ? 'Expand' : 'Collapse'}`}
        onClick={() => setCollapsed((prev) => !prev)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCollapsed((prev) => !prev) }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: collapsed ? 'none' : '1px solid var(--border-default)',
          borderRadius: collapsed ? 'var(--radius-md)' : 'var(--radius-md) var(--radius-md) 0 0',
          backgroundColor: 'var(--bg-elevated)',
          cursor: 'pointer',
          userSelect: 'none',
          position: 'relative',
        }}
      >
        {collapsed ? (
          <ChevronDown size={14} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
        ) : (
          <ChevronUp size={14} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
        )}

        <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Window {windowIndex + 1}
        </span>

        {/* Tab count badge */}
        <span
          aria-label={`${tabs.length} tabs`}
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-full)',
            padding: '1px 6px',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {tabs.length}
        </span>

        {/* Save Selected button — appears once any tab is checked */}
        {selectedTabs.length > 0 && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              aria-label={`Save ${selectedTabs.length} selected tabs to a group`}
              aria-expanded={saveSelectedOpen}
              onClick={(e) => {
                e.stopPropagation()
                setSaveSelectedOpen((prev) => !prev)
              }}
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-inverse)',
                backgroundColor: 'var(--color-brand-500)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '2px var(--space-2)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Save {selectedTabs.length}
            </button>

            {saveSelectedOpen && (
              <WindowSavePopover
                tabCount={selectedTabs.length}
                workspaces={workspaces}
                onSave={(groupName, categoryId, workspaceId, groupId) => {
                  onSaveWindowTabs(selectedTabs, groupName, categoryId, workspaceId, groupId)
                  setSelectedTabIds(new Set())
                }}
                onClose={() => setSaveSelectedOpen(false)}
                defaultWorkspaceId={defaultWorkspaceId}
                defaultCategoryId={defaultCategoryId}
              />
            )}
          </div>
        )}

        {/* Save All icon button */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            aria-label="Save all tabs in this window to a group"
            title="Save all tabs to a group"
            aria-expanded={saveAllOpen}
            onClick={(e) => {
              e.stopPropagation()
              setSaveAllOpen((prev) => !prev)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--color-brand-500)',
              cursor: 'pointer',
              padding: 'var(--space-1)',
              borderRadius: 'var(--radius-sm)',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-brand-100)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            }}
            onFocus={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
              ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
            }}
          >
            <BookmarkPlus size={14} aria-hidden="true" />
          </button>

          {saveAllOpen && (
            <WindowSavePopover
              tabCount={tabs.length}
              workspaces={workspaces}
              onSave={(groupName, categoryId, workspaceId, groupId) => {
                onSaveWindowTabs(tabs, groupName, categoryId, workspaceId, groupId)
              }}
              onClose={() => setSaveAllOpen(false)}
              defaultWorkspaceId={defaultWorkspaceId}
              defaultCategoryId={defaultCategoryId}
            />
          )}
        </div>
      </div>

      {/* Tab list */}
      {!collapsed && (
        <div style={{ padding: 'var(--space-2)' }}>
          {tabs.map((tab, idx) => {
            if (tab.id == null) return null

            const tabId = tab.id
            const isDragged = draggedTabId === tabId
            const isActive = tab.active === true
            const isAlreadySaved = tab.url ? savedUrls.has(tab.url) : false
            let domain = ''
            try {
              if (tab.url) domain = new URL(tab.url).hostname.replace(/^www\./, '')
            } catch {
              domain = ''
            }

            return (
              <React.Fragment key={tabId}>
                {showIndicatorAt(idx) && (
                  <div
                    aria-hidden="true"
                    style={{
                      height: 2,
                      backgroundColor: 'var(--color-brand-500)',
                      borderRadius: 1,
                      margin: '1px var(--space-1)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              <div
                draggable
                onDragStart={(e) => handleTabDragStart(e, tab)}
                onDragOver={(e) => handleTabDragOver(e, idx)}
                onDrop={handleTabDrop}
                onDragEnd={clearDrag}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                  position: 'relative',
                  transition: 'background-color var(--duration-fast) var(--ease-default)',
                  opacity: isDragged ? 0.4 : 1,
                  cursor: 'grab',
                  borderLeft: isActive ? '2px solid var(--color-brand-500)' : '2px solid transparent',
                  paddingLeft: 'calc(var(--space-2) - 2px)',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-elevated)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex' }}
                >
                  <GripVertical size={12} />
                </span>
                <input
                  type="checkbox"
                  aria-label={`Select ${tab.title ?? 'tab'}`}
                  checked={selectedTabIds.has(tabId)}
                  onChange={() => toggleSelected(tabId)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ flexShrink: 0, cursor: 'pointer', margin: 0 }}
                />
                {showFavicons && (
                  <FaviconImage
                    url={tab.favIconUrl ?? ''}
                    title={tab.title ?? 'Tab'}
                    size={16}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: isActive ? 'var(--color-brand-600)' : 'var(--text-primary)',
                        fontWeight: isActive ? 600 : undefined,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                        flex: 1,
                      }}
                      title={tab.title}
                    >
                      {tab.title}
                    </div>
                    {isAlreadySaved && (
                      <span
                        aria-label="Already saved"
                        title="Already saved"
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                          backgroundColor: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-full)',
                          padding: '1px 5px',
                          flexShrink: 0,
                          lineHeight: 1.4,
                        }}
                      >
                        saved
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {domain}
                  </div>
                </div>

                {/* Save button + popover wrapper */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    type="button"
                    aria-label={`Save ${tab.title ?? 'tab'}`}
                    title="Save tab"
                    onClick={() =>
                      setSavePopoverTabId((prev) => (prev === tabId ? null : tabId))
                    }
                    aria-expanded={savePopoverTabId === tabId}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 'var(--space-1)',
                      borderRadius: 'var(--radius-sm)',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
                      ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-brand-500)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                      ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
                    }}
                    onFocus={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
                      ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
                    }}
                    onBlur={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
                    }}
                  >
                    <BookmarkPlus size={14} aria-hidden="true" />
                  </button>

                  {savePopoverTabId === tabId && (
                    <SavePopover
                      tab={tab}
                      workspaces={workspaces}
                      onSave={onSaveTab}
                      onClose={() => setSavePopoverTabId(null)}
                      defaultWorkspaceId={defaultWorkspaceId}
                      defaultCategoryId={defaultCategoryId}
                    />
                  )}
                </div>

                {/* Close tab button */}
                <button
                  type="button"
                  aria-label={`Close ${tab.title ?? 'tab'}`}
                  title="Close tab"
                  onClick={() => onCloseTab(tabId)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 'var(--space-1)',
                    borderRadius: 'var(--radius-sm)',
                    flexShrink: 0,
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-danger)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
                  }}
                  onFocus={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
                    ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
                  }}
                  onBlur={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              </React.Fragment>
            )
          })}
          {showIndicatorAt(tabs.length) && (
            <div
              aria-hidden="true"
              style={{
                height: 2,
                backgroundColor: 'var(--color-brand-500)',
                borderRadius: 1,
                margin: '1px var(--space-1)',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
