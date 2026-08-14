/**
 * storage.ts
 * Single source of truth for all chrome.storage.local access.
 * No other module in the codebase should call chrome.storage directly.
 *
 * Design contract:
 *  - All reads fall back to safe defaults when storage is empty.
 *  - All writes merge into the existing document (never full-replace).
 *  - Quota errors are caught and re-thrown with a typed message so callers
 *    can surface a meaningful notification.
 *  - The migration table is forward-only and idempotent.
 */

import {
  StorageSchemaZod,
  TabGroupSchema,
  WorkspaceSchema,
  CategorySchema,
  SavedTabSchema,
  DEFAULT_SETTINGS,
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_SYNC_META,
  DEFAULT_WORKSPACE,
  SCHEMA_VERSION,
  type StorageSchema,
  type Category,
  type Workspace,
  type TabGroup,
  type TrashItem,
  type SyncMeta,
  type UserSettings,
  type LocalSettings,
  type BackupGeneration,
  type SavedTab,
  type Note,
  type TrashLocation,
  isThemePreference,
} from './schema'
import { tombstonesFromTrash, stampRestoredCategories } from './merge'

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'tabnest_data'

/** Backup snapshots live OUTSIDE the hot document (issue #14) — every
 *  read-modify-write of tabnest_data would otherwise haul up to
 *  BACKUP_GENERATIONS_MAX full workspace trees through serialization. */
const BACKUPS_KEY = 'tabnest_backups'

// ---------------------------------------------------------------------------
// Write queue — serializes concurrent writes to prevent race conditions
// (MV3 service workers are single-threaded JS but async interleaving is real)
// ---------------------------------------------------------------------------

let writeQueue: Promise<void> = Promise.resolve()

/**
 * Enqueue a write behind all previously queued writes.
 * The returned promise reflects this write's own outcome, but the queue
 * itself always settles — a failed write must not poison later writes.
 */
function enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(work, work)
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

// ---------------------------------------------------------------------------
// Migration table
// Each key is the schema_version the data is currently AT, the function
// returns data upgraded to version + 1.
// Empty for v1 — add entries here as the schema evolves.
// ---------------------------------------------------------------------------

// Migrations operate on arbitrary, not-yet-validated legacy data shapes, so
// both the input and the output are intentionally `any`. The per-migration
// `data` params below infer this `any` from the signature (no explicit
// annotation needed), keeping the no-explicit-any disable to this one line.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MIGRATIONS: Record<number, (data: any) => any> = {
  /**
   * v1 → v2: Move sync_enabled and sync_interval_minutes out of `settings`
   * (which syncs to Drive) into `local_settings` (device-only, never synced).
   */
  1: (data) => {
    const { sync_enabled, sync_interval_minutes, ...sharedSettings } = data.settings ?? {}
    return {
      ...data,
      schema_version: 2,
      settings: sharedSettings,
      local_settings: {
        sync_enabled: sync_enabled ?? DEFAULT_LOCAL_SETTINGS.sync_enabled,
        sync_interval_minutes: sync_interval_minutes ?? DEFAULT_LOCAL_SETTINGS.sync_interval_minutes,
      },
    }
  },

  /**
   * v2 → v3: Clear accent_color if it still holds the old hardcoded default
   * (#1A56DB). Empty string means "use the CSS token" — no inline override.
   */
  2: (data) => ({
    ...data,
    schema_version: 3,
    settings: {
      ...data.settings,
      accent_color: data.settings?.accent_color === '#1A56DB' ? '' : (data.settings?.accent_color ?? ''),
    },
  }),

  /**
   * v3 → v4: Remove accent_color entirely — colors come from CSS themes only.
   */
  3: (data) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { accent_color: _removed, ...rest } = data.settings ?? {}
    return { ...data, schema_version: 4, settings: rest }
  },

  /**
   * v4 → v5: Categories gain a standalone `notes` array (spec §7.1).
   */
  4: (data) => ({
    ...data,
    schema_version: 5,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workspaces: (data.workspaces ?? []).map((ws: any) => ({
      ...ws,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categories: (ws.categories ?? []).map((cat: any) => ({ ...cat, notes: cat.notes ?? [] })),
    })),
  }),

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
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * First-run content (spec §15): a "Getting Started" category with a welcome
 * group of example tabs. Only added by buildDefaultStorage (fresh installs) —
 * new workspaces created later start with just the default category.
 */
function buildGettingStartedCategory(): Category {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name: 'Getting Started',
    color: '#10b981',
    emoji: '👋',
    collapsed: false,
    order: 1,
    notes: [],
    groups: [
      {
        id: crypto.randomUUID(),
        name: 'Welcome to Tab Nest',
        created_at: now,
        updated_at: now,
        order: 0,
        notes: [{
          id: crypto.randomUUID(),
          content: 'Tips:\n- [ ] Save a tab from the **Active Tabs** panel\n- [ ] Press `/` to search\n- [ ] Press `N` to create a group',
          created_at: now,
          updated_at: now,
        }],
        tabs: [
          {
            id: crypto.randomUUID(),
            title: 'Tab Nest — Help & Documentation',
            url: 'https://github.com/OffBy1-tech/TabNest#readme',
            saved_at: now,
          },
          {
            id: crypto.randomUUID(),
            title: 'Keyboard shortcuts',
            url: 'https://github.com/OffBy1-tech/TabNest#keyboard-shortcuts',
            saved_at: now,
          },
        ],
      },
    ],
  }
}

function buildDefaultStorage(): StorageSchema {
  const workspace = DEFAULT_WORKSPACE()
  workspace.categories = [...workspace.categories, buildGettingStartedCategory()]
  return {
    schema_version: SCHEMA_VERSION,
    workspaces: [workspace],
    settings: {
      ...DEFAULT_SETTINGS,
      default_workspace_id: workspace.id,
    },
    local_settings: { ...DEFAULT_LOCAL_SETTINGS },
    sync_meta: DEFAULT_SYNC_META(),
    trash: [],
  }
}

/** Promise wrapper for chrome.storage.local.get of several keys at once. */
function rawGetMany(keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve(result)
      })
    } catch (err) {
      reject(err)
    }
  })
}

/** Promise wrapper for chrome.storage.local.get of one key. */
async function rawGet<T>(key: string): Promise<T | undefined> {
  return (await rawGetMany([key]))[key] as T | undefined
}

/** rawSet that swallows non-extension-context failures — for best-effort
 *  device-only keys (popup state, onboarding flag) that must degrade
 *  gracefully in Vitest / Storybook / the dev server. */
async function rawSetSafe(items: Record<string, unknown>): Promise<void> {
  try {
    await rawSet(items)
  } catch {
    // Non-extension context
  }
}

