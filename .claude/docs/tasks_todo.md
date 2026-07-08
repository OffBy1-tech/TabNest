# tabNest — Tasks TODO

Features and requirements from the specification that are NOT yet fully implemented.
Last updated: 2026-07-07 (re-audited against the post-refactor codebase on `componentRefactor`).
Items verified as complete were moved to `tasks_completed.md` (see its "Re-audit 2026-07-07" section).

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

## Performance

- [ ] **Virtual scrolling for large tab lists** — spec §16: virtual scrolling for 1000+ tab entries; GroupGrid renders everything with no virtualization
- [ ] **`chrome.storage.local` quota error surfaced to user** — spec §16: `unlimitedStorage` makes this rare, but `writeStorage` still throws a typed `QuotaExceededError` and only generic "Failed to save" toasts exist — no quota-specific message is surfaced

---

## Error Handling

- [ ] **Drive sync failure toast with retry button** — spec §17: background auto-retries via `ALARM_RETRY_SYNC` and the sync dot turns red, but there is no user-facing toast with a retry button
- [ ] **Expired OAuth token re-authentication flow** — spec §17: `acquireToken(false)` returns null silently during scheduled sync; no prompt to re-authenticate

---

---

