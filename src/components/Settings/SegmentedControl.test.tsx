import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SegmentedControl } from './SegmentedControl'

const options = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

describe('SegmentedControl', () => {
  it('renders all options inside a labelled group', () => {
    render(
      <SegmentedControl groupLabel="Theme" value="light" options={options} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('marks only the selected option as pressed', () => {
    render(
      <SegmentedControl groupLabel="Theme" value="dark" options={options} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the clicked option value', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl groupLabel="Theme" value="light" options={options} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'System' }))
    expect(onChange).toHaveBeenCalledWith('system')
  })
})
