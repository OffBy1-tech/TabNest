import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DEFAULT_SETTINGS, type UserSettings, type Workspace } from '../../lib/schema'
import { NewTabPageTab } from './NewTabPageTab'

const baseSettings: UserSettings = {
  ...DEFAULT_SETTINGS,
  theme: 'light',
  active_tabs_on_load: true,
}

const workspaces: Workspace[] = [
  { id: 'ws-1', name: 'Personal', created_at: 0, categories: [] },
  { id: 'ws-2', name: 'Work', created_at: 0, categories: [] },
]

function renderTab(settings: Partial<UserSettings> = {}, onChange = vi.fn()) {
  render(
    <NewTabPageTab settings={{ ...baseSettings, ...settings }} onChange={onChange} workspaces={workspaces} />,
  )
  return onChange
}

describe('NewTabPageTab', () => {
  it('lists workspaces in the default-workspace select, plus a "None" option', () => {
    renderTab({ default_workspace_id: 'ws-2' })
    const select = screen.getByLabelText('Default workspace') as HTMLSelectElement
    expect(select.value).toBe('ws-2')
    expect(screen.getByRole('option', { name: 'None' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Personal' })).toBeInTheDocument()
  })

  it('emits null when "None" is selected', () => {
    const onChange = renderTab({ default_workspace_id: 'ws-1' })
    fireEvent.change(screen.getByLabelText('Default workspace'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({ default_workspace_id: null })
  })

  it('emits the chosen workspace id', () => {
    const onChange = renderTab()
    fireEvent.change(screen.getByLabelText('Default workspace'), { target: { value: 'ws-2' } })
    expect(onChange).toHaveBeenCalledWith({ default_workspace_id: 'ws-2' })
  })

  it('toggles show-clock', () => {
    const onChange = renderTab({ show_clock: true })
    fireEvent.click(screen.getByRole('switch', { name: 'Show clock on new tab page' }))
    expect(onChange).toHaveBeenCalledWith({ show_clock: false })
  })
})
