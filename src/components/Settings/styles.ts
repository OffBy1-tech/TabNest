import type React from 'react'

// ---------------------------------------------------------------------------
// Shared primitive styles for the settings panels (no hardcoded colors —
// everything resolves through the design-token CSS variables).
// ---------------------------------------------------------------------------

export const sectionHeadingStyle: React.CSSProperties = {
  margin: '0 0 var(--space-5)',
  fontSize: 'var(--text-lg)',
  fontWeight: 600,
  color: 'var(--text-primary)',
}

export const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
  paddingBottom: 'var(--space-4)',
  marginBottom: 'var(--space-4)',
  borderBottom: '1px solid var(--border-default)',
}

export const lastRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
}

export const rowLabelStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  color: 'var(--text-primary)',
}

export const selectStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
}

export const primaryBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  backgroundColor: 'var(--color-brand-500)',
  color: 'var(--text-inverse)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

export const dangerBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  backgroundColor: 'var(--color-danger)',
  color: 'var(--text-inverse)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

export const ghostBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'transparent',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}
