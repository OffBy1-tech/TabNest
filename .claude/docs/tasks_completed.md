# tabNest — Tasks Completed

Features and requirements from the specification that ARE already implemented.
Completion confirmed by direct code evidence in the codebase.
Last updated: 2026-07-07

---

## Tech Stack & Architecture

- [x] **Manifest V3 Chrome Extension** — manifest.json uses `"manifest_version": 3`
- [x] **React 18 + TypeScript** — confirmed in component files and tsconfig
- [x] **Vite build tool** — vite.config.ts present (referenced in appendix)
- [x] **chrome.storage.local as primary data store** — storage.ts implements full read/write abstraction
- [x] **Google Drive REST API sync** — background/index.ts implements `findOrCreateDriveFile`, `readDriveFile`, `writeDriveFile`
- [x] **Chrome Identity API for OAuth2** — `acquireToken` using `chrome.identity.getAuthToken` in background/index.ts
- [x] **Fuse.js fuzzy search** — search.ts imports and configures Fuse with weighted keys
- [x] **Lucide React icons** — used throughout components (GripVertical, MoreHorizontal, X, Plus, etc.)
- [x] **No eval(), no remote code execution** — manifest CSP: `script-src 'self'`

---

## Data Model (spec §2)

- [x] **Three-level hierarchy: Workspace > Category > Group** — WorkspaceSchema, CategorySchema, TabGroupSchema all implemented in schema.ts
- [x] **SavedTab entity** — SavedTabSchema: id, title, url, favicon, saved_at, note
- [x] **Note entity** — NoteSchema: id, content, created_at, updated_at
- [x] **TabGroup entity** — TabGroupSchema: id, name, created_at, updated_at, order, tabs[], notes[], archived
- [x] **Category entity** — CategorySchema: id, name, color, emoji, collapsed, order, groups[]
- [x] **Workspace entity** — WorkspaceSchema: id, name, created_at, categories[]
- [x] **Zod runtime validation** — all schemas use Zod; StorageSchemaZod.safeParse used at migration and Drive read boundaries
- [x] **schema_version field** — SCHEMA_VERSION = 2 in schema.ts
- [x] **TypeScript types inferred from Zod schemas** — all `z.infer<>` exports at bottom of schema.ts

---

## Storage Layer (spec §2.3)

- [x] **chrome.storage.local abstraction** — storage.ts is the single access point; no other module calls chrome.storage directly
- [x] **Safe defaults on empty storage** — `buildDefaultStorage()` and `readStorage()` return defaults when key is absent
- [x] **Merge writes (never full-replace)** — `writeStorage` reads then merges before writing
- [x] **Write queue to prevent race conditions** — `writeQueue = writeQueue.then(...)` serializes concurrent writes
- [x] **QuotaExceededError detection** — `chromeSet` catches and re-throws with a typed label
- [x] **Workspace CRUD** — `getWorkspaces`, `saveWorkspace`, `deleteWorkspace`, `createWorkspace`, `renameWorkspace`
- [x] **Category CRUD** — `createCategory`, `renameCategory`, `deleteCategory`, `reorderCategories`
- [x] **TabGroup CRUD** — `saveTabGroup`, `deleteTabGroup` (moves to trash), `renameGroup`
- [x] **Tab operations** — `addTabToGroup`, `addTabsToGroup`, `removeTabFromGroup`, `moveTabBetweenGroups`
- [x] **Trash operations** — `addToTrash`, `restoreFromTrash` (group type), `deleteFromTrash`, `emptyTrash`
- [x] **Auto-purge trash after 30 days** — `purgeTrashOlderThan(30)` called daily via alarm
- [x] **Settings read/write** — `patchSettings` (UserSettings), `patchLocalSettings` (LocalSettings)
- [x] **Sync metadata read/write** — `getSyncMeta`, `patchSyncMeta`
- [x] **Local backup before Drive overwrite** — `writeLocalBackup`, `readLocalBackup`; called in runSync when remote wins
- [x] **last_modified_at auto-bump on user data writes** — `writeStorage` bumps `sync_meta.last_modified_at` when workspaces/settings/trash are in the patch
- [x] **Schema migration framework** — `migrateIfNeeded` runs forward-only migrations from stored version to SCHEMA_VERSION; v1→v2 migration implemented (moves sync_enabled/sync_interval out of settings into local_settings)

