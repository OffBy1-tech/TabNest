import type { Workspace } from '../../lib/schema'

/** Minimal chrome.tabs.Tab for tests/stories (only the fields the UI reads). */
export function makeTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    id: 1,
    title: 'Example',
    url: 'https://example.com',
    favIconUrl: '',
    active: false,
    ...overrides,
  } as chrome.tabs.Tab
}

export function makeWorkspaces(): Workspace[] {
  return [
    {
      id: 'ws-1',
      name: 'Personal',
      created_at: 0,
      categories: [
        {
          id: 'cat-1',
          name: 'Reading',
          color: '',
          emoji: '📚',
          collapsed: false,
          order: 0,
          groups: [
            { id: 'grp-1', name: 'Articles', created_at: 0, updated_at: 0, order: 0, tabs: [], notes: [] },
          ],
        },
      ],
    },
  ]
}
