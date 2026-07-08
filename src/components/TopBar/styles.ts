import type React from 'react'

/** Shared style for the icon-only buttons in the top bar. */
export const iconButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-2)',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  backgroundColor: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default)',
  outline: 'none',
}
