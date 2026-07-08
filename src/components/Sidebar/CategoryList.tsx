import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { GripVertical, Plus, ChevronDown, Eye, EyeOff } from 'lucide-react'
import type { Category, Workspace } from '../../lib/schema'
import { ACTIVE_TAB_DRAG_TYPE, type ActiveTabDragPayload } from '../GroupCard/dragTypes'
import { WorkspaceDropdown } from './WorkspaceDropdown'
import { RenameInput } from './RenameInput'
import { ContextMenu } from './ContextMenu'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const CATEGORY_DRAG_TYPE = 'application/x-tabnest-category'

export interface CategoryListProps {
  categories: Category[]
  selectedCategoryId: string | null
  onSelectCategory: (id: string | null) => void
  onCreateCategory: (name: string) => void
  onRenameCategory: (id: string, name: string) => void
  onDeleteCategory: (id: string) => void
  onReorderCategories: (ids: string[]) => void
  onToggleCollapse: (id: string) => void
  workspaces: Workspace[]
  activeWorkspaceId: string | undefined
  onSelectWorkspace: (id: string) => void
  onCreateWorkspace: (name: string) => void
  onRenameWorkspace: (id: string, name: string) => void
  /** A tab dragged from the Active Tabs panel was dropped on a category (spec §5.1). */
  onDropActiveTab?: ((categoryId: string, payload: ActiveTabDragPayload) => void) | undefined
  /** Category context-menu extras (spec §3.3). */
  onChangeCategoryColor?: ((id: string, color: string) => void) | undefined
  onChangeCategoryEmoji?: ((id: string, emoji: string) => void) | undefined
  onCollapseAll?: (() => void) | undefined
}

interface ContextMenuState {
  categoryId: string
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// CategoryList
// ---------------------------------------------------------------------------

export function CategoryList({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategories,
  onToggleCollapse,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDropActiveTab,
  onChangeCategoryColor,
  onChangeCategoryEmoji,
  onCollapseAll,
}: CategoryListProps): React.JSX.Element {
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [creatingNew, setCreatingNew] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)
  const wsDropdownRef = useRef<HTMLDivElement>(null)
  const wsTriggerRef = useRef<HTMLButtonElement>(null)

  const activeWorkspaceName = workspaces.find(w => w.id === activeWorkspaceId)?.name ?? 'My Workspace'

