/**
 * Toast.tsx
 * Individual toast notification component with slide-in animation.
 */

import React, { useEffect, useRef, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

/** Optional inline action (e.g. "Retry" on a sync failure, spec §17). */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration: number
  action?: ToastAction | undefined
}

interface ToastProps {
  toast: ToastItem
  onDismiss: (id: string) => void
}

const TYPE_COLORS: Record<ToastType, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-danger)',
  info: 'var(--color-info)',
}

const TYPE_LABELS: Record<ToastType, string> = {
  success: 'Success',
  error: 'Error',
  info: 'Information',
}

export function Toast({ toast, onDismiss }: ToastProps): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slideOutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissedRef = useRef(false)

  function dismiss(): void {
    if (dismissedRef.current) return
    dismissedRef.current = true
    setVisible(false)
    slideOutRef.current = setTimeout(() => onDismiss(toast.id), 300)
  }

  // Trigger slide-in after mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Auto-dismiss after duration
  useEffect(() => {
    timerRef.current = setTimeout(dismiss, toast.duration)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      if (slideOutRef.current !== null) clearTimeout(slideOutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, toast.duration])

  const accentColor = TYPE_COLORS[toast.type]

  return (
    <div
      role="alert"
      aria-label={`${TYPE_LABELS[toast.type]}: ${toast.message}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        backgroundColor: 'var(--bg-base)',
        border: '1px solid var(--border-default)',
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        boxShadow: 'var(--shadow-lg)',
        minWidth: '280px',
        maxWidth: '360px',
        fontFamily: 'var(--font-sans)',
        // Slide-in animation via CSS transition
        transform: visible ? 'translateX(0)' : 'translateX(calc(100% + var(--space-6)))',
        opacity: visible ? 1 : 0,
        transition: [
          `transform var(--duration-slow) var(--ease-default)`,
          `opacity var(--duration-slow) var(--ease-default)`,
        ].join(', '),
      }}
    >
      {/* Color accent dot */}
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 8,
          height: 8,
          borderRadius: 'var(--radius-full)',
          backgroundColor: accentColor,
          marginTop: 5,
        }}
      />

      <span
        style={{
          flex: 1,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-primary)',
          lineHeight: 1.5,
        }}
      >
        {toast.message}
      </span>

      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick()
            dismiss()
          }}
          style={{
            flexShrink: 0,
            background: 'none',
            border: `1px solid ${accentColor}`,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            padding: '2px var(--space-2)',
            color: accentColor,
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {toast.action.label}
        </button>
      )}

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notification"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          color: 'var(--text-muted)',
          fontSize: 'var(--text-base)',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        &#x2715;
      </button>
    </div>
  )
}
