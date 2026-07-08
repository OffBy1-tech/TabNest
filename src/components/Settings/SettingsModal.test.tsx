import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { UserSettings, LocalSettings, SyncMeta } from '../../lib/schema'
import { DEFAULT_SETTINGS, DEFAULT_LOCAL_SETTINGS, DEFAULT_SYNC_META } from '../../lib/schema'
import { ThemeProvider } from '../ThemeProvider'
import { SettingsModal } from './SettingsModal'

const settings: UserSettings = { ...DEFAULT_SETTINGS }
const localSettings: LocalSettings = { ...DEFAULT_LOCAL_SETTINGS }
const syncMeta: SyncMeta = DEFAULT_SYNC_META()

function renderModal(props: Partial<Parameters<typeof SettingsModal>[0]> = {}) {
  const onClose = vi.fn()
  const onSave = vi.fn()
  render(
    <ThemeProvider defaultTheme="light">
      <SettingsModal
        isOpen
        onClose={onClose}
        settings={settings}
        onSave={onSave}
        localSettings={localSettings}
        onSaveLocalSettings={vi.fn()}
        syncMeta={syncMeta}
        {...props}
      />
    </ThemeProvider>,
  )
  return { onClose, onSave }
}

describe('SettingsModal', () => {
  it('renders nothing when closed', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <SettingsModal
          isOpen={false}
          onClose={vi.fn()}
          settings={settings}
          onSave={vi.fn()}
          localSettings={localSettings}
          onSaveLocalSettings={vi.fn()}
          syncMeta={syncMeta}
        />
      </ThemeProvider>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a labelled dialog with the full tab list and General active by default', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(6)
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument()
  })

  it('switches the visible panel when another tab is clicked', () => {
    renderModal()
    fireEvent.click(screen.getByRole('tab', { name: 'Trash' }))
    expect(screen.getByRole('tab', { name: 'Trash' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Trash is empty')).toBeInTheDocument()
  })

  it('calls onClose from the close button and on Escape', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  describe('debounced save', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('saves the merged settings 500ms after a change', () => {
      const onClose = vi.fn()
      const onSave = vi.fn()
      render(
        <ThemeProvider defaultTheme="light">
          <SettingsModal
            isOpen
            onClose={onClose}
            settings={settings}
            onSave={onSave}
            localSettings={localSettings}
            onSaveLocalSettings={vi.fn()}
            syncMeta={syncMeta}
          />
        </ThemeProvider>,
      )

      fireEvent.click(screen.getByRole('switch', { name: 'Enable compact mode' }))
      expect(onSave).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ compact_mode: true }))
    })
  })
})
