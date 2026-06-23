import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ChevronDown, ChevronUp, BookmarkPlus, GripVertical, X } from 'lucide-react'
import { FaviconImage } from '../GroupCard/FaviconImage'
import type { Workspace } from '../../lib/schema'

// ---------------------------------------------------------------------------
// useActiveTabs hook
// ---------------------------------------------------------------------------

interface WindowWithTabs {
  windowId: number
  tabs: chrome.tabs.Tab[]
}

function useActiveTabs(): WindowWithTabs[] {
  const [windows, setWindows] = useState<WindowWithTabs[]>([])
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback((): void => {
    try {
      chrome.windows.getAll({ populate: true }, (chromeWindows) => {
        const grouped: WindowWithTabs[] = chromeWindows
          .filter((w) => (w.tabs?.length ?? 0) > 0)
          .map((w) => ({ windowId: w.id ?? 0, tabs: w.tabs ?? [] }))
        setWindows(grouped)
      })
    } catch {
      // Non-extension context — leave windows empty
    }
  }, [])

  const scheduleRefresh = useCallback((): void => {
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => {
      refresh()
      debounceTimer.current = null
    }, 300)
  }, [refresh])

  useEffect(() => {
    refresh()

    let listeners: (() => void) | null = null

    try {
      function onCreated(): void {
        scheduleRefresh()
      }
      function onRemoved(): void {
        scheduleRefresh()
      }
      function onUpdated(): void {
        scheduleRefresh()
      }

      function onMoved(): void {
        scheduleRefresh()
      }

      chrome.tabs.onCreated.addListener(onCreated)
      chrome.tabs.onRemoved.addListener(onRemoved)
      chrome.tabs.onUpdated.addListener(onUpdated)
      chrome.tabs.onMoved.addListener(onMoved)

      listeners = () => {
        chrome.tabs.onCreated.removeListener(onCreated)
        chrome.tabs.onRemoved.removeListener(onRemoved)
        chrome.tabs.onUpdated.removeListener(onUpdated)
        chrome.tabs.onMoved.removeListener(onMoved)
      }
    } catch {
      // Non-extension context
    }

    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current)
      }
      listeners?.()
    }
  }, [refresh, scheduleRefresh])

  return windows
}

// ---------------------------------------------------------------------------
// SavePopover
// ---------------------------------------------------------------------------

interface SavePopoverProps {
  tab: chrome.tabs.Tab
  workspaces: Workspace[]
  onSave: (tab: chrome.tabs.Tab, groupName: string, categoryId: string, workspaceId: string, groupId: string | null) => void
  onClose: () => void
  defaultWorkspaceId?: string
  defaultCategoryId?: string
}