/** Promise wrapper for chrome.storage.local.remove. */
function rawRemove(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve()
      })
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Promise wrapper for chrome.storage.local.set.
 * Re-throws QuotaExceededError with a clear label so callers can distinguish —
 * inherited by every key written through here.
 */
function rawSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message ?? 'Unknown storage error'
          // Chrome surfaces quota errors via this message string
          if (msg.toLowerCase().includes('quota')) {
            reject(new Error(`QuotaExceededError: ${msg}`))
          } else {
            reject(new Error(msg))
          }
          return
        }
        resolve()
      })
    } catch (err) {
      reject(err)
    }
  })
}

/** The main document, or `null` when absent (fresh install). */
async function chromeGet(): Promise<StorageSchema | null> {
  return (await rawGet<StorageSchema>(STORAGE_KEY)) ?? null
}

async function chromeSet(data: StorageSchema): Promise<void> {
  return rawSet({ [STORAGE_KEY]: data })
}

/** The backup generations, or [] when absent. Rejects in non-extension contexts (matching chromeGet). */
async function chromeGetBackups(): Promise<BackupGeneration[]> {
  return (await rawGet<BackupGeneration[]>(BACKUPS_KEY)) ?? []
}

async function chromeSetBackups(generations: BackupGeneration[]): Promise<void> {
  return rawSet({ [BACKUPS_KEY]: generations })
}

// ---------------------------------------------------------------------------
// Change subscriptions — UI hooks listen through these so key names and
// chrome.storage event plumbing stay inside this module.
// ---------------------------------------------------------------------------

function subscribeToKey(
  key: string,
  onChange: (change: chrome.storage.StorageChange) => void,
): () => void {
  function listener(changes: Record<string, chrome.storage.StorageChange>): void {
    const change = changes[key]
    if (change !== undefined) onChange(change)
  }
  try {
    chrome.storage.local.onChanged.addListener(listener)
  } catch {
    return () => undefined // non-extension context — nothing to unsubscribe
  }
  return () => {
    try {
      chrome.storage.local.onChanged.removeListener(listener)
    } catch {
      // non-extension context
    }
  }
}

/** Fires when the main document changes. Returns an unsubscribe function; no-ops outside extension contexts. */
export function subscribeToStorageChange(
  onChange: (change: chrome.storage.StorageChange) => void,
): () => void {
  return subscribeToKey(STORAGE_KEY, onChange)
}

/** Fires when the backup generations change. Returns an unsubscribe function; no-ops outside extension contexts. */
export function subscribeToBackupsChange(
  onChange: (change: chrome.storage.StorageChange) => void,
): () => void {
  return subscribeToKey(BACKUPS_KEY, onChange)
}

// ---------------------------------------------------------------------------
// Public API — core read / write
// ---------------------------------------------------------------------------

/**
 * Read the full storage document, returning defaults when empty.
 * Does NOT validate with Zod on every read (too expensive in the hot path);
 * Zod validation is reserved for import/migration boundaries.
 */
export async function readStorage(): Promise<StorageSchema> {
  const raw = await chromeGet()
  if (raw == null) {
    return buildDefaultStorage()
  }
  return raw
}

/** The write itself — read, patch, bump, persist. Only call while holding the
 *  queue (from writeStorage, or from queued work composing multiple steps —
 *  calling writeStorage from inside queued work would deadlock). Pass
 *  `preloaded` when the caller already read the document inside the queue. */
async function applyWrite(
  patchOrUpdate:
    | Partial<StorageSchema>
    | ((current: StorageSchema) => Partial<StorageSchema> | null),
  preloaded?: StorageSchema,
): Promise<StorageSchema> {
  const current = preloaded ?? (await readStorage())
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

/**
 * Merge a patch into the current storage document and persist, returning the
 * document as written. Always read-before-write — never clobbers fields not
 * in the patch. Serialized via writeQueue to prevent concurrent-write races.
 *
 * Accepts either a plain patch or an updater function. An updater runs inside
 * the queue against the freshest document — use it whenever the patch depends
 * on current state (read-modify-write) so a concurrent write can't be lost
 * between read and set. An updater may return null to skip the write entirely.
 *
 * Auto-bumps `sync_meta.last_modified_at` whenever user-data fields
 * (workspaces, settings, trash) are included in the patch, so that
 * Drive sync conflict resolution can determine which device has the
 * freshest data.
 */
export function writeStorage(
  patchOrUpdate:
    | Partial<StorageSchema>
    | ((current: StorageSchema) => Partial<StorageSchema> | null),
): Promise<StorageSchema> {
  return enqueueWrite(() => applyWrite(patchOrUpdate))
}

// ---------------------------------------------------------------------------
// Shared mutation helpers
// ---------------------------------------------------------------------------

/**
 * The one place a TrashItem is built. Every delete path must call this — the
 * trash entry doubles as the sync tombstone that stops mergeSyncedState from
 * resurrecting the deletion. `hidden: true` marks pure tombstones (tab moves,
 * note clears) that are not user-visible deletions and stay out of the Trash UI.
 */
function makeTrashItem(
  type: TrashItem['type'],
  data: unknown,
  original_location: TrashLocation,
  opts: { hidden?: boolean; at?: number } = {},
): TrashItem {
  return {
    id: crypto.randomUUID(),
    type,
    data,
    original_location,
    deleted_at: opts.at ?? Date.now(),
    ...(opts.hidden ? { hidden: true } : {}),
  }
}

/** The one place a brand-new TabGroup is built. */
function makeNewGroup(name: string, order: number, tabs: SavedTab[], at: number): TabGroup {
  return { id: crypto.randomUUID(), name, created_at: at, updated_at: at, order, tabs, notes: [] }
}

/** Apply `fn` to one category, leaving every other node untouched. */
function updateCategoryIn(
  workspaces: Workspace[],
  workspaceId: string,
  categoryId: string,
  fn: (cat: Category) => Category,
): Workspace[] {
  return workspaces.map((ws) =>
    ws.id !== workspaceId
      ? ws
      : { ...ws, categories: ws.categories.map((cat) => (cat.id === categoryId ? fn(cat) : cat)) },
  )
}

// ---------------------------------------------------------------------------
// Workspace operations
// ---------------------------------------------------------------------------

export async function getWorkspaces(): Promise<Workspace[]> {
  const data = await readStorage()
  return data.workspaces
}

/**
 * Upsert a workspace: replaces an existing workspace with the same id,
 * or appends a new one.
 */
export async function saveWorkspace(workspace: Workspace): Promise<void> {
  await writeStorage((data) => {
    const idx = data.workspaces.findIndex((w) => w.id === workspace.id)
    const updated =
      idx === -1
        ? [...data.workspaces, workspace]
        : data.workspaces.map((w) => (w.id === workspace.id ? workspace : w))
    return { workspaces: updated }
  })
}

/**
 * Delete a workspace, moving it (and all contained data) to Trash so the
 * deletion is recoverable (spec §10). Returns the TrashItem for undo flows.
 */
export async function deleteWorkspace(id: string): Promise<TrashItem> {
  let trashItem!: TrashItem
  await writeStorage((data) => {
    const workspace = data.workspaces.find((w) => w.id === id)
    if (workspace == null) {
      throw new Error(`Workspace ${id} not found`)
    }

    trashItem = makeTrashItem('workspace', workspace, { workspace_id: id })

    return {
      workspaces: data.workspaces.filter((w) => w.id !== id),
      trash: [...data.trash, trashItem],
    }
  })
  return trashItem
}

// ---------------------------------------------------------------------------
// Tab group operations
// ---------------------------------------------------------------------------

/**
 * Upsert a TabGroup inside the specified category + workspace.
 * Creates intermediate structures if they are somehow missing (defensive).
 */
export async function saveTabGroup(params: {
  group: TabGroup
  categoryId: string
  workspaceId: string
}): Promise<void> {
  const { group, categoryId, workspaceId } = params
  await writeStorage((data) => ({
    workspaces: data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      const categories = ws.categories.map((cat) => {
        if (cat.id !== categoryId) return cat
        const idx = cat.groups.findIndex((g) => g.id === group.id)
        const groups =
          idx === -1
            ? [...cat.groups, group]
            : cat.groups.map((g) => (g.id === group.id ? group : g))
        return { ...cat, groups }
      })
      return { ...ws, categories }
    }),
  }))
}

