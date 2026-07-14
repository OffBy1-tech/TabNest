/**
 * PopupApp.tsx
 * Full browser-action popup UI. 360px wide.
 * Lets the user save the current tab to a chosen workspace / category / group.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { FaviconImage } from '../components/GroupCard/FaviconImage'
import { tabTitleOrHostname } from '../lib/tabTitle'
import type {
  Category,
  TabGroup,
  Workspace,
} from '../lib/schema'
import { SyncDot, type SyncState } from './SyncDot'
import { SelectField } from './SelectField'
import {
  type RecentGroup,
  loadRecentGroups,
  saveRecentGroups,
  loadLastWorkspaceId,
  saveLastWorkspaceId,
  pushRecentGroup,
} from './popupStorage'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CurrentTab {
  id?: number | undefined
  title: string
  url: string
  favIconUrl?: string | undefined
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PopupApp(): React.JSX.Element {
  // IDs for accessibility
  const workspaceId = useId()
  const categoryId = useId()
  const groupId = useId()
  const newGroupId = useId()

  // State
  const [currentTab, setCurrentTab] = useState<CurrentTab | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [syncState, setSyncState] = useState<SyncState>('idle')

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('__new__')
  const [newGroupName, setNewGroupName] = useState<string>('')
  const [noteText, setNoteText] = useState<string>('')

  const [recentGroups, setRecentGroups] = useState<RecentGroup[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [loading, setLoading] = useState(true)
  const [cannotSave, setCannotSave] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---------------------------------------------------------------------------
  // Load data on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    async function init(): Promise<void> {
      // Get active tab
      let tab: CurrentTab = { title: 'Unknown', url: '' }
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        const first = tabs[0]
        if (first) {
          const url = first.url ?? ''
          const isPrivileged =
            !url ||
            url.startsWith('chrome://') ||
            url.startsWith('chrome-extension://') ||
            url.startsWith('about:') ||
            url.startsWith('edge://')
          if (isPrivileged) {
            if (!cancelled) setCannotSave(true)
          }
          tab = {
            id: first.id,
            title: first.title ?? 'Untitled',
            url,
            favIconUrl: first.favIconUrl,
          }
        }
      } catch {
        // Non-extension context
      }

      // Get storage data
      let loadedWorkspaces: Workspace[] = []
      let loadedSyncState: SyncState = 'idle'
      try {
        const result = await chrome.storage.local.get('tabnest_data')
        const data = result['tabnest_data'] as Record<string, unknown> | undefined
        if (data) {
          if (Array.isArray(data['workspaces'])) {
            loadedWorkspaces = data['workspaces'] as Workspace[]
          }
          const sm = data['sync_meta'] as Record<string, unknown> | undefined
          if (sm && typeof sm['sync_state'] === 'string') {
            loadedSyncState = sm['sync_state'] as SyncState
          }
        }
      } catch {
        // Non-extension context — use empty state
      }

      const recentGroups = await loadRecentGroups()
      const lastWsId = await loadLastWorkspaceId()

      if (cancelled) return

      setCurrentTab(tab)
      setWorkspaces(loadedWorkspaces)
      setSyncState(loadedSyncState)
      setRecentGroups(recentGroups)

      // Restore last-used group if it still exists
      const lastGroup = recentGroups[0]
      if (lastGroup) {
        const ws = loadedWorkspaces.find((w) => w.id === lastGroup.workspaceId)
        const cat = ws?.categories.find((c) => c.id === lastGroup.categoryId)
        const grp = cat?.groups.find((g) => g.id === lastGroup.groupId)
        if (ws && cat && grp) {
          setSelectedWorkspaceId(ws.id)
          setSelectedCategoryId(cat.id)
          setSelectedGroupId(grp.id)
          setLoading(false)
          return
        }
      }

      // Fall back: last-used workspace, first category, new group
      const defaultWs =
        (lastWsId && loadedWorkspaces.find((w) => w.id === lastWsId)) ||
        loadedWorkspaces[0]

      if (defaultWs) {
        setSelectedWorkspaceId(defaultWs.id)
        const firstCat = defaultWs.categories[0]
        if (firstCat) {
          setSelectedCategoryId(firstCat.id)
          setSelectedGroupId('__new__')
        }
      }

      setLoading(false)
    }

    void init()
    return () => { cancelled = true }
  }, [])

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId)
  const categories: Category[] = useMemo(
    () => selectedWorkspace?.categories ?? [],
    [selectedWorkspace?.categories],
  )
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)
  const groups: TabGroup[] = useMemo(
    () => selectedCategory?.groups ?? [],
    [selectedCategory?.groups],
  )

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleWorkspaceChange = useCallback(
    (id: string) => {
      setSelectedWorkspaceId(id)
      void saveLastWorkspaceId(id)
      const ws = workspaces.find((w) => w.id === id)
      const firstCat = ws?.categories[0]
      setSelectedCategoryId(firstCat?.id ?? '')
      setSelectedGroupId('__new__')
      setNewGroupName('')
    },
    [workspaces],
  )

  const handleCategoryChange = useCallback((id: string) => {
    setSelectedCategoryId(id)
    setSelectedGroupId('__new__')
    setNewGroupName('')
  }, [])

  const handleGroupChange = useCallback((id: string) => {
    setSelectedGroupId(id)
    setNewGroupName('')
  }, [])

  const doSave = useCallback(
    async (
      opts: { groupId: string; groupName: string; categoryId: string; workspaceId: string } | null = null,
    ) => {
      if (!currentTab?.url || saveState === 'saving') return

      const target = opts ?? {
        groupId: selectedGroupId,
        groupName:
          selectedGroupId === '__new__'
            ? newGroupName.trim() || 'New Group'
            : groups.find((g) => g.id === selectedGroupId)?.name ?? 'Group',
        categoryId: selectedCategoryId,
        workspaceId: selectedWorkspaceId,
      }

      if (!target.categoryId || !target.workspaceId) return

      setSaveState('saving')
      setNoteText('')

      const savedTab = {
        id: crypto.randomUUID(),
        title: tabTitleOrHostname(currentTab.title, currentTab.url),
        url: currentTab.url,
        favicon: currentTab.favIconUrl,
        saved_at: Date.now(),
        // Spec §12: optional note attached to the saved tab
        note: noteText.trim() || undefined,
      }

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'SAVE_TABS',
          payload: {
            tabs: [savedTab],
            group_name: target.groupName,
            category_id: target.categoryId,
            workspace_id: target.workspaceId,
          },
        }) as { ok: boolean; error?: string }
        if (!response.ok) {
          throw new Error(response.error ?? 'Save failed')
        }
        setSaveState('saved')

        // Update recent groups
        const next: RecentGroup = {
          groupId: target.groupId === '__new__' ? crypto.randomUUID() : target.groupId,
          groupName: target.groupName,
          categoryId: target.categoryId,
          workspaceId: target.workspaceId,
        }
        const updatedRecent = pushRecentGroup(recentGroups, next)
        setRecentGroups(updatedRecent)
        await saveRecentGroups(updatedRecent)

        saveTimerRef.current = setTimeout(() => setSaveState('idle'), 1500)
      } catch {
        setSaveState('error')
        saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2500)
      }
    },
    [
      currentTab,
      saveState,
      selectedGroupId,
      newGroupName,
      groups,
      selectedCategoryId,
      selectedWorkspaceId,
      recentGroups,
      noteText,
    ],
  )

  const handleSaveAndClose = useCallback(async () => {
    await doSave()
    // Close the popup
    window.close()
  }, [doSave])

  // Spec §11.4/§12: Enter and Cmd/Ctrl+S save from anywhere in the popup
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void handleSaveAndClose()
        return
      }
      if (e.key === 'Enter') {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
        // Leave Enter alone on buttons (activates them) and selects (picks an option)
        if (tag === 'button' || tag === 'select') return
        e.preventDefault()
        void handleSaveAndClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSaveAndClose])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isSaving = saveState === 'saving'
  const isSaved = saveState === 'saved'

  return (
    <div
      style={{
        width: 360,
        minHeight: 480,
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            color: 'var(--color-brand-500)',
            letterSpacing: '-0.01em',
          }}
          aria-label="Tab Nest"
        >
          Tab Nest
        </span>
        <SyncDot state={syncState} />
      </header>

      {loading ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
          }}
          aria-live="polite"
          aria-busy="true"
        >
          Loading…
        </div>
      ) : cannotSave ? (
        <div
          role="status"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-6)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 'var(--text-2xl)' }} aria-hidden="true">🔒</span>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Tab Nest cannot save browser system pages.
            Navigate to a regular webpage to use Tab Nest.
          </p>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: 'var(--space-4)',
            gap: 'var(--space-4)',
          }}
        >
          {/* Current tab preview */}
          {currentTab && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
              }}
              aria-label="Current tab"
            >
              <div style={{ flexShrink: 0, paddingTop: 2 }}>
                <FaviconImage
                  url={currentTab.favIconUrl ?? ''}
                  title={currentTab.title}
                  pageUrl={currentTab.url}
                  size={18}
                />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: 1.4,
                  }}
                  title={currentTab.title}
                >
                  {currentTab.title}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 'var(--space-1)',
                  }}
                  title={currentTab.url}
                >
                  {currentTab.url}
                </div>
              </div>
            </div>
          )}

          {/* Destination picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {/* Workspace */}
            <SelectField
              id={workspaceId}
              label="Workspace"
              value={selectedWorkspaceId}
              onChange={handleWorkspaceChange}
            >
              {workspaces.length === 0 && (
                <option value="">No workspaces</option>
              )}
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </SelectField>

            {/* Category */}
            <SelectField
              id={categoryId}
              label="Category"
              value={selectedCategoryId}
              onChange={handleCategoryChange}
              disabled={categories.length === 0}
            >
              {categories.length === 0 && <option value="">No categories</option>}
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </SelectField>

            {/* Group */}
            <SelectField
              id={groupId}
              label="Group"
              value={selectedGroupId}
              onChange={handleGroupChange}
              disabled={!selectedCategoryId}
            >
              <option value="__new__">New group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </SelectField>

            {/* New group name input */}
            {selectedGroupId === '__new__' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <label
                  htmlFor={newGroupId}
                  style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Group name
                </label>
                <input
                  id={newGroupId}
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="My new group"
                  aria-label="New group name"
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-sans)',
                    width: '100%',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-focus)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
                />
              </div>
            )}
            {/* Note field (spec §12): optional note attached to the saved tab */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <label
                htmlFor="popup-note"
                style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Note (optional)
              </label>
              <input
                id="popup-note"
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note to this tab…"
                aria-label="Note for the saved tab"
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-sans)',
                  width: '100%',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-focus)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
              />
            </div>
          </div>

          {/* Recent groups */}
          {recentGroups.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                Recent
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }} role="group" aria-label="Recently used groups">
                {recentGroups.map((rg) => (
                  <button
                    key={`${rg.groupId}-${rg.categoryId}`}
                    onClick={() => void doSave({
                      groupId: rg.groupId,
                      groupName: rg.groupName,
                      categoryId: rg.categoryId,
                      workspaceId: rg.workspaceId,
                    })}
                    aria-label={`Save to recent group: ${rg.groupName}`}
                    disabled={isSaving || isSaved}
                    style={{
                      padding: 'var(--space-1) var(--space-3)',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-secondary)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 500,
                      cursor: isSaving || isSaved ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-sans)',
                      maxWidth: 120,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {rg.groupName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Save button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <button
              onClick={() => void doSave()}
              disabled={isSaving || isSaved || !currentTab?.url || !selectedWorkspaceId || !selectedCategoryId}
              aria-label={isSaved ? 'Tab saved!' : isSaving ? 'Saving…' : 'Save tab'}
              aria-live="polite"
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: isSaved
                  ? 'var(--color-success)'
                  : 'var(--color-brand-500)',
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                cursor:
                  isSaving || isSaved || !currentTab?.url || !selectedWorkspaceId || !selectedCategoryId
                    ? 'not-allowed'
                    : 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: `background-color var(--duration-base) var(--ease-default)`,
                opacity:
                  !currentTab?.url || !selectedWorkspaceId || !selectedCategoryId
                    ? 0.6
                    : 1,
              }}
            >
              {isSaved ? '✓ Saved!' : isSaving ? 'Saving…' : 'Save Tab'}
            </button>

            <button
              onClick={() => void handleSaveAndClose()}
              disabled={isSaving || !currentTab?.url || !selectedWorkspaceId || !selectedCategoryId}
              aria-label="Save tab and close popup"
              style={{
                background: 'none',
                border: 'none',
                cursor:
                  isSaving || !currentTab?.url || !selectedWorkspaceId || !selectedCategoryId
                    ? 'not-allowed'
                    : 'pointer',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-sans)',
                textDecoration: 'underline',
                textAlign: 'center',
                opacity:
                  !currentTab?.url || !selectedWorkspaceId || !selectedCategoryId ? 0.5 : 1,
              }}
            >
              Save &amp; Close
            </button>
          </div>

          {/* View tabNest link */}
          <button
            onClick={() => {
              try {
                void chrome.tabs.create({ url: 'newtab.html' })
              } catch {
                // Non-extension context
              }
            }}
            aria-label="Open Tab Nest new tab page"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-brand-500)',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-sans)',
              textAlign: 'center',
              textDecoration: 'underline',
            }}
          >
            View Tab Nest
          </button>
        </div>
      )}
    </div>
  )
}
