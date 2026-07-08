import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_SYNC_META,
  SCHEMA_VERSION,
  type StorageSchema,
  type Workspace,
  type Category,
  type TabGroup,
  type SavedTab,
  type TrashItem,
} from './schema'

// ---------------------------------------------------------------------------
// chrome.storage.local mock — in-memory, deliberately asynchronous (setTimeout)
// so that unserialized concurrent writes would actually interleave and expose
// read-before-write races that the writeQueue contract must prevent.
// ---------------------------------------------------------------------------

let store: Record<string, unknown> = {}
let nextSetErrorMessage: string | null = null

const chromeMock = {
  runtime: { lastError: undefined as { message: string } | undefined },
  storage: {
    local: {
      get: (key: string, cb: (result: Record<string, unknown>) => void): void => {
        setTimeout(() => cb({ [key]: store[key] }), 0)
      },
      set: (items: Record<string, unknown>, cb: () => void): void => {
        setTimeout(() => {
          if (nextSetErrorMessage !== null) {
            chromeMock.runtime.lastError = { message: nextSetErrorMessage }
            nextSetErrorMessage = null
            cb()
            chromeMock.runtime.lastError = undefined
            return
          }
          Object.assign(store, items)
          cb()
        }, 0)
      },
    },
  },
}

vi.stubGlobal('chrome', chromeMock)

// storage.ts holds module-level state (the writeQueue promise chain), so each
// test gets a fresh module for isolation.
let storage: typeof import('./storage')

