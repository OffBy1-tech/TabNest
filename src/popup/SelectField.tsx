import React from 'react'

export interface SelectFieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  children: React.ReactNode
}

/** A labelled <select> field used in the popup's save form. */
export function SelectField({ id, label, value, onChange, disabled, children }: SelectFieldProps): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <label
        htmlFor={id}
        style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
        style={{
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-sans)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          width: '100%',
        }}
      >
        {children}
      </select>
    </div>
  )
}
