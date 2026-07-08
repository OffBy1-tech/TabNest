import React, { useEffect, useRef } from 'react'

export interface KebabMenuItem {
  label: string
  onClick: () => void
  /** Render in the danger color (e.g. Delete). */
  danger?: boolean
  /** Draw a divider line above this item. */
  dividerBefore?: boolean
}

export interface KebabMenuProps {
  items: KebabMenuItem[]
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

/**
 * Popup menu of group actions. Closes on Escape or on a click outside both
 * the menu and its anchor button. Items are provided by the parent so the
 * same menu shell serves any action set.
 */
export function KebabMenu({ items, onClose, anchorRef }: KebabMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, anchorRef])

  const menuItemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    cursor: 'pointer',
    textAlign: 'left',
    borderRadius: 'var(--radius-sm)',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Group options"
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        zIndex: 50,
        marginTop: 'var(--space-1)',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 'var(--space-1)',
        minWidth: 160,
      }}
    >
      {items.map((item) => (
        <React.Fragment key={item.label}>
          {item.dividerBefore && (
            <hr
              style={{
                border: 'none',
                borderTop: '1px solid var(--border-default)',
                margin: 'var(--space-1) 0',
              }}
            />
          )}
          <button
            type="button"
            role="menuitem"
            style={item.danger ? { ...menuItemStyle, color: 'var(--color-danger)' } : menuItemStyle}
            onClick={item.onClick}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            }}
          >
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  )
}
