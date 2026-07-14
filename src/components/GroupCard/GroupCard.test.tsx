import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { TabGroup } from '../../lib/schema'
import { GroupCard } from './GroupCard'
import { DRAG_TYPE, type DragPayload } from './dragTypes'

function makeGroup(tabCount: number): TabGroup {
  return {
    id: 'group-1',
    name: 'Research',
    created_at: 0,
    updated_at: 0,
    order: 0,
    notes: [],
    tabs: Array.from({ length: tabCount }, (_, i) => ({
      id: `tab-${i}`,
      title: `Tab ${i}`,
      url: `https://example.com/${i}`,
      saved_at: 0,
    })),
  }
}

function renderCard(overrides: Partial<Parameters<typeof GroupCard>[0]> = {}) {
  const props = {
    group: makeGroup(2),
    viewMode: 'grid' as const,
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onOpenAll: vi.fn(),
    onOpenTab: vi.fn(),
    onRemoveTab: vi.fn(),
    onMoveTab: vi.fn(),
    onSaveGroupNote: vi.fn(),
    onSaveTabNote: vi.fn(),
    ...overrides,
  }
  render(<GroupCard {...props} />)
  return props
}

describe('GroupCard', () => {
  it('renders the group name, tab count and its tabs', () => {
    renderCard()
    expect(screen.getByRole('article', { name: 'Research, 2 tabs' })).toBeInTheDocument()
    expect(screen.getByText('Tab 0')).toBeInTheDocument()
    expect(screen.getByText('Tab 1')).toBeInTheDocument()
  })

  it('calls onOpenAll from the header button', () => {
    const props = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Open all tabs' }))
    expect(props.onOpenAll).toHaveBeenCalledOnce()
  })

  it('enters inline editing when the name is clicked and renames on Enter', () => {
    const props = renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Group name: Research/ }))
    const input = screen.getByLabelText('Rename group')
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onRename).toHaveBeenCalledWith('group-1', 'Renamed')
  })

  it('only shows the first 5 tabs until expanded', () => {
    renderCard({ group: makeGroup(8) })
    expect(screen.getByText('Tab 4')).toBeInTheDocument()
    expect(screen.queryByText('Tab 5')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show 3 more tabs' }))
    expect(screen.getByText('Tab 5')).toBeInTheDocument()
  })

  it('opens the delete confirmation from the kebab menu and confirms', () => {
    const props = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Group options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(props.onDelete).toHaveBeenCalledWith('group-1')
  })

  it('calls onMoveTab when a tab from another group is dropped on it', () => {
    const props = renderCard()
    const article = screen.getByRole('article', { name: /Research/ })
    const payload: DragPayload = { tabId: 'tab-x', fromGroupId: 'other-group' }
    const data: Record<string, string> = { [DRAG_TYPE]: JSON.stringify(payload) }
    const dataTransfer = {
      types: [DRAG_TYPE],
      dropEffect: '',
      getData: (type: string) => data[type] ?? '',
    }
    fireEvent.dragOver(article, { dataTransfer })
    fireEvent.drop(article, { dataTransfer })
    expect(props.onMoveTab).toHaveBeenCalledWith('other-group', 'group-1', 'tab-x')
  })

  it('ignores a drop from the same group', () => {
    const props = renderCard()
    const article = screen.getByRole('article', { name: /Research/ })
    const payload: DragPayload = { tabId: 'tab-0', fromGroupId: 'group-1' }
    const data: Record<string, string> = { [DRAG_TYPE]: JSON.stringify(payload) }
    const dataTransfer = {
      types: [DRAG_TYPE],
      dropEffect: '',
      getData: (type: string) => data[type] ?? '',
    }
    fireEvent.drop(article, { dataTransfer })
    expect(props.onMoveTab).not.toHaveBeenCalled()
  })

  it('asks for confirmation before opening a large group', () => {
    const props = renderCard({ group: makeGroup(25) })
    fireEvent.click(screen.getByRole('button', { name: 'Open all tabs' }))
    expect(props.onOpenAll).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/25 tabs at once/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open 25 tabs' }))
    expect(props.onOpenAll).toHaveBeenCalledOnce()
  })

  it('shows optional kebab actions and fires their callbacks', () => {
    const props = renderCard({
      onOpenAllInBackground: vi.fn(),
      onDuplicate: vi.fn(),
      onArchive: vi.fn(),
      onExport: vi.fn(),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Group options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open All in Background' }))
    expect(props.onOpenAllInBackground).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Group options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(props.onDuplicate).toHaveBeenCalledWith('group-1')

    fireEvent.click(screen.getByRole('button', { name: 'Group options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }))
    expect(props.onArchive).toHaveBeenCalledWith('group-1')

    fireEvent.click(screen.getByRole('button', { name: 'Group options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy as URL list' }))
    expect(props.onExport).toHaveBeenCalledOnce()
  })

  it('moves the group via the Move to category submenu', () => {
    const props = renderCard({
      categories: [
        { id: 'cat-a', name: 'Work', emoji: '💼' },
        { id: 'cat-b', name: 'Play', emoji: '🎮' },
      ],
      currentCategoryId: 'cat-a',
      onMoveToCategory: vi.fn(),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Group options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to category…' }))
    // Current category is filtered out of the target list
    expect(screen.queryByRole('menuitem', { name: /Work/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: /Play/ }))
    expect(props.onMoveToCategory).toHaveBeenCalledWith('group-1', 'cat-b')
  })

  it('reorders a tab dropped on another row of the same group', () => {
    const props = renderCard({ group: makeGroup(3), onReorderTab: vi.fn() })
    const rows = screen.getAllByRole('listitem')
    const payload: DragPayload = { tabId: 'tab-2', fromGroupId: 'group-1' }
    const data: Record<string, string> = { [DRAG_TYPE]: JSON.stringify(payload) }
    const dataTransfer = {
      types: [DRAG_TYPE],
      dropEffect: '',
      getData: (type: string) => data[type] ?? '',
    }
    fireEvent.drop(rows[0]!, { dataTransfer })
    expect(props.onReorderTab).toHaveBeenCalledWith('group-1', 'tab-2', 0)
  })

  it('shows a note preview line when a note exists', () => {
    const group = makeGroup(1)
    group.notes = [{ id: 'n1', content: 'First line\nSecond line', created_at: 1, updated_at: 1 }]
    renderCard({ group })
    const preview = screen.getByRole('button', { name: 'Note preview: First line' })
    expect(preview).toHaveTextContent('First line')
    expect(preview).not.toHaveTextContent('Second line')
  })

  it('shows the creation date', () => {
    const group = makeGroup(1)
    group.created_at = new Date('2026-03-15T12:00:00Z').getTime()
    renderCard({ group })
    expect(screen.getByText(/^Created /)).toBeInTheDocument()
  })
})
