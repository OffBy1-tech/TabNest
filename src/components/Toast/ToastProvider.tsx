/**
 * ToastProvider.tsx
 * Context provider and container for toast notifications.
 * Renders toasts in a fixed bottom-right container with live region for a11y.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react'
import { Toast } from './Toast'
import type { ToastItem, ToastType, ToastAction } from './Toast'

interface ToastContextValue {
  showToast: (message: string, type: ToastType, duration?: number, action?: ToastAction) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 4000

export function ToastProvider({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback(
    (message: string, type: ToastType, duration: number = DEFAULT_DURATION, action?: ToastAction) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, message, type, duration, action }])
    },
    [],
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Fixed bottom-right toast stack */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Notifications"
        style={{
          position: 'fixed',
          bottom: 'var(--space-6)',
          right: 'var(--space-6)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          alignItems: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <div key={toast.id} style={{ pointerEvents: 'all' }}>
            <Toast toast={toast} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Hook to trigger toasts from anywhere within ToastProvider. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (ctx === null) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
