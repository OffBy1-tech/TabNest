import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toast, type ToastItem } from './Toast'

function makeToast(over: Partial<ToastItem> = {}): ToastItem {
  return { id: 't1', message: 'Something happened', type: 'error', duration: 60_000, ...over }
}

describe('Toast', () => {
  it('renders the message and no action button by default', () => {
    render(<Toast toast={makeToast()} onDismiss={vi.fn()} />)
    expect(screen.getByText('Something happened')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('fires the action and dismisses when the action button is clicked', () => {
    vi.useFakeTimers()
    const onClick = vi.fn()
    const onDismiss = vi.fn()
    render(
      <Toast
        toast={makeToast({ action: { label: 'Retry', onClick } })}
        onDismiss={onDismiss}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onClick).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(400) // slide-out delay before onDismiss fires
    expect(onDismiss).toHaveBeenCalledWith('t1')
    vi.useRealTimers()
  })
})
