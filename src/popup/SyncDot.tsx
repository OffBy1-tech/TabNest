import React from 'react'

export type SyncState = 'idle' | 'syncing' | 'error'

/** A small colored dot conveying sync state, used in the popup header. */
export function SyncDot({ state }: { state: SyncState }): React.JSX.Element {
  const colorMap: Record<SyncState, string> = {
    idle: 'var(--color-success)',
    syncing: 'var(--color-warning)',
    error: 'var(--color-danger)',
  }
  const labelMap: Record<SyncState, string> = {
    idle: 'Sync up to date',
    syncing: 'Syncing…',
    error: 'Sync error',
  }
  return (
    <span
      title={labelMap[state]}
      aria-label={labelMap[state]}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 'var(--radius-full)',
        backgroundColor: colorMap[state],
        flexShrink: 0,
      }}
    />
  )
}
