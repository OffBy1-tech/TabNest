> status: shipped 2026-08-06 (PR #8) — design record, retired; the code is the truth.

# Backup Diff & Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface `backup_generations` in Settings → Sync & Data with a semantic tree diff between any two snapshots (including current state) and a reversible whole-snapshot restore, per `.claude/docs/specs/2026-08-06-backup-diff-design.md`.

**Architecture:** Pure diff engine `src/lib/diff.ts` (id-keyed tree walk, mirrors `merge.ts` factoring) → presentational `DiffTree` component → `BackupsSection` (list + A/B compare picker + restore confirm) wired into `SyncAndDataTab`, which owns storage I/O. One new storage function `restoreLocalBackup`. No schema, service-worker, or dependency changes.

**Tech Stack:** TypeScript, React (inline styles + CSS custom properties from `tokens.css`), Vitest + Testing Library (jsdom), Storybook.

## Global Constraints

- Run all commands from the repo root (the path may contain spaces — always quote it).
- Work on the existing branch `feature/backup-diff` (already created, stacked on `fix/sync-union-merge-and-generational-backup`; the spec commit `493797d` is already on it).
- Only `src/lib/storage.ts` calls `chrome.storage` directly; components use its exported functions.
- All colors/spacing/typography via `var(--token)` CSS custom properties — no raw Tailwind color classes. Status colors: added `var(--color-success)`, removed `var(--color-danger)`, modified `var(--color-warning)` (all exist in `src/styles/tokens.css:31-33`).
- Diff ignores these fields (spec §1): `order`, `collapsed`, `archived`, `created_at`, `updated_at`, `saved_at`, `favicon`. Compared fields: workspace `name`; category `name,color,emoji`; group `name`; tab `title,url,note`; note `content`.
- Every new component gets a `.stories.tsx` and a `.test.tsx` (project convention).
- Commit messages: plain imperative sentences, NO session links, no generated-with footer. Plain `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` allowed.
- Verification: `npm run typecheck`, `npm run lint`, `npm test`, targeted `npx vitest run <file>`.

---

### Task 1: Diff engine — `src/lib/diff.ts`

**Files:**
- Create: `src/lib/diff.ts`
- Test: `src/lib/diff.test.ts`

**Interfaces:**
- Consumes: entity types from `./schema` (`Workspace`, `Category`, `TabGroup`, `SavedTab`, `Note`).
- Produces (all exported): `DiffStatus`, `FieldChange`, `TabDiff`, `NoteDiff`, `GroupDiff`, `CategoryDiff`, `WorkspaceDiff`, `diffWorkspaces(before: Workspace[], after: Workspace[]): WorkspaceDiff[]`, `snapshotStats(workspaces: Workspace[]): { workspaces: number; groups: number; tabs: number }`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/diff.test.ts` (builders copied from the `merge.test.ts` style):

```ts
import { describe, expect, it } from 'vitest'
import { diffWorkspaces, snapshotStats } from './diff'
import type { SavedTab, Note, TabGroup, Category, Workspace } from './schema'

// --- minimal typed builders (diff reads only these fields + ids) ------------
const tab = (id: string, o: Partial<SavedTab> = {}): SavedTab => ({
  id, title: id, url: `https://${id}.test`, saved_at: 1, ...o,
})
const note = (id: string, o: Partial<Note> = {}): Note => ({
  id, content: id, created_at: 1, updated_at: 1, ...o,
})
const group = (id: string, o: Partial<TabGroup> = {}): TabGroup => ({
  id, name: id, created_at: 1, updated_at: 1, order: 0, tabs: [], notes: [], ...o,
})
const category = (id: string, o: Partial<Category> = {}): Category => ({
  id, name: id, color: '#111111', emoji: '📁', collapsed: false, order: 0, groups: [], notes: [], ...o,
})
const workspace = (id: string, categories: Category[] = [], o: Partial<Workspace> = {}): Workspace => ({
  id, name: id, created_at: 1, categories, ...o,
})

describe('diffWorkspaces', () => {
  it('marks everything unchanged for identical inputs', () => {
    const ws = [workspace('w', [category('c', { groups: [group('g', { tabs: [tab('t')] })] })])]
    const out = diffWorkspaces(ws, structuredClone(ws))
    expect(out).toHaveLength(1)
    expect(out[0]!.status).toBe('unchanged')
    expect(out[0]!.categories[0]!.status).toBe('unchanged')
    expect(out[0]!.categories[0]!.groups[0]!.status).toBe('unchanged')
  })

  it('marks an after-only group added, listing ALL its tabs as added', () => {
    const before = [workspace('w', [category('c')])]
    const after = [workspace('w', [category('c', { groups: [group('g', { tabs: [tab('t1'), tab('t2')] })] })])]
    const out = diffWorkspaces(before, after)
    const g = out[0]!.categories[0]!.groups[0]!
    expect(g.status).toBe('added')
    expect(g.tabs.map((t) => t.status)).toEqual(['added', 'added'])
    // parents roll up to modified
    expect(out[0]!.status).toBe('modified')
    expect(out[0]!.categories[0]!.status).toBe('modified')
  })

  it('marks a before-only group removed, listing ALL its tabs and notes as removed', () => {
    const before = [workspace('w', [category('c', { groups: [group('g', { tabs: [tab('t1')], notes: [note('n1')] })] })])]
    const after = [workspace('w', [category('c')])]
    const g = diffWorkspaces(before, after)[0]!.categories[0]!.groups[0]!
    expect(g.status).toBe('removed')
    expect(g.tabs[0]!.status).toBe('removed')
    expect(g.notes[0]!.status).toBe('removed')
  })

  it('extracts scalar field changes (group rename, tab note edit, category color)', () => {
    const before = [workspace('w', [
      category('c', { color: '#111111', groups: [group('g', { name: 'To read', tabs: [tab('t', { note: 'old' })] })] }),
    ])]
    const after = [workspace('w', [
      category('c', { color: '#222222', groups: [group('g', { name: 'Reading list', tabs: [tab('t', { note: 'new' })] })] }),
    ])]
    const c = diffWorkspaces(before, after)[0]!.categories[0]!
    expect(c.status).toBe('modified')
    expect(c.fieldChanges).toEqual([{ field: 'color', before: '#111111', after: '#222222' }])
    const g = c.groups[0]!
    expect(g.fieldChanges).toEqual([{ field: 'name', before: 'To read', after: 'Reading list' }])
    expect(g.tabs[0]!.status).toBe('modified')
    expect(g.tabs[0]!.fieldChanges).toEqual([{ field: 'note', before: 'old', after: 'new' }])
  })

  it('treats ignored-field churn (order, collapsed, timestamps, favicon) as unchanged', () => {
    const before = [workspace('w', [category('c', { collapsed: false, order: 0, groups: [group('g', { updated_at: 1, order: 0, tabs: [tab('t', { saved_at: 1 })] })] })])]
    const after = [workspace('w', [category('c', { collapsed: true, order: 3, groups: [group('g', { updated_at: 99, order: 7, archived: true, tabs: [tab('t', { saved_at: 99, favicon: 'x.png' })] })] })])]
    expect(diffWorkspaces(before, after)[0]!.status).toBe('unchanged')
  })

  it('diffs standalone category notes and group notes by id with content changes', () => {
    const before = [workspace('w', [category('c', { notes: [note('kept', { content: 'a' }), note('gone')] })])]
    const after = [workspace('w', [category('c', { notes: [note('kept', { content: 'b' }), note('new')] })])]
    const c = diffWorkspaces(before, after)[0]!.categories[0]!
    expect(c.status).toBe('modified')
    const byId = new Map(c.notes.map((n) => [n.note.id, n]))
    expect(byId.get('kept')!.status).toBe('modified')
    expect(byId.get('kept')!.fieldChanges).toEqual([{ field: 'content', before: 'a', after: 'b' }])
    expect(byId.get('new')!.status).toBe('added')
    expect(byId.get('gone')!.status).toBe('removed')
  })

  it('orders output after-side first, before-only entries appended', () => {
    const before = [workspace('only-before'), workspace('both')]
    const after = [workspace('both'), workspace('only-after')]
    expect(diffWorkspaces(before, after).map((w) => w.workspace.id)).toEqual([
      'both', 'only-after', 'only-before',
    ])
  })

  it('handles empty sides', () => {
    expect(diffWorkspaces([], [])).toEqual([])
    expect(diffWorkspaces([], [workspace('w')])[0]!.status).toBe('added')
    expect(diffWorkspaces([workspace('w')], [])[0]!.status).toBe('removed')
  })
})

describe('snapshotStats', () => {
  it('counts workspaces, groups, and tabs', () => {
    const ws = [
      workspace('a', [category('c1', { groups: [group('g1', { tabs: [tab('t1'), tab('t2')] })] })]),
      workspace('b', [category('c2', { groups: [group('g2'), group('g3', { tabs: [tab('t3')] })] })]),
    ]
    expect(snapshotStats(ws)).toEqual({ workspaces: 2, groups: 3, tabs: 3 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/diff.test.ts`
Expected: FAIL — cannot resolve `./diff`.

- [ ] **Step 3: Implement `src/lib/diff.ts`**

```ts
/**
 * Semantic snapshot diff (backup diff feature — see
 * .claude/docs/specs/2026-08-06-backup-diff-design.md).
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
): Array<{ before?: T; after?: T }> {
  const beforeById = new Map(before.map((x) => [x.id, x]))
  const afterIds = new Set(after.map((x) => x.id))
  const pairs: Array<{ before?: T; after?: T }> = after.map((a) => ({
    before: beforeById.get(a.id),
    after: a,
  }))
  for (const b of before) {
    if (!afterIds.has(b.id)) pairs.push({ before: b })
  }
  return pairs
}

/** Compare the listed string-valued fields; absent/undefined reads as ''. */
function changedFields(before: object, after: object, fields: string[]): FieldChange[] {
  const b = before as Record<string, unknown>
  const a = after as Record<string, unknown>
  const changes: FieldChange[] = []
  for (const field of fields) {
    const bv = typeof b[field] === 'string' ? (b[field] as string) : ''
    const av = typeof a[field] === 'string' ? (a[field] as string) : ''
    if (bv !== av) changes.push({ field, before: bv, after: av })
  }
  return changes
}

const TAB_FIELDS = ['title', 'url', 'note']
const NOTE_FIELDS = ['content']
const GROUP_FIELDS = ['name']
const CATEGORY_FIELDS = ['name', 'color', 'emoji']
const WORKSPACE_FIELDS = ['name']

function diffTabs(before: SavedTab[], after: SavedTab[]): TabDiff[] {
  return pairById(before, after).map(({ before: b, after: a }) => {
    if (b && a) {
      const fieldChanges = changedFields(b, a, TAB_FIELDS)
      return { status: fieldChanges.length > 0 ? ('modified' as const) : ('unchanged' as const), tab: a, fieldChanges }
    }
    return { status: a ? ('added' as const) : ('removed' as const), tab: (a ?? b)!, fieldChanges: [] }
  })
}

function diffNotes(before: Note[], after: Note[]): NoteDiff[] {
  return pairById(before, after).map(({ before: b, after: a }) => {
    if (b && a) {
      const fieldChanges = changedFields(b, a, NOTE_FIELDS)
      return { status: fieldChanges.length > 0 ? ('modified' as const) : ('unchanged' as const), note: a, fieldChanges }
    }
    return { status: a ? ('added' as const) : ('removed' as const), note: (a ?? b)!, fieldChanges: [] }
  })
}

const isChanged = (d: { status: DiffStatus }): boolean => d.status !== 'unchanged'

function diffGroups(before: TabGroup[], after: TabGroup[]): GroupDiff[] {
  return pairById(before, after).map(({ before: b, after: a }) => {
    if (b && a) {
      const fieldChanges = changedFields(b, a, GROUP_FIELDS)
      const tabs = diffTabs(b.tabs, a.tabs)
      const notes = diffNotes(b.notes, a.notes)
      const modified = fieldChanges.length > 0 || tabs.some(isChanged) || notes.some(isChanged)
      return { status: modified ? ('modified' as const) : ('unchanged' as const), group: a, fieldChanges, tabs, notes }
    }
    const g = (a ?? b)!
    const status = a ? ('added' as const) : ('removed' as const)
    return {
      status,
      group: g,
      fieldChanges: [],
      tabs: g.tabs.map((t) => ({ status, tab: t, fieldChanges: [] })),
      notes: g.notes.map((n) => ({ status, note: n, fieldChanges: [] })),
    }
  })
}

function diffCategories(before: Category[], after: Category[]): CategoryDiff[] {
  return pairById(before, after).map(({ before: b, after: a }) => {
    if (b && a) {
      const fieldChanges = changedFields(b, a, CATEGORY_FIELDS)
      const groups = diffGroups(b.groups, a.groups)
      const notes = diffNotes(b.notes ?? [], a.notes ?? [])
      const modified = fieldChanges.length > 0 || groups.some(isChanged) || notes.some(isChanged)
      return { status: modified ? ('modified' as const) : ('unchanged' as const), category: a, fieldChanges, groups, notes }
    }
    const c = (a ?? b)!
    const status = a ? ('added' as const) : ('removed' as const)
    return {
      status,
      category: c,
      fieldChanges: [],
      groups: c.groups.map((g) => ({
        status,
        group: g,
        fieldChanges: [],
        tabs: g.tabs.map((t) => ({ status, tab: t, fieldChanges: [] })),
        notes: g.notes.map((n) => ({ status, note: n, fieldChanges: [] })),
      })),
      notes: (c.notes ?? []).map((n) => ({ status, note: n, fieldChanges: [] })),
    }
  })
}

// --- public API -------------------------------------------------------------

export function diffWorkspaces(before: Workspace[], after: Workspace[]): WorkspaceDiff[] {
  return pairById(before, after).map(({ before: b, after: a }) => {
    if (b && a) {
      const fieldChanges = changedFields(b, a, WORKSPACE_FIELDS)
      const categories = diffCategories(b.categories, a.categories)
      const modified = fieldChanges.length > 0 || categories.some(isChanged)
      return { status: modified ? ('modified' as const) : ('unchanged' as const), workspace: a, fieldChanges, categories }
    }
    const w = (a ?? b)!
    const status = a ? ('added' as const) : ('removed' as const)
    return {
      status,
      workspace: w,
      fieldChanges: [],
      categories: diffCategories(status === 'added' ? [] : w.categories, status === 'added' ? w.categories : []),
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/diff.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/diff.ts src/lib/diff.test.ts && git commit -m "Add semantic workspace snapshot diff engine"
```

---

### Task 2: `restoreLocalBackup` in storage.ts

**Files:**
- Modify: `src/lib/storage.ts` (append after `readLocalBackups`)
- Test: `src/lib/storage.test.ts` (append after the `generational local backup` describe)

**Interfaces:**
- Consumes: existing `readStorage`, `pushLocalBackup`, `writeStorage`.
- Produces: `export async function restoreLocalBackup(index: number): Promise<void>` (0 = newest generation).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/storage.test.ts` after the `describe('generational local backup', ...)` block:

```ts
describe('restoreLocalBackup', () => {
  it('replaces workspaces with the chosen generation, saving the current state as a backup first', async () => {
    seed([makeWorkspace('Live')])
    await storage.pushLocalBackup([makeWorkspace('Snap')])

    await storage.restoreLocalBackup(0)

    expect(stored().workspaces[0]!.name).toBe('Snap')
    const backups = await storage.readLocalBackups()
    expect(backups[0]!.workspaces[0]!.name).toBe('Live') // reversibility
  })

  it('bumps last_modified_at so the restore propagates via sync', async () => {
    seed([makeWorkspace('Live')])
    await storage.pushLocalBackup([makeWorkspace('Snap')])
    const before = stored().sync_meta.last_modified_at

    await storage.restoreLocalBackup(0)

    expect(stored().sync_meta.last_modified_at).toBeGreaterThan(before)
  })

  it('throws for a missing generation index', async () => {
    seed()
    await expect(storage.restoreLocalBackup(0)).rejects.toThrow(/not found/)
  })
})
```

Note: `seed()` writes `sync_meta: DEFAULT_SYNC_META()` — check `last_modified_at` starts at 0 there, so `toBeGreaterThan(before)` is robust.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `storage.restoreLocalBackup is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/storage.ts` directly after `readLocalBackups`:

```ts
/**
 * Replace current workspaces with backup generation `index` (0 = newest).
 * The current workspaces are pushed as a new generation first, so a restore
 * is itself undoable. Settings and trash are untouched (backups don't
 * contain them). The writeStorage call bumps last_modified_at, so the
 * restored state wins the next sync cycle and propagates to Drive.
 * Throws when the generation doesn't exist.
 */
export async function restoreLocalBackup(index: number): Promise<void> {
  const data = await readStorage()
  const generation = (data.backup_generations ?? [])[index]
  if (generation == null) {
    throw new Error(`Backup generation ${index} not found`)
  }
  await pushLocalBackup(data.workspaces)
  await writeStorage({ workspaces: generation.workspaces })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/storage.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts && git commit -m "Add reversible restoreLocalBackup for backup generations"
```

---

### Task 3: `DiffTree` component

**Files:**
- Create: `src/components/Settings/DiffTree.tsx`
- Create: `src/components/Settings/DiffTree.stories.tsx`
- Test: `src/components/Settings/DiffTree.test.tsx`

**Interfaces:**
- Consumes: `WorkspaceDiff`, `DiffStatus`, `FieldChange`, `TabDiff`, `NoteDiff`, `GroupDiff`, `CategoryDiff` from `../../lib/diff` (Task 1).
- Produces: `export function DiffTree({ diff }: { diff: WorkspaceDiff[] }): React.JSX.Element` — pure presentational, no storage access.

- [ ] **Step 1: Write the failing tests**

Create `src/components/Settings/DiffTree.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { diffWorkspaces } from '../../lib/diff'
import type { SavedTab, TabGroup, Category, Workspace } from '../../lib/schema'
import { DiffTree } from './DiffTree'

const tab = (id: string, o: Partial<SavedTab> = {}): SavedTab => ({
  id, title: id, url: `https://${id}.test`, saved_at: 1, ...o,
})
const group = (id: string, o: Partial<TabGroup> = {}): TabGroup => ({
  id, name: id, created_at: 1, updated_at: 1, order: 0, tabs: [], notes: [], ...o,
})
const category = (id: string, o: Partial<Category> = {}): Category => ({
  id, name: id, color: '#111111', emoji: '📁', collapsed: false, order: 0, groups: [], notes: [], ...o,
})
const workspace = (id: string, categories: Category[] = []): Workspace => ({
  id, name: id, created_at: 1, categories,
})

describe('DiffTree', () => {
  it('shows the no-differences state for an all-unchanged diff', () => {
    const ws = [workspace('w', [category('c')])]
    render(<DiffTree diff={diffWorkspaces(ws, structuredClone(ws))} />)
    expect(screen.getByText('No differences between these snapshots.')).toBeInTheDocument()
  })

  it('renders removed groups with their tabs and an unchanged sibling collapsed', () => {
    const before = [workspace('w', [
      category('changed', { groups: [group('scratch', { tabs: [tab('Ollama docs')] })] }),
      category('same', { groups: [group('keep')] }),
    ])]
    const after = [workspace('w', [category('changed'), category('same', { groups: [group('keep')] })])]
    render(<DiffTree diff={diffWorkspaces(before, after)} />)

    expect(screen.getByText('scratch')).toBeInTheDocument()
    expect(screen.getByText('Ollama docs')).toBeInTheDocument()
    // unchanged category renders as a single non-expandable row
    expect(screen.getByText('same')).toBeInTheDocument()
    expect(screen.getAllByText('unchanged').length).toBeGreaterThan(0)
    expect(screen.queryByText('keep')).not.toBeInTheDocument()
  })

  it('renders field changes for renames', () => {
    const before = [workspace('w', [category('c', { groups: [group('g', { name: 'To read' })] })])]
    const after = [workspace('w', [category('c', { groups: [group('g', { name: 'Reading list' })] })])]
    render(<DiffTree diff={diffWorkspaces(before, after)} />)
    expect(screen.getByText(/name: “To read” → “Reading list”/)).toBeInTheDocument()
  })

  it('truncates long tab lists at 10 and expands on demand', () => {
    const tabs = Array.from({ length: 14 }, (_, i) => tab(`tab-${i}`))
    const before = [workspace('w', [category('c', { groups: [group('big', { tabs })] })])]
    const after = [workspace('w', [category('c')])]
    render(<DiffTree diff={diffWorkspaces(before, after)} />)

    expect(screen.getByText('tab-9')).toBeInTheDocument()
    expect(screen.queryByText('tab-10')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show 4 more tabs' }))
    expect(screen.getByText('tab-13')).toBeInTheDocument()
  })

  it('collapses and re-expands a changed node via its toggle', () => {
    const before = [workspace('w', [category('c', { groups: [group('g', { tabs: [tab('t')] })] })])]
    const after = [workspace('w', [category('c', { groups: [group('g', { tabs: [tab('t'), tab('t2')] })] })])]
    render(<DiffTree diff={diffWorkspaces(before, after)} />)

    expect(screen.getByText('t2')).toBeInTheDocument()
    // collapse the workspace node — children disappear
    fireEvent.click(screen.getByRole('button', { name: 'Collapse w' }))
    expect(screen.queryByText('t2')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand w' }))
    expect(screen.getByText('t2')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Settings/DiffTree.test.tsx`
Expected: FAIL — cannot resolve `./DiffTree`.

- [ ] **Step 3: Implement `src/components/Settings/DiffTree.tsx`**

```tsx
/**
 * DiffTree.tsx
 * Pure presentational renderer for a WorkspaceDiff[] (lib/diff.ts).
 * No storage access. All colors from design tokens.
 */

import React, { useState } from 'react'
import type {
  DiffStatus,
  FieldChange,
  TabDiff,
  NoteDiff,
  GroupDiff,
  CategoryDiff,
  WorkspaceDiff,
} from '../../lib/diff'

const STATUS_COLOR: Record<DiffStatus, string> = {
  added: 'var(--color-success)',
  removed: 'var(--color-danger)',
  modified: 'var(--color-warning)',
  unchanged: 'var(--text-muted)',
}

const STATUS_PREFIX: Record<DiffStatus, string> = {
  added: '+',
  removed: '−',
  modified: '~',
  unchanged: '',
}

const TAB_TRUNCATE_AT = 10
const INDENT = 20

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.7,
  minWidth: 0,
}

const prefixStyle = (status: DiffStatus): React.CSSProperties => ({
  color: STATUS_COLOR[status],
  width: 14,
  flexShrink: 0,
  textAlign: 'center',
  fontWeight: 700,
})

const ellipsisStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

function StatusBadge({ status }: { status: DiffStatus }): React.JSX.Element {
  return (
    <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 'var(--text-xs)', color: STATUS_COLOR[status] }}>
      {status}
    </span>
  )
}

function FieldChangeRows({ changes, indent }: { changes: FieldChange[]; indent: number }): React.JSX.Element | null {
  if (changes.length === 0) return null
  return (
    <>
      {changes.map((c) => (
        <div key={c.field} style={{ ...rowStyle, paddingLeft: indent, fontSize: 'var(--text-xs)', color: STATUS_COLOR.modified }}>
          {c.field}: “{c.before}” → “{c.after}”
        </div>
      ))}
    </>
  )
}

function LeafRow({ status, label, fieldChanges, indent }: {
  status: DiffStatus
  label: string
  fieldChanges: FieldChange[]
  indent: number
}): React.JSX.Element {
  return (
    <>
      <div style={{ ...rowStyle, paddingLeft: indent }}>
        <span style={prefixStyle(status)}>{STATUS_PREFIX[status]}</span>
        <span style={{ ...ellipsisStyle, color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <FieldChangeRows changes={fieldChanges} indent={indent + 22} />
    </>
  )
}

/** Changed tabs + notes of one group, truncated at TAB_TRUNCATE_AT. */
function LeafList({ tabs, notes, indent }: { tabs: TabDiff[]; notes: NoteDiff[]; indent: number }): React.JSX.Element {
  const [showAll, setShowAll] = useState(false)
  const changedTabs = tabs.filter((t) => t.status !== 'unchanged')
  const changedNotes = notes.filter((n) => n.status !== 'unchanged')
  const visibleTabs = showAll ? changedTabs : changedTabs.slice(0, TAB_TRUNCATE_AT)
  const hidden = changedTabs.length - visibleTabs.length
  return (
    <>
      {visibleTabs.map((t) => (
        <LeafRow key={t.tab.id} status={t.status} label={t.tab.title} fieldChanges={t.fieldChanges} indent={indent} />
      ))}
      {hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            marginLeft: indent,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
          }}
          aria-label={`Show ${hidden} more tabs`}
        >
          … {hidden} more
        </button>
      )}
      {changedNotes.map((n) => (
        <LeafRow
          key={n.note.id}
          status={n.status}
          label={`note: ${n.note.content.slice(0, 40)}${n.note.content.length > 40 ? '…' : ''}`}
          fieldChanges={n.fieldChanges}
          indent={indent}
        />
      ))}
    </>
  )
}

/** Expandable row for workspace/category/group nodes. Unchanged = flat row. */
function Node({ status, label, detail, fieldChanges, indent, children }: {
  status: DiffStatus
  label: string
  detail?: string
  fieldChanges: FieldChange[]
  indent: number
  children?: React.ReactNode
}): React.JSX.Element {
  const expandable = status !== 'unchanged'
  const [open, setOpen] = useState(true)
  return (
    <div>
      <div style={{ ...rowStyle, paddingLeft: indent }}>
        {expandable ? (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
            aria-expanded={open}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              width: 14,
              flexShrink: 0,
              color: 'var(--text-muted)',
              fontSize: 'var(--text-xs)',
            }}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <span style={prefixStyle(status)}>{STATUS_PREFIX[status]}</span>
        <span style={{ ...ellipsisStyle, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        {detail && (
          <span style={{ flexShrink: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{detail}</span>
        )}
        <StatusBadge status={status} />
      </div>
      {expandable && open && (
        <>
          <FieldChangeRows changes={fieldChanges} indent={indent + 36} />
          {children}
        </>
      )}
    </div>
  )
}

function GroupNode({ g, indent }: { g: GroupDiff; indent: number }): React.JSX.Element {
  return (
    <Node
      status={g.status}
      label={g.group.name}
      detail={`${g.group.tabs.length} ${g.group.tabs.length === 1 ? 'tab' : 'tabs'}`}
      fieldChanges={g.fieldChanges}
      indent={indent}
    >
      <LeafList tabs={g.tabs} notes={g.notes} indent={indent + 36} />
    </Node>
  )
}

function CategoryNode({ c, indent }: { c: CategoryDiff; indent: number }): React.JSX.Element {
  return (
    <Node status={c.status} label={c.category.name} fieldChanges={c.fieldChanges} indent={indent}>
      {c.groups.filter((g) => g.status !== 'unchanged').map((g) => (
        <GroupNode key={g.group.id} g={g} indent={indent + INDENT} />
      ))}
      <LeafList tabs={[]} notes={c.notes} indent={indent + INDENT} />
    </Node>
  )
}

export function DiffTree({ diff }: { diff: WorkspaceDiff[] }): React.JSX.Element {
  if (diff.every((w) => w.status === 'unchanged')) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        No differences between these snapshots.
      </p>
    )
  }
  return (
    <div aria-label="Backup differences" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {diff.map((w) => (
        <Node key={w.workspace.id} status={w.status} label={w.workspace.name} fieldChanges={w.fieldChanges} indent={0}>
          {w.categories.map((c) => (
            <CategoryNode key={c.category.id} c={c} indent={INDENT} />
          ))}
        </Node>
      ))}
    </div>
  )
}
```

Note: unchanged categories still render (as flat rows) so the user sees the whole shape; unchanged groups inside a category are filtered out to keep modified categories readable — this matches the approved mock (`▸ Getting Started  unchanged` rows at category level, no unchanged group rows).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Settings/DiffTree.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Add stories**

Create `src/components/Settings/DiffTree.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { diffWorkspaces } from '../../lib/diff';
import type { SavedTab, TabGroup, Category, Workspace } from '../../lib/schema';
import { DiffTree } from './DiffTree';

const tab = (id: string, o: Partial<SavedTab> = {}): SavedTab => ({
  id, title: id, url: `https://${id}.test`, saved_at: 1, ...o,
});
const group = (id: string, o: Partial<TabGroup> = {}): TabGroup => ({
  id, name: id, created_at: 1, updated_at: 1, order: 0, tabs: [], notes: [], ...o,
});
const category = (id: string, o: Partial<Category> = {}): Category => ({
  id, name: id, color: '#6366f1', emoji: '📁', collapsed: false, order: 0, groups: [], notes: [], ...o,
});
const workspace = (id: string, name: string, categories: Category[]): Workspace => ({
  id, name, created_at: 1, categories,
});

const before = [
  workspace('w1', 'My Workspace', [
    category('research', {
      name: 'Research',
      groups: [
        group('scratch', { name: 'scratch', tabs: [tab('Ollama docs'), tab('LevelDB format'), tab('MV3 alarms')] }),
        group('reading', { name: 'To read', tabs: [tab('Old article')] }),
      ],
    }),
    category('start', { name: 'Getting Started', groups: [group('welcome', { name: 'Welcome', tabs: [tab('Docs')] })] }),
  ]),
];

const after = [
  workspace('w1', 'My Workspace', [
    category('research', {
      name: 'Research',
      groups: [
        group('reading', { name: 'Reading list', tabs: [tab('Old article'), tab('HN: MV3 pitfalls')] }),
        group('papers', { name: 'LLM papers', tabs: [tab('Attention'), tab('RLHF survey')] }),
      ],
    }),
    category('start', { name: 'Getting Started', groups: [group('welcome', { name: 'Welcome', tabs: [tab('Docs')] })] }),
  ]),
];

const meta = {
  title: 'Components/Settings/DiffTree',
  component: DiffTree,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof DiffTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedChanges: Story = {
  args: { diff: diffWorkspaces(before, after) },
};

export const NoDifferences: Story = {
  args: { diff: diffWorkspaces(after, after) },
};

export const LongTabListTruncated: Story = {
  args: {
    diff: diffWorkspaces(
      [workspace('w1', 'My Workspace', [category('c', { name: 'Research', groups: [group('big', { name: 'big window', tabs: Array.from({ length: 23 }, (_, i) => tab(`Tab ${i + 1}`)) })] })])],
      [workspace('w1', 'My Workspace', [category('c', { name: 'Research' })])],
    ),
  },
};
```

Run: `npx vitest run src/components/Settings/DiffTree.stories.tsx`
Expected: PASS (stories run as browser tests via the Storybook vitest addon; if the runner doesn't pick stories up individually, `npm test` in Task 5 covers them).

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings/DiffTree.tsx src/components/Settings/DiffTree.test.tsx src/components/Settings/DiffTree.stories.tsx && git commit -m "Add DiffTree renderer for backup snapshot diffs"
```

---

### Task 4: `BackupsSection` component

**Files:**
- Create: `src/components/Settings/BackupsSection.tsx`
- Create: `src/components/Settings/BackupsSection.stories.tsx`
- Test: `src/components/Settings/BackupsSection.test.tsx`

**Interfaces:**
- Consumes: `diffWorkspaces`, `snapshotStats` (Task 1); `DiffTree` (Task 3); `ConfirmDialog` from `../ConfirmDialog/ConfirmDialog` (`{ isOpen, title, message, confirmLabel?, onConfirm, onCancel, destructive? }`); `ghostBtnStyle`, `selectStyle` from `./styles`; types `BackupGeneration`, `Workspace` from `../../lib/schema`.
- Produces:
  ```ts
  export interface BackupsSectionProps {
    backups: BackupGeneration[]
    currentWorkspaces: Workspace[]
    onRestore: (index: number) => void
    restoreNotice: string | null
    restoreError: string | null
  }
  export function BackupsSection(props: BackupsSectionProps): React.JSX.Element
  ```
  Presentational + local UI state only; storage I/O stays in the parent (Task 5).

- [ ] **Step 1: Write the failing tests**

Create `src/components/Settings/BackupsSection.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { BackupGeneration, Workspace, Category, TabGroup, SavedTab } from '../../lib/schema'
import { BackupsSection } from './BackupsSection'

const tab = (id: string): SavedTab => ({ id, title: id, url: `https://${id}.test`, saved_at: 1 })
const group = (id: string, tabs: SavedTab[] = []): TabGroup => ({
  id, name: id, created_at: 1, updated_at: 1, order: 0, tabs, notes: [],
})
const category = (id: string, groups: TabGroup[] = []): Category => ({
  id, name: id, color: '#111111', emoji: '📁', collapsed: false, order: 0, groups, notes: [],
})
const workspace = (id: string, categories: Category[] = []): Workspace => ({
  id, name: id, created_at: 1, categories,
})

const current = [workspace('w', [category('c', [group('kept'), group('new-group')])])]
const snapshot = [workspace('w', [category('c', [group('kept'), group('lost', [tab('lost-tab')])])])]
const backups: BackupGeneration[] = [{ saved_at: 1754257500000, workspaces: snapshot }]

function renderSection(overrides: Partial<Parameters<typeof BackupsSection>[0]> = {}) {
  const onRestore = vi.fn()
  render(
    <BackupsSection
      backups={backups}
      currentWorkspaces={current}
      onRestore={onRestore}
      restoreNotice={null}
      restoreError={null}
      {...overrides}
    />,
  )
  return { onRestore }
}

describe('BackupsSection', () => {
  it('shows the empty state when there are no backups', () => {
    renderSection({ backups: [] })
    expect(screen.getByText(/No local backups yet/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Compare snapshot A')).not.toBeInTheDocument()
  })

  it('lists generations with stats and defaults the compare picker to newest backup vs Current', () => {
    renderSection()
    expect(screen.getByText(/1 workspace/)).toBeInTheDocument()
    expect(screen.getByText(/2 groups/)).toBeInTheDocument()
    const a = screen.getByLabelText('Compare snapshot A') as HTMLSelectElement
    const b = screen.getByLabelText('Compare snapshot B') as HTMLSelectElement
    expect(a.value).toBe('backup-0')
    expect(b.value).toBe('current')
  })

  it('renders the diff between the default selections (backup → current)', () => {
    renderSection()
    // 'lost' exists only in the backup → shows as removed; 'new-group' only in current → added
    expect(screen.getByText('lost')).toBeInTheDocument()
    expect(screen.getByText('new-group')).toBeInTheDocument()
    expect(screen.getByText('lost-tab')).toBeInTheDocument()
  })

  it('shows no differences when the same snapshot is selected on both sides', () => {
    renderSection()
    fireEvent.change(screen.getByLabelText('Compare snapshot A'), { target: { value: 'current' } })
    expect(screen.getByText('No differences between these snapshots.')).toBeInTheDocument()
  })

  it('labels a saved_at of 0 as a migrated snapshot of unknown time', () => {
    renderSection({ backups: [{ saved_at: 0, workspaces: snapshot }] })
    expect(screen.getAllByText(/unknown time \(migrated\)/).length).toBeGreaterThan(0)
  })

  it('confirms before restoring, then calls onRestore with the generation index', () => {
    const { onRestore } = renderSection()
    fireEvent.click(screen.getByRole('button', { name: /Restore backup 1/ }))
    expect(onRestore).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(onRestore).toHaveBeenCalledWith(0)
  })

  it('surfaces restore notice and error', () => {
    renderSection({ restoreNotice: 'Backup restored.', restoreError: null })
    expect(screen.getByRole('status')).toHaveTextContent('Backup restored.')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Settings/BackupsSection.test.tsx`
Expected: FAIL — cannot resolve `./BackupsSection`.

- [ ] **Step 3: Implement `src/components/Settings/BackupsSection.tsx`**

```tsx
/**
 * BackupsSection.tsx
 * "Local backups" section for Settings → Sync & Data: lists the generational
 * pre-overwrite snapshots (backup_generations), lets the user diff any two
 * snapshots (including current state) via DiffTree, and restore one.
 * Storage I/O lives in the parent (SyncAndDataTab) — this component is
 * presentational + local UI state.
 */

import React, { useMemo, useState } from 'react'
import type { BackupGeneration, Workspace } from '../../lib/schema'
import { diffWorkspaces, snapshotStats } from '../../lib/diff'
import { DiffTree } from './DiffTree'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { ghostBtnStyle, selectStyle } from './styles'

export interface BackupsSectionProps {
  backups: BackupGeneration[]
  currentWorkspaces: Workspace[]
  onRestore: (index: number) => void
  restoreNotice: string | null
  restoreError: string | null
}

type SnapshotKey = 'current' | `backup-${number}`

function snapshotDate(saved_at: number): string {
  return saved_at === 0 ? 'unknown time (migrated)' : new Date(saved_at).toLocaleString()
}

function statsText(workspaces: Workspace[]): string {
  const s = snapshotStats(workspaces)
  const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? '' : 's'}`
  return `${plural(s.workspaces, 'workspace')} · ${plural(s.groups, 'group')} · ${plural(s.tabs, 'tab')}`
}

export function BackupsSection({
  backups,
  currentWorkspaces,
  onRestore,
  restoreNotice,
  restoreError,
}: BackupsSectionProps): React.JSX.Element {
  const [selA, setSelA] = useState<SnapshotKey>(backups.length > 0 ? 'backup-0' : 'current')
  const [selB, setSelB] = useState<SnapshotKey>('current')
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null)

  const resolve = (key: SnapshotKey): Workspace[] =>
    key === 'current' ? currentWorkspaces : (backups[Number(key.slice('backup-'.length))]?.workspaces ?? [])

  const label = (key: SnapshotKey): string =>
    key === 'current'
      ? 'Current'
      : `Backup ${Number(key.slice('backup-'.length)) + 1} (${snapshotDate(backups[Number(key.slice('backup-'.length))]?.saved_at ?? 0)})`

  const diff = useMemo(
    () => diffWorkspaces(resolve(selA), resolve(selB)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selA, selB, backups, currentWorkspaces],
  )

  if (backups.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        No local backups yet. A backup is saved automatically before a sync overwrite or revision restore.
      </p>
    )
  }

  const options: SnapshotKey[] = ['current', ...backups.map((_, i) => `backup-${i}` as const)]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Generation list */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }} aria-label="Local backups">
        {backups.map((gen, i) => (
          <li key={`${gen.saved_at}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ flex: 1, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Backup {i + 1} · {snapshotDate(gen.saved_at)} · {statsText(gen.workspaces)}
            </span>
            <button
              onClick={() => setConfirmIndex(i)}
              style={{ ...ghostBtnStyle, padding: '2px var(--space-2)', fontSize: 'var(--text-xs)' }}
              aria-label={`Restore backup ${i + 1} from ${snapshotDate(gen.saved_at)}`}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>

      {restoreError && (
        <div role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>
          {restoreError}
        </div>
      )}
      {restoreNotice && (
        <div role="status" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>
          {restoreNotice}
        </div>
      )}

      {/* Compare picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Compare</span>
        <select
          value={selA}
          onChange={(e) => setSelA(e.target.value as SnapshotKey)}
          aria-label="Compare snapshot A"
          style={selectStyle}
        >
          {options.map((key) => (
            <option key={key} value={key}>{label(key)}</option>
          ))}
        </select>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>with</span>
        <select
          value={selB}
          onChange={(e) => setSelB(e.target.value as SnapshotKey)}
          aria-label="Compare snapshot B"
          style={selectStyle}
        >
          {options.map((key) => (
            <option key={key} value={key}>{label(key)}</option>
          ))}
        </select>
      </div>

      {/* Diff */}
      <DiffTree diff={diff} />

      <ConfirmDialog
        isOpen={confirmIndex !== null}
        title="Restore local backup"
        message={
          confirmIndex !== null
            ? `Replace your current workspaces with the backup from ${snapshotDate(backups[confirmIndex]?.saved_at ?? 0)}? Your current state will be saved as a new backup first. Settings and Trash are not affected.`
            : ''
        }
        confirmLabel="Restore"
        onConfirm={() => {
          if (confirmIndex !== null) onRestore(confirmIndex)
          setConfirmIndex(null)
        }}
        onCancel={() => setConfirmIndex(null)}
      />
    </div>
  )
}
```

Note on the `useMemo` deps disable: `resolve` is recreated every render; listing the actual data deps (`selA, selB, backups, currentWorkspaces`) is precise. If the project's eslint config doesn't flag it, drop the disable comment.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Settings/BackupsSection.test.tsx && npm run typecheck && npm run lint`
Expected: PASS. (The `ConfirmDialog` renders through `Modal` — if the confirm test can't find the `Restore` button because Modal portals or requires a DOM node, check how `SyncAndDataTab.test.tsx` handles its ConfirmDialog and mirror that setup.)

- [ ] **Step 5: Add stories**

Create `src/components/Settings/BackupsSection.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { BackupGeneration, Workspace, Category, TabGroup, SavedTab } from '../../lib/schema';
import { BackupsSection } from './BackupsSection';

const tab = (id: string): SavedTab => ({ id, title: id, url: `https://${id}.test`, saved_at: 1 });
const group = (id: string, name: string, tabs: SavedTab[] = []): TabGroup => ({
  id, name, created_at: 1, updated_at: 1, order: 0, tabs, notes: [],
});
const category = (id: string, name: string, groups: TabGroup[]): Category => ({
  id, name, color: '#6366f1', emoji: '📁', collapsed: false, order: 0, groups, notes: [],
});
const workspace = (id: string, name: string, categories: Category[]): Workspace => ({
  id, name, created_at: 1, categories,
});

const current = [workspace('w', 'My Workspace', [
  category('c', 'Research', [group('g1', 'Reading list', [tab('Article')]), group('g3', 'LLM papers', [tab('Attention')])]),
])];

const backups: BackupGeneration[] = [
  {
    saved_at: Date.now() - 3600_000,
    workspaces: [workspace('w', 'My Workspace', [
      category('c', 'Research', [group('g1', 'Reading list', [tab('Article')]), group('g2', 'scratch', [tab('Ollama docs'), tab('LevelDB format')])]),
    ])],
  },
  { saved_at: 0, workspaces: current },
];

const meta = {
  title: 'Components/Settings/BackupsSection',
  component: BackupsSection,
  parameters: { layout: 'padded' },
  args: {
    backups,
    currentWorkspaces: current,
    onRestore: (i) => console.log('restore', i),
    restoreNotice: null,
    restoreError: null,
  },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof BackupsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithBackups: Story = {};

export const Empty: Story = { args: { backups: [] } };

export const AfterRestore: Story = {
  args: { restoreNotice: 'Backup restored. Your previous workspaces were saved as a new backup.' },
};
```

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings/BackupsSection.tsx src/components/Settings/BackupsSection.test.tsx src/components/Settings/BackupsSection.stories.tsx && git commit -m "Add BackupsSection with snapshot compare picker and restore"
```

---

### Task 5: Wire into SyncAndDataTab + full verification

**Files:**
- Modify: `src/components/Settings/SyncAndDataTab.tsx` (imports; state near the revisions state block ~line 84; JSX after the Drive-revisions `ConfirmDialog`, before the `{/* ── Divider ── */}` comment ~line 418)

**Interfaces:**
- Consumes: `BackupsSection` (Task 4), `readLocalBackups`/`restoreLocalBackup` from `../../lib/storage` (Task 2), `BackupGeneration` type.
- Produces: no new exports. Backup loading + restore I/O live here; `BackupsSection` stays pure.

- [ ] **Step 1: Add imports and state**

In `src/components/Settings/SyncAndDataTab.tsx`:

Extend the storage import: `import { readStorage, writeStorage, readLocalBackups, restoreLocalBackup } from '../../lib/storage'`.
Extend the type import with `BackupGeneration`. Add `import { BackupsSection } from './BackupsSection'` and add `useEffect` to the React import if not present (it is — line 1).

After the Drive-revisions state block (below `const [restoredRevision, setRestoredRevision] = useState(false)`), add:

```tsx
  // Local backup generations (backup diff feature — spec 2026-08-06)
  const [localBackups, setLocalBackups] = useState<BackupGeneration[]>([])
  const [backupNotice, setBackupNotice] = useState<string | null>(null)
  const [backupError, setBackupError] = useState<string | null>(null)

  const reloadLocalBackups = useCallback(() => {
    // Non-extension contexts (npm run dev, storybook) reject — treat as none.
    readLocalBackups().then(setLocalBackups).catch(() => setLocalBackups([]))
  }, [])

  useEffect(() => {
    reloadLocalBackups()
  }, [reloadLocalBackups])

  const handleRestoreLocalBackup = useCallback(async (index: number) => {
    setBackupNotice(null)
    setBackupError(null)
    try {
      await restoreLocalBackup(index)
      setBackupNotice('Backup restored. Your previous workspaces were saved as a new backup.')
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : String(err))
    }
    reloadLocalBackups()
  }, [reloadLocalBackups])
```

- [ ] **Step 2: Render the section**

Directly after the Drive-revisions `<ConfirmDialog … />` closing tag and before the `{/* ── Divider ── */}` comment, insert:

```tsx
      {/* ── Local backups (diff & restore) ── */}
      <div style={{ borderTop: '1px solid var(--border-default)', margin: 'var(--space-6) 0' }} />
      <h4 style={subHeadingStyle}>Local backups</h4>
      <p style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        Snapshots saved automatically before a sync overwrite or restore. Compare any two — or against your current data — to see exactly what differs.
      </p>
      <BackupsSection
        backups={localBackups}
        currentWorkspaces={workspaces}
        onRestore={(i) => void handleRestoreLocalBackup(i)}
        restoreNotice={backupNotice}
        restoreError={backupError}
      />
```

- [ ] **Step 3: Full verification**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all PASS. If existing `SyncAndDataTab` tests emit act() warnings or fail from the new async `readLocalBackups` effect (it rejects without a `chrome` global and resolves state via `.catch`), wrap affected renders per the existing test file's patterns or mock `../../lib/storage` there — check how `SyncAndDataTab.test.tsx` already handles `readStorage`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Settings/SyncAndDataTab.tsx && git commit -m "Show local backups with diff and restore in Sync & Data settings"
```

---

### Task 6: Docs + PR

**Files:**
- Modify: `CLAUDE.md` (Drive sync paragraph)
- Modify: `.claude/docs/TabNest_Specification.md` (§11.3-adjacent restore wording, only if it mentions local backups)

- [ ] **Step 1: Update CLAUDE.md**

In the Drive sync paragraph, after the sentence ending `…see `pushLocalBackup`).`, append:

```markdown
Backups are browsable in Settings → Sync & Data (Local backups): semantic diff between any two snapshots or against current state (`src/lib/diff.ts`), with whole-snapshot restore (`restoreLocalBackup`).
```

- [ ] **Step 2: Commit docs**

```bash
git add CLAUDE.md .claude/docs/TabNest_Specification.md && git commit -m "Document local backup diff and restore UI"
```

(If the spec file needed no change, commit CLAUDE.md alone.)

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feature/backup-diff
```

Then check whether PR #7 has been merged (`gh pr view 7 --json state`):
- If **merged**: rebase onto main (`git fetch origin && git rebase origin/main && git push -f`) and open the PR with `--base main`.
- If **open**: open a stacked PR with `--base fix/sync-union-merge-and-generational-backup` and note in the body that it builds on #7.

PR title: `Add backup diff and restore UI`. Body: summarize the diff engine, the Settings section, and the reversible restore; link the spec file; no session links, no generated-with footer.

---

## Self-review notes

- **Spec coverage:** diff engine incl. ignored fields, ordering, added/removed children (Task 1) ✓; `snapshotStats` (Task 1) ✓; restore + reversibility + `last_modified_at` bump (Task 2) ✓; DiffTree statuses/colors/truncation/collapse + no-differences state (Task 3) ✓; list rows with stats + `saved_at 0` label + A/B picker defaults + confirm flow + notices (Task 4) ✓; empty state + non-extension resilience + inline placement in Sync & Data (Tasks 4–5) ✓; stories for every new component (Tasks 3–4) ✓.
- **Deviation from spec, deliberate:** spec said BackupsSection "loads generations itself via readLocalBackups()"; the plan moves loading up to SyncAndDataTab (which already owns storage I/O) so BackupsSection stays pure and storybook-able without mocks — same TrashTab pattern. Spec's intent (section shows live generations, refreshed after restore) is preserved.
- **Type consistency:** `BackupsSectionProps` matches usage in Task 5; `DiffTree({ diff })` matches Task 4's usage; `restoreLocalBackup(index)` matches Task 5's handler; diff types in Task 3 imports match Task 1 exports.
