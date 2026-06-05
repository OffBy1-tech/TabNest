import React, { useCallback, useEffect, useRef, useState } from 'react'
import { TopBar } from '@/components/TopBar/TopBar'
import { CategoryList } from '@/components/Sidebar/CategoryList'
import { GroupCard } from '@/components/GroupCard/GroupCard'
import { SearchOverlay } from '@/components/Search/SearchOverlay'
import { ActiveTabsPanel } from '@/components/ActiveTabsPanel/ActiveTabsPanel'
import { SettingsModal } from '@/components/Settings/SettingsModal'
import { OnboardingOverlay } from '@/components/Onboarding/OnboardingOverlay'
import { useStorage } from '@/hooks/useStorage'
import { useTabs } from '@/hooks/useTabs'
import { useToast } from '@/components/Toast/ToastProvider'
import type { Category, TabGroup, UserSettings, Workspace } from '@/lib/schema'
import type { SearchRecord } from '@/lib/search'
import { DEFAULT_SETTINGS, DEFAULT_LOCAL_SETTINGS, DEFAULT_SYNC_META } from '@/lib/schema'
import { patchSettings, patchLocalSettings, restoreFromTrash, deleteFromTrash, emptyTrash, createWorkspace, renameWorkspace, createCategory, renameGroup, removeTabFromGroup, renameCategory, deleteCategory, setCategoryCollapsed, moveTabBetweenGroups, addTabToGroup, addTabsToGroup, reorderCategories, saveTabGroup, saveTabNote, saveGroupNote } from '@/lib/storage'

// ---------------------------------------------------------------------------
// Layout shell styles
// ---------------------------------------------------------------------------

const shellStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'var(--topbar-height) 1fr',
  gridTemplateColumns: 'var(--sidebar-width) 1fr',
  gridTemplateAreas: '"topbar topbar" "sidebar main"',
  height: '100vh',
  overflow: 'hidden',
  backgroundColor: 'var(--bg-base)',
}

const sidebarStyle: React.CSSProperties = {
  gridArea: 'sidebar',
  backgroundColor: 'var(--bg-surface)',
  borderRight: '1px solid var(--border-default)',
  overflowY: 'auto',
  padding: 'var(--space-4) var(--space-3)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
}

const mainStyle: React.CSSProperties = {
  gridArea: 'main',
  display: 'flex',
  overflow: 'hidden',
}

// ---------------------------------------------------------------------------
// Placeholder — shown when no data is loaded yet
// ---------------------------------------------------------------------------

function LoadingPlaceholder(): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: 'var(--text-sm)',
      }}
    >
      Loading…
    </div>
  )
}

// ---------------------------------------------------------------------------
// openTab helper — respects open_tab_behavior setting
// ---------------------------------------------------------------------------

