import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncDot } from './SyncDot'

describe('SyncDot', () => {
  it('labels the idle state', () => {
    render(<SyncDot state="idle" />)
    expect(screen.getByLabelText('Sync up to date')).toBeInTheDocument()
  })

  it('labels the syncing state', () => {
    render(<SyncDot state="syncing" />)
    expect(screen.getByLabelText('Syncing…')).toBeInTheDocument()
  })

  it('labels the error state', () => {
    render(<SyncDot state="error" />)
    expect(screen.getByLabelText('Sync error')).toBeInTheDocument()
  })
})
