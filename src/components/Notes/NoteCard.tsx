import React, { useState } from 'react'
import { StickyNote, X } from 'lucide-react'
import type { Note } from '../../lib/schema'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { MarkdownNote } from './MarkdownNote'

export interface NoteCardProps {
  note: Note
  viewMode: 'grid' | 'list'
  onChange: (noteId: string, content: string) => void
  onDelete: (noteId: string) => void
}

/**
 * A standalone note card (spec §7.1) — lives in a category alongside group
 * cards but has no tabs. The body is a Markdown note with interactive
 * checkboxes; deletion asks for confirmation (notes are hard-deleted).
 */
export function NoteCard({ note, viewMode, onChange, onDelete }: NoteCardProps): React.JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isGrid = viewMode === 'grid'

  return (
    <article
      aria-label="Standalone note"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderLeft: '3px solid var(--color-warning, #f59e0b)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: isGrid ? 280 : undefined,
        maxWidth: isGrid ? 360 : undefined,
        width: isGrid ? undefined : '100%',
        padding: 'var(--space-4)',
        gap: 'var(--space-2)',
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 160px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <StickyNote size={14} aria-hidden="true" style={{ color: 'var(--color-warning, #f59e0b)', flexShrink: 0 }} />
        <span
          style={{
            flex: 1,
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Note
        </span>
        <button
          type="button"
          aria-label="Delete note"
          onClick={() => setConfirmDelete(true)}
          style={{
            display: 'inline-flex',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 'var(--space-1)',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-danger)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <MarkdownNote
        content={note.content}
        placeholder="Write a note… (Markdown supported)"
        autoEdit={note.content.trim() === ''}
        onChange={(content) => onChange(note.id, content)}
      />

      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', paddingTop: 'var(--space-1)' }}>
        Created {new Date(note.created_at).toLocaleDateString()}
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete note"
        message="Delete this note? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          onDelete(note.id)
          setConfirmDelete(false)
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  )
}
