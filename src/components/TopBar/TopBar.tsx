import React from 'react'
import { Layers, Settings } from 'lucide-react'
import { Clock } from '../Clock/Clock'
import { SyncStatusDot } from './SyncStatusDot'
import { ThemeToggle } from './ThemeToggle'
import { iconButtonStyle } from './styles'

// ---------------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------------

export interface TopBarProps {
  onSearch: () => void
  onActiveTabsToggle: () => void
  activeTabsOpen: boolean
  syncState: 'idle' | 'syncing' | 'error'
  lastSyncAt: number
  onSettingsClick: () => void
  showClock?: boolean
}

export function TopBar({
  onSearch,
  onActiveTabsToggle,
  activeTabsOpen,
  syncState,
  lastSyncAt,
  onSettingsClick,
  showClock = false,
}: TopBarProps): React.JSX.Element {

  return (
    <header
      role="banner"
      aria-label="Tab Nest top bar"
      style={{
        height: 'var(--topbar-height)',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: '0 var(--space-4)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Left: Logo */}
      <div style={{ flexShrink: 0 }}>
        <span
          style={{
            fontWeight: 600,
            fontSize: 'var(--text-lg)',
            color: 'var(--color-brand-500)',
            letterSpacing: '-0.01em',
          }}
        >
          Tab Nest
        </span>
      </div>

      {/* Center: Search trigger */}
      <div
        role="search"
        style={{ flex: 1, maxWidth: 480, margin: '0 auto' }}
      >
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search tabs (Command K)"
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            gap: 'var(--space-2)',
            textAlign: 'left',
            transition: 'border-color var(--duration-fast) var(--ease-default)',
            outline: 'none',
          }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-focus)'
            ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
            ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'
            ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
          }}
        >
          <span style={{ flex: 1 }}>Search tabs... ⌘K, Ctrl+K, or '/'</span>
        </button>
      </div>

      {/* Right: Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          flexShrink: 0,
        }}
      >
        {/* Clock */}
        {showClock && (
          <div style={{ paddingRight: 'var(--space-2)' }}>
            <Clock />
          </div>
        )}

        {/* Active tabs toggle */}
        <button
          type="button"
          onClick={onActiveTabsToggle}
          aria-label={activeTabsOpen ? 'Close active tabs panel' : 'Open active tabs panel'}
          aria-pressed={activeTabsOpen}
          title="Toggle active tabs panel"
          style={{
            ...iconButtonStyle,
            backgroundColor: activeTabsOpen ? 'var(--color-brand-100)' : 'transparent',
            color: activeTabsOpen ? 'var(--color-brand-500)' : 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            if (!activeTabsOpen) {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
            }
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = activeTabsOpen
              ? 'var(--color-brand-100)'
              : 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = activeTabsOpen
              ? 'var(--color-brand-500)'
              : 'var(--text-secondary)'
          }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
            ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
          }}
        >
          <Layers size={18} aria-hidden="true" />
        </button>

        {/* Sync status dot */}
        <SyncStatusDot syncState={syncState} lastSyncAt={lastSyncAt} />

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Settings */}
        <button
          type="button"
          onClick={onSettingsClick}
          aria-label="Open settings"
          title="Settings"
          style={iconButtonStyle}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
          }}
          onFocus={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = `2px solid var(--border-focus)`
            ;(e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.outline = 'none'
          }}
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
