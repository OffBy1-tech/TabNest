/**
 * SettingsModal.tsx
 * Full settings modal with left-rail tab navigation.
 * Auto-saves on change (debounced 500 ms).
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import type { TrashItem, UserSettings, LocalSettings, SyncMeta, Workspace } from '../../lib/schema'
import { GeneralTab } from './GeneralTab'
import { NewTabPageTab } from './NewTabPageTab'
import { SyncAndDataTab } from './SyncAndDataTab'
import { ShortcutsTab } from './ShortcutsTab'
import { TrashTab } from './TrashTab'
import { HelpTab } from './HelpTab'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: UserSettings
  onSave: (s: UserSettings) => void
  /** Per-device sync preferences — never written to Drive */
  localSettings: LocalSettings
  onSaveLocalSettings: (patch: Partial<LocalSettings>) => void
  syncMeta: SyncMeta
  /** Workspace list, needed for "Default workspace" dropdown */
  workspaces?: Workspace[]
  /** Trash items for Trash tab */
  trashItems?: TrashItem[]
  onRestoreTrashItem?: (id: string) => void
  onDeleteTrashItem?: (id: string) => void
  onEmptyTrash?: () => void
  onShowOnboarding?: () => void
}

type TabId =
  | 'general'
  | 'newtab'
  | 'sync-data'
  | 'shortcuts'
  | 'trash'
  | 'help'

interface TabDefinition {
  id: TabId
  label: string
}

const TABS: TabDefinition[] = [
  { id: 'general', label: 'General' },
  { id: 'newtab', label: 'New Tab Page' },
  { id: 'sync-data', label: 'Sync & Data' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'trash', label: 'Trash' },
  { id: 'help', label: 'Help' },
]

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusable(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS))
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
  localSettings,
  onSaveLocalSettings,
  syncMeta,
  workspaces = [],
  trashItems = [],
  onRestoreTrashItem,
  onDeleteTrashItem,
  onEmptyTrash,
  onShowOnboarding,
}: SettingsModalProps): React.JSX.Element | null {
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [localSettingsState, setLocalSettingsState] = useState<UserSettings>(settings)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleId = useId()

  // Sync incoming settings prop into local state
  useEffect(() => {
    setLocalSettingsState(settings)
  }, [settings])

  // Debounced save
  const handleChange = useCallback(
    (patch: Partial<UserSettings>) => {
      setLocalSettingsState((prev) => {
        const next = { ...prev, ...patch }
        if (debounceRef.current !== null) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          onSave(next)
        }, 500)
        return next
      })
    },
    [onSave],
  )

  // Focus trap keydown handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = getFocusable(dialogRef.current)
        if (focusable.length === 0) {
          e.preventDefault()
          return
        }
        // Non-null: the length === 0 guard above already returned.
        const first = focusable[0]!
        const last = focusable[focusable.length - 1]!
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    },
    [isOpen, onClose],
  )

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement

      const raf = requestAnimationFrame(() => {
        if (dialogRef.current) {
          getFocusable(dialogRef.current)[0]?.focus()
        }
      })

      document.addEventListener('keydown', handleKeyDown)

      return () => {
        cancelAnimationFrame(raf)
        document.removeEventListener('keydown', handleKeyDown)
        previousFocusRef.current?.focus()
      }
    }
    return undefined
  }, [isOpen, handleKeyDown])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    }
  }, [])

  if (!isOpen) return null

  const renderPanel = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralTab settings={localSettingsState} onChange={handleChange} />
      case 'newtab':
        return <NewTabPageTab settings={localSettingsState} onChange={handleChange} workspaces={workspaces} />
      case 'sync-data':
        return <SyncAndDataTab localSettings={localSettings} onLocalSettingsChange={onSaveLocalSettings} syncMeta={syncMeta} workspaces={workspaces} />
      case 'shortcuts':
        return <ShortcutsTab />
      case 'trash':
        return (
          <TrashTab
            trashItems={trashItems}
            onRestore={onRestoreTrashItem ?? (() => undefined)}
            onDeletePermanently={onDeleteTrashItem ?? (() => undefined)}
            onEmptyTrash={onEmptyTrash ?? (() => undefined)}
            workspaces={workspaces}
          />
        )
      case 'help':
        return <HelpTab onShowOnboarding={onShowOnboarding} />
      default:
        return null
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-overlay)',
        padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: '100%',
          maxWidth: '42rem', // ~672px = max-w-2xl
          height: '80vh',
          maxHeight: '680px',
          backgroundColor: 'var(--bg-base)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.25))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid var(--border-default)',
            flexShrink: 0,
          }}
        >
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 'var(--space-1)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-lg)',
              display: 'flex',
              alignItems: 'center',
              lineHeight: 1,
            }}
          >
            &#x2715;
          </button>
        </div>

        {/* Body: left rail + content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left rail tab list */}
          <nav
            aria-label="Settings sections"
            style={{
              width: 160,
              flexShrink: 0,
              borderRight: '1px solid var(--border-default)',
              padding: 'var(--space-3) var(--space-2)',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <ul
              role="tablist"
              aria-orientation="vertical"
              style={{ listStyle: 'none', padding: 0, margin: 0 }}
              onKeyDown={(e) => {
                const tabIds = TABS.map((t) => t.id)
                const idx = tabIds.indexOf(activeTab)
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  const next = tabIds[(idx + 1) % tabIds.length]!
                  setActiveTab(next)
                  document.getElementById(`settings-tab-${next}`)?.focus()
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  const prev = tabIds[(idx - 1 + tabIds.length) % tabIds.length]!
                  setActiveTab(prev)
                  document.getElementById(`settings-tab-${prev}`)?.focus()
                } else if (e.key === 'Home') {
                  e.preventDefault()
                  setActiveTab(tabIds[0]!)
                  document.getElementById(`settings-tab-${tabIds[0]!}`)?.focus()
                } else if (e.key === 'End') {
                  e.preventDefault()
                  setActiveTab(tabIds[tabIds.length - 1]!)
                  document.getElementById(`settings-tab-${tabIds[tabIds.length - 1]!}`)?.focus()
                }
              }}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <li key={tab.id} role="presentation">
                    <button
                      type="button"
                      role="tab"
                      id={`settings-tab-${tab.id}`}
                      aria-selected={isActive}
                      aria-controls={`settings-panel-${tab.id}`}
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        backgroundColor: isActive ? 'var(--color-brand-100)' : 'transparent',
                        color: isActive ? 'var(--color-brand-600)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 600 : 400,
                        fontSize: 'var(--text-sm)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        marginBottom: 'var(--space-1)',
                        transition: `background-color var(--duration-fast) var(--ease-default)`,
                      }}
                    >
                      {tab.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Panel content */}
          <div
            role="tabpanel"
            id={`settings-panel-${activeTab}`}
            aria-labelledby={`settings-tab-${activeTab}`}
            tabIndex={0}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 'var(--space-6)',
            }}
          >
            {renderPanel()}
          </div>
        </div>
      </div>
    </div>
  )
}
