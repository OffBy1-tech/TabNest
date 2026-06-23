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
})
