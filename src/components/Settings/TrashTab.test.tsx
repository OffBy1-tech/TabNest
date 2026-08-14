import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { TrashItem } from '../../lib/schema'
import { TrashTab } from './TrashTab'

function makeItem(overrides: Partial<TrashItem> = {}): TrashItem {
  return {
    id: crypto.randomUUID(),
    type: 'group',
    data: { name: 'Research' },
    original_location: { workspace_id: crypto.randomUUID() },
    deleted_at: 1000,
    ...overrides,
  }
}

describe('TrashTab', () => {
  it('shows an empty state and hides the empty-trash button when there are no items', () => {
    render(<TrashTab trashItems={[]} onRestore={vi.fn()} onDeletePermanently={vi.fn()} onEmptyTrash={vi.fn()} />)
    expect(screen.getByText('Trash is empty')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Empty all trash permanently' })).not.toBeInTheDocument()
  })

  it('renders items newest-first by deleted_at', () => {
    const older = makeItem({ data: { name: 'Older' }, deleted_at: 100 })
    const newer = makeItem({ data: { name: 'Newer' }, deleted_at: 200 })
    render(<TrashTab trashItems={[older, newer]} onRestore={vi.fn()} onDeletePermanently={vi.fn()} onEmptyTrash={vi.fn()} />)
    const names = screen.getAllByText(/Older|Newer/).map((el) => el.textContent)
    expect(names).toEqual(['Newer', 'Older'])
  })

  it('falls back to "Untitled" when the item has no name', () => {
    render(<TrashTab trashItems={[makeItem({ data: {} })]} onRestore={vi.fn()} onDeletePermanently={vi.fn()} onEmptyTrash={vi.fn()} />)
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('wires up restore, delete, and empty-trash callbacks', () => {
    const item = makeItem({ data: { name: 'Research' } })
    const onRestore = vi.fn()
    const onDeletePermanently = vi.fn()
    const onEmptyTrash = vi.fn()
    render(<TrashTab trashItems={[item]} onRestore={onRestore} onDeletePermanently={onDeletePermanently} onEmptyTrash={onEmptyTrash} />)

    const li = screen.getByRole('listitem')
    fireEvent.click(within(li).getByRole('button', { name: 'Restore Research' }))
    expect(onRestore).toHaveBeenCalledWith(item.id)
    fireEvent.click(within(li).getByRole('button', { name: 'Delete Research permanently' }))
    expect(onDeletePermanently).toHaveBeenCalledWith(item.id)
    fireEvent.click(screen.getByRole('button', { name: 'Empty all trash permanently' }))
    expect(onEmptyTrash).toHaveBeenCalledOnce()
  })
})
