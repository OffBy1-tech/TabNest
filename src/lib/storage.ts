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
} from './schema'

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'tabnest_data'

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
function enqueueWrite(work: () => Promise<void>): Promise<void> {
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

/**
 * Raw chrome.storage.local get wrapped in a Promise.
 * Returns `null` when the key is absent (fresh install).
 */
async function chromeGet(): Promise<StorageSchema | null> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        const raw = result[STORAGE_KEY] as unknown
        resolve(raw != null ? (raw as StorageSchema) : null)
      })
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Raw chrome.storage.local set wrapped in a Promise.
 * Re-throws QuotaExceededError with a clear label so callers can distinguish.
 */
async function chromeSet(data: StorageSchema): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
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

/**
 * Merge `patch` into the current storage document and persist.
 * Always read-before-write — never clobbers fields not in the patch.
 * Serialized via writeQueue to prevent concurrent-write races.
 *
 * Auto-bumps `sync_meta.last_modified_at` whenever user-data fields
 * (workspaces, settings, trash) are included in the patch, so that
 * Drive sync conflict resolution can determine which device has the
 * freshest data.
 */
export function writeStorage(patch: Partial<StorageSchema>): Promise<void> {
  return enqueueWrite(async () => {
    const current = await readStorage()
    const merged: StorageSchema = { ...current, ...patch }

    // Bump last_modified_at when syncable user data changes.
    // local_settings and sync_meta are intentionally excluded — they are either
    // device-only or pure sync bookkeeping and should not affect conflict resolution.
    const touchesUserData = 'workspaces' in patch || 'settings' in patch || 'trash' in patch
    if (touchesUserData) {
      merged.sync_meta = { ...merged.sync_meta, last_modified_at: Date.now() }
    }

    await chromeSet(merged)
  })
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
  const data = await readStorage()
  const idx = data.workspaces.findIndex((w) => w.id === workspace.id)
  const updated =
    idx === -1
      ? [...data.workspaces, workspace]
      : data.workspaces.map((w) => (w.id === workspace.id ? workspace : w))
  await writeStorage({ workspaces: updated })
}

/**
 * Delete a workspace, moving it (and all contained data) to Trash so the
 * deletion is recoverable (spec §10). Returns the TrashItem for undo flows.
 */
export async function deleteWorkspace(id: string): Promise<TrashItem> {
  const data = await readStorage()
  const workspace = data.workspaces.find((w) => w.id === id)
  if (workspace == null) {
    throw new Error(`Workspace ${id} not found`)
  }

  const trashItem: TrashItem = {
    id: crypto.randomUUID(),
    type: 'workspace',
    data: workspace,
    original_location: { workspace_id: id },
    deleted_at: Date.now(),
  }

  await writeStorage({
    workspaces: data.workspaces.filter((w) => w.id !== id),
    trash: [...data.trash, trashItem],
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
  const data = await readStorage()

  const workspaces = data.workspaces.map((ws) => {
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
  })

  await writeStorage({ workspaces })
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
  const data = await readStorage()

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

  const trashItem: TrashItem = {
    id: crypto.randomUUID(),
    type: 'group',
    data: deleted,
    original_location: {
      workspace_id: workspaceId,
      category_id: categoryId,
    },
    deleted_at: Date.now(),
  }

  const trash = [...data.trash, trashItem]
  await writeStorage({ workspaces, trash })
  return trashItem
}

/**
 * Rename a tab group in place.
 */
export async function renameGroup(
  workspaceId: string,
  categoryId: string,
  groupId: string,
  name: string,
): Promise<void> {
  const data = await readStorage()
  const workspaces = data.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws
    const categories = ws.categories.map((cat) => {
      if (cat.id !== categoryId) return cat
      const groups = cat.groups.map((g) =>
        g.id === groupId ? { ...g, name: name.trim() || g.name } : g,
      )
      return { ...cat, groups }
    })
    return { ...ws, categories }
  })
  await writeStorage({ workspaces })
}

/**
 * Remove a single tab from a group. If the group becomes empty it is kept
 * (the user can delete the empty group explicitly).
 */
