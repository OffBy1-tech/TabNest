import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SavedTab } from '../../lib/schema'
import { TabRow } from './TabRow'
import { DRAG_TYPE, type DragPayload } from './dragTypes'

const tab: SavedTab = {
  id: 'tab-1',
  title: 'React Docs',
  url: 'https://www.react.dev/learn',
  favicon: 'https://react.dev/favicon.ico',
  saved_at: 0,
}

function renderRow(overrides: Partial<Parameters<typeof TabRow>[0]> = {}) {
  const props = {
    tab,
    groupId: 'group-1',
    onOpenTab: vi.fn(),
    onRemoveTab: vi.fn(),
    onSaveTabNote: vi.fn(),
    ...overrides,
  }
  render(<TabRow {...props} />)
  return props
}

describe('TabRow', () => {
  it('shows the title and the www-stripped domain', () => {
    renderRow()
    expect(screen.getByText('React Docs')).toBeInTheDocument()
    expect(screen.getByText('react.dev')).toBeInTheDocument()
  })

  it('opens the tab url on click', () => {
    const props = renderRow()
    fireEvent.click(screen.getByRole('button', { name: 'Open React Docs' }))
    expect(props.onOpenTab).toHaveBeenCalledWith('https://www.react.dev/learn')
  })

  it('removes the tab on click', () => {
    const props = renderRow()
    fireEvent.click(screen.getByRole('button', { name: 'Remove React Docs' }))
    expect(props.onRemoveTab).toHaveBeenCalledWith('group-1', 'tab-1')
  })

  it('toggles the inline note editor and saves on blur', () => {
    const props = renderRow()
    expect(screen.queryByPlaceholderText('Add a note for this tab…')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
    const textarea = screen.getByPlaceholderText('Add a note for this tab…')
    fireEvent.change(textarea, { target: { value: 'remember this' } })
    fireEvent.blur(textarea)
    expect(props.onSaveTabNote).toHaveBeenCalledWith('group-1', 'tab-1', 'remember this')
  })

  it('labels the note button "Edit note" when a note already exists', () => {
    renderRow({ tab: { ...tab, note: 'existing' } })
    expect(screen.getByRole('button', { name: 'Edit note' })).toBeInTheDocument()
  })

  it('hides the favicon when showFavicons is false', () => {
    renderRow({ showFavicons: false })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('writes a drag payload on drag start', () => {
    renderRow()
    const setData = vi.fn()
    const row = screen.getByText('React Docs').closest('[draggable]') as HTMLElement
    fireEvent.dragStart(row, {
      dataTransfer: { setData, effectAllowed: '' },
    })
    expect(setData).toHaveBeenCalledTimes(1)
    const [type, raw] = setData.mock.calls[0]!
    expect(type).toBe(DRAG_TYPE)
    expect(JSON.parse(raw as string)).toEqual<DragPayload>({
      tabId: 'tab-1',
      fromGroupId: 'group-1',
    })
  })
})
