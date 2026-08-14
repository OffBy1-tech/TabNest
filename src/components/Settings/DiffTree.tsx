/**
 * DiffTree.tsx
 * Pure presentational renderer for a WorkspaceDiff[] (lib/diff.ts).
 * No storage access. All colors from design tokens.
 */

import React, { useState } from 'react'
import type {
  DiffStatus,
  FieldChange,
  TabDiff,
  NoteDiff,
  GroupDiff,
  CategoryDiff,
  WorkspaceDiff,
} from '../../lib/diff'

const STATUS_COLOR: Record<DiffStatus, string> = {
  added: 'var(--color-success)',
  removed: 'var(--color-danger)',
  modified: 'var(--color-warning)',
  unchanged: 'var(--text-muted)',
}

const STATUS_PREFIX: Record<DiffStatus, string> = {
  added: '+',
  removed: '−',
  modified: '~',
  unchanged: '',
}

const TAB_TRUNCATE_AT = 10
const INDENT = 20

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.7,
  minWidth: 0,
}

const prefixStyle = (status: DiffStatus): React.CSSProperties => ({
  color: STATUS_COLOR[status],
  width: 14,
  flexShrink: 0,
  textAlign: 'center',
  fontWeight: 700,
})

const ellipsisStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

function StatusBadge({ status }: { status: DiffStatus }): React.JSX.Element {
  return (
    <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 'var(--text-xs)', color: STATUS_COLOR[status] }}>
      {status}
    </span>
  )
}

function FieldChangeRows({ changes, indent }: { changes: FieldChange[]; indent: number }): React.JSX.Element | null {
  if (changes.length === 0) return null
  return (
    <>
      {changes.map((c) => (
        <div key={c.field} style={{ ...rowStyle, paddingLeft: indent, fontSize: 'var(--text-xs)', color: STATUS_COLOR.modified }}>
          {c.field}: “{c.before}” → “{c.after}”
        </div>
      ))}
    </>
  )
}

function LeafRow({ status, label, fieldChanges, indent }: {
  status: DiffStatus
  label: string
  fieldChanges: FieldChange[]
  indent: number
}): React.JSX.Element {
  return (
    <>
      <div style={{ ...rowStyle, paddingLeft: indent }}>
        <span style={prefixStyle(status)}>{STATUS_PREFIX[status]}</span>
        <span style={{ ...ellipsisStyle, color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <FieldChangeRows changes={fieldChanges} indent={indent + 22} />
    </>
  )
}

/** Changed tabs of one group, truncated at TAB_TRUNCATE_AT with expand. */
function TabRows({ tabs, indent }: { tabs: TabDiff[]; indent: number }): React.JSX.Element {
  const [showAll, setShowAll] = useState(false)
  const changed = tabs.filter((t) => t.status !== 'unchanged')
  const visible = showAll ? changed : changed.slice(0, TAB_TRUNCATE_AT)
  const hidden = changed.length - visible.length
  return (
    <>
      {visible.map((t) => (
        <LeafRow key={t.tab.id} status={t.status} label={t.tab.title} fieldChanges={t.fieldChanges} indent={indent} />
      ))}
      {hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            marginLeft: indent,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
            textAlign: 'left',
          }}
          aria-label={`Show ${hidden} more tabs`}
        >
          … {hidden} more
        </button>
      )}
    </>
  )
}

/** Changed notes of a group or category (never truncated — notes are few). */
function NoteRows({ notes, indent }: { notes: NoteDiff[]; indent: number }): React.JSX.Element {
  return (
    <>
      {notes.filter((n) => n.status !== 'unchanged').map((n) => (
        <LeafRow
          key={n.note.id}
          status={n.status}
          label={`note: ${n.note.content.slice(0, 40)}${n.note.content.length > 40 ? '…' : ''}`}
          fieldChanges={n.fieldChanges}
          indent={indent}
        />
      ))}
    </>
  )
}

/** Expandable row for workspace/category/group nodes. Unchanged = flat row. */
function Node({ status, label, detail, fieldChanges, indent, children }: {
  status: DiffStatus
  label: string
  detail?: string
  fieldChanges: FieldChange[]
  indent: number
  children?: React.ReactNode
}): React.JSX.Element {
  const expandable = status !== 'unchanged'
  const [open, setOpen] = useState(true)
  return (
    <div>
      <div style={{ ...rowStyle, paddingLeft: indent }}>
        {expandable ? (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
            aria-expanded={open}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              width: 14,
              flexShrink: 0,
              color: 'var(--text-muted)',
              fontSize: 'var(--text-xs)',
            }}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <span style={prefixStyle(status)}>{STATUS_PREFIX[status]}</span>
        <span style={{ ...ellipsisStyle, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        {detail && (
          <span style={{ flexShrink: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{detail}</span>
        )}
        <StatusBadge status={status} />
      </div>
      {expandable && open && (
        <>
          <FieldChangeRows changes={fieldChanges} indent={indent + 36} />
          {children}
        </>
      )}
    </div>
  )
}

function GroupNode({ g, indent }: { g: GroupDiff; indent: number }): React.JSX.Element {
  return (
    <Node
      status={g.status}
      label={g.group.name}
      detail={`${g.group.tabs.length} ${g.group.tabs.length === 1 ? 'tab' : 'tabs'}`}
      fieldChanges={g.fieldChanges}
      indent={indent}
    >
      <TabRows tabs={g.tabs} indent={indent + 36} />
      <NoteRows notes={g.notes} indent={indent + 36} />
    </Node>
  )
}

function CategoryNode({ c, indent }: { c: CategoryDiff; indent: number }): React.JSX.Element {
  return (
    <Node status={c.status} label={c.category.name} fieldChanges={c.fieldChanges} indent={indent}>
      {c.groups.filter((g) => g.status !== 'unchanged').map((g) => (
        <GroupNode key={g.group.id} g={g} indent={indent + INDENT} />
      ))}
      <NoteRows notes={c.notes} indent={indent + INDENT} />
    </Node>
  )
}

export function DiffTree({ diff }: { diff: WorkspaceDiff[] }): React.JSX.Element {
  if (diff.every((w) => w.status === 'unchanged')) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        No differences between these snapshots.
      </p>
    )
  }
  return (
    <div aria-label="Backup differences" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {diff.map((w) => (
        <Node key={w.workspace.id} status={w.status} label={w.workspace.name} fieldChanges={w.fieldChanges} indent={0}>
          {w.categories.map((c) => (
            <CategoryNode key={c.category.id} c={c} indent={INDENT} />
          ))}
        </Node>
      ))}
    </div>
  )
}
