import React, { useCallback, useEffect, useId, useState } from 'react'
import type { LocalSettings, SyncMeta, Workspace, StorageSchema, DriveRevision } from '../../lib/schema'
import { StorageSchemaZod } from '../../lib/schema'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { ToggleSwitch } from './ToggleSwitch'
import { SettingRow } from './SettingRow'
import { mergeImportedData } from './mergeImportedData'
import {
  sectionHeadingStyle,
  selectStyle,
  primaryBtnStyle,
  dangerBtnStyle,
  ghostBtnStyle,
} from './styles'

/** Promisified wrapper around chrome.runtime.sendMessage */
function sendMessage(msg: unknown): Promise<{ ok: boolean; error?: string; data?: unknown }> {
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

export interface SyncAndDataTabProps {
  localSettings: LocalSettings
  onLocalSettingsChange: (patch: Partial<LocalSettings>) => void
  syncMeta: SyncMeta
  workspaces: Workspace[]
}

export function SyncAndDataTab({
  localSettings,
  onLocalSettingsChange,
  syncMeta,
  workspaces,
}: SyncAndDataTabProps): React.JSX.Element {
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

  // Restore from Drive revision history (spec §9.2/§11.3)
  const [revisions, setRevisions] = useState<DriveRevision[] | null>(null)
  const [revisionsLoading, setRevisionsLoading] = useState(false)
  const [revisionsError, setRevisionsError] = useState<string | null>(null)
  const [confirmRevisionId, setConfirmRevisionId] = useState<string | null>(null)
  const [restoredRevision, setRestoredRevision] = useState(false)

  const handleLoadRevisions = useCallback(async () => {
    setRevisionsLoading(true)
    setRevisionsError(null)
    setRestoredRevision(false)
    const res = await sendMessage({ type: 'GET_DRIVE_REVISIONS' })
    setRevisionsLoading(false)
    if (!res.ok) {
      setRevisionsError(res.error ?? 'Failed to load backups.')
      return
    }
    setRevisions((res.data as DriveRevision[] | undefined) ?? [])
  }, [])

  const handleRestoreRevision = useCallback(async (revisionId: string) => {
    setRevisionsLoading(true)
    setRevisionsError(null)
    const res = await sendMessage({
      type: 'RESTORE_DRIVE_REVISION',
      payload: { revision_id: revisionId },
    })
    setRevisionsLoading(false)
    if (!res.ok) {
      setRevisionsError(res.error ?? 'Restore failed.')
      return
    }
    setRestoredRevision(true)
    setRevisions(null)
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

      <SettingRow label="Sync now">
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

      {/* Restore from Drive revision history (spec §9.2/§11.3) */}
      {isConnected && (
        <SettingRow label="Restore from backup" last>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}>
            <div>
              <button
                onClick={() => void handleLoadRevisions()}
                disabled={revisionsLoading}
                style={{ ...ghostBtnStyle, opacity: revisionsLoading ? 0.5 : 1 }}
                aria-label="Show Drive backup versions"
                aria-busy={revisionsLoading}
              >
                {revisionsLoading ? 'Loading…' : 'Show backups'}
              </button>
            </div>

            {revisionsError && (
              <div role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>
                {revisionsError}
              </div>
            )}
            {restoredRevision && (
              <div role="status" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>
                Backup restored. Your previous data was kept as a local backup.
              </div>
            )}

            {revisions !== null && revisions.length === 0 && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>No backups found.</span>
            )}
            {revisions !== null && revisions.length > 0 && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }} aria-label="Drive backups">
                {revisions.map((rev) => (
                  <li key={rev.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ flex: 1, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {new Date(rev.modifiedTime).toLocaleString()}
                    </span>
                    <button
                      onClick={() => setConfirmRevisionId(rev.id)}
                      style={{ ...ghostBtnStyle, padding: '2px var(--space-2)', fontSize: 'var(--text-xs)' }}
                      aria-label={`Restore backup from ${new Date(rev.modifiedTime).toLocaleString()}`}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SettingRow>
      )}

      <ConfirmDialog
        isOpen={confirmRevisionId !== null}
        title="Restore backup"
        message="Replace your current data with this backup? Your current workspaces are kept as a local backup."
        confirmLabel="Restore"
        onConfirm={() => {
          if (confirmRevisionId) void handleRestoreRevision(confirmRevisionId)
          setConfirmRevisionId(null)
        }}
        onCancel={() => setConfirmRevisionId(null)}
      />

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
