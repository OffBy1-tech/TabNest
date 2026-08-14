> status: shipped 2026-08-07 (PR #15) — design record, retired; the code is the truth.

# Backups In Their Own Storage Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issue #14 — move `backup_generations` out of the hot `tabnest_data` document into its own `tabnest_backups` chrome.storage key (v6→v7 migration), so every read-modify-write and every `onChanged` payload stops hauling up to 3 full workspace snapshots.

**Architecture:** `src/lib/storage.ts` gains private `chromeGetBackups`/`chromeSetBackups` for the new key; the public backup API (`pushLocalBackup`, `readLocalBackups`, `restoreLocalBackup`) keeps its signatures, still serialized on the existing write queue (restore writes the backups key BEFORE workspaces, so a crash between the two loses nothing). Schema v7 removes the field from `StorageSchemaZod` (Zod strips unknown keys, so v6 exports still import); `migrateIfNeeded` lifts existing in-doc generations into the new key. Settings gets the data from a new `useLocalBackups()` hook subscribed to the new key, replacing the prop threading through App/SettingsModal.

**Tech Stack:** TypeScript, Zod, chrome.storage.local, React, Vitest.

## Global Constraints

- Run all commands from the repo root (the path may contain spaces — quote it).
- Branch: `fix/backups-own-storage-key` off current `main`.
- Only `src/lib/storage.ts` touches `chrome.storage` directly (project contract). The new key's constant and I/O live there.
- New storage key literal: `tabnest_backups`, holding `BackupGeneration[]` (newest first), device-only, never synced/exported.
- Public API signatures unchanged: `pushLocalBackup(workspaces: Workspace[]): Promise<void>`, `readLocalBackups(): Promise<BackupGeneration[]>`, `restoreLocalBackup(index: number): Promise<void>`. Callers outside storage.ts must not change except where this plan says.
- All backup writes go through the existing `enqueueWrite` queue; restore's cross-key order is backups-first, then workspaces.
- Migration idempotency: lifting must not overwrite a non-empty `tabnest_backups` key (re-running onInstalled must be safe).
- All existing `onChanged` consumers (`useStorage`, `ThemeProvider`, background listener) key on `'tabnest_data'` — verified; they need no changes.
- Commit messages: plain imperative sentences, NO session links, no generated-with footer.
- Verification: `npm run typecheck && npm run lint && npm test && npm run build`.

---

### Task 0: Branch

- [ ] **Step 1:**

```bash
git checkout main && git checkout -b fix/backups-own-storage-key
```

Note: `package.json` carries an unrelated uncommitted version-bump modification — never commit it.

---

### Task 1: Backups key plumbing in storage.ts

**Files:**
- Modify: `src/lib/storage.ts` — key constants (~line 38), `writeStorage` (~268–305), the "Local backup" section (`prependGeneration`/`pushLocalBackup`/`readLocalBackups`/`restoreLocalBackup`)
- Test: `src/lib/storage.test.ts` — the `generational local backup` and `restoreLocalBackup` describes

**Interfaces:**
- Consumes: existing `enqueueWrite<T>`, `readStorage`, `chromeSet`, `BackupGeneration`, `BACKUP_GENERATIONS_MAX`.
- Produces (internal): `const BACKUPS_KEY = 'tabnest_backups'`; `chromeGetBackups(): Promise<BackupGeneration[]>`; `chromeSetBackups(generations: BackupGeneration[]): Promise<void>`; `applyWrite(patchOrUpdate): Promise<StorageSchema>` (the un-queued body of `writeStorage`, so `restoreLocalBackup` can compose a cross-key sequence inside ONE queued unit — calling `writeStorage` from inside queued work would deadlock the queue).
- Public API signatures unchanged (see Global Constraints). Task 2 consumes `chromeGetBackups`/`chromeSetBackups` from this task inside `migrateIfNeeded`.

- [ ] **Step 1: Rewrite the backup tests to expect the new key (failing first)**

In `src/lib/storage.test.ts`, add next to the existing `stored()` helper:

```ts
function storedBackups(): import('./schema').BackupGeneration[] | undefined {
  return store['tabnest_backups'] as import('./schema').BackupGeneration[] | undefined
}
```

Replace the `describe('generational local backup', ...)` block with:

```ts
describe('generational local backup (own storage key)', () => {
  it('prepends snapshots newest-first under tabnest_backups and caps at BACKUP_GENERATIONS_MAX', async () => {
    seed()
    for (const name of ['g1', 'g2', 'g3', 'g4']) {
      await storage.pushLocalBackup([makeWorkspace(name)])
    }
    const backups = await storage.readLocalBackups()
    expect(backups).toHaveLength(storage.BACKUP_GENERATIONS_MAX)
    expect(backups.map((b) => b.workspaces[0]!.name)).toEqual(['g4', 'g3', 'g2'])
    expect(backups[0]!.saved_at).toBeGreaterThan(0)
    expect(storedBackups()).toEqual(backups)
  })

  it('never touches the main document — no backup data inside tabnest_data, no last_modified_at bump', async () => {
    const seeded = seed()
    await storage.pushLocalBackup([makeWorkspace('b')])
    expect(stored()).toEqual(seeded) // hot document byte-identical
    expect(stored()).not.toHaveProperty('backup_generations')
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

  it('returns [] when no backups exist', async () => {
    seed()
    expect(await storage.readLocalBackups()).toEqual([])
  })
})
```

Replace the `describe('restoreLocalBackup', ...)` block with:

```ts
describe('restoreLocalBackup', () => {
  it('replaces workspaces with the chosen generation, saving the current state to the backups key first', async () => {
    seed([makeWorkspace('Live')])
    await storage.pushLocalBackup([makeWorkspace('Snap')])

    await storage.restoreLocalBackup(0)

    expect(stored().workspaces[0]!.name).toBe('Snap')
    expect(storedBackups()![0]!.workspaces[0]!.name).toBe('Live') // reversibility
  })

  it('bumps last_modified_at so the restore propagates via sync', async () => {
    seed([makeWorkspace('Live')])
    await storage.pushLocalBackup([makeWorkspace('Snap')])
    const before = stored().sync_meta.last_modified_at

    await storage.restoreLocalBackup(0)

    expect(stored().sync_meta.last_modified_at).toBeGreaterThan(before)
  })

  it('throws for a missing generation index and leaves both keys untouched', async () => {
    const seeded = seed()
    await expect(storage.restoreLocalBackup(0)).rejects.toThrow(/not found/)
    expect(stored()).toEqual(seeded)
    expect(storedBackups()).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: the rewritten backup/restore tests FAIL (`storedBackups()` is undefined — data still lives inside `tabnest_data`). All other tests PASS.

- [ ] **Step 3: Implement**

In `src/lib/storage.ts`:

(a) Next to `const STORAGE_KEY = 'tabnest_data'` add:

```ts
/** Backup snapshots live OUTSIDE the hot document (issue #14) — every
 *  read-modify-write of tabnest_data would otherwise haul up to
 *  BACKUP_GENERATIONS_MAX full workspace trees through serialization. */
const BACKUPS_KEY = 'tabnest_backups'
```

(b) Next to `chromeGet`/`chromeSet` add:

```ts
/** Raw read of the backups key. Returns [] when absent (or in non-extension contexts the promise rejects, matching chromeGet). */
async function chromeGetBackups(): Promise<BackupGeneration[]> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(BACKUPS_KEY, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        const raw = result[BACKUPS_KEY] as BackupGeneration[] | undefined
        resolve(raw ?? [])
      })
    } catch (err) {
      reject(err)
    }
  })
}