/**
 * Remove a TabGroup, move it to trash, and return the TrashItem so the
 * caller can offer an undo action.
 */
export async function deleteTabGroup(params: {
  groupId: string
  categoryId: string
  workspaceId: string
}): Promise<TrashItem> {
  const { groupId, categoryId, workspaceId } = params
  let trashItem!: TrashItem
  await writeStorage((data) => {
    let deleted: TabGroup | undefined

    const workspaces = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      const categories = ws.categories.map((cat) => {
        if (cat.id !== categoryId) return cat
        deleted = cat.groups.find((g) => g.id === groupId)
        return { ...cat, groups: cat.groups.filter((g) => g.id !== groupId) }
      })
      return { ...ws, categories }
    })

    if (deleted == null) {
      throw new Error(`Group ${groupId} not found in category ${categoryId}`)
    }

    trashItem = makeTrashItem('group', deleted, {
      workspace_id: workspaceId,
      category_id: categoryId,
    })

    return { workspaces, trash: [...data.trash, trashItem] }
  })
  return trashItem
}

/**
 * Rename a tab group in place.
 *
 * The bump is what makes the rename survive sync: mergeGroups keeps the copy
 * with the newer `updated_at` and breaks ties in favor of local, so a rename
 * that left the timestamp alone would be discarded on every other device. A
 * no-op rename (unchanged or blank name) skips the write entirely — bumping
 * there would let an idle device's stale copy outrank a real rename made
 * elsewhere, and InlineNameEditor commits on blur, so "click a name, click
 * away" would otherwise cost a full document write and a Drive push.
 */
export async function renameGroup(
  workspaceId: string,
  categoryId: string,
  groupId: string,
  name: string,
): Promise<void> {
  await writeStorage((data) => {
    let renamed = false
    const workspaces = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      const categories = ws.categories.map((cat) => {
        if (cat.id !== categoryId) return cat
        const groups = cat.groups.map((g) => {
          if (g.id !== groupId) return g
          const next = name.trim()
          if (next === '' || next === g.name) return g
          renamed = true
          return { ...g, name: next, updated_at: Date.now() }
        })
        return { ...cat, groups }
      })
      return { ...ws, categories }
    })
    return renamed ? { workspaces } : null // no-op — skip the write entirely
  })
}

/**
 * Remove a single tab from a group, recording it in Trash. If the group
 * becomes empty it is kept (the user can delete the empty group explicitly).
 * The trash entry doubles as the sync tombstone — without it,
 * mergeSyncedState would union the tab back in from a stale remote copy.
 */
export async function removeTabFromGroup(
  workspaceId: string,
  categoryId: string,
  groupId: string,
  tabId: string,
): Promise<void> {
  await writeStorage((data) => {
    const now = Date.now()
    let removed: SavedTab | undefined
    const workspaces = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      const categories = ws.categories.map((cat) => {
        if (cat.id !== categoryId) return cat
        const groups = cat.groups.map((g) => {
          if (g.id !== groupId) return g
          const found = g.tabs.find((t) => t.id === tabId)
          if (found == null) return g
          removed = found
          return { ...g, tabs: g.tabs.filter((t) => t.id !== tabId), updated_at: now }
        })
        return { ...cat, groups }
      })
      return { ...ws, categories }
    })

    if (removed == null) return null // tab not found — nothing to write

    const trashItem = makeTrashItem(
      'tab',
      removed,
      { workspace_id: workspaceId, category_id: categoryId, group_id: groupId },
      { at: now },
    )
    return { workspaces, trash: [...data.trash, trashItem] }
  })
}

/**
 * Rename a category in place.
 */
export async function renameCategory(
  workspaceId: string,
  categoryId: string,
  name: string,
): Promise<void> {
  await writeStorage((data) => ({
    workspaces: data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      const categories = ws.categories.map((cat) =>
        cat.id === categoryId
          ? { ...cat, name: name.trim() || cat.name, updated_at: Date.now() }
          : cat,
      )
      return { ...ws, categories }
    }),
  }))
}

/**
 * Patch presentational fields of a category (color, emoji) in place.
 */
export async function patchCategory(
  workspaceId: string,
  categoryId: string,
  patch: Partial<Pick<Category, 'color' | 'emoji'>>,
): Promise<void> {
  await writeStorage((data) => ({
    workspaces: data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return {
        ...ws,
        categories: ws.categories.map((cat) =>
          cat.id === categoryId ? { ...cat, ...patch, updated_at: Date.now() } : cat,
        ),
      }
    }),
  }))
}

/**
 * Show or hide every category in the All view at once (spec §3.3).
 *
 * Despite the field name, `collapsed` is not viewport state — it is the
 * per-category "hide from the All view" filter behind CategoryList's Eye
 * toggle, which App.tsx reads to decide which groups and notes the All view
 * shows. That makes it a saved content preference, so it bumps `updated_at`
 * like any other synced scalar: without the bump mergeCategories keeps the
 * other device's stale value and the choice never propagates.
 */
