import React from 'react'
import type { UserSettings } from '../../lib/schema'
import { useTheme } from '../ThemeProvider'
import { SegmentedControl } from './SegmentedControl'
import { ToggleSwitch } from './ToggleSwitch'
import { SettingRow } from './SettingRow'
import { sectionHeadingStyle } from './styles'

export interface GeneralTabProps {
  settings: UserSettings
  onChange: (patch: Partial<UserSettings>) => void
}

export function GeneralTab({ settings, onChange }: GeneralTabProps): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <h3 style={sectionHeadingStyle}>General</h3>

      <SettingRow label="Theme">
        <SegmentedControl
          groupLabel="Theme selection"
          value={theme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
          onChange={(v) => {
            setTheme(v)
            onChange({ theme: v })
          }}
        />
      </SettingRow>


      <SettingRow label="Default view">
        <SegmentedControl
          groupLabel="Default view"
          value={settings.default_view}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' },
          ]}
          onChange={(v) => onChange({ default_view: v })}
        />
      </SettingRow>

      <SettingRow label="Open tab behavior">
        <div role="radiogroup" aria-label="Open tab behavior" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {(
            [
              { value: 'current', label: 'Current tab' },
              { value: 'new_tab', label: 'New tab' },
              { value: 'new_window', label: 'New window' },
            ] as Array<{ value: UserSettings['open_tab_behavior']; label: string }>
          ).map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="open_tab_behavior"
                value={opt.value}
                checked={settings.open_tab_behavior === opt.value}
                onChange={() => onChange({ open_tab_behavior: opt.value })}
                aria-label={opt.label}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </SettingRow>

      <SettingRow label="Save & Close">
        <ToggleSwitch
          id="toggle-save-close"
          label="Save and close tab after saving"
          checked={settings.save_and_close}
          onChange={(v) => onChange({ save_and_close: v })}
        />
      </SettingRow>

      <SettingRow label="Delete group after opening">
        <ToggleSwitch
          id="toggle-delete-on-open"
          label="Move a group to trash after opening all its tabs"
          checked={settings.delete_group_on_open}
          onChange={(v) => onChange({ delete_group_on_open: v })}
        />
      </SettingRow>

      <SettingRow label="Show favicons">
        <ToggleSwitch
          id="toggle-favicons"
          label="Show favicons on tabs"
          checked={settings.show_favicons}
          onChange={(v) => onChange({ show_favicons: v })}
        />
      </SettingRow>

      <SettingRow label="Compact mode" last>
        <ToggleSwitch
          id="toggle-compact"
          label="Enable compact mode"
          checked={settings.compact_mode}
          onChange={(v) => onChange({ compact_mode: v })}
        />
      </SettingRow>
    </div>
  )
}
