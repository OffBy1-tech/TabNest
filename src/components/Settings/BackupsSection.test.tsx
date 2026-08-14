import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { BackupGeneration } from '../../lib/schema'
import { tab, group, category, workspace } from '../../lib/testFixtures'
import { BackupsSection } from './BackupsSection'

const current = [workspace('w', [category('c', { groups: [group('kept'), group('new-group')] })])]
const snapshot = [workspace('w', [category('c', { groups: [group('kept'), group('lost', { tabs: [tab('lost-tab')] })] })])]
const backups: BackupGeneration[] = [{ saved_at: 1754257500000, workspaces: snapshot }]

function renderSection(overrides: Partial<Parameters<typeof BackupsSection>[0]> = {}) {
  const onRestore = vi.fn()
  render(
    <BackupsSection
      backups={backups}
      currentWorkspaces={current}
      onRestore={onRestore}
      restoreNotice={null}
      restoreError={null}
      {...overrides}
    />,
  )
  return { onRestore }
}

describe('BackupsSection', () => {
  it('shows the empty state when there are no backups', () => {
    renderSection({ backups: [] })
    expect(screen.getByText(/No local backups yet/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Compare snapshot A')).not.toBeInTheDocument()
  })

  it('lists generations with stats and defaults the compare picker to newest backup vs Current', () => {
    renderSection()
    expect(screen.getByText(/1 workspace/)).toBeInTheDocument()
    expect(screen.getByText(/2 groups/)).toBeInTheDocument()
    const a = screen.getByLabelText('Compare snapshot A') as HTMLSelectElement
    const b = screen.getByLabelText('Compare snapshot B') as HTMLSelectElement
    expect(a.value).toBe('backup-0')
    expect(b.value).toBe('current')
  })

  it('renders the diff between the default selections (backup → current)', () => {
    renderSection()
    // 'lost' exists only in the backup → shows as removed; 'new-group' only in current → added
    expect(screen.getByText('lost')).toBeInTheDocument()
    expect(screen.getByText('new-group')).toBeInTheDocument()
    expect(screen.getByText('lost-tab')).toBeInTheDocument()
  })

  it('shows no differences when the same snapshot is selected on both sides', () => {
    renderSection()
    fireEvent.change(screen.getByLabelText('Compare snapshot A'), { target: { value: 'current' } })
    expect(screen.getByText('No differences between these snapshots.')).toBeInTheDocument()
  })

  it('labels a saved_at of 0 as a migrated snapshot of unknown time', () => {
    renderSection({ backups: [{ saved_at: 0, workspaces: snapshot }] })
    expect(screen.getAllByText(/unknown time \(migrated\)/).length).toBeGreaterThan(0)
  })

  it('confirms before restoring, then calls onRestore with the generation index', () => {
    const { onRestore } = renderSection()
    fireEvent.click(screen.getByRole('button', { name: /Restore backup 1/ }))
    expect(onRestore).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(onRestore).toHaveBeenCalledWith(0)
  })

  it('surfaces restore notice and error', () => {
    renderSection({ restoreNotice: 'Backup restored.', restoreError: null })
    expect(screen.getByRole('status')).toHaveTextContent('Backup restored.')
  })
})
