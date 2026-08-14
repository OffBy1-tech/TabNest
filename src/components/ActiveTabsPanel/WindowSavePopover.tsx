import React, { useEffect, useRef, useState } from 'react'
import type { Workspace } from '../../lib/schema'

export interface WindowSavePopoverProps {
  tabCount: number
  workspaces: Workspace[]
  onSave: (groupName: string, categoryId: string, workspaceId: string, groupId: string | null) => void
  onClose: () => void
  defaultWorkspaceId?: string | undefined
  defaultCategoryId?: string | undefined
}

/** Popover to save every tab in a window into a single (new or existing) group. */
export function WindowSavePopover({
  tabCount,
  workspaces,
  onSave,
  onClose,
  defaultWorkspaceId,
  defaultCategoryId,
}: WindowSavePopoverProps): React.JSX.Element {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(
    defaultWorkspaceId ?? workspaces[0]?.id ?? '',
  )
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(defaultCategoryId ?? '')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [newGroupName, setNewGroupName] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

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
    setSelectedGroupId(groups[0]?.id ?? '__new__')
  }, [selectedCategoryId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose()
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
      onSave(newGroupName.trim() || `Window tabs`, selectedCategoryId, selectedWorkspaceId, null)
    } else {
      const name = groups.find((g) => g.id === selectedGroupId)?.name ?? 'Window tabs'
      onSave(name, selectedCategoryId, selectedWorkspaceId, selectedGroupId)
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
      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        Saving <strong style={{ color: 'var(--text-primary)' }}>{tabCount}</strong> tabs into one group
      </p>

      <div>
        <label style={labelStyle}>Workspace</label>
        <select value={selectedWorkspaceId} onChange={(e) => setSelectedWorkspaceId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Category</label>
        <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Group</label>
        <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          <option value="__new__">+ New group...</option>
        </select>
      </div>

      {selectedGroupId === '__new__' && (
        <div>
          <label style={labelStyle}>New group name</label>
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            placeholder="Window tabs"
            style={inputStyle}
            autoFocus
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        style={{
          padding: 'var(--space-2)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-brand-500)',
          color: 'var(--text-inverse)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Save {tabCount} tabs
      </button>
    </div>
  )
}
