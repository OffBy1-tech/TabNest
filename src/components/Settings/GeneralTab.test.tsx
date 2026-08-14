import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DEFAULT_SETTINGS, type UserSettings } from '../../lib/schema'
import { ThemeProvider } from '../ThemeProvider'
import { GeneralTab } from './GeneralTab'

const baseSettings: UserSettings = {
  ...DEFAULT_SETTINGS,
  theme: 'light',
  active_tabs_on_load: true,
}

function renderTab(settings: Partial<UserSettings> = {}, onChange = vi.fn()) {
  render(
    <ThemeProvider defaultTheme="light">
      <GeneralTab settings={{ ...baseSettings, ...settings }} onChange={onChange} />
    </ThemeProvider>,
  )
  return onChange
}

describe('GeneralTab', () => {
  it('renders the core settings rows', () => {
    renderTab()
    expect(screen.getByRole('group', { name: 'Theme selection' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Default view' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Open tab behavior' })).toBeInTheDocument()
  })

  it('changes default view via the segmented control', () => {
    const onChange = renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(onChange).toHaveBeenCalledWith({ default_view: 'list' })
  })

  it('reflects and updates the open-tab-behavior radio selection', () => {
    const onChange = renderTab({ open_tab_behavior: 'new_window' })
    expect(screen.getByRole('radio', { name: 'New window' })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: 'Current tab' }))
    expect(onChange).toHaveBeenCalledWith({ open_tab_behavior: 'current' })
  })

  it('toggles a boolean setting', () => {
    const onChange = renderTab({ compact_mode: false })
    fireEvent.click(screen.getByRole('switch', { name: 'Enable compact mode' }))
    expect(onChange).toHaveBeenCalledWith({ compact_mode: true })
  })

  it('updates the theme through the theme control', () => {
    const onChange = renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(onChange).toHaveBeenCalledWith({ theme: 'dark' })
  })
})
