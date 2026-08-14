import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { diffWorkspaces } from '../../lib/diff'
import { tab, group, category, workspace } from '../../lib/testFixtures'
import { DiffTree } from './DiffTree'

describe('DiffTree', () => {
  it('shows the no-differences state for an all-unchanged diff', () => {
    const ws = [workspace('w', [category('c')])]
    render(<DiffTree diff={diffWorkspaces(ws, structuredClone(ws))} />)
    expect(screen.getByText('No differences between these snapshots.')).toBeInTheDocument()
  })

  it('renders removed groups with their tabs and an unchanged sibling collapsed', () => {
    const before = [workspace('w', [
      category('changed', { groups: [group('scratch', { tabs: [tab('Ollama docs')] })] }),
      category('same', { groups: [group('keep')] }),
    ])]
    const after = [workspace('w', [category('changed'), category('same', { groups: [group('keep')] })])]
    render(<DiffTree diff={diffWorkspaces(before, after)} />)

    expect(screen.getByText('scratch')).toBeInTheDocument()
    expect(screen.getByText('Ollama docs')).toBeInTheDocument()
    // unchanged category renders as a single non-expandable row
    expect(screen.getByText('same')).toBeInTheDocument()
    expect(screen.getAllByText('unchanged').length).toBeGreaterThan(0)
    expect(screen.queryByText('keep')).not.toBeInTheDocument()
  })

  it('renders field changes for renames', () => {
    const before = [workspace('w', [category('c', { groups: [group('g', { name: 'To read' })] })])]
    const after = [workspace('w', [category('c', { groups: [group('g', { name: 'Reading list' })] })])]
    render(<DiffTree diff={diffWorkspaces(before, after)} />)
    expect(screen.getByText(/name: “To read” → “Reading list”/)).toBeInTheDocument()
  })

  it('truncates long tab lists at 10 and expands on demand', () => {
    const tabs = Array.from({ length: 14 }, (_, i) => tab(`tab-${i}`))
    const before = [workspace('w', [category('c', { groups: [group('big', { tabs })] })])]
    const after = [workspace('w', [category('c')])]
    render(<DiffTree diff={diffWorkspaces(before, after)} />)

    expect(screen.getByText('tab-9')).toBeInTheDocument()
    expect(screen.queryByText('tab-10')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show 4 more tabs' }))
    expect(screen.getByText('tab-13')).toBeInTheDocument()
  })

  it('collapses and re-expands a changed node via its toggle', () => {
    const before = [workspace('w', [category('c', { groups: [group('g', { tabs: [tab('t')] })] })])]
    const after = [workspace('w', [category('c', { groups: [group('g', { tabs: [tab('t'), tab('t2')] })] })])]
    render(<DiffTree diff={diffWorkspaces(before, after)} />)

    expect(screen.getByText('t2')).toBeInTheDocument()
    // collapse the workspace node — children disappear
    fireEvent.click(screen.getByRole('button', { name: 'Collapse w' }))
    expect(screen.queryByText('t2')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand w' }))
    expect(screen.getByText('t2')).toBeInTheDocument()
  })
})