export async function removeTabFromGroup(
  workspaceId: string,
  categoryId: string,
  groupId: string,
  tabId: string,
): Promise<void> {
  const data = await readStorage()
  const workspaces = data.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws
    const categories = ws.categories.map((cat) => {
      if (cat.id !== categoryId) return cat
      const groups = cat.groups.map((g) => {
        if (g.id !== groupId) return g
        return { ...g, tabs: g.tabs.filter((t) => t.id !== tabId) }
      })
      return { ...cat, groups }
    })
    return { ...ws, categories }
  })
  await writeStorage({ workspaces })
}

/**
 * Rename a category in place.
 */
export async function renameCategory(
  workspaceId: string,
  categoryId: string,
  name: string,
): Promise<void> {
  const data = await readStorage()
  const workspaces = data.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws
    const categories = ws.categories.map((cat) =>
      cat.id === categoryId ? { ...cat, name: name.trim() || cat.name } : cat,
    )
    return { ...ws, categories }
  })
  await writeStorage({ workspaces })
}

/**
 * Patch presentational fields of a category (color, emoji) in place.
 */
export async function patchCategory(
  workspaceId: string,
  categoryId: string,
  patch: Partial<Pick<Category, 'color' | 'emoji'>>,
): Promise<void> {
  const data = await readStorage()
  const workspaces = data.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws
    return {
      ...ws,
      categories: ws.categories.map((cat) =>
        cat.id === categoryId ? { ...cat, ...patch } : cat,
      ),
    }
  })
  await writeStorage({ workspaces })
}

/**
 * Collapse (or expand) every category in a workspace at once (spec §3.3
 * "Collapse all groups").
 */
export async function setAllCategoriesCollapsed(
  workspaceId: string,
  collapsed: boolean,
): Promise<void> {
  const data = await readStorage()
  const workspaces = data.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws
    return { ...ws, categories: ws.categories.map((cat) => ({ ...cat, collapsed })) }
  })
  await writeStorage({ workspaces })
}

export async function setCategoryCollapsed(
  workspaceId: string,
  categoryId: string,
  collapsed: boolean,
): Promise<void> {
  const data = await readStorage()
  const workspaces = data.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws
    return {
      ...ws,
      categories: ws.categories.map((cat) =>
        cat.id === categoryId ? { ...cat, collapsed } : cat,
      ),
    }
  })
  await writeStorage({ workspaces })
}

/**
 * Permanently delete a category and all its groups from a workspace.
 */
export async function deleteCategory(
  workspaceId: string,
  categoryId: string,
): Promise<void> {
  const data = await readStorage()
  const workspaces = data.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws
    return { ...ws, categories: ws.categories.filter((cat) => cat.id !== categoryId) }
  })
  await writeStorage({ workspaces })
}

// ---------------------------------------------------------------------------
// Sync metadata operations
// ---------------------------------------------------------------------------

export async function getSyncMeta(): Promise<SyncMeta> {
  const data = await readStorage()
  return data.sync_meta
}

export async function patchSyncMeta(patch: Partial<SyncMeta>): Promise<void> {
  const data = await readStorage()
  const sync_meta: SyncMeta = { ...data.sync_meta, ...patch }
  await writeStorage({ sync_meta })
}

export async function patchSettings(patch: Partial<UserSettings>): Promise<void> {
  const data = await readStorage()
  const settings: UserSettings = { ...data.settings, ...patch }
  await writeStorage({ settings })
}

/**
 * Patch per-device local settings (sync_enabled, sync_interval_minutes).
 * Never bumps last_modified_at — these fields are not synced to Drive.
 */
export async function patchLocalSettings(patch: Partial<LocalSettings>): Promise<void> {
  // Merge inside the queued work (read-before-write at execution time) so a
  // concurrent local_settings write isn't clobbered by a stale merge. Bypasses
  // writeStorage's touchesUserData check, so last_modified_at is not bumped.
  return enqueueWrite(async () => {
    const current = await readStorage()
    const local_settings: LocalSettings = { ...current.local_settings, ...patch }
    await chromeSet({ ...current, local_settings })
  })
}

// ---------------------------------------------------------------------------
// Local backup (written before a Drive overwrite to enable rollback)
// ---------------------------------------------------------------------------

export async function writeLocalBackup(workspaces: Workspace[]): Promise<void> {
  await writeStorage({ backup_local: workspaces })
}

export async function readLocalBackup(): Promise<Workspace[] | null> {
  const data = await readStorage()
  return data.backup_local ?? null
}

// ---------------------------------------------------------------------------
// Trash operations
// ---------------------------------------------------------------------------

