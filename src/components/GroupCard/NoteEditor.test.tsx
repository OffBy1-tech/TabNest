import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NoteEditor } from './NoteEditor'

describe('NoteEditor', () => {
  it('renders the initial value and placeholder, focused', () => {
    render(<NoteEditor initialValue="hello" placeholder="Add a note…" onSave={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('Add a note…') as HTMLTextAreaElement
    expect(textarea.value).toBe('hello')
    expect(textarea).toHaveFocus()
  })

  it('saves the current value on blur', () => {
    const onSave = vi.fn()
    render(<NoteEditor initialValue="" placeholder="Add a note…" onSave={onSave} />)
    const textarea = screen.getByPlaceholderText('Add a note…')
    fireEvent.change(textarea, { target: { value: 'a new note' } })
    fireEvent.blur(textarea)
    expect(onSave).toHaveBeenCalledWith('a new note')
  })

  it('re-syncs when initialValue changes externally', () => {
    const { rerender } = render(
      <NoteEditor initialValue="first" placeholder="p" onSave={vi.fn()} />,
    )
    const textarea = screen.getByPlaceholderText('p') as HTMLTextAreaElement
    expect(textarea.value).toBe('first')
    rerender(<NoteEditor initialValue="second" placeholder="p" onSave={vi.fn()} />)
    expect(textarea.value).toBe('second')
  })
})
