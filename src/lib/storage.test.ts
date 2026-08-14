import { describe, it, expect, beforeEach } from 'vitest'
import { mergeSyncedState } from './merge'
import {
  DEFAULT_SETTINGS,
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_SYNC_META,
  SCHEMA_VERSION,
  StorageSchemaZod,
  type Workspace,
  type Category,
  type TabGroup,
  type SavedTab,
  type TrashItem,
} from './schema'
// The harness installs the chrome mock as an import side effect — keep it
// above any import that touches `chrome`.
import {
  freshStorage,
  setNextSetError,
  storeKey,
  setStoreKey,
  makeTab,
  makeGroup,
  makeCategory,
  makeWorkspace,
  seed,
  stored,
  storedBackups,
  past,
  current,
  snapshot,
} from './storageTestHarness'

let storage: typeof import('./storage')

beforeEach(async () => {
  storage = await freshStorage()
})

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

  it('fresh installs get a Getting Started category with a welcome group (spec §15)', async () => {
    const data = await storage.readStorage()
    const gettingStarted = data.workspaces[0]!.categories.find((c) => c.name === 'Getting Started')
    expect(gettingStarted).toBeDefined()
    expect(gettingStarted!.groups[0]!.name).toBe('Welcome to Tab Nest')
    expect(gettingStarted!.groups[0]!.tabs.length).toBeGreaterThanOrEqual(2)
    // The whole default document must be schema-valid
    expect(StorageSchemaZod.safeParse(data).success).toBe(true)
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
    setNextSetError('QUOTA_BYTES quota exceeded')
    await expect(storage.writeStorage({ trash: [] })).rejects.toThrow(/^QuotaExceededError:/)
  })

  it('recovers after a failed write — the queue is not poisoned', async () => {
    seed()
    setNextSetError('QUOTA_BYTES quota exceeded')
    await expect(storage.writeStorage({ trash: [] })).rejects.toThrow()

    const workspaces = [makeWorkspace('After failure')]
    // writeStorage resolves with the document as written
    await expect(storage.writeStorage({ workspaces })).resolves.toMatchObject({ workspaces })
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
    // Content moves intact; the id is regenerated so the tombstone on the
    // old id (sync duplicate suppression) can't touch the destination copy.
    const moved = cats[1]!.groups[0]!.tabs[0]!
    expect(moved).toEqual({ ...tab, id: moved.id })
    expect(moved.id).not.toBe(tab.id)
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

describe('deleteWorkspace', () => {
  it('moves the workspace to trash instead of hard-deleting', async () => {
    const doomed = makeWorkspace('Doomed')
    const keeper = makeWorkspace('Keeper')
    seed([doomed, keeper])

    const item = await storage.deleteWorkspace(doomed.id)

    expect(stored().workspaces.map((w) => w.name)).toEqual(['Keeper'])
    expect(stored().trash).toHaveLength(1)
    expect(item.type).toBe('workspace')
    expect(item.data).toEqual(doomed)
  })

  it('throws for an unknown workspace id', async () => {
    seed()
    await expect(storage.deleteWorkspace(crypto.randomUUID())).rejects.toThrow(/not found/)
  })

  it('restoreFromTrash brings a deleted workspace back', async () => {
    const doomed = makeWorkspace('Doomed')
    const keeper = makeWorkspace('Keeper')
    seed([doomed, keeper])

    const item = await storage.deleteWorkspace(doomed.id)
    await storage.restoreFromTrash(item.id)

    expect(stored().workspaces.map((w) => w.name)).toEqual(['Keeper', 'Doomed'])
    expect(stored().trash).toHaveLength(0)
  })
})

describe('createWorkspace from template', () => {
  it('copies category structure without groups or notes', async () => {
    const template = makeWorkspace('Template', [
      makeCategory('Work', [makeGroup('G', [makeTab()])]),
      makeCategory('Play'),
    ])
    seed([template])

    const newId = await storage.createWorkspace('Copy', template.id)

    const created = stored().workspaces.find((w) => w.id === newId)!
    expect(created.categories.map((c) => c.name)).toEqual(['Work', 'Play'])
    expect(created.categories[0]!.groups).toEqual([])
    expect(created.categories[0]!.id).not.toBe(template.categories[0]!.id)
  })

  it('falls back to the default single category without a template', async () => {
    seed()
    const newId = await storage.createWorkspace('Plain')
    const created = stored().workspaces.find((w) => w.id === newId)!
    expect(created.categories).toHaveLength(1)
    expect(created.categories[0]!.name).toBe('General')
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

    // updated_at is bumped on restore (tombstone rule) — everything else intact
    expect(stored().workspaces[0]!.categories[0]!.groups).toEqual([
      { ...group, updated_at: expect.any(Number) },
    ])
    expect(stored().trash).toHaveLength(0)
  })

  it('falls back to the first workspace/category when the original location is gone', async () => {
    const group = makeGroup('Orphan')
    const item = trashedGroup(group, crypto.randomUUID(), crypto.randomUUID())
    const ws = makeWorkspace()
    seed([ws], [item])

    await storage.restoreFromTrash(item.id)

    expect(stored().workspaces[0]!.categories[0]!.groups).toEqual([
      { ...group, updated_at: expect.any(Number) },
    ])
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

  it('bumps updated_at on group restore so the restore outranks its deletion tombstone', async () => {
    const group = { ...makeGroup('Restorable'), updated_at: 1000 }
    const cat = makeCategory()
    const ws = makeWorkspace('WS', [cat])
    const item: TrashItem = {
      id: crypto.randomUUID(),
      type: 'group',
      data: group,
      original_location: { workspace_id: ws.id, category_id: cat.id },
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

  it('folds the legacy tabnest_theme key into settings.theme and removes it', async () => {
    seed() // settings.theme defaults to 'system'
    setStoreKey('tabnest_theme', 'dark')

    await storage.migrateIfNeeded()

    expect(stored().settings.theme).toBe('dark')
    expect(storeKey('tabnest_theme')).toBeUndefined()
  })

  it('removes an invalid legacy tabnest_theme value without touching settings', async () => {
    seed()
    setStoreKey('tabnest_theme', 'neon')

    await storage.migrateIfNeeded()

    expect(stored().settings.theme).toBe('system')
    expect(storeKey('tabnest_theme')).toBeUndefined()
  })

  it('migrates v1 data: sync fields move to local_settings, accent_color is removed', async () => {
    const ws = makeWorkspace()
    setStoreKey('tabnest_data', {
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
    })

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
    setStoreKey('tabnest_data', {
      schema_version: 4,
      workspaces: [v4ws],
      settings: { ...DEFAULT_SETTINGS },
      sync_meta: DEFAULT_SYNC_META(),
      trash: [],
    })

    await storage.migrateIfNeeded()

    const data = stored()
    expect(data.schema_version).toBe(SCHEMA_VERSION)
    expect(data.workspaces[0]!.categories[0]!.notes).toEqual([])
  })

  it('lifts a v6 in-document backup_generations into the tabnest_backups key', async () => {
    const legacy = seed()
    setStoreKey('tabnest_data', {
      ...legacy,
      schema_version: 6,
      backup_generations: [{ saved_at: 123, workspaces: [makeWorkspace('gen')] }],
    })

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
    setStoreKey('tabnest_data', { ...legacy, schema_version: 5, backup_local: [makeWorkspace('legacy')] })

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
    setStoreKey('tabnest_data', { ...legacy, schema_version: 6 })

    await storage.migrateIfNeeded()

    expect(stored().schema_version).toBe(SCHEMA_VERSION)
    expect(storedBackups()).toBeUndefined()
  })

  it('lifts backups even when the migrated document fails validation (failure path must not lose the only copy)', async () => {
    setStoreKey('tabnest_data', {
      schema_version: 6,
      workspaces: [{ id: 'not-a-uuid', name: 'Broken' }],
      settings: { ...DEFAULT_SETTINGS },
      sync_meta: DEFAULT_SYNC_META(),
      trash: [],
      backup_generations: [{ saved_at: 5, workspaces: [makeWorkspace('precious')] }],
    })

    await storage.migrateIfNeeded()

    expect(stored().sync_meta.sync_state).toBe('error')
    expect(storedBackups()).toHaveLength(1)
    expect(storedBackups()![0]!.workspaces[0]!.name).toBe('precious')
  })

  it('never overwrites an existing non-empty tabnest_backups key (idempotent re-run)', async () => {
    const existing = [{ saved_at: 999, workspaces: [makeWorkspace('keep-me')] }]
    setStoreKey('tabnest_backups', existing)
    const legacy = seed()
    setStoreKey('tabnest_data', {
      ...legacy,
      schema_version: 6,
      backup_generations: [{ saved_at: 1, workspaces: [makeWorkspace('stale')] }],
    })

    await storage.migrateIfNeeded()

    expect(storedBackups()).toEqual(existing)
  })

  it('flags a sync error instead of persisting an invalid migrated document', async () => {
    setStoreKey('tabnest_data', {
      schema_version: 1,
      workspaces: [{ id: 'not-a-uuid', name: 'Broken' }],
      settings: { ...DEFAULT_SETTINGS },
      sync_meta: DEFAULT_SYNC_META(),
      trash: [],
    })

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

// ---------------------------------------------------------------------------
// Read-modify-write atomicity (audit F06): every mutation helper must compute
// its patch INSIDE the write queue (updater form). A helper that reads outside
// the queue and enqueues a precomputed patch loses concurrent writes.
// ---------------------------------------------------------------------------

describe('mutation helpers are atomic under concurrency', () => {
  it('saveTabGroup + renameGroup fired together both land', async () => {
    const existing = makeGroup('Existing')
    const cat = makeCategory('Cat', [existing])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    const fresh = makeGroup('Fresh')
    await Promise.all([
      storage.saveTabGroup({ group: fresh, categoryId: cat.id, workspaceId: ws.id }),
      storage.renameGroup(ws.id, cat.id, existing.id, 'Renamed'),
    ])

    const groups = stored().workspaces[0]!.categories[0]!.groups
    expect(groups.map((g) => g.name).sort()).toEqual(['Fresh', 'Renamed'])
  })

  it('two concurrent addTabToGroup calls keep both tabs', async () => {
    const group = makeGroup('G')
    const cat = makeCategory('Cat', [group])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    const t1 = makeTab('One')
    const t2 = makeTab('Two')
    await Promise.all([
      storage.addTabToGroup(ws.id, cat.id, group.id, t1),
      storage.addTabToGroup(ws.id, cat.id, group.id, t2),
    ])

    const tabs = stored().workspaces[0]!.categories[0]!.groups[0]!.tabs
    expect(tabs.map((t) => t.title).sort()).toEqual(['One', 'Two'])
  })

  it('deleteTabGroup + concurrent trash write keep both trash items', async () => {
    const g1 = makeGroup('Doomed1')
    const g2 = makeGroup('Doomed2')
    const cat = makeCategory('Cat', [g1, g2])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    await Promise.all([
      storage.deleteTabGroup({ groupId: g1.id, categoryId: cat.id, workspaceId: ws.id }),
      storage.deleteTabGroup({ groupId: g2.id, categoryId: cat.id, workspaceId: ws.id }),
    ])

    expect(stored().workspaces[0]!.categories[0]!.groups).toHaveLength(0)
    expect(stored().trash).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Sync tombstone contract (audit F01–F05): every delete path must leave a
// tombstone in trash, and every restore path must bump the entity's timestamp
// past its tombstone, or mergeSyncedState resurrects/re-deletes across devices.
// ---------------------------------------------------------------------------

describe('sync tombstone contract', () => {
  it('removeTabFromGroup tombstones the tab and bumps the group, so sync cannot resurrect it', async () => {
    const doomed: SavedTab = { ...makeTab('Doomed'), saved_at: past() }
    const group = { ...makeGroup('G', [doomed]), updated_at: past() }
    const cat = makeCategory('Cat', [group])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])
    const remoteSnapshot = structuredClone({ workspaces: stored().workspaces, trash: stored().trash })

    await storage.removeTabFromGroup(ws.id, cat.id, group.id, doomed.id)

    const trash = stored().trash
    expect(trash).toHaveLength(1)
    expect(trash[0]!.type).toBe('tab')
    expect((trash[0]!.data as SavedTab).id).toBe(doomed.id)

    const merged = mergeSyncedState(
      { workspaces: stored().workspaces, trash: stored().trash },
      remoteSnapshot,
    )
    expect(merged.workspaces[0]!.categories[0]!.groups[0]!.tabs).toHaveLength(0)
  })

  it('a removed tab can be restored from trash and survives the merge afterwards', async () => {
    const doomed: SavedTab = { ...makeTab('Doomed'), saved_at: past() }
    const group = { ...makeGroup('G', [doomed]), updated_at: past() }
    const cat = makeCategory('Cat', [group])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    await storage.removeTabFromGroup(ws.id, cat.id, group.id, doomed.id)
    // Simulate the removal tombstone having synced to another device
    const remoteTombstone = structuredClone(stored().trash[0]!)
    await storage.restoreFromTrash(remoteTombstone.id)

    const tabs = stored().workspaces[0]!.categories[0]!.groups[0]!.tabs
    expect(tabs.map((t) => t.id)).toEqual([doomed.id])
    // The restored tab must outrank the tombstone still in the remote trash
    const merged = mergeSyncedState(
      { workspaces: stored().workspaces, trash: [] },
      { workspaces: [], trash: [remoteTombstone] },
    )
    expect(merged.workspaces[0]!.categories[0]!.groups[0]!.tabs).toHaveLength(1)
  })

  it('moveTabBetweenGroups leaves no path for sync to duplicate the tab', async () => {
    const moved: SavedTab = { ...makeTab('Moved'), saved_at: past() }
    const source = { ...makeGroup('Source', [moved]), updated_at: past() }
    const dest = { ...makeGroup('Dest'), updated_at: past() }
    const cat = makeCategory('Cat', [source, dest])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])
    const remoteSnapshot = structuredClone({ workspaces: stored().workspaces, trash: stored().trash })

    await storage.moveTabBetweenGroups(ws.id, source.id, dest.id, moved.id)

    const merged = mergeSyncedState(
      { workspaces: stored().workspaces, trash: stored().trash },
      remoteSnapshot,
    )
    const groups = merged.workspaces[0]!.categories[0]!.groups
    const urls = groups.flatMap((g) => g.tabs.map((t) => t.url))
    expect(urls).toEqual([moved.url]) // exactly once, in dest only
    expect(groups.find((g) => g.id === dest.id)!.tabs).toHaveLength(1)
  })

  it('the move tombstone is hidden from the trash UI', async () => {
    const moved: SavedTab = { ...makeTab('Moved'), saved_at: past() }
    const source = { ...makeGroup('Source', [moved]), updated_at: past() }
    const dest = { ...makeGroup('Dest'), updated_at: past() }
    const cat = makeCategory('Cat', [source, dest])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    await storage.moveTabBetweenGroups(ws.id, source.id, dest.id, moved.id)

    expect(stored().trash).toHaveLength(1)
    expect(stored().trash[0]!.hidden).toBe(true)
  })

  it('deleteCategory moves the category to trash and sync honors the deletion', async () => {
    const group = { ...makeGroup('G'), updated_at: past() }
    const cat = makeCategory('Doomed', [group])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])
    const remoteSnapshot = structuredClone({ workspaces: stored().workspaces, trash: stored().trash })

    await storage.deleteCategory(ws.id, cat.id)

    expect(stored().workspaces[0]!.categories).toHaveLength(0)
    expect(stored().trash).toHaveLength(1)
    expect(stored().trash[0]!.type).toBe('category')

    const merged = mergeSyncedState(
      { workspaces: stored().workspaces, trash: stored().trash },
      remoteSnapshot,
    )
    expect(merged.workspaces[0]!.categories).toHaveLength(0)
  })

  it('a deleted category can be restored from trash and survives the merge afterwards', async () => {
    const group = { ...makeGroup('G'), updated_at: past() }
    const cat = makeCategory('Doomed', [group])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    await storage.deleteCategory(ws.id, cat.id)
    const tombstoneItem = structuredClone(stored().trash[0]!)
    await storage.restoreFromTrash(tombstoneItem.id)

    const categories = stored().workspaces[0]!.categories
    expect(categories.map((c) => c.id)).toEqual([cat.id])
    expect(categories[0]!.groups.map((g) => g.id)).toEqual([group.id])

    // Even when the tombstone is still in another device's trash, the
    // restored (re-stamped) category must survive the merge.
    const merged = mergeSyncedState(
      { workspaces: stored().workspaces, trash: stored().trash },
      { workspaces: [], trash: [tombstoneItem] },
    )
    expect(merged.workspaces[0]!.categories.map((c) => c.id)).toEqual([cat.id])
  })

  it('a restored EMPTY workspace outranks its tombstone (nothing nested to re-stamp)', async () => {
    const doomed = { ...makeWorkspace('Doomed', []), created_at: past() }
    const keeper = makeWorkspace('Keeper')
    seed([doomed, keeper])

    const item = await storage.deleteWorkspace(doomed.id)
    const tombstoneItem = structuredClone(stored().trash.find((t) => t.id === item!.id)!)
    await storage.restoreFromTrash(item!.id)

    const merged = mergeSyncedState(
      { workspaces: stored().workspaces, trash: stored().trash },
      { workspaces: [], trash: [tombstoneItem] },
    )
    expect(merged.workspaces.map((w) => w.id)).toContain(doomed.id)
  })

  it('clearing a group note tombstones it so sync cannot resurrect it', async () => {
    const cleared = { id: crypto.randomUUID(), content: 'old', created_at: past(), updated_at: past() }
    const group = { ...makeGroup('G'), updated_at: past(), notes: [cleared] }
    const cat = makeCategory('Cat', [group])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])
    const remoteSnapshot = structuredClone({ workspaces: stored().workspaces, trash: stored().trash })

    await storage.saveGroupNote(ws.id, cat.id, group.id, '')

    const merged = mergeSyncedState(
      { workspaces: stored().workspaces, trash: stored().trash },
      remoteSnapshot,
    )
    expect(merged.workspaces[0]!.categories[0]!.groups[0]!.notes).toHaveLength(0)
    expect(stored().trash[0]!.hidden).toBe(true)
  })

  it('deleteCategoryNote tombstones the standalone note', async () => {
    const doomed = { id: crypto.randomUUID(), content: 'standalone', created_at: past(), updated_at: past() }
    const cat = { ...makeCategory('Cat'), notes: [doomed] }
    const ws = makeWorkspace('WS', [cat])
    seed([ws])
    const remoteSnapshot = structuredClone({ workspaces: stored().workspaces, trash: stored().trash })

    await storage.deleteCategoryNote(ws.id, cat.id, doomed.id)

    const merged = mergeSyncedState(
      { workspaces: stored().workspaces, trash: stored().trash },
      remoteSnapshot,
    )
    expect(merged.workspaces[0]!.categories[0]!.notes).toHaveLength(0)
  })

  it('restoreLocalBackup re-stamps restored entities so old tombstones cannot re-delete them', async () => {
    const doomedTab: SavedTab = { ...makeTab('T'), saved_at: past() }
    const group = { ...makeGroup('G', [doomedTab]), updated_at: past() }
    const cat = makeCategory('Cat', [group])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    // Snapshot the healthy state, then delete the group (tombstone) and the tab path
    await storage.pushLocalBackup(structuredClone(stored().workspaces))
    await storage.deleteTabGroup({ groupId: group.id, categoryId: cat.id, workspaceId: ws.id })
    expect(stored().workspaces[0]!.categories[0]!.groups).toHaveLength(0)

    await storage.restoreLocalBackup(0)
    expect(stored().workspaces[0]!.categories[0]!.groups).toHaveLength(1)

    // The tombstone from the deletion is still in trash — the restored group
    // must survive a merge (its updated_at must postdate the tombstone).
    const merged = mergeSyncedState(
      { workspaces: stored().workspaces, trash: stored().trash },
      { workspaces: [], trash: [] },
    )
    expect(merged.workspaces[0]!.categories[0]!.groups).toHaveLength(1)
    expect(merged.workspaces[0]!.categories[0]!.groups[0]!.tabs).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// saveTabsToGroup (audit F08–F10): the SAVE_TABS path must append to an
// existing group when an id is given, and new groups must get a real order.
// ---------------------------------------------------------------------------

describe('saveTabsToGroup', () => {
  it('appends to the existing group when groupId matches (no duplicate group)', async () => {
    const existing = makeGroup('Research', [makeTab('Old')])
    const cat = makeCategory('Cat', [existing])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    const returnedId = await storage.saveTabsToGroup({
      workspaceId: ws.id,
      categoryId: cat.id,
      groupId: existing.id,
      groupName: 'Research',
      tabs: [makeTab('New')],
    })

    const groups = stored().workspaces[0]!.categories[0]!.groups
    expect(groups).toHaveLength(1)
    expect(groups[0]!.tabs.map((t) => t.title)).toEqual(['Old', 'New'])
    expect(returnedId).toBe(existing.id)
  })

  it('creates a new group at the end of the category when no groupId is given', async () => {
    const g0 = { ...makeGroup('First'), order: 0 }
    const cat = makeCategory('Cat', [g0])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    const newId = await storage.saveTabsToGroup({
      workspaceId: ws.id,
      categoryId: cat.id,
      groupId: null,
      groupName: 'Second',
      tabs: [makeTab('T')],
    })

    const groups = stored().workspaces[0]!.categories[0]!.groups
    expect(groups).toHaveLength(2)
    const created = groups.find((g) => g.id === newId)!
    expect(created.name).toBe('Second')
    expect(created.order).toBe(1) // not hardcoded 0
  })

  it('falls back to creating a new group when the given groupId no longer exists', async () => {
    const cat = makeCategory('Cat', [])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    const newId = await storage.saveTabsToGroup({
      workspaceId: ws.id,
      categoryId: cat.id,
      groupId: crypto.randomUUID(), // stale recent-chip id
      groupName: 'Research',
      tabs: [makeTab('T')],
    })

    const groups = stored().workspaces[0]!.categories[0]!.groups
    expect(groups).toHaveLength(1)
    expect(groups[0]!.id).toBe(newId)
    expect(groups[0]!.tabs).toHaveLength(1)
  })

  it('throws when the category does not exist (no silent false success)', async () => {
    const ws = makeWorkspace('WS', [makeCategory('Cat')])
    seed([ws])
    await expect(
      storage.saveTabsToGroup({
        workspaceId: ws.id,
        categoryId: crypto.randomUUID(),
        groupId: null,
        groupName: 'X',
        tabs: [makeTab('T')],
      }),
    ).rejects.toThrow(/not found/)
  })
})

// ---------------------------------------------------------------------------
// Cross-category group moves (issue #17): the merge dedupes group ids across
// categories, so a stale remote can no longer duplicate a moved group.
// ---------------------------------------------------------------------------

describe('group moves survive sync without duplication', () => {
  /** Categories holding the group after merging current storage with `remote`. */
  const holdersAfterMergeWith = (
    remote: { workspaces: Workspace[]; trash: TrashItem[] },
    groupId: string,
  ): Category[] =>
    mergeSyncedState({ workspaces: stored().workspaces, trash: stored().trash }, remote)
      .workspaces[0]!.categories.filter((c) => c.groups.some((g) => g.id === groupId))

  it('moveGroupToCategory: a stale remote cannot duplicate the group', async () => {
    const moved = { ...makeGroup('Moved', [makeTab('T')]), updated_at: past() }
    const from = makeCategory('From', [moved])
    const to = makeCategory('To')
    const ws = makeWorkspace('WS', [from, to])
    seed([ws])
    const remoteSnapshot = structuredClone({ workspaces: stored().workspaces, trash: stored().trash })

    await storage.moveGroupToCategory(ws.id, moved.id, to.id)

    const holders = holdersAfterMergeWith(remoteSnapshot, moved.id)
    expect(holders.map((c) => c.id)).toEqual([to.id])
    expect(holders[0]!.groups.find((g) => g.id === moved.id)!.tabs).toHaveLength(1)
  })

  it('archiveGroup: a stale remote cannot resurrect the group outside Archive', async () => {
    const archived = { ...makeGroup('Old', [makeTab('T')]), updated_at: past() }
    const cat = makeCategory('Cat', [archived])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])
    const remoteSnapshot = structuredClone({ workspaces: stored().workspaces, trash: stored().trash })

    await storage.archiveGroup(ws.id, cat.id, archived.id)

    const holders = holdersAfterMergeWith(remoteSnapshot, archived.id)
    expect(holders.map((c) => c.name)).toEqual([storage.ARCHIVE_CATEGORY_NAME])
    expect(holders[0]!.groups.find((g) => g.id === archived.id)!.archived).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Every scalar edit must bump the timestamp its merge level compares, or sync
// silently drops it — see newerFirst in merge.ts for the mechanism. A no-op
// edit must conversely skip the write, so an idle device cannot outrank a real
// edit made elsewhere (nor trigger a pointless Drive push).
// ---------------------------------------------------------------------------

describe('scalar edits propagate across devices', () => {
  /** Our edited state as the OTHER (stale) device sees it after merging. */
  const syncToStaleDevice = (stale: {
    workspaces: Workspace[]
    trash: TrashItem[]
  }): Workspace => mergeSyncedState(stale, current()).workspaces[0]!

  it('renameGroup bumps updated_at so the new name reaches the other device', async () => {
    const target = { ...makeGroup('Before', [makeTab('T')]), updated_at: past() }
    const cat = makeCategory('Cat', [target])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])
    const stale = snapshot()

    await storage.renameGroup(ws.id, cat.id, target.id, 'After')

    expect(syncToStaleDevice(stale).categories[0]!.groups[0]!.name).toBe('After')
    expect(stored().workspaces[0]!.categories[0]!.groups[0]!.updated_at).toBeGreaterThan(target.updated_at)
  })

  it.each([
    ['an unchanged name', 'Before'],
    ['a blank name', '   '],
  ])('renameGroup skips the write for %s', async (_label, input) => {
    const target = { ...makeGroup('Before'), updated_at: past() }
    const cat = makeCategory('Cat', [target])
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    await storage.renameGroup(ws.id, cat.id, target.id, input)

    const after = stored().workspaces[0]!.categories[0]!.groups[0]!
    expect(after.name).toBe('Before')
    expect(after.updated_at).toBe(target.updated_at)
    // No write at all — a bump here would schedule a Drive push for nothing
    expect(stored().sync_meta.last_modified_at).toBe(0)
  })

  it('renameWorkspace reaches the other device instead of losing to a stale remote', async () => {
    const ws = { ...makeWorkspace('Before'), updated_at: past() }
    seed([ws])
    const stale = snapshot()

    await storage.renameWorkspace(ws.id, 'After')

    expect(syncToStaleDevice(stale).name).toBe('After')
    // ...and the stale device must not push its old name back on the next round
    expect(mergeSyncedState(current(), stale).workspaces[0]!.name).toBe('After')
  })

  it('renameWorkspace skips the write for a no-op rename', async () => {
    const ws = { ...makeWorkspace('Same'), updated_at: past() }
    seed([ws])

    await storage.renameWorkspace(ws.id, 'Same')

    expect(stored().workspaces[0]!.updated_at).toBe(ws.updated_at)
    expect(stored().sync_meta.last_modified_at).toBe(0)
  })

  it('saveCategoryNote bumps the category so the edit is not stranded on one device', async () => {
    const cat = makeCategory('Cat')
    const ws = makeWorkspace('WS', [cat])
    seed([ws])
    const noteId = await storage.createCategoryNote(ws.id, cat.id, 'v1')
    // Both devices agree on v1 before the edit
    const stale = snapshot()

    await storage.saveCategoryNote(ws.id, cat.id, noteId, 'v2')

    const noteOn = (w: Workspace): string =>
      w.categories[0]!.notes!.find((n) => n.id === noteId)!.content
    expect(noteOn(syncToStaleDevice(stale))).toBe('v2')
    // Converges rather than ping-ponging: the stale side cannot win its own tie
    expect(
      noteOn(mergeSyncedState(stale, { ...current(), trash: [] }).workspaces[0]!),
    ).toBe('v2')
  })

  it('reorderCategories persists order so the drag is not reverted by the merge', async () => {
    const first = makeCategory('First')
    const second = makeCategory('Second')
    const ws = makeWorkspace('WS', [first, second])
    seed([ws])
    const stale = snapshot()

    await storage.reorderCategories(ws.id, [second.id, first.id])

    expect(stored().workspaces[0]!.categories.map((c) => c.name)).toEqual(['Second', 'First'])
    expect(syncToStaleDevice(stale).categories.map((c) => c.name)).toEqual(['Second', 'First'])
  })

  it('reorderCategories skips the write when nothing actually moved', async () => {
    const first = { ...makeCategory('First'), order: 0 }
    const second = { ...makeCategory('Second'), order: 1 }
    const ws = makeWorkspace('WS', [first, second])
    seed([ws])

    // The drag handler fires on drop-in-place too
    await storage.reorderCategories(ws.id, [first.id, second.id])

    expect(stored().sync_meta.last_modified_at).toBe(0)
  })

  // `collapsed` is the "hide this category from the All view" filter (the Eye
  // toggle in CategoryList), not viewport state — a saved content preference,
  // so it has to reach the other device like any other scalar edit.
  it('setCategoryCollapsed carries the All-view visibility choice to the other device', async () => {
    const cat = { ...makeCategory('Cat'), updated_at: past() }
    const ws = makeWorkspace('WS', [cat])
    seed([ws])
    const stale = snapshot()

    await storage.setCategoryCollapsed(ws.id, cat.id, true)

    expect(syncToStaleDevice(stale).categories[0]!.collapsed).toBe(true)
  })

  it('setAllCategoriesCollapsed carries the bulk visibility choice to the other device', async () => {
    const ws = makeWorkspace('WS', [
      { ...makeCategory('A'), updated_at: past() },
      { ...makeCategory('B'), updated_at: past() },
    ])
    seed([ws])
    const stale = snapshot()

    await storage.setAllCategoriesCollapsed(ws.id, true)

    expect(syncToStaleDevice(stale).categories.map((c) => c.collapsed)).toEqual([true, true])
  })

  it.each([
    ['setCategoryCollapsed', (s: typeof storage, w: string, c: string) => s.setCategoryCollapsed(w, c, false)],
    ['setAllCategoriesCollapsed', (s: typeof storage, w: string) => s.setAllCategoriesCollapsed(w, false)],
  ])('%s skips the write when visibility is already at that value', async (_label, run) => {
    const cat = { ...makeCategory('Cat'), collapsed: false, updated_at: past() }
    const ws = makeWorkspace('WS', [cat])
    seed([ws])

    await run(storage, ws.id, cat.id)

    expect(stored().workspaces[0]!.categories[0]!.updated_at).toBe(cat.updated_at)
    expect(stored().sync_meta.last_modified_at).toBe(0)
  })
})