async function chromeSetBackups(generations: BackupGeneration[]): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ [BACKUPS_KEY]: generations }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message ?? 'Unknown storage error'))
          return
        }
        resolve()
      })
    } catch (err) {
      reject(err)
    }
  })
}
```

(c) Split `writeStorage` so its body is reusable inside already-queued work (extract, don't duplicate):

```ts
/** The write itself — read, patch, bump, persist. Only call while holding the
 *  queue (from writeStorage, or from queued work composing multiple steps —
 *  calling writeStorage from inside queued work would deadlock). */
async function applyWrite(
  patchOrUpdate:
    | Partial<StorageSchema>
    | ((current: StorageSchema) => Partial<StorageSchema> | null),
): Promise<StorageSchema> {
  const current = await readStorage()
  const patch = typeof patchOrUpdate === 'function' ? patchOrUpdate(current) : patchOrUpdate
  if (patch === null) return current // updater declined — nothing to write
  const merged: StorageSchema = { ...current, ...patch }

  // Bump last_modified_at when syncable user data changes.
  // local_settings and sync_meta are intentionally excluded — they are
  // device-only or pure sync bookkeeping and should not affect conflict resolution.
  const touchesUserData = 'workspaces' in patch || 'settings' in patch || 'trash' in patch
  if (touchesUserData) {
    merged.sync_meta = { ...merged.sync_meta, last_modified_at: Date.now() }
  }

  await chromeSet(merged)
  return merged
}

