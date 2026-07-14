import { describe, expect, it } from 'vitest'
import {
  unionById,
  mergeGroups,
  mergeCategories,
  mergeWorkspaces,
  mergeTrash,
} from './merge'
import type { SavedTab, Note, TabGroup, Category, Workspace, TrashItem } from './schema'

// --- minimal typed builders (merge helpers read only these fields) ----------
const tab = (id: string): SavedTab => ({ id, title: id, url: `https://${id}.test`, saved_at: 1 })
const note = (id: string): Note => ({ id, content: id, created_at: 1, updated_at: 1 })
const group = (id: string, o: Partial<TabGroup> = {}): TabGroup => ({
  id, name: id, created_at: 1, updated_at: 1, order: 0, tabs: [], notes: [], ...o,
})
const category = (id: string, o: Partial<Category> = {}): Category => ({
  id, name: id, color: '', emoji: '', collapsed: false, order: 0, groups: [], notes: [], ...o,
})
const workspace = (id: string, categories: Category[]): Workspace => ({
  id, name: id, created_at: 1, categories,
})
const trash = (id: string): TrashItem => ({
  id, type: 'group', data: {}, original_location: { workspace_id: 'ws' }, deleted_at: 1,
})

describe('unionById', () => {
  it('concatenates and dedupes by id, keeping the primary copy', () => {
    const a1 = { id: 'a', v: 1 }
    const a2 = { id: 'a', v: 2 }
    const b = { id: 'b', v: 3 }
    const c = { id: 'c', v: 4 }
    const out = unionById([a1, b], [a2, c])
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(out.find((x) => x.id === 'a')).toBe(a1) // primary wins
  })
})

describe('mergeGroups', () => {
  it('unions tabs and notes of a group present on both sides (no data loss)', () => {
    const local = [group('g1', { updated_at: 2, tabs: [tab('t1')], notes: [note('n1')] })]
    const remote = [group('g1', { updated_at: 1, name: 'stale', tabs: [tab('t2')], notes: [note('n2')] })]

    const [merged] = mergeGroups(local, remote)
    expect(merged!.name).toBe('g1') // newer (local) scalar metadata wins
    expect(merged!.tabs.map((t) => t.id).sort()).toEqual(['t1', 't2'])
    expect(merged!.notes.map((n) => n.id).sort()).toEqual(['n1', 'n2'])
  })

  it('takes the newer side scalar when remote is newer, still unioning leaves', () => {
    const local = [group('g1', { updated_at: 1, name: 'old', tabs: [tab('t1')] })]
    const remote = [group('g1', { updated_at: 5, name: 'new', tabs: [tab('t2')] })]
    const [merged] = mergeGroups(local, remote)
    expect(merged!.name).toBe('new')
    expect(merged!.tabs.map((t) => t.id).sort()).toEqual(['t1', 't2'])
  })

  it('keeps groups that exist on only one side and renumbers order', () => {
    const merged = mergeGroups([group('a', { order: 5 })], [group('b', { order: 9 })])
    expect(merged.map((g) => g.id).sort()).toEqual(['a', 'b'])
    expect(merged.map((g) => g.order).sort()).toEqual([0, 1])
  })
})

describe('mergeCategories', () => {
  it('unions standalone category notes so neither device loses them', () => {
    const local = [category('c1', { notes: [note('ln')], groups: [group('gl')] })]
    const remote = [category('c1', { notes: [note('rn')], groups: [group('gr')] })]

    const [merged] = mergeCategories(local, remote)
    expect(merged!.notes.map((n) => n.id).sort()).toEqual(['ln', 'rn'])
    // groups from both sides survive the recursive merge too
    expect(merged!.groups.map((g) => g.id).sort()).toEqual(['gl', 'gr'])
  })
})

describe('mergeWorkspaces', () => {
  it('recursively unions down to group tabs across a shared workspace', () => {
    const local = [workspace('w', [category('c', { groups: [group('g', { updated_at: 1, tabs: [tab('t1')] })] })])]
    const remote = [workspace('w', [category('c', { groups: [group('g', { updated_at: 2, tabs: [tab('t2')] })] })])]

    const [ws] = mergeWorkspaces(local, remote)
    const tabs = ws!.categories[0]!.groups[0]!.tabs
    expect(tabs.map((t) => t.id).sort()).toEqual(['t1', 't2'])
  })

  it('keeps workspaces unique to one side', () => {
    const out = mergeWorkspaces([workspace('a', [])], [workspace('b', [])])
    expect(out.map((w) => w.id).sort()).toEqual(['a', 'b'])
  })
})

describe('mergeTrash', () => {
  it('unions by id without duplicating shared entries', () => {
    const out = mergeTrash([trash('x')], [trash('x'), trash('y')])
    expect(out.map((t) => t.id).sort()).toEqual(['x', 'y'])
  })
})
