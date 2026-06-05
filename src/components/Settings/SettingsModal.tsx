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
import type { TrashItem, UserSettings, LocalSettings, SyncMeta, Workspace, StorageSchema } from '../../lib/schema'
import { StorageSchemaZod } from '../../lib/schema'
import { useTheme } from '../ThemeProvider'

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

const KEYBOARD_SHORTCUTS: Array<{ shortcut: string; action: string }> = [
  { shortcut: '/ or ⌘K', action: 'Open global search' },
  { shortcut: 'N', action: 'New group in active category' },
  { shortcut: 'E', action: 'Edit selected group name' },
  { shortcut: 'Delete', action: 'Move group to Trash' },
  { shortcut: 'Esc', action: 'Close modals / dropdowns' },
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
// Shared primitive styles (no hardcoded colors)
// ---------------------------------------------------------------------------

const sectionHeadingStyle: React.CSSProperties = {
  margin: '0 0 var(--space-5)',
  fontSize: 'var(--text-lg)',
  fontWeight: 600,
  color: 'var(--text-primary)',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
  paddingBottom: 'var(--space-4)',
  marginBottom: 'var(--space-4)',
  borderBottom: '1px solid var(--border-default)',
}

const lastRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
}

const rowLabelStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  color: 'var(--text-primary)',
}

const selectStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  backgroundColor: 'var(--color-brand-500)',
  color: 'var(--text-inverse)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

const dangerBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  backgroundColor: 'var(--color-danger)',
  color: 'var(--text-inverse)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

const ghostBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'transparent',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

// ---------------------------------------------------------------------------
// Toggle switch
// ---------------------------------------------------------------------------

interface ToggleSwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
  label: string
}

function ToggleSwitch({ checked, onChange, id, label }: ToggleSwitchProps): React.JSX.Element {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 40,
        height: 22,
        borderRadius: 'var(--radius-full)',
        border: 'none',
        backgroundColor: checked ? 'var(--color-brand-500)' : 'var(--border-strong)',
        cursor: 'pointer',
        transition: `background-color var(--duration-base) var(--ease-default)`,
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--text-inverse)',
          transition: `left var(--duration-base) var(--ease-default)`,
          boxShadow: 'var(--shadow-sm)',
        }}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// 3-button toggle group
// ---------------------------------------------------------------------------

