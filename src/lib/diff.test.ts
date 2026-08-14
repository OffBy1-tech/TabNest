import { describe, expect, it } from 'vitest'
import { diffWorkspaces, snapshotStats } from './diff'
import { tab, note, group, category, workspace } from './testFixtures'

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
