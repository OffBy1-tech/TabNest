import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { Workspace, Category, TabGroup, SavedTab } from '../../lib/schema'
import { SearchOverlay } from './SearchOverlay'

function makeTab(title: string, url: string, savedAt: number): SavedTab {
  return { id: crypto.randomUUID(), title, url, saved_at: savedAt }
}

function makeGroup(name: string, tabs: SavedTab[]): TabGroup {
  const now = Date.now()
  return { id: crypto.randomUUID(), name, created_at: now, updated_at: now, order: 0, tabs, notes: [] }
}

function makeCategory(name: string, groups: TabGroup[]): Category {
  return { id: crypto.randomUUID(), name, color: '', emoji: '📁', collapsed: false, order: 0, groups, notes: [] }
}

const NOW = Date.now()

const workspaces: Workspace[] = [
  {
    id: crypto.randomUUID(),
    name: 'Alpha WS',
    created_at: NOW,
    categories: [
      makeCategory('Work', [
        makeGroup('Alpha Group', [
          makeTab('Alpha Tab New', 'https://a.example/new', NOW - 1000),
          makeTab('Alpha Tab Old', 'https://a.example/old', NOW - 60 * 24 * 60 * 60 * 1000),
        ]),
      ]),
    ],
  },
  {
    id: crypto.randomUUID(),
    name: 'Beta WS',
    created_at: NOW,
    categories: [
      makeCategory('Play', [makeGroup('Alpha Beta Group', [makeTab('Alpha Beta Tab', 'https://b.example/', NOW)])]),
    ],
  },
]

function renderOverlay() {
  const onClose = vi.fn()
  const onNavigate = vi.fn()
  render(<SearchOverlay isOpen workspaces={workspaces} onClose={onClose} onNavigate={onNavigate} />)
  return { onClose, onNavigate }
}

function typeQuery(text: string) {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: text } })
}

describe('SearchOverlay filters & sort', () => {
  it('shows type chips, filter selects, and a sort select', () => {
    renderOverlay()
    expect(screen.getByRole('button', { name: 'Tabs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Groups' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Categories' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filter by workspace' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filter by category' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filter by date' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Sort results' })).toBeInTheDocument()
  })

  it('type chip restricts results to that type', () => {
    renderOverlay()
    typeQuery('Alpha')
    // Unfiltered: both tab and group results appear
    expect(within(screen.getByRole('listbox')).getAllByRole('option').length).toBeGreaterThan(2)

    fireEvent.click(screen.getByRole('button', { name: 'Groups' }))
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options.length).toBe(2) // Alpha Group + Alpha Beta Group
    expect(screen.queryByText('Alpha Tab New')).not.toBeInTheDocument()
  })

  it('workspace filter restricts results to that workspace', () => {
    renderOverlay()
    typeQuery('Alpha')
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by workspace' }), {
      target: { value: workspaces[1]!.id },
    })
    expect(screen.queryByText('Alpha Tab New')).not.toBeInTheDocument()
    expect(screen.getByText('Alpha Beta Tab')).toBeInTheDocument()
  })

  it('date filter drops old tabs', () => {
    renderOverlay()
    typeQuery('Alpha Tab')
    expect(screen.getByText('Alpha Tab Old')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by date' }), {
      target: { value: 'week' },
    })
    expect(screen.queryByText('Alpha Tab Old')).not.toBeInTheDocument()
    expect(screen.getByText('Alpha Tab New')).toBeInTheDocument()
  })

  it('A–Z sort orders results alphabetically within sections', () => {
    renderOverlay()
    typeQuery('Alpha Tab')
    fireEvent.click(screen.getByRole('button', { name: 'Tabs' })) // tabs only
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort results' }), {
      target: { value: 'az' },
    })
    const titles = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .map((o) => o.textContent)
    const idxBeta = titles.findIndex((t) => t?.includes('Alpha Beta Tab'))
    const idxNew = titles.findIndex((t) => t?.includes('Alpha Tab New'))
    expect(idxBeta).toBeLessThan(idxNew)
  })

  it('filters persist across close and reopen (session persistence)', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <SearchOverlay isOpen workspaces={workspaces} onClose={onClose} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Groups' }))
    expect(screen.getByRole('button', { name: 'Groups' })).toHaveAttribute('aria-pressed', 'true')

    rerender(<SearchOverlay isOpen={false} workspaces={workspaces} onClose={onClose} />)
    rerender(<SearchOverlay isOpen workspaces={workspaces} onClose={onClose} />)

    expect(screen.getByRole('button', { name: 'Groups' })).toHaveAttribute('aria-pressed', 'true')
  })
})
