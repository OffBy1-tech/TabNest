import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { TabGroup } from '@/lib/schema'
import { GroupGrid } from './GroupGrid'

function group(id: string, name: string): TabGroup {
  return { id, name, created_at: 0, updated_at: 0, order: 0, tabs: [], notes: [] }
}

function renderGrid(overrides: Partial<Parameters<typeof GroupGrid>[0]> = {}) {
  const props = {
    groups: [group('g1', 'Research'), group('g2', 'Reading')],
    viewMode: 'grid' as const,
    onRenameGroup: vi.fn(),
    onDeleteGroup: vi.fn(),
    onOpenAll: vi.fn(),
    onRemoveTab: vi.fn(),
    onMoveTab: vi.fn(),
    onOpenTab: vi.fn(),
    onSaveGroupNote: vi.fn(),
    onSaveTabNote: vi.fn(),
    showFavicons: true,
    ...overrides,
  }
  render(<GroupGrid {...props} />)
  return props
}

describe('GroupGrid', () => {
  it('renders a card per group', () => {
    renderGrid()
    expect(screen.getByRole('article', { name: /Research/ })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: /Reading/ })).toBeInTheDocument()
  })

  it('hides the New Group affordance when onCreateGroup is not provided', () => {
    renderGrid({ groups: [] })
    expect(screen.queryByRole('button', { name: 'Create new empty group' })).not.toBeInTheDocument()
    expect(screen.getByText('No groups yet. Save some tabs to get started.')).toBeInTheDocument()
  })

  it('shows the New Group button when creation is enabled', () => {
    renderGrid({ groups: [], onCreateGroup: vi.fn() })
    expect(screen.getByRole('button', { name: 'Create new empty group' })).toBeInTheDocument()
  })

  it('creates a group from the inline form, defaulting the name', () => {
    const onCreateGroup = vi.fn()
    const onCreatingGroupChange = vi.fn()
    renderGrid({ groups: [], onCreateGroup, creatingGroup: true, onCreatingGroupChange })
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }))
    expect(onCreateGroup).toHaveBeenCalledWith('New Group')
    expect(onCreatingGroupChange).toHaveBeenCalledWith(false)
  })

  it('creates a group with the typed name on Enter', () => {
    const onCreateGroup = vi.fn()
    renderGrid({ groups: [], onCreateGroup, creatingGroup: true, onCreatingGroupChange: vi.fn() })
    const input = screen.getByLabelText('New group name')
    fireEvent.change(input, { target: { value: 'Recipes' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCreateGroup).toHaveBeenCalledWith('Recipes')
  })
})