---

## Settings Schema (spec §11)

- [x] **Theme: light / dark / system** — UserSettingsSchema, DEFAULT_SETTINGS
- [x] **Accent color** — `accent_color` field in UserSettings
- [x] **Default view: grid / list** — `default_view` field
- [x] **Open tab behavior: current / new_tab / new_window** — `open_tab_behavior` field
- [x] **Save & Close toggle** — `save_and_close` field
- [x] **Show favicons toggle** — `show_favicons` field
- [x] **Compact mode toggle** — `compact_mode` field
- [x] **Active tabs on load toggle** — `active_tabs_on_load` field
- [x] **Default workspace setting** — `default_workspace_id` field
- [x] **Show clock toggle** — `show_clock` field
- [x] **Per-device local settings** — LocalSettingsSchema: `sync_enabled`, `sync_interval_minutes`; never written to Drive
- [x] **Sync metadata** — SyncMetaSchema: drive_file_id, last_sync_at, last_modified_at, device_id, sync_state, pending_sync, error_message, retry_count

---

## New Tab Page Interface (spec §3)

- [x] **New tab override** — `chrome_url_overrides.newtab` in manifest.json
- [x] **Grid layout: TopBar / Sidebar / Main content** — App.tsx uses CSS grid with `gridTemplateAreas: '"topbar topbar" "sidebar main"'`
- [x] **TopBar rendered** — TopBar component wired in App.tsx
- [x] **Left sidebar with CategoryList** — CategoryList component wired in App.tsx
- [x] **Main content area with GroupGrid** — GroupGrid component renders TabGroups as cards
- [x] **Grid and list view modes** — GroupGrid passes `viewMode` to GroupCard; `default_view` from settings drives it
- [x] **Loading placeholder** — `LoadingPlaceholder` shown while `useStorage` is loading
- [x] **Search bar trigger in TopBar** — TopBar has a clickable search button that calls `onSearch`
- [x] **Cmd/Ctrl+K to open search** — global keydown handler in App.tsx
- [x] **Active Tabs toggle button in TopBar** — `onActiveTabsToggle` button rendered with pressed state
- [x] **Active Tabs panel as right panel** — rendered conditionally inside main area when `activeTabsOpen` is true
- [x] **Settings icon in TopBar** — Settings button calls `onSettingsClick`
- [x] **Theme toggle in TopBar** — ThemeToggle component cycles light/dark/system
- [x] **Sync status indicator in TopBar** — SyncStatusDot shows idle/syncing/error with color and tooltip
- [x] **Workspace name in TopBar (clickable)** — WorkspaceDropdown in TopBar shows current workspace name
- [x] **Workspace switcher dropdown** — WorkspaceDropdown lists workspaces with select, create, rename
- [x] **"All" pseudo-category** — CategoryList renders an "All" item that sets `selectedCategoryId` to null; App.tsx shows all groups when null
- [x] **Category filtering in main area** — `groups` derived from `selectedCategoryId`; null = all groups across all categories
- [x] **"+ New Category" button** — CategoryList renders a dashed button at bottom that triggers inline creation
- [x] **Category right-click context menu (Rename, Delete)** — ContextMenu in CategoryList handles right-click with Rename and Delete
- [x] **Category inline rename** — RenameInput component in CategoryList; triggered via context menu or double-click
- [x] **Category drag-and-drop reorder** — CategoryList implements drag handles, drag-over indicator, drop → `onReorderCategories`
- [x] **Onboarding overlay** — OnboardingOverlay component wired in App.tsx; shown on first install via `onboarding_completed` storage key

---

## Group Card (spec §3.4, §6)