export async function setAllCategoriesCollapsed(
  workspaceId: string,
  collapsed: boolean,
): Promise<void> {
  await writeStorage((data) => {
    let changed = false
    const workspaces = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      const now = Date.now()
      const categories = ws.categories.map((cat) => {
        if (cat.collapsed === collapsed) return cat
        changed = true
        return { ...cat, collapsed, updated_at: now }
      })
      return { ...ws, categories }
    })
    return changed ? { workspaces } : null // already all shown/hidden
  })
}

/** Show or hide one category in the All view — see setAllCategoriesCollapsed. */
export async function setCategoryCollapsed(
  workspaceId: string,
  categoryId: string,
  collapsed: boolean,
): Promise<void> {
  await writeStorage((data) => {
    let changed = false
    const workspaces = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return {
        ...ws,
        categories: ws.categories.map((cat) => {
          if (cat.id !== categoryId || cat.collapsed === collapsed) return cat
          changed = true
          return { ...cat, collapsed, updated_at: Date.now() }
        }),
      }
    })
    return changed ? { workspaces } : null
  })
}

/**
 * Delete a category (and all its groups), moving it to Trash so the deletion
 * is recoverable and propagates through sync as a tombstone instead of being
 * resurrected by the next union merge.
 */
export async function deleteCategory(
  workspaceId: string,
  categoryId: string,
): Promise<void> {
  await writeStorage((data) => {
    let deleted: Category | undefined
    const workspaces = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      deleted = ws.categories.find((cat) => cat.id === categoryId) ?? deleted
      return { ...ws, categories: ws.categories.filter((cat) => cat.id !== categoryId) }
    })

    if (deleted == null) return null // category not found — nothing to write

    const trashItem = makeTrashItem('category', deleted, {
      workspace_id: workspaceId,
      category_id: categoryId,
    })
    return { workspaces, trash: [...data.trash, trashItem] }
  })
}

// ---------------------------------------------------------------------------
// Sync metadata operations
// ---------------------------------------------------------------------------

export async function getSyncMeta(): Promise<SyncMeta> {
  const data = await readStorage()
  return data.sync_meta
}

export async function patchSyncMeta(patch: Partial<SyncMeta>): Promise<void> {
  await writeStorage((data) => ({ sync_meta: { ...data.sync_meta, ...patch } }))
}

export async function patchSettings(patch: Partial<UserSettings>): Promise<void> {
  await writeStorage((data) => ({ settings: { ...data.settings, ...patch } }))
}

/**
 * Patch per-device local settings (sync_enabled, sync_interval_minutes).
 * Never bumps last_modified_at — these fields are not synced to Drive.
 */
export async function patchLocalSettings(patch: Partial<LocalSettings>): Promise<void> {
  // Updater form: the merge happens inside the queue against the freshest
  // document, so a concurrent local_settings write isn't clobbered.
  await writeStorage((current) => ({
    local_settings: { ...current.local_settings, ...patch },
  }))
}

// ---------------------------------------------------------------------------
// Local backup (written before a Drive overwrite to enable rollback).
// Generational (issue #5): the newest BACKUP_GENERATIONS_MAX snapshots are
// kept so one redundant remote-wins cycle can no longer destroy the only
// copy of the losing side's data.
// ---------------------------------------------------------------------------

export const BACKUP_GENERATIONS_MAX = 3

/**
 * Prepend a snapshot of `workspaces` to `generations`, evicting the oldest
 * beyond BACKUP_GENERATIONS_MAX. Returns null when the newest generation is
 * already identical — a snapshot adding no information must not churn unique
 * older generations out of the list.
 */
function prependGeneration(
  generations: BackupGeneration[],
  workspaces: Workspace[],
): BackupGeneration[] | null {
  const newest = generations[0]
  if (newest != null && JSON.stringify(newest.workspaces) === JSON.stringify(workspaces)) {
    return null
  }
  return [{ saved_at: Date.now(), workspaces }, ...generations].slice(0, BACKUP_GENERATIONS_MAX)
}

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

/**
 * Replace current workspaces with backup generation `index` (0 = newest).
 * The current workspaces are pushed as a new generation first, so a restore
 * is itself undoable. Settings and trash are untouched (backups don't
 * contain them). Throws when the generation doesn't exist.
 *
 * Every restored category and group is re-stamped as touched now: tombstone
 * suppression in merge.ts compares per-entity timestamps (not the document's
 * last_modified_at), so without the stamp a group deleted after the snapshot
 * would be silently re-deleted by the next merge-path sync. Tabs and notes
 * are re-stamped only when a live tombstone targets them, keeping saved_at
 * historically accurate everywhere else.
 */
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

    const restoredAt = Date.now()
    const tombs = tombstonesFromTrash(current.trash)
    const workspaces = generation.workspaces.map((ws) => ({
      ...ws,
      categories: stampRestoredCategories(ws.categories, restoredAt, tombs),
    }))
    await applyWrite({ workspaces }, current)
  })
}

// ---------------------------------------------------------------------------
// Popup state (device-only): recent save targets and last-selected workspace.
// Lives here so chrome.storage key names and plumbing stay inside this module.
// All accessors degrade gracefully outside an extension context.
// ---------------------------------------------------------------------------

const POPUP_RECENT_GROUPS_KEY = 'tabnest_popup_recent_groups'
const POPUP_LAST_WORKSPACE_KEY = 'tabnest_popup_last_workspace'

export interface PopupRecentGroup {
  groupId: string
  groupName: string
  categoryId: string
  workspaceId: string
}

export interface PopupState {
  recentGroups: PopupRecentGroup[]
  lastWorkspaceId: string | null
}

/** Both popup keys in a single storage read (the popup-open path is latency-sensitive). */
export async function readPopupState(): Promise<PopupState> {
  try {
    const result = await rawGetMany([POPUP_RECENT_GROUPS_KEY, POPUP_LAST_WORKSPACE_KEY])
    const rawGroups = result[POPUP_RECENT_GROUPS_KEY]
    const rawWs = result[POPUP_LAST_WORKSPACE_KEY]
    return {
      recentGroups: Array.isArray(rawGroups) ? (rawGroups as PopupRecentGroup[]) : [],
      lastWorkspaceId: typeof rawWs === 'string' ? rawWs : null,
    }
  } catch {
    return { recentGroups: [], lastWorkspaceId: null } // non-extension context
  }
}

export async function writePopupRecentGroups(groups: PopupRecentGroup[]): Promise<void> {
  await rawSetSafe({ [POPUP_RECENT_GROUPS_KEY]: groups })
}

export async function writePopupLastWorkspaceId(id: string): Promise<void> {
  await rawSetSafe({ [POPUP_LAST_WORKSPACE_KEY]: id })
}

// ---------------------------------------------------------------------------
// Onboarding flag (device-only). Not part of the synced document — a new
// device should see onboarding once regardless of Drive state.
// ---------------------------------------------------------------------------

const ONBOARDING_COMPLETED_KEY = 'onboarding_completed'

