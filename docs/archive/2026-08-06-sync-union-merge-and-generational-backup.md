> status: shipped 2026-08-06 (PR #7) — design record, retired; the code is the truth.

# Sync Union-Merge + Generational Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix GitHub issues #6 (remote-wins Drive sync silently discards unsynced local data — union-merge instead of replace) and #5 (`backup_local` is a single-generation snapshot that gets churned — make it generational).

**Architecture:** Extend the pure merge helpers in `src/lib/merge.ts` with trash-based tombstone suppression and a composed `mergeSyncedState()` used by BOTH the first-connect and remote-wins sync paths in the service worker. Replace the single-shot `backup_local` with a capped newest-first `backup_generations` list (schema v6 + migration), with identical-snapshot dedupe so redundant remote-wins cycles can't evict the one snapshot that matters. The service worker's remote-wins branch backs up, merges, applies, and pushes the merged result back to Drive only when the merge preserved something remote didn't have (prevents ping-pong pushes between devices).

**Tech Stack:** TypeScript, Zod, Vitest (jsdom), Chrome MV3 extension.

## Global Constraints

- Run all commands from the repo root (the path may contain spaces — always quote it in commands).
- All work on branch `fix/sync-union-merge-and-generational-backup`, branched from `main`.
- Only `src/lib/storage.ts` may call `chrome.storage` directly (project contract).
- `local_settings`, `backup_local`, and the new `backup_generations` must NEVER be written to Drive.
- Backup writes must NOT bump `sync_meta.last_modified_at` (only workspaces/settings/trash bump it).
- New migrations go in the `MIGRATIONS` table in `src/lib/storage.ts` keyed by the SOURCE version. This change bumps `SCHEMA_VERSION` from 5 to 6.
- Old JSON exports (which contain a legacy-shaped `backup_local`) must still pass `StorageSchemaZod.parse` — keep the legacy field parseable.
- Commit messages: plain imperative sentences (match repo style, e.g. "Fix popup clipping caused by content-visibility containment"). NO session links, NO "Generated with Claude Code" lines. A plain `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer is allowed.
- Verification commands (run from repo root): `npm run typecheck`, `npm run lint`, `npm test` (or targeted: `npx vitest run src/lib/merge.test.ts src/lib/storage.test.ts src/lib/schema.test.ts`).

## Design decisions (locked in)

1. **Remote-wins = merge-wins (issue #6).** When remote's `last_modified_at` is newer, union-merge workspaces and trash exactly like the existing first-connect path. Settings stay last-write-wins (remote wins on that branch). Never blind-replace.
2. **Deletions propagate via trash tombstones.** Every deletion that goes through Trash leaves a `TrashItem` whose `data` holds the deleted entity (with its `id`). During merge, an entity is suppressed only when a tombstone's `deleted_at` is NEWER than the entity's own last-touched timestamp (group → `updated_at`, tab → `saved_at`, category → max of child groups' `updated_at`, workspace → max of `created_at` and children). `restoreFromTrash` bumps `updated_at` on restore so a restore outranks its own tombstone in later merges.
3. **Push-back only when the merge added something.** If the merged result is content-identical to remote (local was a subset — the common case), apply it locally and adopt remote's `last_modified_at` exactly as the old code did (no Drive write). Otherwise push the merged state to Drive so both sides converge instead of re-merging forever.
4. **Generational backup (issue #5, options 1+2 combined).** `backup_generations: Array<{saved_at, workspaces}>`, newest first, capped at 3. A push identical to the newest generation is skipped entirely, so redundant snapshots can't churn unique ones out. Migration v5→v6 wraps a legacy `backup_local` into one generation with `saved_at: 0` (unknown age). No restore UI in this change (follow-up; `readLocalBackups()` is the hook).
5. **Exports stay clean.** `handleExportJSON` strips `backup_local`/`backup_generations` (device-only, would quadruple the file). Import already ignores them (only writes workspaces/settings/trash).

---

### Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create the working branch**

```bash
git checkout main && git checkout -b fix/sync-union-merge-and-generational-backup
```

Note: `package.json` has an uncommitted modification on main that is unrelated to this work — leave it untouched, never commit it.

---

### Task 1: Schema v6 — `backup_generations` field + migration

**Files:**
- Modify: `src/lib/schema.ts` (SCHEMA_VERSION line 13, StorageSchemaZod lines 152–167, type exports ~line 221)
- Modify: `src/lib/storage.ts` (MIGRATIONS table lines 72–125)
- Test: `src/lib/schema.test.ts`, `src/lib/storage.test.ts`

**Interfaces:**
- Produces: `BackupGenerationSchema` (Zod), `export type BackupGeneration = z.infer<typeof BackupGenerationSchema>`, `StorageSchema.backup_generations?: BackupGeneration[]`, `SCHEMA_VERSION === 6`, `MIGRATIONS[5]`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/schema.test.ts`, inside the existing `describe('StorageSchemaZod', ...)` block (it already has a `validStorage()` fixture — reuse it):

```ts
  it('accepts backup_generations and still parses the legacy backup_local field', () => {
    const doc = {
      ...validStorage(),
      backup_generations: [{ saved_at: 0, workspaces: [] }],
      backup_local: [],
    }
    expect(StorageSchemaZod.safeParse(doc).success).toBe(true)
  })
```

In `src/lib/storage.test.ts`, add a new describe block after the existing migration tests (search for `migrateIfNeeded`; if no migration describe exists, add this at the end of the file). Uses the existing `seed()`, `stored()`, `makeWorkspace()` fixtures:

```ts
describe('migrateIfNeeded v5 → v6 (generational backup)', () => {
  it('wraps a legacy backup_local into one backup generation with saved_at 0', async () => {
    const legacy = seed()
    store['tabnest_data'] = { ...legacy, schema_version: 5, backup_local: [makeWorkspace('legacy')] }
    await storage.migrateIfNeeded()
    const data = stored()
    expect(data.schema_version).toBe(SCHEMA_VERSION)
    expect(data).not.toHaveProperty('backup_local')
    expect(data.backup_generations).toHaveLength(1)
    expect(data.backup_generations![0]!.saved_at).toBe(0)
    expect(data.backup_generations![0]!.workspaces[0]!.name).toBe('legacy')
  })

  it('migrates v5 data without a backup_local cleanly', async () => {
    const legacy = seed()
    store['tabnest_data'] = { ...legacy, schema_version: 5 }
    await storage.migrateIfNeeded()
    expect(stored().schema_version).toBe(SCHEMA_VERSION)
    expect(stored().backup_generations).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/schema.test.ts src/lib/storage.test.ts`
Expected: the new tests FAIL (`backup_generations` unknown / schema_version stays 5). Pre-existing tests PASS.

- [ ] **Step 3: Implement the schema change**

In `src/lib/schema.ts`:

Change line 13:

```ts
export const SCHEMA_VERSION = 6
```

Immediately above `StorageSchemaZod` (after the Trash section), add:

```ts
// ---------------------------------------------------------------------------
// Local backup generations (issue #5)
// ---------------------------------------------------------------------------

/** One pre-overwrite snapshot of workspaces. saved_at 0 = migrated legacy snapshot of unknown age. */
export const BackupGenerationSchema = z.object({
  saved_at: z.number().int().nonnegative(),            // epoch ms
  workspaces: z.array(WorkspaceSchema),
})
```

In `StorageSchemaZod`, replace the single line `backup_local: z.array(WorkspaceSchema).optional(),` with:

```ts
  /**
   * Generational pre-overwrite snapshots, newest first, capped by storage.ts
   * (BACKUP_GENERATIONS_MAX). Device-only — stripped from every Drive write.
   */
  backup_generations: z.array(BackupGenerationSchema).optional(),
  /** Legacy pre-v6 single snapshot. Kept parseable so old JSON exports still import; live data is migrated to backup_generations. */
  backup_local: z.array(WorkspaceSchema).optional(),
```

With the type exports (~line 221), add:

```ts
export type BackupGeneration = z.infer<typeof BackupGenerationSchema>
```

- [ ] **Step 4: Implement the migration**

In `src/lib/storage.ts`, append to the `MIGRATIONS` table (after the `4:` entry):

```ts
  /**
   * v5 → v6: backup_local (single pre-overwrite snapshot) → backup_generations
   * (newest-first list, issue #5). saved_at 0 marks the legacy snapshot's
   * unknown age. The legacy key is removed from live storage.
   */
  5: (data) => {
    const { backup_local, ...rest } = data
    return {
      ...rest,
      schema_version: 6,
      ...(Array.isArray(backup_local) && backup_local.length > 0
        ? { backup_generations: [{ saved_at: 0, workspaces: backup_local }] }
        : {}),
    }
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/schema.test.ts src/lib/storage.test.ts && npm run typecheck`
Expected: PASS (typecheck may flag `writeLocalBackup` writing `backup_local` — that helper still exists and `backup_local` is still in the schema, so it should compile; Task 2 replaces it).

- [ ] **Step 6: Commit**

```bash
git add src/lib/schema.ts src/lib/storage.ts src/lib/schema.test.ts src/lib/storage.test.ts && git commit -m "Add backup_generations schema field with v5→v6 migration"
```

---

### Task 2: Generational backup helpers in storage.ts

**Files:**
- Modify: `src/lib/storage.ts` (replace the "Local backup" section, lines 586–597; extend the schema import at top to include `type BackupGeneration`)
- Test: `src/lib/storage.test.ts` (replace the `describe('local backup', ...)` block at lines 745–757)

**Interfaces:**
- Consumes: `BackupGeneration` from Task 1.
- Produces: `export const BACKUP_GENERATIONS_MAX = 3`, `export function pushLocalBackup(workspaces: Workspace[]): Promise<void>`, `export async function readLocalBackups(): Promise<BackupGeneration[]>`. The old `writeLocalBackup`/`readLocalBackup` are DELETED (no callers outside their own tests).

- [ ] **Step 1: Write the failing tests**

In `src/lib/storage.test.ts`, replace the entire `describe('local backup', ...)` block (lines 745–757) with:

```ts
describe('generational local backup', () => {
  it('prepends snapshots newest-first and caps at BACKUP_GENERATIONS_MAX', async () => {
    seed()
    for (const name of ['g1', 'g2', 'g3', 'g4']) {
      await storage.pushLocalBackup([makeWorkspace(name)])
    }
    const backups = await storage.readLocalBackups()
    expect(backups).toHaveLength(storage.BACKUP_GENERATIONS_MAX)
    expect(backups.map((b) => b.workspaces[0]!.name)).toEqual(['g4', 'g3', 'g2'])
    expect(backups[0]!.saved_at).toBeGreaterThan(0)
  })

  it('skips the write when the newest generation is identical, so redundant snapshots cannot evict unique ones', async () => {
    seed()
    const unique = [makeWorkspace('unique')]
    const same = [makeWorkspace('same')]
    await storage.pushLocalBackup(unique)
    await storage.pushLocalBackup(same)
    await storage.pushLocalBackup(same) // identical to newest — must be a no-op
    const backups = await storage.readLocalBackups()
    expect(backups).toHaveLength(2)
    expect(backups[1]!.workspaces[0]!.name).toBe('unique')
  })

  it('never bumps last_modified_at (backups are device-only bookkeeping)', async () => {
    seed()
    const before = stored().sync_meta.last_modified_at
    await storage.pushLocalBackup([makeWorkspace('b')])
    expect(stored().sync_meta.last_modified_at).toBe(before)
  })

  it('returns [] when no backups exist', async () => {
    seed()
    expect(await storage.readLocalBackups()).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `storage.pushLocalBackup is not a function`.

- [ ] **Step 3: Implement**

In `src/lib/storage.ts`, add `type BackupGeneration,` to the import list from `'./schema'`, then replace the whole "Local backup" section (the comment banner plus `writeLocalBackup` and `readLocalBackup`, lines 586–597) with:

```ts
// ---------------------------------------------------------------------------
// Local backup (written before a Drive overwrite to enable rollback).
// Generational (issue #5): the newest BACKUP_GENERATIONS_MAX snapshots are
// kept so one redundant remote-wins cycle can no longer destroy the only
// copy of the losing side's data.
// ---------------------------------------------------------------------------

export const BACKUP_GENERATIONS_MAX = 3

/**
 * Prepend a snapshot of `workspaces`, evicting the oldest beyond
 * BACKUP_GENERATIONS_MAX. Skipped when the newest generation is already
 * identical — a snapshot adding no information must not churn unique older
 * generations out of the list. Bypasses writeStorage so last_modified_at is
 * never bumped (backups are device-only bookkeeping, like local_settings).
 */
export function pushLocalBackup(workspaces: Workspace[]): Promise<void> {
  return enqueueWrite(async () => {
    const current = await readStorage()
    const generations = current.backup_generations ?? []
    const newest = generations[0]
    if (newest != null && JSON.stringify(newest.workspaces) === JSON.stringify(workspaces)) {
      return
    }
    const backup_generations: BackupGeneration[] = [
      { saved_at: Date.now(), workspaces },
      ...generations,
    ].slice(0, BACKUP_GENERATIONS_MAX)
    await chromeSet({ ...current, backup_generations })
  })
}

/** All backup generations, newest first. Empty array when none exist. */
export async function readLocalBackups(): Promise<BackupGeneration[]> {
  const data = await readStorage()
  return data.backup_generations ?? []
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/storage.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts && git commit -m "Replace single-shot backup_local helpers with generational pushLocalBackup"
```

---

### Task 3: Tombstone-aware merge helpers in merge.ts

**Files:**
- Modify: `src/lib/merge.ts` (append after `mergeTrash`; extend the type-only import to include `SavedTab`)
- Test: `src/lib/merge.test.ts`

**Interfaces:**
- Consumes: existing `mergeWorkspaces`, `mergeTrash`, types from `./schema`.
- Produces (all exported from `src/lib/merge.ts`):
  - `tombstonesFromTrash(trash: TrashItem[]): Map<string, number>` — entity id → newest `deleted_at`.
  - `applyTombstones(workspaces: Workspace[], tombstones: Map<string, number>): Workspace[]`
  - `mergeSyncedState(local: { workspaces: Workspace[]; trash: TrashItem[] }, remote: { workspaces: Workspace[]; trash: TrashItem[] }): { workspaces: Workspace[]; trash: TrashItem[] }`
  - `sameSyncedContent(a: { workspaces: Workspace[]; trash: TrashItem[] }, b: { workspaces: Workspace[]; trash: TrashItem[] }): boolean`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/merge.test.ts`. Extend the import from `'./merge'` with `tombstonesFromTrash, applyTombstones, mergeSyncedState, sameSyncedContent`. The file already has `tab/group/category/workspace/trash` builders (note: the existing `trash(id)` builder makes a TrashItem with `data: {}`). Add one builder plus the tests:

```ts
// Tombstone: a trash item whose data carries the deleted entity's id.
const tombstone = (entityId: string, deletedAt: number): TrashItem => ({
  id: `trash-${entityId}`,
  type: 'group',
  data: { id: entityId },
  original_location: { workspace_id: 'ws' },
  deleted_at: deletedAt,
})

describe('tombstonesFromTrash', () => {
  it('maps entity ids to their newest deleted_at and ignores items without an id', () => {
    const map = tombstonesFromTrash([
      tombstone('g1', 5),
      tombstone('g1', 9),
      { ...tombstone('junk', 3), data: null },
    ])
    expect(map.get('g1')).toBe(9)
    expect(map.size).toBe(1)
  })
})

describe('applyTombstones', () => {
  it('drops a group whose tombstone is newer than its updated_at', () => {
    const ws = workspace('w', [category('c', { groups: [group('g', { updated_at: 10 })] })])
    const out = applyTombstones([ws], tombstonesFromTrash([tombstone('g', 20)]))
    expect(out[0]!.categories[0]!.groups).toHaveLength(0)
  })

  it('keeps a group touched after the tombstone (restored or edited post-delete)', () => {
    const ws = workspace('w', [category('c', { groups: [group('g', { updated_at: 30 })] })])
    const out = applyTombstones([ws], tombstonesFromTrash([tombstone('g', 20)]))
    expect(out[0]!.categories[0]!.groups).toHaveLength(1)
  })

  it('drops individually tombstoned tabs from surviving groups', () => {
    const g = group('g', { updated_at: 50, tabs: [tab('t1'), tab('t2')] }) // tabs have saved_at 1
    const ws = workspace('w', [category('c', { groups: [g] })])
    const out = applyTombstones([ws], tombstonesFromTrash([tombstone('t1', 20)]))
    expect(out[0]!.categories[0]!.groups[0]!.tabs.map((t) => t.id)).toEqual(['t2'])
  })

  it('drops tombstoned categories and workspaces whose contents predate the deletion', () => {
    const wsA = workspace('wA', [category('cA', { groups: [group('gA', { updated_at: 5 })] })])
    const wsB = workspace('wB', [
      category('cB1', { groups: [group('gB', { updated_at: 5 })] }),
      category('cB2'),
    ])
    const tombs = tombstonesFromTrash([tombstone('wA', 99), tombstone('cB1', 99)])
    const out = applyTombstones([wsA, wsB], tombs)
    expect(out.map((w) => w.id)).toEqual(['wB'])
    expect(out[0]!.categories.map((c) => c.id)).toEqual(['cB2'])
  })

  it('leaves untombstoned entities alone', () => {
    const ws = workspace('w', [category('c', { groups: [group('g')] })])
    expect(applyTombstones([ws], new Map())).toEqual([ws])
  })
})

describe('mergeSyncedState', () => {
  it('unions workspaces and trash, honoring deletions recorded on either side', () => {
    // Device L deleted group gB (tombstone in its trash) and added gL, which
    // never reached Drive. Device R (remote) still has gB and never saw gL.
    const gL = group('gL', { updated_at: 100 })
    const gB = group('gB', { updated_at: 10 })
    const gShared = group('gS', { updated_at: 10 })
    const local = {
      workspaces: [workspace('w', [category('c', { groups: [gShared, gL] })])],
      trash: [tombstone('gB', 50)],
    }
    const remote = {
      workspaces: [workspace('w', [category('c', { groups: [gShared, gB] })])],
      trash: [] as TrashItem[],
    }
    const merged = mergeSyncedState(local, remote)
    const ids = merged.workspaces[0]!.categories[0]!.groups.map((g) => g.id).sort()
    expect(ids).toEqual(['gL', 'gS']) // gL preserved, gB deletion propagated
    expect(merged.trash.map((t) => t.id)).toEqual(['trash-gB'])
  })
})

describe('sameSyncedContent', () => {
  it('is true for content-identical states and false when one side has extra data', () => {
    const state = {
      workspaces: [workspace('w', [category('c', { groups: [group('g')] })])],
      trash: [] as TrashItem[],
    }
    const clone = JSON.parse(JSON.stringify(state)) as typeof state
    expect(sameSyncedContent(state, clone)).toBe(true)
    const extra = { ...state, trash: [tombstone('x', 1)] }
    expect(sameSyncedContent(state, extra)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/merge.test.ts`
Expected: FAIL — `tombstonesFromTrash` not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/merge.ts` (after `mergeTrash`); also add `SavedTab` to the type-only import if needed by your editor (the code below only names it in a callback parameter inferred from context, so the import may be unnecessary):

```ts
// ---------------------------------------------------------------------------
// Tombstone suppression (issue #6)
//
// Deletions that go through Trash leave a TrashItem whose `data` holds the
// deleted entity, id included. When merging two devices, an entity whose
// tombstone is NEWER than the entity's own last-touched timestamp was deleted
// after it was last edited — drop it from the union so deletions don't
// resurrect. An entity touched after the tombstone (restoreFromTrash bumps
// updated_at exactly for this) survives the merge.
// ---------------------------------------------------------------------------

/** Entity id → newest tombstone deleted_at across the trash list. */
export function tombstonesFromTrash(trash: TrashItem[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of trash) {
    const id = (t.data as { id?: unknown } | null | undefined)?.id
    if (typeof id !== 'string') continue
    map.set(id, Math.max(map.get(id) ?? 0, t.deleted_at))
  }
  return map
}

const groupLastTouched = (g: TabGroup): number => g.updated_at
const categoryLastTouched = (c: Category): number => Math.max(0, ...c.groups.map(groupLastTouched))
const workspaceLastTouched = (w: Workspace): number =>
  Math.max(w.created_at, ...w.categories.map(categoryLastTouched))

/** Remove entities (at every level) whose tombstone postdates their last touch. */
export function applyTombstones(
  workspaces: Workspace[],
  tombstones: Map<string, number>,
): Workspace[] {
  const deletedAfter = (id: string, lastTouched: number): boolean =>
    (tombstones.get(id) ?? 0) > lastTouched
  return workspaces
    .filter((ws) => !deletedAfter(ws.id, workspaceLastTouched(ws)))
    .map((ws) => ({
      ...ws,
      categories: ws.categories
        .filter((c) => !deletedAfter(c.id, categoryLastTouched(c)))
        .map((c) => ({
          ...c,
          groups: c.groups
            .filter((g) => !deletedAfter(g.id, groupLastTouched(g)))
            .map((g) => ({ ...g, tabs: g.tabs.filter((t) => !deletedAfter(t.id, t.saved_at)) })),
        })),
    }))
}

/**
 * Union-merge two devices' synced user data, honoring deletions recorded in
 * either side's trash. Used by both the first-connect and remote-wins sync
 * paths (issue #6) — settings are merged separately (last-write-wins).
 */
export function mergeSyncedState(
  local: { workspaces: Workspace[]; trash: TrashItem[] },
  remote: { workspaces: Workspace[]; trash: TrashItem[] },
): { workspaces: Workspace[]; trash: TrashItem[] } {
  const trash = mergeTrash(local.trash, remote.trash)
  const workspaces = applyTombstones(
    mergeWorkspaces(local.workspaces, remote.workspaces),
    tombstonesFromTrash(trash),
  )
  return { workspaces, trash }
}

/**
 * True when two synced states carry identical content. Lets the sync handler
 * skip the Drive push-back when a merge added nothing beyond what remote
 * already has (avoids two devices ping-ponging pushes forever).
 */
export function sameSyncedContent(
  a: { workspaces: Workspace[]; trash: TrashItem[] },
  b: { workspaces: Workspace[]; trash: TrashItem[] },
): boolean {
  return (
    JSON.stringify(a.workspaces) === JSON.stringify(b.workspaces) &&
    JSON.stringify(a.trash) === JSON.stringify(b.trash)
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/merge.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/merge.ts src/lib/merge.test.ts && git commit -m "Add tombstone-aware mergeSyncedState for sync conflict resolution"
```

---

### Task 4: restoreFromTrash outranks its tombstone

**Files:**
- Modify: `src/lib/storage.ts` (`restoreFromTrash`, lines 612–676)
- Test: `src/lib/storage.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: restored groups get `updated_at: Date.now()`; restored workspaces get every nested group's `updated_at` bumped. (This is what lets `applyTombstones` keep restored entities.)

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/storage.test.ts`, inside the existing describe for restoreFromTrash (search for `restoreFromTrash`; if its tests live under a different describe, append these `it` blocks there):

```ts
  it('bumps updated_at on group restore so the restore outranks its deletion tombstone', async () => {
    const group = { ...makeGroup('Restorable'), updated_at: 1000 }
    const ws = makeWorkspace('W')
    const item: TrashItem = {
      id: crypto.randomUUID(),
      type: 'group',
      data: group,
      original_location: { workspace_id: ws.id, category_id: ws.categories[0]!.id },
      deleted_at: 5000,
    }
    seed([ws], [item])
    await storage.restoreFromTrash(item.id)
    const restored = stored().workspaces[0]!.categories[0]!.groups.find((g) => g.id === group.id)
    expect(restored).toBeDefined()
    expect(restored!.updated_at).toBeGreaterThan(item.deleted_at)
  })

  it('bumps nested group updated_at on workspace restore', async () => {
    const inner = { ...makeGroup('Inner'), updated_at: 1000 }
    const deletedWs = makeWorkspace('Deleted', [makeCategory('C', [inner])])
    const item: TrashItem = {
      id: crypto.randomUUID(),
      type: 'workspace',
      data: deletedWs,
      original_location: { workspace_id: deletedWs.id },
      deleted_at: 5000,
    }
    seed([makeWorkspace('Kept')], [item])
    await storage.restoreFromTrash(item.id)
    const restored = stored().workspaces.find((w) => w.id === deletedWs.id)
    expect(restored).toBeDefined()
    expect(restored!.categories[0]!.groups[0]!.updated_at).toBeGreaterThan(item.deleted_at)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: the two new tests FAIL (`updated_at` stays 1000).

- [ ] **Step 3: Implement**

In `src/lib/storage.ts` `restoreFromTrash`, group branch — replace:

```ts
    const group: TabGroup = groupParsed.data
```

with:

```ts
    // Restoring must outrank the deletion tombstone in sync merges (see
    // applyTombstones in merge.ts) — a restore is an edit, stamp it as one.
    const group: TabGroup = { ...groupParsed.data, updated_at: Date.now() }
```

Workspace branch — replace:

```ts
    const workspace = wsParsed.data
```

with:

```ts
    // Same tombstone rule as groups: bump nested groups so the restored
    // workspace outranks its deletion tombstone in sync merges.
    const restoredAt = Date.now()
    const workspace: Workspace = {
      ...wsParsed.data,
      categories: wsParsed.data.categories.map((cat) => ({
        ...cat,
        groups: cat.groups.map((g) => ({ ...g, updated_at: restoredAt })),
      })),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/storage.test.ts && npm run typecheck`
Expected: PASS (including all pre-existing restore tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts && git commit -m "Bump updated_at when restoring from trash so restores survive sync merges"
```

---

### Task 5: Wire the service worker — merge on remote-wins, generational backup, Drive strip

**Files:**
- Modify: `src/background/index.ts` (imports ~lines 14–30; sync branches lines 391–415; `restoreDriveRevision` line 536; Drive payload strip lines 629–632)

**Interfaces:**
- Consumes: `mergeSyncedState`, `sameSyncedContent` from `src/lib/merge.ts`; `pushLocalBackup` from `src/lib/storage.ts`.
- Produces: no new exports (service worker entry point). No unit tests — `background/index.ts` has import-time side effects and all new logic is pure and tested in Tasks 2–4; this task is glue, verified by typecheck/lint/build + full suite.

- [ ] **Step 1: Update imports**

In the import block of `src/background/index.ts`: from `'../lib/merge'` import `{ mergeSyncedState, sameSyncedContent }` and REMOVE `mergeWorkspaces` / `mergeTrash` if nothing else uses them (check with grep after editing). From `'../lib/storage'` add `pushLocalBackup` to the existing named imports.

- [ ] **Step 2: Replace the sync conflict branches**

Replace lines 391–415 (the `if (remote !== null && meta.last_sync_at === 0) { ... } else if ... } else { ... }` chain) with:

```ts
    if (remote !== null && meta.last_sync_at === 0) {
      // First connect on this device — Drive already has data from another
      // device. Union both sides so neither device loses tabs; deletions
      // recorded in either side's trash are honored via tombstones. Settings
      // go to whichever side was more recently modified.
      const merged = mergeSyncedState(local, remote)
      const mergedSettings =
        remote.sync_meta.last_modified_at > local.sync_meta.last_modified_at
          ? remote.settings
          : local.settings
      await writeStorage({ workspaces: merged.workspaces, settings: mergedSettings, trash: merged.trash })
      await writeDriveFile(token, fileId, await readStorage())
    } else if (remote !== null && remote.sync_meta.last_modified_at > local.sync_meta.last_modified_at) {
      // Remote is newer — but never blind-replace local (issue #6): union-merge
      // workspaces and trash exactly like first-connect, so data that never
      // reached Drive (saved while sync was off, or between pushes) survives.
      // Settings stay last-write-wins (remote is newer on this branch). The
      // pre-merge local workspaces go into the generational backup (issue #5).
      await pushLocalBackup(local.workspaces)
      const merged = mergeSyncedState(local, remote)
      await writeStorage({ workspaces: merged.workspaces, settings: remote.settings, trash: merged.trash })
      if (sameSyncedContent(merged, remote)) {
        // Local contributed nothing — adopt remote's last_modified_at.
        // writeStorage just bumped it, which would make local look newer than
        // remote on the next cycle and ping-pong pushes between devices.
        await patchSyncMeta({ last_modified_at: remote.sync_meta.last_modified_at })
      } else {
        // The merge preserved local-only data remote doesn't have — push it
        // back so both sides converge instead of re-merging forever.
        await writeDriveFile(token, fileId, await readStorage())
      }
    } else {
      // Local wins — push to Drive
      await writeDriveFile(token, fileId, local)
    }
```

- [ ] **Step 3: Switch restoreDriveRevision to the generational backup**

Replace (around line 534–536):

```ts
  // Keep a local backup of the current workspaces so the restore is reversible
  const current = await readStorage()
  await writeStorage({ backup_local: current.workspaces })
```

with:

```ts
  // Keep a local backup of the current workspaces so the restore is reversible
  const current = await readStorage()
  await pushLocalBackup(current.workspaces)
```

- [ ] **Step 4: Strip backup_generations from every Drive write**

At the Drive payload strip (lines 629–632), replace:

```ts
  const { local_settings: _ls, backup_local: _bl, ...drivePayload } = data
```

with:

```ts
  const { local_settings: _ls, backup_local: _bl, backup_generations: _bg, ...drivePayload } = data
```

and update the adjacent comment to mention `backup_generations`.

- [ ] **Step 5: Verify — full suite, typecheck, lint, build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all PASS, build succeeds. If lint flags the unused `_bl`-style destructures, follow the existing pattern already present on that line (it lints clean today).

- [ ] **Step 6: Commit**

```bash
git add src/background/index.ts && git commit -m "Union-merge on remote-wins sync and keep generational pre-overwrite backups"
```

---

### Task 6: Keep backups out of JSON exports

**Files:**
- Modify: `src/components/Settings/SyncAndDataTab.tsx` (`handleExportJSON`, ~lines 120–135)

**Interfaces:**
- Consumes: nothing new. Import flow needs no change — it already writes only `workspaces`/`settings`/`trash`.

- [ ] **Step 1: Implement**

In `handleExportJSON`, replace:

```ts
      const result = await chrome.storage.local.get('tabnest_data')
      const data = result['tabnest_data']
      const json = JSON.stringify(data, null, 2)
```

with:

```ts
      const result = await chrome.storage.local.get('tabnest_data')
      const raw = result['tabnest_data'] as Record<string, unknown> | undefined
      if (raw == null) return
      // Device-only backup snapshots stay out of user exports — they are
      // rollback bookkeeping, not portable user content, and would multiply
      // the file size.
      const { backup_local: _bl, backup_generations: _bg, ...data } = raw
      const json = JSON.stringify(data, null, 2)
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint && npx vitest run src/components/Settings`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/Settings/SyncAndDataTab.tsx && git commit -m "Exclude device-only backup snapshots from JSON export"
```

---

### Task 7: Documentation + PR

**Files:**
- Modify: `CLAUDE.md` (schema version + Drive sync paragraph)
- Modify: `.claude/docs/TabNest_Specification.md` (§9 conflict resolution — locate the last-write-wins description first)

- [ ] **Step 1: Update CLAUDE.md**

In the Storage layer section, change `Current schema: v2.` to `Current schema: v6.`

In the Drive sync section, replace the sentence `Conflict resolution is last-write-wins by `last_modified_at` timestamp.` with:

```markdown
Conflict resolution: workspaces and trash are union-merged by entity id on every conflicting sync (`src/lib/merge.ts` — `mergeSyncedState`), with deletions propagated via trash tombstones; settings are last-write-wins by `last_modified_at`. Before a merge is applied, the local workspaces are snapshotted into `backup_generations` (last 3, deduped — see `pushLocalBackup`).
```

- [ ] **Step 2: Update the spec**

Grep `.claude/docs/TabNest_Specification.md` for `last-write-wins` / `Last write wins` / `conflict` and update §9's conflict-resolution wording to match the CLAUDE.md paragraph above (adapt to the spec's surrounding prose; keep it factual, one short paragraph). Also mention that `backup_local` became generational `backup_generations` (schema v6) wherever the spec references the pre-sync backup.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md .claude/docs/TabNest_Specification.md && git commit -m "Document union-merge sync and generational backups"
```

- [ ] **Step 4: Final verification**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: everything green.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin fix/sync-union-merge-and-generational-backup
```

Open a PR against `main` titled `Union-merge sync conflicts and make the pre-sync backup generational` with a body that:
- Summarizes both fixes (merge-on-remote-wins with tombstones; generational deduped `backup_generations`, schema v6 migration).
- Notes the behavior change: deletions now propagate across devices via trash tombstones; a deletion is only suppressed when it postdates the entity's last edit, and restores bump `updated_at` so they win.
- Notes the known limitation: deletions that bypass trash (e.g. removing a single tab from a group, emptying trash before sync) can still resurrect on merge — accepted per issue #6.
- Contains `Fixes #5` and `Fixes #6`.
- NO session links, no generated-with footer.

---

## Self-review notes

- **Issue #6 coverage:** union-merge on remote-wins (Task 5), same primitives as first-connect ✓; push-back so both sides converge ✓ (bounded by `sameSyncedContent` to avoid push ping-pong); tombstone deletion propagation via trash ✓ (Tasks 3+4); settings stay LWW ✓.
- **Issue #5 coverage:** option 1 (skip redundant writes — identical-snapshot dedupe) ✓ + option 2 (generational, N=3) ✓, growth bounded and stripped from Drive ✓. Option 3 (restore UI) deliberately deferred; `readLocalBackups()` is the hook.
- **Type consistency check:** `BackupGeneration` (Task 1) is consumed by `pushLocalBackup`/`readLocalBackups` (Task 2); `mergeSyncedState`/`sameSyncedContent` (Task 3) are consumed in Task 5 with matching `{ workspaces, trash }` shapes; `pushLocalBackup(local.workspaces)` takes `Workspace[]` ✓.
- **Legacy compat:** old exports containing `backup_local` still parse (field kept in Zod schema); live data migrates v5→v6; Drive payload strips both fields.