  // Close workspace dropdown on outside click or Escape
  useEffect(() => {
    if (!wsDropdownOpen) return undefined
    function handleOutsideClick(e: MouseEvent): void {
      if (
        wsDropdownRef.current && !wsDropdownRef.current.contains(e.target as Node) &&
        wsTriggerRef.current && !wsTriggerRef.current.contains(e.target as Node)
      ) {
        setWsDropdownOpen(false)
      }
    }
    function handleEsc(e: KeyboardEvent): void {
      if (e.key === 'Escape') setWsDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [wsDropdownOpen])

  function handleDragStart(e: React.DragEvent, categoryId: string): void {
    e.dataTransfer.setData(CATEGORY_DRAG_TYPE, categoryId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedId(categoryId)
  }

  function handleDragOver(e: React.DragEvent, idx: number): void {
    if (!e.dataTransfer.types.includes(CATEGORY_DRAG_TYPE)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDropIndex(e.clientY < rect.top + rect.height / 2 ? idx : idx + 1)
  }

  function handleDrop(e: React.DragEvent): void {
    e.preventDefault()
    const id = e.dataTransfer.getData(CATEGORY_DRAG_TYPE)
    if (!id || dropIndex === null) { clearDrag(); return }
    const fromIdx = categories.findIndex((c) => c.id === id)
    const dragged = categories[fromIdx]
    if (fromIdx === -1 || dragged == null) { clearDrag(); return }
    // Build new order: remove from original position, insert at dropIndex
    const next = categories.filter((c) => c.id !== id)
    const insertAt = dropIndex > fromIdx ? dropIndex - 1 : dropIndex
    next.splice(insertAt, 0, dragged)
    onReorderCategories(next.map((c) => c.id))
    clearDrag()
  }

  function clearDrag(): void {
    setDraggedId(null)
    setDropIndex(null)
  }

  // Show indicator only when it would produce a real position change
  function showIndicatorAt(idx: number): boolean {
    if (draggedId === null || dropIndex !== idx) return false
    const fromIdx = categories.findIndex((c) => c.id === draggedId)
    return idx !== fromIdx && idx !== fromIdx + 1
  }

  // "All" pseudo-item + categories
  const totalItems = 1 + categories.length

  function handleContextMenu(
    e: React.MouseEvent,
    categoryId: string,
  ): void {
    e.preventDefault()
    setContextMenu({ categoryId, x: e.clientX, y: e.clientY })
  }

  function closeContextMenu(): void {
    setContextMenu(null)
  }

  function startRename(categoryId: string): void {
    setContextMenu(null)
    setRenamingId(categoryId)
  }

  function confirmRename(categoryId: string, newName: string): void {
    onRenameCategory(categoryId, newName)
    setRenamingId(null)
  }

  function cancelRename(): void {
    setRenamingId(null)
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number, categoryId: string | null) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex(Math.min(index + 1, totalItems - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex(Math.max(index - 1, 0))
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelectCategory(categoryId)
      } else if (e.key === 'F2' && categoryId !== null) {
        e.preventDefault()
        setRenamingId(categoryId)
      }
    },
    [totalItems, onSelectCategory],
  )

  // Sync focus when focusedIndex changes
  // Guard: do not steal focus from the inline rename input
  useEffect(() => {
    if (focusedIndex < 0 || renamingId !== null) return
    const items = listRef.current?.querySelectorAll<HTMLElement>('[data-category-item]')
    const target = items?.[focusedIndex]
    if (target) {
      target.focus()
    }
  }, [focusedIndex, renamingId])

  function isSelected(id: string | null): boolean {
    return selectedCategoryId === id
  }

  return (
    <>
    {/* Workspace switcher */}
    <div style={{ position: 'relative', marginBottom: 'var(--space-3)' }}>
      <button
        ref={wsTriggerRef}
        type="button"
        onClick={() => setWsDropdownOpen(prev => !prev)}
        aria-label={`Current workspace: ${activeWorkspaceName}. Click to switch workspace.`}
        aria-haspopup="menu"
        aria-expanded={wsDropdownOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          width: '100%',
          padding: 'var(--space-2) var(--space-3)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: wsDropdownOpen ? 'var(--bg-elevated)' : 'var(--bg-base)',
          color: 'var(--text-primary)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'var(--font-sans)',
          outline: 'none',
          transition: 'background-color var(--duration-fast) var(--ease-default)',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = wsDropdownOpen ? 'var(--bg-elevated)' : 'var(--bg-base)'
        }}
        onFocus={(_e) => {
          //;(_e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
          //;(_e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
        }}
        onBlur={(e) => { ;(e.currentTarget as HTMLButtonElement).style.outline = 'none' }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeWorkspaceName}
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            transition: 'transform var(--duration-fast) var(--ease-default)',
            transform: wsDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {wsDropdownOpen && (
        <div ref={wsDropdownRef}>
          <WorkspaceDropdown
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={(id) => { onSelectWorkspace(id); setWsDropdownOpen(false) }}
            onCreateWorkspace={(name) => { onCreateWorkspace(name); setWsDropdownOpen(false) }}
            onRenameWorkspace={onRenameWorkspace}
          />
        </div>
      )}
    </div>

    <nav aria-label="Category list">
      <ul
        ref={listRef}
        aria-label="Category list"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
        }}
      >
        {/* All pseudo-item */}
        <li>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: 'var(--radius-md)',
              borderLeft: isSelected(null)
                ? '2px solid var(--color-brand-500)'
                : '2px solid transparent',
              backgroundColor: isSelected(null) ? 'var(--bg-surface)' : 'transparent',
              transition: 'background-color var(--duration-fast) var(--ease-default)',
            }}
            onMouseEnter={(e) => {
              if (!isSelected(null)) {
                ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-elevated)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected(null)) {
                ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
              }
            }}
          >
            <button
              type="button"
              data-category-item
              aria-selected={isSelected(null)}
              aria-label="All categories"
              tabIndex={focusedIndex === 0 || focusedIndex === -1 ? 0 : -1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                flex: 1,
                border: 'none',
                backgroundColor: 'transparent',
                color: isSelected(null) ? 'var(--color-brand-500)' : 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                cursor: 'pointer',
                userSelect: 'none',
                textAlign: 'left',
                outline: 'none',
              }}
              onClick={() => onSelectCategory(null)}
              onKeyDown={(e) => handleKeyDown(e, 0, null)}
              onFocus={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
                ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '-2px'
              }}
              onBlur={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
              }}
            >
              <span role="img" aria-label="All categories" style={{ fontSize: 'var(--text-base)' }}>
                🗂️
              </span>
              <span style={{ flex: 1 }}>All</span>
              <span
                aria-label={`${categories.reduce((sum, c) => sum + c.groups.reduce((s, g) => s + g.tabs.length, 0), 0)} tabs`}
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-full)',
                  padding: '1px 6px',
                  fontWeight: 600,
                }}
              >
                {categories.reduce((sum, c) => sum + c.groups.reduce((s, g) => s + g.tabs.length, 0), 0)}
              </span>
            </button>
          </div>
        </li>

        {/* Category items */}
        {categories.map((category, idx) => {
          const itemIndex = idx + 1
          const selected = isSelected(category.id)
          const renaming = renamingId === category.id
          const isDragged = draggedId === category.id

          return (
            <React.Fragment key={category.id}>
              {showIndicatorAt(idx) && (
                <li
                  aria-hidden="true"
                  style={{
                    height: 2,
                    backgroundColor: 'var(--color-brand-500)',
                    borderRadius: 1,
                    margin: '1px var(--space-1)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            <li
              draggable
              onDragStart={(e) => handleDragStart(e, category.id)}
              onDragOver={(e) => {
                // Active-panel tab hovering this row — highlight as a save target
                if (onDropActiveTab && e.dataTransfer.types.includes(ACTIVE_TAB_DRAG_TYPE)) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                  setDragOverCategoryId(category.id)
                  return
                }
                handleDragOver(e, idx)
              }}
              onDragLeave={() => {
                setDragOverCategoryId((cur) => (cur === category.id ? null : cur))
              }}
              onDrop={(e) => {
                const activeRaw = e.dataTransfer.getData(ACTIVE_TAB_DRAG_TYPE)
                if (activeRaw && onDropActiveTab) {
                  e.preventDefault()
                  setDragOverCategoryId(null)
                  try {
                    onDropActiveTab(category.id, JSON.parse(activeRaw) as ActiveTabDragPayload)
                  } catch {
                    // Malformed payload — ignore
                  }
                  return
                }
                handleDrop(e)
              }}
              onDragEnd={clearDrag}
              style={{
                opacity: isDragged ? 0.4 : 1,
                ...(dragOverCategoryId === category.id
                  ? { boxShadow: 'inset 0 0 0 2px var(--color-brand-500)', borderRadius: 'var(--radius-md)' }
                  : {}),
              }}
            >
              {/* Row wrapper — owns hover, selection background, and left accent border */}
              <div
                onContextMenu={(e) => handleContextMenu(e, category.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: selected
                    ? '2px solid var(--color-brand-500)'
                    : '2px solid transparent',
                  backgroundColor: selected ? 'var(--bg-surface)' : 'transparent',
                  transition: 'background-color var(--duration-fast) var(--ease-default)',
                }}
                onMouseEnter={(e) => {
                  if (!selected) {
                    ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-elevated)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selected) {
                    ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
                  }
                }}
              >
                {/* Category select button — transparent, flex: 1 */}
                <button
                  type="button"
                  data-category-item
                  aria-selected={selected}
                  aria-label={`${category.name}, ${category.groups.length} groups`}
                  tabIndex={focusedIndex === itemIndex ? 0 : -1}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: selected ? 'var(--color-brand-500)' : 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    cursor: 'pointer',
                    userSelect: 'none',
                    textAlign: 'left',
                    outline: 'none',
                  }}
                  onClick={() => { if (!renaming) onSelectCategory(category.id) }}
                  onDoubleClick={() => { if (!renaming) setRenamingId(category.id) }}
                  title="Double-click to rename"
                  onKeyDown={(e) => {
                    if (e.key === 'F2') {
                      e.preventDefault()
                      setRenamingId(category.id)
                    } else {
                      handleKeyDown(e, itemIndex, category.id)
                    }
                  }}
                  onFocus={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.outline = `none`
                    ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '-2px'
                  }}
                  onBlur={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
                  }}
                >
                  <span
                    role="img"
                    aria-label={category.name}
                    style={{ fontSize: 'var(--text-base)', flexShrink: 0 }}
                  >
                    {category.emoji}
                  </span>

                  {/* Category color dot (spec §3.3) */}
                  {category.color && (
                    <span
                      aria-hidden="true"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: category.color,
                        flexShrink: 0,
                      }}
                    />
                  )}

                  {renaming ? (
                    <RenameInput
                      initialValue={category.name}
                      onConfirm={(name) => confirmRename(category.id, name)}
                      onCancel={cancelRename}
                    />
                  ) : (
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {category.name}
                    </span>
                  )}

                  <span
                    aria-label={`${category.groups.reduce((sum, g) => sum + g.tabs.length, 0)} tabs`}
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
                    {category.groups.reduce((sum, g) => sum + g.tabs.length, 0)}
                  </span>

                  <span aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>
                    <GripVertical size={14} />
                  </span>
                </button>

                {/* Visibility toggle — aligned by wrapper flexbox */}
                <button
                  type="button"
                  aria-label={category.collapsed ? `Show ${category.name} in All view` : `Hide ${category.name} from All view`}
                  title={category.collapsed ? 'Show in All view' : 'Hide from All view'}
                  onClick={(e) => { e.stopPropagation(); onToggleCollapse(category.id) }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    marginRight: 'var(--space-1)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'transparent',
                    color: category.collapsed ? 'var(--color-brand-500)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    outline: 'none',
                    padding: 0,
                  }}
                >
                  {category.collapsed
                    ? <EyeOff size={12} aria-hidden="true" />
                    : <Eye size={12} aria-hidden="true" />}
                </button>
              </div>
            </li>
            </React.Fragment>
          )
        })}

        {/* Indicator after last item */}
        {showIndicatorAt(categories.length) && (
          <li
            aria-hidden="true"
            style={{
              height: 2,
              backgroundColor: 'var(--color-brand-500)',
              borderRadius: 1,
              margin: '1px var(--space-1)',
              pointerEvents: 'none',
            }}
          />
        )}
      </ul>

      {/* New Category inline creation */}
      {creatingNew ? (
        <div style={{ marginTop: 'var(--space-2)', padding: '0 var(--space-1)' }}>
          <RenameInput
            initialValue=""
            onConfirm={(name) => {
              onCreateCategory(name)
              setCreatingNew(false)
            }}
            onCancel={() => setCreatingNew(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreatingNew(true)}
          aria-label="Create new category"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            width: '100%',
            marginTop: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            border: '1px dashed var(--border-default)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            transition: 'color var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default)',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-brand-500)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-brand-500)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'
          }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
            ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
          }}
        >
          <Plus size={14} aria-hidden="true" />
          <span>New Category</span>
        </button>
      )}

      {/* Context menu */}
      {contextMenu !== null && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={() => startRename(contextMenu.categoryId)}
          onDelete={() => {
            onDeleteCategory(contextMenu.categoryId)
            closeContextMenu()
          }}
          onClose={closeContextMenu}
          currentColor={categories.find((c) => c.id === contextMenu.categoryId)?.color}
          currentEmoji={categories.find((c) => c.id === contextMenu.categoryId)?.emoji}
          onChangeColor={
            onChangeCategoryColor
              ? (color) => {
                  onChangeCategoryColor(contextMenu.categoryId, color)
                  closeContextMenu()
                }
              : undefined
          }
          onChangeEmoji={
            onChangeCategoryEmoji
              ? (emoji) => {
                  onChangeCategoryEmoji(contextMenu.categoryId, emoji)
                  closeContextMenu()
                }
              : undefined
          }
          onCollapseAll={
            onCollapseAll
              ? () => {
                  onCollapseAll()
                  closeContextMenu()
                }
              : undefined
          }
        />
      )}
    </nav>
    </>
  )
}
