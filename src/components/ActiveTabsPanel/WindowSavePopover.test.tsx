import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WindowSavePopover } from './WindowSavePopover'
import { makeWorkspaces } from './testFixtures'

function renderPopover(overrides: Partial<Parameters<typeof WindowSavePopover>[0]> = {}) {
  const props = {
    tabCount: 5,
    workspaces: makeWorkspaces(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<WindowSavePopover {...props} />)
  return props
}

describe('WindowSavePopover', () => {
  it('announces the number of tabs being saved', () => {
    renderPopover({ tabCount: 12 })
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save 12 tabs' })).toBeInTheDocument()
  })

  it('saves all tabs into the selected existing group', () => {
    const props = renderPopover()
    fireEvent.click(screen.getByRole('button', { name: 'Save 5 tabs' }))
    expect(props.onSave).toHaveBeenCalledWith('Articles', 'cat-1', 'ws-1', 'grp-1')
  })

  it('saves into a new group, defaulting the name to "Window tabs"', () => {
    const props = renderPopover()
    // Selects are unlabelled-by-association here; order is Workspace, Category, Group.
    const groupSelect = screen.getAllByRole('combobox')[2]!
    fireEvent.change(groupSelect, { target: { value: '__new__' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save 5 tabs' }))
    expect(props.onSave).toHaveBeenCalledWith('Window tabs', 'cat-1', 'ws-1', null)
  })

  it('closes on Escape', () => {
    const props = renderPopover()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
  })
})
