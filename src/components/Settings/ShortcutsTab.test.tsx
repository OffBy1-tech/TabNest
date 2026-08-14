import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ShortcutsTab } from './ShortcutsTab'

describe('ShortcutsTab', () => {
  it('renders a labelled shortcuts table with Shortcut/Action columns', () => {
    render(<ShortcutsTab />)
    const table = screen.getByRole('table', { name: 'Keyboard shortcuts reference' })
    expect(within(table).getByRole('columnheader', { name: 'Shortcut' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Action' })).toBeInTheDocument()
  })

  it('lists the documented shortcuts', () => {
    render(<ShortcutsTab />)
    expect(screen.getByText('Open global search')).toBeInTheDocument()
    expect(screen.getByText('Move group to Trash')).toBeInTheDocument()
    // 1 header row + 5 shortcut rows
    expect(screen.getAllByRole('row')).toHaveLength(6)
  })
})