- [x] **Group name displayed** — group.name rendered in GroupCard header
- [x] **Tab count badge** — rendered as a pill next to group name
- [x] **"Open All" button on group card** — button calls `onOpenAll`
- [x] **Kebab / context menu on group card** — KebabMenu with Open All, Rename, Delete
- [x] **Inline group rename** — InlineNameEditor; triggered by clicking group name or pressing E key
- [x] **Enter to confirm, Escape to cancel rename** — handled in `handleKeyDown` inside InlineNameEditor
- [x] **Tab list with favicons and titles** — TabRow renders favicon + title + domain + remove button
- [x] **Clicking a tab opens it** — `onOpenTab` calls `window.open(url, '_blank')`
- [x] **Remove individual tab from group** — X button on each TabRow calls `onRemoveTab`
- [x] **Expand/collapse tab list** — MAX_VISIBLE_TABS = 5; "Show N more" / "Show less" toggle
- [x] **Drag tabs between groups** — TabRow sets `DRAG_TYPE` dataTransfer; GroupCard handles `onDrop` and calls `onMoveTab`
- [x] **Delete group moves to trash** — `handleDeleteGroup` calls `tabs.delete` → `DELETE_GROUP` message → `deleteTabGroup` in storage (moves to trash)
- [x] **Delete confirmation dialog** — `ConfirmDialog` shown before deletion
- [x] **`E` key to rename selected group** — `handleCardKeyDown` listens for `e.key === 'e'`
- [x] **`Delete` key to delete selected group** — `handleCardKeyDown` listens for `e.key === 'Delete'`
- [x] **`Enter` key on focused group card opens all** — `handleCardKeyDown` for `Enter`

---

## Active Tabs Panel (spec §4)

- [x] **Panel shows all open windows and tabs** — `useActiveTabs` hook calls `chrome.windows.getAll` and groups by window
- [x] **Tabs grouped by Chrome window** — each WindowSection renders one window
- [x] **Window collapsible** — WindowSection has a collapsed state toggled by clicking the header
- [x] **Each tab shows favicon, title, URL domain** — FaviconImage + title + domain rendered in WindowSection
- [x] **Debounced auto-refresh on tab events** — `useActiveTabs` listens to `onCreated`, `onRemoved`, `onUpdated`, `onMoved` with 300ms debounce
- [x] **Per-tab Save button with popover** — SavePopover opens on click, allows workspace/category/group selection
- [x] **"Save All Tabs in Window" button** — WindowSavePopover accessible via BookmarkPlus icon on window header
- [x] **Close individual tab from panel** — X button calls `onCloseTab(tabId)` → `chrome.tabs.remove`
- [x] **"Close Duplicates" button** — `handleCloseDuplicates` in ActiveTabsPanel deduplicates by URL
- [x] **Drag-to-reorder within a window** — WindowSection drag logic calls `chrome.tabs.move`

---

## Saving Tabs (spec §5)

- [x] **Save single tab from Active Tabs panel** — `handleSaveActiveTab` in App.tsx
- [x] **Save all tabs in a window** — `handleSaveWindowTabs` in App.tsx; supports new group or existing group
- [x] **Save to existing group** — `addTabToGroup` / `addTabsToGroup` called when a groupId is selected
- [x] **Create new group on save** — `SAVE_TABS` message → `saveTabGroup` creates a new group
- [x] **Save from toolbar popup** — PopupApp sends `SAVE_TABS` message to background
- [x] **Recent groups in popup** — PopupApp loads/saves recent groups from `tabnest_popup_recent_groups` storage key; shown as chips
- [x] **"View TabNest" link in popup** — opens `newtab.html` via `chrome.tabs.create`
- [x] **"Save & Close" in popup** — `handleSaveAndClose` calls `doSave()` then `window.close()`
- [x] **Context menu "Save to tabNest"** — `save-page` context menu item registered in background/index.ts; saves to first workspace/first category as a new group
- [x] **Context menu "Save Link to tabNest"** — `save-link` context menu item registered; uses `info.linkUrl`
- [x] **Sync status dot in popup** — `SyncDot` component in PopupApp header

---

## Search (spec §8)

