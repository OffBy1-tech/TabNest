import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Workspace } from '../../lib/schema'

export interface SavePopoverProps {
  tab: chrome.tabs.Tab
  workspaces: Workspace[]
  onSave: (tab: chrome.tabs.Tab, groupName: string, categoryId: string, workspaceId: string, groupId: string | null) => void
  onClose: () => void
  defaultWorkspaceId?: string | undefined
  defaultCategoryId?: string | undefined
}

/** Popover to save a single active tab into a (new or existing) group. */
export function SavePopover({
  tab,
  workspaces,
  onSave,
  onClose,
  defaultWorkspaceId,
  defaultCategoryId,
}: SavePopoverProps): React.JSX.Element {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(
    defaultWorkspaceId ?? workspaces[0]?.id ?? '',
  )
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(defaultCategoryId ?? '')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [newGroupName, setNewGroupName] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  const isDuplicate = useMemo(() => {
    if (!tab.url) return false
    return workspaces.some((ws) =>
      ws.categories.some((cat) =>
        cat.groups.some((grp) => grp.tabs.some((t) => t.url === tab.url))
      )
    )
  }, [workspaces, tab.url])

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId)
  const categories = selectedWorkspace?.categories ?? []

  useEffect(() => {
    const ids = categories.map((c) => c.id)
    if (!ids.includes(selectedCategoryId)) {
      setSelectedCategoryId(categories[0]?.id ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceId, categories.length])

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)
  const groups = selectedCategory?.groups ?? []

  useEffect(() => {
    if (groups.length > 0) {
      setSelectedGroupId(groups[0]!.id)
    } else {
      setSelectedGroupId('__new__')
    }
  }, [selectedCategoryId])  // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
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
  }, [onClose])

  function handleSave(): void {
    if (!selectedCategoryId || !selectedWorkspaceId) return

    if (selectedGroupId === '__new__') {
      const groupName = newGroupName.trim() || tab.title || 'Untitled Group'
      onSave(tab, groupName, selectedCategoryId, selectedWorkspaceId, null)
    } else {
      const groupName = groups.find((g) => g.id === selectedGroupId)?.name ?? 'Untitled Group'
      onSave(tab, groupName, selectedCategoryId, selectedWorkspaceId, selectedGroupId)
    }
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    marginBottom: 'var(--space-1)',
    fontWeight: 600,
  }

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        right: 0,
        top: '100%',
        zIndex: 100,
        marginTop: 'var(--space-1)',
        width: 240,
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 'var(--space-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      {isDuplicate && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-warning-50, #fffbeb)',
            border: '1px solid var(--color-warning-200, #fde68a)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-warning-700, #92400e)',
          }}
        >
          <span aria-hidden="true">⚠</span>
          Already saved
        </div>
      )}
      <div>
        <label style={labelStyle} htmlFor={`popover-workspace-${tab.id}`}>
          Workspace
        </label>
        <select
          id={`popover-workspace-${tab.id}`}
          value={selectedWorkspaceId}
          onChange={(e) => setSelectedWorkspaceId(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLSelectElement).style.borderColor = 'var(--border-focus)'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLSelectElement).style.borderColor = 'var(--border-default)'
          }}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle} htmlFor={`popover-category-${tab.id}`}>
          Category
        </label>
        <select
          id={`popover-category-${tab.id}`}
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLSelectElement).style.borderColor = 'var(--border-focus)'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLSelectElement).style.borderColor = 'var(--border-default)'
          }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle} htmlFor={`popover-group-${tab.id}`}>
          Group
        </label>
        <select
          id={`popover-group-${tab.id}`}
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLSelectElement).style.borderColor = 'var(--border-focus)'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLSelectElement).style.borderColor = 'var(--border-default)'
          }}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          <option value="__new__">+ New group...</option>
        </select>
      </div>

      {selectedGroupId === '__new__' && (
        <div>
          <label style={labelStyle} htmlFor={`popover-newgroup-${tab.id}`}>
            New group name
          </label>
          <input
            id={`popover-newgroup-${tab.id}`}
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder={tab.title ?? 'Group name'}
            style={inputStyle}
            onFocus={(e) => {
              ;(e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-focus)'
            }}
            onBlur={(e) => {
              ;(e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-default)'
            }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        aria-label="Save tab"
        style={{
          padding: 'var(--space-2)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-brand-500)',
          color: 'var(--text-inverse)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          cursor: 'pointer',
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
        Save
      </button>
    </div>
  )
}
