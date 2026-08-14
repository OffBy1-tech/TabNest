import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Category, Workspace } from '../../lib/schema'
import { CategoryList } from './CategoryList'

function category(id: string, name: string, emoji = '📁'): Category {
  return { id, name, color: '', emoji, collapsed: false, order: 0, groups: [], notes: [] }
}

const workspaces: Workspace[] = [{ id: 'ws-1', name: 'Personal', created_at: 0, categories: [] }]

function renderList(overrides: Partial<Parameters<typeof CategoryList>[0]> = {}) {
  const props = {
    categories: [category('c1', 'Reading'), category('c2', 'Work')],
    selectedCategoryId: null,
    onSelectCategory: vi.fn(),
    onCreateCategory: vi.fn(),
    onRenameCategory: vi.fn(),
    onDeleteCategory: vi.fn(),
    onReorderCategories: vi.fn(),
    onToggleCollapse: vi.fn(),
    workspaces,
    activeWorkspaceId: 'ws-1',
    onSelectWorkspace: vi.fn(),
    onCreateWorkspace: vi.fn(),
    onRenameWorkspace: vi.fn(),
    ...overrides,
  }
  render(<CategoryList {...props} />)
  return props
}

describe('CategoryList', () => {
  it('renders the "All" pseudo-item and each category', () => {
    renderList()
    expect(screen.getByRole('button', { name: 'All categories' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reading, 0 groups/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Work, 0 groups/ })).toBeInTheDocument()
  })

  it('selects a category on click', () => {
    const props = renderList()
    fireEvent.click(screen.getByRole('button', { name: /Reading, 0 groups/ }))
    expect(props.onSelectCategory).toHaveBeenCalledWith('c1')
  })

  it('selects "All" (null) on click', () => {
    const props = renderList({ selectedCategoryId: 'c1' })
    fireEvent.click(screen.getByRole('button', { name: 'All categories' }))
    expect(props.onSelectCategory).toHaveBeenCalledWith(null)
  })

  it('toggles a category’s visibility', () => {
    const props = renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Hide Reading from All view' }))
    expect(props.onToggleCollapse).toHaveBeenCalledWith('c1')
  })

  it('creates a new category through the inline input', () => {
    const props = renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Create new category' }))
    const input = screen.getByLabelText('Rename category')
    fireEvent.change(input, { target: { value: 'Recipes' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onCreateCategory).toHaveBeenCalledWith('Recipes')
  })

  it('opens the workspace dropdown and lists workspaces', () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: /Current workspace: Personal/ }))
    expect(screen.getByRole('menu', { name: 'Workspaces' })).toBeInTheDocument()
  })

  it('renames a category via the right-click context menu', () => {
    const props = renderList()
    fireEvent.contextMenu(screen.getByRole('button', { name: /Reading, 0 groups/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const input = screen.getByLabelText('Rename category')
    fireEvent.change(input, { target: { value: 'Articles' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onRenameCategory).toHaveBeenCalledWith('c1', 'Articles')
  })

  it('deletes a category via the context menu', () => {
    const props = renderList()
    fireEvent.contextMenu(screen.getByRole('button', { name: /Work, 0 groups/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(props.onDeleteCategory).toHaveBeenCalledWith('c2')
  })
})
