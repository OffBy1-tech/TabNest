import React, { useEffect, useRef, useState } from 'react'

export interface InlineNameEditorProps {
  value: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

/**
 * A focused text input used to rename a group inline. Commits the trimmed value
 * on Enter or blur, cancels on Escape, and cancels if the trimmed value is empty.
 */
export function InlineNameEditor({
  value: initialValue,
  onConfirm,
  onCancel,
}: InlineNameEditorProps): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function commit(): void {
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
    else onCancel()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      aria-label="Rename group"
      style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        color: 'var(--text-primary)',
        backgroundColor: 'var(--bg-base)',
        border: '1px solid var(--border-focus)',
        borderRadius: 'var(--radius-sm)',
        padding: '2px var(--space-2)',
        outline: 'none',
        minWidth: 0,
        flex: 1,
      }}
    />
  )
}
