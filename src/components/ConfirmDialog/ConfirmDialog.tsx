/**
 * ConfirmDialog.tsx
 * Reusable confirmation dialog. Focus starts on Cancel for destructive actions.
 */

import React, { useRef } from 'react'
import { Modal } from '../Modal/Modal'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps): React.JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      initialFocusRef={cancelRef}
    >
      <p
        style={{
          margin: '0 0 var(--space-6)',
          fontSize: 'var(--text-base)',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        {message}
      </p>

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          justifyContent: 'flex-end',
        }}
      >
        <button
          ref={cancelRef}
          onClick={onCancel}
          aria-label="Cancel"
          style={{
            padding: 'var(--space-2) var(--space-5)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Cancel
        </button>

        <button
          onClick={onConfirm}
          aria-label={confirmLabel}
          style={{
            padding: 'var(--space-2) var(--space-5)',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: destructive
              ? 'var(--color-danger)'
              : 'var(--color-brand-500)',
            color: 'var(--text-inverse)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