function openTab(url: string, behavior: string | undefined): void {
  if (behavior === 'current') {
    window.location.href = url
  } else if (behavior === 'new_window') {
    window.open(url, '_blank', 'noopener,noreferrer,toolbar=0,location=0,menubar=0')
  } else {
    // 'new_tab' is the default
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

// ---------------------------------------------------------------------------
// GroupGrid — main content area
// ---------------------------------------------------------------------------

interface GroupGridProps {
  groups: TabGroup[]
  viewMode: 'grid' | 'list'
  onRenameGroup: (id: string, name: string) => void
  onDeleteGroup: (id: string) => void
  onOpenAll: (group: TabGroup) => void
  onRemoveTab: (groupId: string, tabId: string) => void
  onMoveTab: (fromGroupId: string, toGroupId: string, tabId: string) => void
  onOpenTab: (url: string) => void
  onSaveGroupNote: (groupId: string, content: string) => void
  onSaveTabNote: (groupId: string, tabId: string, note: string) => void
  showFavicons: boolean
  /** When defined, shows a New Group button. Pass undefined for the "All" view. */
  onCreateGroup?: (name: string) => void
  /** Controlled by App so the N keyboard shortcut can trigger it. */
  creatingGroup?: boolean
  onCreatingGroupChange?: (v: boolean) => void
}

function GroupGrid({
  groups,
  viewMode,
  onRenameGroup,
  onDeleteGroup,
  onOpenAll,
  onRemoveTab,
  onMoveTab,
  onOpenTab,
  onSaveGroupNote,
  onSaveTabNote,
  showFavicons,
  onCreateGroup,
  creatingGroup = false,
  onCreatingGroupChange,
}: GroupGridProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [newGroupName, setNewGroupName] = useState('')

  useEffect(() => {
    if (creatingGroup) {
      inputRef.current?.focus()
    } else {
      setNewGroupName('')
    }
  }, [creatingGroup])

  function handleSubmit(): void {
    if (!onCreateGroup) return
    onCreateGroup(newGroupName.trim() || 'New Group')
    onCreatingGroupChange?.(false)
  }

  const canCreate = onCreateGroup !== undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header row: New Group button */}
        {canCreate && !creatingGroup && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => onCreatingGroupChange?.(true)}
              aria-label="Create new empty group"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'border-color var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default)',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-brand-500)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-brand-500)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
              }}
            >
              + New Group
            </button>
          </div>
        )}

        {/* Inline creation form */}
        {creatingGroup && (
          <div
            style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--color-brand-500)',
              backgroundColor: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
                if (e.key === 'Escape') { e.preventDefault(); onCreatingGroupChange?.(false) }
              }}
              style={{
                flex: 1,
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
              aria-label="New group name"
            />
            <button
              type="button"
              onClick={handleSubmit}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-brand-500)',
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
              aria-label="Create group"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => onCreatingGroupChange?.(false)}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
              aria-label="Cancel"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Empty state */}
        {groups.length === 0 && !creatingGroup ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <span style={{ fontSize: 'var(--text-2xl)' }}>🗂️</span>
            <span>{canCreate ? 'No groups yet.' : 'No groups yet. Save some tabs to get started.'}</span>
            {canCreate && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Click <strong>+ New Group</strong> above or press <kbd style={{ padding: '1px 5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-elevated)', fontSize: 'var(--text-xs)' }}>N</kbd> to create one.
              </span>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: viewMode === 'grid' ? 'row' : 'column',
              flexWrap: viewMode === 'grid' ? 'wrap' : 'nowrap',
              gap: 'var(--space-4)',
              alignContent: 'flex-start',
            }}
          >
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                viewMode={viewMode}
                onRename={onRenameGroup}
                onDelete={() => onDeleteGroup(group.id)}
                onOpenAll={() => onOpenAll(group)}
                onOpenTab={onOpenTab}
                onRemoveTab={onRemoveTab}
                onMoveTab={onMoveTab}
                onSaveGroupNote={onSaveGroupNote}
                onSaveTabNote={onSaveTabNote}
                showFavicons={showFavicons}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

/**
 * Root application component for the new tab page.
 * ThemeProvider is applied in main.tsx above this tree so that
 * the data-theme attribute is set on documentElement before first paint.
 */
