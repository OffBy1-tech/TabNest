import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { LocalSettings, SyncMeta } from '../../lib/schema'
import { DEFAULT_SYNC_META } from '../../lib/schema'
import { SyncAndDataTab } from './SyncAndDataTab'

const localSettings: LocalSettings = { sync_enabled: false, sync_interval_minutes: 15 }

function syncMeta(overrides: Partial<SyncMeta> = {}): SyncMeta {
  return { ...DEFAULT_SYNC_META(), ...overrides }
}

function renderTab(props: Partial<Parameters<typeof SyncAndDataTab>[0]> = {}) {
  const onLocalSettingsChange = vi.fn()
  render(
    <SyncAndDataTab
      localSettings={localSettings}
      onLocalSettingsChange={onLocalSettingsChange}
      syncMeta={syncMeta()}
      workspaces={[]}
      {...props}
    />,
  )
  return onLocalSettingsChange
}

describe('SyncAndDataTab', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the disconnected state with a Connect button', () => {
    renderTab()
    expect(screen.getByText('Not connected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect Google Drive' })).toBeInTheDocument()
    // Sync-enabled toggle only appears once connected.
    expect(screen.queryByRole('switch', { name: 'Enable automatic sync' })).not.toBeInTheDocument()
  })

  it('shows the connected state with Disconnect and the sync-enabled toggle', () => {
    renderTab({ syncMeta: syncMeta({ drive_file_id: 'file-123' }) })
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disconnect Google Drive' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enable automatic sync' })).toBeInTheDocument()
  })

  it('disables the sync-interval select while disconnected', () => {
    renderTab()
    expect(screen.getByLabelText('Sync interval')).toBeDisabled()
  })

  it('emits a parsed sync interval on change', () => {
    const onLocalSettingsChange = renderTab({ syncMeta: syncMeta({ drive_file_id: 'file-123' }) })
    fireEvent.change(screen.getByLabelText('Sync interval'), { target: { value: '30' } })
    expect(onLocalSettingsChange).toHaveBeenCalledWith({ sync_interval_minutes: 30 })
  })

  it('emits null for the "Manual only" interval', () => {
    const onLocalSettingsChange = renderTab({ syncMeta: syncMeta({ drive_file_id: 'file-123' }) })
    fireEvent.change(screen.getByLabelText('Sync interval'), { target: { value: 'manual' } })
    expect(onLocalSettingsChange).toHaveBeenCalledWith({ sync_interval_minutes: null })
  })

  it('awaits the OneTab import handler, then clears the textarea and reports the count', async () => {
    const onImportOneTab = vi.fn().mockResolvedValue({ imported: 2, failed: 0 })
    renderTab({ onImportOneTab })
    const textarea = screen.getByLabelText('OneTab export text') as HTMLTextAreaElement
    const importBtn = screen.getByRole('button', { name: 'Import OneTab data' })

    expect(importBtn).toBeDisabled()
    fireEvent.change(textarea, { target: { value: 'https://example.com | Example' } })
    expect(importBtn).toBeEnabled()
    fireEvent.click(importBtn)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Imported 2 groups from OneTab.')
    })
    expect(onImportOneTab).toHaveBeenCalledWith('https://example.com | Example')
    expect(textarea.value).toBe('')
  })

  it('keeps the pasted text and shows an error when the OneTab import fails', async () => {
    const onImportOneTab = vi.fn().mockRejectedValue(new Error('OneTab import failed — nothing was imported.'))
    renderTab({ onImportOneTab })
    const textarea = screen.getByLabelText('OneTab export text') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'https://example.com | Example' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import OneTab data' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('nothing was imported')
    })
    // No false success: the user's paste is preserved for retry
    expect(textarea.value).toBe('https://example.com | Example')
  })
})
