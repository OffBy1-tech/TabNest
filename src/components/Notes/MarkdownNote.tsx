import React, { useEffect, useRef, useState } from 'react'
import type { Block, InlineToken } from '../../lib/markdown'
import { parseMarkdown, toggleCheckbox, hasCheckedItems, clearCheckedItems } from '../../lib/markdown'

export interface MarkdownNoteProps {
  content: string
  placeholder: string
  onChange: (content: string) => void
  /** Start in edit mode (used when the note is brand new/empty). */
  autoEdit?: boolean
}

function renderInline(tokens: InlineToken[]): React.ReactNode {
  return tokens.map((t, i) => {
    switch (t.kind) {
      case 'bold':
        return <strong key={i}>{t.text}</strong>
      case 'italic':
        return <em key={i}>{t.text}</em>
      case 'code':
        return (
          <code
            key={i}
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.9em',
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              padding: '0 4px',
            }}
          >
            {t.text}
          </code>
        )
      default:
        return <React.Fragment key={i}>{t.text}</React.Fragment>
    }
  })
}

const headingSizes: Record<1 | 2 | 3, string> = {
  1: 'var(--text-lg)',
  2: 'var(--text-md, 1rem)',
  3: 'var(--text-sm)',
}

/**
 * A Markdown note (spec §7.2/§7.3): shows a rendered preview; clicking the
 * text switches to a plain-textarea editor that auto-saves on blur. Checkboxes
 * toggle directly from the preview without entering edit mode, and a
 * "Clear checked items" action appears when any item is checked.
 */
export function MarkdownNote({
  content,
  placeholder,
  onChange,
  autoEdit = false,
}: MarkdownNoteProps): React.JSX.Element {
  const [editing, setEditing] = useState(autoEdit || content.trim() === '')
  const [draft, setDraft] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Re-sync when the stored value changes externally (e.g. Drive sync)
  useEffect(() => {
    setDraft(content)
  }, [content])

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  function commit(): void {
    onChange(draft)
    if (draft.trim() !== '') setEditing(false)
  }

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        placeholder={placeholder}
        aria-label="Edit note (Markdown supported)"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={Math.max(3, draft.split('\n').length)}
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

  const blocks: Block[] = parseMarkdown(content)

  return (
    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Edit note"
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setEditing(true)
          }
        }}
        style={{ cursor: 'text' }}
      >
        {blocks.map((block, i) => {
          switch (block.kind) {
            case 'heading':
              return (
                <div
                  key={i}
                  role="heading"
                  aria-level={block.level + 3}
                  style={{
                    fontSize: headingSizes[block.level],
                    fontWeight: 700,
                    margin: 'var(--space-1) 0',
                  }}
                >
                  {renderInline(block.inline)}
                </div>
              )
            case 'list-item':
              return (
                <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', paddingLeft: 'var(--space-2)' }}>
                  <span aria-hidden="true">•</span>
                  <span>{renderInline(block.inline)}</span>
                </div>
              )
            case 'checkbox':
              return (
                <label
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    alignItems: 'flex-start',
                    paddingLeft: 'var(--space-2)',
                    cursor: 'pointer',
                  }}
                  // Don't let the wrapper's click-to-edit fire for checkbox taps
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={block.checked}
                    onChange={() => onChange(toggleCheckbox(content, block.checkboxIndex))}
                    style={{ marginTop: 3, cursor: 'pointer' }}
                  />
                  <span
                    style={
                      block.checked
                        ? { textDecoration: 'line-through', color: 'var(--text-muted)' }
                        : undefined
                    }
                  >
                    {renderInline(block.inline)}
                  </span>
                </label>
              )
            case 'blank':
              return <div key={i} style={{ height: 'var(--space-2)' }} />
            default:
              return <p key={i} style={{ margin: '2px 0' }}>{renderInline(block.inline)}</p>
          }
        })}
      </div>

      {hasCheckedItems(content) && (
        <button
          type="button"
          onClick={() => onChange(clearCheckedItems(content))}
          style={{
            marginTop: 'var(--space-2)',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          Clear checked items
        </button>
      )}
    </div>
  )
}