export function App(): React.JSX.Element {
  const { data, loading } = useStorage()
  const tabs = useTabs()
  const { showToast } = useToast()

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeTabsOpen, setActiveTabsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const viewMode: 'grid' | 'list' = data?.settings.default_view ?? 'grid'

  // Track whether active_tabs_on_load has been applied on first data load
  const activeTabsInitialized = useRef(false)

  // Issue 1: apply active_tabs_on_load once on first data load
  useEffect(() => {
    if (data && !activeTabsInitialized.current) {
      activeTabsInitialized.current = true
      setActiveTabsOpen(data.settings.active_tabs_on_load ?? false)
    }
  }, [data])

  // Issue 4: apply compact_mode to document root
  useEffect(() => {
    if (data?.settings.compact_mode) {
      document.documentElement.setAttribute('data-compact', 'true')
    } else {
      document.documentElement.setAttribute('data-compact', 'false')
    }
  }, [data?.settings.compact_mode])



  // Derive active workspace — use default_workspace_id from settings, or first
  const workspaces: Workspace[] = data?.workspaces ?? []
  const activeWorkspace: Workspace | undefined =
    workspaces.find((w) => w.id === data?.settings.default_workspace_id) ??
    workspaces[0]

  // Derive categories from active workspace
  const categories: Category[] = activeWorkspace?.categories ?? []

  // Derive groups for selected category (or all non-collapsed groups)
  const groups: TabGroup[] = selectedCategoryId
    ? (categories.find((c) => c.id === selectedCategoryId)?.groups ?? [])
    : categories.filter((c) => !c.collapsed).flatMap((c) => c.groups)

  // Sync meta for TopBar
  const syncState = data?.sync_meta.sync_state ?? 'idle'
  const lastSyncAt = data?.sync_meta.last_sync_at ?? 0

  // Show onboarding on first install (onboarding_completed stored outside tabnest_data)
  useEffect(() => {
    try {
      chrome.storage.local.get('onboarding_completed', (result) => {
        if (!result.onboarding_completed) {
          setOnboardingOpen(true)
        }
      })
    } catch {
      // Non-extension context
    }
  }, [])

  // Keyboard shortcuts: Cmd/Ctrl+K or / → search, N → new group
  React.useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase()
      const isEditable = tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditable) {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (isEditable) return
        if (searchOpen || settingsOpen || onboardingOpen) return
        if (!selectedCategoryId) return
        e.preventDefault()
        setCreatingGroup(true)
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [selectedCategoryId, searchOpen, settingsOpen, onboardingOpen])

  // Issue 2: handleOpenTab respects open_tab_behavior setting
  const handleOpenTab = useCallback(
    (url: string): void => {
      openTab(url, data?.settings.open_tab_behavior)
    },
    [data?.settings.open_tab_behavior],
  )

  const handleRenameGroup = useCallback(
    (groupId: string, name: string): void => {
      if (!activeWorkspace) return
      const catId =
        selectedCategoryId ??
        categories.find((c) => c.groups.some((g) => g.id === groupId))?.id
      if (!catId) return
      renameGroup(activeWorkspace.id, catId, groupId, name).catch(() => {
        showToast('Failed to rename group. Please try again.', 'error')
      })
    },
    [activeWorkspace, selectedCategoryId, categories, showToast],
  )

  const handleDeleteGroup = useCallback(
    (groupId: string): void => {
      if (!activeWorkspace) return
      // When in "All" view (selectedCategoryId is null), find the group's actual category
      const catId =
        selectedCategoryId ??
        categories.find((c) => c.groups.some((g) => g.id === groupId))?.id
      if (!catId) return
      tabs.delete(groupId, catId, activeWorkspace.id).catch(() => {
        showToast('Failed to delete group. Please try again.', 'error')
      })
    },
    [tabs, activeWorkspace, selectedCategoryId, categories, showToast],
  )

  // Issue 2: handleOpenAll uses open_tab_behavior setting
  const handleOpenAll = useCallback(
    (group: TabGroup): void => {
      for (const tab of group.tabs) {
        openTab(tab.url, data?.settings.open_tab_behavior)
      }
    },
    [data?.settings.open_tab_behavior],
  )

  const handleRemoveTab = useCallback(
    (groupId: string, tabId: string): void => {
      if (!activeWorkspace) return
      const catId =
        selectedCategoryId ??
        categories.find((c) => c.groups.some((g) => g.id === groupId))?.id
      if (!catId) return
      removeTabFromGroup(activeWorkspace.id, catId, groupId, tabId).catch(() => {
        showToast('Failed to remove tab. Please try again.', 'error')
      })
    },
    [activeWorkspace, selectedCategoryId, categories, showToast],
  )

  const handleMoveTab = useCallback(
    (fromGroupId: string, toGroupId: string, tabId: string): void => {
      if (!activeWorkspace) return
      moveTabBetweenGroups(activeWorkspace.id, fromGroupId, toGroupId, tabId).catch(() => {
        showToast('Failed to move tab. Please try again.', 'error')
      })
    },
    [activeWorkspace, showToast],
  )

  const handleSaveGroupNote = useCallback(
    (groupId: string, content: string): void => {
      if (!activeWorkspace) return
      const cat = categories.find((c) => c.groups.some((g) => g.id === groupId))
      if (!cat) return
      saveGroupNote(activeWorkspace.id, cat.id, groupId, content).catch(() => {
        showToast('Failed to save note. Please try again.', 'error')
      })
    },
    [activeWorkspace, categories, showToast],
  )

  const handleSaveTabNote = useCallback(
    (groupId: string, tabId: string, note: string): void => {
      if (!activeWorkspace) return
      const cat = categories.find((c) => c.groups.some((g) => g.id === groupId))
      if (!cat) return
      saveTabNote(activeWorkspace.id, cat.id, groupId, tabId, note).catch(() => {
        showToast('Failed to save note. Please try again.', 'error')
      })
    },
    [activeWorkspace, categories, showToast],
  )

  const handleSaveActiveTab = useCallback(
    (
      tab: chrome.tabs.Tab,
      groupName: string,
      categoryId: string,
      workspaceId: string,
      groupId: string | null,
    ): void => {
      if (!tab.id || !tab.url || !tab.title) return
      const savedTab = {
        id: crypto.randomUUID(),
        title: tab.title,
        url: tab.url,
        favicon: tab.favIconUrl,
        saved_at: Date.now(),
      }

      // Issue 3: save_and_close — capture tab.id and setting at call time
      const tabId = tab.id
      const shouldClose = data?.settings.save_and_close === true

      const onSuccess = (): void => {
        // Issue 3: close the saved tab if save_and_close is enabled
        if (shouldClose) {
          try {
            chrome.tabs.remove(tabId)
          } catch {
            // Non-extension context
          }
        }
      }
      const onError = (): void => {
        showToast('Failed to save tab. Please try again.', 'error')
      }

      if (groupId !== null) {
        // Add to existing group directly — no round-trip through the background worker
        addTabToGroup(workspaceId, categoryId, groupId, savedTab)
          .then(onSuccess)
          .catch(onError)
      } else {
        // Create a new group via the background worker message
        tabs.save({
          tabs: [savedTab],
          group_name: groupName,
          category_id: categoryId,
          workspace_id: workspaceId,
        }).then(onSuccess).catch(onError)
      }
    },
    [tabs, showToast, data?.settings.save_and_close],
  )

  const handleSaveWindowTabs = useCallback(
    (
      chromeTabs: chrome.tabs.Tab[],
      groupName: string,
      categoryId: string,
      workspaceId: string,
      groupId: string | null,
    ): void => {
      const savedTabs = chromeTabs
        .filter((t) => t.url && t.title)
        .map((t) => ({
          id: crypto.randomUUID(),
          title: t.title!,
          url: t.url!,
          favicon: t.favIconUrl,
          saved_at: Date.now(),
        }))
      if (savedTabs.length === 0) return

      const onError = (): void => {
        showToast('Failed to save tabs. Please try again.', 'error')
      }

      if (groupId !== null) {
        addTabsToGroup(workspaceId, categoryId, groupId, savedTabs).catch(onError)
      } else {
        tabs.save({
          tabs: savedTabs,
          group_name: groupName,
          category_id: categoryId,
          workspace_id: workspaceId,
        }).catch(onError)
      }
    },
    [tabs, showToast],
  )

  const handleCloseActiveTab = useCallback((tabId: number): void => {
    try {
      chrome.tabs.remove(tabId)
    } catch {
      // Non-extension context
    }
  }, [])

  const handleConnectDrive = useCallback((): void => {
    try {
      chrome.runtime.sendMessage({ type: 'CONNECT_DRIVE' })
    } catch {
      // Non-extension context
    }
  }, [])

  // Close the new-group form whenever the user navigates to a different category
  useEffect(() => {
    setCreatingGroup(false)
  }, [selectedCategoryId])

  const handleCreateEmptyGroup = useCallback((name: string): void => {
    if (!activeWorkspace || !selectedCategoryId) return
    const group = {
      id: crypto.randomUUID(),
      name: name.trim() || 'New Group',
      created_at: Date.now(),
      updated_at: Date.now(),
      order: 0,
      tabs: [] as [],
      notes: [] as [],
    }
    saveTabGroup({ group, categoryId: selectedCategoryId, workspaceId: activeWorkspace.id }).catch(() => {
      showToast('Failed to create group. Please try again.', 'error')
    })
  }, [activeWorkspace, selectedCategoryId, showToast])

  const handleCreateCategory = useCallback((name: string): void => {
    if (!activeWorkspace) return
    createCategory(activeWorkspace.id, name).catch(() => {
      showToast('Failed to create category. Please try again.', 'error')
    })
  }, [activeWorkspace, showToast])

  const handleRenameCategory = useCallback(
    (id: string, name: string): void => {
      if (!activeWorkspace) return
      renameCategory(activeWorkspace.id, id, name).catch(() => {
        showToast('Failed to rename category. Please try again.', 'error')
      })
    },
    [activeWorkspace, showToast],
  )

  const handleReorderCategories = useCallback(
    (ids: string[]): void => {
      if (!activeWorkspace) return
      reorderCategories(activeWorkspace.id, ids).catch(() => {
        showToast('Failed to reorder categories. Please try again.', 'error')
      })
    },
    [activeWorkspace, showToast],
  )

  const handleDeleteCategory = useCallback(
    (id: string): void => {
      if (!activeWorkspace) return
      // If the deleted category was selected, fall back to "All" view
      if (selectedCategoryId === id) setSelectedCategoryId(null)
      deleteCategory(activeWorkspace.id, id).catch(() => {
        showToast('Failed to delete category. Please try again.', 'error')
      })
    },
    [activeWorkspace, selectedCategoryId, showToast],
  )

  const handleToggleCollapse = useCallback(
    (categoryId: string): void => {
      if (!activeWorkspace) return
      const cat = categories.find((c) => c.id === categoryId)
      if (!cat) return
      setCategoryCollapsed(activeWorkspace.id, categoryId, !cat.collapsed).catch(() => {
        showToast('Failed to update category. Please try again.', 'error')
      })
    },
    [activeWorkspace, categories, showToast],
  )

  const handleSelectWorkspace = useCallback((id: string): void => {
    patchSettings({ default_workspace_id: id }).catch(() => {
      showToast('Failed to switch workspace. Please try again.', 'error')
    })
  }, [showToast])

  const handleSearchNavigate = useCallback((record: SearchRecord): void => {
    if (record.workspace_id !== activeWorkspace?.id) {
      handleSelectWorkspace(record.workspace_id)
    }
    if (record.type === 'group' && record.category_id) {
      setSelectedCategoryId(record.category_id)
    } else if (record.type === 'category') {
      setSelectedCategoryId(record.id)
    }
  }, [activeWorkspace?.id, handleSelectWorkspace])

  const handleCreateWorkspace = useCallback((name: string): void => {
    createWorkspace(name)
      .then((id) => patchSettings({ default_workspace_id: id }))
      .catch(() => {
        showToast('Failed to create workspace. Please try again.', 'error')
      })
  }, [showToast])

  const handleRenameWorkspace = useCallback((id: string, name: string): void => {
    renameWorkspace(id, name).catch(() => {
      showToast('Failed to rename workspace. Please try again.', 'error')
    })
  }, [showToast])

  // Issue 8: import bookmarks from custom event
  const importBookmarksTree = useCallback(
    async (tree: chrome.bookmarks.BookmarkTreeNode[]): Promise<void> => {
      if (!activeWorkspace) return
      const catId = categories[0]?.id
      if (!catId) return
      const rootChildren = tree[0]?.children ?? []
      for (const topFolder of rootChildren) {
        if (!topFolder.children) continue
        const folderName = topFolder.title || 'Imported Bookmarks'
        const bookmarks = topFolder.children.filter((n) => n.url)
        if (bookmarks.length === 0) continue
        const savedTabs = bookmarks.map((b) => ({
          id: crypto.randomUUID(),
          title: b.title || b.url || 'Untitled',
          url: b.url!,
          favicon: undefined,
          saved_at: Date.now(),
        }))
        await tabs.save({
          tabs: savedTabs,
          group_name: folderName,
          category_id: catId,
          workspace_id: activeWorkspace.id,
        })
      }
    },
    [activeWorkspace, categories, tabs],
  )

  useEffect(() => {
    const handler = (e: Event): void => {
      const tree = (e as CustomEvent<chrome.bookmarks.BookmarkTreeNode[]>).detail
      importBookmarksTree(tree).catch(() => showToast('Bookmark import failed.', 'error'))
    }
    window.addEventListener('tabnest:import-bookmarks', handler)
    return () => window.removeEventListener('tabnest:import-bookmarks', handler)
  }, [importBookmarksTree, showToast])

  // Issue 9: import from OneTab via custom event
  useEffect(() => {
    const handler = (e: Event): void => {
      const text = (e as CustomEvent<string>).detail
      if (!activeWorkspace || !categories[0]) return
      const catId = categories[0].id
      const groupBlocks = text.trim().split(/\n\s*\n/)
      const promises = groupBlocks.map(async (groupText) => {
        const lines = groupText.trim().split('\n').filter(Boolean)
        const savedTabs = lines
          .map((line) => {
            const sepIdx = line.indexOf(' | ')
            const url = sepIdx > -1 ? line.slice(0, sepIdx) : line
            const title = sepIdx > -1 ? line.slice(sepIdx + 3) : line
            return { id: crypto.randomUUID(), title, url, favicon: undefined as string | undefined, saved_at: Date.now() }
          })
          .filter((t) => t.url.startsWith('http'))
        if (savedTabs.length === 0) return
        await tabs.save({
          tabs: savedTabs,
          group_name: `Imported ${new Date().toLocaleDateString()}`,
          category_id: catId,
          workspace_id: activeWorkspace.id,
        })
      })
      Promise.all(promises).catch(() => showToast('OneTab import failed.', 'error'))
      showToast(`Imported ${groupBlocks.length} group(s) from OneTab.`, 'success')
    }
    window.addEventListener('tabnest:import-onetab', handler)
    return () => window.removeEventListener('tabnest:import-onetab', handler)
  }, [activeWorkspace, categories, tabs, showToast])

  const showFavicons = data?.settings.show_favicons ?? true

  return (
    <>
      <div
        className={activeTabsOpen ? 'tabnest-main-with-panel' : undefined}
        style={shellStyle}
      >
        {/* TopBar */}
        <div style={{ gridArea: 'topbar' }}>
          <TopBar
            onSearch={() => setSearchOpen(true)}
            onActiveTabsToggle={() => setActiveTabsOpen((prev) => !prev)}
            activeTabsOpen={activeTabsOpen}
            syncState={syncState}
            lastSyncAt={lastSyncAt}
            onSettingsClick={() => setSettingsOpen(true)}
            showClock={data?.settings.show_clock ?? false}
          />
        </div>

        {/* Sidebar */}
        <div style={sidebarStyle}>
          <CategoryList
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            onCreateCategory={handleCreateCategory}
            onRenameCategory={handleRenameCategory}
            onDeleteCategory={handleDeleteCategory}
            onReorderCategories={handleReorderCategories}
            onToggleCollapse={handleToggleCollapse}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspace?.id}
            onSelectWorkspace={handleSelectWorkspace}
            onCreateWorkspace={handleCreateWorkspace}
            onRenameWorkspace={handleRenameWorkspace}
          />
        </div>

        {/* Main content */}
        <div style={mainStyle}>
          {loading ? (
            <LoadingPlaceholder />
          ) : (
            <GroupGrid
              groups={groups}
              viewMode={viewMode}
              onRenameGroup={handleRenameGroup}
              onDeleteGroup={handleDeleteGroup}
              onOpenAll={handleOpenAll}
              onRemoveTab={handleRemoveTab}
              onMoveTab={handleMoveTab}
              onOpenTab={handleOpenTab}
              onSaveGroupNote={handleSaveGroupNote}
              onSaveTabNote={handleSaveTabNote}
              showFavicons={showFavicons}
              onCreateGroup={selectedCategoryId ? handleCreateEmptyGroup : undefined}
              creatingGroup={creatingGroup}
              onCreatingGroupChange={(v) => setCreatingGroup(v)}
            />
          )}

          {/* Active tabs side panel */}
          {activeTabsOpen && (
            <div
              style={{
                width: 'var(--right-panel-width)',
                height: '100%',
                borderLeft: '1px solid var(--border-default)',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              <ActiveTabsPanel
                workspaces={workspaces}
                onSaveTab={handleSaveActiveTab}
                onSaveWindowTabs={handleSaveWindowTabs}
                onCloseTab={handleCloseActiveTab}
                showFavicons={showFavicons}
                activeWorkspaceId={activeWorkspace?.id}
                activeCategoryId={selectedCategoryId}
              />
            </div>
          )}
        </div>

        {/* Search overlay */}
        <SearchOverlay
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          workspaces={workspaces}
          onNavigate={handleSearchNavigate}
        />
      </div>

      {/* Settings modal — rendered outside the shell grid so it overlays everything */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={data?.settings ?? DEFAULT_SETTINGS}
        onSave={(s: UserSettings) => {
          patchSettings(s).catch(() => {
            showToast('Failed to save settings. Please try again.', 'error')
          })
        }}
        localSettings={data?.local_settings ?? DEFAULT_LOCAL_SETTINGS}
        onSaveLocalSettings={(patch) => {
          patchLocalSettings(patch).catch(() => {
            showToast('Failed to save settings. Please try again.', 'error')
          })
        }}
        syncMeta={data?.sync_meta ?? DEFAULT_SYNC_META()}
        workspaces={workspaces}
        trashItems={data?.trash ?? []}
        onRestoreTrashItem={(id) => {
          restoreFromTrash(id).catch(() => {
            showToast('Failed to restore item. Please try again.', 'error')
          })
        }}
        onDeleteTrashItem={(id) => {
          deleteFromTrash(id).catch(() => {
            showToast('Failed to delete item. Please try again.', 'error')
          })
        }}
        onEmptyTrash={() => {
          emptyTrash().catch(() => {
            showToast('Failed to empty trash. Please try again.', 'error')
          })
        }}
        onShowOnboarding={() => {
          setSettingsOpen(false)
          setOnboardingOpen(true)
        }}
      />

      {/* Onboarding overlay — highest z-index, shown on first install or via Settings → Help */}
      <OnboardingOverlay
        isOpen={onboardingOpen}
        onComplete={() => setOnboardingOpen(false)}
        onSkip={() => setOnboardingOpen(false)}
        onOpenActiveTabs={() => setActiveTabsOpen(true)}
        onConnectDrive={handleConnectDrive}
      />

    </>
  )
}