export async function addToTrash(item: TrashItem): Promise<void> {
  const data = await readStorage()
  await writeStorage({ trash: [...data.trash, item] })
}

/**
 * Restore a trashed item back to its original location.
 * Currently handles 'group' type; extend the switch for other types.
 */
export async function restoreFromTrash(itemId: string): Promise<void> {
  const data = await readStorage()
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
    const group: TabGroup = groupParsed.data
    const { workspace_id, category_id } = item.original_location

    // Fall back to first available workspace/category if original location was deleted
    const targetWs =
      data.workspaces.find((ws) => ws.id === workspace_id) ?? data.workspaces[0]
    const targetCat =
      (targetWs?.categories.find((c) => c.id === category_id) ?? targetWs?.categories[0])

    if (!targetWs || !targetCat) {
      // No workspaces exist — remove from trash anyway to avoid stale entries
      await writeStorage({ trash })
      return
    }

    const workspaces = data.workspaces.map((ws) => {
      if (ws.id !== targetWs.id) return ws
      return {
        ...ws,
        categories: ws.categories.map((cat) => {
          if (cat.id !== targetCat.id) return cat
          // Idempotency guard — don't duplicate if already restored
          if (cat.groups.some((g) => g.id === group.id)) return cat
          return { ...cat, groups: [...cat.groups, group] }
        }),
      }
    })

    await writeStorage({ workspaces, trash })
    return
  }

  if (item.type === 'workspace') {
    const wsParsed = WorkspaceSchema.safeParse(item.data)
    if (!wsParsed.success) {
      throw new Error(`Cannot restore workspace ${itemId}: stored data failed schema validation`)
    }
    const workspace = wsParsed.data
    // Idempotency guard — don't duplicate if already restored
    const workspaces = data.workspaces.some((w) => w.id === workspace.id)
      ? data.workspaces
      : [...data.workspaces, workspace]
    await writeStorage({ workspaces, trash })
    return
  }

  // For other types (tab, category) the restoration logic is symmetric —
  // write back trash removal now and extend the switch later.
  await writeStorage({ trash })
}

/**
 * Rename an existing workspace by id.
 */
export async function renameWorkspace(workspaceId: string, name: string): Promise<void> {
  const data = await readStorage()
  const workspaces = data.workspaces.map((ws) =>
    ws.id === workspaceId ? { ...ws, name: name.trim() || ws.name } : ws,
  )
  await writeStorage({ workspaces })
}

/**
 * Add a new category to the specified workspace.
 * Returns the new category's id.
 */
export async function createCategory(workspaceId: string, name: string): Promise<string> {
  const data = await readStorage()
  const category: Category = {
    id: crypto.randomUUID(),
    name: name.trim() || 'New Category',
    color: '#6366f1',
    emoji: '📁',
    collapsed: false,
    notes: [],
    order: data.workspaces.find((w) => w.id === workspaceId)?.categories.length ?? 0,
    groups: [],
  }
  const workspaces = data.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws
    return { ...ws, categories: [...ws.categories, category] }
  })
  await writeStorage({ workspaces })
  return category.id
}

/**
 * Create a new workspace with the given name and append it to the workspace list.
 * When `templateWorkspaceId` is given, the template's category structure
 * (names, colors, emojis — not their groups or notes) is copied (spec §10).
 * Returns the new workspace's id.
 */
export async function createWorkspace(name: string, templateWorkspaceId?: string): Promise<string> {
  const data = await readStorage()
  const workspace: Workspace = { ...DEFAULT_WORKSPACE(), name: name.trim() || 'New Workspace' }

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

  await writeStorage({ workspaces: [...data.workspaces, workspace] })
  return workspace.id
}

/**
 * Reorder categories within a workspace by providing the desired id order.
 * Any category id not in orderedIds is appended at the end (safety net).
 */
export async function reorderCategories(workspaceId: string, orderedIds: string[]): Promise<void> {
  const data = await readStorage()
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
    return { ...ws, categories: [...reordered, ...remainder] }
  })
  await writeStorage({ workspaces })
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
  const data = await readStorage()
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
            return { ...g, tabs: [...g.tabs, ...tabs], updated_at: Date.now() }
          }),
        }
      }),
    }
  })
  await writeStorage({ workspaces })
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
  const data = await readStorage()
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
            return { ...g, tabs: [...g.tabs, tab], updated_at: Date.now() }
          }),
        }
      }),
    }
  })
  await writeStorage({ workspaces })
}

