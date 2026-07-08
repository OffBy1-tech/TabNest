# tabNest — Tasks TODO

Features and requirements from the specification that are NOT yet fully implemented.
Last updated: 2026-07-07 (re-audited against the post-refactor codebase on `componentRefactor`).
Items verified as complete were moved to `tasks_completed.md` (see its "Re-audit 2026-07-07" section).

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