interface SegmentedControlProps<T extends string> {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  groupLabel: string
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  groupLabel,
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={groupLabel}
      style={{
        display: 'inline-flex',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        overflow: 'hidden',
      }}
    >
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: 'none',
            borderRight: i < options.length - 1 ? '1px solid var(--border-default)' : 'none',
            backgroundColor: value === opt.value ? 'var(--color-brand-100)' : 'transparent',
            color: value === opt.value ? 'var(--color-brand-600)' : 'var(--text-secondary)',
            fontWeight: value === opt.value ? 600 : 400,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: `background-color var(--duration-fast) var(--ease-default)`,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row helper
// ---------------------------------------------------------------------------

function SettingRow({
  label,
  htmlFor,
  last,
  children,
}: {
  label: string
  htmlFor?: string
  last?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div style={last ? lastRowStyle : rowStyle}>
      <label htmlFor={htmlFor} style={rowLabelStyle}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab panels
// ---------------------------------------------------------------------------

function GeneralTab({
  settings,
  onChange,
}: {
  settings: UserSettings
  onChange: (patch: Partial<UserSettings>) => void
}): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <h3 style={sectionHeadingStyle}>General</h3>

      <SettingRow label="Theme">
        <SegmentedControl
          groupLabel="Theme selection"
          value={theme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
          onChange={(v) => {
            setTheme(v)
            onChange({ theme: v })
          }}
        />
      </SettingRow>


      <SettingRow label="Default view">
        <SegmentedControl
          groupLabel="Default view"
          value={settings.default_view}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' },
          ]}
          onChange={(v) => onChange({ default_view: v })}
        />
      </SettingRow>

      <SettingRow label="Open tab behavior">
        <div role="radiogroup" aria-label="Open tab behavior" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {(
            [
              { value: 'current', label: 'Current tab' },
              { value: 'new_tab', label: 'New tab' },
              { value: 'new_window', label: 'New window' },
            ] as Array<{ value: UserSettings['open_tab_behavior']; label: string }>
          ).map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="open_tab_behavior"
                value={opt.value}
                checked={settings.open_tab_behavior === opt.value}
                onChange={() => onChange({ open_tab_behavior: opt.value })}
                aria-label={opt.label}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </SettingRow>

      <SettingRow label="Save & Close">
        <ToggleSwitch
          id="toggle-save-close"
          label="Save and close tab after saving"
          checked={settings.save_and_close}
          onChange={(v) => onChange({ save_and_close: v })}
        />
      </SettingRow>

      <SettingRow label="Show favicons">
        <ToggleSwitch
          id="toggle-favicons"
          label="Show favicons on tabs"
          checked={settings.show_favicons}
          onChange={(v) => onChange({ show_favicons: v })}
        />
      </SettingRow>

      <SettingRow label="Compact mode" last>
        <ToggleSwitch
          id="toggle-compact"
          label="Enable compact mode"
          checked={settings.compact_mode}
          onChange={(v) => onChange({ compact_mode: v })}
        />
      </SettingRow>
    </div>
  )
}

function NewTabPageTab({
  settings,
  onChange,
  workspaces,
}: {
  settings: UserSettings
  onChange: (patch: Partial<UserSettings>) => void
  workspaces: Workspace[]
}): React.JSX.Element {
  const workspaceSelectId = useId()

  return (
    <div>
      <h3 style={sectionHeadingStyle}>New Tab Page</h3>

      <SettingRow label="Active tabs on load">
        <ToggleSwitch
          id="toggle-active-tabs"
          label="Show active tabs when opening new tab"
          checked={settings.active_tabs_on_load}
          onChange={(v) => onChange({ active_tabs_on_load: v })}
        />
      </SettingRow>

      <SettingRow label="Default workspace" htmlFor={workspaceSelectId}>
        <select
          id={workspaceSelectId}
          value={settings.default_workspace_id ?? ''}
          onChange={(e) =>
            onChange({ default_workspace_id: e.target.value || null })
          }
          aria-label="Default workspace"
          style={selectStyle}
        >
          <option value="">None</option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
      </SettingRow>

      <SettingRow label="Show clock" last>
        <ToggleSwitch
          id="toggle-clock"
          label="Show clock on new tab page"
          checked={settings.show_clock}
          onChange={(v) => onChange({ show_clock: v })}
        />
      </SettingRow>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import merge helper
// ---------------------------------------------------------------------------

function mergeImportedData(current: StorageSchema, incoming: StorageSchema): StorageSchema {
  const resultWorkspaces = [...current.workspaces]

  for (const incomingWs of incoming.workspaces) {
    const existingWsIdx = resultWorkspaces.findIndex(
      ws => ws.name.toLowerCase() === incomingWs.name.toLowerCase(),
    )

    if (existingWsIdx >= 0) {
      const existingWs = resultWorkspaces[existingWsIdx]!
      const mergedCats = [...existingWs.categories]

      for (const incomingCat of incomingWs.categories) {
        const existingCatIdx = mergedCats.findIndex(
          cat => cat.name.toLowerCase() === incomingCat.name.toLowerCase(),
        )

        if (existingCatIdx >= 0) {
          const existingCat = mergedCats[existingCatIdx]!
          const nextOrder = existingCat.groups.length
          const freshGroups = incomingCat.groups.map((g, i) => ({
            ...g,
            id: crypto.randomUUID(),
            order: nextOrder + i,
            tabs: g.tabs.map(t => ({ ...t, id: crypto.randomUUID() })),
            notes: g.notes.map(n => ({ ...n, id: crypto.randomUUID() })),
          }))
          mergedCats[existingCatIdx] = {
            ...existingCat,
            groups: [...existingCat.groups, ...freshGroups],
          }
        } else {
          mergedCats.push({
            ...incomingCat,
            id: crypto.randomUUID(),
            order: mergedCats.length,
            groups: incomingCat.groups.map((g, i) => ({
              ...g,
              id: crypto.randomUUID(),
              order: i,
              tabs: g.tabs.map(t => ({ ...t, id: crypto.randomUUID() })),
              notes: g.notes.map(n => ({ ...n, id: crypto.randomUUID() })),
            })),
          })
        }
      }

      resultWorkspaces[existingWsIdx] = { ...existingWs, categories: mergedCats }
    } else {
      resultWorkspaces.push({
        ...incomingWs,
        id: crypto.randomUUID(),
        categories: incomingWs.categories.map((cat, ci) => ({
          ...cat,
          id: crypto.randomUUID(),
          order: ci,
          groups: cat.groups.map((g, i) => ({
            ...g,
            id: crypto.randomUUID(),
            order: i,
            tabs: g.tabs.map(t => ({ ...t, id: crypto.randomUUID() })),
            notes: g.notes.map(n => ({ ...n, id: crypto.randomUUID() })),
          })),
        })),
      })
    }
  }

  return { ...current, workspaces: resultWorkspaces }
}

/** Promisified wrapper around chrome.runtime.sendMessage */
function sendMessage(msg: unknown): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (response: { ok: boolean; error?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message ?? 'Extension error' })
        } else {
          resolve(response ?? { ok: false, error: 'No response from background' })
        }
      })
    } catch {
      resolve({ ok: false, error: 'Not running as an extension' })
    }
  })
}

