import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KebabMenu } from './KebabMenu'

function renderMenu(overrides: Partial<Parameters<typeof KebabMenu>[0]> = {}) {
  // A real (detached) anchor element so the outside-click handler — which
  // bails out unless anchorRef.current exists — behaves as it does in the app.
  const anchorRef = { current: document.createElement('button') }
  const props = {
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onOpenAll: vi.fn(),
    onClose: vi.fn(),
    anchorRef,
    ...overrides,
  }
  render(<KebabMenu {...props} />)
  return props
}

describe('KebabMenu', () => {
  it('renders the three actions inside a labelled menu', () => {
    renderMenu()
    expect(screen.getByRole('menu', { name: 'Group options' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Open All' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
  })

  it('fires the matching callback when each item is clicked', () => {
    const props = renderMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open All' }))
    expect(props.onOpenAll).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(props.onRename).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(props.onDelete).toHaveBeenCalledOnce()
  })

  it('closes on Escape', () => {
    const props = renderMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('closes on an outside click', () => {
    const props = renderMenu()
    fireEvent.mouseDown(document.body)
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('does not close when clicking inside the menu', () => {
    const props = renderMenu()
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(props.onClose).not.toHaveBeenCalled()
  })
})
