import React, { useEffect, useRef, useState } from 'react'

export interface NoteEditorProps {
  initialValue: string
  placeholder: string
  onSave: (value: string) => void
}

/**
 * Auto-focusing textarea that saves its contents on blur. Used for both group
 * notes and per-tab notes. Re-syncs when `initialValue` changes externally
 * (e.g. after a Drive sync).
 */
export function NoteEditor({
  initialValue,
  placeholder,
  onSave,
}: NoteEditorProps): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  // Sync if the stored value changes externally (e.g. Drive sync)
  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSave(value)}
      rows={3}
      style={{
        width: '100%',
        padding: 'var(--space-2) var(--space-3)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-primary)',
        backgroundColor: 'var(--bg-base)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-sm)',
        outline: 'none',
        resize: 'vertical',
        lineHeight: 1.5,
        fontFamily: 'var(--font-sans)',
        boxSizing: 'border-box',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-focus)'
      }}
    />
  )
}