function SyncAndDataTab({
  localSettings,
  onLocalSettingsChange,
  syncMeta,
  workspaces,
}: {
  localSettings: LocalSettings
  onLocalSettingsChange: (patch: Partial<LocalSettings>) => void
  syncMeta: SyncMeta
  workspaces: Workspace[]
}): React.JSX.Element {
  const isConnected = syncMeta.drive_file_id !== null
  const intervalId = useId()
  const onetabId = useId()
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(syncMeta.sync_state === 'syncing')
  const [pendingImport, setPendingImport] = useState<StorageSchema | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [onetabText, setOnetabText] = useState('')

  const hasExistingData = workspaces.some(ws => ws.categories.some(cat => cat.groups.length > 0))

  useEffect(() => {
    setSyncing(syncMeta.sync_state === 'syncing')
  }, [syncMeta.sync_state])

  const handleConnectDrive = useCallback(async () => {
    setConnecting(true)
    setConnectError(null)
    const res = await sendMessage({ type: 'CONNECT_DRIVE' })
    setConnecting(false)
    if (!res.ok) {
      setConnectError(res.error ?? 'Failed to connect. Please try again.')
    } else if (!(res.data as { connected?: boolean } | undefined)?.connected) {
      setConnectError('Authorization was cancelled or failed. Please try again.')
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    await sendMessage({ type: 'DISCONNECT_DRIVE' })
  }, [])

  const handleSyncNow = useCallback(async () => {
    setSyncing(true)
    await sendMessage({ type: 'TRIGGER_SYNC' })
  }, [])

  const handleExportJSON = async () => {
    try {
      const result = await chrome.storage.local.get('tabnest_data')
      const data = result['tabnest_data']
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'tabnest_data.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Non-extension context
    }
  }

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string)
        const parsed = StorageSchemaZod.parse(raw)
        if (hasExistingData) {
          setPendingImport(parsed)
        } else {
          chrome.storage.local.set({ tabnest_data: parsed })
        }
      } catch {
        setImportError('Import failed — the file is not a valid Tab Nest export.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImportOverwrite = () => {
    if (!pendingImport) return
    chrome.storage.local.set({ tabnest_data: pendingImport })
    setPendingImport(null)
  }

  const handleImportAppend = () => {
    if (!pendingImport) return
    chrome.storage.local.get('tabnest_data', (result) => {
      const current = result['tabnest_data'] as StorageSchema | undefined
      const merged = current ? mergeImportedData(current, pendingImport) : pendingImport
      chrome.storage.local.set({ tabnest_data: merged })
    })
    setPendingImport(null)
  }

  const handleImportCancel = () => setPendingImport(null)

  const handleBookmarksImport = async () => {
    try {
      const granted = await chrome.permissions.request({ permissions: ['bookmarks'] })
      if (granted) {
        const tree = await chrome.bookmarks.getTree()
        window.dispatchEvent(new CustomEvent('tabnest:import-bookmarks', { detail: tree }))
      }
    } catch {
      // Non-extension context or permission denied
    }
  }

  const handleOneTabImport = () => {
    if (!onetabText.trim()) return
    window.dispatchEvent(new CustomEvent('tabnest:import-onetab', { detail: onetabText }))
    setOnetabText('')
  }

  const importedGroupCount = pendingImport?.workspaces.reduce(
    (sum, ws) => sum + ws.categories.reduce((s, cat) => s + cat.groups.length, 0),
    0,
  ) ?? 0

  const lastSyncText =
    syncMeta.last_sync_at === 0
      ? 'Never'
      : new Date(syncMeta.last_sync_at).toLocaleString()

  const subHeadingStyle: React.CSSProperties = {
    margin: '0 0 var(--space-4)',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <div>
      <h3 style={sectionHeadingStyle}>Sync & Data</h3>

      {/* ── Google Drive ── */}
      <h4 style={subHeadingStyle}>Google Drive</h4>

      <div
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-elevated)',
          marginBottom: 'var(--space-5)',
        }}
      >
        {isConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-success)', marginBottom: 'var(--space-1)' }}>
                Connected
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Google Drive</div>
            </div>
            <button onClick={() => { void handleDisconnect() }} style={ghostBtnStyle} aria-label="Disconnect Google Drive">
              Disconnect
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {connecting ? 'Connecting…' : 'Not connected'}
              </span>
              <button
                onClick={() => { void handleConnectDrive() }}
                disabled={connecting}
                style={{ ...primaryBtnStyle, opacity: connecting ? 0.7 : 1, cursor: connecting ? 'wait' : 'pointer', minWidth: 140 }}
                aria-label="Connect Google Drive"
                aria-busy={connecting}
              >
                {connecting ? 'Connecting…' : 'Connect Google Drive'}
              </button>
            </div>
            {connectError !== null && (
              <div
                role="alert"
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-error, #dc2626)',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'color-mix(in srgb, var(--color-error, #dc2626) 10%, transparent)',
                }}
              >
                {connectError}
              </div>
            )}
          </div>
        )}
      </div>

      {isConnected && (
        <SettingRow label="Sync enabled">
          <ToggleSwitch
            id="toggle-sync-enabled"
            label="Enable automatic sync"
            checked={localSettings.sync_enabled}
            onChange={(v) => onLocalSettingsChange({ sync_enabled: v })}
          />
        </SettingRow>
      )}

      <SettingRow label="Sync interval" htmlFor={intervalId}>
        <select
          id={intervalId}
          value={localSettings.sync_interval_minutes ?? 'manual'}
          onChange={(e) => {
            const v = e.target.value
            onLocalSettingsChange({
              sync_interval_minutes: v === 'manual' ? null : (parseInt(v, 10) as 5 | 15 | 30),
            })
          }}
          aria-label="Sync interval"
          style={selectStyle}
          disabled={!isConnected}
        >
          <option value={5}>5 minutes</option>
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value="manual">Manual only</option>
        </select>
      </SettingRow>

      <SettingRow label="Last sync">
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{lastSyncText}</span>
      </SettingRow>

      <SettingRow label="Sync now" last>
        <button
          onClick={() => { void handleSyncNow() }}
          disabled={!isConnected || !localSettings.sync_enabled || syncing}
          style={{
            ...primaryBtnStyle,
            opacity: !isConnected || !localSettings.sync_enabled || syncing ? 0.5 : 1,
            cursor: !isConnected || !localSettings.sync_enabled || syncing ? 'not-allowed' : 'pointer',
          }}
          aria-label="Sync now"
          aria-disabled={!isConnected || !localSettings.sync_enabled || syncing}
          aria-busy={syncing}
        >
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </SettingRow>

      {/* ── Divider ── */}
      <div style={{ borderTop: '1px solid var(--border-default)', margin: 'var(--space-6) 0' }} />

      {/* ── Data ── */}
      <h4 style={subHeadingStyle}>Data</h4>

      {/* Export */}
      <section aria-labelledby="export-heading" style={{ marginBottom: 'var(--space-6)' }}>
        <h5 id="export-heading" style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Export
        </h5>
        <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Download all your workspaces, groups, and tabs as a JSON backup.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button onClick={() => void handleExportJSON()} style={ghostBtnStyle} aria-label="Export all data as JSON">
            Export JSON
          </button>
        </div>
        <p style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Per-group URL export is available from the group context menu.
        </p>
      </section>

      {/* Import — Tab Nest JSON */}
      <section aria-labelledby="import-json-heading" style={{ marginBottom: 'var(--space-6)' }}>
        <h5 id="import-json-heading" style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Import Tab Nest JSON
        </h5>
        <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Restore from a previously exported Tab Nest backup file.
        </p>

        {pendingImport !== null ? (
          <div
            role="alertdialog"
            aria-labelledby="import-confirm-title"
            aria-describedby="import-confirm-desc"
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-warning, #d97706)',
              backgroundColor: 'color-mix(in srgb, var(--color-warning, #d97706) 8%, transparent)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div>
              <div id="import-confirm-title" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                Replace existing data?
              </div>
              <div id="import-confirm-desc" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                You already have saved tabs. The import file contains{' '}
                <strong>{pendingImport.workspaces.length} workspace{pendingImport.workspaces.length !== 1 ? 's' : ''}</strong>{' '}
                and <strong>{importedGroupCount} group{importedGroupCount !== 1 ? 's' : ''}</strong>.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button onClick={handleImportOverwrite} style={{ ...dangerBtnStyle, fontSize: 'var(--text-xs)', padding: 'var(--space-2) var(--space-3)' }} aria-label="Overwrite all existing data with imported data">
                Overwrite All
              </button>
              <button onClick={handleImportAppend} style={{ ...primaryBtnStyle, fontSize: 'var(--text-xs)', padding: 'var(--space-2) var(--space-3)' }} aria-label="Append imported data into matching categories">
                Append
              </button>
              <button onClick={handleImportCancel} style={{ ...ghostBtnStyle, fontSize: 'var(--text-xs)', padding: 'var(--space-2) var(--space-3)' }} aria-label="Cancel import">
                Cancel
              </button>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <strong>Append</strong> merges groups into existing categories with the same name, or creates new ones.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-1)' }}>
            <label
              aria-label="Import JSON file"
              style={{ ...ghostBtnStyle, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
            >
              Import JSON
              <input type="file" accept=".json,application/json" onChange={handleImportJSON} style={{ display: 'none' }} aria-label="Select JSON file to import" />
            </label>
            {importError !== null && (
              <div role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error, #dc2626)' }}>
                {importError}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Import — Bookmarks */}
      <section aria-labelledby="bookmarks-heading" style={{ marginBottom: 'var(--space-6)' }}>
        <h5 id="bookmarks-heading" style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Import from Bookmarks
        </h5>
        <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Requires the bookmarks permission (asked on click).
        </p>
        <button onClick={() => void handleBookmarksImport()} style={primaryBtnStyle} aria-label="Import from browser bookmarks">
          Import Bookmarks
        </button>
      </section>

      {/* Import — OneTab */}
      <section aria-labelledby="onetab-heading">
        <h5 id="onetab-heading" style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Import OneTab Format
        </h5>
        <label htmlFor={onetabId} style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          Paste your OneTab export below, one URL per line.
        </label>
        <textarea
          id={onetabId}
          value={onetabText}
          onChange={(e) => setOnetabText(e.target.value)}
          rows={4}
          aria-label="OneTab export text"
          placeholder="https://example.com | Page Title&#10;https://another.com | Another Page"
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-sans)',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleOneTabImport}
          disabled={!onetabText.trim()}
          style={{
            ...primaryBtnStyle,
            marginTop: 'var(--space-2)',
            opacity: !onetabText.trim() ? 0.5 : 1,
            cursor: !onetabText.trim() ? 'not-allowed' : 'pointer',
          }}
          aria-label="Import OneTab data"
          aria-disabled={!onetabText.trim()}
        >
          Import
        </button>
      </section>
    </div>
  )
}

function ShortcutsTab(): React.JSX.Element {
  return (
    <div>
      <h3 style={sectionHeadingStyle}>Shortcuts</h3>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
        Keyboard shortcuts are fixed and cannot be remapped in this version.
      </p>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--text-sm)',
        }}
        aria-label="Keyboard shortcuts reference"
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: 'var(--space-2) var(--space-3)',
                borderBottom: '2px solid var(--border-default)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Shortcut
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: 'var(--space-2) var(--space-3)',
                borderBottom: '2px solid var(--border-default)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {KEYBOARD_SHORTCUTS.map((row, i) => (
            <tr
              key={row.shortcut}
              style={{
                backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)',
              }}
            >
              <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-primary)' }}>
                <kbd
                  style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-strong)',
                    backgroundColor: 'var(--bg-elevated)',
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'monospace',
                  }}
                >
                  {row.shortcut}
                </kbd>
              </td>
              <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-secondary)' }}>
                {row.action}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TrashTab({
  trashItems,
  onRestore,
  onDeletePermanently,
  onEmptyTrash,
}: {
  trashItems: TrashItem[]
  onRestore: (id: string) => void
  onDeletePermanently: (id: string) => void
  onEmptyTrash: () => void
}): React.JSX.Element {
  const sorted = [...trashItems].sort((a, b) => b.deleted_at - a.deleted_at)

  const typeBadgeColors: Record<TrashItem['type'], string> = {
    group: 'var(--color-info)',
    tab: 'var(--color-success)',
    category: 'var(--color-warning)',
    workspace: 'var(--color-danger)',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
        <h3 style={{ ...sectionHeadingStyle, margin: 0 }}>Trash</h3>
        {trashItems.length > 0 && (
          <button onClick={onEmptyTrash} style={dangerBtnStyle} aria-label="Empty all trash permanently">
            Empty Trash
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12) var(--space-6)',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
          }}
          aria-live="polite"
        >
          Trash is empty
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Trash items">
          {sorted.map((item) => {
            const itemData = item.data as Record<string, unknown>
            const itemName = (itemData['name'] as string | undefined) ?? 'Untitled'
            const deletedDate = new Date(item.deleted_at).toLocaleDateString()

            return (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  marginBottom: 'var(--space-2)',
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                {/* Type badge */}
                <span
                  aria-label={`Type: ${item.type}`}
                  style={{
                    flexShrink: 0,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: typeBadgeColors[item.type],
                    color: 'var(--text-inverse)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {item.type}
                </span>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {itemName}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Deleted {deletedDate}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <button
                    onClick={() => onRestore(item.id)}
                    style={{ ...ghostBtnStyle, padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}
                    aria-label={`Restore ${itemName}`}
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => onDeletePermanently(item.id)}
                    style={{ ...dangerBtnStyle, padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}
                    aria-label={`Delete ${itemName} permanently`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function HelpTab({ onShowOnboarding }: { onShowOnboarding?: () => void }): React.JSX.Element {
  return (
    <div>
      <h3 style={sectionHeadingStyle}>Help</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <button
            onClick={onShowOnboarding}
            style={primaryBtnStyle}
            aria-label="Show onboarding walkthrough again"
          >
            Show Onboarding Again
          </button>
        </div>

        <div>
          <a
            href="https://github.com/OffBy1-tech/TabNest"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-brand-500)',
              textDecoration: 'underline',
            }}
            aria-label="Open Tab Nest GitHub repository (opens in new tab)"
          >
            GitHub Repository
          </a>
        </div>

        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
          }}
        >
          Version: v1.0.0
        </div>
      </div>
    </div>
  )
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
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
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
          />
        )
      case 'help':
        return <HelpTab onShowOnboarding={onShowOnboarding} />
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
                  const next = tabIds[(idx + 1) % tabIds.length]
                  setActiveTab(next)
                  document.getElementById(`settings-tab-${next}`)?.focus()
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  const prev = tabIds[(idx - 1 + tabIds.length) % tabIds.length]
                  setActiveTab(prev)
                  document.getElementById(`settings-tab-${prev}`)?.focus()
                } else if (e.key === 'Home') {
                  e.preventDefault()
                  setActiveTab(tabIds[0])
                  document.getElementById(`settings-tab-${tabIds[0]}`)?.focus()
                } else if (e.key === 'End') {
                  e.preventDefault()
                  setActiveTab(tabIds[tabIds.length - 1])
                  document.getElementById(`settings-tab-${tabIds[tabIds.length - 1]}`)?.focus()
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
