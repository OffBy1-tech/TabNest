import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActiveTabsPanel } from './ActiveTabsPanel'
import { makeWorkspaces } from './testFixtures'

describe('ActiveTabsPanel', () => {
  it('renders the panel header and empty state when no windows are detected', () => {
    // No chrome.* in jsdom ⇒ useActiveTabs yields no windows.
    render(
      <ActiveTabsPanel
        onSaveTab={vi.fn()}
        onSaveWindowTabs={vi.fn()}
        onCloseTab={vi.fn()}
        workspaces={makeWorkspaces()}
      />,
    )
    expect(screen.getByRole('complementary', { name: 'Active browser tabs' })).toBeInTheDocument()
    expect(screen.getByText('Active Tabs')).toBeInTheDocument()
    expect(screen.getByText('No open browser windows detected.')).toBeInTheDocument()
  })
})