function SavePopover({
  tab,
  workspaces,
  onSave,
  onClose,
  defaultWorkspaceId,
  defaultCategoryId,
}: SavePopoverProps): React.JSX.Element {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(
    defaultWorkspaceId ?? workspaces[0]?.id ?? '',
  )
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(defaultCategoryId ?? '')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [newGroupName, setNewGroupName] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  const isDuplicate = useMemo(() => {
    if (!tab.url) return false
    return workspaces.some((ws) =>
      ws.categories.some((cat) =>
        cat.groups.some((grp) => grp.tabs.some((t) => t.url === tab.url))
      )
    )
  }, [workspaces, tab.url])

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId)
  const categories = selectedWorkspace?.categories ?? []

  useEffect(() => {
    const ids = categories.map((c) => c.id)
    if (!ids.includes(selectedCategoryId)) {
      setSelectedCategoryId(categories[0]?.id ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceId, categories.length])

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)
  const groups = selectedCategory?.groups ?? []

  useEffect(() => {
    if (groups.length > 0) {
      setSelectedGroupId(groups[0].id)
    } else {
      setSelectedGroupId('__new__')
    }
  }, [selectedCategoryId])  // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  function handleSave(): void {
    if (!selectedCategoryId || !selectedWorkspaceId) return

    if (selectedGroupId === '__new__') {
      const groupName = newGroupName.trim() || tab.title || 'Untitled Group'
      onSave(tab, groupName, selectedCategoryId, selectedWorkspaceId, null)
    } else {
      const groupName = groups.find((g) => g.id === selectedGroupId)?.name ?? 'Untitled Group'
      onSave(tab, groupName, selectedCategoryId, selectedWorkspaceId, selectedGroupId)
    }
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    marginBottom: 'var(--space-1)',
    fontWeight: 600,
  }

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        right: 0,
        top: '100%',
        zIndex: 100,
        marginTop: 'var(--space-1)',
        width: 240,
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 'var(--space-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      {isDuplicate && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-warning-50, #fffbeb)',
            border: '1px solid var(--color-warning-200, #fde68a)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-warning-700, #92400e)',
          }}
        >
          <span aria-hidden="true">⚠</span>
          Already saved
        </div>
      )}
      <div>
        <label style={labelStyle} htmlFor={`popover-workspace-${tab.id}`}>
          Workspace
        </label>
        <select
          id={`popover-workspace-${tab.id}`}
          value={selectedWorkspaceId}
          onChange={(e) => setSelectedWorkspaceId(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLSelectElement).style.borderColor = 'var(--border-focus)'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLSelectElement).style.borderColor = 'var(--border-default)'
          }}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle} htmlFor={`popover-category-${tab.id}`}>
          Category
        </label>
        <select
          id={`popover-category-${tab.id}`}
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLSelectElement).style.borderColor = 'var(--border-focus)'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLSelectElement).style.borderColor = 'var(--border-default)'
          }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle} htmlFor={`popover-group-${tab.id}`}>
          Group
        </label>
        <select
          id={`popover-group-${tab.id}`}
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLSelectElement).style.borderColor = 'var(--border-focus)'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLSelectElement).style.borderColor = 'var(--border-default)'
          }}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          <option value="__new__">+ New group...</option>
        </select>
      </div>

      {selectedGroupId === '__new__' && (
        <div>
          <label style={labelStyle} htmlFor={`popover-newgroup-${tab.id}`}>
            New group name
          </label>
          <input
            id={`popover-newgroup-${tab.id}`}
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder={tab.title ?? 'Group name'}
            style={inputStyle}
            onFocus={(e) => {
              ;(e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-focus)'
            }}
            onBlur={(e) => {
              ;(e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-default)'
            }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        aria-label="Save tab"
        style={{
          padding: 'var(--space-2)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-brand-500)',
          color: 'var(--text-inverse)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          cursor: 'pointer',
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
        Save
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WindowSavePopover — save all tabs in a window into one group
// ---------------------------------------------------------------------------

interface WindowSavePopoverProps {
  tabCount: number
  workspaces: Workspace[]
  onSave: (groupName: string, categoryId: string, workspaceId: string, groupId: string | null) => void
  onClose: () => void
  defaultWorkspaceId?: string
  defaultCategoryId?: string
}

function WindowSavePopover({
  tabCount,
  workspaces,
  onSave,
  onClose,
  defaultWorkspaceId,
  defaultCategoryId,
}: WindowSavePopoverProps): React.JSX.Element {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(
    defaultWorkspaceId ?? workspaces[0]?.id ?? '',
  )
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(defaultCategoryId ?? '')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [newGroupName, setNewGroupName] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId)
  const categories = selectedWorkspace?.categories ?? []

  useEffect(() => {
    const ids = categories.map((c) => c.id)
    if (!ids.includes(selectedCategoryId)) {
      setSelectedCategoryId(categories[0]?.id ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceId, categories.length])

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)
  const groups = selectedCategory?.groups ?? []

  useEffect(() => {
    setSelectedGroupId(groups[0]?.id ?? '__new__')
  }, [selectedCategoryId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose()
    }
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  function handleSave(): void {
    if (!selectedCategoryId || !selectedWorkspaceId) return
    if (selectedGroupId === '__new__') {
      onSave(newGroupName.trim() || `Window tabs`, selectedCategoryId, selectedWorkspaceId, null)
    } else {
      const name = groups.find((g) => g.id === selectedGroupId)?.name ?? 'Window tabs'
      onSave(name, selectedCategoryId, selectedWorkspaceId, selectedGroupId)
    }
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    marginBottom: 'var(--space-1)',
    fontWeight: 600,
  }

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        right: 0,
        top: '100%',
        zIndex: 100,
        marginTop: 'var(--space-1)',
        width: 240,
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 'var(--space-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        Saving <strong style={{ color: 'var(--text-primary)' }}>{tabCount}</strong> tabs into one group
      </p>

      <div>
        <label style={labelStyle}>Workspace</label>
        <select value={selectedWorkspaceId} onChange={(e) => setSelectedWorkspaceId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Category</label>
        <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Group</label>
        <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          <option value="__new__">+ New group...</option>
        </select>
      </div>

      {selectedGroupId === '__new__' && (
        <div>
          <label style={labelStyle}>New group name</label>
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            placeholder="Window tabs"
            style={inputStyle}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        style={{
          padding: 'var(--space-2)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-brand-500)',
          color: 'var(--text-inverse)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Save {tabCount} tabs
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WindowSection
// ---------------------------------------------------------------------------

const ACTIVE_TAB_DRAG_TYPE = 'application/x-tabnest-active-tab'

interface ActiveTabDragPayload {
  tabId: number
  windowId: number
}

interface WindowSectionProps {
  tabs: chrome.tabs.Tab[]
  windowId: number
  windowIndex: number
  workspaces: Workspace[]
  onSaveTab: (tab: chrome.tabs.Tab, groupName: string, categoryId: string, workspaceId: string, groupId: string | null) => void
  onSaveWindowTabs: (tabs: chrome.tabs.Tab[], groupName: string, categoryId: string, workspaceId: string, groupId: string | null) => void
  onCloseTab: (tabId: number) => void
  showFavicons?: boolean
  defaultWorkspaceId?: string
  defaultCategoryId?: string
}

function WindowSection({
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

  function handleTabDragStart(e: React.DragEvent, tabId: number): void {
    const payload: ActiveTabDragPayload = { tabId, windowId }
    e.dataTransfer.setData(ACTIVE_TAB_DRAG_TYPE, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
    setDraggedTabId(tabId)
  }

  function handleTabDragOver(e: React.DragEvent, idx: number): void {
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
                onDragStart={(e) => handleTabDragStart(e, tabId)}
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

// ---------------------------------------------------------------------------
// ActiveTabsPanel
// ---------------------------------------------------------------------------

interface ActiveTabsPanelProps {
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