beforeEach(async () => {
  store = {}
  nextSetErrorMessage = null
  vi.resetModules()
  storage = await import('./storage')
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTab(title = 'Tab'): SavedTab {
  return { id: crypto.randomUUID(), title, url: 'https://example.com/', saved_at: Date.now() }
}

function makeGroup(name = 'Group', tabs: SavedTab[] = []): TabGroup {
  const now = Date.now()
  return { id: crypto.randomUUID(), name, created_at: now, updated_at: now, order: 0, tabs, notes: [] }
}

function makeCategory(name = 'Category', groups: TabGroup[] = []): Category {
  return { id: crypto.randomUUID(), name, color: '#6366f1', emoji: '📁', collapsed: false, order: 0, groups, notes: [] }
}

function makeWorkspace(name = 'Workspace', categories: Category[] = [makeCategory()]): Workspace {
  return { id: crypto.randomUUID(), name, created_at: Date.now(), categories }
}

/** Seed the mock store with a full valid document and return it. */
function seed(workspaces: Workspace[] = [makeWorkspace()], trash: TrashItem[] = []): StorageSchema {
  const data: StorageSchema = {
    schema_version: SCHEMA_VERSION,
    workspaces,
    settings: { ...DEFAULT_SETTINGS, default_workspace_id: workspaces[0]?.id ?? null },
    local_settings: { ...DEFAULT_LOCAL_SETTINGS },
    sync_meta: DEFAULT_SYNC_META(),
    trash,
  }
  store['tabnest_data'] = data
  return data
}

function stored(): StorageSchema {
  return store['tabnest_data'] as StorageSchema
}

// ---------------------------------------------------------------------------
// readStorage
// ---------------------------------------------------------------------------

describe('readStorage', () => {
  it('returns full defaults on empty storage (fresh install)', async () => {
    const data = await storage.readStorage()
    expect(data.schema_version).toBe(SCHEMA_VERSION)
    expect(data.workspaces).toHaveLength(1)
    expect(data.trash).toEqual([])
    expect(data.settings.default_workspace_id).toBe(data.workspaces[0]!.id)
    expect(data.local_settings).toEqual(DEFAULT_LOCAL_SETTINGS)
  })

  it('returns the stored document as-is when present', async () => {
    const seeded = seed()
    const data = await storage.readStorage()
    expect(data).toEqual(seeded)
  })
})

// ---------------------------------------------------------------------------
// writeStorage — merge, last_modified_at bump, write queue
// ---------------------------------------------------------------------------

describe('writeStorage', () => {
  it('merges the patch without clobbering unrelated fields', async () => {
    const seeded = seed()
    await storage.writeStorage({ trash: [] })
    expect(stored().workspaces).toEqual(seeded.workspaces)
    expect(stored().settings).toEqual(seeded.settings)
  })

  it('bumps sync_meta.last_modified_at for workspaces, settings, and trash patches', async () => {
    for (const patch of [
      { workspaces: [makeWorkspace()] },
      { settings: { ...DEFAULT_SETTINGS, compact_mode: true } },
      { trash: [] as TrashItem[] },
    ]) {
      seed()
      expect(stored().sync_meta.last_modified_at).toBe(0)
      await storage.writeStorage(patch)
      expect(stored().sync_meta.last_modified_at).toBeGreaterThan(0)
    }
  })

  it('does NOT bump last_modified_at for sync_meta-only patches', async () => {
    const seeded = seed()
    await storage.writeStorage({ sync_meta: { ...seeded.sync_meta, last_sync_at: 12345 } })
    expect(stored().sync_meta.last_sync_at).toBe(12345)
    expect(stored().sync_meta.last_modified_at).toBe(0)
  })

  it('serializes concurrent writes so both patches land (write queue)', async () => {
    seed()
    // Not awaited individually — with the async mock, an unqueued implementation
    // would have the second write read stale data and drop the first patch.
    const trashItem: TrashItem = {
      id: crypto.randomUUID(),
      type: 'group',
      data: makeGroup(),
      original_location: { workspace_id: crypto.randomUUID() },
      deleted_at: Date.now(),
    }
    const newWorkspaces = [makeWorkspace('A'), makeWorkspace('B')]
    await Promise.all([
      storage.writeStorage({ workspaces: newWorkspaces }),
      storage.writeStorage({ trash: [trashItem] }),
    ])
    expect(stored().workspaces).toEqual(newWorkspaces)
    expect(stored().trash).toEqual([trashItem])
  })

  it('rejects with a typed QuotaExceededError when Chrome reports a quota failure', async () => {
    seed()
    nextSetErrorMessage = 'QUOTA_BYTES quota exceeded'
    await expect(storage.writeStorage({ trash: [] })).rejects.toThrow(/^QuotaExceededError:/)
  })

  it('recovers after a failed write — the queue is not poisoned', async () => {
    seed()
    nextSetErrorMessage = 'QUOTA_BYTES quota exceeded'
    await expect(storage.writeStorage({ trash: [] })).rejects.toThrow()

    const workspaces = [makeWorkspace('After failure')]
    await expect(storage.writeStorage({ workspaces })).resolves.toBeUndefined()
    expect(stored().workspaces).toEqual(workspaces)

    await expect(storage.patchLocalSettings({ sync_enabled: true })).resolves.toBeUndefined()
    expect(stored().local_settings.sync_enabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// patchSettings / patchLocalSettings
// ---------------------------------------------------------------------------

describe('settings patches', () => {
  it('patchSettings merges into existing settings and bumps last_modified_at', async () => {
    seed()
    await storage.patchSettings({ show_clock: false })
    expect(stored().settings.show_clock).toBe(false)
    expect(stored().settings.theme).toBe(DEFAULT_SETTINGS.theme)
    expect(stored().sync_meta.last_modified_at).toBeGreaterThan(0)
  })

  it('patchLocalSettings never bumps last_modified_at (device-only data)', async () => {
    seed()
    await storage.patchLocalSettings({ sync_enabled: true, sync_interval_minutes: 5 })
    expect(stored().local_settings.sync_enabled).toBe(true)
    expect(stored().local_settings.sync_interval_minutes).toBe(5)
    expect(stored().sync_meta.last_modified_at).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Workspace / group operations
// ---------------------------------------------------------------------------

describe('saveWorkspace', () => {
  it('appends a new workspace and replaces an existing one by id', async () => {
    const seeded = seed()
    const added = makeWorkspace('Added')
    await storage.saveWorkspace(added)
    expect(stored().workspaces).toHaveLength(2)

    await storage.saveWorkspace({ ...added, name: 'Renamed' })
    expect(stored().workspaces).toHaveLength(2)
    expect(stored().workspaces[1]!.name).toBe('Renamed')
    expect(stored().workspaces[0]).toEqual(seeded.workspaces[0])
  })
})

describe('saveTabGroup', () => {
  it('appends a new group and replaces an existing one by id', async () => {
    const cat = makeCategory()
    const ws = makeWorkspace('WS', [cat])
    seed([ws])
    const group = makeGroup('First')

    await storage.saveTabGroup({ group, categoryId: cat.id, workspaceId: ws.id })
    expect(stored().workspaces[0]!.categories[0]!.groups).toHaveLength(1)

    await storage.saveTabGroup({ group: { ...group, name: 'Updated' }, categoryId: cat.id, workspaceId: ws.id })
    const groups = stored().workspaces[0]!.categories[0]!.groups
    expect(groups).toHaveLength(1)
    expect(groups[0]!.name).toBe('Updated')
  })
})

describe('deleteTabGroup', () => {
  it('removes the group and adds a trash item recording its original location', async () => {
    const group = makeGroup('Doomed', [makeTab()])
    const cat = makeCategory('Cat', [group])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    const trashItem = await storage.deleteTabGroup({ groupId: group.id, categoryId: cat.id, workspaceId: ws.id })

    expect(stored().workspaces[0]!.categories[0]!.groups).toHaveLength(0)
    expect(stored().trash).toHaveLength(1)
    expect(trashItem.type).toBe('group')
    expect(trashItem.data).toEqual(group)
    expect(trashItem.original_location).toEqual({ workspace_id: ws.id, category_id: cat.id })
  })

  it('throws when the group does not exist', async () => {
    const cat = makeCategory()
    const ws = makeWorkspace('WS', [cat])
    seed([ws])
    await expect(
      storage.deleteTabGroup({ groupId: crypto.randomUUID(), categoryId: cat.id, workspaceId: ws.id }),
    ).rejects.toThrow(/not found/)
  })
})

describe('moveTabBetweenGroups', () => {
  it('moves a tab across groups in different categories', async () => {
    const tab = makeTab('Mover')
    const from = makeGroup('From', [tab])
    const to = makeGroup('To')
    const ws = makeWorkspace('WS', [makeCategory('A', [from]), makeCategory('B', [to])])
    seed([ws])

    await storage.moveTabBetweenGroups(ws.id, from.id, to.id, tab.id)

    const cats = stored().workspaces[0]!.categories
    expect(cats[0]!.groups[0]!.tabs).toHaveLength(0)
    expect(cats[1]!.groups[0]!.tabs).toEqual([tab])
  })

  it('throws when the tab is not in the source group', async () => {
    const from = makeGroup('From')
    const to = makeGroup('To')
    const ws = makeWorkspace('WS', [makeCategory('A', [from, to])])
    seed([ws])
    await expect(storage.moveTabBetweenGroups(ws.id, from.id, to.id, crypto.randomUUID())).rejects.toThrow(
      /not found/,
    )
  })

  it('no-ops when source and destination are the same group', async () => {
    const tab = makeTab()
    const group = makeGroup('Same', [tab])
    const ws = makeWorkspace('WS', [makeCategory('A', [group])])
    const seeded = seed([ws])
    await storage.moveTabBetweenGroups(ws.id, group.id, group.id, tab.id)
    expect(stored()).toEqual(seeded)
  })
})

describe('patchCategory / setAllCategoriesCollapsed', () => {
  it('updates color and emoji in place', async () => {
    const cat = makeCategory()
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    await storage.patchCategory(ws.id, cat.id, { color: '#ef4444', emoji: '🎮' })

    const updated = stored().workspaces[0]!.categories[0]!
    expect(updated.color).toBe('#ef4444')
    expect(updated.emoji).toBe('🎮')
    expect(updated.name).toBe(cat.name)
  })

  it('collapses every category in the workspace', async () => {
    const ws = makeWorkspace('WS', [makeCategory('A'), makeCategory('B')])
    seed([ws])

    await storage.setAllCategoriesCollapsed(ws.id, true)

    expect(stored().workspaces[0]!.categories.every((c) => c.collapsed)).toBe(true)
  })
})

describe('standalone category notes', () => {
  it('creates, updates, and deletes a note in a category', async () => {
    const cat = makeCategory()
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    const noteId = await storage.createCategoryNote(ws.id, cat.id, 'hello')
    let notes = stored().workspaces[0]!.categories[0]!.notes
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ id: noteId, content: 'hello' })

    await storage.saveCategoryNote(ws.id, cat.id, noteId, 'updated')
    notes = stored().workspaces[0]!.categories[0]!.notes
    expect(notes[0]!.content).toBe('updated')
    expect(notes[0]!.updated_at).toBeGreaterThanOrEqual(notes[0]!.created_at)

    await storage.deleteCategoryNote(ws.id, cat.id, noteId)
    expect(stored().workspaces[0]!.categories[0]!.notes).toHaveLength(0)
  })
})

describe('moveGroupToCategory', () => {
  it('moves a group between categories and reassigns its order', async () => {
    const group = makeGroup('Mover')
    const from = makeCategory('From', [group])
    const to = makeCategory('To', [makeGroup('Existing')])
    const ws = makeWorkspace('WS', [from, to])
    seed([ws])

    await storage.moveGroupToCategory(ws.id, group.id, to.id)

    const cats = stored().workspaces[0]!.categories
    expect(cats[0]!.groups).toHaveLength(0)
    expect(cats[1]!.groups.map((g) => g.name)).toEqual(['Existing', 'Mover'])
    expect(cats[1]!.groups[1]!.order).toBe(1)
  })

  it('no-ops when the group is already in the target category', async () => {
    const group = makeGroup('Stay')
    const cat = makeCategory('Cat', [group])
    const ws = makeWorkspace('WS', [cat])
    const seeded = seed([ws])

    await storage.moveGroupToCategory(ws.id, group.id, cat.id)

    expect(stored()).toEqual(seeded)
  })
})

describe('duplicateGroup', () => {
  it('appends a copy with fresh ids and a "(copy)" name', async () => {
    const tab = makeTab('T')
    const group = makeGroup('Original', [tab])
    const cat = makeCategory('Cat', [group])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    const newId = await storage.duplicateGroup(ws.id, cat.id, group.id)

    const groups = stored().workspaces[0]!.categories[0]!.groups
    expect(groups).toHaveLength(2)
    const copy = groups[1]!
    expect(copy.id).toBe(newId)
    expect(copy.name).toBe('Original (copy)')
    expect(copy.tabs).toHaveLength(1)
    expect(copy.tabs[0]!.id).not.toBe(tab.id)
    expect(copy.tabs[0]!.url).toBe(tab.url)
  })

  it('throws when the group does not exist', async () => {
    const cat = makeCategory()
    const ws = makeWorkspace('WS', [cat])
    seed([ws])
    await expect(storage.duplicateGroup(ws.id, cat.id, crypto.randomUUID())).rejects.toThrow(/not found/)
  })
})

describe('archiveGroup', () => {
  it('creates a collapsed Archive category on first archive and moves the group there', async () => {
    const group = makeGroup('Old stuff')
    const cat = makeCategory('Cat', [group])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    await storage.archiveGroup(ws.id, cat.id, group.id)

    const cats = stored().workspaces[0]!.categories
    expect(cats[0]!.groups).toHaveLength(0)
    const archive = cats.find((c) => c.name === storage.ARCHIVE_CATEGORY_NAME)
    expect(archive).toBeDefined()
    expect(archive!.collapsed).toBe(true)
    expect(archive!.groups[0]!.name).toBe('Old stuff')
    expect(archive!.groups[0]!.archived).toBe(true)
  })

  it('reuses an existing Archive category', async () => {
    const group = makeGroup('Second')
    const cat = makeCategory('Cat', [group])
    const archive = makeCategory(storage.ARCHIVE_CATEGORY_NAME, [makeGroup('First')])
    const ws = makeWorkspace('WS', [cat, archive])
    seed([ws])

    await storage.archiveGroup(ws.id, cat.id, group.id)

    const cats = stored().workspaces[0]!.categories
    expect(cats).toHaveLength(2)
    expect(cats[1]!.groups.map((g) => g.name)).toEqual(['First', 'Second'])
  })
})

describe('reorderTabInGroup', () => {
  it('moves a tab to the requested index within its group', async () => {
    const [a, b, c] = [makeTab('A'), makeTab('B'), makeTab('C')]
    const group = makeGroup('G', [a, b, c])
    const ws = makeWorkspace('WS', [makeCategory('Cat', [group])])
    seed([ws])

    await storage.reorderTabInGroup(ws.id, group.id, c.id, 0)

    const tabs = stored().workspaces[0]!.categories[0]!.groups[0]!.tabs
    expect(tabs.map((t) => t.title)).toEqual(['C', 'A', 'B'])
  })

  it('clamps out-of-range target indices', async () => {
    const [a, b] = [makeTab('A'), makeTab('B')]
    const group = makeGroup('G', [a, b])
    const ws = makeWorkspace('WS', [makeCategory('Cat', [group])])
    seed([ws])

    await storage.reorderTabInGroup(ws.id, group.id, a.id, 99)

    const tabs = stored().workspaces[0]!.categories[0]!.groups[0]!.tabs
    expect(tabs.map((t) => t.title)).toEqual(['B', 'A'])
  })
})

describe('reorderCategories', () => {
  it('applies the given order and appends categories missing from it', async () => {
    const [a, b, c] = [makeCategory('A'), makeCategory('B'), makeCategory('C')]
    const ws = makeWorkspace('WS', [a, b, c])
    seed([ws])

    await storage.reorderCategories(ws.id, [c.id, a.id])

    expect(stored().workspaces[0]!.categories.map((cat) => cat.name)).toEqual(['C', 'A', 'B'])
  })
})

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

function trashedGroup(group: TabGroup, workspaceId: string, categoryId: string, deletedAt = Date.now()): TrashItem {
  return {
    id: crypto.randomUUID(),
    type: 'group',
    data: group,
    original_location: { workspace_id: workspaceId, category_id: categoryId },
    deleted_at: deletedAt,
  }
}

describe('restoreFromTrash', () => {
  it('restores a group to its original workspace and category', async () => {
    const group = makeGroup('Restored')
    const cat = makeCategory()
    const ws = makeWorkspace('WS', [cat])
    const item = trashedGroup(group, ws.id, cat.id)
    seed([ws], [item])

    await storage.restoreFromTrash(item.id)

    expect(stored().workspaces[0]!.categories[0]!.groups).toEqual([group])
    expect(stored().trash).toHaveLength(0)
  })

  it('falls back to the first workspace/category when the original location is gone', async () => {
    const group = makeGroup('Orphan')
    const item = trashedGroup(group, crypto.randomUUID(), crypto.randomUUID())
    const ws = makeWorkspace()
    seed([ws], [item])

    await storage.restoreFromTrash(item.id)

    expect(stored().workspaces[0]!.categories[0]!.groups).toEqual([group])
    expect(stored().trash).toHaveLength(0)
  })

  it('does not duplicate a group that already exists at the destination (idempotency)', async () => {
    const group = makeGroup('Dup')
    const cat = makeCategory('Cat', [group])
    const ws = makeWorkspace('WS', [cat])
    const item = trashedGroup(group, ws.id, cat.id)
    seed([ws], [item])

    await storage.restoreFromTrash(item.id)

    expect(stored().workspaces[0]!.categories[0]!.groups).toHaveLength(1)
    expect(stored().trash).toHaveLength(0)
  })

  it('throws for an unknown trash item id', async () => {
    seed()
    await expect(storage.restoreFromTrash(crypto.randomUUID())).rejects.toThrow(/not found/)
  })

  it('throws when the stored group data fails schema validation', async () => {
    const cat = makeCategory()
    const ws = makeWorkspace('WS', [cat])
    const item: TrashItem = {
      id: crypto.randomUUID(),
      type: 'group',
      data: { corrupt: true },
      original_location: { workspace_id: ws.id, category_id: cat.id },
      deleted_at: Date.now(),
    }
    seed([ws], [item])
    await expect(storage.restoreFromTrash(item.id)).rejects.toThrow(/schema validation/)
  })
})

describe('purgeTrashOlderThan', () => {
  it('removes only items older than the cutoff and returns the purged count', async () => {
    const ws = makeWorkspace()
    const cat = ws.categories[0]!
    const old = trashedGroup(makeGroup('Old'), ws.id, cat.id, Date.now() - 31 * 24 * 60 * 60 * 1000)
    const fresh = trashedGroup(makeGroup('Fresh'), ws.id, cat.id)
    seed([ws], [old, fresh])

    const purged = await storage.purgeTrashOlderThan(30)

    expect(purged).toBe(1)
    expect(stored().trash.map((t) => t.id)).toEqual([fresh.id])
  })

  it('returns 0 and does not write when nothing is old enough', async () => {
    const ws = makeWorkspace()
    const fresh = trashedGroup(makeGroup('Fresh'), ws.id, ws.categories[0]!.id)
    seed([ws], [fresh])

    const purged = await storage.purgeTrashOlderThan(30)

    expect(purged).toBe(0)
    // A skipped write means last_modified_at was never bumped
    expect(stored().sync_meta.last_modified_at).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

describe('migrateIfNeeded', () => {
  it('writes full defaults on a fresh install', async () => {
    await storage.migrateIfNeeded()
    expect(stored().schema_version).toBe(SCHEMA_VERSION)
    expect(stored().workspaces).toHaveLength(1)
  })

  it('is a no-op when already at the current version', async () => {
    const seeded = seed()
    await storage.migrateIfNeeded()
    expect(stored()).toEqual(seeded)
  })

  it('migrates v1 data: sync fields move to local_settings, accent_color is removed', async () => {
    const ws = makeWorkspace()
    store['tabnest_data'] = {
      schema_version: 1,
      workspaces: [ws],
      settings: {
        ...DEFAULT_SETTINGS,
        default_workspace_id: ws.id,
        accent_color: '#1A56DB',
        sync_enabled: true,
        sync_interval_minutes: 5,
      },
      sync_meta: DEFAULT_SYNC_META(),
      trash: [],
    }

    await storage.migrateIfNeeded()

    const data = stored()
    expect(data.schema_version).toBe(SCHEMA_VERSION)
    expect(data.local_settings.sync_enabled).toBe(true)
    expect(data.local_settings.sync_interval_minutes).toBe(5)
    expect(data.settings).not.toHaveProperty('sync_enabled')
    expect(data.settings).not.toHaveProperty('sync_interval_minutes')
    expect(data.settings).not.toHaveProperty('accent_color')
    expect(data.workspaces).toEqual([ws])
  })

  it('migrates v4 data: categories gain an empty notes array', async () => {
    const ws = makeWorkspace()
    // Simulate v4 data — categories have no notes field
    const v4ws = {
      ...ws,
      categories: ws.categories.map((c) => {
        const withoutNotes: Record<string, unknown> = { ...c }
        delete withoutNotes['notes']
        return withoutNotes
      }),
    }
    store['tabnest_data'] = {
      schema_version: 4,
      workspaces: [v4ws],
      settings: { ...DEFAULT_SETTINGS },
      sync_meta: DEFAULT_SYNC_META(),
      trash: [],
    }

    await storage.migrateIfNeeded()

    const data = stored()
    expect(data.schema_version).toBe(SCHEMA_VERSION)
    expect(data.workspaces[0]!.categories[0]!.notes).toEqual([])
  })

  it('flags a sync error instead of persisting an invalid migrated document', async () => {
    store['tabnest_data'] = {
      schema_version: 1,
      workspaces: [{ id: 'not-a-uuid', name: 'Broken' }],
      settings: { ...DEFAULT_SETTINGS },
      sync_meta: DEFAULT_SYNC_META(),
      trash: [],
    }

    await storage.migrateIfNeeded()

    const data = stored()
    expect(data.sync_meta.sync_state).toBe('error')
    expect(data.sync_meta.error_message).toMatch(/migration failed/i)
    // The broken workspace was not silently replaced
    expect(data.workspaces[0]).toMatchObject({ id: 'not-a-uuid' })
  })
})

// ---------------------------------------------------------------------------
// Local backup
// ---------------------------------------------------------------------------

describe('local backup', () => {
  it('round-trips workspaces through writeLocalBackup/readLocalBackup', async () => {
    seed()
    const backup = [makeWorkspace('Backup')]
    await storage.writeLocalBackup(backup)
    expect(await storage.readLocalBackup()).toEqual(backup)
  })

  it('returns null when no backup exists', async () => {
    seed()
    expect(await storage.readLocalBackup()).toBeNull()
  })
})
