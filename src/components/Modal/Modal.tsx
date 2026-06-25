/**
 * Modal.tsx
 * Base modal primitive with focus trap, keyboard handling, and accessibility.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
} from 'react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** If provided, this element receives focus when the modal opens instead of the first focusable element. */
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS))
}

const SIZE_WIDTHS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: '400px',
  md: '560px',
  lg: '768px',
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  initialFocusRef,
}: ModalProps): React.JSX.Element | null {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Trap focus within the dialog
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = getFocusableElements(dialogRef.current)
        if (focusable.length === 0) {
          e.preventDefault()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }
      }
    },
    [isOpen, onClose],
  )

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement

      // Focus: prefer initialFocusRef, then first focusable element
      const raf = requestAnimationFrame(() => {
        if (initialFocusRef?.current) {
          initialFocusRef.current.focus()
        } else if (dialogRef.current) {
          const focusable = getFocusableElements(dialogRef.current)
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-overlay)',
        padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: '100%',
          maxWidth: SIZE_WIDTHS[size],
          backgroundColor: 'var(--bg-base)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.25))',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid var(--border-default)',
            flexShrink: 0,
          }}
        >
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 'var(--space-1)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              fontSize: 'var(--text-lg)',
            }}
          >
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-6)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