- [x] **Global search overlay** — SearchOverlay component with full-screen modal
- [x] **Search trigger: Cmd/Ctrl+K** — global handler in App.tsx
- [x] **Fuse.js fuzzy matching** — `createSearchEngine` in search.ts configures Fuse with threshold 0.4
- [x] **Weighted scoring: title > URL > group_name** — keys with weights 0.5, 0.3, 0.2 in createSearchEngine
- [x] **Minimum 1 character to trigger results** — `minMatchCharLength: 1` in Fuse config; `search` returns [] for empty query
- [x] **Results grouped by type: Tabs, Groups, Categories, Workspaces** — `groupResults` function and TYPE_ORDER array
- [x] **Breadcrumb shown on each result** — `breadcrumb` field built in `buildSearchIndex` (e.g., "Workspace > Category > Group")
- [x] **Keyboard navigation: arrow keys, Enter, Escape** — `handleKeyDown` in SearchOverlay
- [x] **Clicking a tab result opens the URL** — `activateResult` calls `window.open` for tab type
- [x] **Search input auto-focused on open** — `requestAnimationFrame(() => inputRef.current?.focus())` in useEffect
- [x] **Escape closes search** — handled in `handleKeyDown`

---

## Google Drive Sync (spec §9)

- [x] **Opt-in sync — full offline functionality without Drive** — local_settings.sync_enabled defaults to false; all features work from chrome.storage.local
- [x] **"Connect Google Drive" in Settings** — SyncTab has Connect/Disconnect button; sends CONNECT_DRIVE message
- [x] **OAuth2 via Chrome Identity API** — `acquireToken` uses `chrome.identity.getAuthToken`
- [x] **Drive file created on first connect** — `findOrCreateDriveFile` called in `connectDrive`
- [x] **Single JSON file per data set** — `tabnest_data.json` stored in appDataFolder
- [x] **Auto-sync via alarm** — `ALARM_SYNC` registered in `onInstalled`; fires on schedule from `local_settings.sync_interval_minutes`
- [x] **Last-write-wins conflict resolution via timestamp** — `runSync` compares `last_modified_at` between local and remote
- [x] **Local backup written before remote overwrite** — `writeStorage({ backup_local: local.workspaces })` before overwriting when remote wins
- [x] **"Sync Now" button** — SyncTab sends TRIGGER_SYNC message; background calls `runSync`
- [x] **Sync interval options: 5 / 15 / 30 / Manual** — LocalSettingsSchema and SyncTab dropdown
- [x] **Sync state: idle / syncing / error** — SyncMetaSchema `sync_state` enum; used by SyncStatusDot and SyncTab
- [x] **Last sync timestamp displayed** — SyncTab shows formatted `syncMeta.last_sync_at`
- [x] **Exponential backoff retry on failure** — `runSync` catch block: up to 3 retries with `30 * 2^(retry-1)` second delays via `ALARM_RETRY_SYNC`
- [x] **Disconnect Drive** — DISCONNECT_DRIVE message clears drive_file_id and disables sync
- [x] **local_settings never written to Drive** — `writeDriveFile` destructures out `local_settings` and `backup_local` before sending
- [x] **Drive data validated with Zod before use** — `StorageSchemaZod.safeParse(raw)` in `readDriveFile`
- [x] **Export data as JSON** — `handleExportJSON` in SyncTab downloads `tabnest_data.json`
- [x] **Import data from JSON** — `handleImportJSON` in SyncTab parses and validates with Zod before writing

---

## Workspace Management (spec §10)

- [x] **Multiple workspaces supported** — WorkspaceSchema, array in StorageSchema
- [x] **Default workspace "My Workspace" on first install** — `DEFAULT_WORKSPACE()` creates it; `buildDefaultStorage` sets `default_workspace_id`
- [x] **Create new workspace** — `createWorkspace` in storage.ts; WorkspaceDropdown in TopBar
- [x] **Rename workspace** — `renameWorkspace` in storage.ts; inline rename in WorkspaceDropdown
- [x] **Delete workspace** — `deleteWorkspace` in storage.ts (no trash/confirmation — see todo)
- [x] **Switch active workspace** — `patchSettings({ default_workspace_id })` via `handleSelectWorkspace`

---