/** True once the user has completed or skipped onboarding. Rejects outside extension contexts. */
export async function readOnboardingCompleted(): Promise<boolean> {
  return (await rawGet<boolean>(ONBOARDING_COMPLETED_KEY)) === true
}

/** Mark onboarding as done. Best-effort: no-ops outside extension contexts. */
export async function writeOnboardingCompleted(): Promise<void> {
  await rawSetSafe({ [ONBOARDING_COMPLETED_KEY]: true })
}

// ---------------------------------------------------------------------------
// Device-only field stripping
// ---------------------------------------------------------------------------

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
  const { local_settings: _ls, backup_local: _bl, ...rest } = data
  // backup_generations left the schema in v7; delete defensively for unmigrated docs
  delete (rest as { backup_generations?: unknown }).backup_generations
  return rest
}

// ---------------------------------------------------------------------------
// Trash operations
// ---------------------------------------------------------------------------

/**
 * Restore a trashed item back to its original location.
 * Currently handles 'group' type; extend the switch for other types.
 */
export async function restoreFromTrash(itemId: string): Promise<void> {
  await writeStorage((data) => {
    const item = data.trash.find((t) => t.id === itemId)

    if (item == null) {
      throw new Error(`Trash item ${itemId} not found`)
    }

    const trash = data.trash.filter((t) => t.id !== itemId)

    if (item.type === 'group') {
      const groupParsed = TabGroupSchema.safeParse(item.data)
      if (!groupParsed.success) {
        throw new Error(`Cannot restore group ${itemId}: stored data failed schema validation`)
      }
      // Restoring must outrank the deletion tombstone in sync merges (see
      // applyTombstones in merge.ts) — a restore is an edit, stamp it as one.
      const group: TabGroup = { ...groupParsed.data, updated_at: Date.now() }
      const { workspace_id, category_id } = item.original_location

      // Fall back to first available workspace/category if original location was deleted
      const targetWs =
        data.workspaces.find((ws) => ws.id === workspace_id) ?? data.workspaces[0]
      const targetCat =
        (targetWs?.categories.find((c) => c.id === category_id) ?? targetWs?.categories[0])

      if (!targetWs || !targetCat) {
        // No workspaces exist — remove from trash anyway to avoid stale entries
        return { trash }
      }

      const workspaces = updateCategoryIn(data.workspaces, targetWs.id, targetCat.id, (cat) =>
        // Idempotency guard — don't duplicate if already restored
        cat.groups.some((g) => g.id === group.id) ? cat : { ...cat, groups: [...cat.groups, group] },
      )

      return { workspaces, trash }
    }

    if (item.type === 'workspace') {
      const wsParsed = WorkspaceSchema.safeParse(item.data)
      if (!wsParsed.success) {
        throw new Error(`Cannot restore workspace ${itemId}: stored data failed schema validation`)
      }
      // Same tombstone rule as groups: bump the workspace and its nested
      // categories and groups so the restored workspace outranks its deletion
      // tombstone in sync merges (updated_at covers empty workspaces, whose
      // last-touch would otherwise fall back to the old created_at).
      const restoredAt = Date.now()
      const workspace: Workspace = {
        ...wsParsed.data,
        updated_at: restoredAt,
        categories: stampRestoredCategories(wsParsed.data.categories, restoredAt),
      }
      // Idempotency guard — don't duplicate if already restored
      const workspaces = data.workspaces.some((w) => w.id === workspace.id)
        ? data.workspaces
        : [...data.workspaces, workspace]
      return { workspaces, trash }
    }

    if (item.type === 'category') {
      const catParsed = CategorySchema.safeParse(item.data)
      if (!catParsed.success) {
        throw new Error(`Cannot restore category ${itemId}: stored data failed schema validation`)
      }
      // Stamp the category and its groups as touched now so the restore
      // outranks the deletion tombstone (updated_at covers empty categories).
      const [category] = stampRestoredCategories([catParsed.data], Date.now())

      const targetWs =
        data.workspaces.find((ws) => ws.id === item.original_location.workspace_id) ??
        data.workspaces[0]
      if (!targetWs) return { trash }

      const workspaces = data.workspaces.map((ws) => {
        if (ws.id !== targetWs.id) return ws
        // Idempotency guard — don't duplicate if already restored
        if (ws.categories.some((c) => c.id === category!.id)) return ws
        return { ...ws, categories: [...ws.categories, { ...category!, order: ws.categories.length }] }
      })
      return { workspaces, trash }
    }

    if (item.type === 'tab') {
      const tabParsed = SavedTabSchema.safeParse(item.data)
      if (!tabParsed.success) {
        throw new Error(`Cannot restore tab ${itemId}: stored data failed schema validation`)
      }
      // Tab tombstones compare against saved_at — re-stamp so the restored
      // tab outranks the deletion tombstone in sync merges.
      const restoredAt = Date.now()
      const tab: SavedTab = { ...tabParsed.data, saved_at: restoredAt }
      const { workspace_id, category_id, group_id } = item.original_location

      const targetWs =
        data.workspaces.find((ws) => ws.id === workspace_id) ?? data.workspaces[0]
      if (!targetWs) return { trash }

      // The original group may have moved categories since — search the whole
      // workspace for it before falling back to a fresh "Restored" group in
      // the original (or first) category, so the tab isn't silently dropped.
      const homeCat = group_id
        ? targetWs.categories.find((c) => c.groups.some((g) => g.id === group_id))
        : undefined
      const targetCat =
        homeCat ??
        targetWs.categories.find((c) => c.id === category_id) ??
        targetWs.categories[0]
      if (!targetCat) return { trash }

      const workspaces = updateCategoryIn(data.workspaces, targetWs.id, targetCat.id, (cat) =>
        homeCat
          ? {
              ...cat,
              groups: cat.groups.map((g) => {
                if (g.id !== group_id) return g
                // Idempotency guard — don't duplicate if already restored
                if (g.tabs.some((t) => t.id === tab.id)) return g
                return { ...g, tabs: [...g.tabs, tab], updated_at: restoredAt }
              }),
            }
          : { ...cat, groups: [...cat.groups, makeNewGroup('Restored', cat.groups.length, [tab], restoredAt)] },
      )
      return { workspaces, trash }
    }

    // Note tombstones are hidden bookkeeping — nothing to restore; just
    // drop the entry.
    return { trash }
  })
}

/**
 * Rename an existing workspace by id. Bumps `updated_at` and skips no-op
 * renames for the same reasons as renameGroup.
 */
export async function renameWorkspace(workspaceId: string, name: string): Promise<void> {
  await writeStorage((data) => {
    let renamed = false
    const workspaces = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      const next = name.trim()
      if (next === '' || next === ws.name) return ws
      renamed = true
      return { ...ws, name: next, updated_at: Date.now() }
    })
    return renamed ? { workspaces } : null // no-op — skip the write entirely
  })
}

