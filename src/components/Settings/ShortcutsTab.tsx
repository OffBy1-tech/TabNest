import React from 'react'
import { sectionHeadingStyle } from './styles'

const KEYBOARD_SHORTCUTS: Array<{ shortcut: string; action: string }> = [
  { shortcut: '/ or ⌘K', action: 'Open global search' },
  { shortcut: 'N', action: 'New group in active category' },
  { shortcut: 'E', action: 'Edit selected group name' },
  { shortcut: 'Delete', action: 'Move group to Trash' },
  { shortcut: 'Esc', action: 'Close modals / dropdowns' },
]

export function ShortcutsTab(): React.JSX.Element {
  return (
    <div>
      <h3 style={sectionHeadingStyle}>Shortcuts</h3>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
        Keyboard shortcuts are fixed and cannot be remapped in this version.
      </p>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--text-sm)',
        }}
        aria-label="Keyboard shortcuts reference"
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: 'var(--space-2) var(--space-3)',
                borderBottom: '2px solid var(--border-default)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Shortcut
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: 'var(--space-2) var(--space-3)',
                borderBottom: '2px solid var(--border-default)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {KEYBOARD_SHORTCUTS.map((row, i) => (
            <tr
              key={row.shortcut}
              style={{
                backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)',
              }}
            >
              <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-primary)' }}>
                <kbd
                  style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-strong)',
                    backgroundColor: 'var(--bg-elevated)',
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'monospace',
                  }}
                >
                  {row.shortcut}
                </kbd>
              </td>
              <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-secondary)' }}>
                {row.action}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
