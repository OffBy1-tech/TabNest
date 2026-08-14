> status: shipped 2026-08-06 (PR #8) — design record, retired; the code is the truth.

# Backup Diff & Restore — Design

**Status:** approved 2026-08-06 (brainstormed with the maintainer; all scope choices below were explicit decisions)

## Purpose

Surface the generational local backups (`backup_generations`, added for issue #5) in the UI, let the user visually diff any two snapshots — including the current state — and restore a whole snapshot. Motivated by the Aug 2026 'scratch' incident: the answer to "what exactly would I lose/regain?" must be visible before any restore.

## Scope decisions (locked)

| Decision | Choice |
|---|---|
| Diff sources | Local `backup_generations` (≤3) + current workspaces only. Drive revisions are NOT diffable (possible follow-up). |
| Presentation | Semantic tree diff over the workspace → category → group → tab hierarchy, not a JSON/text diff. |
| Restore | Whole-snapshot restore included, reversible. Selective (per-group) restore is out of scope. |
| Location | New "Local backups" section inside Settings → Sync & Data tab, next to the Drive "Restore from backup" section. |
| Engine | Pure diff module `src/lib/diff.ts`, mirroring how `merge.ts` is factored (no chrome deps, fully unit-testable). No new dependencies, no new message types, no service-worker changes. |

## 1. Diff engine — `src/lib/diff.ts`

Pure functions; keyed by entity id at every level (same convention as `merge.ts`).

```ts
export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged'

/** A scalar field that changed between the two sides. */
export interface FieldChange {
  field: string        // 'name' | 'title' | 'url' | 'note' | 'content' | 'color' | 'emoji'
  before: string
  after: string
}

export interface TabDiff {
  status: DiffStatus            // leaves — no children, but can be 'modified'
  tab: SavedTab                 // the after-side copy, or before-side if removed
  fieldChanges: FieldChange[]   // title / url / note changes (status 'modified')
}

export interface NoteDiff {
  status: DiffStatus
  note: Note
  fieldChanges: FieldChange[]   // content change (status 'modified')
}

export interface GroupDiff {
  status: DiffStatus
  group: TabGroup
  fieldChanges: FieldChange[]   // name
  tabs: TabDiff[]
  notes: NoteDiff[]
}

export interface CategoryDiff {
  status: DiffStatus
  category: Category
  fieldChanges: FieldChange[]   // name / color / emoji
  groups: GroupDiff[]
  notes: NoteDiff[]             // standalone category notes
}

export interface WorkspaceDiff {
  status: DiffStatus
  workspace: Workspace
  fieldChanges: FieldChange[]   // name
  categories: CategoryDiff[]
}

export function diffWorkspaces(before: Workspace[], after: Workspace[]): WorkspaceDiff[]
```

Semantics:
- **added** — id exists only on the after side; **removed** — only on the before side. Added/removed nodes list ALL their children with the same status (so a removed group shows every lost tab).
- **modified** — id on both sides AND (own scalar fields differ OR any descendant is not `unchanged`).
- **unchanged** — id on both sides, deep-equal content. Unchanged nodes ARE included in the output (the UI collapses them); their children arrays may be empty as an allowed optimization since the UI never expands an unchanged subtree.
- Ignored fields: `order`, `collapsed`, `archived`, `created_at`, `updated_at`, `saved_at`, `favicon` — position/presentation/timestamp churn is noise for "what data differs". Only the fields listed per node type above are compared.
- **Moves are not detected**: a group moved between categories appears as removed in one category and added in the other. Documented limitation; keeps the engine simple.
- Output ordering: after-side order first, then before-side-only entries appended — stable and deterministic.

Also exported for the list UI:

```ts
/** Cheap summary for a snapshot row: counts of workspaces, groups, tabs. */
export function snapshotStats(workspaces: Workspace[]): { workspaces: number; groups: number; tabs: number }
```

## 2. UI — `src/components/Settings/`

### `BackupsSection.tsx`

Rendered by `SyncAndDataTab` under a "Local backups" heading, directly after the Drive restore section. Props: `{ currentWorkspaces: Workspace[] }` (SyncAndDataTab already receives `workspaces`). Loads generations itself via `readLocalBackups()` on mount (and re-reads after a restore).

- **List**: one row per generation — "Backup 1 · Aug 3, 2026 9:45 PM · 3 workspaces · 12 groups · 214 tabs" plus a ghost "Restore" button. A generation with `saved_at === 0` renders "unknown time (migrated)".
- **Compare picker**: two `<select>`s labeled Compare (A) and with (B). Options: `Current` + every generation. Defaults: A = newest generation, B = Current. Selecting the same snapshot on both sides is allowed and yields the "No differences" state.
- **Diff**: `diffWorkspaces(A, B)` computed via `useMemo`, rendered inline below by `DiffTree`. A is `before`, B is `after` (so with defaults, additions = things current has that the backup lacks).
- **Empty state** (no generations): "No local backups yet. A backup is saved automatically before a sync overwrite or revision restore."
- Non-extension context (`npm run dev`): `readLocalBackups` resolves against defaults → empty state; no crash.

### `DiffTree.tsx`

Pure presentational: `{ diff: WorkspaceDiff[] }`. No storage access — trivially storybook-able.

- Collapsible rows per node (reusing the chevron pattern from the sidebar), workspaces and categories expanded by default when `modified`, collapsed when `unchanged` (single row, muted "unchanged" label, not expandable).
- Status rendering: `+` prefix and `var(--color-success)` for added; `−` and `var(--color-danger)` for removed; `~` and `var(--color-warning)` for modified. Field changes render as `name: "To read" → "Reading list"` on an indented line.
- Long tab lists inside an added/removed group truncate at 10 with "… N more" (expandable).
- All colors/spacing/typography from `tokens.css` variables — no raw Tailwind color classes (project rule).
- Top-level "No differences between these snapshots." state when every workspace is `unchanged`.

## 3. Restore — `restoreLocalBackup` in `src/lib/storage.ts`

```ts
/**
 * Replace current workspaces with backup generation `index` (0 = newest).
 * The current workspaces are pushed as a new generation first, so a restore
 * is itself undoable. Settings and trash are untouched (backups don't
 * contain them). Throws if the index doesn't exist.
 */
export async function restoreLocalBackup(index: number): Promise<void>
```

Order of operations: read snapshot into memory → `pushLocalBackup(currentWorkspaces)` → `writeStorage({ workspaces: snapshot })`. The `writeStorage` call bumps `last_modified_at`, so the restored state wins the next sync cycle and propagates to Drive (local-wins push). Eviction of the source generation by the cap-3 push is harmless — the snapshot is already held in memory and becomes the live state.

UI flow: "Restore" button → existing `ConfirmDialog` — "Replace your current workspaces with the backup from {date}? Your current state will be saved as a new backup first. Settings and Trash are not affected." On success the section re-reads generations and shows a transient "Restored." notice (same pattern as the Drive revision restore).

## 4. Error handling & edge cases

- Restore with a stale index (list changed underneath): `restoreLocalBackup` throws; UI shows the error inline and re-reads the list.
- Diffing identical snapshots, diffing a snapshot against itself, empty workspaces on either side: all fall out of the engine naturally; UI has explicit "No differences" copy.
- `useStorage`-driven re-render: `SyncAndDataTab` already re-renders on storage change, so after restore the rest of the app (new tab grid) updates automatically.
- Quota: restore performs one extra `pushLocalBackup` write; bounded by the existing cap of 3 generations.

## 5. Testing

- `src/lib/diff.test.ts`: per-level added/removed/modified/unchanged; field-change extraction (rename, tab note edit, category color); ignored-field churn produces `unchanged`; removed-group-lists-all-tabs; deterministic ordering; `snapshotStats`.
- `src/lib/storage.test.ts`: `restoreLocalBackup` replaces workspaces, pushes the pre-restore state as a generation first, bumps `last_modified_at`, throws on bad index.
- `BackupsSection.stories.tsx` + test: empty state, populated list, compare-picker defaults, restore confirm flow (storage mocked as in existing Settings tests).
- `DiffTree.stories.tsx` + test: one story per status mix, truncation story; stories double as browser tests per project convention.

## Out of scope (explicit)

- Diffing Drive revisions.
- Selective per-group/per-tab restore.
- Move detection in the diff.
- Any schema or service-worker change.