/**
 * Add a new category to the specified workspace.
 * Returns the new category's id.
 */
export async function createCategory(workspaceId: string, name: string): Promise<string> {
  const categoryId = crypto.randomUUID()
  await writeStorage((data) => {
    const category: Category = {
      id: categoryId,
      name: name.trim() || 'New Category',
      color: '#6366f1',
      emoji: '📁',
      collapsed: false,
      notes: [],
      order: data.workspaces.find((w) => w.id === workspaceId)?.categories.length ?? 0,
      groups: [],
    }
    return {
      workspaces: data.workspaces.map((ws) => {
        if (ws.id !== workspaceId) return ws
        return { ...ws, categories: [...ws.categories, category] }
      }),
    }
  })
  return categoryId
}

/**
 * Create a new workspace with the given name and append it to the workspace list.
 * When `templateWorkspaceId` is given, the template's category structure
 * (names, colors, emojis — not their groups or notes) is copied (spec §10).
 * Returns the new workspace's id.
 */
export async function createWorkspace(name: string, templateWorkspaceId?: string): Promise<string> {
  const workspace: Workspace = { ...DEFAULT_WORKSPACE(), name: name.trim() || 'New Workspace' }

  await writeStorage((data) => {
    const template = templateWorkspaceId
      ? data.workspaces.find((w) => w.id === templateWorkspaceId)
      : undefined
    if (template) {
      workspace.categories = template.categories.map((cat, i) => ({
        ...cat,
        id: crypto.randomUUID(),
        order: i,
        groups: [],
        notes: [],
      }))
    }
    return { workspaces: [...data.workspaces, workspace] }
  })
  return workspace.id
}

/**
 * Reorder categories within a workspace by providing the desired id order.
 * Any category id not in orderedIds is appended at the end (safety net).
 */
export async function reorderCategories(workspaceId: string, orderedIds: string[]): Promise<void> {
  await writeStorage((data) => {
    let moved = false
    const workspaces = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      const byId = new Map(ws.categories.map((c) => [c.id, c]))
      const reordered = orderedIds.flatMap((id) => {
        const cat = byId.get(id)
        return cat ? [cat] : []
      })
      // Append any categories missing from orderedIds
      const seen = new Set(orderedIds)
      const remainder = ws.categories.filter((c) => !seen.has(c.id))
      // mergeCategories sorts by `order` and takes the newer side's scalars, so
      // a reorder left in array position alone is invisible to sync and gets
      // snapped back by the next merge.
      const now = Date.now()
      const categories = [...reordered, ...remainder].map((c, i) => {
        if (c.order === i) return c
        moved = true
        return { ...c, order: i, updated_at: now }
      })
      return { ...ws, categories }
    })
    // Drop-in-place: the drag handler fires unconditionally, so skip the write.
    return moved ? { workspaces } : null
  })
}

/**
 * Save tabs into a category: appends to the group with `groupId` when it
 * still exists, otherwise creates a new group named `groupName` at the end
 * of the category (a null/stale id — e.g. the popup's "recent group" chip
 * after the group was deleted — falls back to creation rather than silently
 * dropping the tabs). Returns the id of the group that received the tabs.
 * Throws when the category itself is missing so callers can surface a real
 * error instead of a false success.
 */
export async function saveTabsToGroup(params: {
  workspaceId: string
  categoryId: string
  groupId?: string | null
  groupName: string
  tabs: SavedTab[]
}): Promise<string> {
  const { workspaceId, categoryId, groupId, groupName, tabs } = params
  let targetId!: string

  await writeStorage((data) => {
    const now = Date.now()
    const ws = data.workspaces.find((w) => w.id === workspaceId)
    const cat = ws?.categories.find((c) => c.id === categoryId)
    if (!ws || !cat) {
      throw new Error(`Category ${categoryId} not found in workspace ${workspaceId}`)
    }

    const existing = groupId ? cat.groups.find((g) => g.id === groupId) : undefined
    const group: TabGroup = existing
      ? { ...existing, tabs: [...existing.tabs, ...tabs], updated_at: now }
      : makeNewGroup(groupName, cat.groups.length, tabs, now)
    targetId = group.id

    return {
      workspaces: updateCategoryIn(data.workspaces, workspaceId, categoryId, (c) => ({
        ...c,
        groups: existing ? c.groups.map((g) => (g.id === group.id ? group : g)) : [...c.groups, group],
      })),
    }
  })
  return targetId
}

/**
 * Append multiple tabs to an existing group in a single atomic write.
 */
export async function addTabsToGroup(
  workspaceId: string,
  categoryId: string,
  groupId: string,
  tabs: import('./schema').SavedTab[],
): Promise<void> {
  await writeStorage((data) => ({
    workspaces: data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return {
        ...ws,
        categories: ws.categories.map((cat) => {
          if (cat.id !== categoryId) return cat
          return {
            ...cat,
            groups: cat.groups.map((g) => {
              if (g.id !== groupId) return g
              return { ...g, tabs: [...g.tabs, ...tabs], updated_at: Date.now() }
            }),
          }
        }),
      }
    }),
  }))
}

/**
 * Append a tab to an existing group in place.
 */
export async function addTabToGroup(
  workspaceId: string,
  categoryId: string,
  groupId: string,
  tab: import('./schema').SavedTab,
): Promise<void> {
  await addTabsToGroup(workspaceId, categoryId, groupId, [tab])
}

export async function saveTabNote(
  workspaceId: string,
  categoryId: string,
  groupId: string,
  tabId: string,
  note: string,
): Promise<void> {
  await writeStorage((data) => ({
    workspaces: data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return {
        ...ws,
        categories: ws.categories.map((cat) => {
          if (cat.id !== categoryId) return cat
          return {
            ...cat,
            groups: cat.groups.map((g) => {
              if (g.id !== groupId) return g
              return {
                ...g,
                tabs: g.tabs.map((t) =>
                  t.id === tabId ? { ...t, note: note || undefined } : t,
                ),
                updated_at: Date.now(),
              }
            }),
          }
        }),
      }
    }),
  }))
}

