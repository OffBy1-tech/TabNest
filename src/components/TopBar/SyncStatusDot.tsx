import React from 'react'

export interface SyncStatusDotProps {
  syncState: 'idle' | 'syncing' | 'error'
  lastSyncAt: number
}

/** A small colored status dot conveying the current Drive sync state. */
export function SyncStatusDot({ syncState, lastSyncAt }: SyncStatusDotProps): React.JSX.Element {
  let color: string
  let label: string

  if (syncState === 'error') {
    color = 'var(--color-danger)'
    label = 'Sync error'
  } else if (syncState === 'syncing') {
    color = 'var(--color-warning)'
    label = 'Syncing…'
  } else if (lastSyncAt > 0) {
    color = 'var(--color-success)'
    const date = new Date(lastSyncAt)
    label = `Last synced at ${date.toLocaleTimeString()}`
  } else {
    color = 'var(--text-muted)'
    label = 'Never synced'
  }

  return (
    <div
      role="status"
      aria-label={label}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-2)',
      }}
    >
      <span
        style={{
          display: 'block',
          width: 8,
          height: 8,
          borderRadius: 'var(--radius-full)',
          backgroundColor: color,
          animation: syncState === 'syncing' ? 'tabnest-pulse 1.2s ease-in-out infinite' : 'none',
        }}
      />
      <style>{`
        @keyframes tabnest-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  )
}
