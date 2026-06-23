import React, { useEffect, useRef, useState } from 'react'
import { Plus, Check, Pencil } from 'lucide-react'
import type { Workspace } from '../../lib/schema'

export interface WorkspaceDropdownProps {
  workspaces: Workspace[]
  activeWorkspaceId: string | undefined
  onSelectWorkspace: (id: string) => void
  onCreateWorkspace: (name: string) => void
  onRenameWorkspace: (id: string, name: string) => void
}

/**
 * The workspace switcher menu: lists workspaces (with inline rename), marks the
 * active one, and offers an inline "New workspace" creator.
 */
export function WorkspaceDropdown({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
}: WorkspaceDropdownProps): React.JSX.Element {
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creatingNew) inputRef.current?.focus()
  }, [creatingNew])

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [renamingId])

  function handleCreate(): void {
    const trimmed = newName.trim()
    if (trimmed) onCreateWorkspace(trimmed)
    setNewName('')
    setCreatingNew(false)
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') { e.preventDefault(); handleCreate() }
    else if (e.key === 'Escape') { e.preventDefault(); setCreatingNew(false); setNewName('') }
  }

  function startRename(ws: Workspace): void {
    setRenamingId(ws.id)
    setRenameValue(ws.name)
  }

  function confirmRename(): void {
    if (renamingId && renameValue.trim()) onRenameWorkspace(renamingId, renameValue.trim())
    setRenamingId(null)
    setRenameValue('')
  }

  function cancelRename(): void {
    setRenamingId(null)
    setRenameValue('')
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') { e.preventDefault(); confirmRename() }
    else if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
  }

  return (
    <div
      role="menu"
      aria-label="Workspaces"
      style={{
        position: 'absolute',
        top: 'calc(100% + var(--space-1))',
        left: 0,
        right: 0,
        zIndex: 200,
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 'var(--space-1)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId
        const isRenaming = renamingId === ws.id

        if (isRenaming) {
          return (
            <div
              key={ws.id}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-1) var(--space-2)' }}
            >
              <span style={{ width: 14, flexShrink: 0 }} />
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={confirmRename}
                aria-label={`Rename workspace ${ws.name}`}
                style={{
                  flex: 1,
                  padding: 'var(--space-1) var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  border: '1px solid var(--border-focus)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontFamily: 'var(--font-sans)',
                }}
              />
            </div>
          )
        }

        return (
          <div
            key={ws.id}
            style={{ display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)', position: 'relative' }}
            onMouseEnter={(e) => {
              const pencil = e.currentTarget.querySelector<HTMLElement>('[data-pencil]')
              if (pencil) pencil.style.opacity = '1'
              if (!isActive) {
                const btn = e.currentTarget.querySelector<HTMLElement>('[data-ws-btn]')
                if (btn) btn.style.backgroundColor = 'var(--bg-elevated)'
              }
            }}
            onMouseLeave={(e) => {
              const pencil = e.currentTarget.querySelector<HTMLElement>('[data-pencil]')
              if (pencil) pencil.style.opacity = '0'
              const btn = e.currentTarget.querySelector<HTMLElement>('[data-ws-btn]')
              if (btn) btn.style.backgroundColor = isActive ? 'var(--color-brand-50)' : 'transparent'
            }}
          >
            <button
              data-ws-btn
              type="button"
              role="menuitem"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelectWorkspace(ws.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                flex: 1,
                padding: 'var(--space-2) var(--space-3)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? 'var(--color-brand-50)' : 'transparent',
                color: isActive ? 'var(--color-brand-600)' : 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
              onFocus={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
                ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
              }}
              onBlur={(e) => { ;(e.currentTarget as HTMLButtonElement).style.outline = 'none' }}
            >
              {isActive ? <Check size={14} aria-hidden="true" /> : <span style={{ width: 14, flexShrink: 0 }} />}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ws.name}
              </span>
            </button>

            <button
              data-pencil
              type="button"
              aria-label={`Rename ${ws.name}`}
              onClick={(e) => { e.stopPropagation(); startRename(ws) }}
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
                color: 'var(--text-muted)',
                cursor: 'pointer',
                opacity: 0,
                transition: 'opacity var(--duration-fast) var(--ease-default)',
                outline: 'none',
              }}
              onFocus={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.opacity = '1'
                ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
                ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
              }}
              onBlur={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.opacity = '0'
                ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
              }}
            >
              <Pencil size={12} aria-hidden="true" />
            </button>
          </div>
        )
      })}

      <div role="separator" style={{ height: 1, backgroundColor: 'var(--border-default)', margin: 'var(--space-1) 0' }} />

      {creatingNew ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-1) var(--space-2)' }}>
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Workspace name"
            aria-label="New workspace name"
            style={{
              flex: 1,
              padding: 'var(--space-1) var(--space-2)',
              fontSize: 'var(--text-sm)',
              border: '1px solid var(--border-focus)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-base)',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <button
            type="button"
            onClick={handleCreate}
            aria-label="Confirm new workspace"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-1)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-brand-500)',
              color: 'var(--text-inverse)',
              cursor: 'pointer',
              outline: 'none',
              flexShrink: 0,
            }}
          >
            <Check size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          role="menuitem"
          onClick={() => setCreatingNew(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            width: '100%',
            padding: 'var(--space-2) var(--space-3)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
          }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
            ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
          }}
          onBlur={(e) => { ;(e.currentTarget as HTMLButtonElement).style.outline = 'none' }}
        >
          <Plus size={14} aria-hidden="true" />
          New workspace
        </button>
      )}
    </div>
  )
}
