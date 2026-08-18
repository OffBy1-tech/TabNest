# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For full project documentation, see [`docs/TabNest_Specification.md`](docs/TabNest_Specification.md). The docs index is [`docs/README.md`](docs/README.md) — when a feature ships, fold its plan's durable decisions into the spec/CLAUDE.md, mark the plan `status: shipped`, move it to `docs/archive/`, and update the index (see `docs/CONVENTIONS.md`).

## Commands

```bash
npm run dev          # Vite dev server (non-extension context, limited chrome.* APIs)
npm run build        # Production build → dist/ (runs inject-oauth.js post-step)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint on src/
npm test             # Vitest (jsdom + Storybook/Playwright browser tests)
npm run storybook    # Component explorer on :6006
```

Run a single test file:
```bash
npx vitest run src/popup/popupStorage.test.ts
```

### Loading the extension in Chrome

After `npm run build`, go to `chrome://extensions`, enable Developer Mode, and load the `dist/` folder as an unpacked extension.

### Drive sync (optional)

Copy `.env.example` → `.env.local` and set `TABNEST_OAUTH_CLIENT_ID`. The build script (`scripts/inject-oauth.js`) injects it into `dist/manifest.json`. Without it, the Drive sync UI is present but auth will fail.

## Architecture

tabNest is a **Chrome MV3 extension** built with React + TypeScript + Vite. It has three execution contexts that communicate via `chrome.runtime.sendMessage`:

| Context | Entry point | Purpose |
|---|---|---|
| New tab page | `src/newtab/` | Full-featured tab manager UI |
| Popup | `src/popup/` | Compact quick-save UI |
| Service worker | `src/background/index.ts` | Persistence, Drive sync, alarms, context menus |

### Data model (`src/lib/schema.ts`)

All types are **Zod schemas with TypeScript types inferred from them**. The hierarchy is:

```
StorageSchema
  workspaces: Workspace[]
    categories: Category[]
      groups: TabGroup[]
        tabs: SavedTab[]
        notes: Note[]
  settings: UserSettings      ← synced to Drive
  local_settings: LocalSettings  ← device-only, never written to Drive
  sync_meta: SyncMeta
  trash: TrashItem[]
```

`UserSettings` and `LocalSettings` are intentionally separate — never merge fields between them. `local_settings` (sync toggle, interval) stays in `chrome.storage.local` and is stripped before any Drive write.

`Category.collapsed` is **synced**, despite the name — it is the "hide this category from the All view" filter behind CategoryList's Eye toggle (read by `App.tsx` to pick what the All view shows), not device-local viewport state. Reading it as viewport state is why it was initially left out of the sync fixes in PR #20 — check the Eye toggle before assuming from the name.

### Storage layer (`src/lib/storage.ts`)

**Only this module calls `chrome.storage` directly.** All other code uses the exported functions. Key contracts:

- `writeStorage(patch)` is the only write path — it reads-before-writes and uses a serial `writeQueue` Promise chain to prevent concurrent-write races. An updater returning `null` skips the write entirely; use it for no-op edits, or a full document write plus a Drive push gets scheduled for a change that changed nothing.
- Writing `workspaces`, `settings`, or `trash` auto-bumps `sync_meta.last_modified_at` for Drive conflict resolution. `local_settings` and `sync_meta` writes do not bump it.
- **The mutation contract.** Any helper that changes a synced *scalar* on an existing entity must bump the `updated_at` that its merge level compares, or the merge discards the edit on every other device — silently, with no type error. Tabs and notes have no comparison key of their own (`unionById` is first-wins), so a tab-note edit bumps its **group** and a standalone-note edit its **category**. `src/lib/storageContract.test.ts` enforces this: every export of `storage.ts` must appear in its `CONTRACTS` table, classified `edit` / `create` / `delete` / `restore` / `move` / `trash` / `not-workspace`. **Adding an export fails CI until you classify it** — that is the guard working, not a broken test. This class of bug shipped six times before the table existed (issue #22).
- `migrateIfNeeded()` runs once on `onInstalled`. Add new migrations to the `MIGRATIONS` table keyed by the **source** version. Current schema: v7.
- Backup snapshots live under a separate device-only `tabnest_backups` key — never in the hot `tabnest_data` document, never synced or exported. Access only via `pushLocalBackup` / `readLocalBackups` / `restoreLocalBackup`.

### Message passing

The UI sends typed messages defined in `ExtensionMessageSchema` (discriminated union). The background validates every message with `ExtensionMessageSchema.safeParse` before handling. Responses always follow `MessageResponse<T>: { ok: true; data: T } | { ok: false; error: string }`.

### Hooks

- `useStorage` — subscribes to `chrome.storage.local.onChanged` so the UI re-renders whenever storage changes. Returns `{ data, loading, error, refetch }`.
- `useTabs` — thin wrapper over `chrome.runtime.sendMessage` for `SAVE_TABS` and `DELETE_GROUP`.

### Drive sync

The service worker handles all Drive I/O. Sync runs on `chrome.alarms` (never `setInterval`). Every sync cycle union-merges workspaces and trash by entity id (`src/lib/merge.ts` — `mergeSyncedState`), with deletions propagated via trash tombstones; settings are last-write-wins by `last_modified_at`. There is deliberately **no timestamp-based "local wins" fast path** — `last_modified_at` comparison cannot detect that remote changed concurrently, and a blind push wipes the other device's tombstones from Drive (the restore-then-redelete smoke-test bug). `src/lib/syncPlan.ts` (`planSync`) is the pure, unit-tested decision: what to write locally, whether to push, whether to adopt remote's `last_modified_at` (anti-ping-pong), and whether to snapshot a backup first. Where an entity exists on both sides, the copy with the newer `updated_at` wins its scalar fields — `newerFirst` is the single definition of that rule at every level, and ties go to local (which is only safe because mutations bump correctly — see the mutation contract above). Before a merge is applied, the local workspaces are snapshotted into `backup_generations` (last 3, deduped — see `pushLocalBackup`). Backups are browsable in Settings → Sync & Data (Local backups): semantic diff between any two snapshots or against current state (`src/lib/diff.ts`), with whole-snapshot restore (`restoreLocalBackup`). The remote file is Zod-validated before any local overwrite. `local_settings` and `backup_local` (legacy) are stripped from every Drive write; backup snapshots live outside the synced document entirely (`tabnest_backups` key).

### Styling

CSS custom properties are defined in `src/styles/tokens.css`. Use `var(--token-name)` for all colors, spacing, and typography — **do not use raw Tailwind classes for these values**. Tailwind is available but the design system lives in the token file.

### Path alias

`@/` maps to `./src/` in both Vite and TypeScript configs.

### Key dependencies

- **dnd-kit** — drag-and-drop for category reordering and tab moving
- **Fuse.js** — fuzzy search (`src/lib/search.ts` wraps it; note content is intentionally excluded from the index)
- **Zod** — runtime validation at storage read/import/Drive boundaries (not in the hot read path)
- **Storybook** — every component has a `.stories.tsx` file; stories double as browser-based Vitest tests via `@storybook/addon-vitest`
