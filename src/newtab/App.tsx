import React, { useCallback, useEffect, useRef, useState } from 'react'
import { TopBar } from '@/components/TopBar/TopBar'
import { CategoryList } from '@/components/Sidebar/CategoryList'
import { SearchOverlay } from '@/components/Search/SearchOverlay'
import { ActiveTabsPanel } from '@/components/ActiveTabsPanel/ActiveTabsPanel'
import { SettingsModal } from '@/components/Settings/SettingsModal'
import { OnboardingOverlay } from '@/components/Onboarding/OnboardingOverlay'
import { useStorage } from '@/hooks/useStorage'
import { useTabs } from '@/hooks/useTabs'
import { useToast } from '@/components/Toast/ToastProvider'
import { LoadingPlaceholder } from './LoadingPlaceholder'
import { GroupGrid } from './GroupGrid'
import { openTab, openAllTabs, openAllTabsInBackground } from './openTab'
import { tabTitleOrHostname } from '@/lib/tabTitle'
import type { Category, TabGroup, UserSettings, Workspace } from '@/lib/schema'
import type { SearchRecord } from '@/lib/search'
import { DEFAULT_SETTINGS, DEFAULT_LOCAL_SETTINGS, DEFAULT_SYNC_META, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_DEFAULT } from '@/lib/schema'
import { patchSettings, patchLocalSettings, restoreFromTrash, deleteFromTrash, emptyTrash, createWorkspace, renameWorkspace, createCategory, renameGroup, removeTabFromGroup, renameCategory, deleteCategory, setCategoryCollapsed, moveTabBetweenGroups, addTabToGroup, addTabsToGroup, reorderCategories, saveTabGroup, saveTabNote, saveGroupNote, moveGroupToCategory, duplicateGroup, archiveGroup, reorderTabInGroup } from '@/lib/storage'

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
  position: 'relative',
}

