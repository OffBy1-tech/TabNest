import React, {
  useCallback,
  useRef,
  useState,
} from 'react'
import { MoreHorizontal, StickyNote } from 'lucide-react'
import type { TabGroup, SavedTab } from '../../lib/schema'
import { normalizeUrlInput } from '../../lib/tabTitle'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { InlineNameEditor } from './InlineNameEditor'
import { KebabMenu, type KebabMenuItem } from './KebabMenu'
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
  /** Opens the whole group in an unfocused new window (spec §6.3). */
  onOpenAllInBackground?: (() => void) | undefined
  /** Adds a manually entered URL to this group (spec §6.2). */
  onAddTab?: ((groupId: string, url: string) => void) | undefined
  /** Categories available as "Move to category" targets (excluding checks done here). */
  categories?: Array<{ id: string; name: string; emoji: string }> | undefined
  onMoveToCategory?: ((groupId: string, toCategoryId: string) => void) | undefined
  onDuplicate?: ((groupId: string) => void) | undefined
  onArchive?: ((groupId: string) => void) | undefined
  /** Export the group as a shareable text list of URLs (spec §11.5). */
  onExport?: ((group: TabGroup) => void) | undefined
  /** Reorder a tab within this group (spec §6.2). */
  onReorderTab?: ((groupId: string, tabId: string, toIndex: number) => void) | undefined
  /** The category this group currently belongs to (filtered out of move targets). */
  currentCategoryId?: string | undefined
}

// ---------------------------------------------------------------------------
// GroupCard
// ---------------------------------------------------------------------------

const MAX_VISIBLE_TABS = 5

