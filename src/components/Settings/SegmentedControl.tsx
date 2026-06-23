import React from 'react'

export interface SegmentedControlProps<T extends string> {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  groupLabel: string
}

/** A horizontal group of mutually-exclusive buttons (e.g. Light / Dark / System). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  groupLabel,
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={groupLabel}
      style={{
        display: 'inline-flex',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        overflow: 'hidden',
      }}
    >
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: 'none',
            borderRight: i < options.length - 1 ? '1px solid var(--border-default)' : 'none',
            backgroundColor: value === opt.value ? 'var(--color-brand-100)' : 'transparent',
            color: value === opt.value ? 'var(--color-brand-600)' : 'var(--text-secondary)',
            fontWeight: value === opt.value ? 600 : 400,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: `background-color var(--duration-fast) var(--ease-default)`,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