function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(width)))
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

  // Sidebar resize — draft holds the in-session width (live during drag);
  // the persisted value in local_settings is the fallback on load.
  const [draftSidebarWidth, setDraftSidebarWidth] = useState<number | null>(null)
  const [resizingSidebar, setResizingSidebar] = useState(false)
  const sidebarWidth =
    draftSidebarWidth ?? data?.local_settings.sidebar_width ?? SIDEBAR_WIDTH_DEFAULT

  const persistSidebarWidth = useCallback((width: number): void => {
    patchLocalSettings({ sidebar_width: width }).catch(() => {
      // Non-critical: the width still applies for this session
    })
  }, [])

  const handleSidebarResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = sidebarWidth
      setResizingSidebar(true)

      function onMove(ev: PointerEvent): void {
        setDraftSidebarWidth(clampSidebarWidth(startWidth + ev.clientX - startX))
      }
      function onUp(ev: PointerEvent): void {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        setResizingSidebar(false)
        const final = clampSidebarWidth(startWidth + ev.clientX - startX)
        setDraftSidebarWidth(final)
        persistSidebarWidth(final)
      }
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
    },
    [sidebarWidth, persistSidebarWidth],
  )

  const handleSidebarResizeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const next = clampSidebarWidth(sidebarWidth + (e.key === 'ArrowRight' ? 16 : -16))
      setDraftSidebarWidth(next)
      persistSidebarWidth(next)
    },
    [sidebarWidth, persistSidebarWidth],
  )

  const handleSidebarResizeReset = useCallback((): void => {
    setDraftSidebarWidth(SIDEBAR_WIDTH_DEFAULT)
    persistSidebarWidth(SIDEBAR_WIDTH_DEFAULT)
  }, [persistSidebarWidth])

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

  // Spec §6.3: opening a group can optionally move it to trash afterwards
  const deleteGroupAfterOpen = useCallback(
    (group: TabGroup): void => {
      if (data?.settings.delete_group_on_open !== true) return
      if (!activeWorkspace) return
      const catId = categories.find((c) => c.groups.some((g) => g.id === group.id))?.id
      if (!catId) return
      tabs.delete(group.id, catId, activeWorkspace.id).catch(() => {
        showToast('Opened tabs, but failed to move the group to trash.', 'error')
      })
    },
    [data?.settings.delete_group_on_open, activeWorkspace, categories, tabs, showToast],
  )

  // Issue 2: handleOpenAll uses open_tab_behavior setting
  const handleOpenAll = useCallback(
    (group: TabGroup): void => {
      openAllTabs(group.tabs.map((tab) => tab.url), data?.settings.open_tab_behavior)
      deleteGroupAfterOpen(group)
    },
    [data?.settings.open_tab_behavior, deleteGroupAfterOpen],
  )

  const handleOpenAllInBackground = useCallback(
    (group: TabGroup): void => {
      openAllTabsInBackground(group.tabs.map((tab) => tab.url))
      deleteGroupAfterOpen(group)
    },
    [deleteGroupAfterOpen],
  )

  // Spec §6.2: add a manually entered URL to a group (with duplicate warning, spec §17)
  const handleAddTabByUrl = useCallback(
    (groupId: string, url: string): void => {
      if (!activeWorkspace) return
      const cat = categories.find((c) => c.groups.some((g) => g.id === groupId))
      const group = cat?.groups.find((g) => g.id === groupId)
      if (!cat || !group) return
      if (group.tabs.some((t) => t.url === url)) {
        showToast('That URL is already in this group.', 'error')
        return
      }
      const savedTab = {
        id: crypto.randomUUID(),
        title: tabTitleOrHostname(undefined, url),
        url,
        saved_at: Date.now(),
      }
      addTabToGroup(activeWorkspace.id, cat.id, groupId, savedTab).catch(() => {
        showToast('Failed to add tab. Please try again.', 'error')
      })
    },
    [activeWorkspace, categories, showToast],
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

  const handleMoveGroupToCategory = useCallback(
    (groupId: string, toCategoryId: string): void => {
      if (!activeWorkspace) return
      moveGroupToCategory(activeWorkspace.id, groupId, toCategoryId).catch(() => {
        showToast('Failed to move group. Please try again.', 'error')
      })
    },
    [activeWorkspace, showToast],
  )

  const handleDuplicateGroup = useCallback(
    (groupId: string): void => {
      if (!activeWorkspace) return
      const catId = categories.find((c) => c.groups.some((g) => g.id === groupId))?.id
      if (!catId) return
      duplicateGroup(activeWorkspace.id, catId, groupId).catch(() => {
        showToast('Failed to duplicate group. Please try again.', 'error')
      })
    },
    [activeWorkspace, categories, showToast],
  )

  const handleArchiveGroup = useCallback(
    (groupId: string): void => {
      if (!activeWorkspace) return
      const catId = categories.find((c) => c.groups.some((g) => g.id === groupId))?.id
      if (!catId) return
      archiveGroup(activeWorkspace.id, catId, groupId)
        .then(() => showToast('Group archived.', 'success'))
        .catch(() => showToast('Failed to archive group. Please try again.', 'error'))
    },
    [activeWorkspace, categories, showToast],
  )

  // Spec §11.5: copy the group as "url | title" lines (round-trips with OneTab import)
  const handleExportGroup = useCallback(
    (group: TabGroup): void => {
      const text = group.tabs.map((t) => `${t.url} | ${t.title}`).join('\n')
      navigator.clipboard
        .writeText(text)
        .then(() => showToast(`Copied ${group.tabs.length} URL${group.tabs.length === 1 ? '' : 's'} to clipboard.`, 'success'))
        .catch(() => showToast('Failed to copy to clipboard.', 'error'))
    },
    [showToast],
  )

  const handleReorderTab = useCallback(
    (groupId: string, tabId: string, toIndex: number): void => {
      if (!activeWorkspace) return
      reorderTabInGroup(activeWorkspace.id, groupId, tabId, toIndex).catch(() => {
        showToast('Failed to reorder tab. Please try again.', 'error')
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
      if (!tab.id || !tab.url) return

      // Spec §17: warn when the URL already exists in the target group
      if (groupId !== null) {
        const targetGroup = workspaces
          .find((w) => w.id === workspaceId)
          ?.categories.find((c) => c.id === categoryId)
          ?.groups.find((g) => g.id === groupId)
        if (targetGroup?.tabs.some((t) => t.url === tab.url)) {
          showToast('That tab is already saved in this group.', 'error')
          return
        }
      }

      const savedTab = {
        id: crypto.randomUUID(),
        title: tabTitleOrHostname(tab.title, tab.url),
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
    [tabs, showToast, data?.settings.save_and_close, workspaces],
  )

  const handleSaveWindowTabs = useCallback(
    (
      chromeTabs: chrome.tabs.Tab[],
      groupName: string,
      categoryId: string,
      workspaceId: string,
      groupId: string | null,
    ): void => {
      let savedTabs = chromeTabs
        .filter((t) => t.url)
        .map((t) => ({
          id: crypto.randomUUID(),
          title: tabTitleOrHostname(t.title, t.url!),
          url: t.url!,
          favicon: t.favIconUrl,
          saved_at: Date.now(),
        }))
      if (savedTabs.length === 0) return

      const onError = (): void => {
        showToast('Failed to save tabs. Please try again.', 'error')
      }

      if (groupId !== null) {
        // Spec §17: don't add URLs that already exist in the target group
        const targetGroup = workspaces
          .find((w) => w.id === workspaceId)
          ?.categories.find((c) => c.id === categoryId)
          ?.groups.find((g) => g.id === groupId)
        if (targetGroup) {
          const existing = new Set(targetGroup.tabs.map((t) => t.url))
          const skipped = savedTabs.filter((t) => existing.has(t.url)).length
          if (skipped > 0) {
            savedTabs = savedTabs.filter((t) => !existing.has(t.url))
            showToast(
              savedTabs.length === 0
                ? 'All of those tabs are already in this group.'
                : `Skipped ${skipped} tab${skipped === 1 ? '' : 's'} already in this group.`,
              'error',
            )
            if (savedTabs.length === 0) return
          }
        }
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
    [tabs, showToast, workspaces],
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
    // Always return to the "All" view when switching workspaces
    setSelectedCategoryId(null)
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
        style={{
          ...shellStyle,
          ...(resizingSidebar ? { userSelect: 'none', cursor: 'col-resize' } : {}),
          ['--sidebar-width' as string]: `${sidebarWidth}px`,
        }}
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

        {/* Sidebar resize handle — straddles the sidebar/main border */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={sidebarWidth}
          aria-valuemin={SIDEBAR_WIDTH_MIN}
          aria-valuemax={SIDEBAR_WIDTH_MAX}
          tabIndex={0}
          title="Drag to resize sidebar. Double-click to reset."
          onPointerDown={handleSidebarResizeStart}
          onKeyDown={handleSidebarResizeKeyDown}
          onDoubleClick={handleSidebarResizeReset}
          style={{
            position: 'absolute',
            top: 'var(--topbar-height)',
            bottom: 0,
            left: 'calc(var(--sidebar-width) - 3px)',
            width: 6,
            cursor: 'col-resize',
            zIndex: 10,
            backgroundColor: resizingSidebar ? 'var(--color-brand-500)' : 'transparent',
            transition: 'background-color var(--duration-fast) var(--ease-default)',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--color-brand-500)'
          }}
          onMouseLeave={(e) => {
            if (!resizingSidebar) {
              ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
            }
          }}
        />

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
              onOpenAllInBackground={handleOpenAllInBackground}
              onAddTab={handleAddTabByUrl}
              categories={categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji }))}
              categoryIdOf={(groupId) => categories.find((c) => c.groups.some((g) => g.id === groupId))?.id}
              onMoveToCategory={handleMoveGroupToCategory}
              onDuplicate={handleDuplicateGroup}
              onArchive={handleArchiveGroup}
              onExport={handleExportGroup}
              onReorderTab={handleReorderTab}
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
