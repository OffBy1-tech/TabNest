import React from 'react'

/** Centered "Loading…" message shown before storage data is available. */
export function LoadingPlaceholder(): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: 'var(--text-sm)',
      }}
    >
      Loading…
    </div>
  )
}