export async function saveTabNote(
  workspaceId: string,
  categoryId: string,
  groupId: string,
  tabId: string,
  note: string,
): Promise<void> {
  const data = await readStorage()
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
  })
  await writeStorage({ workspaces })
}

export async function saveGroupNote(
  workspaceId: string,
  categoryId: string,
  groupId: string,
  content: string,
): Promise<void> {
  const data = await readStorage()
  const now = Date.now()
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
  await writeStorage({ workspaces })
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
  const data = await readStorage()
  const now = Date.now()
  const noteId = crypto.randomUUID()
  const workspaces = data.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws
    return {
      ...ws,
      categories: ws.categories.map((cat) =>
        cat.id === categoryId
          ? { ...cat, notes: [...(cat.notes ?? []), { id: noteId, content, created_at: now, updated_at: now }] }
          : cat,
      ),
    }
  })
  await writeStorage({ workspaces })
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
  const data = await readStorage()
  const now = Date.now()
  const workspaces = data.workspaces.map((ws) => {
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
            }
          : cat,
      ),
    }
  })
  await writeStorage({ workspaces })
}

/**
 * Permanently delete a standalone note from a category.
 */
export async function deleteCategoryNote(
  workspaceId: string,
  categoryId: string,
  noteId: string,
): Promise<void> {
  const data = await readStorage()
  const workspaces = data.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws
    return {
      ...ws,
      categories: ws.categories.map((cat) =>
        cat.id === categoryId
          ? { ...cat, notes: (cat.notes ?? []).filter((n) => n.id !== noteId) }
          : cat,
      ),
    }
  })
  await writeStorage({ workspaces })
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
  const data = await readStorage()
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

  if (moved == null) return // already in the target category (or not found)
  const group = moved

  const workspaces = afterRemove.map((ws) => {
    if (ws.id !== workspaceId) return ws
    return {
      ...ws,
      categories: ws.categories.map((cat) => {
        if (cat.id !== toCategoryId) return cat
        return { ...cat, groups: [...cat.groups, { ...group, order: cat.groups.length, updated_at: Date.now() }] }
      }),
    }
  })

  await writeStorage({ workspaces })
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
  const data = await readStorage()
  const now = Date.now()
  const newId = crypto.randomUUID()
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

  await writeStorage({ workspaces })
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
  const data = await readStorage()
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

  const workspaces = afterRemove.map((ws) => {
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
  })

  await writeStorage({ workspaces })
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
  const data = await readStorage()
  const workspaces = data.workspaces.map((ws) => {
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
  })
  await writeStorage({ workspaces })
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
  const data = await readStorage()
  let movedTab: import('./schema').SavedTab | undefined

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
          return { ...g, tabs: g.tabs.filter((t) => t.id !== tabId) }
        }),
      })),
    }
  })

  if (movedTab == null) {
    throw new Error(`Tab ${tabId} not found in group ${fromGroupId}`)
  }

  const tab = movedTab

  // Pass 2: append tab to destination group
  const finalWorkspaces = afterRemove.map((ws) => {
    if (ws.id !== workspaceId) return ws
    return {
      ...ws,
      categories: ws.categories.map((cat) => ({
        ...cat,
        groups: cat.groups.map((g) => {
          if (g.id !== toGroupId) return g
          return { ...g, tabs: [...g.tabs, tab] }
        }),
      })),
    }
  })

  await writeStorage({ workspaces: finalWorkspaces })
}

/**
 * Permanently delete a single item from trash by id.
 */
export async function deleteFromTrash(itemId: string): Promise<void> {
  const data = await readStorage()
  const trash = data.trash.filter((t) => t.id !== itemId)
  await writeStorage({ trash })
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
  const data = await readStorage()
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const surviving = data.trash.filter((t) => t.deleted_at > cutoff)
  const purged = data.trash.length - surviving.length
  if (purged > 0) {
    await writeStorage({ trash: surviving })
  }
  return purged
}

// ---------------------------------------------------------------------------
// Schema migration
// ---------------------------------------------------------------------------

/**
 * Run forward migrations from the stored schema_version to SCHEMA_VERSION.
 * Called once in the onInstalled handler. Validates the final shape with Zod.
 */
export async function migrateIfNeeded(): Promise<void> {
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

  // Run each migration in order
  while (version < SCHEMA_VERSION) {
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
}