export function writeStorage(
  patchOrUpdate:
    | Partial<StorageSchema>
    | ((current: StorageSchema) => Partial<StorageSchema> | null),
): Promise<StorageSchema> {
  return enqueueWrite(() => applyWrite(patchOrUpdate))
}
```

(Keep `writeStorage`'s existing doc comment on the exported function.)

(d) Replace `pushLocalBackup`, `readLocalBackups`, and `restoreLocalBackup` (keep `prependGeneration` and `BACKUP_GENERATIONS_MAX` as they are):

```ts
/**
 * Save `workspaces` as the newest backup generation under BACKUPS_KEY (no-op
 * when identical to the newest snapshot). Serialized on the write queue so it
 * can't interleave with a concurrent restore. The hot document is untouched.
 */
export async function pushLocalBackup(workspaces: Workspace[]): Promise<void> {
  await enqueueWrite(async () => {
    const next = prependGeneration(await chromeGetBackups(), workspaces)
    if (next) await chromeSetBackups(next)
  })
}

/** All backup generations, newest first. Empty array when none exist. */
export async function readLocalBackups(): Promise<BackupGeneration[]> {
  return chromeGetBackups()
}

export async function restoreLocalBackup(index: number): Promise<void> {
  // One queued unit spanning both keys. Backups key first, workspaces second:
  // a crash between the two leaves an extra snapshot but loses nothing.
  await enqueueWrite(async () => {
    const generations = await chromeGetBackups()
    const generation = generations[index]
    if (generation == null) {
      throw new Error(`Backup generation ${index} not found`)
    }
    const current = await readStorage()
    const next = prependGeneration(generations, current.workspaces)
    if (next) await chromeSetBackups(next)
    await applyWrite({ workspaces: generation.workspaces })
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/storage.test.ts && npm run typecheck`
Expected: PASS. (The migration tests still pass at this point — the schema field still exists; Task 2 changes them.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts && git commit -m "Store backup generations under their own tabnest_backups key"
```

---

### Task 2: Schema v7 — remove the field, lift on migrate

**Files:**
- Modify: `src/lib/schema.ts` — `SCHEMA_VERSION` (13), `StorageSchemaZod` (remove `backup_generations`; keep `BackupGenerationSchema`, `BackupGeneration`, legacy `backup_local`)
- Modify: `src/lib/storage.ts` — `MIGRATIONS` table, `migrateIfNeeded`, `stripDeviceOnlyFields`
- Test: `src/lib/storage.test.ts` (migration describes), `src/lib/schema.test.ts`

**Interfaces:**
- Consumes: `chromeGetBackups`/`chromeSetBackups` (Task 1, same module).
- Produces: `SCHEMA_VERSION === 7`; `MIGRATIONS[6]`; `StorageSchema` no longer has `backup_generations` (Task 3 relies on this: `data?.backup_generations` reads disappear from the UI); `stripDeviceOnlyFields` returns `Omit<T, 'local_settings' | 'backup_local'>`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/storage.test.ts`, replace the `describe('migrateIfNeeded v5 → v6 (generational backup)', ...)` block with:

```ts
describe('migrateIfNeeded — backup lifting (v5/v6 → v7)', () => {
  it('lifts a v6 in-document backup_generations into the tabnest_backups key', async () => {
    const legacy = seed()
    store['tabnest_data'] = {
      ...legacy,
      schema_version: 6,
      backup_generations: [{ saved_at: 123, workspaces: [makeWorkspace('gen')] }],
    }

    await storage.migrateIfNeeded()

    const data = stored()
    expect(data.schema_version).toBe(SCHEMA_VERSION)
    expect(data).not.toHaveProperty('backup_generations')
    expect(storedBackups()).toHaveLength(1)
    expect(storedBackups()![0]!.saved_at).toBe(123)
    expect(storedBackups()![0]!.workspaces[0]!.name).toBe('gen')
  })

  it('migrates a v5 legacy backup_local all the way into the tabnest_backups key', async () => {
    const legacy = seed()
    store['tabnest_data'] = { ...legacy, schema_version: 5, backup_local: [makeWorkspace('legacy')] }

    await storage.migrateIfNeeded()

    const data = stored()
    expect(data.schema_version).toBe(SCHEMA_VERSION)
    expect(data).not.toHaveProperty('backup_local')
    expect(data).not.toHaveProperty('backup_generations')
    expect(storedBackups()).toHaveLength(1)
    expect(storedBackups()![0]!.saved_at).toBe(0)
    expect(storedBackups()![0]!.workspaces[0]!.name).toBe('legacy')
  })

  it('migrates v6 data without backups cleanly, leaving the backups key absent', async () => {
    const legacy = seed()
    store['tabnest_data'] = { ...legacy, schema_version: 6 }

    await storage.migrateIfNeeded()

    expect(stored().schema_version).toBe(SCHEMA_VERSION)
    expect(storedBackups()).toBeUndefined()
  })

  it('never overwrites an existing non-empty tabnest_backups key (idempotent re-run)', async () => {
    const existing = [{ saved_at: 999, workspaces: [makeWorkspace('keep-me')] }]
    store['tabnest_backups'] = existing
    const legacy = seed()
    store['tabnest_data'] = {
      ...legacy,
      schema_version: 6,
      backup_generations: [{ saved_at: 1, workspaces: [makeWorkspace('stale')] }],
    }

    await storage.migrateIfNeeded()

    expect(storedBackups()).toEqual(existing)
  })
})
```

In `src/lib/schema.test.ts`, replace the `it('accepts backup_generations and still parses the legacy backup_local field', ...)` test with:

```ts
  it('still parses the legacy backup_local field, and strips a stray in-document backup_generations (moved to its own key in v7)', () => {
    const doc = {
      ...validStorage(),
      backup_local: [],
      backup_generations: [{ saved_at: 0, workspaces: [] }],
    }
    const parsed = StorageSchemaZod.parse(doc)
    expect(parsed).not.toHaveProperty('backup_generations')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/storage.test.ts src/lib/schema.test.ts`
Expected: the new migration tests FAIL (schema_version stays 6 / backups not lifted) and the schema test FAILS (`backup_generations` survives parsing as a declared field). Everything else PASS.

- [ ] **Step 3: Implement the schema change**

In `src/lib/schema.ts`:

Change `export const SCHEMA_VERSION = 6` to `export const SCHEMA_VERSION = 7`.

In `StorageSchemaZod`, DELETE the `backup_generations` entry and its doc comment, leaving `backup_local` with an updated comment:

```ts
  /** Legacy pre-v6 single snapshot. Kept parseable so old JSON exports still import; live data was migrated to the device-only `tabnest_backups` storage key (v7). */
  backup_local: z.array(WorkspaceSchema).optional(),
```

Update the comment on `BackupGenerationSchema` (it now types the separate key, not a document field):

```ts
/**
 * One pre-overwrite snapshot of workspaces. Stored (as an array, newest
 * first) under the device-only `tabnest_backups` chrome.storage key — NOT in
 * the tabnest_data document (issue #14). saved_at 0 = migrated legacy
 * snapshot of unknown age.
 */
```

- [ ] **Step 4: Implement the migration**

In `src/lib/storage.ts`:

(a) Append to `MIGRATIONS` after the `5:` entry:

```ts
  /**
   * v6 → v7: backup_generations moves OUT of the document into the
   * device-only tabnest_backups key (issue #14). The table is pure data→data,
   * so this entry only drops the field; migrateIfNeeded captures the value
   * beforehand and writes it to the new key.
   */
  6: (data) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { backup_generations: _bg, ...rest } = data
    return { ...rest, schema_version: 7 }
  },
```

(b) In `migrateIfNeeded`, capture the generations as the loop crosses version 6, and lift them after the document persists. Replace the migration loop and final `chromeSet(parsed.data)` section with:

```ts
  // Run each migration in order. Capture backup generations as we cross v6 —
  // MIGRATIONS[6] drops them from the document, and they move to the
  // device-only BACKUPS_KEY instead (issue #14). Capturing at version 6
  // covers v5-origin data too: MIGRATIONS[5] has already folded the legacy
  // backup_local into in-document backup_generations by then.
  let liftedBackups: BackupGeneration[] | null = null
  while (version < SCHEMA_VERSION) {
    if (version === 6) {
      const gens = (current as { backup_generations?: BackupGeneration[] }).backup_generations
      if (Array.isArray(gens) && gens.length > 0) liftedBackups = gens
    }
    const migrate = MIGRATIONS[version]
    if (migrate != null) {
      current = migrate(current)
    }
    version += 1
    current = { ...current, schema_version: version }
  }

  // Validate the migrated shape before persisting
  const parsed = StorageSchemaZod.safeParse(current)
  if (!parsed.success) {
    console.error('[tabNest] Migration produced invalid schema:', parsed.error.issues)
    // Write back with a migration_error flag so the UI can surface it
    // Do not write an invalid StorageSchema — only flag the error in sync_meta
    const withFlag = {
      ...(current as StorageSchema),
      sync_meta: {
        ...((current as StorageSchema).sync_meta ?? {}),
        sync_state: 'error' as const,
        error_message: `Schema migration failed: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
      },
    }
    await chromeSet(withFlag as StorageSchema)
    return
  }

  await chromeSet(parsed.data)

  // Lift captured generations into the backups key — never clobber snapshots
  // that already exist there (idempotent if onInstalled re-runs).
  if (liftedBackups !== null) {
    const existing = await chromeGetBackups()
    if (existing.length === 0) {
      await chromeSetBackups(liftedBackups)
    }
  }
```

(c) Update `stripDeviceOnlyFields` — `backup_generations` is no longer a document field, but strip it defensively (an unmigrated document, e.g. after a failed migration, must still never leak snapshots to Drive):

```ts
/**
 * Remove the fields that must never leave this device — per-device settings
 * and the legacy in-document backup snapshot. Single home for the list so a
 * future device-only field can't be forgotten at one of the exits (Drive
 * uploads, JSON exports). backup_generations moved to its own storage key in
 * v7 but is stripped defensively in case an unmigrated document passes through.
 */
export function stripDeviceOnlyFields<T extends Partial<StorageSchema>>(
  data: T,
): Omit<T, 'local_settings' | 'backup_local'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { local_settings: _ls, backup_local: _bl, backup_generations: _bg, ...rest } =
    data as T & { backup_generations?: unknown }
  return rest
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/storage.test.ts src/lib/schema.test.ts && npm run typecheck`
Expected: storage/schema suites PASS. Typecheck will FAIL in `src/newtab/App.tsx` (`data?.backup_generations` no longer exists) — that is Task 3's cue; do not fix it here.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schema.ts src/lib/storage.ts src/lib/storage.test.ts src/lib/schema.test.ts && git commit -m "Migrate backup generations out of the document schema (v7)"
```

---

### Task 3: Live backups via useLocalBackups hook

**Files:**
- Create: `src/hooks/useLocalBackups.ts`
- Modify: `src/components/Settings/SyncAndDataTab.tsx` (use the hook; drop the `backups` prop)
- Modify: `src/components/Settings/SettingsModal.tsx` (remove `backups` prop + threading)
- Modify: `src/newtab/App.tsx` (remove `backups={data?.backup_generations ?? []}`)
- Test: existing `src/components/Settings` suites must stay green (no new test file — the hook mirrors the untested-by-convention `useStorage`; `BackupsSection`'s behavior tests already cover the UI via props)

**Interfaces:**
- Consumes: `readLocalBackups` (Task 1); `BackupGeneration` type.
- Produces: `export function useLocalBackups(): BackupGeneration[]` — live-updating via `chrome.storage.local.onChanged` keyed on `'tabnest_backups'`; resolves to `[]` in non-extension contexts.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useLocalBackups.ts` (mirrors `useStorage.ts`'s subscription pattern):

```ts
import { useCallback, useEffect, useState } from 'react'
import { readLocalBackups } from '../lib/storage'
import type { BackupGeneration } from '../lib/schema'

const BACKUPS_KEY = 'tabnest_backups'

/**
 * Live view of the local backup generations (device-only `tabnest_backups`
 * key). Re-reads whenever that key changes — e.g. a background sync pushing a
 * new pre-overwrite snapshot while Settings is open. Resolves to [] in
 * non-extension contexts (dev server, storybook).
 */
export function useLocalBackups(): BackupGeneration[] {
  const [backups, setBackups] = useState<BackupGeneration[]>([])

  const refetch = useCallback((): void => {
    readLocalBackups()
      .then(setBackups)
      .catch(() => setBackups([]))
  }, [])

  useEffect(() => {
    refetch()

    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
    ): void {
      if (BACKUPS_KEY in changes) {
        refetch()
      }
    }

    try {
      chrome.storage.local.onChanged.addListener(handleStorageChange)
    } catch {
      // Non-extension context — skip listener setup
    }

    return () => {
      try {
        chrome.storage.local.onChanged.removeListener(handleStorageChange)
      } catch {
        // Non-extension context
      }
    }
  }, [refetch])

  return backups
}
```

- [ ] **Step 2: Consume it in SyncAndDataTab and remove the prop threading**

In `src/components/Settings/SyncAndDataTab.tsx`:
- Add `import { useLocalBackups } from '../../hooks/useLocalBackups'`.
- Remove `backups?: BackupGeneration[]` from `SyncAndDataTabProps`, remove `backups = []` from the destructure, and remove the now-unused `BackupGeneration` type import.
- At the top of the component body add `const backups = useLocalBackups()`, and update the state comment:

```ts
  // Local backup restore state — the backups themselves come from the
  // useLocalBackups hook, live via the tabnest_backups key's onChanged.
```

(The `<BackupsSection backups={backups} ... />` JSX is unchanged.)

In `src/components/Settings/SettingsModal.tsx`: remove the `backups?: BackupGeneration[]` prop and its doc comment, the `backups = [],` destructure line, the `backups={backups}` pass-through on the `SyncAndDataTab` element, and the `BackupGeneration` import.

In `src/newtab/App.tsx`: remove the line `backups={data?.backup_generations ?? []}`.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npx vitest run src/components/Settings src/hooks 2>&1 | tail -3`
Expected: all PASS (typecheck failure from Task 2 is resolved; Settings tests render with the hook returning `[]` in jsdom via the `.catch`).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useLocalBackups.ts src/components/Settings/SyncAndDataTab.tsx src/components/Settings/SettingsModal.tsx src/newtab/App.tsx && git commit -m "Read local backups live from their own key via useLocalBackups"
```

---

### Task 4: Docs, full verification, PR

**Files:**
- Modify: `CLAUDE.md` (storage section: schema v7 + second key; Drive sync paragraph)
- Modify: `.claude/docs/TabNest_Specification.md` (§2.3 example note, §9.2 versioning row)

- [ ] **Step 1: Update CLAUDE.md**

In the Storage layer section: change `Current schema: v6.` to `Current schema: v7.` and append this bullet to the storage-layer contract list:

```markdown
- Backup snapshots live under a separate device-only `tabnest_backups` key (issue #14) — never in the hot `tabnest_data` document, never synced or exported. Access only via `pushLocalBackup` / `readLocalBackups` / `restoreLocalBackup`.
```

In the Drive sync paragraph, replace `` `local_settings`, `backup_local` (legacy), and `backup_generations` are stripped from every Drive write.`` with:

```markdown
`local_settings` and `backup_local` (legacy) are stripped from every Drive write; backup snapshots live outside the synced document entirely (`tabnest_backups` key).
```

- [ ] **Step 2: Update the spec**

In `.claude/docs/TabNest_Specification.md` §2.3, replace the line
`  "backup_generations": "… up to 3 pre-overwrite workspace snapshots, newest first — device-only",`
with nothing (delete it), and after the closing code fence add:

```markdown
Backup snapshots (up to 3 pre-overwrite workspace trees, newest first) live under a separate device-only `tabnest_backups` storage key — outside this document, so routine reads/writes don't pay for them.
```

In §9.2's Versioning row, change `up to 3 local pre-overwrite snapshots (`backup_generations`)` to `up to 3 local pre-overwrite snapshots (device-only `tabnest_backups` key)`.

- [ ] **Step 3: Full verification**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 4: Commit docs, push, open PR**

```bash
git add CLAUDE.md .claude/docs/TabNest_Specification.md && git commit -m "Document the tabnest_backups storage key and schema v7" && git push -u origin fix/backups-own-storage-key
```

Open a PR against `main` titled `Move backup generations to their own storage key` whose body covers: the hot-document cost being removed (per-write serialization and onChanged payloads), the v6→v7 migration with idempotent lift (covering v5's `backup_local` chain too), unchanged public API, the crash-safe backups-first restore ordering, the live `useLocalBackups` hook replacing prop threading, and `Fixes #14`. NO session links, no generated-with footer.

---

## Self-review notes

- **Issue #14 coverage:** separate key ✓ (Task 1); migration lifting v6 AND v5-origin data ✓ (Task 2, capture-at-v6 trick); strip helper keeps stripping defensively ✓; live Settings updates preserved via new-key subscription ✓ (Task 3); backups-first restore ordering ✓; quota note needs no code (per-area accounting).
- **Deadlock check:** `restoreLocalBackup` composes `chromeGetBackups → chromeSetBackups → applyWrite` inside ONE `enqueueWrite`; nothing inside queued work calls `writeStorage`/`pushLocalBackup` (which would enqueue behind itself). `migrateIfNeeded` doesn't use the queue at all (matches existing behavior).
- **Type consistency:** `applyWrite` (Task 1) is what Task 1's `restoreLocalBackup` calls; `chromeGetBackups`/`chromeSetBackups` names match between Tasks 1 and 2; `useLocalBackups(): BackupGeneration[]` matches Task 3's usage; `storedBackups()` helper is defined in Task 1 Step 1 and reused by Task 2's tests.
- **Consumers audit:** all `onChanged` listeners key on `'tabnest_data'` (useStorage.ts:5, ThemeProvider.tsx:134, background/index.ts:323) — unaffected by the new key. PopupApp reads `tabnest_data` directly (read-only) — unaffected. Export reads `tabnest_data` raw — post-migration it contains no snapshots, and `stripDeviceOnlyFields` still strips defensively.
