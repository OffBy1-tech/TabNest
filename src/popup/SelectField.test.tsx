import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectField } from './SelectField'

describe('SelectField', () => {
  it('renders a labelled select with its options', () => {
    render(
      <SelectField id="ws" label="Workspace" value="a" onChange={vi.fn()}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </SelectField>,
    )
    const select = screen.getByLabelText('Workspace') as HTMLSelectElement
    expect(select.value).toBe('a')
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument()
  })

  it('emits the new value on change', () => {
    const onChange = vi.fn()
    render(
      <SelectField id="ws" label="Workspace" value="a" onChange={onChange}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </SelectField>,
    )
    fireEvent.change(screen.getByLabelText('Workspace'), { target: { value: 'b' } })
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('disables the select when disabled', () => {
    render(
      <SelectField id="ws" label="Workspace" value="a" onChange={vi.fn()} disabled>
        <option value="a">Alpha</option>
      </SelectField>,
    )
    expect(screen.getByLabelText('Workspace')).toBeDisabled()
  })
})
