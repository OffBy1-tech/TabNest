import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncStatusDot } from './SyncStatusDot'

describe('SyncStatusDot', () => {
  it('labels the error state', () => {
    render(<SyncStatusDot syncState="error" lastSyncAt={0} />)
    expect(screen.getByRole('status', { name: 'Sync error' })).toBeInTheDocument()
  })

  it('labels the syncing state', () => {
    render(<SyncStatusDot syncState="syncing" lastSyncAt={0} />)
    expect(screen.getByRole('status', { name: 'Syncing…' })).toBeInTheDocument()
  })

  it('labels "Never synced" when idle with no prior sync', () => {
    render(<SyncStatusDot syncState="idle" lastSyncAt={0} />)
    expect(screen.getByRole('status', { name: 'Never synced' })).toBeInTheDocument()
  })

  it('shows the last sync time when idle with a prior sync', () => {
    render(<SyncStatusDot syncState="idle" lastSyncAt={1_700_000_000_000} />)
    expect(screen.getByRole('status', { name: /^Last synced at / })).toBeInTheDocument()
  })
})
