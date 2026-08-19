import React, { useCallback, useEffect, useId, useState } from 'react';
import type { LocalSettings, SyncMeta, Workspace, StorageSchema, DriveRevision } from '../../lib/schema';
import { useLocalBackups } from '../../hooks/useLocalBackups';
import { StorageSchemaZod } from '../../lib/schema';
import { readStorage, writeStorage, restoreLocalBackup, stripDeviceOnlyFields } from '../../lib/storage';
import { sendExtensionMessage } from '../../lib/messaging';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { BackupsSection } from './BackupsSection';
import { ToggleSwitch } from './ToggleSwitch';
import { SettingRow } from './SettingRow';
import { mergeImportedData } from './mergeImportedData';
import {
  sectionHeadingStyle,
  selectStyle,
  primaryBtnStyle,
  dangerBtnStyle,
  ghostBtnStyle,
  listResetStyle,
  listRowStyle,
  listRowTextStyle,
  smallGhostBtnStyle,
  alertTextStyle,
  statusTextStyle,
} from './styles';

/** Outcome line under an import button; error and success share one slot. */
type ImportResult = { text: string; isError: boolean } | null;

const groupsWord = (n: number): string => `group${n === 1 ? '' : 's'}`;
function ImportResultLine({ result }: { result: ImportResult }): React.JSX.Element | null {
  if (result === null) return null;
  return (
    <div
      role={result.isError ? 'alert' : 'status'}
      style={{ ...(result.isError ? alertTextStyle : statusTextStyle), marginTop: 'var(--space-2)' }}
    >
      {result.text}
    </div>
  );
}

export interface SyncAndDataTabProps {
  localSettings: LocalSettings;
  onLocalSettingsChange: (patch: Partial<LocalSettings>) => void;
  syncMeta: SyncMeta;
  workspaces: Workspace[];
  /** Imports one group per top-level bookmark folder; resolves to the group count. */
  onImportBookmarks?: ((tree: chrome.bookmarks.BookmarkTreeNode[]) => Promise<number>) | undefined;
  /** Imports OneTab-format text; resolves to how many groups landed (and failed). */
  onImportOneTab?: ((text: string) => Promise<{ imported: number; failed: number }>) | undefined;
}

