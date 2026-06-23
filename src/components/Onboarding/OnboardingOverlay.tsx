/**
 * OnboardingOverlay.tsx
 * 3-step action-first onboarding flow. Fires on first install.
 * Focus trap, keyboard navigation, accessible modal semantics.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { WorkspaceDiagram } from './WorkspaceDiagram'
import { StepDots } from './StepDots'
import { type Step } from './steps'

export interface OnboardingOverlayProps {
  isOpen: boolean
  onComplete: () => void
  onSkip: () => void
  onOpenActiveTabs: () => void
  onConnectDrive: () => void
}

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS))
}

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------

export function OnboardingOverlay({
  isOpen,
  onComplete,
  onSkip,
  onOpenActiveTabs,
  onConnectDrive,
}: OnboardingOverlayProps): React.JSX.Element | null {
  const [step, setStep] = useState<Step>(1)
  const overlayRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const prevIsOpenRef = useRef(false)

  // Reset to step 1 whenever the overlay is re-opened (handles "Show onboarding again")
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setStep(1)
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen])

  const handleComplete = useCallback(() => {
    try {
      chrome.storage.local.set({ onboarding_completed: true })
    } catch {
      // Non-extension context — skip
    }
    onComplete()
  }, [onComplete])

  const handleSkip = useCallback(() => {
    try {
      chrome.storage.local.set({ onboarding_completed: true })
    } catch {
      // Non-extension context — skip
    }
    onSkip()
  }, [onSkip])

  // Focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        e.preventDefault()
        handleSkip()
        return
      }

      if (e.key === 'Tab' && overlayRef.current) {
        const focusable = getFocusable(overlayRef.current)
        if (focusable.length === 0) {
          e.preventDefault()
          return
        }
        // Non-null: the length === 0 guard above already returned.
        const first = focusable[0]!
        const last = focusable[focusable.length - 1]!
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    },
    [isOpen, handleSkip],
  )

  // Focus trap and keyboard listener
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement

      const raf = requestAnimationFrame(() => {
        if (overlayRef.current) {
          const focusable = getFocusable(overlayRef.current)
          focusable[0]?.focus()
        }
      })

      document.addEventListener('keydown', handleKeyDown)

      return () => {
        cancelAnimationFrame(raf)
        document.removeEventListener('keydown', handleKeyDown)
        previousFocusRef.current?.focus()
      }
    }
    return undefined
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  // ------------------------------------------------------------------
  // Shared styles
  // ------------------------------------------------------------------

  const headingStyle: React.CSSProperties = {
    margin: '0 0 var(--space-3)',
    fontSize: 'var(--text-2xl)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.25,
  }

  const bodyStyle: React.CSSProperties = {
    margin: '0 0 var(--space-8)',
    fontSize: 'var(--text-base)',
    color: 'var(--text-secondary)',
    lineHeight: 1.65,
  }

  const primaryBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-3) var(--space-6)',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    backgroundColor: 'var(--color-brand-500)',
    color: 'var(--text-inverse)',
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    width: '100%',
  }

  const secondaryBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-3) var(--space-6)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-default)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    width: '100%',
    marginTop: 'var(--space-2)',
  }

  // ------------------------------------------------------------------
  // Step content
  // ------------------------------------------------------------------

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <h2 style={headingStyle}>Save your first tab</h2>
            <p style={bodyStyle}>
              Open the Active Tabs panel, then click the save icon on any tab to add it to a group.
            </p>
            <button
              style={primaryBtnStyle}
              onClick={() => {
                onOpenActiveTabs()
                setStep(2)
              }}
              aria-label="Open Active Tabs panel"
            >
              Open Active Tabs &rarr;
            </button>
          </>
        )

      case 2:
        return (
          <>
            <h2 style={headingStyle}>Meet your workspace</h2>
            <p style={{ ...bodyStyle, marginBottom: 'var(--space-2)' }}>
              Categories keep your groups organized. Rename or add as many as you need.
            </p>
            <WorkspaceDiagram />
            <div style={{ marginTop: 'var(--space-6)' }}>
              <button
                style={primaryBtnStyle}
                onClick={() => setStep(3)}
                aria-label="Got it, go to next step"
              >
                Got it &rarr;
              </button>
            </div>
          </>
        )

      case 3:
        return (
          <>
            <h2 style={headingStyle}>Keep your tabs safe across devices</h2>
            <p style={bodyStyle}>
              Connect Google Drive to back up privately to your own account &mdash; no
              Tab Nest servers.
            </p>
            <button
              style={primaryBtnStyle}
              onClick={() => {
                onConnectDrive()
                handleComplete()
              }}
              aria-label="Connect Google Drive"
            >
              Connect Google Drive
            </button>
            <button
              style={secondaryBtnStyle}
              onClick={handleComplete}
              aria-label="Skip connecting Drive for now"
            >
              Skip for now
            </button>
          </>
        )

      default:
        return null
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-overlay)',
        padding: 'var(--space-4)',
      }}
      aria-hidden="false"
    >
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Tab Nest"
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--bg-base)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.25))',
          padding: 'var(--space-8)',
          fontFamily: 'var(--font-sans)',
          position: 'relative',
        }}
      >
        {/* Skip button */}
        <button
          type="button"
          onClick={handleSkip}
          aria-label="Skip onboarding"
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            padding: 'var(--space-1) var(--space-2)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Skip
        </button>

        {/* Step dots */}
        <StepDots step={step} />

        {/* Step content */}
        <div aria-live="polite" aria-atomic="true">
          {renderStep()}
        </div>
      </div>
    </div>
  )
}
