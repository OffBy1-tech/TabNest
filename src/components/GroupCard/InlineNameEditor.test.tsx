import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineNameEditor } from './InlineNameEditor'

describe('InlineNameEditor', () => {
  it('renders the initial value, focused and selected', () => {
    render(<InlineNameEditor value="Research" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const input = screen.getByLabelText('Rename group') as HTMLInputElement
    expect(input.value).toBe('Research')
    expect(input).toHaveFocus()
  })

  it('confirms the trimmed value on Enter', () => {
    const onConfirm = vi.fn()
    render(<InlineNameEditor value="Research" onConfirm={onConfirm} onCancel={vi.fn()} />)
    const input = screen.getByLabelText('Rename group')
    fireEvent.change(input, { target: { value: '  Renamed  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('Renamed')
  })

  it('cancels (does not confirm) when Enter is pressed with an empty value', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<InlineNameEditor value="Research" onConfirm={onConfirm} onCancel={onCancel} />)
    const input = screen.getByLabelText('Rename group')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
  })

  it('cancels on Escape without confirming', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<InlineNameEditor value="Research" onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.keyDown(screen.getByLabelText('Rename group'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('commits the value on blur', () => {
    const onConfirm = vi.fn()
    render(<InlineNameEditor value="Research" onConfirm={onConfirm} onCancel={vi.fn()} />)
    const input = screen.getByLabelText('Rename group')
    fireEvent.change(input, { target: { value: 'Blurred' } })
    fireEvent.blur(input)
    expect(onConfirm).toHaveBeenCalledWith('Blurred')
  })
})
