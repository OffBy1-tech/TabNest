import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SETTINGS,
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_SYNC_META,
  SCHEMA_VERSION,
  type StorageSchema,
  type Workspace,
  type Category,
  type TabGroup,
} from '../../lib/schema'
import { mergeImportedData } from './mergeImportedData'

function group(name: string, urls: string[] = []): TabGroup {
  return {
    id: crypto.randomUUID(),
    name,
    created_at: 0,
    updated_at: 0,
    order: 0,
    notes: [],
    tabs: urls.map((url) => ({ id: crypto.randomUUID(), title: url, url, saved_at: 0 })),
  }
}

function category(name: string, groups: TabGroup[]): Category {
  return { id: crypto.randomUUID(), name, color: '', emoji: '', collapsed: false, order: 0, groups, notes: [] }
}

function workspace(name: string, categories: Category[]): Workspace {
  return { id: crypto.randomUUID(), name, created_at: 0, categories }
}

function storage(workspaces: Workspace[]): StorageSchema {
  return {
    schema_version: SCHEMA_VERSION,
    workspaces,
    settings: DEFAULT_SETTINGS,
    local_settings: DEFAULT_LOCAL_SETTINGS,
    sync_meta: DEFAULT_SYNC_META(),
    trash: [],
  }
}

describe('mergeImportedData', () => {
  it('appends a brand-new workspace when no name matches', () => {
    const current = storage([workspace('Personal', [category('Reading', [group('A')])])])
    const incoming = storage([workspace('Work', [category('Docs', [group('B')])])])

    const result = mergeImportedData(current, incoming)

    expect(result.workspaces.map((w) => w.name)).toEqual(['Personal', 'Work'])
  })

  it('merges groups into a category with a matching (case-insensitive) name', () => {
    const current = storage([workspace('Personal', [category('Reading', [group('Existing')])])])
    const incoming = storage([workspace('personal', [category('reading', [group('Imported')])])])

    const result = mergeImportedData(current, incoming)

    expect(result.workspaces).toHaveLength(1)
    const reading = result.workspaces[0]!.categories[0]!
    expect(reading.groups.map((g) => g.name)).toEqual(['Existing', 'Imported'])
    // Appended group's order continues after the existing ones.
    expect(reading.groups[1]!.order).toBe(1)
  })

  it('adds a new category to a matched workspace when the category name is new', () => {
    const current = storage([workspace('Personal', [category('Reading', [group('A')])])])
    const incoming = storage([workspace('Personal', [category('Watch Later', [group('B')])])])

    const result = mergeImportedData(current, incoming)

    expect(result.workspaces).toHaveLength(1)
    expect(result.workspaces[0]!.categories.map((c) => c.name)).toEqual(['Reading', 'Watch Later'])
  })

  it('regenerates ids for imported entities so they cannot collide', () => {
    const incomingGroup = group('Imported', ['https://example.com'])
    const current = storage([workspace('Personal', [category('Reading', [group('A')])])])
    const incoming = storage([workspace('Personal', [category('Reading', [incomingGroup])])])

    const result = mergeImportedData(current, incoming)

    const merged = result.workspaces[0]!.categories[0]!.groups[1]!
    expect(merged.id).not.toBe(incomingGroup.id)
    expect(merged.tabs[0]!.id).not.toBe(incomingGroup.tabs[0]!.id)
  })

  it('does not mutate the original current data', () => {
    const current = storage([workspace('Personal', [category('Reading', [group('A')])])])
    const before = current.workspaces[0]!.categories[0]!.groups.length

    mergeImportedData(current, storage([workspace('Personal', [category('Reading', [group('B')])])]))

    expect(current.workspaces[0]!.categories[0]!.groups).toHaveLength(before)
  })
})
