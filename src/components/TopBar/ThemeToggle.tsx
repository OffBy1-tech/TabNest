import React from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../ThemeProvider'
import type { ThemePreference } from '../ThemeProvider'
import { iconButtonStyle } from './styles'

/** Cycles the theme preference light → dark → system on each click. */
export function ThemeToggle(): React.JSX.Element {
  const { theme, setTheme } = useTheme()

  const CYCLE: ThemePreference[] = ['light', 'dark', 'system']

  function handleClick(): void {
    const currentIdx = CYCLE.indexOf(theme)
    const nextIdx = (currentIdx + 1) % CYCLE.length
    const next = CYCLE[nextIdx]
    if (next !== undefined) setTheme(next)
  }

  const label =
    theme === 'light'
      ? 'Switch to dark theme'
      : theme === 'dark'
        ? 'Switch to system theme'
        : 'Switch to light theme'

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
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
      <Icon size={18} aria-hidden="true" />
    </button>
  )
}
