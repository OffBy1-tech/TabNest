/**
 * Semantic snapshot diff (backup diff feature — design record:
 * docs/archive/2026-08-06-backup-diff-design.md).
 *
 * Walks the workspace → category → group → tab/note hierarchy keyed by entity
 * id (same convention as merge.ts) and returns a typed tree of added/removed/
 * modified/unchanged nodes. Position/presentation/timestamp fields (order,
 * collapsed, archived, created_at, updated_at, saved_at, favicon) are ignored
 * — the question is "what data differs", not "what churned".
 *
 * Moves are not detected: a group moved between categories shows as removed
 * in one category and added in the other.
 *
 * Pure functions — no chrome deps, fully unit-testable.
 */

import type { Workspace, Category, TabGroup, SavedTab, Note } from './schema'

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged'

/** A scalar field that changed between the two sides. */
export interface FieldChange {
  field: string
  before: string
  after: string
}

export interface TabDiff {
  status: DiffStatus
  tab: SavedTab
  fieldChanges: FieldChange[]
}

export interface NoteDiff {
  status: DiffStatus
  note: Note
  fieldChanges: FieldChange[]
}

export interface GroupDiff {
  status: DiffStatus
  group: TabGroup
  fieldChanges: FieldChange[]
  tabs: TabDiff[]
  notes: NoteDiff[]
}

export interface CategoryDiff {
  status: DiffStatus
  category: Category
  fieldChanges: FieldChange[]
  groups: GroupDiff[]
  notes: NoteDiff[]
}

export interface WorkspaceDiff {
  status: DiffStatus
  workspace: Workspace
  fieldChanges: FieldChange[]
  categories: CategoryDiff[]
}

// --- internals --------------------------------------------------------------

/** Pair entries by id: after-side order first, before-only entries appended. */
function pairById<T extends { id: string }>(
  before: T[],
  after: T[],
): Array<{ before: T | undefined; after: T | undefined }> {
  const beforeById = new Map(before.map((x) => [x.id, x]))
  const afterIds = new Set(after.map((x) => x.id))
  const pairs: Array<{ before: T | undefined; after: T | undefined }> = after.map((a) => ({
    before: beforeById.get(a.id),
    after: a,
  }))
  for (const b of before) {
    if (!afterIds.has(b.id)) pairs.push({ before: b, after: undefined })
  }
  return pairs
}

/** Compare the listed string-valued fields; absent/undefined reads as ''. */
function changedFields(before: object, after: object, fields: string[]): FieldChange[] {
  const b = before as Record<string, unknown>
  const a = after as Record<string, unknown>
  const changes: FieldChange[] = []
  for (const field of fields) {
    const bv = b[field]
    const av = a[field]
    const beforeValue = typeof bv === 'string' ? bv : ''
    const afterValue = typeof av === 'string' ? av : ''
    if (beforeValue !== afterValue) changes.push({ field, before: beforeValue, after: afterValue })
  }
  return changes
}

const TAB_FIELDS = ['title', 'url', 'note']
const NOTE_FIELDS = ['content']
const GROUP_FIELDS = ['name']
const CATEGORY_FIELDS = ['name', 'color', 'emoji']
const WORKSPACE_FIELDS = ['name']

/** Shared leaf semantics for tabs and notes: modified iff a listed field changed. */
function leafDiff<T extends { id: string }>(
  b: T | undefined,
  a: T | undefined,
  fields: string[],
): { status: DiffStatus; entity: T; fieldChanges: FieldChange[] } {
  if (b && a) {
    const fieldChanges = changedFields(b, a, fields)
    return { status: fieldChanges.length > 0 ? 'modified' : 'unchanged', entity: a, fieldChanges }
  }
  return { status: a ? 'added' : 'removed', entity: (a ?? b)!, fieldChanges: [] }
}