## Settings Modal (spec §11)

- [x] **Settings modal with left-rail tab navigation** — SettingsModal has 7 tabs: General, New Tab Page, Sync, Shortcuts, Import/Export, Trash, Help
- [x] **Focus trap in modal** — Tab key handling in `handleKeyDown` keeps focus inside dialog
- [x] **Escape to close modal** — `handleKeyDown` calls `onClose` on Escape
- [x] **Restore focus on close** — `previousFocusRef.current?.focus()` on cleanup
- [x] **General tab: Theme toggle** — SegmentedControl with light/dark/system
- [x] **General tab: Accent color picker** — `<input type="color">` for `accent_color`
- [x] **General tab: Default view (grid/list)** — SegmentedControl
- [x] **General tab: Open tab behavior** — radio group with 3 options
- [x] **General tab: Save & Close toggle** — ToggleSwitch
- [x] **General tab: Show favicons toggle** — ToggleSwitch
- [x] **General tab: Compact mode toggle** — ToggleSwitch
- [x] **New Tab Page tab: Active tabs on load toggle** — ToggleSwitch
- [x] **New Tab Page tab: Default workspace select** — dropdown of workspace names
- [x] **New Tab Page tab: Show clock toggle** — ToggleSwitch
- [x] **Sync tab: Connect / Disconnect Google Drive** — full connect/disconnect flow
- [x] **Sync tab: Auto-sync toggle** — ToggleSwitch for `local_settings.sync_enabled`
- [x] **Sync tab: Sync interval select** — dropdown with 5/15/30 min / Manual
- [x] **Sync tab: Last sync display** — formatted timestamp
- [x] **Sync tab: Sync Now button** — sends TRIGGER_SYNC message
- [x] **Sync tab: Export JSON** — downloads tabnest_data.json
- [x] **Sync tab: Import JSON** — file picker with Zod validation
- [x] **Shortcuts tab** — reference table of keyboard shortcuts
- [x] **Import/Export tab: Import from Bookmarks (permission request)** — requests `bookmarks` permission on-demand via `chrome.permissions.request`
- [x] **Import/Export tab: Import OneTab format (UI)** — textarea + Import button fires custom event
- [x] **Import/Export tab: Export all data** — downloads JSON
- [x] **Trash tab: List trash items with name and deletion date** — TrashTab renders sorted trash items
- [x] **Trash tab: Restore button per item** — calls `onRestoreTrashItem`
- [x] **Trash tab: Delete permanently button per item** — calls `onDeleteTrashItem`
- [x] **Trash tab: Empty Trash button** — calls `onEmptyTrash`
- [x] **Help tab: Show Onboarding Again button** — calls `onShowOnboarding` which re-opens OnboardingOverlay
- [x] **Debounced auto-save in settings** — 500ms debounce on change via `debounceRef`

---

## Extension Toolbar Popup (spec §12)

- [x] **Shows current tab favicon, title, URL** — PopupApp reads active tab via `chrome.tabs.query`
- [x] **Workspace / Category / Group destination picker** — three SelectField dropdowns
- [x] **"New group" option in group dropdown** — `__new__` sentinel value with inline name input
- [x] **Recently used groups as chips** — loaded from `tabnest_popup_recent_groups` storage key; up to 3 shown
- [x] **"Save Tab" button** — primary CTA; sends SAVE_TABS message
- [x] **"Save & Close" link** — saves then calls `window.close()`
- [x] **"View TabNest" link** — opens newtab.html
- [x] **Sync status dot in popup header** — SyncDot component
- [x] **Cannot-save state for privileged pages** — detects chrome://, about:, chrome-extension:// URLs and shows a locked state
- [x] **Last workspace remembered across sessions** — `tabnest_popup_last_workspace` storage key

---

## Trash / Bin (spec §13)

- [x] **Deleted groups move to Trash** — `deleteTabGroup` in storage.ts creates a TrashItem and writes it
- [x] **TrashItem schema** — TrashItemSchema: id, type, data, original_location, deleted_at
- [x] **Auto-purge items older than 30 days** — `purgeTrashOlderThan(30)` called by daily alarm
- [x] **Restore group from trash** — `restoreFromTrash` in storage.ts handles `type === 'group'`
- [x] **Delete permanently from trash** — `deleteFromTrash` in storage.ts
- [x] **Empty trash** — `emptyTrash` in storage.ts

