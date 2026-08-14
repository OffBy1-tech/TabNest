import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RenameInput } from './RenameInput'

describe('RenameInput', () => {
  it('renders the initial value, focused', () => {
    render(<RenameInput initialValue="Work" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const input = screen.getByLabelText('Rename category') as HTMLInputElement
    expect(input.value).toBe('Work')
    expect(input).toHaveFocus()
  })

  it('confirms the trimmed value on Enter', () => {
    const onConfirm = vi.fn()
    render(<RenameInput initialValue="Work" onConfirm={onConfirm} onCancel={vi.fn()} />)
    const input = screen.getByLabelText('Rename category')
    fireEvent.change(input, { target: { value: '  Research  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('Research')
  })

  it('cancels on Enter with an empty value', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<RenameInput initialValue="Work" onConfirm={onConfirm} onCancel={onCancel} />)
    const input = screen.getByLabelText('Rename category')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
  })

  it('cancels on Escape', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<RenameInput initialValue="Work" onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.keyDown(screen.getByLabelText('Rename category'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('commits on blur', () => {
    const onConfirm = vi.fn()
    render(<RenameInput initialValue="Work" onConfirm={onConfirm} onCancel={vi.fn()} />)
    const input = screen.getByLabelText('Rename category')
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.blur(input)
    expect(onConfirm).toHaveBeenCalledWith('Renamed')
  })
})
