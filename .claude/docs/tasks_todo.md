# tabNest — Tasks TODO

Features and requirements from the specification that are NOT yet fully implemented.
Last updated: 2026-07-07 (re-audited against the post-refactor codebase on `componentRefactor`).
Items verified as complete were moved to `tasks_completed.md` (see its "Re-audit 2026-07-07" section).

---

## Core Tab Management

- [ ] **"Open All in Background"** — no implementation; spec §6.3 requires opening all tabs in a new window while staying focused on the current window (`chrome.windows.create({ focused: false })`)
- [ ] **Large group open-all confirmation dialog** — spec §17 requires a confirmation dialog when opening more than 20 tabs at once; `handleOpenAll` in App.tsx has no such guard
- [ ] **Non-destructive restore toggle** — opening a group never deletes it (non-destructive is now the only behavior), but the spec §6.3 setting to toggle auto-delete-on-restore does not exist
- [ ] **Duplicate URL warning on save** — spec §17: warn when a URL already exists in the same group. Partial progress: the Active Tabs panel dims tabs whose URL is already saved anywhere (`savedUrls` in WindowSection.tsx), but there is no warning at save time for duplicates within a group
- [ ] **Tab with no title fallback** — spec §17: display URL hostname as title. Context-menu *group names* use hostname (background/index.ts:144), but the saved tab title still falls back to the raw URL (`tab.title ?? url`), not the hostname
- [ ] **Add tab manually via URL** — spec §6.2: "+ button to enter a URL manually" within a group; no such input exists on group cards

---

## Group Card — Missing Actions

KebabMenu still only has Open All / Rename / Delete.

- [ ] **Move group to different category** — spec §6.2 / §3.4: "Move to category" menu option; no menu item or storage function
- [ ] **Duplicate group** — spec §6.2 / §3.4: creates a copy in the same category; no option or storage function
- [ ] **Archive group** — spec §6.2: moves group to a special Archive category; `archived` field exists on TabGroupSchema but no archive logic in storage or UI
- [ ] **Group creation date display** — spec §3.4: each group card shows creation date; not rendered in GroupCard
- [ ] **Inline notes preview on group card** — spec §3.4: "optional note preview". Partial: the sticky-note icon is highlighted when a note exists and toggles an inline editor, but no preview text is shown on the card itself
- [ ] **Reorder tabs within a group via drag** — spec §6.2: TabRow is draggable but drops only move tabs *between* groups (`onMoveTab`); no within-group reordering
- [ ] **Export group as URL list** — spec §11.5: export a single group as a text list of URLs; no menu item or export function

---

## Notes & To-Dos

A plain-text note editor now exists (NoteEditor.tsx: auto-focus textarea, saves on blur, group + per-tab notes). The rest of the spec's note system is unbuilt:

- [ ] **Markdown rendering** — spec §7.2: rendered preview with bold, italic, inline code, headers, lists, checkboxes; editor is a plain textarea, no Markdown renderer installed
- [ ] **Standalone Note** — spec §7.1: a card in a category with no associated tabs; no creation path, rendering, or storage operation
- [ ] **Interactive checkboxes in notes** — spec §7.3: click to toggle checked state without entering edit mode; not implemented
- [ ] **"Clear checked items" option** — spec §7.3: removes all completed checklist items from a note; not implemented

---

## Search

- [ ] **Filter chips** — spec §8.3: filter by workspace, category, date range, type (tab / group / category); no filter UI in SearchOverlay
- [ ] **Sort options in search** — spec §8.3: Relevance, Newest, Oldest, A-Z; no sort controls
- [ ] **Active filter persistence for the session** — spec §8.3; n/a until filters exist

---

## Active Tabs Panel

- [ ] **"Save Selected" with multi-select checkboxes** — spec §4.2: checkbox multi-select then bulk save; no checkbox or multi-select logic in WindowSection
- [ ] **Drag active tabs into sidebar category or group card** — spec §4.2 / §5.1: `ACTIVE_TAB_DRAG_TYPE` exists but is only produced and consumed inside WindowSection (within-panel reorder); GroupCard and CategoryList do not accept it
- [ ] **Sort options for active tabs** — spec §4.3: sort by domain, by window, by title; no sort controls