---

## Chrome Permissions (spec §14)

- [x] **`tabs` permission** — declared in manifest
- [x] **`storage` permission** — declared in manifest
- [x] **`identity` permission** — declared in manifest
- [x] **`contextMenus` permission** — declared in manifest
- [x] **`bookmarks` as optional permission** — declared in manifest `optional_permissions`; requested on-demand
- [x] **`newtab` override** — `chrome_url_overrides.newtab` in manifest
- [x] **`alarms` permission** — declared in manifest (used for sync and trash-purge scheduling)
- [x] **`unlimitedStorage`** — declared in manifest (removes 10MB chrome.storage.local cap)

---

## Background Service Worker (spec §14, §9)

- [x] **MV3 service worker** — background/index.ts; `"type": "module"` in manifest
- [x] **No setInterval/setTimeout for periodic work** — uses `chrome.alarms` exclusively
- [x] **`onInstalled` handler** — runs `migrateIfNeeded`, ensures device_id, registers alarms, creates context menus
- [x] **SAVE_TABS message handler** — creates and saves a new TabGroup
- [x] **GET_ALL_DATA message handler** — returns full storage
- [x] **TRIGGER_SYNC message handler** — calls `runSync`
- [x] **CONNECT_DRIVE message handler** — calls `connectDrive`
- [x] **DISCONNECT_DRIVE message handler** — clears drive metadata, disables sync
- [x] **GET_SYNC_STATUS message handler** — returns SyncMeta
- [x] **DELETE_GROUP message handler** — calls `deleteTabGroup` (moves to trash)
- [x] **MOVE_TO_TRASH message handler** — appends item to trash array
- [x] **RESTORE_FROM_TRASH message handler** — calls `restoreFromTrash`
- [x] **Message validation with Zod** — `ExtensionMessageSchema.safeParse(rawMessage)` before handling
- [x] **Offline detection** — `runSync` checks `navigator.onLine`; sets `pending_sync: true` if offline

---

## First Run Experience (spec §15)

- [x] **3-step onboarding overlay** — OnboardingOverlay with Steps 1, 2, 3
- [x] **Dismissible onboarding** — Skip button on every step; Escape key closes
- [x] **Step 1: Save your first tab** — prompts user to open Active Tabs panel and save a tab
- [x] **Step 1 auto-advances when tab is saved** — App.tsx sets `onboardingTabSaved = true` on successful save; OnboardingOverlay watches `tabSaved` prop and advances to step 2
- [x] **Step 2: Workspace/Category/Group hierarchy explanation** — WorkspaceDiagram component
- [x] **Step 3: Optional Google Drive connect** — Connect Drive button + "Skip for now"
- [x] **Onboarding state persisted** — `onboarding_completed` stored in `chrome.storage.local` separately from main data
- [x] **Re-trigger onboarding from Settings > Help** — HelpTab "Show Onboarding Again" button wired through App.tsx

---

## useStorage Hook

- [x] **Loads storage on mount** — async `load()` call in useEffect
- [x] **Reactive updates via storage change listener** — `chrome.storage.local.onChanged` fires `refetch` when `tabnest_data` key changes
- [x] **Returns loading state** — `loading` boolean; App.tsx shows LoadingPlaceholder while true
- [x] **Returns error state** — `error: Error | null`

---

## Re-audit 2026-07-07 — items verified complete since the 2026-05-11 todo list

Confirmed by direct code evidence on the `componentRefactor` branch.

### Core Tab Management
- [x] **"Open All" opens whole group in one new window** — `handleOpenAll` (App.tsx) uses `chrome.windows.create({ url: urls })` when `open_tab_behavior` is `new_window`; behavior is setting-driven rather than always-new-window (deliberate deviation from spec §6.3)
- [x] **"+ New Group" button in main content area** — GroupGrid renders an inline create form (`onCreateGroup` / `creatingGroup`), also reachable via the `N` shortcut

