# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.4] - 2026-08-19

Tooling only. No extension behavior changed.

### Changed

- Formatting is now enforced by ESLint via `@stylistic/eslint-plugin`,
  configured to the codebase's existing conventions (2-space indent, single
  quotes, semicolons, 1TBS braces, parenthesized arrow args). The repo-wide
  auto-fix removed the stray leading-`;(` statements, repaired genuinely broken
  indentation, and normalized quotes and spacing. `npx eslint src --fix`
  reapplies the style; no Prettier.

## [1.1.3] - 2026-08-17

Public open-source release preparation. No extension behavior changed.

### Added

- `CONTRIBUTING.md`: reporting guidelines, development setup, the architecture
  contracts a change must respect, PR checklist, and the release procedure.
- Continuous integration (`.github/workflows/ci.yml`): typecheck, lint, the full
  Vitest suite with coverage, and a production build on every push and pull
  request, publishing the coverage report and README badge to GitHub Pages.
- Docs index at `docs/README.md`, and an `npm run coverage:badge` script.

### Fixed

- `npm run dev` no longer dies at browser launch. The extension `key` is now
  inserted at build time rather than living in the checked-in manifest as an
  invalid `__GOOGLE_EXTENSION_KEY__` placeholder, which Chrome rejected.
- A build with no OAuth credentials configured no longer emits a `dist/` that
  Chrome refuses to load; `scripts/inject-oauth.js` warns and continues instead
  of exiting early with the placeholders left in place.

### Changed

- The checked-in `manifest.json` carries a `0.0.0` version placeholder;
  `package.json` remains the only source of truth, written into the manifest at
  build time.
- Project docs moved out of `.claude/docs/` into `docs/`, so `.claude/` holds
  agent configuration only. The archived design records (`docs/archive/`) are
  tracked in the repo again.
- `.env.example` documents both build-time variables and what breaks without
  them.
- Specification §9 corrected to match shipped behavior: the `drive.appdata`
  scope, the 15-minute default sync interval, and union-merge conflict
  resolution.

## [1.1.2] - 2026-08-12

### Added

