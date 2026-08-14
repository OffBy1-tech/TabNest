import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingPlaceholder } from './LoadingPlaceholder'

describe('LoadingPlaceholder', () => {
  it('renders the loading message', () => {
    render(<LoadingPlaceholder />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })
})