### Sidebar
- [x] **Category collapse/expand state** — `setCategoryCollapsed` in storage.ts, toggle wired in CategoryList, "All" view filters out collapsed categories (App.tsx)

### Notes
- [x] **Group note editor (plain text)** — NoteEditor.tsx: auto-focus textarea rendered inline below the tabs, used for both group and per-tab notes
- [x] **Auto-save on blur** — NoteEditor saves on blur with no manual save button; re-syncs when the stored value changes externally (e.g. Drive sync)

### Search
- [x] **Search result navigation to group in UI** — `handleSearchNavigate` (App.tsx): group results select their category, category results select themselves, cross-workspace results switch workspace first

### Active Tabs Panel
- [x] **Currently active tab highlighted** — WindowSection.tsx: brand-colored left border, brand text color, and bold weight when `tab.active`
- [x] **Already-saved tabs indicated** — `savedUrls` set marks tabs whose URL is saved anywhere

### Settings & Import
- [x] **Keyboard shortcut `/` opens search** — global keydown in App.tsx (skips editable elements)
- [x] **Keyboard shortcut `N` creates a new group** — global keydown in App.tsx (requires a selected category, skips when overlays open)
- [x] **Import from OneTab — actual processing** — `tabnest:import-onetab` listener in App.tsx parses blocks and saves groups
- [x] **Import from Bookmarks — actual processing** — `tabnest:import-bookmarks` listener in App.tsx converts folders to groups
- [x] **Import conflict mode (Merge / Replace)** — SyncAndDataTab offers Replace vs Append with a pending-import confirmation panel; `mergeImportedData.ts` merges by name and regenerates ids
- [x] **`bookmarks` permission requested on-demand + processing** — both halves now done

### Trash
- [x] **Restore returns to root if parent deleted** — `restoreFromTrash` (storage.ts) falls back to the first available workspace/category instead of throwing

### Error handling
- [x] **Drive sync automatic retry** — `ALARM_RETRY_SYNC` alarm with dedup (clear before create); user-facing retry toast still TODO

---

## Bug fixes 2026-07-07

- [x] **Write queue no longer poisoned by a failed write** — `enqueueWrite` in storage.ts chains new writes onto the previous write whether it settled or rejected, and keeps the queue itself always-settled; the caller's promise still reflects its own write's outcome. Regression test: "recovers after a failed write" in `storage.test.ts`
- [x] **`patchLocalSettings` stale-merge fixed** — the local_settings merge now happens inside the queued work (read-before-write at execution time), so a concurrent local-settings write can't be clobbered
- [x] **"Open in Current Window" for groups** (spec §6.3) — new `openAllTabs(urls, behavior)` helper in `openTab.ts`: `current` adds every tab to the current Chrome window via `chrome.tabs.create({ active: false })` (previously only the last tab survived), `new_window` opens one window with all tabs, `new_tab` opens one tab per URL; App.tsx `handleOpenAll` delegates to it. Covered in `openTab.test.ts`

## workItems branch — 2026-07-08

### Core Tab Management (spec §6.2/§6.3/§17)
- [x] **Open All in Background** — `openAllTabsInBackground` (openTab.ts): one unfocused window with all tabs; kebab menu item
- [x] **Large-group open confirmation** — GroupCard asks before opening >20 tabs (LARGE_OPEN_THRESHOLD)
- [x] **Non-destructive restore toggle** — `delete_group_on_open` setting (General tab): moves group to trash after Open All
- [x] **Duplicate URL warning on save** — single/bulk/manual saves warn and skip URLs already in the target group
- [x] **Hostname fallback for untitled tabs** — `tabTitleOrHostname` (lib/tabTitle.ts), used by newtab saves and context-menu saves
- [x] **Add tab manually via URL** — kebab item + inline input with normalization (`normalizeUrlInput`)