export function SyncAndDataTab({
  localSettings,
  onLocalSettingsChange,
  syncMeta,
  workspaces,
  onImportBookmarks,
  onImportOneTab,
}: SyncAndDataTabProps): React.JSX.Element {
  const backups = useLocalBackups();
  const isConnected = syncMeta.drive_file_id !== null;
  const intervalId = useId();
  const onetabId = useId();
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(syncMeta.sync_state === 'syncing');
  const [pendingImport, setPendingImport] = useState<StorageSchema | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [onetabText, setOnetabText] = useState('');
  const [onetabResult, setOnetabResult] = useState<ImportResult>(null);
  const [bookmarksResult, setBookmarksResult] = useState<ImportResult>(null);
  const hasExistingData = workspaces.some((ws) => ws.categories.some((cat) => cat.groups.length > 0));
  useEffect(() => {
    setSyncing(syncMeta.sync_state === 'syncing');
  }, [syncMeta.sync_state]);
  const handleConnectDrive = useCallback(async () => {
    setConnecting(true);
    setConnectError(null);
    const res = await sendExtensionMessage<{ connected?: boolean }>({ type: 'CONNECT_DRIVE' });
    setConnecting(false);
    if (!res.ok) {
      setConnectError(res.error || 'Failed to connect. Please try again.');
    } else if (!res.data?.connected) {
      setConnectError('Authorization was cancelled or failed. Please try again.');
    }
  }, []);
  const handleDisconnect = useCallback(async () => {
    await sendExtensionMessage({ type: 'DISCONNECT_DRIVE' });
  }, []);
  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    await sendExtensionMessage({ type: 'TRIGGER_SYNC' });
  }, []);

  // Restore from Drive revision history (spec §9.2/§11.3)
  const [revisions, setRevisions] = useState<DriveRevision[] | null>(null);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);
  const [confirmRevisionId, setConfirmRevisionId] = useState<string | null>(null);
  const [restoredRevision, setRestoredRevision] = useState(false);

  // Local backup restore state — the backups themselves come from the
  // useLocalBackups hook, live via the tabnest_backups key's onChanged.
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const handleRestoreLocalBackup = useCallback(async (index: number) => {
    setBackupNotice(null);
    setBackupError(null);
    try {
      await restoreLocalBackup(index);
      setBackupNotice('Backup restored. Your previous workspaces were saved as a new backup.');
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : String(err));
    }
  }, []);
  const handleLoadRevisions = useCallback(async () => {
    setRevisionsLoading(true);
    setRevisionsError(null);
    setRestoredRevision(false);
    const res = await sendExtensionMessage<DriveRevision[]>({ type: 'GET_DRIVE_REVISIONS' });
    setRevisionsLoading(false);
    if (!res.ok) {
      setRevisionsError(res.error || 'Failed to load backups.');
      return;
    }
    setRevisions(res.data ?? []);
  }, []);
  const handleRestoreRevision = useCallback(async (revisionId: string) => {
    setRevisionsLoading(true);
    setRevisionsError(null);
    const res = await sendExtensionMessage({
      type: 'RESTORE_DRIVE_REVISION',
      payload: { revision_id: revisionId },
    });
    setRevisionsLoading(false);
    if (!res.ok) {
      setRevisionsError(res.error || 'Restore failed.');
      return;
    }
    setRestoredRevision(true);
    setRevisions(null);
  }, []);
  const handleExportJSON = async () => {
    try {
      // readStorage defaults on fresh profiles, so Export always produces a file.
      const data = await readStorage();
      // Device-only fields (backup snapshots, per-device settings) stay out
      // of user exports — same contract as Drive writes.
      const json = JSON.stringify(stripDeviceOnlyFields(data), null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tabnest_data.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Non-extension context
    }
  };
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const parsed = StorageSchemaZod.parse(raw);
        if (hasExistingData) {
          setPendingImport(parsed);
        } else {
          // Import only user content — never the file's sync_meta / local_settings.
          // Accepting a crafted last_modified_at would let an imported "backup"
          // win every last-write-wins sync and wipe the user's other devices.
          // writeStorage preserves the local device's sync_meta/local_settings,
          // uses the serial write queue, and bumps last_modified_at correctly.
          void writeStorage({
            workspaces: parsed.workspaces,
            settings: parsed.settings,
            trash: parsed.trash,
          });
        }
      } catch {
        setImportError('Import failed — the file is not a valid Tab Nest export.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  const handleImportOverwrite = () => {
    if (!pendingImport) return;
    // Overwrite user content only; keep this device's sync_meta / local_settings.
    void writeStorage({
      workspaces: pendingImport.workspaces,
      settings: pendingImport.settings,
      trash: pendingImport.trash,
    });
    setPendingImport(null);
  };
  const handleImportAppend = () => {
    if (!pendingImport) return;
    // Read-merge-write through the storage layer so a concurrent background
    // write (context-menu save, sync apply) can't be lost between get and set.
    // mergeImportedData only touches workspaces, so that's all we write back.
    void (async () => {
      const current = await readStorage();
      const merged = mergeImportedData(current, pendingImport);
      await writeStorage({ workspaces: merged.workspaces });
    })();
    setPendingImport(null);
  };
  const handleImportCancel = () => setPendingImport(null);
  const handleBookmarksImport = async () => {
    setBookmarksResult(null);
    if (!onImportBookmarks) {
      setBookmarksResult({ text: 'Bookmark import is unavailable here.', isError: true });
      return;
    }
    let tree: chrome.bookmarks.BookmarkTreeNode[];
    try {
      const granted = await chrome.permissions.request({ permissions: ['bookmarks'] });
      if (!granted) return;
      tree = await chrome.bookmarks.getTree();
    } catch {
      setBookmarksResult({ text: 'Could not read bookmarks — permission denied or unavailable.', isError: true });
      return;
    }
    try {
      const imported = await onImportBookmarks(tree);
      setBookmarksResult({ text: `Imported ${imported} ${groupsWord(imported)} from bookmarks.`, isError: false });
    } catch (err) {
      setBookmarksResult({ text: err instanceof Error ? err.message : 'Bookmark import failed.', isError: true });
    }
  };
  const handleOneTabImport = async () => {
    if (!onetabText.trim()) return;
    setOnetabResult(null);
    if (!onImportOneTab) {
      setOnetabResult({ text: 'OneTab import is unavailable here.', isError: true });
      return;
    }
    try {
      const { imported, failed } = await onImportOneTab(onetabText);
      // Clear the pasted text only once everything has actually been saved
      if (failed === 0) setOnetabText('');
      setOnetabResult(
        failed === 0
          ? { text: `Imported ${imported} ${groupsWord(imported)} from OneTab.`, isError: false }
          : imported === 0
            ? { text: 'OneTab import failed — nothing was imported. Your pasted text was kept.', isError: true }
            : { text: `Imported ${imported} ${groupsWord(imported)}; ${failed} failed. Your pasted text was kept.`, isError: false },
      );
    } catch (err) {
      setOnetabResult({ text: err instanceof Error ? err.message : 'OneTab import failed.', isError: true });
    }
  };
  const importedGroupCount = pendingImport?.workspaces.reduce(
    (sum, ws) => sum + ws.categories.reduce((s, cat) => s + cat.groups.length, 0),
    0,
  ) ?? 0;
  const lastSyncText =
    syncMeta.last_sync_at === 0
      ? 'Never'
      : new Date(syncMeta.last_sync_at).toLocaleString();
  const subHeadingStyle: React.CSSProperties = {
    margin: '0 0 var(--space-4)',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };
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
            <button onClick={() => { void handleDisconnect(); }} style={ghostBtnStyle} aria-label="Disconnect Google Drive">
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
                onClick={() => { void handleConnectDrive(); }}
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
                  color: 'var(--color-danger)',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
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
            const v = e.target.value;
            onLocalSettingsChange({
              sync_interval_minutes: v === 'manual' ? null : (parseInt(v, 10) as 5 | 15 | 30),
            });
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
          onClick={() => { void handleSyncNow(); }}
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
              <div role="alert" style={alertTextStyle}>
                {revisionsError}
              </div>
            )}
            {restoredRevision && (
              <div role="status" style={statusTextStyle}>
                Backup restored. Your previous data was kept as a local backup.
              </div>
            )}

            {revisions !== null && revisions.length === 0 && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>No backups found.</span>
            )}
            {revisions !== null && revisions.length > 0 && (
              <ul style={listResetStyle} aria-label="Drive backups">
                {revisions.map((rev) => (
                  <li key={rev.id} style={listRowStyle}>
                    <span style={listRowTextStyle}>
                      {new Date(rev.modifiedTime).toLocaleString()}
                    </span>
                    <button
                      onClick={() => setConfirmRevisionId(rev.id)}
                      style={smallGhostBtnStyle}
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
          if (confirmRevisionId) void handleRestoreRevision(confirmRevisionId);
          setConfirmRevisionId(null);
        }}
        onCancel={() => setConfirmRevisionId(null)}
      />

      {/* ── Local backups (diff & restore) ── */}
      <div style={{ borderTop: '1px solid var(--border-default)', margin: 'var(--space-6) 0' }} />
      <h4 style={subHeadingStyle}>Local backups</h4>
      <p style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        Snapshots saved automatically before a sync overwrite or restore. Compare any two — or against your current data — to see exactly what differs.
      </p>
      <BackupsSection
        backups={backups}
        currentWorkspaces={workspaces}
        onRestore={(i) => void handleRestoreLocalBackup(i)}
        restoreNotice={backupNotice}
        restoreError={backupError}
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
              <div role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>
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
        <ImportResultLine result={bookmarksResult} />
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
          onClick={() => void handleOneTabImport()}
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
        <ImportResultLine result={onetabResult} />
      </section>
    </div>
  );
}
