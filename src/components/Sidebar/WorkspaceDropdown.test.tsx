import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { Workspace } from '../../lib/schema'
import { WorkspaceDropdown } from './WorkspaceDropdown'

const workspaces: Workspace[] = [
  { id: 'ws-1', name: 'Personal', created_at: 0, categories: [] },
  { id: 'ws-2', name: 'Work', created_at: 0, categories: [] },
]

function renderDropdown(overrides: Partial<Parameters<typeof WorkspaceDropdown>[0]> = {}) {
  const props = {
    workspaces,
    activeWorkspaceId: 'ws-1',
    onSelectWorkspace: vi.fn(),
    onCreateWorkspace: vi.fn(),
    onRenameWorkspace: vi.fn(),
    ...overrides,
  }
  render(<WorkspaceDropdown {...props} />)
  return props
}

describe('WorkspaceDropdown', () => {
  it('lists the workspaces and marks the active one with aria-current', () => {
    renderDropdown()
    expect(screen.getByRole('menuitem', { name: /Personal/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('menuitem', { name: /Work/ })).not.toHaveAttribute('aria-current')
  })

  it('selects a workspace on click', () => {
    const props = renderDropdown()
    fireEvent.click(screen.getByRole('menuitem', { name: /Work/ }))
    expect(props.onSelectWorkspace).toHaveBeenCalledWith('ws-2')
  })

  it('creates a new workspace through the inline creator', () => {
    const props = renderDropdown()
    fireEvent.click(screen.getByRole('menuitem', { name: 'New workspace' }))
    const input = screen.getByLabelText('New workspace name')
    fireEvent.change(input, { target: { value: 'Side Projects' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new workspace' }))
    expect(props.onCreateWorkspace).toHaveBeenCalledWith('Side Projects', undefined)
  })

  it('passes the chosen template workspace to onCreateWorkspace', () => {
    const props = renderDropdown()
    fireEvent.click(screen.getByRole('menuitem', { name: 'New workspace' }))
    fireEvent.change(screen.getByLabelText('New workspace name'), { target: { value: 'Copy' } })
    const select = screen.getByRole('combobox', { name: 'Copy categories from workspace' })
    const firstWsId = (select.querySelectorAll('option')[1] as HTMLOptionElement).value
    fireEvent.change(select, { target: { value: firstWsId } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new workspace' }))
    expect(props.onCreateWorkspace).toHaveBeenCalledWith('Copy', firstWsId)
  })

  it('offers workspace deletion with confirmation when allowed', () => {
    const props = renderDropdown({ onDeleteWorkspace: vi.fn() })
    const deleteBtns = screen.getAllByRole('button', { name: /^Delete / })
    expect(deleteBtns.length).toBeGreaterThan(0)
    fireEvent.click(deleteBtns[0]!)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(props.onDeleteWorkspace).toHaveBeenCalledOnce()
  })

  it('renames a workspace inline', () => {
    const props = renderDropdown()
    fireEvent.click(screen.getByRole('button', { name: 'Rename Work' }))
    const input = screen.getByLabelText('Rename workspace Work')
    fireEvent.change(input, { target: { value: 'Office' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onRenameWorkspace).toHaveBeenCalledWith('ws-2', 'Office')
  })
})
