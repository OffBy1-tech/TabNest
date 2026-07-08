import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('dispatches a tabnest:import-onetab event and clears the textarea on import', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    renderTab()
    const textarea = screen.getByLabelText('OneTab export text') as HTMLTextAreaElement
    const importBtn = screen.getByRole('button', { name: 'Import OneTab data' })

    expect(importBtn).toBeDisabled()
    fireEvent.change(textarea, { target: { value: 'https://example.com | Example' } })
    expect(importBtn).toBeEnabled()
    fireEvent.click(importBtn)

    const evt = dispatchSpy.mock.calls.map(([e]) => e).find((e): e is CustomEvent => e.type === 'tabnest:import-onetab')
    expect(evt).toBeDefined()
    expect((evt as CustomEvent).detail).toBe('https://example.com | Example')
    expect(textarea.value).toBe('')
  })
})
