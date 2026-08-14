/**
 * BackupsSection.tsx
 * "Local backups" section for Settings → Sync & Data: lists the generational
 * pre-overwrite snapshots (backup_generations), lets the user diff any two
 * snapshots (including current state) via DiffTree, and restore one.
 * Storage I/O lives in the parent (SyncAndDataTab) — this component is
 * presentational + local UI state.
 */

import React, { useMemo, useState } from 'react'
import type { BackupGeneration, Workspace } from '../../lib/schema'
import { diffWorkspaces, snapshotStats } from '../../lib/diff'
import { DiffTree } from './DiffTree'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import {
  selectStyle,
  listResetStyle,
  listRowStyle,
  listRowTextStyle,
  smallGhostBtnStyle,
  alertTextStyle,
  statusTextStyle,
} from './styles'

export interface BackupsSectionProps {
  backups: BackupGeneration[]
  currentWorkspaces: Workspace[]
  onRestore: (index: number) => void
  restoreNotice: string | null
  restoreError: string | null
}

function snapshotDate(saved_at: number): string {
  return saved_at === 0 ? 'unknown time (migrated)' : new Date(saved_at).toLocaleString()
}

function statsText(workspaces: Workspace[]): string {
  const s = snapshotStats(workspaces)
  const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? '' : 's'}`
  return `${plural(s.workspaces, 'workspace')} · ${plural(s.groups, 'group')} · ${plural(s.tabs, 'tab')}`
}

/** One selectable side of the comparison. `index` is null for current state. */
interface Snapshot {
  key: string
  label: string
  workspaces: Workspace[]
  index: number | null
  date: string
  stats: string
}

export function BackupsSection({
  backups,
  currentWorkspaces,
  onRestore,
  restoreNotice,
  restoreError,
}: BackupsSectionProps): React.JSX.Element {
  const snapshots: Snapshot[] = useMemo(
    () => [
      {
        key: 'current',
        label: 'Current',
        workspaces: currentWorkspaces,
        index: null,
        date: '',
        stats: statsText(currentWorkspaces),
      },
      ...backups.map((gen, i) => ({
        key: `backup-${i}`,
        label: `Backup ${i + 1} (${snapshotDate(gen.saved_at)})`,
        workspaces: gen.workspaces,
        index: i,
        date: snapshotDate(gen.saved_at),
        stats: statsText(gen.workspaces),
      })),
    ],
    [backups, currentWorkspaces],
  )

  const [selA, setSelA] = useState(backups.length > 0 ? 'backup-0' : 'current')
  const [selB, setSelB] = useState('current')
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null)

  const resolve = (key: string): Workspace[] =>
    snapshots.find((s) => s.key === key)?.workspaces ?? []
  const diff = useMemo(
    () => diffWorkspaces(resolve(selA), resolve(selB)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selA, selB, snapshots],
  )

  if (backups.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        No local backups yet. A backup is saved automatically before a sync overwrite or revision restore.
      </p>
    )
  }

  const backupRows = snapshots.filter((s): s is Snapshot & { index: number } => s.index !== null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Generation list */}
      <ul style={listResetStyle} aria-label="Local backups">
        {backupRows.map((s) => (
          <li key={s.key} style={listRowStyle}>
            <span style={listRowTextStyle}>
              Backup {s.index + 1} · {s.date} · {s.stats}
            </span>
            <button
              onClick={() => setConfirmIndex(s.index)}
              style={smallGhostBtnStyle}
              aria-label={`Restore backup ${s.index + 1} from ${s.date}`}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>

      {restoreError && (
        <div role="alert" style={alertTextStyle}>
          {restoreError}
        </div>
      )}
      {restoreNotice && (
        <div role="status" style={statusTextStyle}>
          {restoreNotice}
        </div>
      )}

      {/* Compare picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Compare</span>
        <select value={selA} onChange={(e) => setSelA(e.target.value)} aria-label="Compare snapshot A" style={selectStyle}>
          {snapshots.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>with</span>
        <select value={selB} onChange={(e) => setSelB(e.target.value)} aria-label="Compare snapshot B" style={selectStyle}>
          {snapshots.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Diff */}
      <DiffTree diff={diff} />

      <ConfirmDialog
        isOpen={confirmIndex !== null}
        title="Restore local backup"
        message={
          confirmIndex !== null
            ? `Replace your current workspaces with the backup from ${snapshotDate(backups[confirmIndex]?.saved_at ?? 0)}? Your current state will be saved as a new backup first. Settings and Trash are not affected.`
            : ''
        }
        confirmLabel="Restore"
        onConfirm={() => {
          if (confirmIndex !== null) onRestore(confirmIndex)
          setConfirmIndex(null)
        }}
        onCancel={() => setConfirmIndex(null)}
      />
    </div>
  )
}
