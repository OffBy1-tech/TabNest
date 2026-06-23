import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextMenu } from './ContextMenu'

function renderMenu(overrides: Partial<Parameters<typeof ContextMenu>[0]> = {}) {
  const props = { x: 10, y: 20, onRename: vi.fn(), onDelete: vi.fn(), onClose: vi.fn(), ...overrides }
  render(<ContextMenu {...props} />)
  return props
}

describe('ContextMenu', () => {
  it('renders Rename and Delete items inside a labelled menu', () => {
    renderMenu()
    expect(screen.getByRole('menu', { name: 'Category options' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
  })

  it('fires the matching callbacks', () => {
    const props = renderMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(props.onRename).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(props.onDelete).toHaveBeenCalledOnce()
  })

  it('closes on Escape and on outside click', () => {
    const props = renderMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(document.body)
    expect(props.onClose).toHaveBeenCalledTimes(2)
  })

  it('does not close when clicking inside the menu', () => {
    const props = renderMenu()
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(props.onClose).not.toHaveBeenCalled()
  })
})
