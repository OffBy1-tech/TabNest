import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KebabMenu, type KebabMenuItem } from './KebabMenu'

function renderMenu(items?: KebabMenuItem[]) {
  // A real (detached) anchor element so the outside-click handler — which
  // bails out unless anchorRef.current exists — behaves as it does in the app.
  const anchorRef = { current: document.createElement('button') }
  const handlers = {
    openAll: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
  }
  const props = {
    items: items ?? [
      { label: 'Open All', onClick: handlers.openAll },
      { label: 'Rename', onClick: handlers.rename },
      { label: 'Delete', onClick: handlers.delete, danger: true, dividerBefore: true },
    ],
    onClose: vi.fn(),
    anchorRef,
  }
  render(<KebabMenu {...props} />)
  return { props, handlers }
}

describe('KebabMenu', () => {
  it('renders the provided actions inside a labelled menu', () => {
    renderMenu()
    expect(screen.getByRole('menu', { name: 'Group options' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Open All' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
  })

  it('fires the matching callback when each item is clicked', () => {
    const { handlers } = renderMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open All' }))
    expect(handlers.openAll).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(handlers.rename).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(handlers.delete).toHaveBeenCalledOnce()
  })

  it('renders arbitrary extra items', () => {
    renderMenu([
      { label: 'Open All in Background', onClick: vi.fn() },
      { label: 'Add tab by URL', onClick: vi.fn() },
    ])
    expect(screen.getByRole('menuitem', { name: 'Open All in Background' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Add tab by URL' })).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const { props } = renderMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('closes on an outside click', () => {
    const { props } = renderMenu()
    fireEvent.mouseDown(document.body)
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('does not close when clicking inside the menu', () => {
    const { props } = renderMenu()
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(props.onClose).not.toHaveBeenCalled()
  })
})