function diffTabs(before: SavedTab[], after: SavedTab[]): TabDiff[] {
  return pairById(before, after).map(({ before: b, after: a }): TabDiff => {
    const { entity, ...d } = leafDiff(b, a, TAB_FIELDS)
    return { ...d, tab: entity }
  })
}

function diffNotes(before: Note[], after: Note[]): NoteDiff[] {
  return pairById(before, after).map(({ before: b, after: a }): NoteDiff => {
    const { entity, ...d } = leafDiff(b, a, NOTE_FIELDS)
    return { ...d, note: entity }
  })
}

const isChanged = (d: { status: DiffStatus }): boolean => d.status !== 'unchanged'

// Added/removed containers reuse the recursive differs with one side empty,
// which yields all children carrying the same status — no hand-built subtrees.

function diffGroups(before: TabGroup[], after: TabGroup[]): GroupDiff[] {
  return pairById(before, after).map(({ before: b, after: a }): GroupDiff => {
    if (b && a) {
      const fieldChanges = changedFields(b, a, GROUP_FIELDS)
      const tabs = diffTabs(b.tabs, a.tabs)
      const notes = diffNotes(b.notes, a.notes)
      const modified = fieldChanges.length > 0 || tabs.some(isChanged) || notes.some(isChanged)
      return { status: modified ? 'modified' : 'unchanged', group: a, fieldChanges, tabs, notes }
    }
    const g = (a ?? b)!
    return {
      status: a ? 'added' : 'removed',
      group: g,
      fieldChanges: [],
      tabs: diffTabs(a ? [] : g.tabs, a ? g.tabs : []),
      notes: diffNotes(a ? [] : g.notes, a ? g.notes : []),
    }
  })
}

function diffCategories(before: Category[], after: Category[]): CategoryDiff[] {
  return pairById(before, after).map(({ before: b, after: a }): CategoryDiff => {
    if (b && a) {
      const fieldChanges = changedFields(b, a, CATEGORY_FIELDS)
      const groups = diffGroups(b.groups, a.groups)
      const notes = diffNotes(b.notes ?? [], a.notes ?? [])
      const modified = fieldChanges.length > 0 || groups.some(isChanged) || notes.some(isChanged)
      return { status: modified ? 'modified' : 'unchanged', category: a, fieldChanges, groups, notes }
    }
    const c = (a ?? b)!
    const notes = c.notes ?? []
    return {
      status: a ? 'added' : 'removed',
      category: c,
      fieldChanges: [],
      groups: diffGroups(a ? [] : c.groups, a ? c.groups : []),
      notes: diffNotes(a ? [] : notes, a ? notes : []),
    }
  })
}

// --- public API -------------------------------------------------------------

export function diffWorkspaces(before: Workspace[], after: Workspace[]): WorkspaceDiff[] {
  return pairById(before, after).map(({ before: b, after: a }): WorkspaceDiff => {
    if (b && a) {
      const fieldChanges = changedFields(b, a, WORKSPACE_FIELDS)
      const categories = diffCategories(b.categories, a.categories)
      const modified = fieldChanges.length > 0 || categories.some(isChanged)
      return { status: modified ? 'modified' : 'unchanged', workspace: a, fieldChanges, categories }
    }
    const w = (a ?? b)!
    return {
      status: a ? 'added' : 'removed',
      workspace: w,
      fieldChanges: [],
      categories: diffCategories(a ? [] : w.categories, a ? w.categories : []),
    }
  })
}

/** Cheap summary for a snapshot row: counts of workspaces, groups, tabs. */
export function snapshotStats(workspaces: Workspace[]): { workspaces: number; groups: number; tabs: number } {
  let groups = 0
  let tabs = 0
  for (const ws of workspaces) {
    for (const cat of ws.categories) {
      for (const g of cat.groups) {
        groups += 1
        tabs += g.tabs.length
      }
    }
  }
  return { workspaces: workspaces.length, groups, tabs }
}