/** Opening more tabs than this at once asks for confirmation first (spec §17). */
export const LARGE_OPEN_THRESHOLD = 20

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
  onOpenAllInBackground,
  onAddTab,
  categories,
  onMoveToCategory,
  onDuplicate,
  onArchive,
  onExport,
  onReorderTab,
  currentCategoryId,
}: GroupCardProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuMode, setMenuMode] = useState<'main' | 'move'>('main')
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  // Holds the open action awaiting large-group confirmation, or null
  const [confirmOpenAction, setConfirmOpenAction] = useState<(() => void) | null>(null)
  const [addingTab, setAddingTab] = useState(false)
  const [addTabUrl, setAddTabUrl] = useState('')
  const [addTabError, setAddTabError] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const kebabRef = useRef<HTMLButtonElement>(null)

  const groupNote = group.notes[0]?.content ?? ''
  const hasGroupNote = Boolean(groupNote)

  /** Run an open action directly, or ask first when the group is large. */
  const requestOpen = useCallback(
    (action: () => void): void => {
      if (group.tabs.length > LARGE_OPEN_THRESHOLD) {
        setConfirmOpenAction(() => action)
      } else {
        action()
      }
    },
    [group.tabs.length],
  )

  function handleAddTabSubmit(): void {
    const normalized = normalizeUrlInput(addTabUrl)
    if (!normalized) {
      setAddTabError(true)
      return
    }
    onAddTab?.(group.id, normalized)
    setAddTabUrl('')
    setAddTabError(false)
    setAddingTab(false)
  }

  const closeMenu = useCallback((): void => {
    setMenuOpen(false)
    setMenuMode('main')
  }, [])

  const moveTargets = (categories ?? []).filter((c) => c.id !== currentCategoryId)

  const mainMenuItems: KebabMenuItem[] = [
    {
      label: 'Open All',
      onClick: () => { closeMenu(); requestOpen(onOpenAll) },
    },
    ...(onOpenAllInBackground
      ? [{ label: 'Open All in Background', onClick: () => { closeMenu(); requestOpen(onOpenAllInBackground) } }]
      : []),
    ...(onAddTab
      ? [{ label: 'Add tab by URL', onClick: () => { closeMenu(); setAddingTab(true) } }]
      : []),
    { label: 'Rename', onClick: () => { closeMenu(); setIsEditing(true) } },
    ...(onMoveToCategory && moveTargets.length > 0
      ? [{ label: 'Move to category…', dividerBefore: true, onClick: () => setMenuMode('move') }]
      : []),
    ...(onDuplicate
      ? [{ label: 'Duplicate', onClick: () => { closeMenu(); onDuplicate(group.id) } }]
      : []),
    ...(onArchive
      ? [{ label: 'Archive', onClick: () => { closeMenu(); onArchive(group.id) } }]
      : []),
    ...(onExport
      ? [{ label: 'Copy as URL list', onClick: () => { closeMenu(); onExport(group) } }]
      : []),
    {
      label: 'Delete',
      danger: true,
      dividerBefore: true,
      onClick: () => { closeMenu(); setConfirmDelete(true) },
    },
  ]

  const moveMenuItems: KebabMenuItem[] = [
    { label: '← Back', onClick: () => setMenuMode('main') },
    ...moveTargets.map((cat) => ({
      label: `${cat.emoji} ${cat.name}`,
      dividerBefore: cat.id === moveTargets[0]?.id,
      onClick: () => {
        closeMenu()
        onMoveToCategory?.(group.id, cat.id)
      },
    })),
  ]

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
      requestOpen(onOpenAll)
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
          onClick={() => requestOpen(onOpenAll)}
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
            onClose={closeMenu}
            items={menuMode === 'move' ? moveMenuItems : mainMenuItems}
          />
        )}
      </div>

      {/* Tab list */}
      <div
        role="list"
        aria-label={`Tabs in ${group.name}`}
        style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
      >
        {visibleTabs.map((tab, idx) => (
          <div
            key={tab.id}
            role="listitem"
            onDragOver={(e) => {
              if (!onReorderTab || !e.dataTransfer.types.includes(DRAG_TYPE)) return
              e.preventDefault()
              e.stopPropagation()
              setDragOverIndex(idx)
            }}
            onDragLeave={() => {
              setDragOverIndex((cur) => (cur === idx ? null : cur))
            }}
            onDrop={(e) => {
              if (!onReorderTab) return
              const raw = e.dataTransfer.getData(DRAG_TYPE)
              if (!raw) return
              e.preventDefault()
              e.stopPropagation()
              setDragOverIndex(null)
              setIsDragOver(false)
              try {
                const { tabId, fromGroupId } = JSON.parse(raw) as DragPayload
                if (fromGroupId === group.id) {
                  if (tabId !== tab.id) onReorderTab(group.id, tabId, idx)
                } else {
                  onMoveTab(fromGroupId, group.id, tabId)
                }
              } catch {
                // Malformed payload — ignore
              }
            }}
            style={
              dragOverIndex === idx
                ? { boxShadow: 'inset 0 2px 0 var(--color-brand-500)' }
                : undefined
            }
          >
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

      {/* Add tab by URL */}
      {addingTab && onAddTab && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <input
            type="text"
            autoFocus
            value={addTabUrl}
            placeholder="Paste or type a URL…"
            aria-label="URL of tab to add"
            aria-invalid={addTabError}
            onChange={(e) => {
              setAddTabUrl(e.target.value)
              setAddTabError(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddTabSubmit() }
              if (e.key === 'Escape') { e.preventDefault(); setAddingTab(false); setAddTabUrl(''); setAddTabError(false) }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              padding: 'var(--space-1) var(--space-2)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-base)',
              border: `1px solid ${addTabError ? 'var(--color-danger)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-sm)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleAddTabSubmit}
            aria-label="Add tab to group"
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-inverse)',
              backgroundColor: 'var(--color-brand-500)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '4px var(--space-2)',
              cursor: 'pointer',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            Add
          </button>
        </div>
      )}
      {addingTab && addTabError && (
        <span role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>
          Enter a valid web address (http/https).
        </span>
      )}

      {/* Note preview (spec §3.4) — first line, click to edit */}
      {hasGroupNote && !noteOpen && (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          aria-label={`Note preview: ${groupNote.split('\n')[0]}`}
          title={groupNote}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            textAlign: 'left',
            padding: 'var(--space-1) 0 0',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            fontStyle: 'italic',
          }}
        >
          <StickyNote size={11} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {groupNote.split('\n')[0]}
          </span>
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

      {/* Creation date (spec §3.4) */}
      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          paddingTop: 'var(--space-1)',
        }}
      >
        Created {new Date(group.created_at).toLocaleDateString()}
      </div>

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

      {/* Large-group open confirmation (spec §17) */}
      <ConfirmDialog
        isOpen={confirmOpenAction !== null}
        title="Open many tabs"
        message={`This will open ${group.tabs.length} tabs at once. Continue?`}
        confirmLabel={`Open ${group.tabs.length} tabs`}
        onConfirm={() => {
          confirmOpenAction?.()
          setConfirmOpenAction(null)
        }}
        onCancel={() => setConfirmOpenAction(null)}
      />
    </article>
  )
}
