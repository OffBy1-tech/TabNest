import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SavePopover } from './SavePopover'
import { makeTab, makeWorkspaces } from './testFixtures'

function renderPopover(overrides: Partial<Parameters<typeof SavePopover>[0]> = {}) {
  const props = {
    tab: makeTab({ id: 7, title: 'React', url: 'https://react.dev' }),
    workspaces: makeWorkspaces(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<SavePopover {...props} />)
  return props
}

describe('SavePopover', () => {
  it('renders workspace, category and group selects', () => {
    renderPopover()
    expect(screen.getByLabelText('Workspace')).toBeInTheDocument()
    expect(screen.getByLabelText('Category')).toBeInTheDocument()
    expect(screen.getByLabelText('Group')).toBeInTheDocument()
  })

  it('saves into the selected existing group', () => {
    const props = renderPopover()
    fireEvent.click(screen.getByRole('button', { name: 'Save tab' }))
    expect(props.onSave).toHaveBeenCalledWith(props.tab, 'Articles', 'cat-1', 'ws-1', 'grp-1')
    expect(props.onClose).toHaveBeenCalled()
  })

  it('saves into a new group using the typed name', () => {
    const props = renderPopover()
    fireEvent.change(screen.getByLabelText('Group'), { target: { value: '__new__' } })
    fireEvent.change(screen.getByLabelText('New group name'), { target: { value: 'Frameworks' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save tab' }))
    expect(props.onSave).toHaveBeenCalledWith(props.tab, 'Frameworks', 'cat-1', 'ws-1', null)
  })

  it('shows a duplicate warning when the tab url is already saved', () => {
    const workspaces = makeWorkspaces()
    workspaces[0]!.categories[0]!.groups[0]!.tabs.push({
      id: 't-existing', title: 'React', url: 'https://react.dev', saved_at: 0,
    })
    renderPopover({ workspaces, tab: makeTab({ url: 'https://react.dev' }) })
    expect(screen.getByText('Already saved')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const props = renderPopover()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
  })
})
