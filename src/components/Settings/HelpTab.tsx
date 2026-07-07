import React from 'react'
import { sectionHeadingStyle, primaryBtnStyle } from './styles'

export interface HelpTabProps {
  // Explicitly allows `undefined` so the value can flow from SettingsModal's
  // optional prop under exactOptionalPropertyTypes.
  onShowOnboarding?: (() => void) | undefined
}

export function HelpTab({ onShowOnboarding }: HelpTabProps): React.JSX.Element {
  // Read from the manifest so this always matches the published extension
  // version. Accessed via globalThis because in non-extension contexts (dev
  // server, Storybook, jsdom tests) the `chrome` identifier is undeclared and
  // a bare `chrome?.` would throw ReferenceError.
  const version = globalThis.chrome?.runtime?.getManifest?.().version ?? 'dev'

  return (
    <div>
      <h3 style={sectionHeadingStyle}>Help</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <button
            onClick={onShowOnboarding}
            style={primaryBtnStyle}
            aria-label="Show onboarding walkthrough again"
          >
            Show Onboarding Again
          </button>
        </div>

        <div>
          <a
            href="https://github.com/OffBy1-tech/TabNest"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-brand-500)',
              textDecoration: 'underline',
            }}
            aria-label="Open Tab Nest GitHub repository (opens in new tab)"
          >
            GitHub Repository
          </a>
        </div>

        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
          }}
        >
          Version: v{version}
        </div>
      </div>
    </div>
  )
}
