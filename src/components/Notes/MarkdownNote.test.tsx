import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MarkdownNote } from './MarkdownNote'

describe('MarkdownNote', () => {
  it('renders Markdown formatting in preview mode', () => {
    render(
      <MarkdownNote
        content={'# Heading\nSome **bold** and *italic* and `code`'}
        placeholder="Add a note"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument()
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('italic').tagName).toBe('EM')
    expect(screen.getByText('code').tagName).toBe('CODE')
  })

  it('starts in edit mode when content is empty', () => {
    render(<MarkdownNote content="" placeholder="Add a note" onChange={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: /Edit note/ })).toBeInTheDocument()
  })

  it('switches to edit mode on click and saves on blur', () => {
    const onChange = vi.fn()
    render(<MarkdownNote content="hello" placeholder="Add a note" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit note' }))
    const textarea = screen.getByRole('textbox', { name: /Edit note/ })
    fireEvent.change(textarea, { target: { value: 'hello edited' } })
    fireEvent.blur(textarea)
    expect(onChange).toHaveBeenCalledWith('hello edited')
  })

  it('toggles a checkbox from preview mode without entering edit mode', () => {
    const onChange = vi.fn()
    render(
      <MarkdownNote content={'- [ ] task one\n- [x] task two'} placeholder="Add" onChange={onChange} />,
    )
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes[0]).not.toBeChecked()
    expect(boxes[1]).toBeChecked()

    fireEvent.click(boxes[0]!)
    expect(onChange).toHaveBeenCalledWith('- [x] task one\n- [x] task two')
    // Still in preview mode (no textarea)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('clears checked items via the button, keeping unchecked ones', () => {
    const onChange = vi.fn()
    render(
      <MarkdownNote content={'- [ ] keep\n- [x] done'} placeholder="Add" onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear checked items' }))
    expect(onChange).toHaveBeenCalledWith('- [ ] keep')
  })

  it('hides the clear button when nothing is checked', () => {
    render(<MarkdownNote content={'- [ ] todo'} placeholder="Add" onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Clear checked items' })).not.toBeInTheDocument()
  })
})