export async function saveGroupNote(
  workspaceId: string,
  categoryId: string,
  groupId: string,
  content: string,
): Promise<void> {
  await writeStorage((data) => {
    const now = Date.now()
    let cleared: Note | undefined
    const workspaces = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return {
        ...ws,
        categories: ws.categories.map((cat) => {
          if (cat.id !== categoryId) return cat
          return {
            ...cat,
            groups: cat.groups.map((g) => {
              if (g.id !== groupId) return g
              const existing = g.notes[0]
              if (!content && existing) cleared = existing
              const notes = content
                ? [existing
                    ? { ...existing, content, updated_at: now }
                    : { id: crypto.randomUUID(), content, created_at: now, updated_at: now }]
                : []
              return { ...g, notes, updated_at: now }
            }),
          }
        }),
      }
    })

    if (cleared == null) return { workspaces }

    // Clearing a note is a deletion for sync purposes: without a tombstone,
    // mergeGroups would union the old note back in from a stale remote copy.
    const tombstone = makeTrashItem(
      'note',
      cleared,
      { workspace_id: workspaceId, category_id: categoryId, group_id: groupId },
      { at: now, hidden: true },
    )
    return { workspaces, trash: [...data.trash, tombstone] }
  })
}

// ---------------------------------------------------------------------------
// Standalone category notes (spec §7.1)
// ---------------------------------------------------------------------------

/**
 * Create a standalone note in a category. Returns the new note's id.
 */
export async function createCategoryNote(
  workspaceId: string,
  categoryId: string,
  content = '',
): Promise<string> {
  const noteId = crypto.randomUUID()
  await writeStorage((data) => {
    const now = Date.now()
    return {
      workspaces: data.workspaces.map((ws) => {
        if (ws.id !== workspaceId) return ws
        return {
          ...ws,
          categories: ws.categories.map((cat) =>
            cat.id === categoryId
              ? {
                  ...cat,
                  notes: [...(cat.notes ?? []), { id: noteId, content, created_at: now, updated_at: now }],
                  updated_at: now,
                }
              : cat,
          ),
        }
      }),
    }
  })
  return noteId
}

/**
 * Update a standalone note's content in place.
 */
export async function saveCategoryNote(
  workspaceId: string,
  categoryId: string,
  noteId: string,
  content: string,
): Promise<void> {
  await writeStorage((data) => {
    const now = Date.now()
    return {
      workspaces: data.workspaces.map((ws) => {
        if (ws.id !== workspaceId) return ws
        return {
          ...ws,
          categories: ws.categories.map((cat) =>
            cat.id === categoryId
              ? {
                  ...cat,
                  notes: (cat.notes ?? []).map((n) =>
                    n.id === noteId ? { ...n, content, updated_at: now } : n,
                  ),
                  // mergeCategories picks which side's `notes` array survives by
                  // the CATEGORY's updated_at, so bumping only the note would
                  // strand the edit (saveGroupNote bumps its parent group too).
                  updated_at: now,
                }
              : cat,
          ),
        }
      }),
    }
  })
}

/**
 * Permanently delete a standalone note from a category. A hidden tombstone
 * records the deletion so sync can't union the note back in (mergeCategories
 * unions standalone notes by id).
 */
export async function deleteCategoryNote(
  workspaceId: string,
  categoryId: string,
  noteId: string,
): Promise<void> {
  await writeStorage((data) => {
    let removed: Note | undefined
    const now = Date.now()
    const workspaces = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return {
        ...ws,
        categories: ws.categories.map((cat) => {
          if (cat.id !== categoryId) return cat
          const notes = cat.notes ?? []
          const found = notes.find((n) => n.id === noteId)
          if (found == null) return cat
          removed = found
          return { ...cat, notes: notes.filter((n) => n.id !== noteId), updated_at: now }
        }),
      }
    })

    if (removed == null) return null // note not found — nothing to write

    const tombstone = makeTrashItem(
      'note',
      removed,
      { workspace_id: workspaceId, category_id: categoryId },
      { hidden: true },
    )
    return { workspaces, trash: [...data.trash, tombstone] }
  })
}

/**
 * Move a group to a different category within the same workspace.
 * No-ops if the group is already in the target category.
 */
export async function moveGroupToCategory(
  workspaceId: string,
  groupId: string,
  toCategoryId: string,
): Promise<void> {
  await writeStorage((data) => {
    let moved: TabGroup | undefined

    const afterRemove = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return {
        ...ws,
        categories: ws.categories.map((cat) => {
          if (cat.id === toCategoryId) return cat
          const found = cat.groups.find((g) => g.id === groupId)
          if (found == null) return cat
          moved = found
          return { ...cat, groups: cat.groups.filter((g) => g.id !== groupId) }
        }),
      }
    })

    if (moved == null) return null // already in the target category (or not found)
    const group = moved

    return {
      workspaces: afterRemove.map((ws) => {
        if (ws.id !== workspaceId) return ws
        return {
          ...ws,
          categories: ws.categories.map((cat) => {
            if (cat.id !== toCategoryId) return cat
            return { ...cat, groups: [...cat.groups, { ...group, order: cat.groups.length, updated_at: Date.now() }] }
          }),
        }
      }),
    }
  })
}

/**
 * Duplicate a group in place (same category). All ids are regenerated; the
 * copy is appended after the original with " (copy)" suffixed to its name.
 * Returns the new group's id.
 */
export async function duplicateGroup(
  workspaceId: string,
  categoryId: string,
  groupId: string,
): Promise<string> {
  const newId = crypto.randomUUID()

  await writeStorage((data) => {
    const now = Date.now()
    let found = false

    const workspaces = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return {
        ...ws,
        categories: ws.categories.map((cat) => {
          if (cat.id !== categoryId) return cat
          const original = cat.groups.find((g) => g.id === groupId)
          if (original == null) return cat
          found = true
          const copy: TabGroup = {
            ...original,
            id: newId,
            name: `${original.name} (copy)`,
            created_at: now,
            updated_at: now,
            order: cat.groups.length,
            tabs: original.tabs.map((t) => ({ ...t, id: crypto.randomUUID() })),
            notes: original.notes.map((n) => ({ ...n, id: crypto.randomUUID() })),
          }
          return { ...cat, groups: [...cat.groups, copy] }
        }),
      }
    })

    if (!found) {
      throw new Error(`Group ${groupId} not found in category ${categoryId}`)
    }

    return { workspaces }
  })
  return newId
}

/** Name of the special category that archived groups are moved into. */
export const ARCHIVE_CATEGORY_NAME = 'Archive'

/**
 * Archive a group (spec §6.2): moves it into a special collapsed "Archive"
 * category (created on demand) and sets its archived flag. A collapsed
 * category is hidden from the "All" view but stays reachable from the
 * sidebar and search.
 */
