import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { GripVertical, MoreHorizontal, X, StickyNote, PenLine } from 'lucide-react'
import type { TabGroup, SavedTab } from '../../lib/schema'
import { FaviconImage } from './FaviconImage'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const DRAG_TYPE = 'application/x-tabnest-tab'

interface DragPayload {
  tabId: string
  fromGroupId: string
}

interface GroupCardProps {
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
// Inline name editor
// ---------------------------------------------------------------------------

interface InlineNameEditorProps {
  value: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

function InlineNameEditor({
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = value.trim()
      if (trimmed) onConfirm(trimmed)
      else onCancel()
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
      onBlur={() => {
        const trimmed = value.trim()
        if (trimmed) onConfirm(trimmed)
        else onCancel()
      }}
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

// ---------------------------------------------------------------------------
// Kebab menu
// ---------------------------------------------------------------------------

interface KebabMenuProps {
  onRename: () => void
  onDelete: () => void
  onOpenAll: () => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

function KebabMenu({
  onRename,
  onDelete,
  onOpenAll,
  onClose,
  anchorRef,
}: KebabMenuProps): React.JSX.Element {
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
      <button
        type="button"
        role="menuitem"
        style={menuItemStyle}
        onClick={onOpenAll}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
        }}
      >
        Open All
      </button>
      <button
        type="button"
        role="menuitem"
        style={menuItemStyle}
        onClick={onRename}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
        }}
      >
        Rename
      </button>
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--border-default)',
          margin: 'var(--space-1) 0',
        }}
      />
      <button
        type="button"
        role="menuitem"
        style={{ ...menuItemStyle, color: 'var(--color-danger)' }}
        onClick={onDelete}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
        }}
      >
        Delete
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NoteEditor — shared textarea with auto-save on blur
// ---------------------------------------------------------------------------

interface NoteEditorProps {
  initialValue: string
  placeholder: string
  onSave: (value: string) => void
}

function NoteEditor({ initialValue, placeholder, onSave }: NoteEditorProps): React.JSX.Element {
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
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-focus)' }}
    />
  )
}

// ---------------------------------------------------------------------------
// TabRow
// ---------------------------------------------------------------------------

interface TabRowProps {
  tab: SavedTab
  groupId: string
  onOpenTab: (url: string) => void
  onRemoveTab: (groupId: string, tabId: string) => void
  onSaveTabNote: (groupId: string, tabId: string, note: string) => void
  showFavicons?: boolean
}

function TabRow({
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
