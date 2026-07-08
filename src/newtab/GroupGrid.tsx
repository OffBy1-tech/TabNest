import React, { useEffect, useRef, useState } from 'react'
import { GroupCard } from '@/components/GroupCard/GroupCard'
import type { TabGroup } from '@/lib/schema'

export interface GroupGridProps {
  groups: TabGroup[]
  viewMode: 'grid' | 'list'
  onRenameGroup: (id: string, name: string) => void
  onDeleteGroup: (id: string) => void
  onOpenAll: (group: TabGroup) => void
  onOpenAllInBackground?: ((group: TabGroup) => void) | undefined
  onAddTab?: ((groupId: string, url: string) => void) | undefined
  onRemoveTab: (groupId: string, tabId: string) => void
  onMoveTab: (fromGroupId: string, toGroupId: string, tabId: string) => void
  onOpenTab: (url: string) => void
  onSaveGroupNote: (groupId: string, content: string) => void
  onSaveTabNote: (groupId: string, tabId: string, note: string) => void
  showFavicons: boolean
  /** When defined, shows a New Group button. Pass undefined for the "All" view. */
  onCreateGroup?: ((name: string) => void) | undefined
  /** Controlled by App so the N keyboard shortcut can trigger it. */
  creatingGroup?: boolean
  onCreatingGroupChange?: (v: boolean) => void
}

/** The main content area: the grid/list of GroupCards plus inline group creation. */
export function GroupGrid({
  groups,
  viewMode,
  onRenameGroup,
  onDeleteGroup,
  onOpenAll,
  onOpenAllInBackground,
  onAddTab,
  onRemoveTab,
  onMoveTab,
  onOpenTab,
  onSaveGroupNote,
  onSaveTabNote,
  showFavicons,
  onCreateGroup,
  creatingGroup = false,
  onCreatingGroupChange,
}: GroupGridProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [newGroupName, setNewGroupName] = useState('')

  useEffect(() => {
    if (creatingGroup) {
      inputRef.current?.focus()
    } else {
      setNewGroupName('')
    }
  }, [creatingGroup])

  function handleSubmit(): void {
    if (!onCreateGroup) return
    onCreateGroup(newGroupName.trim() || 'New Group')
    onCreatingGroupChange?.(false)
  }

  const canCreate = onCreateGroup !== undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header row: New Group button */}
        {canCreate && !creatingGroup && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => onCreatingGroupChange?.(true)}
              aria-label="Create new empty group"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'border-color var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default)',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-brand-500)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-brand-500)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
              }}
            >
              + New Group
            </button>
          </div>
        )}

        {/* Inline creation form */}
        {creatingGroup && (
          <div
            style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--color-brand-500)',
              backgroundColor: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
                if (e.key === 'Escape') { e.preventDefault(); onCreatingGroupChange?.(false) }
              }}
              style={{
                flex: 1,
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
              aria-label="New group name"
            />
            <button
              type="button"
              onClick={handleSubmit}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-brand-500)',
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
              aria-label="Create group"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => onCreatingGroupChange?.(false)}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
              aria-label="Cancel"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Empty state */}
        {groups.length === 0 && !creatingGroup ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <span style={{ fontSize: 'var(--text-2xl)' }}>🗂️</span>
            <span>{canCreate ? 'No groups yet.' : 'No groups yet. Save some tabs to get started.'}</span>
            {canCreate && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Click <strong>+ New Group</strong> above or press <kbd style={{ padding: '1px 5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-elevated)', fontSize: 'var(--text-xs)' }}>N</kbd> to create one.
              </span>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: viewMode === 'grid' ? 'row' : 'column',
              flexWrap: viewMode === 'grid' ? 'wrap' : 'nowrap',
              gap: 'var(--space-4)',
              alignContent: 'flex-start',
            }}
          >
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                viewMode={viewMode}
                onRename={onRenameGroup}
                onDelete={() => onDeleteGroup(group.id)}
                onOpenAll={() => onOpenAll(group)}
                onOpenAllInBackground={onOpenAllInBackground ? () => onOpenAllInBackground(group) : undefined}
                onAddTab={onAddTab}
                onOpenTab={onOpenTab}
                onRemoveTab={onRemoveTab}
                onMoveTab={onMoveTab}
                onSaveGroupNote={onSaveGroupNote}
                onSaveTabNote={onSaveTabNote}
                showFavicons={showFavicons}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
