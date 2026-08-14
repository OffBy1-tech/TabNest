import React, { useEffect, useRef, useState } from 'react'

export interface RenameInputProps {
  initialValue: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

/**
 * Auto-focused inline text input for renaming (or creating) a category. Commits
 * the trimmed value on Enter or blur, cancels on Escape or when left empty.
 */
export function RenameInput({
  initialValue,
  onConfirm,
  onCancel,
}: RenameInputProps): React.JSX.Element {
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
      aria-label="Rename category"
      style={{
        flex: 1,
        fontSize: 'var(--text-sm)',
        color: 'var(--text-primary)',
        backgroundColor: 'var(--bg-base)',
        border: '1px solid var(--border-focus)',
        borderRadius: 'var(--radius-sm)',
        padding: '1px var(--space-1)',
        outline: 'none',
        minWidth: 0,
      }}
    />
  )
}
