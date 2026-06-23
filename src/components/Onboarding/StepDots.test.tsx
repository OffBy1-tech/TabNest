import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepDots } from './StepDots'

describe('StepDots', () => {
  it('announces the current step out of the total', () => {
    render(<StepDots step={2} />)
    expect(screen.getByLabelText('Step 2 of 3')).toBeInTheDocument()
  })

  it('updates the announced step', () => {
    const { rerender } = render(<StepDots step={1} />)
    expect(screen.getByLabelText('Step 1 of 3')).toBeInTheDocument()
    rerender(<StepDots step={3} />)
    expect(screen.getByLabelText('Step 3 of 3')).toBeInTheDocument()
  })
})
