import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToggleSwitch } from './ToggleSwitch'

describe('ToggleSwitch', () => {
  it('exposes switch role with aria-checked reflecting the checked prop', () => {
    const { rerender } = render(
      <ToggleSwitch id="t" label="My toggle" checked={false} onChange={vi.fn()} />,
    )
    const sw = screen.getByRole('switch', { name: 'My toggle' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    rerender(<ToggleSwitch id="t" label="My toggle" checked onChange={vi.fn()} />)
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange with the toggled value', () => {
    const onChange = vi.fn()
    render(<ToggleSwitch id="t" label="My toggle" checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('toggles off when currently checked', () => {
    const onChange = vi.fn()
    render(<ToggleSwitch id="t" label="My toggle" checked onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(false)
  })
})
