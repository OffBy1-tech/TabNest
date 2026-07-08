import React, {
  useCallback,
  useRef,
  useState,
} from 'react'
import { MoreHorizontal, StickyNote } from 'lucide-react'
import type { TabGroup, SavedTab } from '../../lib/schema'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { InlineNameEditor } from './InlineNameEditor'
import { KebabMenu } from './KebabMenu'
import { NoteEditor } from './NoteEditor'
import { TabRow } from './TabRow'
import { DRAG_TYPE, type DragPayload } from './dragTypes'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroupCardProps {
  group: TabGroup
  viewMode: 'grid' | 'list'
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onOpenAll: () => void
  onOpenTab: (url: string) => void
  onRemoveTab: (groupId: string, tabId: string) => void
  onMoveTab: (fromGroupId: string, toGroupId: string, tabId: string) => void
  onSaveGroupNote: (groupId: string, content: string) => void
  onSaveTabNote: (groupId: string, tabId: string, note: string) => void
  showFavicons?: boolean
}

// ---------------------------------------------------------------------------
// GroupCard
// ---------------------------------------------------------------------------

const MAX_VISIBLE_TABS = 5

export function GroupCard({
  group,
  viewMode,
  onRename,
  onDelete,
  onOpenAll,
  onOpenTab,
  onRemoveTab,
  onMoveTab,
  onSaveGroupNote,
  onSaveTabNote,
  showFavicons = true,
}: GroupCardProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const kebabRef = useRef<HTMLButtonElement>(null)

  const groupNote = group.notes[0]?.content ?? ''
  const hasGroupNote = Boolean(groupNote)

  function handleDragOver(e: React.DragEvent<HTMLElement>): void {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLElement>): void {
    // Only clear when leaving the card itself, not a child
    if (!cardRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  function handleDrop(e: React.DragEvent<HTMLElement>): void {
    e.preventDefault()
    setIsDragOver(false)
    const raw = e.dataTransfer.getData(DRAG_TYPE)
    if (!raw) return
    try {
      const { tabId, fromGroupId } = JSON.parse(raw) as DragPayload
      if (fromGroupId !== group.id) {
        onMoveTab(fromGroupId, group.id, tabId)
      }
    } catch {
      // Malformed payload — ignore
    }
  }

  const visibleTabs: SavedTab[] = expanded
    ? group.tabs
    : group.tabs.slice(0, MAX_VISIBLE_TABS)

  const hiddenCount = Math.max(0, group.tabs.length - MAX_VISIBLE_TABS)

  function handleCardKeyDown(e: React.KeyboardEvent<HTMLElement>): void {
    if (e.target !== cardRef.current) return
    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault()
      setIsEditing(true)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      setConfirmDelete(true)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onOpenAll()
    }
  }

  const handleConfirmDelete = useCallback(() => {
    onDelete(group.id)
    setConfirmDelete(false)
  }, [onDelete, group.id])

  const isGrid = viewMode === 'grid'

  return (
    <article
      ref={cardRef}
      aria-label={`${group.name}, ${group.tabs.length} tabs`}
      tabIndex={0}
      onKeyDown={handleCardKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: isDragOver
          ? '1px solid var(--color-brand-500)'
          : '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: isDragOver
          ? '0 0 0 2px var(--color-brand-200, rgba(99,102,241,0.25))'
          : 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: isGrid ? 280 : undefined,
        width: isGrid ? undefined : '100%',
        padding: 'var(--space-4)',
        gap: 'var(--space-2)',
        outline: 'none',
        transition: 'box-shadow var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default)',
      }}
      onFocus={(e) => {
        if (e.target === cardRef.current) {
          ;(e.currentTarget as HTMLElement).style.outline = `2px solid var(--border-focus)`
          ;(e.currentTarget as HTMLElement).style.outlineOffset = '2px'
        }
      }}
      onBlur={(e) => {
        if (e.target === cardRef.current) {
          ;(e.currentTarget as HTMLElement).style.outline = 'none'
        }
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          position: 'relative',
        }}
      >
        {isEditing ? (
          <InlineNameEditor
            value={group.name}
            onConfirm={(name) => {
              onRename(group.id, name)
              setIsEditing(false)
            }}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <button
            type="button"
            aria-label={`Group name: ${group.name}. Press E to rename.`}
            onClick={() => setIsEditing(true)}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              padding: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
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
            {group.name}
          </button>
        )}

        {/* Tab count badge */}
        <span
          aria-label={`${group.tabs.length} tabs`}
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-full)',
            padding: '1px 6px',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {group.tabs.length}
        </span>

        {/* Open all button */}
        <button
          type="button"
          aria-label="Open all tabs"
          onClick={onOpenAll}
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-brand-500)',
            backgroundColor: 'transparent',
            border: '1px solid var(--color-brand-500)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px var(--space-2)',
            cursor: 'pointer',
            fontWeight: 500,
            flexShrink: 0,
            outline: 'none',
            transition: 'background-color var(--duration-fast) var(--ease-default)',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-brand-100)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
          }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
            ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
          }}
        >
          Open All
        </button>

        {/* Group note toggle */}
        <button
          type="button"
          aria-label={noteOpen ? 'Close note' : (hasGroupNote ? 'Edit group note' : 'Add group note')}
          title={noteOpen ? 'Close note' : (hasGroupNote ? 'Edit note' : 'Add note')}
          onClick={() => setNoteOpen((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            backgroundColor: 'transparent',
            color: hasGroupNote || noteOpen ? 'var(--color-brand-500)' : 'var(--text-muted)',
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
          <StickyNote size={14} aria-hidden="true" />
        </button>

        {/* Kebab menu trigger */}
        <button
          ref={kebabRef}
          type="button"
          aria-label="Group options"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((prev) => !prev)}
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
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
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
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>

        {menuOpen && (
          <KebabMenu
            anchorRef={kebabRef}
            onClose={() => setMenuOpen(false)}
            onRename={() => {
              setMenuOpen(false)
              setIsEditing(true)
            }}
            onDelete={() => {
              setMenuOpen(false)
              setConfirmDelete(true)
            }}
            onOpenAll={() => {
              setMenuOpen(false)
              onOpenAll()
            }}
          />
        )}
      </div>

      {/* Tab list */}
      <div
        role="list"
        aria-label={`Tabs in ${group.name}`}
        style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
      >
        {visibleTabs.map((tab) => (
          <div key={tab.id} role="listitem">
            <TabRow
              tab={tab}
              groupId={group.id}
              onOpenTab={onOpenTab}
              onRemoveTab={onRemoveTab}
              onSaveTabNote={onSaveTabNote}
              showFavicons={showFavicons}
            />
          </div>
        ))}
      </div>

      {/* Expand / collapse */}
      {group.tabs.length > MAX_VISIBLE_TABS && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Show fewer tabs' : `Show ${hiddenCount} more tabs`}
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--color-brand-500)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            textAlign: 'left',
            padding: 'var(--space-1) var(--space-2)',
            fontWeight: 500,
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
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      )}

      {/* Group note panel */}
      {noteOpen && (
        <div style={{ padding: 'var(--space-2) var(--space-3) var(--space-3)' }}>
          <NoteEditor
            initialValue={groupNote}
            placeholder="Add a note for this group…"
            onSave={(value) => onSaveGroupNote(group.id, value)}
          />
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete group"
        message={`Delete "${group.name}"? This will move the group to trash.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  )
}
