import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WindowSection } from './WindowSection'
import { makeTab, makeWorkspaces } from './testFixtures'

function renderSection(overrides: Partial<Parameters<typeof WindowSection>[0]> = {}) {
  const props = {
    tabs: [
      makeTab({ id: 1, title: 'First', url: 'https://first.com' }),
      makeTab({ id: 2, title: 'Second', url: 'https://second.com' }),
    ],
    windowId: 100,
    windowIndex: 0,
    workspaces: makeWorkspaces(),
    onSaveTab: vi.fn(),
    onSaveWindowTabs: vi.fn(),
    onCloseTab: vi.fn(),
    ...overrides,
  }
  render(<WindowSection {...props} />)
  return props
}

describe('WindowSection', () => {
  it('shows the window header with index and tab count, and lists the tabs', () => {
    renderSection()
    expect(screen.getByRole('button', { name: /Window 1, 2 tabs/ })).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('collapses and expands the tab list from the header', () => {
    renderSection()
    expect(screen.getByText('First')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Window 1/ }))
    expect(screen.queryByText('First')).not.toBeInTheDocument()
  })

  it('closes a tab', () => {
    const props = renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Close First' }))
    expect(props.onCloseTab).toHaveBeenCalledWith(1)
  })

  it('opens the per-tab save popover', () => {
    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Save First' }))
    expect(screen.getByRole('button', { name: 'Save tab' })).toBeInTheDocument()
  })

  it('opens the whole-window save popover', () => {
    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Save all tabs in this window to a group' }))
    expect(screen.getByRole('button', { name: 'Save 2 tabs' })).toBeInTheDocument()
  })

  it('marks already-saved tabs with a badge', () => {
    const workspaces = makeWorkspaces()
    workspaces[0]!.categories[0]!.groups[0]!.tabs.push({
      id: 't-existing', title: 'First', url: 'https://first.com', saved_at: 0,
    })
    renderSection({ workspaces })
    expect(screen.getByText('saved')).toBeInTheDocument()
  })
})
