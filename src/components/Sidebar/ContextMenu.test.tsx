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

describe('ContextMenu pickers (spec §3.3)', () => {
  it('shows color/emoji/collapse items only when handlers are provided', () => {
    renderMenu()
    expect(screen.queryByRole('menuitem', { name: 'Change color…' })).not.toBeInTheDocument()

    renderMenu({
      onChangeColor: vi.fn(),
      onChangeEmoji: vi.fn(),
      onCollapseAll: vi.fn(),
    })
    expect(screen.getByRole('menuitem', { name: 'Change color…' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Change emoji…' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Collapse all groups' })).toBeInTheDocument()
  })

  it('opens the color palette and fires onChangeColor with the picked color', () => {
    const props = renderMenu({ onChangeColor: vi.fn(), currentColor: '#6366f1' })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Change color…' }))
    const swatch = screen.getByRole('button', { name: 'Color #ef4444' })
    fireEvent.click(swatch)
    expect(props.onChangeColor).toHaveBeenCalledWith('#ef4444')
  })

  it('opens the emoji grid and fires onChangeEmoji with the picked emoji', () => {
    const props = renderMenu({ onChangeEmoji: vi.fn(), currentEmoji: '📁' })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Change emoji…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Emoji 🎮' }))
    expect(props.onChangeEmoji).toHaveBeenCalledWith('🎮')
  })

  it('fires onCollapseAll', () => {
    const props = renderMenu({ onCollapseAll: vi.fn() })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Collapse all groups' }))
    expect(props.onCollapseAll).toHaveBeenCalledOnce()
  })
})