### Group Card actions (spec §3.4/§6.2/§11.5)
- [x] **Move to category** — kebab submenu listing other categories; `moveGroupToCategory` in storage
- [x] **Duplicate group** — `duplicateGroup`: fresh ids, "(copy)" name, appended in place
- [x] **Archive group** — `archiveGroup`: moves into a collapsed "Archive" category created on demand, sets `archived` flag (collapsed = hidden from All view, still searchable)
- [x] **Creation date display** — card footer
- [x] **Note preview** — first line shown italic under the tab list; click opens the editor
- [x] **Within-group tab reorder** — drop a dragged tab on another row of the same group; `reorderTabInGroup`
- [x] **Copy as URL list** — "url | title" lines to clipboard (round-trips with OneTab import)

### Notes system (spec §7)
- [x] **Markdown rendering** — dependency-free subset parser (lib/markdown.ts): #/##/### headers, bold, italic, inline code, lists, checkboxes; rendered by MarkdownNote (components/Notes/)
- [x] **Click-to-edit with auto-save on blur** — MarkdownNote switches preview ↔ textarea; group notes use it (per-tab notes keep the plain NoteEditor)
- [x] **Interactive checkboxes** — toggle from preview without entering edit mode (`toggleCheckbox` edits the source text)
- [x] **Clear checked items** — button appears when any box is checked (`clearCheckedItems`)
- [x] **Standalone notes** — Category.notes (schema v5 + migration), NoteCard rendered alongside groups, "+ New Note" button in category view, storage CRUD (createCategoryNote/saveCategoryNote/deleteCategoryNote)

### Search (spec §8.3)
- [x] **Filter chips** — type toggle chips (Tabs/Groups/Categories) + workspace/category/date-range selects in SearchOverlay; `filterRecords` in lib/search.ts
- [x] **Sort options** — Relevance / Newest / Oldest / A–Z select; `sortRecords`; records carry a `timestamp` (tab saved_at, group created_at)
- [x] **Session filter persistence** — filter/sort state lives outside the isOpen reset, surviving close/reopen

### Active Tabs Panel (spec §4.2/§4.3/§5.1)
- [x] **Multi-select + Save Selected** — checkbox per tab row; "Save N" button in the window header opens the save popover for just the selected tabs
- [x] **Drag active tabs onto group cards and sidebar categories** — drag payload now carries url/title/favicon; GroupCard appends (with dup warning), CategoryList saves a new hostname-named group
- [x] **Sort options** — Window order / By title / By domain select in the panel header; drag-to-reorder disabled while sorted (index math needs browser order)

### Sidebar (spec §3.3)
- [x] **Category color picker** — "Change color…" in the context menu with an 8-swatch palette (`CATEGORY_COLORS`); category color now shown as a dot beside the name; `patchCategory` in storage
- [x] **Category emoji picker** — "Change emoji…" with a 16-emoji grid (`CATEGORY_EMOJIS`)
- [x] **Collapse all groups** — context-menu action collapsing every category (`setAllCategoriesCollapsed`)

### Workspace Management (spec §10)
- [x] **Delete workspace with trash behavior** — trash icon per row in WorkspaceDropdown (hidden for the last workspace), ConfirmDialog, `deleteWorkspace` now moves the workspace to Trash and `restoreFromTrash` handles the 'workspace' type; App falls back to the first remaining workspace if the active one is deleted
- [x] **Create workspace from template** — "Copy categories from …" select in the create form; `createWorkspace(name, templateId)` copies category structure (names/colors/emojis) without groups or notes

### Settings, popup & keyboard (spec §11.2/§11.4/§12)
- [x] **Background setting** — preset swatch picker (color/gradient) in New Tab Page tab; applied to the shell via BACKGROUND_PRESETS
- [x] **Arrow-key navigation on the group list** — arrows move focus between cards when a card is focused (GroupGrid)
- [x] **Popup Enter / Cmd/Ctrl+S** — both save-and-close from anywhere in the popup (buttons/selects keep native Enter)
- [x] **Popup note field** — optional note stored on the SavedTab (spec §12)
- [x] **Alt+T command** — `commands._execute_action` in manifest.json opens the popup
- [x] **Popup untitled-tab fallback** — popup saves now use tabTitleOrHostname too
