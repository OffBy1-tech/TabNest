# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For full project documentation, see [`.claude/docs/TabNest_Specification.md`](.claude/docs/TabNest_Specification.md).

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

### Storage layer (`src/lib/storage.ts`)

**Only this module calls `chrome.storage` directly.** All other code uses the exported functions. Key contracts:

- `writeStorage(patch)` is the only write path — it reads-before-writes and uses a serial `writeQueue` Promise chain to prevent concurrent-write races.
- Writing `workspaces`, `settings`, or `trash` auto-bumps `sync_meta.last_modified_at` for Drive conflict resolution. `local_settings` and `sync_meta` writes do not bump it.
- `migrateIfNeeded()` runs once on `onInstalled`. Add new migrations to the `MIGRATIONS` table keyed by the **source** version. Current schema: v2.

### Message passing

The UI sends typed messages defined in `ExtensionMessageSchema` (discriminated union). The background validates every message with `ExtensionMessageSchema.safeParse` before handling. Responses always follow `MessageResponse<T>: { ok: true; data: T } | { ok: false; error: string }`.

### Hooks

- `useStorage` — subscribes to `chrome.storage.local.onChanged` so the UI re-renders whenever storage changes. Returns `{ data, loading, error, refetch }`.
- `useTabs` — thin wrapper over `chrome.runtime.sendMessage` for `SAVE_TABS` and `DELETE_GROUP`.

### Drive sync

The service worker handles all Drive I/O. Sync runs on `chrome.alarms` (never `setInterval`). Conflict resolution is last-write-wins by `last_modified_at` timestamp. The remote file is Zod-validated before any local overwrite. `local_settings` and `backup_local` are stripped from every Drive write.

### Styling

CSS custom properties are defined in `src/styles/tokens.css`. Use `var(--token-name)` for all colors, spacing, and typography — **do not use raw Tailwind classes for these values**. Tailwind is available but the design system lives in the token file.

### Path alias

`@/` maps to `./src/` in both Vite and TypeScript configs.

### Key dependencies

- **dnd-kit** — drag-and-drop for category reordering and tab moving
- **Fuse.js** — fuzzy search (`src/lib/search.ts` wraps it; note content is intentionally excluded from the index)
- **Zod** — runtime validation at storage read/import/Drive boundaries (not in the hot read path)
- **Storybook** — every component has a `.stories.tsx` file; stories double as browser-based Vitest tests via `@storybook/addon-vitest`
