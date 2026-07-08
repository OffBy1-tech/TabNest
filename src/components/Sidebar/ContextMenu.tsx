import React, { useEffect, useRef, useState } from 'react'

/** Preset category colors offered by the picker (spec §3.3). */
export const CATEGORY_COLORS = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#64748b', // slate
] as const

/** Preset category emojis offered by the picker (spec §3.3). */
export const CATEGORY_EMOJIS = [
  '📁', '💼', '🏠', '🎓', '💡', '🛒', '✈️', '🎮',
  '📚', '💰', '🔬', '🎨', '🍽️', '🏋️', '🎵', '🗄️',
] as const

export interface ContextMenuProps {
  x: number
  y: number
  onRename: () => void
  onDelete: () => void
  onClose: () => void
  onChangeColor?: ((color: string) => void) | undefined
  onChangeEmoji?: ((emoji: string) => void) | undefined
  onCollapseAll?: (() => void) | undefined
  currentColor?: string | undefined
  currentEmoji?: string | undefined
}

/**
 * Right-click context menu for a category, positioned at (x, y).
 * Main mode lists actions; "Change color" / "Change emoji" switch to inline
 * swatch/emoji pickers (spec §3.3).
 */
export function ContextMenu({
  x,
  y,
  onRename,
  onDelete,
  onClose,
  onChangeColor,
  onChangeEmoji,
  onCollapseAll,
  currentColor,
  currentEmoji,
}: ContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'main' | 'color' | 'emoji'>('main')

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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
  }, [onClose])

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

  function menuButton(label: string, onClick: () => void, danger = false): React.JSX.Element {
    return (
      <button
        type="button"
        role="menuitem"
        style={danger ? { ...menuItemStyle, color: 'var(--color-danger)' } : menuItemStyle}
        onClick={onClick}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Category options"
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 100,
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 'var(--space-1)',
        minWidth: 140,
      }}
    >
      {mode === 'main' && (
        <>
          {menuButton('Rename', onRename)}
          {onChangeColor && menuButton('Change color…', () => setMode('color'))}
          {onChangeEmoji && menuButton('Change emoji…', () => setMode('emoji'))}
          {onCollapseAll && menuButton('Collapse all groups', onCollapseAll)}
          {menuButton('Delete', onDelete, true)}
        </>
      )}

      {mode === 'color' && (
        <div
          role="group"
          aria-label="Pick a color"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--space-1)',
            padding: 'var(--space-1)',
          }}
        >
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              aria-pressed={color === currentColor}
              onClick={() => onChangeColor?.(color)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 'var(--radius-full)',
                border: color === currentColor
                  ? '2px solid var(--text-primary)'
                  : '2px solid transparent',
                backgroundColor: color,
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {mode === 'emoji' && (
        <div
          role="group"
          aria-label="Pick an emoji"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--space-1)',
            padding: 'var(--space-1)',
          }}
        >
          {CATEGORY_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Emoji ${emoji}`}
              aria-pressed={emoji === currentEmoji}
              onClick={() => onChangeEmoji?.(emoji)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                border: emoji === currentEmoji
                  ? '1px solid var(--color-brand-500)'
                  : '1px solid transparent',
                backgroundColor: 'transparent',
                fontSize: 'var(--text-base)',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
