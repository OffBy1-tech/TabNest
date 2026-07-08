import { describe, it, expect } from 'vitest'
import { buildSearchIndex, createSearchEngine, search } from './search'
import type { Workspace, Category, TabGroup, SavedTab } from './schema'

function makeTab(title: string, url: string, note?: string): SavedTab {
  return { id: crypto.randomUUID(), title, url, saved_at: Date.now(), note }
}

function makeGroup(name: string, tabs: SavedTab[], noteContent?: string): TabGroup {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name,
    created_at: now,
    updated_at: now,
    order: 0,
    tabs,
    notes: noteContent
      ? [{ id: crypto.randomUUID(), content: noteContent, created_at: now, updated_at: now }]
      : [],
  }
}

function makeCategory(name: string, groups: TabGroup[]): Category {
  return { id: crypto.randomUUID(), name, color: '#6366f1', emoji: '📁', collapsed: false, order: 0, groups, notes: [] }
}

function makeWorkspace(name: string, categories: Category[]): Workspace {
  return { id: crypto.randomUUID(), name, created_at: Date.now(), categories }
}

const fixture = (): Workspace[] => [
  makeWorkspace('My Workspace', [
    makeCategory('Work', [
      makeGroup(
        'Research',
        [
          makeTab('Anthropic Docs', 'https://docs.anthropic.com/', 'tab-level secret note'),
          makeTab('MDN Web Docs', 'https://developer.mozilla.org/'),
        ],
        'group-level secret zanzibar note',
      ),
    ]),
    makeCategory('Personal', [makeGroup('Recipes', [makeTab('Pasta Carbonara', 'https://recipes.example/pasta')])]),
  ]),
]

describe('buildSearchIndex', () => {
  it('emits one record per workspace, category, group, and tab', () => {
    const records = buildSearchIndex(fixture())
    // 1 workspace + 2 categories + 2 groups + 3 tabs
    expect(records).toHaveLength(8)
    expect(records.filter((r) => r.type === 'workspace')).toHaveLength(1)
    expect(records.filter((r) => r.type === 'category')).toHaveLength(2)
    expect(records.filter((r) => r.type === 'group')).toHaveLength(2)
    expect(records.filter((r) => r.type === 'tab')).toHaveLength(3)
  })

  it('builds "Workspace > Category > Group" breadcrumbs', () => {
    const records = buildSearchIndex(fixture())
    const tab = records.find((r) => r.title === 'Anthropic Docs')
    expect(tab?.breadcrumb).toBe('My Workspace > Work > Research')
    const group = records.find((r) => r.type === 'group' && r.title === 'Recipes')
    expect(group?.breadcrumb).toBe('My Workspace > Personal > Recipes')
  })

  it('carries navigation ids on group and tab records', () => {
    const records = buildSearchIndex(fixture())
    const tab = records.find((r) => r.title === 'Pasta Carbonara')
    expect(tab?.workspace_id).toBeTruthy()
    expect(tab?.category_id).toBeTruthy()
    expect(tab?.group_id).toBeTruthy()
  })

  it('excludes note content from the index (privacy contract)', () => {
    const serialized = JSON.stringify(buildSearchIndex(fixture()))
    expect(serialized).not.toContain('secret')
    expect(serialized).not.toContain('zanzibar')
  })

  it('returns an empty index for no workspaces', () => {
    expect(buildSearchIndex([])).toEqual([])
  })
})

describe('search', () => {
  const engine = createSearchEngine(buildSearchIndex(fixture()))

  it('finds a tab by title', () => {
    const results = search(engine, 'Anthropic')
    expect(results.some((r) => r.type === 'tab' && r.title === 'Anthropic Docs')).toBe(true)
  })

  it('finds a tab by URL fragment', () => {
    const results = search(engine, 'mozilla')
    expect(results.some((r) => r.title === 'MDN Web Docs')).toBe(true)
  })

  it('finds a group by name and tabs by their group name', () => {
    const results = search(engine, 'Research')
    expect(results.some((r) => r.type === 'group' && r.title === 'Research')).toBe(true)
    expect(results.some((r) => r.type === 'tab' && r.group_name === 'Research')).toBe(true)
  })

  it('tolerates fuzzy queries with a typo', () => {
    const results = search(engine, 'carbonora')
    expect(results.some((r) => r.title === 'Pasta Carbonara')).toBe(true)
  })

  it('does not match note content', () => {
    expect(search(engine, 'zanzibar')).toEqual([])
  })

  it('returns [] for empty and whitespace-only queries', () => {
    expect(search(engine, '')).toEqual([])
    expect(search(engine, '   ')).toEqual([])
  })

  it('respects the result limit', () => {
    const manyTabs = Array.from({ length: 20 }, (_, i) =>
      makeTab(`Duplicate Result ${i}`, `https://example.com/${i}`),
    )
    const bigEngine = createSearchEngine(
      buildSearchIndex([makeWorkspace('WS', [makeCategory('Cat', [makeGroup('Grp', manyTabs)])])]),
    )
    expect(search(bigEngine, 'Duplicate', 5)).toHaveLength(5)
  })
})
