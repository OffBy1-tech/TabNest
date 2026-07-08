import React from 'react'

export interface ToggleSwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
  label: string
}

/** An accessible on/off switch (role="switch") used throughout the settings panels. */
export function ToggleSwitch({ checked, onChange, id, label }: ToggleSwitchProps): React.JSX.Element {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 40,
        height: 22,
        borderRadius: 'var(--radius-full)',
        border: 'none',
        backgroundColor: checked ? 'var(--color-brand-500)' : 'var(--border-strong)',
        cursor: 'pointer',
        transition: `background-color var(--duration-base) var(--ease-default)`,
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--text-inverse)',
          transition: `left var(--duration-base) var(--ease-default)`,
          boxShadow: 'var(--shadow-sm)',
        }}
      />
    </button>
  )
}