- Storage mutation contract test (`src/lib/storageContract.test.ts`): every
  export of `storage.ts` must be classified against the sync-merge contract it
  owes (`edit` / `create` / `delete` / `restore` / `move` / `trash` /
  `not-workspace`), so the "changed synced state without bumping the timestamp
  the merge compares" class of bug — shipped silently six times before — now
  fails CI instead. (#22)

### Fixed

- Group renames now survive sync: `renameGroup` bumps the group's
  `updated_at`, so the merge no longer keeps the other device's stale name.
- Workspace renames now survive sync. Workspaces gained an `updated_at` that
  the merge compares; previously the remote copy unconditionally won, so a
  local rename could never propagate.
- Category-note edits now converge instead of ping-ponging between devices:
  saving, creating, or deleting a standalone category note bumps the
  category's `updated_at` (the timestamp the notes merge actually compares).
- Category drag-reorders now persist the `order` field and bump `updated_at`,
  so the next sync merge no longer snaps the drag back.
- The "Hide from All view" (Eye) toggle is now properly synced: both setters
  bump the category's `updated_at`, so visibility propagates deliberately
  rather than only as a side effect of unrelated edits. (#21)
- Moving or archiving a group no longer lets a stale remote resurrect the
  pre-move copy in the old category: the sync merge now dedupes group ids
  across categories, keeping exactly one copy (newer-touched wins, the losing
  copy's tabs and notes are unioned in so concurrent saves are never lost).
  (#17)
- No-op edits (renaming to the same name, dropping a category back in place)
  now skip the storage write entirely instead of rewriting the whole document
  and scheduling a Drive push.

### Changed

- The two-device sync smoke test procedure was extended to cover the 1.1.x
  sync semantics (tombstones at every level, restore re-stamping, move
  dedupe, and the theme-toggle desync path).

## [1.1.1] - 2026-08-07

Version-scheme correction release; same functionality as 1.1.0. The version
was briefly set to 0.1.1 to follow the Chrome Web Store submission (0.1.0),
then corrected to 1.1.1 to continue the repo's 1.x line — which still
strictly exceeds the store version and shipped the PR #18 audit fixes to the
store.

### Changed

- Archived planning docs (`.claude/docs/archive/`) are no longer tracked in
  the repo; documented Node requirement bumped to 24+.

## [1.1.0] - 2026-08-07

### Added

- Local backups UI in Settings → Sync & Data: browse the generational
  pre-overwrite backup snapshots, view a semantic diff between any two
  snapshots or against current state (workspace → category → group →
  tab/note tree), and restore a whole snapshot (reversibly — the pre-restore
  state is itself snapshotted first).
- Generational local backups: before a sync merge overwrites local data, the
  current workspaces are snapshotted into `backup_generations` (last 3 kept,
  deduped), replacing the old single-shot `backup_local`.
- Two-device sync smoke test procedure (docs).
- Docs index and lifecycle conventions (`.claude/docs/`).

### Changed

- Sync conflict resolution rewritten: instead of remote-wins overwrite,
  workspaces and trash are union-merged by entity id on every conflicting
  sync, with deletions propagated via trash tombstones and the newer
  `updated_at` winning scalar fields.
- Backup snapshots moved out of the synced document into their own
  device-only `tabnest_backups` storage key (schema v7). They are never
  synced to Drive and are excluded from JSON export.
- All `chrome.storage` access now goes through the storage layer
  (`src/lib/storage.ts`), and all writes go through the serial write queue;
  device-only key stripping before Drive writes is centralized.
- Runtime messaging unified behind one typed `sendExtensionMessage` helper;
  context menus rebuild only when ids/names actually change instead of
  serializing the whole document on every write.

### Fixed

Code-review audit pass — 32 findings fixed (see `CODE_REVIEW_AUDIT.md`),
highlights:

- Every delete and restore path now honors the sync tombstone contract, so a
  merge-path sync no longer resurrects deletions or re-deletes restores
  across devices. Deleting a category now moves it to Trash (restorable),
  removed tabs are restorable, and restoring from Trash re-stamps timestamps
  past the tombstone.
- Every storage mutation is now atomic: helpers compute their patch inside
  the write queue against the freshest document, so concurrent mutations
  (e.g. a context-menu save racing a rename) no longer clobber each other.
- The popup's "save to existing group" no longer creates a duplicate group —
  saves append to the chosen group with real ids and real ordering, and the
  Recent-group chips actually match on subsequent saves.
- Import fixes: appending an import no longer silently drops standalone
  notes when a category name matches; the OneTab import awaits its saves and
  reports what actually landed instead of always claiming success; import
  errors now surface inline in Settings.
- Theme has a single source of truth (`settings.theme`): the TopBar toggle no
  longer fights synced settings, and an existing device-local theme choice is
  migrated in.
- The popup no longer shows "No workspaces" with Save disabled on a fresh
  profile.
- "Manual only" sync interval now actually stops the periodic sync alarm
  (previously the old alarm kept running, and install/reconnect defaulted it
  back to 5 minutes).
- Popup clipping caused by `content-visibility` containment: group kebab
  menus, the per-tab save popover, and confirm dialogs are no longer cut off
  (containment is lifted only while a popup is open, keeping the
  render-skipping win).
- A failed migration can no longer persist a document state that dropped the
  only copy of the local backups.

## [1.0.6] - 2026-07-13

### Added

- Notes system: Markdown rendering (headers, bold/italic, inline code,
  lists), interactive checkboxes toggleable from the preview, and standalone
  notes at the category level (schema v5).
- Group card actions: Move to category, Duplicate, Archive, and Copy as URL
  list (round-trips with OneTab import); tab reordering within a group;
  creation date and note preview on cards.
- Core tab management: Open All in Background, confirmation before opening
  >20 tabs, duplicate-URL warnings on save, add a tab manually by URL, and
  an optional "delete group on open" setting.
- Search: filter chips with workspace, category, type, and date-range
  filters, plus sort options (relevance/newest/oldest/A-Z).
- Active Tabs panel: multi-select save per window, cross-panel drag to
  groups and categories, and sort options.
- Sidebar: category color and emoji pickers, category color dot, and
  "Collapse all groups" in the context menu.
- Workspaces: delete to Trash with confirmation (recoverable), and create a
  new workspace from an existing one's category structure.
- Settings, popup & keyboard: new-tab background presets (colors/gradients),
  arrow-key navigation between group cards, popup save via Enter or
  Cmd/Ctrl+S with an optional note, and an Alt+T shortcut to open the popup.
- Trash rows show the item's original "Workspace > Category" location;
  fresh installs get a "Getting Started" category with example content.
- Drive sync UX: restore from the sync file's last 10 Drive revisions, pull
  on browser/new-tab load, and an amber "changes pending sync" indicator.
- Error handling: sync-failure toast with a Retry action, a clear reconnect
  prompt when the Drive token expires, and "storage is full" messages on
  quota errors.
- Unit tests for the core lib modules (storage, search, schema, merge,
  safeUrl).

### Security

- Opening saved tabs now allowlists http(s) URLs, so synced or imported data
  can't open `javascript:`/`data:`/`file:`/`chrome:` URLs.
- Favicons are routed through Chrome's local `_favicon` service (new
  `favicon` permission), so a crafted favicon URL can't fire a tracking
  beacon.
- Tightened the extension CSP; network egress is restricted to
  googleapis.com.
- JSON import only accepts workspaces/settings/trash — never `sync_meta` or
  `local_settings` — so a malicious "backup" file can't forge a future
  sync timestamp and wipe other devices.

### Fixed

- Sync reliability: an in-flight lock prevents concurrent `runSync` runs from
  clobbering newer remote data; disconnecting Drive resets `last_sync_at` so
  reconnecting re-enters the safe union-merge path; merges union tabs and
  notes by id so first-connect/reconnect never drops content.
- A failed storage write (e.g. quota error) no longer permanently poisons the
  write queue, and concurrent local-settings writes no longer clobber each
  other.
- "Open all in current window" now opens every tab instead of keeping only
  the last one.
- Fixed a Chrome API accessor error.

### Changed

- Performance: offscreen group cards, note cards, and active-tab rows skip
  rendering via `content-visibility: auto`; memoized data derivations in the
  newtab and popup apps; ESLint fully clean.

## [1.0.5] - 2026-06-25

### Changed

- `package.json` is now the single source of truth for the version: the
  build writes it into `manifest.json`, and the Settings modal displays the
  manifest version.
- Added `.nvmrc` pinning Node 24; removed the default Storybook example
  components.

### Fixed

- Fixed `tsc` build errors.

## [1.0.4] - 2026-06-23

### Changed

- Project-wide component refactor: every file that previously held multiple
  React components was split so each component lives in its own file. This
  covers `GroupCard`, `SettingsModal`, `CategoryList`, `ActiveTabsPanel`,
  `TopBar`, `OnboardingOverlay`, and the new-tab and popup roots. Shared
  helpers, hooks, and style objects were extracted into dedicated modules
  (e.g. `mergeImportedData`, `useActiveTabs`, `openTab`, `popupStorage`).
- Migrated ESLint to the flat-config format (`eslint.config.js`) for ESLint
  9/10 and removed the legacy `.eslintrc.json`.

### Added

- Unit test suite (Vitest + Testing Library on jsdom) covering the split
  components and the extracted logic modules.
- A Storybook story for every extracted component, rendered in a real browser
  via the Storybook + Playwright Vitest project.
- Test-coverage tooling: `npm run coverage` (all projects) and
  `npm run coverage:unit` (jsdom only), writing an HTML + JSON report to
  `coverage/`.

### Fixed

- Cleared numerous pre-existing TypeScript errors in the refactored files
  (focus-trap index assertions, `exactOptionalPropertyTypes` prop widening,
  and stale Storybook prop types).

## [1.0.3] - 2026-06-23

### Added

- The left sidebar can now be resized so full category names are visible.

### Fixed

- Opening a saved tab with the "New window" behavior now opens a real Chrome
  window with its toolbar intact, instead of dropping the toolbar.

## [1.0.2] - 2026-06-08

### Changed

- Switched Google Drive sync back to using `drive.appdata` storage.

### Added

- Remember the last group a tab was saved to and preselect it for the next save.

### Fixed

- Improved data diffing during sync.

## [1.0.0] - 2026-06-05

- Initial release.
