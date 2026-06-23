import React from 'react'
import type { TrashItem } from '../../lib/schema'
import { sectionHeadingStyle, dangerBtnStyle, ghostBtnStyle } from './styles'

export interface TrashTabProps {
  trashItems: TrashItem[]
  onRestore: (id: string) => void
  onDeletePermanently: (id: string) => void
  onEmptyTrash: () => void
}

export function TrashTab({
  trashItems,
  onRestore,
  onDeletePermanently,
  onEmptyTrash,
}: TrashTabProps): React.JSX.Element {
  const sorted = [...trashItems].sort((a, b) => b.deleted_at - a.deleted_at)

  const typeBadgeColors: Record<TrashItem['type'], string> = {
    group: 'var(--color-info)',
    tab: 'var(--color-success)',
    category: 'var(--color-warning)',
    workspace: 'var(--color-danger)',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
        <h3 style={{ ...sectionHeadingStyle, margin: 0 }}>Trash</h3>
        {trashItems.length > 0 && (
          <button onClick={onEmptyTrash} style={dangerBtnStyle} aria-label="Empty all trash permanently">
            Empty Trash
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12) var(--space-6)',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
          }}
          aria-live="polite"
        >
          Trash is empty
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Trash items">
          {sorted.map((item) => {
            const itemData = item.data as Record<string, unknown>
            const itemName = (itemData['name'] as string | undefined) ?? 'Untitled'
            const deletedDate = new Date(item.deleted_at).toLocaleDateString()

            return (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  marginBottom: 'var(--space-2)',
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                {/* Type badge */}
                <span
                  aria-label={`Type: ${item.type}`}
                  style={{
                    flexShrink: 0,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: typeBadgeColors[item.type],
                    color: 'var(--text-inverse)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {item.type}
                </span>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {itemName}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Deleted {deletedDate}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <button
                    onClick={() => onRestore(item.id)}
                    style={{ ...ghostBtnStyle, padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}
                    aria-label={`Restore ${itemName}`}
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => onDeletePermanently(item.id)}
                    style={{ ...dangerBtnStyle, padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}
                    aria-label={`Delete ${itemName} permanently`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