---

## Sidebar — Category Management

The sidebar ContextMenu still only has Rename / Delete.

- [ ] **Category color picker** — spec §3.3: `color` field exists on CategorySchema but no "Change color" menu option
- [ ] **Category emoji picker** — spec §3.3: emoji is rendered in the list but there is no "Change emoji" option
- [ ] **"Collapse all groups" in category context menu** — spec §3.3: not in context menu

---

## Sync — Google Drive

> **Decision (2026-07):** TabNest stays on the hidden `appDataFolder` space with the
> `drive.appdata` OAuth scope. The spec §9.1/§9.3 items calling for a visible
> "TabNest Backups" folder and the `drive.file` scope are intentionally not being
> implemented — the spec should be updated to match.

- [ ] **Drive revision history / restore from backup** — spec §9.2 / §11.3: show last 10 versions in Settings > Restore; no restore-from-revision UI in SyncAndDataTab
- [ ] **Multi-device pull on load** — spec §9.2: opening TabNest on a second device pulls latest Drive data on load; `chrome.runtime.onStartup` only rebuilds context menus, sync is still alarm/manual only
- [ ] **Offline change queue visible feedback** — spec §9.2: `pending_sync` flag is set but SyncStatusDot only knows idle/syncing/error — no "changes pending sync" indicator

---

## Settings

- [ ] **Background setting** — spec §11.2 (as amended 2026-07): solid color or gradient preset for the new tab background — no image upload; schema field exists, UI not yet built
- [ ] **Keyboard shortcut `Arrow keys` on group list** — spec §11.4: arrow keys navigate the group list; GroupCard handles E/Delete/Enter when focused but GroupGrid has no arrow-key navigation between cards
- [ ] **Keyboard shortcut `Cmd/Ctrl+S` / `Enter` in popup** — spec §11.4 / §12: PopupApp has no keydown handlers; Enter does not submit the save form
- [ ] **`Alt+T` keyboard shortcut** — spec §11.4 / §5.2: open the popup from any page; manifest.json has no `commands` key

---

## Workspace Management

- [ ] **Delete workspace with trash behavior** — spec §10: confirmation + move contents to Trash. `deleteWorkspace` in storage.ts still hard-deletes, and there is no delete option in WorkspaceDropdown at all
- [ ] **Create workspace from template** — spec §10: optionally copy categories from an existing workspace; create flow only accepts a name

---

## Toolbar Popup

- [ ] **"Add note" field on saved tab** — spec §12: optional note attached to the saved tab; PopupApp has no note input

---

## Trash

- [ ] **Original location shown in trash UI** — spec §13: TrashTab shows type badge and deletion date but not the original workspace/category name

---

## First Run Experience

- [ ] **Default "Getting Started" category with welcome group** — spec §15: `DEFAULT_WORKSPACE()` still creates a "General" category with no groups
- [ ] **Example tabs in welcome group** — spec §15: TabNest help page and keyboard shortcuts links; not created on install

---

## Performance

- [ ] **Virtual scrolling for large tab lists** — spec §16: virtual scrolling for 1000+ tab entries; GroupGrid renders everything with no virtualization
- [ ] **`chrome.storage.local` quota error surfaced to user** — spec §16: `unlimitedStorage` makes this rare, but `writeStorage` still throws a typed `QuotaExceededError` and only generic "Failed to save" toasts exist — no quota-specific message is surfaced

---

## Error Handling

- [ ] **Drive sync failure toast with retry button** — spec §17: background auto-retries via `ALARM_RETRY_SYNC` and the sync dot turns red, but there is no user-facing toast with a retry button
- [ ] **Expired OAuth token re-authentication flow** — spec §17: `acquireToken(false)` returns null silently during scheduled sync; no prompt to re-authenticate

---

---

