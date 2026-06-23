import React, { useState } from 'react'
import { GripVertical, X, PenLine } from 'lucide-react'
import type { SavedTab } from '../../lib/schema'
import { FaviconImage } from './FaviconImage'
import { NoteEditor } from './NoteEditor'
import { DRAG_TYPE, type DragPayload } from './dragTypes'

export interface TabRowProps {
  tab: SavedTab
  groupId: string
  onOpenTab: (url: string) => void
  onRemoveTab: (groupId: string, tabId: string) => void
  onSaveTabNote: (groupId: string, tabId: string, note: string) => void
  showFavicons?: boolean
}

/**
 * A single saved tab inside a GroupCard. Draggable (drag source for moving tabs
 * between groups), opens its URL on click, and has a collapsible inline note.
 */
export function TabRow({
  tab,
  groupId,
  onOpenTab,
  onRemoveTab,
  onSaveTabNote,
  showFavicons = true,
}: TabRowProps): React.JSX.Element {
  const [noteOpen, setNoteOpen] = useState(false)
  let domain = ''
  try {
    domain = new URL(tab.url).hostname.replace(/^www\./, '')
  } catch {
    domain = ''
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>): void {
    const payload: DragPayload = { tabId: tab.id, fromGroupId: groupId }
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }

  const hasNote = Boolean(tab.note)

  return (
    <div>
      {/* Tab row */}
      <div
        draggable
        onDragStart={handleDragStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-1) var(--space-2)',
          borderRadius: 'var(--radius-sm)',
          transition: 'background-color var(--duration-fast) var(--ease-default)',
          cursor: 'grab',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-elevated)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
        }}
      >
        <span
          aria-hidden="true"
          style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex', cursor: 'grab' }}
        >
          <GripVertical size={12} />
        </span>
        {showFavicons && (
          <FaviconImage url={tab.favicon ?? ''} title={tab.title} size={16} />
        )}
        <button
          type="button"
          aria-label={`Open ${tab.title}`}
          onClick={() => onOpenTab(tab.url)}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            padding: 0,
            outline: 'none',
          }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
            ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
            ;(e.currentTarget as HTMLButtonElement).style.borderRadius = 'var(--radius-sm)'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
          }}
        >
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tab.title}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {domain}
          </div>
        </button>

        {/* Note toggle */}
        <button
          type="button"
          aria-label={noteOpen ? 'Close note' : (hasNote ? 'Edit note' : 'Add note')}
          title={noteOpen ? 'Close note' : (hasNote ? 'Edit note' : 'Add note')}
          onClick={() => setNoteOpen((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            backgroundColor: 'transparent',
            color: hasNote || noteOpen ? 'var(--color-brand-500)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: 'var(--space-1)',
            borderRadius: 'var(--radius-sm)',
            flexShrink: 0,
            outline: 'none',
          }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
            ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
          }}
        >
          <PenLine size={12} aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label={`Remove ${tab.title}`}
          title={`Remove ${tab.title}`}
          onClick={() => onRemoveTab(groupId, tab.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 'var(--space-1)',
            borderRadius: 'var(--radius-sm)',
            flexShrink: 0,
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-danger)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
          }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
            ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
          }}
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>

      {/* Inline note editor */}
      {noteOpen && (
        <div style={{ padding: '0 var(--space-2) var(--space-2) calc(var(--space-2) + 12px + var(--space-2))' }}>
          <NoteEditor
            initialValue={tab.note ?? ''}
            placeholder="Add a note for this tab…"
            onSave={(value) => onSaveTabNote(groupId, tab.id, value)}
          />
        </div>
      )}
    </div>
  )
}