export async function archiveGroup(
  workspaceId: string,
  categoryId: string,
  groupId: string,
): Promise<void> {
  await writeStorage((data) => {
    let archived: TabGroup | undefined

    const afterRemove = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return {
        ...ws,
        categories: ws.categories.map((cat) => {
          if (cat.id !== categoryId) return cat
          archived = cat.groups.find((g) => g.id === groupId)
          return { ...cat, groups: cat.groups.filter((g) => g.id !== groupId) }
        }),
      }
    })

    if (archived == null) {
      throw new Error(`Group ${groupId} not found in category ${categoryId}`)
    }
    const group: TabGroup = { ...archived, archived: true, updated_at: Date.now() }

    return {
      workspaces: afterRemove.map((ws) => {
        if (ws.id !== workspaceId) return ws
        let archiveCat = ws.categories.find((c) => c.name === ARCHIVE_CATEGORY_NAME)
        let categories: Category[]
        if (archiveCat == null) {
          archiveCat = {
            id: crypto.randomUUID(),
            name: ARCHIVE_CATEGORY_NAME,
            color: '#64748b',
            emoji: '🗄️',
            collapsed: true,
            notes: [],
            order: ws.categories.length,
            groups: [group],
          }
          categories = [...ws.categories, archiveCat]
        } else {
          categories = ws.categories.map((cat) =>
            cat.id === archiveCat!.id
              ? { ...cat, groups: [...cat.groups, { ...group, order: cat.groups.length }] }
              : cat,
          )
        }
        return { ...ws, categories }
      }),
    }
  })
}

/**
 * Move a tab to a new position within its group.
 */
export async function reorderTabInGroup(
  workspaceId: string,
  groupId: string,
  tabId: string,
  toIndex: number,
): Promise<void> {
  await writeStorage((data) => ({
    workspaces: data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return {
        ...ws,
        categories: ws.categories.map((cat) => ({
          ...cat,
          groups: cat.groups.map((g) => {
            if (g.id !== groupId) return g
            const fromIndex = g.tabs.findIndex((t) => t.id === tabId)
            if (fromIndex === -1) return g
            const tabs = [...g.tabs]
            const [tab] = tabs.splice(fromIndex, 1)
            const clamped = Math.max(0, Math.min(toIndex, tabs.length))
            tabs.splice(clamped, 0, tab!)
            return { ...g, tabs, updated_at: Date.now() }
          }),
        })),
      }
    }),
  }))
}

/**
 * Move a single tab from one group to another within the same workspace.
 * Groups may live in different categories — the function searches all categories
 * to locate both. No-ops if fromGroupId === toGroupId.
 */
export async function moveTabBetweenGroups(
  workspaceId: string,
  fromGroupId: string,
  toGroupId: string,
  tabId: string,
): Promise<void> {
  if (fromGroupId === toGroupId) return
  await writeStorage((data) => {
    const now = Date.now()
    let movedTab: SavedTab | undefined

    // Pass 1: remove tab from source group
    const afterRemove = data.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return {
        ...ws,
        categories: ws.categories.map((cat) => ({
          ...cat,
          groups: cat.groups.map((g) => {
            if (g.id !== fromGroupId) return g
            const tab = g.tabs.find((t) => t.id === tabId)
            if (tab != null) movedTab = tab
            return { ...g, tabs: g.tabs.filter((t) => t.id !== tabId), updated_at: now }
          }),
        })),
      }
    })

    if (movedTab == null) {
      throw new Error(`Tab ${tabId} not found in group ${fromGroupId}`)
    }

    // The destination copy gets a fresh id, and the old id gets a hidden
    // tombstone: a stale remote copy of the source group would otherwise
    // union the tab back in on the next sync, duplicating it across groups.
    // The fresh id is unknown to any tombstone, so the destination copy is
    // untouched by suppression and saved_at stays historically accurate.
    const tab: SavedTab = { ...movedTab, id: crypto.randomUUID() }
    const tombstone = makeTrashItem(
      'tab',
      movedTab,
      { workspace_id: workspaceId, group_id: fromGroupId },
      { at: now, hidden: true },
    )

    // Pass 2: append tab to destination group
    return {
      workspaces: afterRemove.map((ws) => {
        if (ws.id !== workspaceId) return ws
        return {
          ...ws,
          categories: ws.categories.map((cat) => ({
            ...cat,
            groups: cat.groups.map((g) => {
              if (g.id !== toGroupId) return g
              return { ...g, tabs: [...g.tabs, tab], updated_at: now }
            }),
          })),
        }
      }),
      trash: [...data.trash, tombstone],
    }
  })
}

/**
 * Permanently delete a single item from trash by id.
 */
export async function deleteFromTrash(itemId: string): Promise<void> {
  await writeStorage((data) => ({ trash: data.trash.filter((t) => t.id !== itemId) }))
}

/**
 * Permanently delete all items from trash.
 */
export async function emptyTrash(): Promise<void> {
  await writeStorage({ trash: [] })
}

/**
 * Purge trash items older than `days` days.
 * Returns the count of items removed.
 */
export async function purgeTrashOlderThan(days: number): Promise<number> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  let purged = 0
  await writeStorage((data) => {
    const surviving = data.trash.filter((t) => t.deleted_at > cutoff)
    purged = data.trash.length - surviving.length
    return purged > 0 ? { trash: surviving } : null
  })
  return purged
}

// ---------------------------------------------------------------------------
// Schema migration
// ---------------------------------------------------------------------------

/**
 * Fold the legacy device-only `tabnest_theme` key into settings.theme and
 * delete it. The TopBar toggle used to write only this key while the synced
 * settings.theme went stale (audit F18); the key held the user's actual last
 * choice, so it wins. Idempotent — the key is gone after the first run.
 */
async function migrateLegacyThemeKey(): Promise<void> {
  const legacy = await rawGet<string>('tabnest_theme')
  if (legacy == null) return
  if (isThemePreference(legacy)) {
    await writeStorage((data) =>
      data.settings.theme === legacy ? null : { settings: { ...data.settings, theme: legacy } },
    )
  }
  await rawRemove('tabnest_theme')
}

/**
 * Run forward migrations from the stored schema_version to SCHEMA_VERSION.
 * Called once in the onInstalled handler. Validates the final shape with Zod.
 */
export async function migrateIfNeeded(): Promise<void> {
  // Before the document snapshot below — this writes through writeStorage,
  // and a later chromeSet of a stale snapshot would undo it. No-ops on fresh
  // installs (the legacy key only ever existed alongside a document).
  await migrateLegacyThemeKey()

  const raw = await chromeGet()

  // Fresh install — write defaults and exit
  if (raw == null) {
    await chromeSet(buildDefaultStorage())
    return
  }

  let current = raw
  let version: number = (current as { schema_version?: number }).schema_version ?? 0

  if (version >= SCHEMA_VERSION) {
    return
  }

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

  // Lift captured generations into their own key BEFORE persisting the
  // document — MIGRATIONS[6] already dropped the field from `current`, so if
  // validation fails below this captured copy is the only one left. Never
  // clobber snapshots already in the key (idempotent if onInstalled re-runs).
  if (liftedBackups !== null) {
    const existing = await chromeGetBackups()
    if (existing.length === 0) {
      await chromeSetBackups(liftedBackups)
    }
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
}
