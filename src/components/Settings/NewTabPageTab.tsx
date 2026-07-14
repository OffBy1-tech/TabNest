import React, { useId } from 'react'
import { BACKGROUND_PRESETS, type UserSettings, type Workspace } from '../../lib/schema'
import { ToggleSwitch } from './ToggleSwitch'
import { SettingRow } from './SettingRow'
import { sectionHeadingStyle, selectStyle } from './styles'

export interface NewTabPageTabProps {
  settings: UserSettings
  onChange: (patch: Partial<UserSettings>) => void
  workspaces: Workspace[]
}

export function NewTabPageTab({
  settings,
  onChange,
  workspaces,
}: NewTabPageTabProps): React.JSX.Element {
  const workspaceSelectId = useId()

  return (
    <div>
      <h3 style={sectionHeadingStyle}>New Tab Page</h3>

      <SettingRow label="Active tabs on load">
        <ToggleSwitch
          id="toggle-active-tabs"
          label="Show active tabs when opening new tab"
          checked={settings.active_tabs_on_load}
          onChange={(v) => onChange({ active_tabs_on_load: v })}
        />
      </SettingRow>

      <SettingRow label="Default workspace" htmlFor={workspaceSelectId}>
        <select
          id={workspaceSelectId}
          value={settings.default_workspace_id ?? ''}
          onChange={(e) =>
            onChange({ default_workspace_id: e.target.value || null })
          }
          aria-label="Default workspace"
          style={selectStyle}
        >
          <option value="">None</option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
      </SettingRow>

      <SettingRow label="Show clock">
        <ToggleSwitch
          id="toggle-clock"
          label="Show clock on new tab page"
          checked={settings.show_clock}
          onChange={(v) => onChange({ show_clock: v })}
        />
      </SettingRow>

      <SettingRow label="Background" last>
        <div
          role="radiogroup"
          aria-label="New tab background"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}
        >
          {BACKGROUND_PRESETS.map((preset) => {
            const active = (settings.background ?? '') === preset.id
            return (
              <button
                key={preset.id || 'default'}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`Background: ${preset.label}`}
                title={preset.label}
                onClick={() => onChange({ background: preset.id })}
                style={{
                  width: 44,
                  height: 28,
                  borderRadius: 'var(--radius-sm)',
                  border: active
                    ? '2px solid var(--color-brand-500)'
                    : '1px solid var(--border-default)',
                  background: preset.css || 'var(--bg-base)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                }}
              >
                {preset.id === '' ? 'Aa' : ''}
              </button>
            )
          })}
        </div>
      </SettingRow>
    </div>
  )
}
